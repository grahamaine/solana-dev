use anchor_lang::prelude::*;

use crate::constants::*;
use crate::error::MarketplaceError;
use crate::state::Marketplace;

#[derive(Accounts)]
pub struct InitializeMarketplace<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + Marketplace::INIT_SPACE,
        seeds = [MARKETPLACE_SEED],
        bump,
    )]
    pub marketplace: Account<'info, Marketplace>,

    /// Native-SOL fee vault. Holds no data; only ever referenced for its
    /// bump and as a lamport source/destination.
    /// CHECK: PDA derived from TREASURY_SEED, never allocated data.
    #[account(seeds = [TREASURY_SEED], bump)]
    pub treasury: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<InitializeMarketplace>, fee_bps: u16) -> Result<()> {
    require!(fee_bps <= MAX_FEE_BPS, MarketplaceError::FeeTooHigh);

    let marketplace = &mut ctx.accounts.marketplace;
    marketplace.authority = ctx.accounts.authority.key();
    marketplace.fee_bps = fee_bps;
    marketplace.bump = ctx.bumps.marketplace;
    marketplace.treasury_bump = ctx.bumps.treasury;

    Ok(())
}
