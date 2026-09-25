/**
 * Devnet integration demo for the escrow program: runs a real make -> take
 * cycle on devnet using Exercise 3's actual SPL token as mint_a, so this
 * exercise genuinely chains off earlier course work instead of only ever
 * touching throwaway mints. (The Rust LiteSVM tests in
 * `../programs/escrow/tests` can't do this at all — LiteSVM starts from a
 * blank in-memory ledger with no access to real devnet accounts; this
 * script is what actually proves the program against Exercise 3's token.)
 *
 * mint_a = Exercise 3's token (week3-tokens/exercise3-spl-token/addresses.json)
 * mint_b = a fresh mint created here — Exercise 3 only produced one token,
 *          and a swap needs two sides.
 *
 *   npm install
 *   npm run demo
 */
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { AnchorProvider, BN, Program, Wallet } from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  clusterApiUrl,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createMint,
  getAccount,
  getAssociatedTokenAddressSync,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import idl from "./idl/escrow.json";
import type { Escrow } from "./idl/escrow";

const EXERCISE_3_ADDRESSES = path.join(
  __dirname,
  "..",
  "..",
  "week3-tokens",
  "exercise3-spl-token",
  "addresses.json",
);

function resolveRpcUrl(): string {
  if (process.env.RPC_URL) return process.env.RPC_URL;
  try {
    const config = fs.readFileSync(
      path.join(os.homedir(), ".config", "solana", "cli", "config.yml"),
      "utf8",
    );
    const match = config.match(/^json_rpc_url:\s*"?([^"\n]+)"?\s*$/m);
    if (match) return match[1].trim();
  } catch {
    // fall through to the default below
  }
  return clusterApiUrl("devnet");
}

function loadKeypair(p: string): Keypair {
  return Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync(p, "utf8"))));
}

async function main() {
  if (!fs.existsSync(EXERCISE_3_ADDRESSES)) {
    throw new Error(
      `${EXERCISE_3_ADDRESSES} not found — run week3-tokens/exercise3-spl-token/run.sh first.`,
    );
  }
  const { mint: mintAStr } = JSON.parse(fs.readFileSync(EXERCISE_3_ADDRESSES, "utf8"));
  const mintA = new PublicKey(mintAStr);

  const connection = new Connection(resolveRpcUrl(), "confirmed");
  const maker = loadKeypair(path.join(os.homedir(), ".config", "solana", "id.json"));
  const provider = new AnchorProvider(connection, new Wallet(maker), { commitment: "confirmed" });
  const program = new Program(idl as never, provider) as unknown as Program<Escrow>;

  console.log(`mint_a (Exercise 3's real token): ${mintA.toBase58()}`);
  const makerAtaA = getAssociatedTokenAddressSync(mintA, maker.publicKey);
  const makerBalanceBefore = await getAccount(connection, makerAtaA);
  console.log(`  maker's balance before: ${makerBalanceBefore.amount}`);

  // A fresh taker wallet, funded from the maker directly — avoids devnet
  // airdrop rate limits.
  const taker = Keypair.generate();
  console.log(`\ntaker (fresh wallet for this demo): ${taker.publicKey.toBase58()}`);
  await sendAndConfirmTransaction(
    connection,
    new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: maker.publicKey,
        toPubkey: taker.publicKey,
        lamports: 0.05 * 1e9,
      }),
    ),
    [maker],
  );

  console.log("\ncreating mint_b (fresh — this exercise's other token)...");
  const mintB = await createMint(connection, maker, maker.publicKey, null, 6);
  console.log(`  mint_b: ${mintB.toBase58()}`);

  const takerAtaB = await getOrCreateAssociatedTokenAccount(connection, maker, mintB, taker.publicKey);
  await mintTo(connection, maker, mintB, takerAtaB.address, maker, 1_000_000_000); // 1,000.000000

  const seed = new BN(Date.now());
  const deposit = new BN(10_000_000_000); // 10 of mint_a (9 decimals)
  const receive = new BN(250_000_000); // 250 of mint_b (6 decimals)

  const [escrowPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("escrow"), maker.publicKey.toBuffer(), seed.toArrayLike(Buffer, "le", 8)],
    program.programId,
  );
  const vault = getAssociatedTokenAddressSync(mintA, escrowPda, true);

  console.log("\nmake: locking 10 of Exercise 3's mint_a, asking 250 of mint_b...");
  await program.methods
    .make(seed, deposit, receive)
    // `as any`: Anchor's generated account types only expose the accounts
    // it can't auto-derive as PDAs; passing every account explicitly
    // (rather than trusting its own PDA inference) keeps this script using
    // the exact same escrow/vault addresses derived above.
    .accounts({
      maker: maker.publicKey,
      mintA,
      mintB,
      makerAtaA,
      escrow: escrowPda,
      vault,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    } as never)
    .signers([maker])
    .rpc();
  console.log("  make landed.");

  const takerAtaA = getAssociatedTokenAddressSync(mintA, taker.publicKey);
  const makerAtaB = getAssociatedTokenAddressSync(mintB, maker.publicKey);

  console.log("\ntake: taker pays 250 of mint_b, receives 10 of Exercise 3's mint_a...");
  await program.methods
    .take()
    .accounts({
      taker: taker.publicKey,
      maker: maker.publicKey,
      mintA,
      mintB,
      takerAtaB: takerAtaB.address,
      takerAtaA,
      makerAtaB,
      escrow: escrowPda,
      vault,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    } as never)
    .signers([taker])
    .rpc();
  console.log("  take landed.");

  const makerBalanceAfter = await getAccount(connection, makerAtaA);
  const takerAtaAAfter = await getAccount(connection, takerAtaA);
  const makerAtaBAfter = await getAccount(connection, makerAtaB);

  console.log("\nResult:");
  console.log(
    `  maker mint_a (Exercise 3's token): ${makerBalanceBefore.amount} -> ${makerBalanceAfter.amount}`,
  );
  console.log(`  taker mint_a (received from the vault): 0 -> ${takerAtaAAfter.amount}`);
  console.log(`  maker mint_b (paid by the taker): 0 -> ${makerAtaBAfter.amount}`);
  console.log(`\nmint_a explorer: https://explorer.solana.com/address/${mintA.toBase58()}?cluster=devnet`);
  console.log(`escrow PDA (now closed): ${escrowPda.toBase58()}`);
}

main().catch((err) => {
  console.error("devnet-demo failed:", err);
  process.exit(1);
});
