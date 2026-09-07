# NFT Marketplace

Capstone project (Encode Solana Developer Course, Week 6) — Project Option 2:
*"List and buy NFTs atomically."* An Anchor program for trading existing NFTs
on Solana, with both fixed-price listings and timed English auctions, plus a
marketplace fee paid to a program-owned treasury.

**Deployed on devnet:** [`DPZVLmiip36N4TnJBghu7opiZTBx6C4LBH4j9WhRPEpN`](https://explorer.solana.com/address/DPZVLmiip36N4TnJBghu7opiZTBx6C4LBH4j9WhRPEpN?cluster=devnet)
**Live frontend:** [solana-dev-frontend.vercel.app/nft-marketplace](https://solana-dev-frontend.vercel.app/nft-marketplace)

## Project summary

**Problem.** NFT trading needs a trust-minimized way to swap an NFT for SOL
without either party being able to walk away with both. A naive "just send
me the SOL and I'll send the NFT" flow requires trusting a stranger.

**Users.** Anyone holding a decimals=0, supply=1 SPL (or Token-2022) mint on
devnet who wants to sell it — fixed-price or via auction — and buyers/bidders
who want to acquire one with an on-chain guarantee they'll actually receive
it.

**What it does.** The seller deposits ("escrows") their NFT into a
program-owned token account when they list it or start an auction. From that
point the NFT cannot move except through the program's own instructions —
`buy_listing` / `settle_auction` (pay the seller, hand the NFT to the
buyer/winner, atomically, in one transaction) or `cancel_listing` /
`cancel_auction` (hand it back to the seller). Every sale takes a
configurable percentage fee, paid into a PDA-owned treasury that only the
marketplace's designated authority can withdraw from.

## Architecture

### Program accounts (PDAs)

| Account | Seeds | Holds |
|---|---|---|
| `Marketplace` | `["marketplace"]` | Singleton config: `authority`, `fee_bps` |
| Treasury (system account, no data) | `["treasury"]` | Accumulated fee lamports |
| `Listing` | `["listing", nft_mint]` | One fixed-price listing: `seller`, `nft_mint`, `price` |
| `Auction` | `["auction", nft_mint]` | One auction: `seller`, `nft_mint`, `reserve_price`, `end_time`, `highest_bidder`, `highest_bid` |
| Auction vault (system account, no data) | `["auction_vault", nft_mint]` | Escrowed bid lamports |
| Escrow token account | associated token account owned by the `Listing`/`Auction` PDA | The NFT itself while listed/auctioned |

Each listing/auction is keyed by `nft_mint`, so a given NFT can only have one
active listing *or* one active auction at a time (the PDA derivation would
collide otherwise).

### Instructions

| Instruction | Who calls it | Effect |
|---|---|---|
| `initialize_marketplace(fee_bps)` | Anyone, once | Creates the `Marketplace` singleton; caller becomes `authority` |
| `create_listing(price)` | Seller | Escrows the NFT, opens a fixed-price `Listing` |
| `update_listing_price(new_price)` | Seller | Changes the price of their own listing |
| `cancel_listing()` | Seller | Returns the NFT, closes the `Listing` |
| `buy_listing()` | Buyer | Pays seller (minus fee) + treasury (fee), transfers NFT, closes `Listing` |
| `create_auction(reserve_price, end_time)` | Seller | Escrows the NFT, opens an `Auction` |
| `place_bid(amount)` | Bidder | Must meet reserve (first bid) or beat the current highest bid; previous highest bidder is refunded automatically from the vault |
| `settle_auction()` | Anyone, after `end_time`, requires a bid | Pays seller (minus fee) + treasury, transfers NFT to the highest bidder, closes `Auction` + vault |
| `cancel_auction()` | Seller, only while there are no bids | Returns the NFT, closes the `Auction` |
| `withdraw_fees(amount)` | Marketplace `authority` only | Pays out of the treasury |

### Authority model

- A `Listing`/`Auction` PDA is itself used as the token authority over its
  escrow account (`invoke_signed` with the PDA's own seeds) — no separate
  vault-authority account is needed.
- `has_one` constraints tie every mutating instruction to the correct
  `seller` (or, for auctions, the stored `highest_bidder`), so e.g. a
  stranger cannot cancel someone else's listing.
- The auction lamport vault is a plain system-owned account (not an Anchor
  `#[account]`), so it can both receive bids (`system_program::transfer`
  from the bidder) and pay out refunds/settlement (`system_program::transfer`
  signed by its own PDA seeds) without ever holding Anchor-serialized data.

### Instruction flow — fixed-price sale

```
seller: create_listing(price)
  └─ NFT: seller's ATA → escrow ATA (owned by Listing PDA)

buyer: buy_listing()
  ├─ SOL: buyer → seller            (price − fee)
  ├─ SOL: buyer → treasury          (fee)
  ├─ NFT: escrow ATA → buyer's ATA
  └─ Listing + escrow ATA closed, rent refunded to seller
```

### Instruction flow — auction

```
seller: create_auction(reserve_price, end_time)
  └─ NFT: seller's ATA → escrow ATA (owned by Auction PDA)

bidder A: place_bid(reserve_price)
  └─ SOL: bidder A → vault

bidder B: place_bid(higher_amount)
  ├─ SOL: bidder B → vault
  └─ SOL: vault → bidder A          (outbid refund)

[after end_time]
anyone: settle_auction()
  ├─ SOL: vault → seller            (winning bid − fee)
  ├─ SOL: vault → treasury          (fee)
  ├─ NFT: escrow ATA → winner's ATA
  └─ Auction + escrow ATA closed, rent refunded to seller
```

### Frontend

`frontend/src/app/nft-marketplace/page.tsx` + `useNftMarketplace.ts` (shared
Next.js app, same wallet-adapter/Anchor-provider pattern as the other
exercises). It reads the connected wallet's decimals=0/supply=1 token
accounts to offer as listable NFTs, lists all `Listing`/`Auction` accounts
via `program.account.*.all()`, and drives every instruction above through
the wallet.

## Runbook

### Prerequisites

- Rust, [Anchor CLI](https://www.anchor-lang.com/) 1.0.2, Solana CLI 3.1.10 (Agave)
- Node.js / Bun, for the frontend

### Build and test locally

```bash
cd nft-marketplace
anchor build          # compiles the program, generates target/idl + target/types
cargo test             # runs the 10 LiteSVM integration tests (no validator needed)
```

### Deploy to devnet

```bash
solana config set --url devnet
solana balance          # needs ~2 SOL for rent-exemption on this program size
solana program deploy target/deploy/nft_marketplace.so \
  --program-id target/deploy/nft_marketplace-keypair.json
```

### Run the frontend

```bash
cd ../frontend
bun install
bun run dev              # http://localhost:3000/nft-marketplace
```

Connect a devnet wallet (Phantom, etc.) funded with devnet SOL. The page
shows an "Initialize marketplace" prompt the first time — any wallet can
call it once, setting the fee and becoming the fee-withdrawal authority.

### Try it end to end

1. Have (or airdrop/mint) a decimals=0, supply=1 token in your wallet —
   any devnet NFT works.
2. **Fixed price:** pick it in "Sell an NFT" → set a SOL price → "List for
   sale". From a second wallet, click "Buy now" on the listing.
3. **Auction:** same form, "Auction" tab → set a reserve price and
   duration. Bid from other wallets; the previous highest bidder is
   refunded automatically. After the timer ends, anyone can click "Settle
   auction".
4. If you initialized the marketplace, the top bar shows the accumulated
   treasury balance with a "Withdraw fees" button.

### Tests

`nft-marketplace/programs/nft-marketplace/tests/test_marketplace.rs` — 10
tests against LiteSVM covering:

- Listing lifecycle: create → buy (verifies the fee split and rent refunds),
  cancel, update price
- Auction lifecycle: create → outbid (verifies automatic refund) → settle
  (verifies payout + fee + NFT transfer)
- Failure paths: a non-seller cannot cancel a listing, a bid below reserve
  fails, an auction with a bid can no longer be cancelled, a non-authority
  cannot withdraw fees

## Trade-offs and what I'd improve next

**Simplified for this scope:**

- The program only *trades* NFTs — it doesn't mint them. Sellers need an
  existing decimals=0/supply=1 mint (from any source: Metaplex Candy
  Machine, a plain SPL mint, another course exercise, etc).
- `fee_bps` is set once at `initialize_marketplace` with no update
  instruction. In practice a real marketplace would want a
  `set_fee(new_bps)` instruction gated to `authority`.
- No royalty enforcement — the program doesn't read a Metaplex Token
  Metadata creators list, so original-creator royalties aren't paid out
  automatically on resale.
- The frontend loads *all* listings/auctions with `program.account.*.all()`
  — fine on devnet with a handful of accounts, but wouldn't scale without
  pagination or an indexer.
- Auctions are English-style only (ascending bids to a fixed deadline); no
  Dutch auctions or offers/bids on unlisted NFTs.
- One listing *or* one auction per mint at a time, by construction (the PDA
  seed is just the mint) — can't run both simultaneously, which is
  reasonable but worth calling out.

**What I'd improve next:**

- Add a `set_fee` instruction and an optional per-collection fee override.
- Read and enforce Metaplex Token Metadata creator royalties on every sale.
- Add an "offers" instruction so buyers can bid on NFTs that aren't listed.
- Replace the frontend's fetch-everything approach with a lightweight
  indexer (or at least `getProgramAccounts` filters + pagination) once the
  number of listings grows.
- Add a small keeper/cron script to call `settle_auction` automatically
  once auctions end, instead of relying on someone clicking the button.
