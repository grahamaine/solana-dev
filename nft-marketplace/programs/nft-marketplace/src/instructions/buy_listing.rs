use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_interface::{
    close_account, transfer_checked, CloseAccount, Mint, TokenAccount, TokenInterface,
    TransferChecked,
};

use crate::constants::*;
use crate::error::MarketplaceError;
use crate::state::{Listing, Marketplace};

#[derive(Accounts)]
pub struct BuyListing<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,

    /// CHECK: receives the sale proceeds; verified against listing.seller.
    #[account(mut, address = listing.seller)]
    pub seller: UncheckedAccount<'info>,

    pub nft_mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        close = seller,
        seeds = [LISTING_SEED, nft_mint.key().as_ref()],
        bump = listing.bump,
        has_one = seller,
        has_one = nft_mint,
    )]
    pub listing: Account<'info, Listing>,

    #[account(seeds = [MARKETPLACE_SEED], bump = marketplace.bump)]
    pub marketplace: Account<'info, Marketplace>,

    /// CHECK: PDA fee vault, lamports-only.
    #[account(mut, seeds = [TREASURY_SEED], bump = marketplace.treasury_bump)]
    pub treasury: UncheckedAccount<'info>,

    #[account(
        mut,
        associated_token::mint = nft_mint,
        associated_token::authority = listing,
        associated_token::token_program = token_program,
    )]
    pub escrow_nft_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = buyer,
        associated_token::mint = nft_mint,
        associated_token::authority = buyer,
        associated_token::token_program = token_program,
    )]
    pub buyer_nft_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<BuyListing>) -> Result<()> {
    let price = ctx.accounts.listing.price;
    let fee = (price as u128)
        .checked_mul(ctx.accounts.marketplace.fee_bps as u128)
        .ok_or(MarketplaceError::Overflow)?
        .checked_div(BPS_DENOMINATOR as u128)
        .ok_or(MarketplaceError::Overflow)? as u64;
    let seller_amount = price.checked_sub(fee).ok_or(MarketplaceError::Overflow)?;

    transfer(
        CpiContext::new(
            ctx.accounts.system_program.key(),
            Transfer {
                from: ctx.accounts.buyer.to_account_info(),
                to: ctx.accounts.seller.to_account_info(),
            },
        ),
        seller_amount,
    )?;

    if fee > 0 {
        transfer(
            CpiContext::new(
                ctx.accounts.system_program.key(),
                Transfer {
                    from: ctx.accounts.buyer.to_account_info(),
                    to: ctx.accounts.treasury.to_account_info(),
                },
            ),
            fee,
        )?;
    }

    let nft_mint_key = ctx.accounts.nft_mint.key();
    let signer_seeds: &[&[&[u8]]] =
        &[&[LISTING_SEED, nft_mint_key.as_ref(), &[ctx.accounts.listing.bump]]];

    transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            TransferChecked {
                from: ctx.accounts.escrow_nft_account.to_account_info(),
                mint: ctx.accounts.nft_mint.to_account_info(),
                to: ctx.accounts.buyer_nft_account.to_account_info(),
                authority: ctx.accounts.listing.to_account_info(),
            },
            signer_seeds,
        ),
        1,
        ctx.accounts.nft_mint.decimals,
    )?;

    close_account(CpiContext::new_with_signer(
        ctx.accounts.token_program.key(),
        CloseAccount {
            account: ctx.accounts.escrow_nft_account.to_account_info(),
            destination: ctx.accounts.seller.to_account_info(),
            authority: ctx.accounts.listing.to_account_info(),
        },
        signer_seeds,
    ))?;

    Ok(())
}
