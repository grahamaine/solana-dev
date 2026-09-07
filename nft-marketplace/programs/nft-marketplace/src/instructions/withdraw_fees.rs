use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};

use crate::constants::*;
use crate::error::MarketplaceError;
use crate::state::Marketplace;

#[derive(Accounts)]
pub struct WithdrawFees<'info> {
    #[account(mut, address = marketplace.authority @ MarketplaceError::Unauthorized)]
    pub authority: Signer<'info>,

    #[account(seeds = [MARKETPLACE_SEED], bump = marketplace.bump)]
    pub marketplace: Account<'info, Marketplace>,

    /// CHECK: PDA fee vault, lamports-only.
    #[account(mut, seeds = [TREASURY_SEED], bump = marketplace.treasury_bump)]
    pub treasury: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<WithdrawFees>, amount: u64) -> Result<()> {
    require!(
        ctx.accounts.treasury.lamports() >= amount,
        MarketplaceError::InsufficientTreasuryFunds
    );

    let signer_seeds: &[&[&[u8]]] = &[&[TREASURY_SEED, &[ctx.accounts.marketplace.treasury_bump]]];

    transfer(
        CpiContext::new_with_signer(
            ctx.accounts.system_program.key(),
            Transfer {
                from: ctx.accounts.treasury.to_account_info(),
                to: ctx.accounts.authority.to_account_info(),
            },
            signer_seeds,
        ),
        amount,
    )?;

    Ok(())
}
