# NFT Collection — Umi + Metaplex Token Metadata

Week 5, Exercise 10: mint a collection NFT and three member NFTs, then
verify the members against the collection on-chain — the same
mint → link → verify flow every NFT collection on Solana uses.

## Concepts

- **Collection NFT** — just an NFT like any other; `isCollection: true` (via
  `createNft`) gives it a `CollectionDetails` so it can parent members.
- **Membership** — a member NFT's metadata carries
  `collection: { key: <collectionMint>, verified: false }`. That alone
  proves nothing (anyone can point at anyone else's collection); a
  **verify** instruction, signed by the collection's update authority,
  flips `verified` to `true`. That flag is what marketplaces, wallets, and
  `fetchAllDigitalAssetByVerifiedCollection` actually trust.
- **Metadata hosting** — the on-chain `uri` field just points at a JSON
  document; the image and attributes a wallet shows all live in that JSON,
  fetched separately. `create-collection.ts`/`mint-members.ts` upload that
  JSON (and a small generated image) to Arweave via Irys's devnet bundler —
  the standard Metaplex/Umi asset pipeline — so the URI is real, public,
  and permanent (see the gotchas below for why a self-hosted `data:` URI
  doesn't work here).

## Scripts

```bash
npm install
npm run create-collection        # mint the collection NFT -> collection.json
npm run mint-members              # mint 3 members (default), verify each -> members.json
npm run mint-members -- 5         # mint 5 instead
npm run read-collection           # read the collection + each member back: name, image, attributes, verified
```

## Three real gaps this hit (worth knowing — not obvious from the docs)

**1. The on-chain `uri` field can't hold a self-contained `data:` URI.**
The first version of this exercise built metadata as a `data:application/json;base64,...`
URI with an embedded SVG image, entirely self-hosted. It doesn't fit:
Metaplex's on-chain URI field caps at ~200 bytes, and a bare-minimum
embedded image blows past that once wrapped in JSON and base64 — confirmed
by an actual `"too large"` transaction-size error, not guessed. Fixed by
switching to `@metaplex-foundation/umi-uploader-irys`: upload the image and
the JSON to Arweave via Irys's devnet bundler, and put the short
`https://gateway.irys.xyz/...` URL it returns on-chain instead.

**2. `verifyCollectionV1` doesn't work here.** The modern generic `Verify`
instruction (`verifyCollectionV1`, SDK 3.4.0) reproducibly fails with
`Incorrect account owner` against devnet's currently deployed Token
Metadata program — even though every account it builds resolves correctly
(confirmed by dumping the instruction's account list and independently
checking each account's owner on-chain). The older, sized-collection-
specific `verifySizedCollectionItem` verifies the exact same NFT/collection
pair cleanly. It also requires the collection to use `CollectionDetails::V1`
specifically — `isCollection: true` alone defaults to `V2`, which
`verifySizedCollectionItem` doesn't recognize (same "Incorrect account
owner" symptom). `create-collection.ts` pins `collectionDetails` to V1
explicitly for this reason.

**3. Back-to-back devnet transactions can trip a false-negative preflight
check.** Calling `verifySizedCollectionItem` immediately after `createNft`
would sometimes fail *simulation* with the same "Incorrect account owner"
on an account that was, moments later, provably correct on-chain — the
preflight simulate() reads from an RPC snapshot a beat behind the
transaction just confirmed on the same connection. `mint-members.ts` passes
`skipPreflight: true` on the verify call so real execution (which sees
current state) is what decides the outcome.

**4. `fetchAllDigitalAssetByVerifiedCollection` needs a paid RPC tier.** It
runs a `getProgramAccounts` scan, which Helius's free tier flatly rejects
("Too many accounts requested"). `read-collection.ts` instead fetches the
exact mints saved by `mint-members.ts` (`fetchAllDigitalAsset`) — no scan
needed since we already know the addresses.

## This run (devnet)

```
Collection: Solana Dev Course Collection (SDC)
  isCollection (has CollectionDetails): true
  - Solana Dev Course Collection  mint=6XC51UqGBQ7UcvdxJ8v3Gx99s3EGmja9A9usXXBfRXVW
      image: https://gateway.irys.xyz/2AGteHoUwLWpLvke2KnSea5ju...
      attributes: [{"trait_type":"Type","value":"Collection"}]

Members: 3
  - SDC Member #1  mint=HCqJByFcwJ5CVg8DKzXmUwRKMz7LbcUzQMe529582eXg  verified=true
  - SDC Member #2  mint=MaFsBpQBTiHBQcaFfUMVACpVUc4zDYJZK5GAuE4DkE9  verified=true
  - SDC Member #3  mint=6Cgk4ASM8qPAELspjNeSKavrY27gAygYriRXqU646RTf  verified=true
```

[View the collection on Solana Explorer](https://explorer.solana.com/address/6XC51UqGBQ7UcvdxJ8v3Gx99s3EGmja9A9usXXBfRXVW?cluster=devnet)

## Wallet / RPC

Scripts sign with the same CLI wallet the rest of the course uses
(`~/.config/solana/id.json`) and default to whatever RPC `solana config get`
already points at (falling back to the public devnet endpoint), so no
separate setup is needed — override with the `RPC_URL` env var if you want
a different endpoint.
