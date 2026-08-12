#![allow(unexpected_cfgs)]

pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("2QaArRLt7zTe3orXxpv1Epx9v5a4Ga9KbCp5655QbCtg");

#[program]
pub mod voting {
    use super::*;

    /// Create a poll in Draft status together with its Token-2022 ballot
    /// mint, whose on-chain TokenMetadata extension stores the poll title.
    pub fn create_poll(
        ctx: Context<CreatePoll>,
        poll_id: u64,
        title: String,
        description: String,
    ) -> Result<()> {
        instructions::create_poll::handler(ctx, poll_id, title, description)
    }

    /// Add a voting option. Only allowed while the poll is in Draft.
    pub fn add_candidate(ctx: Context<AddCandidate>, name: String) -> Result<()> {
        instructions::add_candidate::handler(ctx, name)
    }

    /// Move the poll from Draft to Active and open voting for
    /// `duration_seconds`.
    pub fn activate_poll(ctx: Context<ActivatePoll>, duration_seconds: i64) -> Result<()> {
        instructions::activate_poll::handler(ctx, duration_seconds)
    }

    /// Cast a vote for a candidate. Mints one ballot token to the voter and
    /// records a VoteReceipt PDA so the same wallet cannot vote twice.
    pub fn vote(ctx: Context<CastVote>, candidate_index: u8) -> Result<()> {
        instructions::vote::handler(ctx, candidate_index)
    }

    /// Move the poll from Active to Closed. The creator can close at any
    /// time; anyone else only after `end_time` has passed.
    pub fn close_poll(ctx: Context<ClosePoll>) -> Result<()> {
        instructions::close_poll::handler(ctx)
    }
}
