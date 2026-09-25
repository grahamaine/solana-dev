/**
 * Week 5 — NFT exercise, step 3: read the collection and its members straight
 * off-chain, the same way a marketplace or wallet would — printing each
 * item's name, image, and attributes (fetched from its metadata URI), and
 * confirming each member's `collection.verified` flag actually flipped to
 * true.
 *
 * This fetches the specific mints saved by mint-members.ts rather than
 * scanning the Token Metadata program for every account pointing at this
 * collection (`fetchAllDigitalAssetByVerifiedCollection`): that scan is a
 * `getProgramAccounts` call, and Helius's free-tier RPC rejects it outright
 * ("Too many accounts requested"). Fetching known mints one call
 * (`fetchAllDigitalAsset`) sidesteps that limit entirely.
 *
 *   npm run read-collection
 */
import { fetchAllDigitalAsset, fetchDigitalAsset } from "@metaplex-foundation/mpl-token-metadata";
import { publicKey as toPublicKey } from "@metaplex-foundation/umi";
import * as fs from "fs";
import * as path from "path";
import { createUmiWithWallet } from "./umi";

const COLLECTION_FILE = path.join(__dirname, "..", "collection.json");
const MEMBERS_FILE = path.join(__dirname, "..", "members.json");

interface OffchainMetadata {
  image?: string;
  attributes?: Array<{ trait_type: string; value: string }>;
}

/** The `uri` field works the same whether it's `https://...` or, as here,
 * a self-contained `data:application/json` URI — `fetch` resolves both. */
async function fetchOffchainMetadata(uri: string): Promise<OffchainMetadata> {
  const res = await fetch(uri);
  return res.json();
}

function printItem(name: string, mint: string, meta: OffchainMetadata, extra?: string) {
  console.log(`  - ${name}  mint=${mint}${extra ? `  ${extra}` : ""}`);
  console.log(`      image: ${meta.image?.slice(0, 50)}${meta.image && meta.image.length > 50 ? "..." : ""}`);
  console.log(`      attributes: ${JSON.stringify(meta.attributes)}`);
}

async function main() {
  if (!fs.existsSync(COLLECTION_FILE)) {
    throw new Error(`${COLLECTION_FILE} not found — run "npm run create-collection" first.`);
  }
  const { collectionMint } = JSON.parse(fs.readFileSync(COLLECTION_FILE, "utf8"));
  const collectionMintPk = toPublicKey(collectionMint);

  const umi = createUmiWithWallet();

  const collection = await fetchDigitalAsset(umi, collectionMintPk);
  const isSizedCollection = collection.metadata.collectionDetails.__option === "Some";
  console.log(`Collection: ${collection.metadata.name} (${collection.metadata.symbol})`);
  console.log(`  isCollection (has CollectionDetails): ${isSizedCollection}`);
  printItem(collection.metadata.name, collectionMintPk.toString(), await fetchOffchainMetadata(collection.metadata.uri));

  if (!fs.existsSync(MEMBERS_FILE)) {
    console.log('\nNo members.json found — run "npm run mint-members" to mint some.');
    return;
  }
  const memberMints: string[] = JSON.parse(fs.readFileSync(MEMBERS_FILE, "utf8"));
  const members = await fetchAllDigitalAsset(umi, memberMints.map((mint) => toPublicKey(mint)));

  console.log(`\nMembers: ${members.length}`);
  for (const member of members) {
    const collectionField = member.metadata.collection;
    const verified =
      collectionField.__option === "Some" &&
      collectionField.value.key.toString() === collectionMintPk.toString() &&
      collectionField.value.verified;
    const meta = await fetchOffchainMetadata(member.metadata.uri);
    printItem(member.metadata.name, member.publicKey.toString(), meta, `verified=${verified}`);
  }
}

main().catch((err) => {
  console.error("read-collection failed:", err.message ?? err);
  process.exit(1);
});
