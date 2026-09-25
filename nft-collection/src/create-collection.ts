/**
 * Week 5 — NFT exercise, step 1: create the sized collection NFT.
 *
 * A "collection" on Metaplex Token Metadata is just an NFT like any other
 * (`isCollection: true` sets its CollectionDetails so it can parent
 * members); member NFTs point back at its mint and get verified against it
 * in `mint-members.ts`.
 *
 * `isCollection: true` alone defaults to `CollectionDetails::V2`. That
 * round-trips fine through `createNft` and `fetchDigitalAsset`, but
 * `verifySizedCollectionItem` (what `mint-members.ts` uses — see its
 * comment) fails with "Incorrect account owner" against a V2 collection on
 * devnet's currently deployed Token Metadata program; it only recognizes
 * the older V1 layout. So this pins `collectionDetails` to V1 explicitly.
 *
 *   npm run create-collection
 */
import { generateSigner, percentAmount, some } from "@metaplex-foundation/umi";
import { collectionDetails, createNft } from "@metaplex-foundation/mpl-token-metadata";
import * as fs from "fs";
import * as path from "path";
import { uploadMetadata } from "./metadata";
import { createUmiWithWallet } from "./umi";

const OUT_FILE = path.join(__dirname, "..", "collection.json");

async function main() {
  const umi = createUmiWithWallet();
  const collectionMint = generateSigner(umi);

  console.log("Uploading collection metadata to Arweave via Irys (devnet)...");
  const uri = await uploadMetadata(umi, {
    name: "Solana Dev Course Collection",
    description: "Week 5 exercise 10 — collection NFT minted with Umi + Metaplex Token Metadata.",
    label: "SDC",
    color: "#7c3aed",
    attributes: [{ trait_type: "Type", value: "Collection" }],
  });
  console.log(`Metadata uploaded: ${uri}`);

  console.log(`Creating collection NFT, mint ${collectionMint.publicKey}...`);

  await createNft(umi, {
    mint: collectionMint,
    name: "Solana Dev Course Collection",
    symbol: "SDC",
    uri,
    sellerFeeBasisPoints: percentAmount(5),
    isCollection: true,
    collectionDetails: some(collectionDetails("V1", { size: 0 })),
  }).sendAndConfirm(umi);

  fs.writeFileSync(
    OUT_FILE,
    JSON.stringify({ collectionMint: collectionMint.publicKey.toString() }, null, 2),
  );

  console.log(`\nCollection created: ${collectionMint.publicKey}`);
  console.log(`Explorer: https://explorer.solana.com/address/${collectionMint.publicKey}?cluster=devnet`);
  console.log(`Saved to ${OUT_FILE} for mint-members.ts / read-collection.ts.`);
}

main().catch((err) => {
  console.error("create-collection failed:", err.message ?? err);
  process.exit(1);
});
