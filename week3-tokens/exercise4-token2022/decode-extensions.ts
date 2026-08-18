/**
 * Exercise 4 — decode Token-2022 extension data from the mint account, in TS.
 *
 * The CLI (run.sh) created a Token-2022 mint with a transfer-fee extension and
 * on-chain metadata, then did a fee-bearing transfer. This script re-reads the
 * raw mint account and unpacks each extension by hand with @solana/spl-token.
 *
 *   npm run ex4:decode
 */
import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";
import {
  getMint,
  getAccount,
  getAssociatedTokenAddress,
  getTransferFeeConfig,
  getTransferFeeAmount,
  getMetadataPointerState,
  getTokenMetadata,
  getExtensionTypes,
  ExtensionType,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";

const addresses = JSON.parse(
  fs.readFileSync(path.join(__dirname, "addresses.json"), "utf8")
) as { mint: string; recipientWallet: string };

const ui = (raw: bigint, decimals: number) =>
  (Number(raw) / 10 ** decimals).toLocaleString();

async function main() {
  const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
  const mint = new PublicKey(addresses.mint);
  const recipient = new PublicKey(addresses.recipientWallet);

  // Read the raw mint account under the Token-2022 program.
  const mintInfo = await getMint(connection, mint, "confirmed", TOKEN_2022_PROGRAM_ID);
  console.log("── Mint", mint.toBase58(), "──");
  console.log("  decimals :", mintInfo.decimals);
  console.log("  supply   :", ui(mintInfo.supply, mintInfo.decimals));

  // Which extensions are present? Decode the TLV type list on the mint.
  const types = getExtensionTypes(mintInfo.tlvData).map((t) => ExtensionType[t]);
  console.log("  extensions:", types.join(", "));

  // 1. Transfer-fee extension.
  const feeConfig = getTransferFeeConfig(mintInfo);
  if (feeConfig) {
    const f = feeConfig.newerTransferFee;
    console.log("── TransferFeeConfig ──");
    console.log("  basis points :", f.transferFeeBasisPoints, `(${f.transferFeeBasisPoints / 100}%)`);
    console.log("  maximum fee  :", ui(f.maximumFee, mintInfo.decimals));
    console.log("  withheld @mint:", ui(feeConfig.withheldAmount, mintInfo.decimals));
  }

  // 2. Metadata pointer + metadata content.
  const ptr = getMetadataPointerState(mintInfo);
  if (ptr) {
    console.log("── MetadataPointer ──");
    console.log("  points to :", ptr.metadataAddress?.toBase58());
  }
  const meta = await getTokenMetadata(connection, mint, "confirmed", TOKEN_2022_PROGRAM_ID);
  if (meta) {
    console.log("── TokenMetadata ──");
    console.log("  name   :", meta.name);
    console.log("  symbol :", meta.symbol);
    console.log("  uri    :", meta.uri);
  }

  // 3. Where did the withheld fee go? It sits on the RECIPIENT's token account
  //    until it is harvested back to the mint.
  const recipientAta = await getAssociatedTokenAddress(mint, recipient, false, TOKEN_2022_PROGRAM_ID);
  const recipientAcct = await getAccount(connection, recipientAta, "confirmed", TOKEN_2022_PROGRAM_ID);
  const withheldOnAccount = getTransferFeeAmount(recipientAcct);
  console.log("── Fee withheld on recipient account ──");
  console.log("  account  :", recipientAta.toBase58());
  console.log("  balance  :", ui(recipientAcct.amount, mintInfo.decimals));
  console.log("  withheld :", withheldOnAccount ? ui(withheldOnAccount.withheldAmount, mintInfo.decimals) : "0");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
