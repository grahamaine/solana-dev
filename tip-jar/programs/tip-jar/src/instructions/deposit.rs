use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};

use crate::constants::*;
use crate::error::TipJarError;

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    /// A bare, data-less PDA that only ever holds lamports. It comes into
    /// existence on the first deposit — the System Program will credit
    /// any address, initialized or not.
    #[account(
        mut,
        seeds = [VAULT_SEED, owner.key().as_ref()],
        bump,
    )]
    pub vault: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Deposit>, amount: u64) -> Result<()> {
    require!(amount > 0, TipJarError::InvalidAmount);

    // The owner signs the transaction directly, so a plain `invoke`
    // (CpiContext::new, no signer seeds) is enough to move funds in.
    transfer(
        CpiContext::new(
            ctx.accounts.system_program.key(),
            Transfer {
                from: ctx.accounts.owner.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
            },
        ),
        amount,
    )?;

    Ok(())
}
