# Tip Jar — CPI to the System Program

Week 4, Exercise 6: a per-wallet vault that only ever holds lamports, built
to exercise both CPI signer patterns in one program.

## The two signer patterns

| Instruction | CPI call | Who signs | Why |
|---|---|---|---|
| `deposit(amount)` | `invoke` (`CpiContext::new`) | the owner, directly | a normal wallet-to-wallet-style transfer — the caller already has a private key |
| `withdraw(amount)` | `invoke_signed` (`CpiContext::new_with_signer`) | the program, on the vault's behalf | the vault PDA has no private key; the program proves ownership by supplying the exact seeds that derived it |

## Design

The vault is **not an Anchor account** — it's a bare, data-less PDA
(`SystemAccount<'info>`) at seeds `["vault", owner]`. It comes into
existence on the very first deposit: the System Program will credit lamports
to any address, initialized or not. There's no stored "authority" field
either — safety comes entirely from the seeds: a different signer derives a
*different* (and, for them, empty) vault, so there's no way to even
address someone else's funds, let alone move them.

`withdraw` allows draining the vault to exactly zero (Solana garbage-collects
zero-lamport accounts), but rejects a partial withdrawal that would leave it
sitting below the rent-exempt minimum — the "vault disappears" pitfall from
an account falling below that threshold without being closed on purpose.

## Run it

```bash
anchor build
cargo test
```

9 LiteSVM integration tests: both CPI patterns, multiple deposits
accumulating, independent per-wallet vaults, full drain-to-zero, and four
failure paths (zero-amount deposit, over-withdrawal, a partial withdrawal
that would break the rent-exempt minimum, and confirming one wallet can
never reach another's vault).
