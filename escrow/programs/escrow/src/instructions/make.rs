use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_interface::{
    transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked,
};

use crate::constants::*;
use crate::error::EscrowError;
use crate::state::Escrow;

#[derive(Accounts)]
#[instruction(seed: u64)]
pub struct Make<'info> {
    #[account(mut)]
    pub maker: Signer<'info>,

    pub mint_a: InterfaceAccount<'info, Mint>,
    pub mint_b: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = mint_a,
        associated_token::authority = maker,
        associated_token::token_program = token_program,
    )]
    pub maker_ata_a: InterfaceAccount<'info, TokenAccount>,

    /// One escrow per (maker, seed) pair — the seed lets a maker run
    /// several offers at once.
    #[account(
        init,
        payer = maker,
        space = 8 + Escrow::INIT_SPACE,
        seeds = [ESCROW_SEED, maker.key().as_ref(), seed.to_le_bytes().as_ref()],
        bump,
    )]
    pub escrow: Account<'info, Escrow>,

    /// Vault holding the deposited token A, owned by the escrow PDA — that
    /// is what makes the swap trustless: neither party can move the funds
    /// except through `take` or `cancel`.
    #[account(
        init,
        payer = maker,
        associated_token::mint = mint_a,
        associated_token::authority = escrow,
        associated_token::token_program = token_program,
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Make>, seed: u64, deposit: u64, receive: u64) -> Result<()> {
    require!(deposit > 0 && receive > 0, EscrowError::InvalidAmount);

    let escrow = &mut ctx.accounts.escrow;
    escrow.seed = seed;
    escrow.maker = ctx.accounts.maker.key();
    escrow.mint_a = ctx.accounts.mint_a.key();
    escrow.mint_b = ctx.accounts.mint_b.key();
    escrow.receive = receive;
    escrow.bump = ctx.bumps.escrow;

    transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.key(),
            TransferChecked {
                from: ctx.accounts.maker_ata_a.to_account_info(),
                mint: ctx.accounts.mint_a.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.maker.to_account_info(),
            },
        ),
        deposit,
        ctx.accounts.mint_a.decimals,
    )?;

    Ok(())
}
