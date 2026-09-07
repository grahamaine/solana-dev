use anchor_lang::prelude::*;

use crate::constants::*;
use crate::error::VotingError;
use crate::state::{Poll, PollStatus};

#[derive(Accounts)]
pub struct ClosePoll<'info> {
    pub creator: Signer<'info>,

    #[account(
        mut,
        has_one = creator @ VotingError::Unauthorized,
        seeds = [POLL_SEED, poll.creator.as_ref(), &poll.poll_id.to_le_bytes()],
        bump = poll.bump,
    )]
    pub poll: Account<'info, Poll>,
}

pub fn handler(ctx: Context<ClosePoll>) -> Result<()> {
    let poll = &mut ctx.accounts.poll;
    require!(poll.status == PollStatus::Active, VotingError::PollNotActive);
    poll.status = PollStatus::Closed;
    Ok(())
}
