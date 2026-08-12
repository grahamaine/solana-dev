use anchor_lang::prelude::*;
use anchor_spl::token_2022::Token2022;
use anchor_spl::token_interface::{burn, Burn, Mint, TokenAccount};

use crate::constants::*;
use crate::error::TokenSystemError;
use crate::state::TokenManager;

#[derive(Accounts)]
pub struct BurnTokens<'info> {
    pub holder: Signer<'info>,

    #[account(
        mut,
        has_one = mint,
        seeds = [MANAGER_SEED, manager.authority.as_ref()],
        bump = manager.bump,
    )]
    pub manager: Account<'info, TokenManager>,

    #[account(mut, mint::token_program = token_program)]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = holder,
        associated_token::token_program = token_program,
    )]
    pub holder_token_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Program<'info, Token2022>,
}

pub fn handler(ctx: Context<BurnTokens>, amount: u64) -> Result<()> {
    require!(amount > 0, TokenSystemError::InvalidAmount);

    // Holders burn their own tokens, so the holder signs — no PDA needed.
    burn(
        CpiContext::new(
            ctx.accounts.token_program.key(),
            Burn {
                mint: ctx.accounts.mint.to_account_info(),
                from: ctx.accounts.holder_token_account.to_account_info(),
                authority: ctx.accounts.holder.to_account_info(),
            },
        ),
        amount,
    )?;

    let manager = &mut ctx.accounts.manager;
    manager.total_burned = manager.total_burned.checked_add(amount).unwrap();

    Ok(())
}
