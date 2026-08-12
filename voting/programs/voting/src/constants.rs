use anchor_lang::prelude::*;

#[constant]
pub const POLL_SEED: &[u8] = b"poll";

#[constant]
pub const MINT_SEED: &[u8] = b"mint";

#[constant]
pub const CANDIDATE_SEED: &[u8] = b"candidate";

#[constant]
pub const VOTE_SEED: &[u8] = b"vote";

#[constant]
pub const BALLOT_TOKEN_SEED: &[u8] = b"ballot";

pub const MAX_CANDIDATES: u8 = 10;
pub const MAX_TITLE_LEN: usize = 64;
pub const MAX_DESCRIPTION_LEN: usize = 200;
pub const MAX_CANDIDATE_NAME_LEN: usize = 32;

pub const TOKEN_SYMBOL: &str = "VOTE";
pub const TOKEN_URI: &str = "";
