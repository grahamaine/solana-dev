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
