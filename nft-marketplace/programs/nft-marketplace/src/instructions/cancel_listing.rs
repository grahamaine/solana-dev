use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_interface::{
    close_account, transfer_checked, CloseAccount, Mint, TokenAccount, TokenInterface,
    TransferChecked,
};

use crate::constants::*;
use crate::state::Listing;

#[derive(Accounts)]
pub struct CancelListing<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,

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

    #[account(
        mut,
        associated_token::mint = nft_mint,
        associated_token::authority = listing,
        associated_token::token_program = token_program,
    )]
    pub escrow_nft_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = seller,
        associated_token::mint = nft_mint,
        associated_token::authority = seller,
        associated_token::token_program = token_program,
    )]
    pub seller_nft_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<CancelListing>) -> Result<()> {
    let nft_mint_key = ctx.accounts.nft_mint.key();
    let signer_seeds: &[&[&[u8]]] =
        &[&[LISTING_SEED, nft_mint_key.as_ref(), &[ctx.accounts.listing.bump]]];

    transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            TransferChecked {
                from: ctx.accounts.escrow_nft_account.to_account_info(),
                mint: ctx.accounts.nft_mint.to_account_info(),
                to: ctx.accounts.seller_nft_account.to_account_info(),
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
