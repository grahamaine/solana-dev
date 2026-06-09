# solana-dev

Solana development workspace — Week 2 Exercise 1 (environment setup).

## Toolchain

| Tool | Version |
|------|---------|
| Rust | 1.96.0 |
| Node.js | v24.15.0 |
| Solana CLI | 4.0.1 (Agave) |
| Anchor | 1.0.2 |

Everything runs inside **WSL2 / Ubuntu 24.04** (run dev commands from the Ubuntu terminal, not Windows PowerShell).

## Quick start

```bash
# verify tools
rustc --version
node --version
solana --version
anchor --version

# point the CLI at devnet
solana config set --url devnet

# create a wallet keypair (if you don't have one yet)
solana-keygen new

# airdrop some devnet SOL
solana airdrop 2

# scaffold a new Anchor program
anchor init my-program
```

## Notes

- Keep this project inside the Linux filesystem (`~/solana-dev`) for fast builds — avoid `/mnt/c`.
- Use a browser wallet (Phantom or Backpack) set to **devnet**.
- Never commit private keys / keypair files.
