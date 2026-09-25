# Escrow — trustless SPL token exchange

Week 5, Exercise 8 (the "hardest program" of the week): a maker deposits
token A into a program-owned vault and names the amount of token B they want
back. Any taker can fill it atomically, or the maker can walk away with
their deposit — neither side ever has to trust the other, or a third party.

## Design

| | |
|---|---|
| **Escrow PDA** | seeds `["escrow", maker, seed]` — `seed` is a client-chosen `u64` so one maker can run several offers at once without seed collisions |
| **Vault** | an associated token account for `mint_a`, owned by the escrow PDA — this is what makes the swap trustless: neither party can move the funds except through `take`/`cancel` |
| **Stored state** | `seed`, `maker`, `mint_a`, `mint_b`, `receive` (amount of `mint_b` wanted), `bump` — the deposited amount isn't stored; `take`/`cancel` just move whatever the vault currently holds |

## Instructions

- **`make(seed, deposit, receive)`** — maker deposits `deposit` of `mint_a` into the vault, records the offer.
- **`take()`** — taker pays the maker `receive` of `mint_b` first, then the escrow PDA releases the vault's `mint_a` to the taker and closes both the vault and the escrow account (rent refunded to the maker).
- **`cancel()`** — maker reclaims their deposit; closes the vault and the escrow account.

Built with `anchor_spl::token_interface`, so it works with either the
classic SPL Token program or Token-2022 — whichever `token_program` the
client passes in.

## A real bug this hit (worth knowing)

The first version of `Take`'s accounts struct failed **at runtime**, not at
build time: `anchor build` printed a stack-offset warning
("Stack offset ... exceeded max offset of 4096"), and `cargo test` turned
that into an actual `Access violation in stack frame 5` inside the `take`
instruction. BPF functions get a 4KB stack frame; `Take` has 9 accounts
including two `Mint`s and four `TokenAccount`s (sized to also fit
Token-2022's extension data), which is enough to blow that limit. Fix:
wrap the token/mint accounts in `Box<...>` (see
[`take.rs`](programs/escrow/src/instructions/take.rs)) so they live on the
heap instead of the stack. `make.rs`/`cancel.rs` have fewer accounts and
never needed it.

## Run it

```bash
anchor build
cargo test
```

11 LiteSVM integration tests, matching the course's own test-strategy table:
full make→take and make→cancel lifecycles, running two escrows at once from
the same maker, token supply conserved across a full make→take→cancel
cycle (no hidden mint/burn), and six failure paths — zero deposit/receive
amount, a taker who can't cover the asking price, a taker offering the
wrong mint, a non-maker trying to cancel someone else's escrow, a second
take after the escrow already closed, and a take attempted after the maker
already cancelled.

## Devnet demo: chained to Exercise 3's real token

[`scripts/devnet-demo.ts`](scripts/devnet-demo.ts) runs a real `make` →
`take` cycle on devnet using **Exercise 3's actual SPL mint**
(`65AdGmcoxpjRmaAAL6aDwJq7XCEhLi3Kpy7LP4rek9H2`, from
[`week3-tokens/exercise3-spl-token/addresses.json`](../week3-tokens/exercise3-spl-token/addresses.json))
as `mint_a` — this program doesn't only ever touch throwaway test mints; it
locks and releases a token from earlier coursework. `mint_b` is a fresh
mint created by the script, since Exercise 3 only produced one token and a
swap needs two sides.

```bash
cd scripts
npm install
npm run demo
```

Last run: maker's Exercise-3 balance went `900 → 890` tokens (10 locked
into escrow), the fresh taker wallet received those 10, and the maker
received 250 of the fresh `mint_b` in return — confirmed by reading the
real devnet balances back after the swap, not just by the transactions not
throwing.
