//! Integration tests for the token-system program, run against LiteSVM.
//!
//! Exercises account-level token management on Token-2022: the manager PDA,
//! the TokenMetadata extension, and every custom error message.

use {
    anchor_lang::{
        prelude::Pubkey, solana_program::instruction::Instruction, AccountDeserialize,
        InstructionData, ToAccountMetas,
    },
    anchor_spl::{
        associated_token::get_associated_token_address_with_program_id,
        token_interface::TokenAccount,
    },
    litesvm::{
        types::{FailedTransactionMetadata, TransactionMetadata},
        LiteSVM,
    },
    solana_keypair::Keypair,
    solana_message::{Message, VersionedMessage},
    solana_signer::Signer,
    solana_transaction::versioned::VersionedTransaction,
    token_system::state::TokenManager,
};

type TxResult = Result<TransactionMetadata, FailedTransactionMetadata>;

// ---------------------------------------------------------------- helpers --

fn setup() -> (LiteSVM, Keypair) {
    let mut svm = LiteSVM::new();
    let bytes = include_bytes!("../../../target/deploy/token_system.so");
    svm.add_program(token_system::id(), bytes).unwrap();
    let authority = Keypair::new();
    svm.airdrop(&authority.pubkey(), 10_000_000_000).unwrap();
    (svm, authority)
}

fn manager_pda(authority: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(&[b"manager", authority.as_ref()], &token_system::id()).0
}

fn mint_pda(manager: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(&[b"mint", manager.as_ref()], &token_system::id()).0
}

fn ata(owner: &Pubkey, mint: &Pubkey) -> Pubkey {
    get_associated_token_address_with_program_id(owner, mint, &anchor_spl::token_2022::ID)
}

fn send(svm: &mut LiteSVM, payer: &Keypair, ix: Instruction) -> TxResult {
    let blockhash = svm.latest_blockhash();
    let msg = Message::new_with_blockhash(&[ix], Some(&payer.pubkey()), &blockhash);
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), &[payer]).unwrap();
    svm.send_transaction(tx)
}

/// Assert a transaction failed AND surfaced the expected error message.
fn assert_fails_with(res: TxResult, needle: &str) {
    let err = res.expect_err("expected the transaction to fail");
    let logs = err.meta.logs.join("\n");
    assert!(
        logs.contains(needle),
        "expected '{needle}' in transaction logs:\n{logs}"
    );
}

fn get<T: AccountDeserialize>(svm: &LiteSVM, address: &Pubkey) -> T {
    let account = svm.get_account(address).expect("account not found");
    T::try_deserialize(&mut account.data.as_slice()).expect("failed to deserialize")
}

fn create_token_ix(
    authority: &Pubkey,
    name: &str,
    symbol: &str,
    uri: &str,
    decimals: u8,
    mint_cap: u64,
) -> Instruction {
    let manager = manager_pda(authority);
    Instruction::new_with_bytes(
        token_system::id(),
        &token_system::instruction::CreateToken {
            name: name.to_string(),
            symbol: symbol.to_string(),
            uri: uri.to_string(),
            decimals,
            mint_cap,
        }
        .data(),
        token_system::accounts::CreateToken {
            authority: *authority,
            manager,
            mint: mint_pda(&manager),
            token_program: anchor_spl::token_2022::ID,
            system_program: anchor_lang::system_program::ID,
        }
        .to_account_metas(None),
    )
}

/// Build a mint_tokens instruction where `authority` claims control over
/// `manager_owner`'s manager PDA (they differ in the unauthorized test).
fn mint_tokens_ix(
    authority: &Pubkey,
    manager_owner: &Pubkey,
    recipient: &Pubkey,
    amount: u64,
) -> Instruction {
    let manager = manager_pda(manager_owner);
    let mint = mint_pda(&manager);
    Instruction::new_with_bytes(
        token_system::id(),
        &token_system::instruction::MintTokens { amount }.data(),
        token_system::accounts::MintTokens {
            authority: *authority,
            recipient: *recipient,
            manager,
            mint,
            recipient_token_account: ata(recipient, &mint),
            token_program: anchor_spl::token_2022::ID,
            associated_token_program: anchor_spl::associated_token::ID,
            system_program: anchor_lang::system_program::ID,
        }
        .to_account_metas(None),
    )
}

fn transfer_ix(sender: &Pubkey, recipient: &Pubkey, mint: &Pubkey, amount: u64) -> Instruction {
    Instruction::new_with_bytes(
        token_system::id(),
        &token_system::instruction::TransferTokens { amount }.data(),
        token_system::accounts::TransferTokens {
            sender: *sender,
            recipient: *recipient,
            mint: *mint,
            sender_token_account: ata(sender, mint),
            recipient_token_account: ata(recipient, mint),
            token_program: anchor_spl::token_2022::ID,
            associated_token_program: anchor_spl::associated_token::ID,
            system_program: anchor_lang::system_program::ID,
        }
        .to_account_metas(None),
    )
}

fn burn_ix(holder: &Pubkey, manager_owner: &Pubkey, amount: u64) -> Instruction {
    let manager = manager_pda(manager_owner);
    let mint = mint_pda(&manager);
    Instruction::new_with_bytes(
        token_system::id(),
        &token_system::instruction::BurnTokens { amount }.data(),
        token_system::accounts::BurnTokens {
            holder: *holder,
            manager,
            mint,
            holder_token_account: ata(holder, &mint),
            token_program: anchor_spl::token_2022::ID,
        }
        .to_account_metas(None),
    )
}

fn update_metadata_ix(
    authority: &Pubkey,
    manager_owner: &Pubkey,
    field_name: &str,
    value: &str,
) -> Instruction {
    let manager = manager_pda(manager_owner);
    Instruction::new_with_bytes(
        token_system::id(),
        &token_system::instruction::UpdateMetadata {
            field_name: field_name.to_string(),
            value: value.to_string(),
        }
        .data(),
        token_system::accounts::UpdateMetadata {
            authority: *authority,
            manager,
            mint: mint_pda(&manager),
            token_program: anchor_spl::token_2022::ID,
            system_program: anchor_lang::system_program::ID,
        }
        .to_account_metas(None),
    )
}

/// Create a standard test token: 6 decimals, cap of 1,000,000 units.
fn standard_token(svm: &mut LiteSVM, authority: &Keypair) -> (Pubkey, Pubkey) {
    send(
        svm,
        authority,
        create_token_ix(
            &authority.pubkey(),
            "Study Coin",
            "STUDY",
            "https://example.com/study.json",
            6,
            1_000_000,
        ),
    )
    .unwrap();
    let manager = manager_pda(&authority.pubkey());
    let mint = mint_pda(&manager);
    (manager, mint)
}

// ----------------------------------------------------------- happy paths --

#[test]
fn create_token_initializes_manager_and_metadata() {
    let (mut svm, authority) = setup();
    let (manager_address, mint_address) = standard_token(&mut svm, &authority);

    let manager: TokenManager = get(&svm, &manager_address);
    assert_eq!(manager.authority, authority.pubkey());
    assert_eq!(manager.mint, mint_address);
    assert_eq!(manager.decimals, 6);
    assert_eq!(manager.mint_cap, 1_000_000);
    assert_eq!(manager.total_minted, 0);
    assert_eq!(manager.total_burned, 0);

    // Mint is owned by Token-2022 and carries the metadata on-account.
    let mint_account = svm.get_account(&mint_address).unwrap();
    assert_eq!(mint_account.owner, anchor_spl::token_2022::ID);
    for needle in [b"Study Coin".as_slice(), b"STUDY".as_slice()] {
        assert!(
            mint_account.data.windows(needle.len()).any(|w| w == needle),
            "metadata value not found on the mint account"
        );
    }
}

#[test]
fn mint_tokens_updates_balance_and_running_total() {
    let (mut svm, authority) = setup();
    let (manager_address, mint_address) = standard_token(&mut svm, &authority);

    let holder = Keypair::new();
    send(
        &mut svm,
        &authority,
        mint_tokens_ix(&authority.pubkey(), &authority.pubkey(), &holder.pubkey(), 500),
    )
    .unwrap();

    let manager: TokenManager = get(&svm, &manager_address);
    assert_eq!(manager.total_minted, 500);

    let holder_account: TokenAccount = get(&svm, &ata(&holder.pubkey(), &mint_address));
    assert_eq!(holder_account.amount, 500);
}

#[test]
fn transfer_moves_tokens_between_wallets() {
    let (mut svm, authority) = setup();
    let (_, mint_address) = standard_token(&mut svm, &authority);

    let alice = Keypair::new();
    svm.airdrop(&alice.pubkey(), 1_000_000_000).unwrap();
    let bob = Keypair::new();

    send(
        &mut svm,
        &authority,
        mint_tokens_ix(&authority.pubkey(), &authority.pubkey(), &alice.pubkey(), 300),
    )
    .unwrap();
    send(
        &mut svm,
        &alice,
        transfer_ix(&alice.pubkey(), &bob.pubkey(), &mint_address, 120),
    )
    .unwrap();

    let alice_account: TokenAccount = get(&svm, &ata(&alice.pubkey(), &mint_address));
    let bob_account: TokenAccount = get(&svm, &ata(&bob.pubkey(), &mint_address));
    assert_eq!(alice_account.amount, 180);
    assert_eq!(bob_account.amount, 120);
}

#[test]
fn burn_reduces_balance_and_tracks_total() {
    let (mut svm, authority) = setup();
    let (manager_address, mint_address) = standard_token(&mut svm, &authority);

    let holder = Keypair::new();
    svm.airdrop(&holder.pubkey(), 1_000_000_000).unwrap();
    send(
        &mut svm,
        &authority,
        mint_tokens_ix(&authority.pubkey(), &authority.pubkey(), &holder.pubkey(), 400),
    )
    .unwrap();
    send(
        &mut svm,
        &holder,
        burn_ix(&holder.pubkey(), &authority.pubkey(), 150),
    )
    .unwrap();

    let holder_account: TokenAccount = get(&svm, &ata(&holder.pubkey(), &mint_address));
    assert_eq!(holder_account.amount, 250);

    let manager: TokenManager = get(&svm, &manager_address);
    assert_eq!(manager.total_burned, 150);
}

#[test]
fn metadata_fields_can_be_updated_by_the_authority() {
    let (mut svm, authority) = setup();
    let (_, mint_address) = standard_token(&mut svm, &authority);

    send(
        &mut svm,
        &authority,
        update_metadata_ix(&authority.pubkey(), &authority.pubkey(), "name", "Graduated Coin"),
    )
    .unwrap();

    let mint_account = svm.get_account(&mint_address).unwrap();
    let needle = b"Graduated Coin";
    assert!(
        mint_account.data.windows(needle.len()).any(|w| w == needle),
        "updated name not found on the mint account"
    );
}

#[test]
fn minting_in_a_loop_accumulates_until_the_cap() {
    let (mut svm, authority) = setup();
    let (manager_address, _) = standard_token(&mut svm, &authority);
    let holder = Keypair::new();

    // 10 mints of 100,000 reach the 1,000,000 cap exactly...
    for _ in 0..10 {
        send(
            &mut svm,
            &authority,
            mint_tokens_ix(
                &authority.pubkey(),
                &authority.pubkey(),
                &holder.pubkey(),
                100_000,
            ),
        )
        .unwrap();
        svm.expire_blockhash(); // identical txs need a fresh blockhash
    }
    let manager: TokenManager = get(&svm, &manager_address);
    assert_eq!(manager.total_minted, 1_000_000);

    // ...so even one more token must be rejected.
    let res = send(
        &mut svm,
        &authority,
        mint_tokens_ix(&authority.pubkey(), &authority.pubkey(), &holder.pubkey(), 1),
    );
    assert_fails_with(res, "SupplyCapExceeded");
}

// -------------------------------------------------------- failure tests --

#[test]
fn create_token_rejects_long_name() {
    let (mut svm, authority) = setup();
    let long_name = "x".repeat(33); // MAX_NAME_LEN is 32
    let res = send(
        &mut svm,
        &authority,
        create_token_ix(&authority.pubkey(), &long_name, "SYM", "", 6, 1000),
    );
    assert_fails_with(res, "StringTooLong");
}

#[test]
fn create_token_rejects_zero_cap() {
    let (mut svm, authority) = setup();
    let res = send(
        &mut svm,
        &authority,
        create_token_ix(&authority.pubkey(), "Coin", "SYM", "", 6, 0),
    );
    assert_fails_with(res, "InvalidSupplyCap");
}

#[test]
fn only_the_authority_can_mint() {
    let (mut svm, authority) = setup();
    standard_token(&mut svm, &authority);

    let mallory = Keypair::new();
    svm.airdrop(&mallory.pubkey(), 1_000_000_000).unwrap();
    let res = send(
        &mut svm,
        &mallory,
        // mallory signs, but targets the real authority's manager PDA
        mint_tokens_ix(&mallory.pubkey(), &authority.pubkey(), &mallory.pubkey(), 100),
    );
    assert_fails_with(res, "Unauthorized");
}

#[test]
fn minting_zero_tokens_is_rejected() {
    let (mut svm, authority) = setup();
    standard_token(&mut svm, &authority);
    let holder = Keypair::new();
    let res = send(
        &mut svm,
        &authority,
        mint_tokens_ix(&authority.pubkey(), &authority.pubkey(), &holder.pubkey(), 0),
    );
    assert_fails_with(res, "InvalidAmount");
}

#[test]
fn transferring_more_than_the_balance_fails() {
    let (mut svm, authority) = setup();
    let (_, mint_address) = standard_token(&mut svm, &authority);

    let alice = Keypair::new();
    svm.airdrop(&alice.pubkey(), 1_000_000_000).unwrap();
    let bob = Keypair::new();
    send(
        &mut svm,
        &authority,
        mint_tokens_ix(&authority.pubkey(), &authority.pubkey(), &alice.pubkey(), 50),
    )
    .unwrap();

    // Token-2022 itself rejects this with its own error message.
    let res = send(
        &mut svm,
        &alice,
        transfer_ix(&alice.pubkey(), &bob.pubkey(), &mint_address, 100),
    );
    assert_fails_with(res, "insufficient funds");
}

#[test]
fn update_metadata_rejects_unknown_field() {
    let (mut svm, authority) = setup();
    standard_token(&mut svm, &authority);
    let res = send(
        &mut svm,
        &authority,
        update_metadata_ix(&authority.pubkey(), &authority.pubkey(), "logo", "value"),
    );
    assert_fails_with(res, "InvalidMetadataField");
}

#[test]
fn only_the_authority_can_update_metadata() {
    let (mut svm, authority) = setup();
    standard_token(&mut svm, &authority);

    let mallory = Keypair::new();
    svm.airdrop(&mallory.pubkey(), 1_000_000_000).unwrap();
    let res = send(
        &mut svm,
        &mallory,
        update_metadata_ix(&mallory.pubkey(), &authority.pubkey(), "name", "Hacked"),
    );
    assert_fails_with(res, "Unauthorized");
}
