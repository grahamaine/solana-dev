use anchor_lang::prelude::*;

use crate::constants::*;
use crate::error::VotingError;
use crate::state::{Poll, PollStatus};

#[derive(Accounts)]
pub struct ActivatePoll<'info> {
    pub creator: Signer<'info>,

    #[account(
        mut,
        has_one = creator @ VotingError::Unauthorized,
        seeds = [POLL_SEED, poll.creator.as_ref(), &poll.poll_id.to_le_bytes()],
        bump = poll.bump,
    )]
    pub poll: Account<'info, Poll>,
}

pub fn handler(ctx: Context<ActivatePoll>, duration_seconds: i64) -> Result<()> {
    let poll = &mut ctx.accounts.poll;
    require!(poll.status == PollStatus::Draft, VotingError::PollNotDraft);
    require!(poll.candidate_count >= 2, VotingError::NotEnoughCandidates);
    require!(duration_seconds > 0, VotingError::InvalidDuration);

    let now = Clock::get()?.unix_timestamp;
    poll.status = PollStatus::Active;
    poll.start_time = now;
    poll.end_time = now
        .checked_add(duration_seconds)
        .ok_or(VotingError::InvalidDuration)?;
    Ok(())
}
