use anchor_lang::prelude::*;

#[error_code]
pub enum MarketplaceError {
    #[msg("Fee exceeds the maximum allowed basis points")]
    FeeTooHigh,
    #[msg("Only the marketplace authority may perform this action")]
    Unauthorized,
    #[msg("Price must be greater than zero")]
    InvalidPrice,
    #[msg("Auction end time must be in the future")]
    InvalidEndTime,
    #[msg("Auction has not ended yet")]
    AuctionNotEnded,
    #[msg("Auction has already ended")]
    AuctionEnded,
    #[msg("Bid must meet the reserve price and exceed the current highest bid")]
    BidTooLow,
    #[msg("Auction cannot be cancelled once it has received a bid")]
    AuctionHasBids,
    #[msg("Auction has no bids to settle")]
    NoBids,
    #[msg("Provided account does not match the current highest bidder")]
    InvalidHighestBidder,
    #[msg("Insufficient funds in the treasury")]
    InsufficientTreasuryFunds,
    #[msg("Numeric overflow")]
    Overflow,
}
