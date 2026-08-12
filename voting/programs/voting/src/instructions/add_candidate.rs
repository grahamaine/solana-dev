use anchor_lang::prelude::*;

use crate::constants::*;
use crate::error::VotingError;
use crate::state::{Candidate, Poll, PollStatus};

#[derive(Accounts)]
pub struct AddCandidate<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        mut,
        has_one = creator @ VotingError::Unauthorized,
        seeds = [POLL_SEED, poll.creator.as_ref(), &poll.poll_id.to_le_bytes()],
        bump = poll.bump,
    )]
    pub poll: Account<'info, Poll>,

    /// The next candidate slot: seeded by the poll's current candidate
    /// count, so candidates always get consecutive indexes 0, 1, 2, ...
    #[account(
        init,
        payer = creator,
        space = 8 + Candidate::INIT_SPACE,
        seeds = [CANDIDATE_SEED, poll.key().as_ref(), &[poll.candidate_count]],
        bump,
    )]
    pub candidate: Account<'info, Candidate>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<AddCandidate>, name: String) -> Result<()> {
    let poll = &mut ctx.accounts.poll;
    require!(poll.status == PollStatus::Draft, VotingError::PollNotDraft);
    require!(
        poll.candidate_count < MAX_CANDIDATES,
        VotingError::TooManyCandidates
    );
    require!(
        name.len() <= MAX_CANDIDATE_NAME_LEN,
        VotingError::StringTooLong
    );

    let candidate = &mut ctx.accounts.candidate;
    candidate.poll = poll.key();
    candidate.index = poll.candidate_count;
    candidate.name = name;
    candidate.votes = 0;
    candidate.bump = ctx.bumps.candidate;

    poll.candidate_count += 1;
    Ok(())
}
