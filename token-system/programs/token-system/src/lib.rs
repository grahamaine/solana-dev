#![allow(unexpected_cfgs)]

pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("7yzFYbiTKKjqyLmNUpBidXs8kRgn7BcpJJAN3NKQvkg5");

/// Week 2 — Token system exercise.
///
/// Account-level token management: every wallet can create one Token-2022
/// mint whose supply is governed by a `TokenManager` PDA. The mint carries
/// the TokenMetadata extension, so name/symbol/uri live directly on the
/// mint account.
#[program]
pub mod token_system {
    use super::*;

    /// Create the TokenManager PDA and its Token-2022 mint with the
    /// TokenMetadata extension initialized.
    pub fn create_token(
        ctx: Context<CreateToken>,
        name: String,
        symbol: String,
        uri: String,
        decimals: u8,
        mint_cap: u64,
    ) -> Result<()> {
        instructions::create_token::handler(ctx, name, symbol, uri, decimals, mint_cap)
    }

    /// Mint tokens to any recipient. Authority-only; enforces the cap.
    pub fn mint_tokens(ctx: Context<MintTokens>, amount: u64) -> Result<()> {
        instructions::mint_tokens::handler(ctx, amount)
    }

    /// Transfer tokens between wallets using transfer_checked.
    pub fn transfer_tokens(ctx: Context<TransferTokens>, amount: u64) -> Result<()> {
        instructions::transfer_tokens::handler(ctx, amount)
    }

    /// Burn tokens from the caller's own account.
    pub fn burn_tokens(ctx: Context<BurnTokens>, amount: u64) -> Result<()> {
        instructions::burn_tokens::handler(ctx, amount)
    }

    /// Update one of the metadata fields (name / symbol / uri).
    /// Authority-only.
    pub fn update_metadata(
        ctx: Context<UpdateMetadata>,
        field_name: String,
        value: String,
    ) -> Result<()> {
        instructions::update_metadata::handler(ctx, field_name, value)
    }
}
