use anchor_lang::prelude::*;

/// One trustless swap offer. PDA: ["escrow", maker, seed].
///
/// `seed` is a client-chosen u64 that lets one maker run several escrows at
/// once — without it the PDA would collide on a second `make`. The amount
/// of token A on offer isn't stored here; it's just the vault's live token
/// balance, so `take`/`cancel` move whatever the vault actually holds.
#[account]
#[derive(InitSpace)]
pub struct Escrow {
    pub seed: u64,
    /// Wallet that deposited token A and will receive token B.
    pub maker: Pubkey,
    pub mint_a: Pubkey,
    pub mint_b: Pubkey,
    /// Amount of `mint_b` the maker wants in exchange.
    pub receive: u64,
    pub bump: u8,
}
