use anchor_lang::prelude::*;

#[constant]
pub const MARKETPLACE_SEED: &[u8] = b"marketplace";

#[constant]
pub const TREASURY_SEED: &[u8] = b"treasury";

#[constant]
pub const LISTING_SEED: &[u8] = b"listing";

#[constant]
pub const AUCTION_SEED: &[u8] = b"auction";

#[constant]
pub const AUCTION_VAULT_SEED: &[u8] = b"auction_vault";

/// Hard cap on the marketplace fee: 10%.
pub const MAX_FEE_BPS: u16 = 1_000;

pub const BPS_DENOMINATOR: u64 = 10_000;
