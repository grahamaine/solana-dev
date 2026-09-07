# solana-dev

Solana development workspace — course exercises, built with Anchor and
tested against LiteSVM (no validator needed: `cargo test`).

## Week 2 exercises

| Exercise | Covers |
|----------|--------|
| [`voting/`](voting/) | Program **states** (Draft → Active → Closed), **failure tests** for every custom error, Token-2022 ballot token minted per vote |
| [`token-system/`](token-system/) | **Account-level token system**: manager PDA, **Token-2022** mint with the **TokenMetadata extension**, mint/transfer/burn/update-metadata, custom **error messages**, supply cap |
| [`counter/`](counter/) | **How Solana stores data**, **PDA concepts**, a counter that saves its value in a PDA, **loop-verified** tests, dev-tools checklist (see its [README](counter/README.md)) |

Each exercise builds with `anchor build` and tests with `cargo test` from
its own directory.

## Week 3 exercises

CLI-first this week: use the `spl-token` CLI to create/mint/inspect, then read
the same state back in TypeScript (`@solana/web3.js` + `@solana/spl-token`).
Runs against **devnet**. See [`week3-tokens/`](week3-tokens/).

| Exercise | Covers |
|----------|--------|
| [`exercise3-spl-token/`](week3-tokens/exercise3-spl-token/) | **Your First Token**: SPL mint, token accounts, mint supply, transfer between two wallets, then a TS reader (`supply == sender + recipient`) |
| [`exercise4-token2022/`](week3-tokens/exercise4-token2022/) | **Token-2022 extensions**: mint with **TransferFeeConfig** (observable 5% fee) + **Metadata**, then decode extension data straight off the mint account in TS |

## NFT Marketplace

A full Anchor marketplace program for trading existing NFTs — beyond the
weekly exercises above. See [`nft-marketplace/`](nft-marketplace/).

- **Fixed-price listings**: list, buy, cancel, update price. NFTs are
  escrowed in a PDA-owned token account for the life of the listing.
- **Timed English auctions**: create, bid (previous highest bidder is
  refunded automatically), settle after the end time, or cancel while no
  bids have been placed.
- **Marketplace fee**: a configurable basis-point cut of every sale goes to
  a PDA treasury; only the marketplace authority can withdraw it.
- 10 LiteSVM integration tests cover both flows end-to-end, including the
  fee split and every failure path (unauthorized cancel, bid below reserve,
  cancelling an auction that already has bids, etc).

Deployed to devnet: [`DPZVLmiip36N4TnJBghu7opiZTBx6C4LBH4j9WhRPEpN`](https://explorer.solana.com/address/DPZVLmiip36N4TnJBghu7opiZTBx6C4LBH4j9WhRPEpN?cluster=devnet).
Wired into the shared frontend at `/nft-marketplace`.

## Frontend

A shared Next.js app under [`frontend/`](frontend/) wires up the wallet
adapter and a page per program (Counter, Voting, Token System, NFT
Marketplace), all pointed at devnet. Live at
[solana-dev-frontend.vercel.app](https://solana-dev-frontend.vercel.app).

## Toolchain

| Tool | Version |
|------|---------|
| Rust | 1.96.0 |
| Node.js | v24.15.0 |
| Solana CLI | 3.1.10 (Agave) |
| Anchor | 1.0.2 |

Everything runs inside **WSL2 / Ubuntu 24.04** (run dev commands from the
Ubuntu terminal, not Windows PowerShell).

## Quick start

```bash
# verify tools
rustc --version
node --version
solana --version
anchor --version

# build + test an exercise
cd voting && anchor build && cargo test
```

## Notes

- Keep this project inside the Linux filesystem (`~/solana-dev`) for fast
  builds — avoid `/mnt/c`.
- `anchor-starter/` is the Week 2 environment-setup scaffold.
- Never commit private keys / keypair files.
