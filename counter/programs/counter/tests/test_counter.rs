//! Integration tests for the counter program, run against LiteSVM.
//!
//! Includes loop verification: state changes are applied repeatedly and
//! the stored PDA data is re-read and checked on every iteration.

use {
    anchor_lang::{
        prelude::Pubkey, solana_program::instruction::Instruction, AccountDeserialize,
        InstructionData, ToAccountMetas,
    },
    counter::Counter,
    litesvm::{
        types::{FailedTransactionMetadata, TransactionMetadata},
        LiteSVM,
    },
    solana_keypair::Keypair,
    solana_message::{Message, VersionedMessage},
    solana_signer::Signer,
    solana_transaction::versioned::VersionedTransaction,
};

type TxResult = Result<TransactionMetadata, FailedTransactionMetadata>;

// ---------------------------------------------------------------- helpers --

fn setup() -> (LiteSVM, Keypair) {
    let mut svm = LiteSVM::new();
    let bytes = include_bytes!("../../../target/deploy/counter.so");
    svm.add_program(counter::id(), bytes).unwrap();
    let user = Keypair::new();
    svm.airdrop(&user.pubkey(), 1_000_000_000).unwrap();
    (svm, user)
}

fn counter_pda(authority: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(&[b"counter", authority.as_ref()], &counter::id()).0
}

fn send(svm: &mut LiteSVM, payer: &Keypair, ix: Instruction) -> TxResult {
    // Identical instructions signed over the same blockhash would produce
    // the same signature and be rejected as duplicates, so refresh it —
    // this is what makes calling increment in a loop work.
    svm.expire_blockhash();
    let blockhash = svm.latest_blockhash();
    let msg = Message::new_with_blockhash(&[ix], Some(&payer.pubkey()), &blockhash);
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), &[payer]).unwrap();
    svm.send_transaction(tx)
}

fn initialize_ix(authority: &Pubkey) -> Instruction {
    Instruction::new_with_bytes(
        counter::id(),
        &counter::instruction::Initialize {}.data(),
        counter::accounts::Initialize {
            authority: *authority,
            counter: counter_pda(authority),
            system_program: anchor_lang::system_program::ID,
        }
        .to_account_metas(None),
    )
}

/// increment / decrement / reset share the same account layout.
fn update_ix(authority: &Pubkey, counter_owner: &Pubkey, data: Vec<u8>) -> Instruction {
    Instruction::new_with_bytes(
        counter::id(),
        &data,
        counter::accounts::Update {
            authority: *authority,
            counter: counter_pda(counter_owner),
        }
        .to_account_metas(None),
    )
}

fn read_count(svm: &LiteSVM, authority: &Pubkey) -> u64 {
    let account = svm.get_account(&counter_pda(authority)).unwrap();
    let state = Counter::try_deserialize(&mut account.data.as_slice()).unwrap();
    state.count
}

fn assert_fails_with(res: TxResult, needle: &str) {
    let err = res.expect_err("expected the transaction to fail");
    let logs = err.meta.logs.join("\n");
    assert!(
        logs.contains(needle),
        "expected '{needle}' in transaction logs:\n{logs}"
    );
}

// ------------------------------------------------------------------ tests --

#[test]
fn initialize_creates_a_zeroed_pda() {
    let (mut svm, user) = setup();
    send(&mut svm, &user, initialize_ix(&user.pubkey())).unwrap();

    let account = svm.get_account(&counter_pda(&user.pubkey())).unwrap();
    // The PDA is owned by our program and sized exactly as declared.
    assert_eq!(account.owner, counter::id());
    assert_eq!(account.data.len(), 8 + 32 + 8 + 1);

    let state = Counter::try_deserialize(&mut account.data.as_slice()).unwrap();
    assert_eq!(state.count, 0);
    assert_eq!(state.authority, user.pubkey());
}

#[test]
fn increments_verified_in_a_loop() {
    let (mut svm, user) = setup();
    send(&mut svm, &user, initialize_ix(&user.pubkey())).unwrap();

    // Increment ten times, re-reading the persisted PDA data every pass.
    for expected in 1..=10u64 {
        let ix = update_ix(
            &user.pubkey(),
            &user.pubkey(),
            counter::instruction::Increment {}.data(),
        );
        send(&mut svm, &user, ix).unwrap();
        assert_eq!(read_count(&svm, &user.pubkey()), expected);
    }
}

#[test]
fn decrement_and_reset_update_the_stored_value() {
    let (mut svm, user) = setup();
    send(&mut svm, &user, initialize_ix(&user.pubkey())).unwrap();

    for _ in 0..3 {
        let ix = update_ix(
            &user.pubkey(),
            &user.pubkey(),
            counter::instruction::Increment {}.data(),
        );
        send(&mut svm, &user, ix).unwrap();
    }
    let ix = update_ix(
        &user.pubkey(),
        &user.pubkey(),
        counter::instruction::Decrement {}.data(),
    );
    send(&mut svm, &user, ix).unwrap();
    assert_eq!(read_count(&svm, &user.pubkey()), 2);

    let ix = update_ix(
        &user.pubkey(),
        &user.pubkey(),
        counter::instruction::Reset {}.data(),
    );
    send(&mut svm, &user, ix).unwrap();
    assert_eq!(read_count(&svm, &user.pubkey()), 0);
}

#[test]
fn each_wallet_gets_its_own_counter() {
    let (mut svm, alice) = setup();
    let bob = Keypair::new();
    svm.airdrop(&bob.pubkey(), 1_000_000_000).unwrap();

    send(&mut svm, &alice, initialize_ix(&alice.pubkey())).unwrap();
    send(&mut svm, &bob, initialize_ix(&bob.pubkey())).unwrap();

    // Same seeds prefix, different wallet => different PDA, independent data.
    assert_ne!(counter_pda(&alice.pubkey()), counter_pda(&bob.pubkey()));

    let ix = update_ix(
        &alice.pubkey(),
        &alice.pubkey(),
        counter::instruction::Increment {}.data(),
    );
    send(&mut svm, &alice, ix).unwrap();

    assert_eq!(read_count(&svm, &alice.pubkey()), 1);
    assert_eq!(read_count(&svm, &bob.pubkey()), 0);
}

// -------------------------------------------------------- failure tests --

#[test]
fn decrementing_below_zero_fails() {
    let (mut svm, user) = setup();
    send(&mut svm, &user, initialize_ix(&user.pubkey())).unwrap();

    let ix = update_ix(
        &user.pubkey(),
        &user.pubkey(),
        counter::instruction::Decrement {}.data(),
    );
    let res = send(&mut svm, &user, ix);
    assert_fails_with(res, "Underflow");
}

#[test]
fn only_the_owner_can_modify_a_counter() {
    let (mut svm, alice) = setup();
    send(&mut svm, &alice, initialize_ix(&alice.pubkey())).unwrap();

    let mallory = Keypair::new();
    svm.airdrop(&mallory.pubkey(), 1_000_000_000).unwrap();

    // Mallory signs but targets Alice's counter PDA.
    let ix = update_ix(
        &mallory.pubkey(),
        &alice.pubkey(),
        counter::instruction::Increment {}.data(),
    );
    let res = send(&mut svm, &mallory, ix);
    assert_fails_with(res, "Unauthorized");
}

#[test]
fn a_counter_cannot_be_initialized_twice() {
    let (mut svm, user) = setup();
    send(&mut svm, &user, initialize_ix(&user.pubkey())).unwrap();
    // The PDA already exists, so the System Program refuses to create it.
    let res = send(&mut svm, &user, initialize_ix(&user.pubkey()));
    assert!(res.is_err(), "second initialize should fail");
}
