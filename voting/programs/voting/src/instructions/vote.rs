use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_2022::Token2022;
use anchor_spl::token_interface::{mint_to, Mint, MintTo, TokenAccount};

use crate::constants::*;
use crate::error::VotingError;
use crate::state::{Candidate, Poll, PollStatus, VoteReceipt};

#[derive(Accounts)]
#[instruction(candidate_index: u8)]
pub struct CastVote<'info> {
    #[account(mut)]
    pub voter: Signer<'info>,

    #[account(
        mut,
        seeds = [POLL_SEED, poll.creator.as_ref(), &poll.poll_id.to_le_bytes()],
        bump = poll.bump,
    )]
    pub poll: Account<'info, Poll>,

    #[account(
        mut,
        seeds = [CANDIDATE_SEED, poll.key().as_ref(), &[candidate_index]],
        bump = candidate.bump,
        has_one = poll @ VotingError::InvalidCandidate,
    )]
    pub candidate: Account<'info, Candidate>,

    /// Created fresh for every (poll, voter) pair — a second vote from the
    /// same wallet fails because this PDA already exists.
    #[account(
        init,
        payer = voter,
        space = 8 + VoteReceipt::INIT_SPACE,
        seeds = [VOTE_SEED, poll.key().as_ref(), voter.key().as_ref()],
        bump,
    )]
    pub receipt: Account<'info, VoteReceipt>,

    #[account(
        mut,
        seeds = [MINT_SEED, poll.key().as_ref()],
        bump = poll.mint_bump,
        mint::token_program = token_program,
    )]
    pub ballot_mint: InterfaceAccount<'info, Mint>,

    /// The voter's Token-2022 associated token account; receives one ballot
    /// token as an on-chain proof of participation.
    #[account(
        init,
        payer = voter,
        associated_token::mint = ballot_mint,
        associated_token::authority = voter,
        associated_token::token_program = token_program,
    )]
    pub voter_ballot_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Program<'info, Token2022>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<CastVote>, candidate_index: u8) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;

    let poll = &mut ctx.accounts.poll;
    require!(poll.status == PollStatus::Active, VotingError::PollNotActive);
    require!(now < poll.end_time, VotingError::PollEnded);

    let candidate = &mut ctx.accounts.candidate;
    candidate.votes = candidate.votes.checked_add(1).unwrap();
    poll.total_votes = poll.total_votes.checked_add(1).unwrap();

    let receipt = &mut ctx.accounts.receipt;
    receipt.poll = poll.key();
    receipt.voter = ctx.accounts.voter.key();
    receipt.candidate_index = candidate_index;
    receipt.timestamp = now;
    receipt.bump = ctx.bumps.receipt;

    // Mint one ballot token to the voter, signed by the poll PDA (the mint
    // authority).
    let creator_key = poll.creator;
    let poll_id_bytes = poll.poll_id.to_le_bytes();
    let bump = poll.bump;
    let signer_seeds: &[&[&[u8]]] = &[&[
        POLL_SEED,
        creator_key.as_ref(),
        &poll_id_bytes,
        &[bump],
    ]];

    mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            MintTo {
                mint: ctx.accounts.ballot_mint.to_account_info(),
                to: ctx.accounts.voter_ballot_account.to_account_info(),
                authority: ctx.accounts.poll.to_account_info(),
            },
            signer_seeds,
        ),
        1,
    )?;

    Ok(())
}
