/**
 * Exercise 3 — read the SPL token flow back from the chain, in TypeScript.
 *
 * The CLI (see run.sh) already created the mint, minted 1000, and transferred
 * 100 to a second wallet. This script proves we can read that same state with
 * @solana/web3.js + @solana/spl-token instead of the CLI.
 *
 *   npm run ex3:balances
 */
import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";
import {
  getMint,
  getAssociatedTokenAddress,
  getAccount,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";

const addresses = JSON.parse(
  fs.readFileSync(path.join(__dirname, "addresses.json"), "utf8")
) as { mint: string; senderAta: string; recipientWallet: string };

function uiAmount(raw: bigint, decimals: number): string {
  return (Number(raw) / 10 ** decimals).toLocaleString();
}

async function main() {
  const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
  const mint = new PublicKey(addresses.mint);
  const senderAta = new PublicKey(addresses.senderAta);
  const recipient = new PublicKey(addresses.recipientWallet);

  // 1. Mint account: supply + decimals + authorities.
  const mintInfo = await getMint(connection, mint, "confirmed", TOKEN_PROGRAM_ID);
  console.log("── Mint ───────────────────────────────────────────");
  console.log("  address        :", mint.toBase58());
  console.log("  decimals       :", mintInfo.decimals);
  console.log("  supply         :", uiAmount(mintInfo.supply, mintInfo.decimals));
  console.log("  mintAuthority  :", mintInfo.mintAuthority?.toBase58() ?? "none");

  // 2. Read the sender ATA (stored) and derive the recipient ATA from its wallet.
  const recipientAta = await getAssociatedTokenAddress(mint, recipient);

  const senderAcct = await getAccount(connection, senderAta, "confirmed", TOKEN_PROGRAM_ID);
  const recipientAcct = await getAccount(connection, recipientAta, "confirmed", TOKEN_PROGRAM_ID);

  console.log("── Token accounts ─────────────────────────────────");
  console.log("  sender    ", senderAta.toBase58(), "=>", uiAmount(senderAcct.amount, mintInfo.decimals));
  console.log("  recipient ", recipientAta.toBase58(), "=>", uiAmount(recipientAcct.amount, mintInfo.decimals));

  const total = senderAcct.amount + recipientAcct.amount;
  console.log("── Check ──────────────────────────────────────────");
  console.log("  sender + recipient :", uiAmount(total, mintInfo.decimals));
  console.log("  equals supply?     :", total === mintInfo.supply ? "yes ✅" : "no ❌");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
