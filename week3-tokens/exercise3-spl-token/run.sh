#!/usr/bin/env bash
# Exercise 3 — Your First Token (classic SPL Token program) on devnet.
# Re-runnable: creates a fresh mint each time and writes addresses.json,
# which read-balances.ts then reads. Run from anywhere:  bash run.sh
set -euo pipefail
cd "$(dirname "$0")"

# 1. Create the SPL mint (Token program, 9 decimals default).
spl-token create-token --output json > mint.json
MINT=$(python3 -c 'import json;print(json.load(open("mint.json"))["commandOutput"]["address"])')
echo "mint = $MINT"

# 2. Create OUR associated token account (ATA) for that mint.
spl-token create-account "$MINT"
ATA=$(spl-token address --token "$MINT" --verbose --output json \
      | python3 -c 'import json,sys;print(json.load(sys.stdin)["associatedTokenAddress"])')
echo "ata  = $ATA"

# 3. Mint 1000 tokens into our account.
spl-token mint "$MINT" 1000

# 4. Make a second wallet and transfer 100 to it.
#    --fund-recipient pays rent for the new ATA; --allow-unfunded-recipient
#    lets us send to a wallet that holds no SOL yet.
solana-keygen new --no-bip39-passphrase --silent --outfile recipient.json --force
RECIP=$(solana address -k recipient.json)
echo "recipient = $RECIP"
spl-token transfer --fund-recipient --allow-unfunded-recipient "$MINT" 100 "$RECIP"

# 5. Read the balances back from the CLI (TS does the same in read-balances.ts).
echo "sender    balance: $(spl-token balance "$MINT")"
echo "recipient balance: $(spl-token balance "$MINT" --owner "$RECIP")"

# Persist the public addresses for the TypeScript reader.
python3 - "$MINT" "$ATA" "$RECIP" <<'PY'
import json,sys
mint,ata,recip=sys.argv[1:4]
json.dump({"mint":mint,"senderAta":ata,"recipientWallet":recip},
          open("addresses.json","w"),indent=2)
print("wrote addresses.json")
PY
