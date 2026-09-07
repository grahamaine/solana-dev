#![allow(unexpected_cfgs)]

pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("DPZVLmiip36N4TnJBghu7opiZTBx6C4LBH4j9WhRPEpN");

#[program]
pub mod nft_marketplace {
    use super::*;

    /// One-time setup: sets the marketplace fee (in basis points) and
    /// records the fee-vault bump. authority becomes the only wallet
    /// allowed to withdraw accumulated fees.
    pub fn initialize_marketplace(ctx: Context<InitializeMarketplace>, fee_bps: u16) -> Result<()> {
        instructions::initialize_marketplace::handler(ctx, fee_bps)
    }

    /// List an NFT for a fixed price. Escrows the NFT in a PDA-owned token
    /// account until it is bought or the listing is cancelled.
    pub fn create_listing(ctx: Context<CreateListing>, price: u64) -> Result<()> {
        instructions::create_listing::handler(ctx, price)
    }

    /// Cancel a listing and return the escrowed NFT to the seller.
    pub fn cancel_listing(ctx: Context<CancelListing>) -> Result<()> {
        instructions::cancel_listing::handler(ctx)
    }

    /// Change the price of an active listing.
    pub fn update_listing_price(ctx: Context<UpdateListingPrice>, new_price: u64) -> Result<()> {
        instructions::update_listing_price::handler(ctx, new_price)
    }

    /// Buy a listed NFT at its current price. Splits payment between the
    /// seller and the marketplace treasury according to fee_bps.
    pub fn buy_listing(ctx: Context<BuyListing>) -> Result<()> {
        instructions::buy_listing::handler(ctx)
    }

    /// Start a timed English auction for an NFT, escrowing it in a
    /// PDA-owned token account until it is settled or cancelled.
    pub fn create_auction(ctx: Context<CreateAuction>, reserve_price: u64, end_time: i64) -> Result<()> {
        instructions::create_auction::handler(ctx, reserve_price, end_time)
    }

    /// Place a bid on an active auction. Must meet the reserve price (first
    /// bid) or exceed the current highest bid; the previous highest bidder,
    /// if any, is refunded automatically.
    pub fn place_bid(ctx: Context<PlaceBid>, amount: u64) -> Result<()> {
        instructions::place_bid::handler(ctx, amount)
    }

    /// After end_time, pay out the winning bid (minus fee) to the seller
    /// and transfer the NFT to the highest bidder. Callable by anyone.
    pub fn settle_auction(ctx: Context<SettleAuction>) -> Result<()> {
        instructions::settle_auction::handler(ctx)
    }

    /// Cancel an auction that has not yet received any bids, returning the
    /// NFT to the seller.
    pub fn cancel_auction(ctx: Context<CancelAuction>) -> Result<()> {
        instructions::cancel_auction::handler(ctx)
    }

    /// Withdraw accumulated marketplace fees. Only the marketplace
    /// authority may call this.
    pub fn withdraw_fees(ctx: Context<WithdrawFees>, amount: u64) -> Result<()> {
        instructions::withdraw_fees::handler(ctx, amount)
    }
}
