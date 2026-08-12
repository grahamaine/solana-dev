//! Integration tests for the voting program, run against LiteSVM.
//!
//! Covers the poll lifecycle (Draft -> Active -> Closed), the Token-2022
//! ballot mint with its TokenMetadata extension, and — importantly — the
//! failure paths: every custom error message is asserted at least once.

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
    solana_clock::Clock,
    solana_keypair::Keypair,
    solana_message::{Message, VersionedMessage},
    solana_signer::Signer,
    solana_transaction::versioned::VersionedTransaction,
    voting::state::{Candidate, Poll, PollStatus, VoteReceipt},
};

type TxResult = Result<TransactionMetadata, FailedTransactionMetadata>;

// ---------------------------------------------------------------- helpers --

fn setup() -> (LiteSVM, Keypair) {
    let mut svm = LiteSVM::new();
    let bytes = include_bytes!("../../../target/deploy/voting.so");
    svm.add_program(voting::id(), bytes).unwrap();
    let creator = Keypair::new();
    svm.airdrop(&creator.pubkey(), 10_000_000_000).unwrap();
    (svm, creator)
}

fn poll_pda(creator: &Pubkey, poll_id: u64) -> Pubkey {
    Pubkey::find_program_address(
        &[b"poll", creator.as_ref(), &poll_id.to_le_bytes()],
        &voting::id(),
    )
    .0
}

fn mint_pda(poll: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(&[b"mint", poll.as_ref()], &voting::id()).0
}

fn candidate_pda(poll: &Pubkey, index: u8) -> Pubkey {
    Pubkey::find_program_address(&[b"candidate", poll.as_ref(), &[index]], &voting::id()).0
}

fn receipt_pda(poll: &Pubkey, voter: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(&[b"vote", poll.as_ref(), voter.as_ref()], &voting::id()).0
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

/// Warp the on-chain clock forward by `seconds`.
fn warp_forward(svm: &mut LiteSVM, seconds: i64) {
    let mut clock: Clock = svm.get_sysvar::<Clock>();
    clock.unix_timestamp += seconds;
    svm.set_sysvar(&clock);
}

fn create_poll_ix(creator: &Pubkey, poll_id: u64, title: &str, description: &str) -> Instruction {
    let poll = poll_pda(creator, poll_id);
    Instruction::new_with_bytes(
        voting::id(),
        &voting::instruction::CreatePoll {
            poll_id,
            title: title.to_string(),
            description: description.to_string(),
        }
        .data(),
        voting::accounts::CreatePoll {
            creator: *creator,
            poll,
            ballot_mint: mint_pda(&poll),
            token_program: anchor_spl::token_2022::ID,
            system_program: anchor_lang::system_program::ID,
        }
        .to_account_metas(None),
    )
}

fn add_candidate_ix(creator: &Pubkey, poll: &Pubkey, index: u8, name: &str) -> Instruction {
    Instruction::new_with_bytes(
        voting::id(),
        &voting::instruction::AddCandidate {
            name: name.to_string(),
        }
        .data(),
        voting::accounts::AddCandidate {
            creator: *creator,
            poll: *poll,
            candidate: candidate_pda(poll, index),
            system_program: anchor_lang::system_program::ID,
        }
        .to_account_metas(None),
    )
}

fn activate_ix(creator: &Pubkey, poll: &Pubkey, duration_seconds: i64) -> Instruction {
    Instruction::new_with_bytes(
        voting::id(),
        &voting::instruction::ActivatePoll { duration_seconds }.data(),
        voting::accounts::ActivatePoll {
            creator: *creator,
            poll: *poll,
        }
        .to_account_metas(None),
    )
}

fn vote_ix(voter: &Pubkey, poll: &Pubkey, candidate_index: u8) -> Instruction {
    let ballot_mint = mint_pda(poll);
    Instruction::new_with_bytes(
        voting::id(),
        &voting::instruction::Vote { candidate_index }.data(),
        voting::accounts::CastVote {
            voter: *voter,
            poll: *poll,
            candidate: candidate_pda(poll, candidate_index),
            receipt: receipt_pda(poll, voter),
            ballot_mint,
            voter_ballot_account: get_associated_token_address_with_program_id(
                voter,
                &ballot_mint,
                &anchor_spl::token_2022::ID,
            ),
            token_program: anchor_spl::token_2022::ID,
            associated_token_program: anchor_spl::associated_token::ID,
            system_program: anchor_lang::system_program::ID,
        }
        .to_account_metas(None),
    )
}

fn close_ix(signer: &Pubkey, poll: &Pubkey) -> Instruction {
    Instruction::new_with_bytes(
        voting::id(),
        &voting::instruction::ClosePoll {}.data(),
        voting::accounts::ClosePoll {
            signer: *signer,
            poll: *poll,
        }
        .to_account_metas(None),
    )
}

/// Create a poll with two candidates; returns the poll PDA.
fn draft_poll(svm: &mut LiteSVM, creator: &Keypair, poll_id: u64) -> Pubkey {
    let poll = poll_pda(&creator.pubkey(), poll_id);
    send(
        svm,
        creator,
        create_poll_ix(&creator.pubkey(), poll_id, "Best Language", "Vote for one"),
    )
    .unwrap();
    send(svm, creator, add_candidate_ix(&creator.pubkey(), &poll, 0, "Rust")).unwrap();
    send(svm, creator, add_candidate_ix(&creator.pubkey(), &poll, 1, "TypeScript")).unwrap();
    poll
}

/// Create a poll with two candidates and activate it for one hour.
fn active_poll(svm: &mut LiteSVM, creator: &Keypair, poll_id: u64) -> Pubkey {
    let poll = draft_poll(svm, creator, poll_id);
    send(svm, creator, activate_ix(&creator.pubkey(), &poll, 3600)).unwrap();
    poll
}

fn new_voter(svm: &mut LiteSVM) -> Keypair {
    let voter = Keypair::new();
    svm.airdrop(&voter.pubkey(), 1_000_000_000).unwrap();
    voter
}

// ----------------------------------------------------------- happy paths --

#[test]
fn create_poll_initializes_draft_state_and_token_metadata() {
    let (mut svm, creator) = setup();
    send(
        &mut svm,
        &creator,
        create_poll_ix(&creator.pubkey(), 1, "Best Language", "Vote for one"),
    )
    .unwrap();

    let poll_address = poll_pda(&creator.pubkey(), 1);
    let poll: Poll = get(&svm, &poll_address);
    assert_eq!(poll.creator, creator.pubkey());
    assert_eq!(poll.poll_id, 1);
    assert_eq!(poll.title, "Best Language");
    assert_eq!(poll.status, PollStatus::Draft);
    assert_eq!(poll.candidate_count, 0);
    assert_eq!(poll.total_votes, 0);

    // The ballot mint is owned by Token-2022 and its TokenMetadata
    // extension stores the poll title on the mint account itself.
    let mint_account = svm.get_account(&mint_pda(&poll_address)).unwrap();
    assert_eq!(mint_account.owner, anchor_spl::token_2022::ID);
    let haystack = mint_account.data;
    let needle = b"Best Language";
    assert!(
        haystack.windows(needle.len()).any(|w| w == needle),
        "poll title not found in mint metadata"
    );
}

#[test]
fn full_lifecycle_draft_active_closed() {
    let (mut svm, creator) = setup();
    let poll_address = active_poll(&mut svm, &creator, 1);

    let poll: Poll = get(&svm, &poll_address);
    assert_eq!(poll.status, PollStatus::Active);
    assert_eq!(poll.candidate_count, 2);
    assert_eq!(poll.end_time, poll.start_time + 3600);

    send(&mut svm, &creator, close_ix(&creator.pubkey(), &poll_address)).unwrap();
    let poll: Poll = get(&svm, &poll_address);
    assert_eq!(poll.status, PollStatus::Closed);
}

#[test]
fn vote_updates_tally_creates_receipt_and_mints_ballot_token() {
    let (mut svm, creator) = setup();
    let poll_address = active_poll(&mut svm, &creator, 1);
    let voter = new_voter(&mut svm);

    send(&mut svm, &voter, vote_ix(&voter.pubkey(), &poll_address, 0)).unwrap();

    let candidate: Candidate = get(&svm, &candidate_pda(&poll_address, 0));
    assert_eq!(candidate.votes, 1);
    assert_eq!(candidate.name, "Rust");

    let poll: Poll = get(&svm, &poll_address);
    assert_eq!(poll.total_votes, 1);

    let receipt: VoteReceipt = get(&svm, &receipt_pda(&poll_address, &voter.pubkey()));
    assert_eq!(receipt.voter, voter.pubkey());
    assert_eq!(receipt.candidate_index, 0);

    // The voter received exactly one ballot token.
    let ata = get_associated_token_address_with_program_id(
        &voter.pubkey(),
        &mint_pda(&poll_address),
        &anchor_spl::token_2022::ID,
    );
    let ballot: TokenAccount = get(&svm, &ata);
    assert_eq!(ballot.amount, 1);
}

#[test]
fn tallies_accumulate_across_many_voters() {
    let (mut svm, creator) = setup();
    let poll_address = active_poll(&mut svm, &creator, 1);

    // Verify vote counting in a loop: 3 votes for Rust, 2 for TypeScript.
    for i in 0..5u8 {
        let voter = new_voter(&mut svm);
        let choice = if i < 3 { 0 } else { 1 };
        send(&mut svm, &voter, vote_ix(&voter.pubkey(), &poll_address, choice)).unwrap();
    }

    let rust: Candidate = get(&svm, &candidate_pda(&poll_address, 0));
    let ts: Candidate = get(&svm, &candidate_pda(&poll_address, 1));
    let poll: Poll = get(&svm, &poll_address);
    assert_eq!(rust.votes, 3);
    assert_eq!(ts.votes, 2);
    assert_eq!(poll.total_votes, 5);
}

#[test]
fn anyone_can_close_after_the_deadline() {
    let (mut svm, creator) = setup();
    let poll_address = active_poll(&mut svm, &creator, 1);
    let stranger = new_voter(&mut svm);

    warp_forward(&mut svm, 3601);
    send(&mut svm, &stranger, close_ix(&stranger.pubkey(), &poll_address)).unwrap();
    let poll: Poll = get(&svm, &poll_address);
    assert_eq!(poll.status, PollStatus::Closed);
}

// -------------------------------------------------------- failure tests --

#[test]
fn create_poll_rejects_too_long_title() {
    let (mut svm, creator) = setup();
    let long_title = "x".repeat(65); // MAX_TITLE_LEN is 64
    let res = send(
        &mut svm,
        &creator,
        create_poll_ix(&creator.pubkey(), 1, &long_title, "desc"),
    );
    assert_fails_with(res, "StringTooLong");
}

#[test]
fn only_the_creator_can_add_candidates() {
    let (mut svm, creator) = setup();
    send(
        &mut svm,
        &creator,
        create_poll_ix(&creator.pubkey(), 1, "Poll", "desc"),
    )
    .unwrap();
    let poll = poll_pda(&creator.pubkey(), 1);

    let mallory = new_voter(&mut svm);
    let res = send(
        &mut svm,
        &mallory,
        add_candidate_ix(&mallory.pubkey(), &poll, 0, "Evil Option"),
    );
    assert_fails_with(res, "Unauthorized");
}

#[test]
fn candidates_cannot_be_added_once_active() {
    let (mut svm, creator) = setup();
    let poll = active_poll(&mut svm, &creator, 1);
    let res = send(
        &mut svm,
        &creator,
        add_candidate_ix(&creator.pubkey(), &poll, 2, "Latecomer"),
    );
    assert_fails_with(res, "PollNotDraft");
}

#[test]
fn candidate_cap_is_enforced() {
    let (mut svm, creator) = setup();
    send(
        &mut svm,
        &creator,
        create_poll_ix(&creator.pubkey(), 1, "Crowded Poll", "desc"),
    )
    .unwrap();
    let poll = poll_pda(&creator.pubkey(), 1);

    // Fill every slot up to MAX_CANDIDATES (10) in a loop...
    for i in 0..10u8 {
        send(
            &mut svm,
            &creator,
            add_candidate_ix(&creator.pubkey(), &poll, i, &format!("Candidate {i}")),
        )
        .unwrap();
    }
    // ...then the 11th must fail.
    let res = send(
        &mut svm,
        &creator,
        add_candidate_ix(&creator.pubkey(), &poll, 10, "One Too Many"),
    );
    assert_fails_with(res, "TooManyCandidates");
}

#[test]
fn activation_requires_two_candidates() {
    let (mut svm, creator) = setup();
    send(
        &mut svm,
        &creator,
        create_poll_ix(&creator.pubkey(), 1, "Lonely Poll", "desc"),
    )
    .unwrap();
    let poll = poll_pda(&creator.pubkey(), 1);
    send(
        &mut svm,
        &creator,
        add_candidate_ix(&creator.pubkey(), &poll, 0, "Only Option"),
    )
    .unwrap();

    let res = send(&mut svm, &creator, activate_ix(&creator.pubkey(), &poll, 3600));
    assert_fails_with(res, "NotEnoughCandidates");
}

#[test]
fn activation_rejects_non_positive_duration() {
    let (mut svm, creator) = setup();
    let poll = draft_poll(&mut svm, &creator, 1);
    let res = send(&mut svm, &creator, activate_ix(&creator.pubkey(), &poll, 0));
    assert_fails_with(res, "InvalidDuration");
}

#[test]
fn only_the_creator_can_activate() {
    let (mut svm, creator) = setup();
    let poll = draft_poll(&mut svm, &creator, 1);
    let mallory = new_voter(&mut svm);
    let res = send(&mut svm, &mallory, activate_ix(&mallory.pubkey(), &poll, 3600));
    assert_fails_with(res, "Unauthorized");
}

#[test]
fn voting_on_a_draft_poll_fails() {
    let (mut svm, creator) = setup();
    let poll = draft_poll(&mut svm, &creator, 1);
    let voter = new_voter(&mut svm);
    let res = send(&mut svm, &voter, vote_ix(&voter.pubkey(), &poll, 0));
    assert_fails_with(res, "PollNotActive");
}

#[test]
fn the_same_wallet_cannot_vote_twice() {
    let (mut svm, creator) = setup();
    let poll = active_poll(&mut svm, &creator, 1);
    let voter = new_voter(&mut svm);

    send(&mut svm, &voter, vote_ix(&voter.pubkey(), &poll, 0)).unwrap();
    // Second vote (even for a different candidate) fails because the
    // VoteReceipt PDA already exists.
    let res = send(&mut svm, &voter, vote_ix(&voter.pubkey(), &poll, 1));
    assert!(res.is_err(), "double vote should fail");
}

#[test]
fn voting_after_the_deadline_fails() {
    let (mut svm, creator) = setup();
    let poll = active_poll(&mut svm, &creator, 1);
    let voter = new_voter(&mut svm);

    warp_forward(&mut svm, 3601);
    let res = send(&mut svm, &voter, vote_ix(&voter.pubkey(), &poll, 0));
    assert_fails_with(res, "PollEnded");
}

#[test]
fn voting_on_a_closed_poll_fails() {
    let (mut svm, creator) = setup();
    let poll = active_poll(&mut svm, &creator, 1);
    send(&mut svm, &creator, close_ix(&creator.pubkey(), &poll)).unwrap();

    let voter = new_voter(&mut svm);
    let res = send(&mut svm, &voter, vote_ix(&voter.pubkey(), &poll, 0));
    assert_fails_with(res, "PollNotActive");
}

#[test]
fn strangers_cannot_close_before_the_deadline() {
    let (mut svm, creator) = setup();
    let poll = active_poll(&mut svm, &creator, 1);
    let stranger = new_voter(&mut svm);
    let res = send(&mut svm, &stranger, close_ix(&stranger.pubkey(), &poll));
    assert_fails_with(res, "PollNotEnded");
}

#[test]
fn a_draft_poll_cannot_be_closed() {
    let (mut svm, creator) = setup();
    let poll = draft_poll(&mut svm, &creator, 1);
    let res = send(&mut svm, &creator, close_ix(&creator.pubkey(), &poll));
    assert_fails_with(res, "PollNotActive");
}
