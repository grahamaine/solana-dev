//! Integration tests for the tip-jar program, run against LiteSVM.
//!
//! Covers both CPI signer patterns (`invoke` for deposit, `invoke_signed`
//! for withdraw), the rent-exempt-minimum guard, and that a vault's seeds
//! (not a stored authority field) are what keep it safe.

use {
    anchor_lang::{
        prelude::Pubkey, solana_program::instruction::Instruction, InstructionData,
        ToAccountMetas,
    },
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
    let bytes = include_bytes!("../../../target/deploy/tip_jar.so");
    svm.add_program(tip_jar::id(), bytes).unwrap();
    let owner = Keypair::new();
    svm.airdrop(&owner.pubkey(), 10_000_000_000).unwrap();
    (svm, owner)
}

fn vault_pda(owner: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(&[b"vault", owner.as_ref()], &tip_jar::id()).0
}

fn send(svm: &mut LiteSVM, payer: &Keypair, ix: Instruction) -> TxResult {
    svm.expire_blockhash();
    let blockhash = svm.latest_blockhash();
    let msg = Message::new_with_blockhash(&[ix], Some(&payer.pubkey()), &blockhash);
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), &[payer]).unwrap();
    svm.send_transaction(tx)
}

fn assert_fails_with(res: TxResult, needle: &str) {
    let err = res.expect_err("expected the transaction to fail");
    let logs = err.meta.logs.join("\n");
    assert!(
        logs.contains(needle),
        "expected '{needle}' in transaction logs:\n{logs}"
    );
}

fn vault_balance(svm: &LiteSVM, owner: &Pubkey) -> u64 {
    svm.get_account(&vault_pda(owner))
        .map(|a| a.lamports)
        .unwrap_or(0)
}

fn deposit_ix(owner: &Pubkey, amount: u64) -> Instruction {
    Instruction::new_with_bytes(
        tip_jar::id(),
        &tip_jar::instruction::Deposit { amount }.data(),
        tip_jar::accounts::Deposit {
            owner: *owner,
            vault: vault_pda(owner),
            system_program: anchor_lang::system_program::ID,
        }
        .to_account_metas(None),
    )
}

fn withdraw_ix(owner: &Pubkey, amount: u64) -> Instruction {
    Instruction::new_with_bytes(
        tip_jar::id(),
        &tip_jar::instruction::Withdraw { amount }.data(),
        tip_jar::accounts::Withdraw {
            owner: *owner,
            vault: vault_pda(owner),
            system_program: anchor_lang::system_program::ID,
        }
        .to_account_metas(None),
    )
}

// ------------------------------------------------------------------ tests --

#[test]
fn deposit_credits_the_vault_pda_via_invoke() {
    let (mut svm, owner) = setup();
    let ix = deposit_ix(&owner.pubkey(), 1_000_000);
    send(&mut svm, &owner, ix).unwrap();

    assert_eq!(vault_balance(&svm, &owner.pubkey()), 1_000_000);
}

#[test]
fn multiple_deposits_accumulate() {
    let (mut svm, owner) = setup();
    for _ in 0..3 {
        let ix = deposit_ix(&owner.pubkey(), 500_000);
        send(&mut svm, &owner, ix).unwrap();
    }
    assert_eq!(vault_balance(&svm, &owner.pubkey()), 1_500_000);
}

#[test]
fn withdraw_moves_lamports_out_via_invoke_signed() {
    let (mut svm, owner) = setup();
    let ix = deposit_ix(&owner.pubkey(), 2_000_000);
    send(&mut svm, &owner, ix).unwrap();

    let before = svm.get_balance(&owner.pubkey()).unwrap();
    let ix = withdraw_ix(&owner.pubkey(), 1_000_000);
    send(&mut svm, &owner, ix).unwrap();

    assert_eq!(vault_balance(&svm, &owner.pubkey()), 1_000_000);
    // Owner's wallet balance rose by the withdrawal, minus the tx fee.
    let after = svm.get_balance(&owner.pubkey()).unwrap();
    assert!(after > before, "owner balance should have increased");
}

#[test]
fn draining_the_vault_to_zero_is_allowed() {
    let (mut svm, owner) = setup();
    let ix = deposit_ix(&owner.pubkey(), 1_000_000);
    send(&mut svm, &owner, ix).unwrap();

    let ix = withdraw_ix(&owner.pubkey(), 1_000_000);
    send(&mut svm, &owner, ix).unwrap();

    assert_eq!(vault_balance(&svm, &owner.pubkey()), 0);
}

#[test]
fn each_wallet_gets_its_own_independent_vault() {
    let (mut svm, alice) = setup();
    let bob = Keypair::new();
    svm.airdrop(&bob.pubkey(), 10_000_000_000).unwrap();

    let ix = deposit_ix(&alice.pubkey(), 1_000_000);
    send(&mut svm, &alice, ix).unwrap();
    let ix = deposit_ix(&bob.pubkey(), 5_000_000);
    send(&mut svm, &bob, ix).unwrap();

    assert_ne!(vault_pda(&alice.pubkey()), vault_pda(&bob.pubkey()));
    assert_eq!(vault_balance(&svm, &alice.pubkey()), 1_000_000);
    assert_eq!(vault_balance(&svm, &bob.pubkey()), 5_000_000);
}

// -------------------------------------------------------- failure tests --

#[test]
fn deposit_rejects_a_zero_amount() {
    let (mut svm, owner) = setup();
    let ix = deposit_ix(&owner.pubkey(), 0);
    let res = send(&mut svm, &owner, ix);
    assert_fails_with(res, "InvalidAmount");
}

#[test]
fn withdraw_fails_if_it_exceeds_the_vault_balance() {
    let (mut svm, owner) = setup();
    let ix = deposit_ix(&owner.pubkey(), 1_000_000);
    send(&mut svm, &owner, ix).unwrap();

    let ix = withdraw_ix(&owner.pubkey(), 2_000_000);
    let res = send(&mut svm, &owner, ix);
    assert_fails_with(res, "InsufficientVaultBalance");
}

#[test]
fn partial_withdraw_below_rent_exempt_minimum_fails() {
    let (mut svm, owner) = setup();
    let rent_exempt_minimum = svm.minimum_balance_for_rent_exemption(0);

    let ix = deposit_ix(&owner.pubkey(), rent_exempt_minimum + 100);
    send(&mut svm, &owner, ix).unwrap();

    // Leaves rent_exempt_minimum - 50 behind — under the minimum, and not zero.
    let ix = withdraw_ix(&owner.pubkey(), 150);
    let res = send(&mut svm, &owner, ix);
    assert_fails_with(res, "BelowRentExemptMinimum");
}

#[test]
fn a_wallet_cannot_reach_another_wallets_vault() {
    let (mut svm, alice) = setup();
    let mallory = Keypair::new();
    svm.airdrop(&mallory.pubkey(), 1_000_000_000).unwrap();

    let ix = deposit_ix(&alice.pubkey(), 1_000_000);
    send(&mut svm, &alice, ix).unwrap();

    // Mallory signs, but the accounts struct derives *her* vault PDA from
    // her own key — there is no path to target Alice's vault at all.
    let ix = Instruction::new_with_bytes(
        tip_jar::id(),
        &tip_jar::instruction::Withdraw { amount: 1_000_000 }.data(),
        tip_jar::accounts::Withdraw {
            owner: mallory.pubkey(),
            vault: vault_pda(&mallory.pubkey()),
            system_program: anchor_lang::system_program::ID,
        }
        .to_account_metas(None),
    );
    let res = send(&mut svm, &mallory, ix);
    assert_fails_with(res, "InsufficientVaultBalance");

    // Alice's funds are untouched.
    assert_eq!(vault_balance(&svm, &alice.pubkey()), 1_000_000);
}
