use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};
use anchor_spl::token_2022::Token2022;
use anchor_spl::token_interface::{
    spl_token_metadata_interface::state::Field, token_metadata_update_field, Mint,
    TokenMetadataUpdateField,
};

use crate::constants::*;
use crate::error::TokenSystemError;
use crate::state::TokenManager;

#[derive(Accounts)]
pub struct UpdateMetadata<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        has_one = authority @ TokenSystemError::Unauthorized,
        has_one = mint,
        seeds = [MANAGER_SEED, manager.authority.as_ref()],
        bump = manager.bump,
    )]
    pub manager: Account<'info, TokenManager>,

    #[account(mut, mint::token_program = token_program)]
    pub mint: InterfaceAccount<'info, Mint>,

    pub token_program: Program<'info, Token2022>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<UpdateMetadata>, field_name: String, value: String) -> Result<()> {
    let (field, max_len) = match field_name.as_str() {
        "name" => (Field::Name, MAX_NAME_LEN),
        "symbol" => (Field::Symbol, MAX_SYMBOL_LEN),
        "uri" => (Field::Uri, MAX_URI_LEN),
        _ => return err!(TokenSystemError::InvalidMetadataField),
    };
    require!(value.len() <= max_len, TokenSystemError::StringTooLong);

    // The manager PDA is the metadata update authority, so it signs.
    let authority_key = ctx.accounts.manager.authority;
    let bump = ctx.accounts.manager.bump;
    let signer_seeds: &[&[&[u8]]] = &[&[MANAGER_SEED, authority_key.as_ref(), &[bump]]];

    token_metadata_update_field(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            TokenMetadataUpdateField {
                program_id: ctx.accounts.token_program.to_account_info(),
                metadata: ctx.accounts.mint.to_account_info(),
                update_authority: ctx.accounts.manager.to_account_info(),
            },
            signer_seeds,
        ),
        field,
        value,
    )?;

    // A longer value can grow the account; keep it rent-exempt.
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
