use anchor_lang::prelude::*;

#[error_code]
pub enum TokenSystemError {
    #[msg("Only the token manager authority may perform this action")]
    Unauthorized,
    #[msg("Amount must be greater than zero")]
    InvalidAmount,
    #[msg("Supply cap must be greater than zero")]
    InvalidSupplyCap,
    #[msg("Minting this amount would exceed the supply cap")]
    SupplyCapExceeded,
    #[msg("Provided string exceeds the maximum allowed length")]
    StringTooLong,
    #[msg("Unknown metadata field: expected name, symbol or uri")]
    InvalidMetadataField,
}
