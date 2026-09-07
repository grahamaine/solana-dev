//! Integration tests for the nft-marketplace program, run against LiteSVM.
//!
//! Covers fixed-price listings (list, buy, cancel, update price), timed
//! auctions (create, bid with outbid refunds, settle, cancel), the fee
//! split paid to the marketplace treasury, and the main failure paths.

use {
    anchor_lang::{
        prelude::Pubkey,
        solana_program::instruction::{AccountMeta, Instruction},
        AccountDeserialize, InstructionData, ToAccountMetas,
    },
    anchor_spl::{
        associated_token::get_associated_token_address_with_program_id,
        token::spl_token,
        token_interface::TokenAccount,
    },
    litesvm::{
        types::{FailedTransactionMetadata, TransactionMetadata},
        LiteSVM,
    },
    nft_marketplace::state::{Auction, Listing, Marketplace},
    solana_clock::Clock,
    solana_keypair::Keypair,
    solana_message::{Message, VersionedMessage},
    solana_program_pack::Pack,
    solana_signer::Signer,
    solana_system_interface::instruction::create_account,
    solana_transaction::versioned::VersionedTransaction,
};

type TxResult = Result<TransactionMetadata, FailedTransactionMetadata>;

const FEE_BPS: u16 = 250; // 2.5%

// ---------------------------------------------------------------- helpers --

fn setup() -> (LiteSVM, Keypair) {
    let mut svm = LiteSVM::new();
    let bytes = include_bytes!("../../../target/deploy/nft_marketplace.so");
    svm.add_program(nft_marketplace::id(), bytes).unwrap();
    let authority = Keypair::new();
    svm.airdrop(&authority.pubkey(), 10_000_000_000).unwrap();
    (svm, authority)
}

fn marketplace_pda() -> Pubkey {
    Pubkey::find_program_address(&[b"marketplace"], &nft_marketplace::id()).0
}

fn treasury_pda() -> Pubkey {
    Pubkey::find_program_address(&[b"treasury"], &nft_marketplace::id()).0
}

fn listing_pda(mint: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(&[b"listing", mint.as_ref()], &nft_marketplace::id()).0
}

fn auction_pda(mint: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(&[b"auction", mint.as_ref()], &nft_marketplace::id()).0
}

fn vault_pda(mint: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(&[b"auction_vault", mint.as_ref()], &nft_marketplace::id()).0
}

fn ata(owner: &Pubkey, mint: &Pubkey) -> Pubkey {
    get_associated_token_address_with_program_id(owner, mint, &spl_token::ID)
}

fn send(svm: &mut LiteSVM, payer: &Keypair, ix: Instruction) -> TxResult {
    send_multi(svm, payer, vec![ix], &[])
}

fn send_multi(svm: &mut LiteSVM, payer: &Keypair, ixs: Vec<Instruction>, extra_signers: &[&Keypair]) -> TxResult {
    let blockhash = svm.latest_blockhash();
    let msg = Message::new_with_blockhash(&ixs, Some(&payer.pubkey()), &blockhash);
    let mut signers: Vec<&Keypair> = vec![payer];
    signers.extend_from_slice(extra_signers);
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), &signers).unwrap();
    svm.send_transaction(tx)
}

/// Assert a transaction failed AND surfaced the expected error message.
fn assert_fails_with(res: TxResult, needle: &str) {
    let err = res.expect_err("expected the transaction to fail");
    let logs = err.meta.logs.join("\n");
    assert!(
        logs.contains(needle),
        "expected '{needle}' in transaction logs:\n{logs}"
    );
}

fn get<T: AccountDeserialize>(svm: &LiteSVM, address: &Pubkey) -> T {
    let account = svm.get_account(address).expect("account not found");
    T::try_deserialize(&mut account.data.as_slice()).expect("failed to deserialize")
}

fn balance(svm: &LiteSVM, address: &Pubkey) -> u64 {
    svm.get_account(address).map(|a| a.lamports).unwrap_or(0)
}

fn warp_forward(svm: &mut LiteSVM, seconds: i64) {
    let mut clock: Clock = svm.get_sysvar::<Clock>();
    clock.unix_timestamp += seconds;
    svm.set_sysvar(&clock);
}

fn new_wallet(svm: &mut LiteSVM, lamports: u64) -> Keypair {
    let kp = Keypair::new();
    svm.airdrop(&kp.pubkey(), lamports).unwrap();
    kp
}

/// Hand-built "Create Associated Token Account" instruction. Avoids pulling
/// in the separate spl-associated-token-account crate, whose transitively
/// pinned solana-program version conflicts with anchor-spl's.
fn create_ata_ix(funding: &Pubkey, wallet: &Pubkey, mint: &Pubkey, token_program: &Pubkey) -> Instruction {
    Instruction {
        program_id: anchor_spl::associated_token::ID,
        accounts: vec![
            AccountMeta::new(*funding, true),
            AccountMeta::new(ata(wallet, mint), false),
            AccountMeta::new_readonly(*wallet, false),
            AccountMeta::new_readonly(*mint, false),
            AccountMeta::new_readonly(anchor_lang::system_program::ID, false),
            AccountMeta::new_readonly(*token_program, false),
        ],
        data: vec![],
    }
}

/// Mint a fresh decimals=0 NFT (supply 1) into a new ATA owned by `owner`,
/// with `owner` as both payer and mint authority. Returns the mint pubkey.
fn mint_nft(svm: &mut LiteSVM, owner: &Keypair) -> Pubkey {
    let mint_kp = Keypair::new();
    let rent = solana_rent::Rent::default().minimum_balance(spl_token::state::Mint::LEN);

    let create_mint_ix = create_account(
        &owner.pubkey(),
        &mint_kp.pubkey(),
        rent,
        spl_token::state::Mint::LEN as u64,
        &spl_token::ID,
    );
    let init_mint_ix = spl_token::instruction::initialize_mint2(
        &spl_token::ID,
        &mint_kp.pubkey(),
        &owner.pubkey(),
        None,
        0,
    )
    .unwrap();
    let create_ata_ix = create_ata_ix(&owner.pubkey(), &owner.pubkey(), &mint_kp.pubkey(), &spl_token::ID);
    let mint_to_ix = spl_token::instruction::mint_to(
        &spl_token::ID,
        &mint_kp.pubkey(),
        &ata(&owner.pubkey(), &mint_kp.pubkey()),
        &owner.pubkey(),
        &[],
        1,
    )
    .unwrap();

    send_multi(
        svm,
        owner,
        vec![create_mint_ix, init_mint_ix, create_ata_ix, mint_to_ix],
        &[&mint_kp],
    )
    .unwrap();

    mint_kp.pubkey()
}

// ------------------------------------------------------------ ix builders --

fn init_marketplace_ix(authority: &Pubkey, fee_bps: u16) -> Instruction {
    Instruction::new_with_bytes(
        nft_marketplace::id(),
        &nft_marketplace::instruction::InitializeMarketplace { fee_bps }.data(),
        nft_marketplace::accounts::InitializeMarketplace {
            authority: *authority,
            marketplace: marketplace_pda(),
            treasury: treasury_pda(),
            system_program: anchor_lang::system_program::ID,
        }
        .to_account_metas(None),
    )
}

fn create_listing_ix(seller: &Pubkey, mint: &Pubkey, price: u64) -> Instruction {
    let listing = listing_pda(mint);
    Instruction::new_with_bytes(
        nft_marketplace::id(),
        &nft_marketplace::instruction::CreateListing { price }.data(),
        nft_marketplace::accounts::CreateListing {
            seller: *seller,
            nft_mint: *mint,
            seller_nft_account: ata(seller, mint),
            listing,
            escrow_nft_account: ata(&listing, mint),
            token_program: spl_token::ID,
            associated_token_program: anchor_spl::associated_token::ID,
            system_program: anchor_lang::system_program::ID,
        }
        .to_account_metas(None),
    )
}

fn cancel_listing_ix(seller: &Pubkey, mint: &Pubkey) -> Instruction {
    let listing = listing_pda(mint);
    Instruction::new_with_bytes(
        nft_marketplace::id(),
        &nft_marketplace::instruction::CancelListing {}.data(),
        nft_marketplace::accounts::CancelListing {
            seller: *seller,
            nft_mint: *mint,
            listing,
            escrow_nft_account: ata(&listing, mint),
            seller_nft_account: ata(seller, mint),
            token_program: spl_token::ID,
            associated_token_program: anchor_spl::associated_token::ID,
            system_program: anchor_lang::system_program::ID,
        }
        .to_account_metas(None),
    )
}

fn update_listing_price_ix(seller: &Pubkey, mint: &Pubkey, new_price: u64) -> Instruction {
    Instruction::new_with_bytes(
        nft_marketplace::id(),
        &nft_marketplace::instruction::UpdateListingPrice { new_price }.data(),
        nft_marketplace::accounts::UpdateListingPrice {
            seller: *seller,
            listing: listing_pda(mint),
        }
        .to_account_metas(None),
    )
}

fn buy_listing_ix(buyer: &Pubkey, seller: &Pubkey, mint: &Pubkey) -> Instruction {
    let listing = listing_pda(mint);
    Instruction::new_with_bytes(
        nft_marketplace::id(),
        &nft_marketplace::instruction::BuyListing {}.data(),
        nft_marketplace::accounts::BuyListing {
            buyer: *buyer,
            seller: *seller,
            nft_mint: *mint,
            listing,
            marketplace: marketplace_pda(),
            treasury: treasury_pda(),
            escrow_nft_account: ata(&listing, mint),
            buyer_nft_account: ata(buyer, mint),
            token_program: spl_token::ID,
            associated_token_program: anchor_spl::associated_token::ID,
            system_program: anchor_lang::system_program::ID,
        }
        .to_account_metas(None),
    )
}

fn create_auction_ix(seller: &Pubkey, mint: &Pubkey, reserve_price: u64, end_time: i64) -> Instruction {
    let auction = auction_pda(mint);
    Instruction::new_with_bytes(
        nft_marketplace::id(),
        &nft_marketplace::instruction::CreateAuction { reserve_price, end_time }.data(),
        nft_marketplace::accounts::CreateAuction {
            seller: *seller,
            nft_mint: *mint,
            seller_nft_account: ata(seller, mint),
            auction,
            vault: vault_pda(mint),
            escrow_nft_account: ata(&auction, mint),
            token_program: spl_token::ID,
            associated_token_program: anchor_spl::associated_token::ID,
            system_program: anchor_lang::system_program::ID,
        }
        .to_account_metas(None),
    )
}

fn place_bid_ix(bidder: &Pubkey, mint: &Pubkey, previous_bidder: &Pubkey, amount: u64) -> Instruction {
    Instruction::new_with_bytes(
        nft_marketplace::id(),
        &nft_marketplace::instruction::PlaceBid { amount }.data(),
        nft_marketplace::accounts::PlaceBid {
            bidder: *bidder,
            auction: auction_pda(mint),
            vault: vault_pda(mint),
            previous_bidder: *previous_bidder,
            system_program: anchor_lang::system_program::ID,
        }
        .to_account_metas(None),
    )
}

fn settle_auction_ix(caller: &Pubkey, seller: &Pubkey, highest_bidder: &Pubkey, mint: &Pubkey) -> Instruction {
    let auction = auction_pda(mint);
    Instruction::new_with_bytes(
        nft_marketplace::id(),
        &nft_marketplace::instruction::SettleAuction {}.data(),
        nft_marketplace::accounts::SettleAuction {
            caller: *caller,
            seller: *seller,
            highest_bidder: *highest_bidder,
            nft_mint: *mint,
            auction,
            vault: vault_pda(mint),
            marketplace: marketplace_pda(),
            treasury: treasury_pda(),
            escrow_nft_account: ata(&auction, mint),
            winner_nft_account: ata(highest_bidder, mint),
            token_program: spl_token::ID,
            associated_token_program: anchor_spl::associated_token::ID,
            system_program: anchor_lang::system_program::ID,
        }
        .to_account_metas(None),
    )
}

fn cancel_auction_ix(seller: &Pubkey, mint: &Pubkey) -> Instruction {
    let auction = auction_pda(mint);
    Instruction::new_with_bytes(
        nft_marketplace::id(),
        &nft_marketplace::instruction::CancelAuction {}.data(),
        nft_marketplace::accounts::CancelAuction {
            seller: *seller,
            nft_mint: *mint,
            auction,
            escrow_nft_account: ata(&auction, mint),
            seller_nft_account: ata(seller, mint),
            token_program: spl_token::ID,
            associated_token_program: anchor_spl::associated_token::ID,
            system_program: anchor_lang::system_program::ID,
        }
        .to_account_metas(None),
    )
}

fn withdraw_fees_ix(authority: &Pubkey, amount: u64) -> Instruction {
    Instruction::new_with_bytes(
        nft_marketplace::id(),
        &nft_marketplace::instruction::WithdrawFees { amount }.data(),
        nft_marketplace::accounts::WithdrawFees {
            authority: *authority,
            marketplace: marketplace_pda(),
            treasury: treasury_pda(),
            system_program: anchor_lang::system_program::ID,
        }
        .to_account_metas(None),
    )
}

fn init_marketplace(svm: &mut LiteSVM, authority: &Keypair) {
    send(svm, authority, init_marketplace_ix(&authority.pubkey(), FEE_BPS)).unwrap();
}

// ----------------------------------------------------------- happy paths --

#[test]
fn initialize_marketplace_sets_authority_and_fee() {
    let (mut svm, authority) = setup();
    init_marketplace(&mut svm, &authority);

    let marketplace: Marketplace = get(&svm, &marketplace_pda());
    assert_eq!(marketplace.authority, authority.pubkey());
    assert_eq!(marketplace.fee_bps, FEE_BPS);
}

#[test]
fn list_then_buy_transfers_nft_and_splits_payment_with_fee() {
    let (mut svm, authority) = setup();
    init_marketplace(&mut svm, &authority);

    let seller = new_wallet(&mut svm, 5_000_000_000);
    let buyer = new_wallet(&mut svm, 5_000_000_000);
    let mint = mint_nft(&mut svm, &seller);

    let price: u64 = 1_000_000_000;
    send(&mut svm, &seller, create_listing_ix(&seller.pubkey(), &mint, price)).unwrap();

    let listing: Listing = get(&svm, &listing_pda(&mint));
    assert_eq!(listing.seller, seller.pubkey());
    assert_eq!(listing.price, price);

    let seller_before = balance(&svm, &seller.pubkey());
    let treasury_before = balance(&svm, &treasury_pda());

    send(&mut svm, &buyer, buy_listing_ix(&buyer.pubkey(), &seller.pubkey(), &mint)).unwrap();

    let fee = price * FEE_BPS as u64 / 10_000;
    let seller_amount = price - fee;

    // Seller receives payment plus the listing's reclaimed rent.
    assert!(balance(&svm, &seller.pubkey()) >= seller_before + seller_amount);
    assert_eq!(balance(&svm, &treasury_pda()), treasury_before + fee);

    let buyer_ata: TokenAccount = get(&svm, &ata(&buyer.pubkey(), &mint));
    assert_eq!(buyer_ata.amount, 1);

    // Listing and escrow are gone.
    assert!(svm.get_account(&listing_pda(&mint)).is_none());
}

#[test]
fn cancel_listing_returns_nft_to_seller() {
    let (mut svm, authority) = setup();
    init_marketplace(&mut svm, &authority);

    let seller = new_wallet(&mut svm, 5_000_000_000);
    let mint = mint_nft(&mut svm, &seller);
    send(&mut svm, &seller, create_listing_ix(&seller.pubkey(), &mint, 1_000_000_000)).unwrap();

    send(&mut svm, &seller, cancel_listing_ix(&seller.pubkey(), &mint)).unwrap();

    let seller_ata: TokenAccount = get(&svm, &ata(&seller.pubkey(), &mint));
    assert_eq!(seller_ata.amount, 1);
    assert!(svm.get_account(&listing_pda(&mint)).is_none());
}

#[test]
fn update_listing_price_changes_price() {
    let (mut svm, authority) = setup();
    init_marketplace(&mut svm, &authority);

    let seller = new_wallet(&mut svm, 5_000_000_000);
    let mint = mint_nft(&mut svm, &seller);
    send(&mut svm, &seller, create_listing_ix(&seller.pubkey(), &mint, 1_000_000_000)).unwrap();

    send(&mut svm, &seller, update_listing_price_ix(&seller.pubkey(), &mint, 2_000_000_000)).unwrap();

    let listing: Listing = get(&svm, &listing_pda(&mint));
    assert_eq!(listing.price, 2_000_000_000);
}

#[test]
fn auction_bid_refunds_previous_bidder_and_settle_pays_out() {
    let (mut svm, authority) = setup();
    init_marketplace(&mut svm, &authority);

    let seller = new_wallet(&mut svm, 5_000_000_000);
    let bidder_a = new_wallet(&mut svm, 5_000_000_000);
    let bidder_b = new_wallet(&mut svm, 5_000_000_000);
    let mint = mint_nft(&mut svm, &seller);

    let now = svm.get_sysvar::<Clock>().unix_timestamp;
    let reserve = 1_000_000_000u64;
    send(
        &mut svm,
        &seller,
        create_auction_ix(&seller.pubkey(), &mint, reserve, now + 3600),
    )
    .unwrap();

    // First bid at the reserve price.
    send(
        &mut svm,
        &bidder_a,
        place_bid_ix(&bidder_a.pubkey(), &mint, &bidder_a.pubkey(), reserve),
    )
    .unwrap();

    let bidder_a_before = balance(&svm, &bidder_a.pubkey());

    // Outbid by bidder_b; bidder_a should be refunded in full.
    let higher_bid = reserve + 500_000_000;
    send(
        &mut svm,
        &bidder_b,
        place_bid_ix(&bidder_b.pubkey(), &mint, &bidder_a.pubkey(), higher_bid),
    )
    .unwrap();

    assert_eq!(balance(&svm, &bidder_a.pubkey()), bidder_a_before + reserve);

    let auction: Auction = get(&svm, &auction_pda(&mint));
    assert_eq!(auction.highest_bidder, Some(bidder_b.pubkey()));
    assert_eq!(auction.highest_bid, higher_bid);

    warp_forward(&mut svm, 3601);

    let seller_before = balance(&svm, &seller.pubkey());
    let treasury_before = balance(&svm, &treasury_pda());

    send(
        &mut svm,
        &bidder_b,
        settle_auction_ix(&bidder_b.pubkey(), &seller.pubkey(), &bidder_b.pubkey(), &mint),
    )
    .unwrap();

    let fee = higher_bid * FEE_BPS as u64 / 10_000;
    assert!(balance(&svm, &seller.pubkey()) >= seller_before + (higher_bid - fee));
    assert_eq!(balance(&svm, &treasury_pda()), treasury_before + fee);

    let winner_ata: TokenAccount = get(&svm, &ata(&bidder_b.pubkey(), &mint));
    assert_eq!(winner_ata.amount, 1);
}

// ----------------------------------------------------------- failure paths --

#[test]
fn non_seller_cannot_cancel_listing() {
    let (mut svm, authority) = setup();
    init_marketplace(&mut svm, &authority);

    let seller = new_wallet(&mut svm, 5_000_000_000);
    let stranger = new_wallet(&mut svm, 5_000_000_000);
    let mint = mint_nft(&mut svm, &seller);
    send(&mut svm, &seller, create_listing_ix(&seller.pubkey(), &mint, 1_000_000_000)).unwrap();

    // Building the instruction with the stranger as "seller" fails the
    // has_one=seller constraint (and the stranger has no NFT ATA either way).
    let res = send(&mut svm, &stranger, cancel_listing_ix(&stranger.pubkey(), &mint));
    assert!(res.is_err());
}

#[test]
fn bid_below_reserve_fails() {
    let (mut svm, authority) = setup();
    init_marketplace(&mut svm, &authority);

    let seller = new_wallet(&mut svm, 5_000_000_000);
    let bidder = new_wallet(&mut svm, 5_000_000_000);
    let mint = mint_nft(&mut svm, &seller);

    let now = svm.get_sysvar::<Clock>().unix_timestamp;
    let reserve = 1_000_000_000u64;
    send(&mut svm, &seller, create_auction_ix(&seller.pubkey(), &mint, reserve, now + 3600)).unwrap();

    let res = send(
        &mut svm,
        &bidder,
        place_bid_ix(&bidder.pubkey(), &mint, &bidder.pubkey(), reserve - 1),
    );
    assert_fails_with(res, "Bid must meet the reserve price");
}

#[test]
fn cancel_auction_fails_once_bid_placed() {
    let (mut svm, authority) = setup();
    init_marketplace(&mut svm, &authority);

    let seller = new_wallet(&mut svm, 5_000_000_000);
    let bidder = new_wallet(&mut svm, 5_000_000_000);
    let mint = mint_nft(&mut svm, &seller);

    let now = svm.get_sysvar::<Clock>().unix_timestamp;
    let reserve = 1_000_000_000u64;
    send(&mut svm, &seller, create_auction_ix(&seller.pubkey(), &mint, reserve, now + 3600)).unwrap();
    send(&mut svm, &bidder, place_bid_ix(&bidder.pubkey(), &mint, &bidder.pubkey(), reserve)).unwrap();

    let res = send(&mut svm, &seller, cancel_auction_ix(&seller.pubkey(), &mint));
    assert_fails_with(res, "Auction cannot be cancelled once it has received a bid");
}

#[test]
fn withdraw_fees_by_non_authority_fails() {
    let (mut svm, authority) = setup();
    init_marketplace(&mut svm, &authority);

    let stranger = new_wallet(&mut svm, 5_000_000_000);
    let res = send(&mut svm, &stranger, withdraw_fees_ix(&stranger.pubkey(), 1));
    assert!(res.is_err());
}

#[test]
fn withdraw_fees_by_authority_succeeds_after_a_sale() {
    let (mut svm, authority) = setup();
    init_marketplace(&mut svm, &authority);

    let seller = new_wallet(&mut svm, 5_000_000_000);
    let buyer = new_wallet(&mut svm, 5_000_000_000);
    let mint = mint_nft(&mut svm, &seller);

    let price = 1_000_000_000u64;
    send(&mut svm, &seller, create_listing_ix(&seller.pubkey(), &mint, price)).unwrap();
    send(&mut svm, &buyer, buy_listing_ix(&buyer.pubkey(), &seller.pubkey(), &mint)).unwrap();

    let fee = price * FEE_BPS as u64 / 10_000;
    let authority_before = balance(&svm, &authority.pubkey());

    send(&mut svm, &authority, withdraw_fees_ix(&authority.pubkey(), fee)).unwrap();

    assert_eq!(balance(&svm, &treasury_pda()), 0);
    // authority is also the transaction fee-payer here, so its balance goes
    // up by `fee` minus the tx's own signature fee — allow for that.
    let authority_after = balance(&svm, &authority.pubkey());
    assert!(authority_after > authority_before);
    assert!(authority_after >= authority_before + fee - 10_000);
}
