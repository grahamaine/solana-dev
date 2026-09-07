use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_interface::{
    close_account, transfer_checked, CloseAccount, Mint, TokenAccount, TokenInterface,
    TransferChecked,
};

use crate::constants::*;
use crate::error::MarketplaceError;
use crate::state::{Auction, Marketplace};

#[derive(Accounts)]
pub struct SettleAuction<'info> {
    /// Anyone may trigger settlement once the auction has ended.
    #[account(mut)]
    pub caller: Signer<'info>,

    /// CHECK: receives sale proceeds; verified against auction.seller.
    #[account(mut, address = auction.seller)]
    pub seller: UncheckedAccount<'info>,

    /// CHECK: validated against auction.highest_bidder in the handler.
    pub highest_bidder: UncheckedAccount<'info>,

    pub nft_mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        close = seller,
        seeds = [AUCTION_SEED, nft_mint.key().as_ref()],
        bump = auction.bump,
        has_one = seller,
        has_one = nft_mint,
    )]
    pub auction: Account<'info, Auction>,

    /// CHECK: PDA lamport vault holding the winning bid.
    #[account(
        mut,
        seeds = [AUCTION_VAULT_SEED, nft_mint.key().as_ref()],
        bump = auction.vault_bump,
    )]
    pub vault: UncheckedAccount<'info>,

    #[account(seeds = [MARKETPLACE_SEED], bump = marketplace.bump)]
    pub marketplace: Account<'info, Marketplace>,

    /// CHECK: PDA fee vault, lamports-only.
    #[account(mut, seeds = [TREASURY_SEED], bump = marketplace.treasury_bump)]
    pub treasury: UncheckedAccount<'info>,

    #[account(
        mut,
        associated_token::mint = nft_mint,
        associated_token::authority = auction,
        associated_token::token_program = token_program,
    )]
    pub escrow_nft_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = caller,
        associated_token::mint = nft_mint,
        associated_token::authority = highest_bidder,
        associated_token::token_program = token_program,
    )]
    pub winner_nft_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<SettleAuction>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    require!(now >= ctx.accounts.auction.end_time, MarketplaceError::AuctionNotEnded);

    let winner = ctx.accounts.auction.highest_bidder.ok_or(MarketplaceError::NoBids)?;
    require_keys_eq!(
        ctx.accounts.highest_bidder.key(),
        winner,
        MarketplaceError::InvalidHighestBidder
    );

    let winning_bid = ctx.accounts.auction.highest_bid;
    let fee = (winning_bid as u128)
        .checked_mul(ctx.accounts.marketplace.fee_bps as u128)
        .ok_or(MarketplaceError::Overflow)?
        .checked_div(BPS_DENOMINATOR as u128)
        .ok_or(MarketplaceError::Overflow)? as u64;
    let seller_amount = winning_bid.checked_sub(fee).ok_or(MarketplaceError::Overflow)?;

    let nft_mint_key = ctx.accounts.nft_mint.key();
    let vault_signer_seeds: &[&[&[u8]]] = &[&[
        AUCTION_VAULT_SEED,
        nft_mint_key.as_ref(),
        &[ctx.accounts.auction.vault_bump],
    ]];

    transfer(
        CpiContext::new_with_signer(
            ctx.accounts.system_program.key(),
            Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.seller.to_account_info(),
            },
            vault_signer_seeds,
        ),
        seller_amount,
    )?;

    if fee > 0 {
        transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.key(),
                Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.treasury.to_account_info(),
                },
                vault_signer_seeds,
            ),
            fee,
        )?;
    }

    let auction_signer_seeds: &[&[&[u8]]] =
        &[&[AUCTION_SEED, nft_mint_key.as_ref(), &[ctx.accounts.auction.bump]]];

    transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            TransferChecked {
                from: ctx.accounts.escrow_nft_account.to_account_info(),
                mint: ctx.accounts.nft_mint.to_account_info(),
                to: ctx.accounts.winner_nft_account.to_account_info(),
                authority: ctx.accounts.auction.to_account_info(),
            },
            auction_signer_seeds,
        ),
        1,
        ctx.accounts.nft_mint.decimals,
    )?;

    close_account(CpiContext::new_with_signer(
        ctx.accounts.token_program.key(),
        CloseAccount {
            account: ctx.accounts.escrow_nft_account.to_account_info(),
            destination: ctx.accounts.seller.to_account_info(),
            authority: ctx.accounts.auction.to_account_info(),
        },
        auction_signer_seeds,
    ))?;

    Ok(())
}
