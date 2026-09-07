use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};

use crate::constants::*;
use crate::error::MarketplaceError;
use crate::state::Auction;

#[derive(Accounts)]
pub struct PlaceBid<'info> {
    #[account(mut)]
    pub bidder: Signer<'info>,

    #[account(
        mut,
        seeds = [AUCTION_SEED, auction.nft_mint.as_ref()],
        bump = auction.bump,
    )]
    pub auction: Account<'info, Auction>,

    /// CHECK: PDA lamport vault; validated by seeds.
    #[account(
        mut,
        seeds = [AUCTION_VAULT_SEED, auction.nft_mint.as_ref()],
        bump = auction.vault_bump,
    )]
    pub vault: UncheckedAccount<'info>,

    /// CHECK: must equal auction.highest_bidder when one exists; refunded
    /// their outbid amount. Ignored (any account may be passed) when there
    /// is no previous bidder yet.
    #[account(mut)]
    pub previous_bidder: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<PlaceBid>, amount: u64) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    require!(now < ctx.accounts.auction.end_time, MarketplaceError::AuctionEnded);

    let previous_bid = ctx.accounts.auction.highest_bid;
    let minimum_next_bid = if previous_bid == 0 {
        ctx.accounts.auction.reserve_price
    } else {
        previous_bid.checked_add(1).ok_or(MarketplaceError::Overflow)?
    };
    require!(amount >= minimum_next_bid, MarketplaceError::BidTooLow);

    if let Some(previous_bidder) = ctx.accounts.auction.highest_bidder {
        require_keys_eq!(
            ctx.accounts.previous_bidder.key(),
            previous_bidder,
            MarketplaceError::InvalidHighestBidder
        );
    }

    // Take the new bid into the vault.
    transfer(
        CpiContext::new(
            ctx.accounts.system_program.key(),
            Transfer {
                from: ctx.accounts.bidder.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
            },
        ),
        amount,
    )?;

    // Refund the previous highest bidder, if any.
    if previous_bid > 0 {
        let nft_mint_key = ctx.accounts.auction.nft_mint;
        let signer_seeds: &[&[&[u8]]] = &[&[
            AUCTION_VAULT_SEED,
            nft_mint_key.as_ref(),
            &[ctx.accounts.auction.vault_bump],
        ]];

        transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.key(),
                Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.previous_bidder.to_account_info(),
                },
                signer_seeds,
            ),
            previous_bid,
        )?;
    }

    let auction = &mut ctx.accounts.auction;
    auction.highest_bidder = Some(ctx.accounts.bidder.key());
    auction.highest_bid = amount;

    Ok(())
}
