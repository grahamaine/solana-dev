use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_2022::Token2022;
use anchor_spl::token_interface::{mint_to, Mint, MintTo, TokenAccount};

use crate::constants::*;
use crate::error::TokenSystemError;
use crate::state::TokenManager;

#[derive(Accounts)]
pub struct MintTokens<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    /// CHECK: any wallet may receive tokens; only used to derive the ATA.
    pub recipient: UncheckedAccount<'info>,

    #[account(
        mut,
        has_one = authority @ TokenSystemError::Unauthorized,
        has_one = mint,
        seeds = [MANAGER_SEED, manager.authority.as_ref()],
        bump = manager.bump,
    )]
    pub manager: Account<'info, TokenManager>,

    #[account(mut, mint::token_program = token_program)]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        init_if_needed,
        payer = authority,
        associated_token::mint = mint,
        associated_token::authority = recipient,
        associated_token::token_program = token_program,
    )]
    pub recipient_token_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Program<'info, Token2022>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<MintTokens>, amount: u64) -> Result<()> {
    require!(amount > 0, TokenSystemError::InvalidAmount);

    let manager = &mut ctx.accounts.manager;
    let new_total = manager
        .total_minted
        .checked_add(amount)
        .ok_or(TokenSystemError::SupplyCapExceeded)?;
    require!(
        new_total <= manager.mint_cap,
        TokenSystemError::SupplyCapExceeded
    );
    manager.total_minted = new_total;

    // The manager PDA is the mint authority, so it signs the CPI.
    let authority_key = manager.authority;
    let bump = manager.bump;
    let signer_seeds: &[&[&[u8]]] = &[&[MANAGER_SEED, authority_key.as_ref(), &[bump]]];

    mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            MintTo {
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.recipient_token_account.to_account_info(),
                authority: ctx.accounts.manager.to_account_info(),
            },
            signer_seeds,
        ),
        amount,
    )?;

    Ok(())
}
