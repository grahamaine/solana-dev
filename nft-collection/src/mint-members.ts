/**
 * Week 5 — NFT exercise, step 2: mint member NFTs into the collection and
 * verify each one on-chain.
 *
 * `createNft` sets `collection: { key, verified: false }` on the member's
 * metadata — that alone doesn't prove membership, since anyone could point
 * at someone else's collection. `verifySizedCollectionItem`, signed by the
 * collection's update authority, flips `verified` to true; that's the flag
 * marketplaces and `fetchAllDigitalAssetByVerifiedCollection` trust.
 *
 * Note: this uses `verifySizedCollectionItem`, not the newer generic
 * `verifyCollectionV1`. `verifyCollectionV1` (SDK 3.4.0) reproducibly fails
 * with "Incorrect account owner" against our collection on devnet's
 * currently deployed Token Metadata program, even though every account it
 * builds resolves correctly (checked by dumping the instruction's account
 * list and independently confirming each account on-chain).
 * `verifySizedCollectionItem` is the older, sized-collection-specific
 * instruction, and it only accepts a `CollectionDetails::V1` collection
 * (see create-collection.ts) — with both of those, it verifies cleanly.
 *
 * The verify call also passes `skipPreflight: true`. Without it, the very
 * next instruction after a `createNft` sometimes fails its *preflight*
 * simulation with the same "Incorrect account owner" — the simulation
 * reads from an RPC snapshot that's a beat behind the transaction that was
 * just confirmed on the same connection. Real execution sees current state
 * and succeeds, so skipping the (redundant) simulate avoids the false
 * negative.
 *
 *   npm run mint-members            # mints 3 members (default)
 *   npm run mint-members -- 5       # mints 5 members
 */
import { generateSigner, percentAmount, publicKey as toPublicKey, some } from "@metaplex-foundation/umi";
import {
  createNft,
  findMasterEditionPda,
  findMetadataPda,
  verifySizedCollectionItem,
} from "@metaplex-foundation/mpl-token-metadata";
import * as fs from "fs";
import * as path from "path";
import { uploadMetadata } from "./metadata";
import { createUmiWithWallet } from "./umi";

const COLLECTION_FILE = path.join(__dirname, "..", "collection.json");
const MEMBERS_FILE = path.join(__dirname, "..", "members.json");

async function main() {
  if (!fs.existsSync(COLLECTION_FILE)) {
    throw new Error(`${COLLECTION_FILE} not found — run "npm run create-collection" first.`);
  }
  const { collectionMint } = JSON.parse(fs.readFileSync(COLLECTION_FILE, "utf8"));
  const collectionMintPk = toPublicKey(collectionMint);

  const count = Number(process.argv[2] ?? 3);
  const umi = createUmiWithWallet();
  const members: string[] = [];

  for (let i = 1; i <= count; i++) {
    const nftMint = generateSigner(umi);

    console.log(`Minting member #${i}, mint ${nftMint.publicKey}...`);
    console.log(`  uploading metadata to Arweave via Irys (devnet)...`);

    const uri = await uploadMetadata(umi, {
      name: `SDC Member #${i}`,
      description: `Week 5 exercise 10 — member #${i} of the Solana Dev Course Collection.`,
      label: `#${i}`,
      color: "#0ea5e9",
      attributes: [
        { trait_type: "Type", value: "Member" },
        { trait_type: "Edition", value: String(i) },
      ],
    });

    await createNft(umi, {
      mint: nftMint,
      name: `SDC Member #${i}`,
      symbol: "SDC",
      uri,
      sellerFeeBasisPoints: percentAmount(5),
      collection: some({ key: collectionMintPk, verified: false }),
    }).sendAndConfirm(umi);

    await verifySizedCollectionItem(umi, {
      metadata: findMetadataPda(umi, { mint: nftMint.publicKey }),
      collectionAuthority: umi.identity,
      collectionMint: collectionMintPk,
      collection: findMetadataPda(umi, { mint: collectionMintPk }),
      collectionMasterEditionAccount: findMasterEditionPda(umi, { mint: collectionMintPk }),
    }).sendAndConfirm(umi, { send: { skipPreflight: true } });

    console.log(`Member #${i} minted + verified: ${nftMint.publicKey}`);
    members.push(nftMint.publicKey.toString());
  }

  fs.writeFileSync(MEMBERS_FILE, JSON.stringify(members, null, 2));
  console.log(`\nSaved ${members.length} member mints to ${MEMBERS_FILE}.`);
}

main().catch((err) => {
  console.error("mint-members failed:", err.message ?? err);
  process.exit(1);
});
