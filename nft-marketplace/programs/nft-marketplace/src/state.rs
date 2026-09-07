use anchor_lang::prelude::*;

/// Global marketplace configuration singleton. PDA: ["marketplace"].
#[account]
#[derive(InitSpace)]
pub struct Marketplace {
    pub authority: Pubkey,
    pub fee_bps: u16,
    pub bump: u8,
    pub treasury_bump: u8,
}

/// A fixed-price listing escrowing a single NFT. PDA: ["listing", nft_mint].
#[account]
#[derive(InitSpace)]
pub struct Listing {
    pub seller: Pubkey,
    pub nft_mint: Pubkey,
    pub price: u64,
    pub bump: u8,
}

/// A timed English auction escrowing a single NFT. PDA: ["auction", nft_mint].
#[account]
#[derive(InitSpace)]
pub struct Auction {
    pub seller: Pubkey,
    pub nft_mint: Pubkey,
    pub reserve_price: u64,
    pub end_time: i64,
    pub highest_bidder: Option<Pubkey>,
    pub highest_bid: u64,
    pub bump: u8,
    pub vault_bump: u8,
}
