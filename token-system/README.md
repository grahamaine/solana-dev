# Token system — account-level management on Token-2022

Week 2 exercise: a token whose entire lifecycle is governed **at the account
level** by a `TokenManager` PDA, using the **Token-2022** program and its
**TokenMetadata extension**, with explicit custom **error messages** for
every rule.

## Design

```
wallet (authority)
   │  seeds = ["manager", authority]
   ▼
TokenManager PDA ── mint & metadata authority ──▶ Token-2022 mint
  authority, mint,                                 seeds = ["mint", manager]
  mint_cap, total_minted,                          MetadataPointer -> itself
  total_burned                                     name / symbol / uri on-mint
```

- One manager per wallet (the PDA seed is the authority key), so creating a
  second token from the same wallet fails at address derivation.
- The **manager PDA is the mint authority**, not the wallet — every supply
  change must go through this program, which is what enforces the cap.
- The **TokenMetadata extension** stores name/symbol/uri directly on the
  mint account (no separate metadata account). `update_metadata` edits a
  field through the metadata interface and tops the rent back up if the
  account grew.

## Instructions & errors

| Instruction | Rule | Error |
|-------------|------|-------|
| `create_token` | name ≤ 32, symbol ≤ 10, uri ≤ 200 chars | `StringTooLong` |
| | cap must be > 0 | `InvalidSupplyCap` |
| `mint_tokens` | authority only | `Unauthorized` |
| | amount > 0 | `InvalidAmount` |
| | `total_minted + amount ≤ mint_cap` | `SupplyCapExceeded` |
| `transfer_tokens` | uses `transfer_checked` (validates mint+decimals) | Token-2022's own errors |
| `burn_tokens` | holders burn their own; tracked in `total_burned` | `InvalidAmount` |
| `update_metadata` | authority only; field ∈ {name, symbol, uri} | `Unauthorized`, `InvalidMetadataField` |

## Run it

```bash
anchor build
cargo test    # 13 LiteSVM tests, including a loop that mints to the cap
```
