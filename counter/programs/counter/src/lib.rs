//! Week 2 — Counter exercise.
//!
//! The smallest useful example of how Solana stores data: a counter whose
//! value lives in a Program Derived Address (PDA). Each wallet gets its own
//! counter at a deterministic address: ["counter", wallet_pubkey].

#![allow(unexpected_cfgs)]

use anchor_lang::prelude::*;

declare_id!("68pjM74E2ow8dRxKPCh1cjcaHYEpAtjJRPJmxstQNCVp");

#[constant]
pub const COUNTER_SEED: &[u8] = b"counter";

#[program]
pub mod counter {
    use super::*;

    /// Create the counter PDA for the signing wallet, starting at 0.
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let counter = &mut ctx.accounts.counter;
        counter.authority = ctx.accounts.authority.key();
        counter.count = 0;
        counter.bump = ctx.bumps.counter;
        Ok(())
    }

    /// Add one to the stored count.
    pub fn increment(ctx: Context<Update>) -> Result<()> {
        let counter = &mut ctx.accounts.counter;
        counter.count = counter.count.checked_add(1).unwrap();
        Ok(())
    }

    /// Subtract one from the stored count; fails at zero instead of
    /// wrapping around.
    pub fn decrement(ctx: Context<Update>) -> Result<()> {
        let counter = &mut ctx.accounts.counter;
        counter.count = counter
            .count
            .checked_sub(1)
            .ok_or(CounterError::Underflow)?;
        Ok(())
    }

    /// Set the count back to 0.
    pub fn reset(ctx: Context<Update>) -> Result<()> {
        ctx.accounts.counter.count = 0;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    /// The counter data account. `init` allocates it via the System
    /// Program, funds it rent-exempt, and assigns ownership to this
    /// program — that is how Solana "saves" data.
    #[account(
        init,
        payer = authority,
        space = 8 + Counter::INIT_SPACE,
        seeds = [COUNTER_SEED, authority.key().as_ref()],
        bump,
    )]
    pub counter: Account<'info, Counter>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Update<'info> {
    pub authority: Signer<'info>,

    /// Re-deriving the PDA from the stored authority proves this is the
    /// signer's own counter; has_one rejects anyone else's signature.
    #[account(
        mut,
        has_one = authority @ CounterError::Unauthorized,
        seeds = [COUNTER_SEED, counter.authority.as_ref()],
        bump = counter.bump,
    )]
    pub counter: Account<'info, Counter>,
}

/// Layout on-chain: 8-byte discriminator + 32 (authority) + 8 (count)
/// + 1 (bump) = 49 bytes.
#[account]
#[derive(InitSpace)]
pub struct Counter {
    /// The wallet this counter belongs to (also part of the PDA seeds).
    pub authority: Pubkey,
    pub count: u64,
    /// Cached bump so instructions don't have to search for it again.
    pub bump: u8,
}

#[error_code]
pub enum CounterError {
    #[msg("Counter cannot go below zero")]
    Underflow,
    #[msg("Only the counter's owner may modify it")]
    Unauthorized,
}
