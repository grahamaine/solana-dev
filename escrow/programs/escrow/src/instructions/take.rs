use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_interface::{
    close_account, transfer_checked, CloseAccount, Mint, TokenAccount, TokenInterface,
    TransferChecked,
};

use crate::constants::*;
use crate::state::Escrow;

#[derive(Accounts)]
pub struct Take<'info> {
    #[account(mut)]
    pub taker: Signer<'info>,

    /// CHECK: only receives the rent refund and token B; not read or written.
    #[account(mut)]
    pub maker: UncheckedAccount<'info>,

    // Boxed: this struct has enough accounts that leaving Mint/TokenAccount
    // (sized for Token-2022's extension data) on the stack blows the BPF
    // 4KB-per-function stack limit.
    pub mint_a: Box<InterfaceAccount<'info, Mint>>,
    pub mint_b: Box<InterfaceAccount<'info, Mint>>,

    #[account(mut, associated_token::mint = mint_b, associated_token::authority = taker, associated_token::token_program = token_program)]
    pub taker_ata_b: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        init_if_needed,
        payer = taker,
        associated_token::mint = mint_a,
        associated_token::authority = taker,
        associated_token::token_program = token_program,
    )]
    pub taker_ata_a: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        init_if_needed,
        payer = taker,
        associated_token::mint = mint_b,
        associated_token::authority = maker,
        associated_token::token_program = token_program,
    )]
    pub maker_ata_b: Box<InterfaceAccount<'info, TokenAccount>>,

    /// Closing sends this account's rent lamports to `maker` and settles
    /// the trade in one instruction — the taker can't take without paying.
    #[account(
        mut,
        close = maker,
        has_one = maker,
        has_one = mint_a,
        has_one = mint_b,
        seeds = [ESCROW_SEED, maker.key().as_ref(), escrow.seed.to_le_bytes().as_ref()],
        bump = escrow.bump,
    )]
    pub escrow: Account<'info, Escrow>,

    #[account(mut, associated_token::mint = mint_a, associated_token::authority = escrow, associated_token::token_program = token_program)]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,

    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Take>) -> Result<()> {
    // Taker pays the maker's price first — if this fails, the vault (and
    // the maker's deposit) stays untouched.
    transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.key(),
            TransferChecked {
                from: ctx.accounts.taker_ata_b.to_account_info(),
                mint: ctx.accounts.mint_b.to_account_info(),
                to: ctx.accounts.maker_ata_b.to_account_info(),
                authority: ctx.accounts.taker.to_account_info(),
            },
        ),
        ctx.accounts.escrow.receive,
        ctx.accounts.mint_b.decimals,
    )?;

    // The escrow PDA "signs" for the vault it owns to release the deposit.
    let maker_key = ctx.accounts.escrow.maker;
    let seed = ctx.accounts.escrow.seed;
    let bump = ctx.accounts.escrow.bump;
    let signer_seeds: &[&[&[u8]]] = &[&[
        ESCROW_SEED,
        maker_key.as_ref(),
        &seed.to_le_bytes(),
        &[bump],
    ]];

    transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            TransferChecked {
                from: ctx.accounts.vault.to_account_info(),
                mint: ctx.accounts.mint_a.to_account_info(),
                to: ctx.accounts.taker_ata_a.to_account_info(),
                authority: ctx.accounts.escrow.to_account_info(),
            },
            signer_seeds,
        ),
        ctx.accounts.vault.amount,
        ctx.accounts.mint_a.decimals,
    )?;

    close_account(CpiContext::new_with_signer(
        ctx.accounts.token_program.key(),
        CloseAccount {
            account: ctx.accounts.vault.to_account_info(),
            destination: ctx.accounts.maker.to_account_info(),
            authority: ctx.accounts.escrow.to_account_info(),
        },
        signer_seeds,
    ))?;

    Ok(())
}
