use anchor_lang::prelude::*;

/// Account-level bookkeeping for one token. PDA: ["manager", authority].
///
/// The manager PDA is also the mint + metadata authority of the token, so
/// every supply change has to go through this program.
#[account]
#[derive(InitSpace)]
pub struct TokenManager {
    /// Wallet allowed to mint and to update metadata.
    pub authority: Pubkey,
    /// The Token-2022 mint this manager controls.
    pub mint: Pubkey,
    pub decimals: u8,
    /// Hard cap on the total amount that may ever be minted.
    pub mint_cap: u64,
    pub total_minted: u64,
    pub total_burned: u64,
    pub bump: u8,
    pub mint_bump: u8,
}
