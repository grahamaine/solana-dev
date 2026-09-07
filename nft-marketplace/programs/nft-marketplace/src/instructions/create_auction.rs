use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_interface::{
    transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked,
};

use crate::constants::*;
use crate::error::MarketplaceError;
use crate::state::Auction;

#[derive(Accounts)]
pub struct CreateAuction<'info> {
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
        space = 8 + Auction::INIT_SPACE,
        seeds = [AUCTION_SEED, nft_mint.key().as_ref()],
        bump,
    )]
    pub auction: Account<'info, Auction>,

    /// CHECK: PDA lamport vault for bids; allocated lazily on first bid.
    #[account(seeds = [AUCTION_VAULT_SEED, nft_mint.key().as_ref()], bump)]
    pub vault: UncheckedAccount<'info>,

    #[account(
        init,
        payer = seller,
        associated_token::mint = nft_mint,
        associated_token::authority = auction,
        associated_token::token_program = token_program,
    )]
    pub escrow_nft_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<CreateAuction>, reserve_price: u64, end_time: i64) -> Result<()> {
    require!(reserve_price > 0, MarketplaceError::InvalidPrice);
    require!(
        end_time > Clock::get()?.unix_timestamp,
        MarketplaceError::InvalidEndTime
    );

    let auction = &mut ctx.accounts.auction;
    auction.seller = ctx.accounts.seller.key();
    auction.nft_mint = ctx.accounts.nft_mint.key();
    auction.reserve_price = reserve_price;
    auction.end_time = end_time;
    auction.highest_bidder = None;
    auction.highest_bid = 0;
    auction.bump = ctx.bumps.auction;
    auction.vault_bump = ctx.bumps.vault;

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
