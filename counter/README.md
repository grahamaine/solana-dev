# Counter — data in a PDA

Week 2 exercise: the smallest useful example of **how Solana stores data**.
A per-wallet counter whose value is saved in a Program Derived Address (PDA).

## How Solana stores data

On Solana **everything is an account**, and programs are *stateless*:

- An account is a record with an **address** (pubkey), **lamports** (SOL
  balance), a **data** byte array, and an **owner** (a program id).
- A program's code lives in one account; the data it operates on lives in
  *other* accounts that the program owns. Only the owning program may modify
  an account's data.
- To "save" state, a program creates an account (via the System Program),
  funds it **rent-exempt** (enough lamports for its size, ~0.00089 SOL for
  this 49-byte counter), and gets assigned as its owner.
- Every account a transaction touches must be listed up front — that's why
  our tests pass the counter PDA into every instruction.

The `Counter` account in this program is 49 bytes:

| bytes | field | purpose |
|-------|-------|---------|
| 8 | discriminator | Anchor's type tag, prevents account-type confusion |
| 32 | authority | wallet that owns this counter |
| 8 | count | the stored value (u64, little-endian) |
| 1 | bump | cached PDA bump |

## PDA concepts

A **Program Derived Address** is computed from seeds + a program id:

```
PDA = find_program_address(["counter", user_pubkey], program_id) -> (address, bump)
```

- **Deterministic**: the same seeds always give the same address, so a
  client never has to "remember" where data lives — it re-derives it.
  Each wallet gets its own counter because its pubkey is one of the seeds.
- **No private key**: PDAs are bumped *off* the ed25519 curve (that's what
  the bump byte does), so nobody can ever sign as a PDA...
- **...except the program**: the owning program can "sign" for its PDAs
  inside CPIs via `invoke_signed` with the seeds. That's how program-owned
  vaults and mint authorities work (see the voting and token-system
  exercises).
- Storing the bump on the account (`bump = counter.bump`) saves compute:
  `find_program_address` is a loop that hashes until it finds a valid bump.

## Dev tools check

```bash
rustc --version     # 1.96.x
solana --version    # 3.1.x (Agave)
anchor --version    # anchor-cli 1.0.2
node --version      # v24.x (only needed for TS clients)
```

Useful while developing:

```bash
anchor build                                  # compiles the .so + IDL
cargo test                                    # LiteSVM tests (no validator needed)
solana account <PDA> --url localhost          # dump raw account bytes
solana-test-validator                         # local cluster, if you want one
solana rent 49                                # rent-exempt minimum for 49 bytes
```

Tests run against **LiteSVM** — an in-process SVM, so `cargo test` needs no
running validator and finishes in seconds.

## Run it

```bash
anchor build
cargo test
```

The test suite verifies state changes **in a loop** (10 increments,
re-reading the PDA bytes after each one), checks that two wallets get
independent counters, and covers the failure paths (underflow below zero,
modifying someone else's counter, double initialization).
