use anchor_lang::prelude::*;

use crate::constants::*;
use crate::error::MarketplaceError;
use crate::state::Listing;

#[derive(Accounts)]
pub struct UpdateListingPrice<'info> {
    pub seller: Signer<'info>,

    #[account(
        mut,
        seeds = [LISTING_SEED, listing.nft_mint.as_ref()],
        bump = listing.bump,
        has_one = seller @ MarketplaceError::Unauthorized,
    )]
    pub listing: Account<'info, Listing>,
}

pub fn handler(ctx: Context<UpdateListingPrice>, new_price: u64) -> Result<()> {
    require!(new_price > 0, MarketplaceError::InvalidPrice);
    ctx.accounts.listing.price = new_price;
    Ok(())
}
