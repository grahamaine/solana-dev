#!/usr/bin/env bash
# Exercise 4 — Token-2022 Extensions on devnet.
# Creates a Token-2022 mint carrying a transfer-fee extension AND on-chain
# metadata, mints, then does a fee-bearing transfer so the fee is observable.
# decode-extensions.ts then unpacks each extension from the raw mint account.
# Re-runnable:  bash run.sh
set -euo pipefail
cd "$(dirname "$0")"

# 1. Create a Token-2022 mint with two extensions:
#      --transfer-fee <bps> <max_fee_base_units>  -> 500 bps = 5%, cap 100 tokens
#      --enable-metadata                           -> metadata pointer + metadata
spl-token create-token \
  --program-2022 \
  --decimals 6 \
  --transfer-fee 500 100000000 \
  --enable-metadata \
  --output json > mint.json
MINT=$(python3 -c 'import json;print(json.load(open("mint.json"))["commandOutput"]["address"])')
echo "mint = $MINT"

# 2. Write the on-chain metadata content (name / symbol / uri).
spl-token initialize-metadata "$MINT" "Week3 Extended Token" "W3X" \
  "https://example.com/w3x.json"

# 3. Create our account and mint 1000.
spl-token create-account "$MINT"
spl-token mint "$MINT" 1000

# 4. Recipient wallet + transfer 200. With a 5% fee, 10 tokens are withheld,
#    so the recipient nets 190. The withheld fee sits on the recipient's
#    token account until the withdraw authority harvests it back to the mint.
solana-keygen new --no-bip39-passphrase --silent --outfile recipient.json --force
RECIP=$(solana address -k recipient.json)
echo "recipient = $RECIP"
spl-token transfer --fund-recipient --allow-unfunded-recipient "$MINT" 200 "$RECIP"

# 5. Balances + full extension dump from the CLI.
echo "sender    balance: $(spl-token balance "$MINT")"
echo "recipient balance: $(spl-token balance "$MINT" --owner "$RECIP")"
spl-token display "$MINT"

python3 - "$MINT" "$RECIP" <<'PY'
import json,sys
mint,recip=sys.argv[1:3]
json.dump({"mint":mint,"recipientWallet":recip},
          open("addresses.json","w"),indent=2)
print("wrote addresses.json")
PY
