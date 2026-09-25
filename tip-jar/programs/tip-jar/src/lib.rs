#![allow(unexpected_cfgs)]

pub mod constants;
pub mod error;
pub mod instructions;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;

declare_id!("2jUpd4u5nk14oiLmBpVskm9SES38W4khomHxeQp2HSuU");

/// Week 4 — Tip Jar exercise: CPI composability.
///
/// A per-wallet vault PDA that holds nothing but lamports — no Anchor
/// account data, just a System-Program-owned address. `deposit` moves SOL
/// in with a plain `invoke` (the owner signs for themself, the same way
/// any wallet-to-wallet transfer works). `withdraw` moves SOL out with
/// `invoke_signed`: the vault has no private key, so the *program* signs
/// on its behalf by supplying the exact seeds that derived it.
#[program]
pub mod tip_jar {
    use super::*;

    /// Deposit `amount` lamports into the caller's own vault PDA.
    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        instructions::deposit::handler(ctx, amount)
    }

    /// Withdraw `amount` lamports from the caller's own vault PDA. Partial
    /// withdrawals must leave the vault at or above the rent-exempt
    /// minimum; draining it fully to zero is also allowed.
    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        instructions::withdraw::handler(ctx, amount)
    }
}
