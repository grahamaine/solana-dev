use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};

use crate::constants::*;
use crate::error::TipJarError;

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    /// Re-deriving the PDA from the signer's own key is what makes this
    /// safe without a stored authority field: a different signer would
    /// derive a *different* (empty) vault, never someone else's.
    #[account(
        mut,
        seeds = [VAULT_SEED, owner.key().as_ref()],
        bump,
    )]
    pub vault: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
    let vault_info = ctx.accounts.vault.to_account_info();
    let balance = vault_info.lamports();

    require!(amount > 0, TipJarError::InvalidAmount);
    require!(amount <= balance, TipJarError::InsufficientVaultBalance);

    // Allow draining the vault to exactly zero (it then simply vanishes —
    // Solana garbage-collects zero-lamport accounts), but never leave it
    // sitting under the rent-exempt minimum.
    let remaining = balance - amount;
    if remaining > 0 {
        let rent_exempt_minimum = Rent::get()?.minimum_balance(0);
        require!(
            remaining >= rent_exempt_minimum,
            TipJarError::BelowRentExemptMinimum
        );
    }

    // The vault has no private key — the program "signs" for it here by
    // supplying the exact seeds that derived it (invoke_signed).
    let owner_key = ctx.accounts.owner.key();
    let signer_seeds: &[&[&[u8]]] = &[&[VAULT_SEED, owner_key.as_ref(), &[ctx.bumps.vault]]];

    transfer(
        CpiContext::new_with_signer(
            ctx.accounts.system_program.key(),
            Transfer {
                from: vault_info,
                to: ctx.accounts.owner.to_account_info(),
            },
            signer_seeds,
        ),
        amount,
    )?;

    Ok(())
}
