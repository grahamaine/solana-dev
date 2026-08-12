use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};
use anchor_spl::token_2022::Token2022;
use anchor_spl::token_interface::{token_metadata_initialize, Mint, TokenMetadataInitialize};

use crate::constants::*;
use crate::error::TokenSystemError;
use crate::state::TokenManager;

#[derive(Accounts)]
#[instruction(name: String, symbol: String, uri: String, decimals: u8)]
pub struct CreateToken<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    /// One manager per wallet: the PDA seed is the authority key, so a
    /// second create_token from the same wallet fails.
    #[account(
        init,
        payer = authority,
        space = 8 + TokenManager::INIT_SPACE,
        seeds = [MANAGER_SEED, authority.key().as_ref()],
        bump,
    )]
    pub manager: Account<'info, TokenManager>,

    /// Token-2022 mint owned by the manager PDA. The MetadataPointer
    /// extension points at the mint itself, so name/symbol/uri are stored
    /// on this very account.
    #[account(
        init,
        payer = authority,
        seeds = [MINT_SEED, manager.key().as_ref()],
        bump,
        mint::decimals = decimals,
        mint::authority = manager,
        mint::token_program = token_program,
        extensions::metadata_pointer::authority = manager,
        extensions::metadata_pointer::metadata_address = mint,
    )]
    pub mint: InterfaceAccount<'info, Mint>,

    pub token_program: Program<'info, Token2022>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<CreateToken>,
    name: String,
    symbol: String,
    uri: String,
    decimals: u8,
    mint_cap: u64,
) -> Result<()> {
    require!(name.len() <= MAX_NAME_LEN, TokenSystemError::StringTooLong);
    require!(symbol.len() <= MAX_SYMBOL_LEN, TokenSystemError::StringTooLong);
    require!(uri.len() <= MAX_URI_LEN, TokenSystemError::StringTooLong);
    require!(mint_cap > 0, TokenSystemError::InvalidSupplyCap);

    let manager = &mut ctx.accounts.manager;
    manager.authority = ctx.accounts.authority.key();
    manager.mint = ctx.accounts.mint.key();
    manager.decimals = decimals;
    manager.mint_cap = mint_cap;
    manager.total_minted = 0;
    manager.total_burned = 0;
    manager.bump = ctx.bumps.manager;
    manager.mint_bump = ctx.bumps.mint;

    // The manager PDA is the metadata authority, so it signs the CPI.
    let authority_key = ctx.accounts.authority.key();
    let signer_seeds: &[&[&[u8]]] =
        &[&[MANAGER_SEED, authority_key.as_ref(), &[ctx.bumps.manager]]];

    token_metadata_initialize(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            TokenMetadataInitialize {
                program_id: ctx.accounts.token_program.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                metadata: ctx.accounts.mint.to_account_info(),
                mint_authority: ctx.accounts.manager.to_account_info(),
                update_authority: ctx.accounts.manager.to_account_info(),
            },
            signer_seeds,
        ),
        name,
        symbol,
        uri,
    )?;

    // Writing the metadata grew the mint account, so top its lamports back
    // up to the rent-exempt minimum for the new size.
    let mint_info = ctx.accounts.mint.to_account_info();
    let required = Rent::get()?.minimum_balance(mint_info.data_len());
    let current = mint_info.lamports();
    if required > current {
        transfer(
            CpiContext::new(
                ctx.accounts.system_program.key(),
                Transfer {
                    from: ctx.accounts.authority.to_account_info(),
                    to: mint_info,
                },
            ),
            required - current,
        )?;
    }

    Ok(())
}
