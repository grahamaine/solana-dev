use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};
use anchor_spl::token_2022::Token2022;
use anchor_spl::token_interface::{token_metadata_initialize, Mint, TokenMetadataInitialize};

use crate::constants::*;
use crate::error::VotingError;
use crate::state::{Poll, PollStatus};

#[derive(Accounts)]
#[instruction(poll_id: u64)]
pub struct CreatePoll<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        init,
        payer = creator,
        space = 8 + Poll::INIT_SPACE,
        seeds = [POLL_SEED, creator.key().as_ref(), &poll_id.to_le_bytes()],
        bump,
    )]
    pub poll: Account<'info, Poll>,

    /// Token-2022 ballot mint. The MetadataPointer extension points at the
    /// mint account itself, so the poll title is stored on the mint.
    #[account(
        init,
        payer = creator,
        seeds = [MINT_SEED, poll.key().as_ref()],
        bump,
        mint::decimals = 0,
        mint::authority = poll,
        mint::token_program = token_program,
        extensions::metadata_pointer::authority = poll,
        extensions::metadata_pointer::metadata_address = ballot_mint,
    )]
    pub ballot_mint: InterfaceAccount<'info, Mint>,

    pub token_program: Program<'info, Token2022>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<CreatePoll>,
    poll_id: u64,
    title: String,
    description: String,
) -> Result<()> {
    require!(title.len() <= MAX_TITLE_LEN, VotingError::StringTooLong);
    require!(
        description.len() <= MAX_DESCRIPTION_LEN,
        VotingError::StringTooLong
    );

    let poll = &mut ctx.accounts.poll;
    poll.creator = ctx.accounts.creator.key();
    poll.poll_id = poll_id;
    poll.title = title.clone();
    poll.description = description;
    poll.status = PollStatus::Draft;
    poll.candidate_count = 0;
    poll.total_votes = 0;
    poll.start_time = 0;
    poll.end_time = 0;
    poll.bump = ctx.bumps.poll;
    poll.mint_bump = ctx.bumps.ballot_mint;

    // The poll PDA is the mint and metadata authority, so it signs the CPI.
    let creator_key = ctx.accounts.creator.key();
    let poll_id_bytes = poll_id.to_le_bytes();
    let signer_seeds: &[&[&[u8]]] = &[&[
        POLL_SEED,
        creator_key.as_ref(),
        &poll_id_bytes,
        &[ctx.bumps.poll],
    ]];

    token_metadata_initialize(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            TokenMetadataInitialize {
                program_id: ctx.accounts.token_program.to_account_info(),
                mint: ctx.accounts.ballot_mint.to_account_info(),
                metadata: ctx.accounts.ballot_mint.to_account_info(),
                mint_authority: ctx.accounts.poll.to_account_info(),
                update_authority: ctx.accounts.poll.to_account_info(),
            },
            signer_seeds,
        ),
        title,
        TOKEN_SYMBOL.to_string(),
        TOKEN_URI.to_string(),
    )?;

    // Writing the metadata grew the mint account, so top its lamports back
    // up to the rent-exempt minimum for the new size.
    let mint_info = ctx.accounts.ballot_mint.to_account_info();
    let required = Rent::get()?.minimum_balance(mint_info.data_len());
    let current = mint_info.lamports();
    if required > current {
        transfer(
            CpiContext::new(
                ctx.accounts.system_program.key(),
                Transfer {
                    from: ctx.accounts.creator.to_account_info(),
                    to: mint_info,
                },
            ),
            required - current,
        )?;
    }

    Ok(())
}
