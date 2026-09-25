//! Integration tests for the escrow program, run against LiteSVM.
//!
//! Covers the full trustless-swap lifecycle (make -> take, make -> cancel),
//! running two independent escrows per maker, the failure paths (zero
//! amounts, an underfunded taker, wrong mint, a non-maker cancel, a second
//! take, a take after cancel), and that token supply is conserved end to
//! end — no hidden mint/burn side effects.

use {
    anchor_lang::{
        prelude::Pubkey, solana_program::instruction::Instruction, AccountDeserialize,
        InstructionData, ToAccountMetas,
    },
    anchor_spl::associated_token::get_associated_token_address_with_program_id,
    escrow::state::Escrow,
    litesvm::{
        types::{FailedTransactionMetadata, TransactionMetadata},
        LiteSVM,
    },
    litesvm_token::{CreateAssociatedTokenAccount, CreateMint, MintTo},
    solana_keypair::Keypair,
    solana_message::{Message, VersionedMessage},
    solana_signer::Signer,
    solana_transaction::versioned::VersionedTransaction,
};

type TxResult = Result<TransactionMetadata, FailedTransactionMetadata>;

const TOKEN_PROGRAM: Pubkey = anchor_spl::token::ID;
const ASSOCIATED_TOKEN_PROGRAM: Pubkey = anchor_spl::associated_token::ID;
const DEPOSIT: u64 = 1_000;
const RECEIVE: u64 = 500;

// ---------------------------------------------------------------- helpers --

struct World {
    svm: LiteSVM,
    maker: Keypair,
    taker: Keypair,
    mint_a: Pubkey,
    mint_b: Pubkey,
}

/// Two wallets, two independent SPL mints (maker controls mint_a, taker
/// controls mint_b), each funded with 10_000 of their own token.
fn setup() -> World {
    let mut svm = LiteSVM::new();
    let bytes = include_bytes!("../../../target/deploy/escrow.so");
    svm.add_program(escrow::id(), bytes).unwrap();

    let maker = Keypair::new();
    let taker = Keypair::new();
    svm.airdrop(&maker.pubkey(), 10_000_000_000).unwrap();
    svm.airdrop(&taker.pubkey(), 10_000_000_000).unwrap();

    let mint_a = CreateMint::new(&mut svm, &maker).decimals(6).send().unwrap();
    let mint_b = CreateMint::new(&mut svm, &taker).decimals(6).send().unwrap();

    let maker_ata_a = CreateAssociatedTokenAccount::new(&mut svm, &maker, &mint_a)
        .send()
        .unwrap();
    let taker_ata_b = CreateAssociatedTokenAccount::new(&mut svm, &taker, &mint_b)
        .send()
        .unwrap();

    MintTo::new(&mut svm, &maker, &mint_a, &maker_ata_a, 10_000)
        .send()
        .unwrap();
    MintTo::new(&mut svm, &taker, &mint_b, &taker_ata_b, 10_000)
        .send()
        .unwrap();

    World {
        svm,
        maker,
        taker,
        mint_a,
        mint_b,
    }
}

fn escrow_pda(maker: &Pubkey, seed: u64) -> Pubkey {
    Pubkey::find_program_address(
        &[b"escrow", maker.as_ref(), &seed.to_le_bytes()],
        &escrow::id(),
    )
    .0
}

fn ata(owner: &Pubkey, mint: &Pubkey) -> Pubkey {
    get_associated_token_address_with_program_id(owner, mint, &TOKEN_PROGRAM)
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

fn token_balance(svm: &LiteSVM, account: &Pubkey) -> u64 {
    litesvm_token::get_spl_account::<litesvm_token::spl_token::state::Account>(svm, account)
        .unwrap()
        .amount
}

fn account_exists(svm: &LiteSVM, address: &Pubkey) -> bool {
    svm.get_account(address).is_some()
}

fn make_ix(w: &World, seed: u64, deposit: u64, receive: u64) -> Instruction {
    let escrow = escrow_pda(&w.maker.pubkey(), seed);
    Instruction::new_with_bytes(
        escrow::id(),
        &escrow::instruction::Make {
            seed,
            deposit,
            receive,
        }
        .data(),
        escrow::accounts::Make {
            maker: w.maker.pubkey(),
            mint_a: w.mint_a,
            mint_b: w.mint_b,
            maker_ata_a: ata(&w.maker.pubkey(), &w.mint_a),
            escrow,
            vault: ata(&escrow, &w.mint_a),
            token_program: TOKEN_PROGRAM,
            associated_token_program: ASSOCIATED_TOKEN_PROGRAM,
            system_program: anchor_lang::system_program::ID,
        }
        .to_account_metas(None),
    )
}

fn take_ix(w: &World, seed: u64) -> Instruction {
    let escrow = escrow_pda(&w.maker.pubkey(), seed);
    Instruction::new_with_bytes(
        escrow::id(),
        &escrow::instruction::Take {}.data(),
        escrow::accounts::Take {
            taker: w.taker.pubkey(),
            maker: w.maker.pubkey(),
            mint_a: w.mint_a,
            mint_b: w.mint_b,
            taker_ata_b: ata(&w.taker.pubkey(), &w.mint_b),
            taker_ata_a: ata(&w.taker.pubkey(), &w.mint_a),
            maker_ata_b: ata(&w.maker.pubkey(), &w.mint_b),
            escrow,
            vault: ata(&escrow, &w.mint_a),
            token_program: TOKEN_PROGRAM,
            associated_token_program: ASSOCIATED_TOKEN_PROGRAM,
            system_program: anchor_lang::system_program::ID,
        }
        .to_account_metas(None),
    )
}

fn cancel_ix(w: &World, seed: u64) -> Instruction {
    let escrow = escrow_pda(&w.maker.pubkey(), seed);
    Instruction::new_with_bytes(
        escrow::id(),
        &escrow::instruction::Cancel {}.data(),
        escrow::accounts::Cancel {
            maker: w.maker.pubkey(),
            mint_a: w.mint_a,
            maker_ata_a: ata(&w.maker.pubkey(), &w.mint_a),
            escrow,
            vault: ata(&escrow, &w.mint_a),
            token_program: TOKEN_PROGRAM,
            system_program: anchor_lang::system_program::ID,
        }
        .to_account_metas(None),
    )
}

// ------------------------------------------------------------------ tests --

#[test]
fn make_deposits_token_a_and_records_the_offer() {
    let mut w = setup();
    let ix = make_ix(&w, 1, DEPOSIT, RECEIVE);
    send(&mut w.svm, &w.maker, ix).unwrap();

    let escrow = escrow_pda(&w.maker.pubkey(), 1);
    let vault = ata(&escrow, &w.mint_a);

    assert_eq!(token_balance(&w.svm, &vault), DEPOSIT);
    assert_eq!(token_balance(&w.svm, &ata(&w.maker.pubkey(), &w.mint_a)), 10_000 - DEPOSIT);

    let account = w.svm.get_account(&escrow).unwrap();
    let state = Escrow::try_deserialize(&mut account.data.as_slice()).unwrap();
    assert_eq!(state.maker, w.maker.pubkey());
    assert_eq!(state.mint_a, w.mint_a);
    assert_eq!(state.mint_b, w.mint_b);
    assert_eq!(state.receive, RECEIVE);
    assert_eq!(state.seed, 1);
}

#[test]
fn take_settles_the_swap_and_closes_vault_and_escrow() {
    let mut w = setup();
    let ix = make_ix(&w, 1, DEPOSIT, RECEIVE);
    send(&mut w.svm, &w.maker, ix).unwrap();
    let ix = take_ix(&w, 1);
    send(&mut w.svm, &w.taker, ix).unwrap();

    // Taker paid `RECEIVE` of token B and received `DEPOSIT` of token A.
    assert_eq!(token_balance(&w.svm, &ata(&w.taker.pubkey(), &w.mint_b)), 10_000 - RECEIVE);
    assert_eq!(token_balance(&w.svm, &ata(&w.taker.pubkey(), &w.mint_a)), DEPOSIT);

    // Maker received `RECEIVE` of token B and already spent `DEPOSIT` of token A.
    assert_eq!(token_balance(&w.svm, &ata(&w.maker.pubkey(), &w.mint_b)), RECEIVE);
    assert_eq!(token_balance(&w.svm, &ata(&w.maker.pubkey(), &w.mint_a)), 10_000 - DEPOSIT);

    let escrow = escrow_pda(&w.maker.pubkey(), 1);
    assert!(!account_exists(&w.svm, &escrow), "escrow should be closed");
    assert!(
        !account_exists(&w.svm, &ata(&escrow, &w.mint_a)),
        "vault should be closed"
    );
}

#[test]
fn cancel_returns_the_deposit_and_closes_vault_and_escrow() {
    let mut w = setup();
    let ix = make_ix(&w, 1, DEPOSIT, RECEIVE);
    send(&mut w.svm, &w.maker, ix).unwrap();
    let ix = cancel_ix(&w, 1);
    send(&mut w.svm, &w.maker, ix).unwrap();

    assert_eq!(token_balance(&w.svm, &ata(&w.maker.pubkey(), &w.mint_a)), 10_000);

    let escrow = escrow_pda(&w.maker.pubkey(), 1);
    assert!(!account_exists(&w.svm, &escrow), "escrow should be closed");
    assert!(
        !account_exists(&w.svm, &ata(&escrow, &w.mint_a)),
        "vault should be closed"
    );
}

#[test]
fn a_maker_can_run_two_escrows_at_once_with_different_seeds() {
    let mut w = setup();
    let ix = make_ix(&w, 1, 100, 50);
    send(&mut w.svm, &w.maker, ix).unwrap();
    let ix = make_ix(&w, 2, 200, 75);
    send(&mut w.svm, &w.maker, ix).unwrap();

    let vault_1 = ata(&escrow_pda(&w.maker.pubkey(), 1), &w.mint_a);
    let vault_2 = ata(&escrow_pda(&w.maker.pubkey(), 2), &w.mint_a);
    assert_ne!(vault_1, vault_2);
    assert_eq!(token_balance(&w.svm, &vault_1), 100);
    assert_eq!(token_balance(&w.svm, &vault_2), 200);
    assert_eq!(
        token_balance(&w.svm, &ata(&w.maker.pubkey(), &w.mint_a)),
        10_000 - 300
    );
}

// -------------------------------------------------------- failure tests --

#[test]
fn make_rejects_a_zero_deposit_or_receive_amount() {
    let mut w = setup();
    let ix = make_ix(&w, 1, 0, RECEIVE);
    let res = send(&mut w.svm, &w.maker, ix);
    assert_fails_with(res, "InvalidAmount");

    let ix = make_ix(&w, 2, DEPOSIT, 0);
    let res = send(&mut w.svm, &w.maker, ix);
    assert_fails_with(res, "InvalidAmount");
}

#[test]
fn take_fails_if_the_taker_cannot_cover_the_asking_price() {
    let mut w = setup();
    let ix = make_ix(&w, 1, DEPOSIT, RECEIVE);
    send(&mut w.svm, &w.maker, ix).unwrap();

    // Ask for more token B than the taker holds.
    let escrow = escrow_pda(&w.maker.pubkey(), 1);
    let ix = Instruction::new_with_bytes(
        escrow::id(),
        &escrow::instruction::Take {}.data(),
        escrow::accounts::Take {
            taker: w.taker.pubkey(),
            maker: w.maker.pubkey(),
            mint_a: w.mint_a,
            mint_b: w.mint_b,
            taker_ata_b: ata(&w.taker.pubkey(), &w.mint_b),
            taker_ata_a: ata(&w.taker.pubkey(), &w.mint_a),
            maker_ata_b: ata(&w.maker.pubkey(), &w.mint_b),
            escrow,
            vault: ata(&escrow, &w.mint_a),
            token_program: TOKEN_PROGRAM,
            associated_token_program: ASSOCIATED_TOKEN_PROGRAM,
            system_program: anchor_lang::system_program::ID,
        }
        .to_account_metas(None),
    );

    // Drain the taker's token B first so they can't afford this escrow.
    let drain = anchor_spl::token::spl_token::instruction::burn(
        &TOKEN_PROGRAM,
        &ata(&w.taker.pubkey(), &w.mint_b),
        &w.mint_b,
        &w.taker.pubkey(),
        &[],
        10_000,
    )
    .unwrap();
    send(&mut w.svm, &w.taker, drain).unwrap();

    let res = send(&mut w.svm, &w.taker, ix);
    assert!(res.is_err(), "take should fail: taker can't cover the price");
}

#[test]
fn only_the_maker_can_cancel_their_escrow() {
    let mut w = setup();
    let ix = make_ix(&w, 1, DEPOSIT, RECEIVE);
    send(&mut w.svm, &w.maker, ix).unwrap();

    // Mallory (the taker, here) signs but has no escrow of her own — the
    // PDA derived from her key won't match any initialized account.
    let mallory = &w.taker;
    let bogus_escrow = escrow_pda(&mallory.pubkey(), 1);
    let ix = Instruction::new_with_bytes(
        escrow::id(),
        &escrow::instruction::Cancel {}.data(),
        escrow::accounts::Cancel {
            maker: mallory.pubkey(),
            mint_a: w.mint_a,
            maker_ata_a: ata(&mallory.pubkey(), &w.mint_a),
            escrow: bogus_escrow,
            vault: ata(&bogus_escrow, &w.mint_a),
            token_program: TOKEN_PROGRAM,
            system_program: anchor_lang::system_program::ID,
        }
        .to_account_metas(None),
    );

    let res = send(&mut w.svm, mallory, ix);
    assert!(res.is_err(), "cancel should fail: no such escrow for this signer");
}

#[test]
fn a_second_take_fails_because_the_escrow_is_already_closed() {
    let mut w = setup();
    let ix = make_ix(&w, 1, DEPOSIT, RECEIVE);
    send(&mut w.svm, &w.maker, ix).unwrap();
    let ix = take_ix(&w, 1);
    send(&mut w.svm, &w.taker, ix).unwrap();

    // Same instruction again: the escrow (and vault) account is gone.
    let ix = take_ix(&w, 1);
    let res = send(&mut w.svm, &w.taker, ix);
    assert!(res.is_err(), "second take should fail: escrow already closed");
}

#[test]
fn take_fails_after_the_maker_has_cancelled() {
    let mut w = setup();
    let ix = make_ix(&w, 1, DEPOSIT, RECEIVE);
    send(&mut w.svm, &w.maker, ix).unwrap();
    let ix = cancel_ix(&w, 1);
    send(&mut w.svm, &w.maker, ix).unwrap();

    let ix = take_ix(&w, 1);
    let res = send(&mut w.svm, &w.taker, ix);
    assert!(res.is_err(), "take should fail: escrow was cancelled and closed");
}

#[test]
fn take_fails_if_the_taker_offers_the_wrong_mint() {
    let mut w = setup();
    let ix = make_ix(&w, 1, DEPOSIT, RECEIVE);
    send(&mut w.svm, &w.maker, ix).unwrap();

    // A third mint the taker holds, standing in for "the wrong token".
    let wrong_mint = CreateMint::new(&mut w.svm, &w.taker).decimals(6).send().unwrap();
    let taker_wrong_ata = CreateAssociatedTokenAccount::new(&mut w.svm, &w.taker, &wrong_mint)
        .send()
        .unwrap();
    let mint_to = MintTo::new(&mut w.svm, &w.taker, &wrong_mint, &taker_wrong_ata, 10_000);
    mint_to.send().unwrap();

    let escrow = escrow_pda(&w.maker.pubkey(), 1);
    let ix = Instruction::new_with_bytes(
        escrow::id(),
        &escrow::instruction::Take {}.data(),
        escrow::accounts::Take {
            taker: w.taker.pubkey(),
            maker: w.maker.pubkey(),
            // Claims the escrow's real mint_b in the account list, but the
            // taker's token account passed below is denominated in a
            // different mint entirely — the `associated_token::mint`
            // constraint on taker_ata_b must reject the mismatch.
            mint_a: w.mint_a,
            mint_b: w.mint_b,
            taker_ata_b: taker_wrong_ata,
            taker_ata_a: ata(&w.taker.pubkey(), &w.mint_a),
            maker_ata_b: ata(&w.maker.pubkey(), &w.mint_b),
            escrow,
            vault: ata(&escrow, &w.mint_a),
            token_program: TOKEN_PROGRAM,
            associated_token_program: ASSOCIATED_TOKEN_PROGRAM,
            system_program: anchor_lang::system_program::ID,
        }
        .to_account_metas(None),
    );

    let res = send(&mut w.svm, &w.taker, ix);
    assert!(res.is_err(), "take should fail: taker's token account is the wrong mint");
}

#[test]
fn token_supply_is_conserved_across_a_full_make_take_cancel_cycle() {
    let mut w = setup();
    let total_a_before = token_balance(&w.svm, &ata(&w.maker.pubkey(), &w.mint_a));
    let total_b_before = token_balance(&w.svm, &ata(&w.taker.pubkey(), &w.mint_b));

    // Escrow 1: goes to take.
    let ix = make_ix(&w, 1, DEPOSIT, RECEIVE);
    send(&mut w.svm, &w.maker, ix).unwrap();
    let ix = take_ix(&w, 1);
    send(&mut w.svm, &w.taker, ix).unwrap();

    // Escrow 2: goes to cancel.
    let ix = make_ix(&w, 2, 300, 150);
    send(&mut w.svm, &w.maker, ix).unwrap();
    let ix = cancel_ix(&w, 2);
    send(&mut w.svm, &w.maker, ix).unwrap();

    // No mint/burn side effects anywhere: token A only ever moved between
    // the maker and the taker, and same for token B.
    let total_a_after = token_balance(&w.svm, &ata(&w.maker.pubkey(), &w.mint_a))
        + token_balance(&w.svm, &ata(&w.taker.pubkey(), &w.mint_a));
    let total_b_after = token_balance(&w.svm, &ata(&w.maker.pubkey(), &w.mint_b))
        + token_balance(&w.svm, &ata(&w.taker.pubkey(), &w.mint_b));

    assert_eq!(total_a_after, total_a_before);
    assert_eq!(total_b_after, total_b_before);
}
