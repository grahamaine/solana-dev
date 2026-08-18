# Week 3 — Tokens & Token-2022

Tokens are the core building block: DeFi, NFTs, governance and payments all
depend on token accounts and token programs. This week is **CLI-first** — use
the `spl-token` CLI to create, mint, and inspect, then read the same state back
in TypeScript with `@solana/web3.js` + `@solana/spl-token`.

Everything here runs against **devnet** (test SOL, no real value).

## Setup

```bash
npm install            # @solana/web3.js, @solana/spl-token, ts-node
solana config get      # confirm RPC URL = https://api.devnet.solana.com
solana balance         # need a little devnet SOL (solana airdrop 1 if low)
```

## Exercise 3 — Your First Token (classic SPL Token)

Create an SPL mint, create token accounts, mint supply, transfer between two
wallets, then script the balance reads in TypeScript.

```bash
bash exercise3-spl-token/run.sh   # CLI: mint -> account -> mint 1000 -> transfer 100
npm run ex3:balances              # TS : reads mint supply + both ATA balances
```

`run.sh` writes `addresses.json` (mint + both token accounts); `read-balances.ts`
reads it and checks that `sender + recipient == supply`.

**Result (this run):** mint `65AdGmco…rek9H2`, decimals 9, supply 1,000 →
sender 900, recipient 100. ✅

## Exercise 4 — Token-2022 Extensions

Create a Token-2022 mint that carries **two** extensions, exercise the behavior,
then decode the extension data straight off the mint account.

- **TransferFeeConfig** — 5% fee (500 bps), 100-token cap. A transfer of 200
  delivers 190 and withholds 10 on the recipient's token account.
- **Metadata** (metadata pointer + on-chain metadata) — name / symbol / uri.

```bash
bash exercise4-token2022/run.sh   # CLI: create-token --program-2022 --transfer-fee --enable-metadata
npm run ex4:decode                # TS : unpack TransferFeeConfig, MetadataPointer, TokenMetadata
```

**Result (this run):** mint `ABt9SipA…YfHoNS`, extensions
`TransferFeeConfig, MetadataPointer, TokenMetadata`; transfer 200 → recipient
190, **10 withheld** (decoded from the recipient account). ✅

## Layout

```
week3-tokens/
├─ package.json / tsconfig.json     # shared TS deps + config
├─ exercise3-spl-token/
│  ├─ run.sh                        # the CLI flow (re-runnable)
│  ├─ read-balances.ts             # TS: read mint + balances
│  └─ addresses.json               # generated: public addresses only
└─ exercise4-token2022/
   ├─ run.sh                        # the CLI flow (re-runnable)
   ├─ decode-extensions.ts         # TS: decode extension data
   └─ addresses.json               # generated
```

## Notes

- `recipient.json` keypairs are generated locally and **git-ignored** — never
  commit private keys.
- Re-running a `run.sh` creates a *fresh* mint and overwrites `addresses.json`.
- Classic tokens use `TOKEN_PROGRAM_ID`; Token-2022 uses `TOKEN_2022_PROGRAM_ID`.
  You must pass the right program id to `getMint` / `getAccount` or the read fails.
```
