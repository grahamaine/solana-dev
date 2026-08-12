use anchor_lang::prelude::*;

use crate::constants::*;

/// Lifecycle of a poll: Draft -> Active -> Closed.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum PollStatus {
    /// Being set up: candidates can still be added, no voting yet.
    Draft,
    /// Voting is open until `end_time`.
    Active,
    /// Voting is finished; tallies are final.
    Closed,
}

/// One poll. PDA: ["poll", creator, poll_id].
#[account]
#[derive(InitSpace)]
pub struct Poll {
    pub creator: Pubkey,
    pub poll_id: u64,
    #[max_len(MAX_TITLE_LEN)]
    pub title: String,
    #[max_len(MAX_DESCRIPTION_LEN)]
    pub description: String,
    pub status: PollStatus,
    pub candidate_count: u8,
    pub total_votes: u64,
    /// Unix timestamp when the poll was activated (0 while Draft).
    pub start_time: i64,
    /// Unix timestamp after which voting is no longer allowed (0 while Draft).
    pub end_time: i64,
    pub bump: u8,
    pub mint_bump: u8,
}

/// One voting option. PDA: ["candidate", poll, index].
#[account]
#[derive(InitSpace)]
pub struct Candidate {
    pub poll: Pubkey,
    pub index: u8,
    #[max_len(MAX_CANDIDATE_NAME_LEN)]
    pub name: String,
    pub votes: u64,
    pub bump: u8,
}

/// Proof that a wallet voted on a poll; its existence prevents double voting.
/// PDA: ["vote", poll, voter].
#[account]
#[derive(InitSpace)]
pub struct VoteReceipt {
    pub poll: Pubkey,
    pub voter: Pubkey,
    pub candidate_index: u8,
    pub timestamp: i64,
    pub bump: u8,
}
