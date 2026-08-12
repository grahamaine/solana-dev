use anchor_lang::prelude::*;

#[constant]
pub const MANAGER_SEED: &[u8] = b"manager";

#[constant]
pub const MINT_SEED: &[u8] = b"mint";

pub const MAX_NAME_LEN: usize = 32;
pub const MAX_SYMBOL_LEN: usize = 10;
pub const MAX_URI_LEN: usize = 200;
