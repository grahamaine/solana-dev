use anchor_lang::prelude::*;

use crate::constants::*;
use crate::error::VotingError;
use crate::state::{Poll, PollStatus};

#[derive(Accounts)]
pub struct ClosePoll<'info> {
    pub signer: Signer<'info>,

    #[account(
        mut,
        seeds = [POLL_SEED, poll.creator.as_ref(), &poll.poll_id.to_le_bytes()],
        bump = poll.bump,
    )]
    pub poll: Account<'info, Poll>,
}

pub fn handler(ctx: Context<ClosePoll>) -> Result<()> {
    let poll = &mut ctx.accounts.poll;
    require!(poll.status == PollStatus::Active, VotingError::PollNotActive);

    // The creator may close early; anyone else only after the voting period.
    if ctx.accounts.signer.key() != poll.creator {
        let now = Clock::get()?.unix_timestamp;
        require!(now >= poll.end_time, VotingError::PollNotEnded);
    }

    poll.status = PollStatus::Closed;
    Ok(())
}
