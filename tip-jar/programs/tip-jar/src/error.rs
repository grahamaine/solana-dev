use anchor_lang::prelude::*;

#[error_code]
pub enum TipJarError {
    #[msg("Deposit amount must be greater than zero")]
    InvalidAmount,
    #[msg("Withdrawal amount exceeds the vault balance")]
    InsufficientVaultBalance,
    #[msg("Withdrawal would leave the vault below the rent-exempt minimum; withdraw the full balance instead")]
    BelowRentExemptMinimum,
}
