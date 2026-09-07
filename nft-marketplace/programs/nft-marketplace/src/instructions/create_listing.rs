use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_interface::{
    transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked,
};

use crate::constants::*;
use crate::error::MarketplaceError;
use crate::state::Listing;

#[derive(Accounts)]
pub struct CreateListing<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,

    pub nft_mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = nft_mint,
        associated_token::authority = seller,
        associated_token::token_program = token_program,
    )]
    pub seller_nft_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init,
        payer = seller,
        space = 8 + Listing::INIT_SPACE,
        seeds = [LISTING_SEED, nft_mint.key().as_ref()],
        bump,
    )]
    pub listing: Account<'info, Listing>,

    /// Escrow token account holding the NFT while it is listed. Authority
    /// is the listing PDA itself, so only this program can move it.
    #[account(
        init,
        payer = seller,
        associated_token::mint = nft_mint,
        associated_token::authority = listing,
        associated_token::token_program = token_program,
    )]
    pub escrow_nft_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<CreateListing>, price: u64) -> Result<()> {
    require!(price > 0, MarketplaceError::InvalidPrice);

    let listing = &mut ctx.accounts.listing;
    listing.seller = ctx.accounts.seller.key();
    listing.nft_mint = ctx.accounts.nft_mint.key();
    listing.price = price;
    listing.bump = ctx.bumps.listing;

    transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.key(),
            TransferChecked {
                from: ctx.accounts.seller_nft_account.to_account_info(),
                mint: ctx.accounts.nft_mint.to_account_info(),
                to: ctx.accounts.escrow_nft_account.to_account_info(),
                authority: ctx.accounts.seller.to_account_info(),
            },
        ),
        1,
        ctx.accounts.nft_mint.decimals,
    )?;

    Ok(())
}
