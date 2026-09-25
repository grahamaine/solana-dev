/**
 * Shared Umi setup: devnet RPC + the same local CLI wallet used throughout
 * the course (`~/.config/solana/id.json`), wrapped as an Umi signer so
 * every script in this exercise signs and pays as that wallet.
 */
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { mplTokenMetadata } from "@metaplex-foundation/mpl-token-metadata";
import { irysUploader } from "@metaplex-foundation/umi-uploader-irys";
import { createSignerFromKeypair, signerIdentity, Umi } from "@metaplex-foundation/umi";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

/**
 * The public devnet RPC load-balances across many nodes with inconsistent
 * state, which can make a transaction confirmed by one node invisible to
 * the next simulate() a moment later (exactly the flakiness that breaks a
 * create-then-verify sequence). Reuse whatever endpoint `solana config get`
 * already points at — set up once for the whole course — instead of
 * hardcoding the public one.
 */
function resolveRpcUrl(): string {
  if (process.env.RPC_URL) return process.env.RPC_URL;

  const configPath = path.join(os.homedir(), ".config", "solana", "cli", "config.yml");
  try {
    const config = fs.readFileSync(configPath, "utf8");
    const match = config.match(/^json_rpc_url:\s*"?([^"\n]+)"?\s*$/m);
    if (match) return match[1].trim();
  } catch {
    // fall through to the default below
  }
  return "https://api.devnet.solana.com";
}

const RPC_URL = resolveRpcUrl();

export function createUmiWithWallet(): Umi {
  const umi = createUmi(RPC_URL)
    .use(mplTokenMetadata())
    .use(irysUploader({ address: "https://devnet.irys.xyz" }));

  const keypairPath = path.join(os.homedir(), ".config", "solana", "id.json");
  const secretKey = new Uint8Array(JSON.parse(fs.readFileSync(keypairPath, "utf8")));
  const keypair = umi.eddsa.createKeypairFromSecretKey(secretKey);
  const signer = createSignerFromKeypair(umi, keypair);

  return umi.use(signerIdentity(signer));
}
