#![allow(unexpected_cfgs)]

pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("DSFpAaa8oEwH5byS9228B4VLqpervzGpkWBWeXEwyCGh");

/// Week 5 — Escrow exercise: a trustless SPL token exchange.
///
/// A maker deposits token A into a vault owned by the escrow PDA and names
/// the amount of token B they want back. Any taker can fill it atomically
/// (`take`), or the maker can reclaim their deposit (`cancel`). Neither
/// side ever has to trust the other, or a third party — the program's
/// account constraints are the escrow.
#[program]
pub mod escrow {
    use super::*;

    /// Deposit `deposit` of `mint_a` into a program-owned vault and record
    /// the `receive` amount of `mint_b` the maker wants for it.
    pub fn make(ctx: Context<Make>, seed: u64, deposit: u64, receive: u64) -> Result<()> {
        instructions::make::handler(ctx, seed, deposit, receive)
    }

    /// Fill the offer: pay the maker in `mint_b`, then release the vault's
    /// `mint_a` to the taker and close both the vault and the escrow.
    pub fn take(ctx: Context<Take>) -> Result<()> {
        instructions::take::handler(ctx)
    }

    /// Maker reclaims their deposit; closes the vault and the escrow.
    pub fn cancel(ctx: Context<Cancel>) -> Result<()> {
        instructions::cancel::handler(ctx)
    }
}
