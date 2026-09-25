# DeFi — Pyth price vs. Jupiter quote spread

Week 5, Exercise 9: a small CLI that reads a Pyth oracle price and a Jupiter
swap quote for the same pair, then computes the spread between them — the
gap between the "reference" price and what you'd actually get executing a
real swap right now (slippage + fees + routing, at that trade size).

## How it works

1. **Pyth — on-chain, devnet.** Reads SOL/USD directly off Pyth's on-chain
   price account on **Solana devnet** (`@pythnetwork/client`'s
   `PythHttpClient`, program `gSbePebfvPy7tRqimPoVecS2UsBvYv46ynrzWocc92s`)
   — an RPC read against a real devnet account, not an off-chain REST call.
2. **Jupiter — mainnet quote, no execution.** `GET quote-api.jup.ag/v6/quote`
   for a SOL → USDC swap at the requested size. Jupiter has no separate
   "devnet" quote service — it routes real mainnet liquidity — so this call
   always targets mainnet regardless of where the Pyth price came from.
3. **Spread** — `jupiterPrice - pythPrice`, as both a dollar amount and a
   percentage of the oracle price, plus a staleness warning if the Pyth
   price is more than 30 seconds old.

## A real gap this hit (worth knowing)

Pyth's on-chain **devnet** price accounts are a legacy leftover: production
Pyth price flow moved years ago to the pull-oracle model (Hermes +
on-demand on-chain updates), so the classic always-on devnet feed for
SOL/USD is not actively maintained. Querying it live returns
`PriceStatus.Unknown` with a `timestamp` that's over a year old — confirmed
by hand before writing the fallback, not assumed. The course's own pitfall
table anticipates exactly this ("Pyth account not found / stale"), so
`spread.ts` detects it (`status !== Trading`) and falls back to Hermes
(Pyth's off-chain aggregator API) for a live number, clearly labeling which
source produced the printed price rather than silently swapping in Hermes
as if it were the same thing.

## Run it

```bash
npm install
npm run spread                  # 1 SOL -> USDC (default)
npm run spread -- --amount 5    # 5 SOL -> USDC
```

## Note on where this was built

`quote-api.jup.ag` and `hermes.pyth.network` aren't reachable from inside
the assistant's sandboxed shell (one doesn't resolve at all, the other
returns a hard `401 unauthorized` before reaching the app — a network
allowlist issue in that environment, not a code problem). The devnet Pyth
on-chain read **does** work from there (Solana RPC endpoints are
allowlisted) and was verified live — it correctly reports the feed as not
trading, exactly as described above. Run the full script from a normal
terminal (or this project's own WSL shell) to see it fall through to a
live Hermes price and a real Jupiter quote.
