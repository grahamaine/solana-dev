import { NextResponse } from "next/server";
import { COLLECTIONS } from "@/lib/collections";

/**
 * Server-side proxy for Magic Eden's public per-listing API (same CORS
 * workaround as /api/market — see that route for details).
 *
 * Unlike /api/market (aggregate floor/volume stats), this returns actual
 * individual NFTs currently listed for sale on mainnet: real mint, name,
 * image, and price. It exists to make the marketplace page feel populated
 * with real activity while this program's own devnet listings are empty —
 * these are NOT listings on this program and can't be bought through it;
 * each card links out to Magic Eden itself.
 */

export type LiveListing = {
  mint: string;
  name: string;
  image: string | null;
  priceSol: number;
  collectionSymbol: string;
  collectionName: string;
};

type MeListing = {
  tokenMint: string;
  price: number;
  extra?: { img?: string };
  token?: { name?: string; image?: string };
};

async function fetchListings(
  { symbol, name }: (typeof COLLECTIONS)[number],
  limit = 3
): Promise<LiveListing[]> {
  try {
    const res = await fetch(
      `https://api-mainnet.magiceden.dev/v2/collections/${symbol}/listings?offset=0&limit=${limit}`,
      { next: { revalidate: 60 } }
    );
    if (!res.ok) return [];
    const data = (await res.json()) as MeListing[];
    return data.map((l) => ({
      mint: l.tokenMint,
      name: l.token?.name ?? name,
      image: l.token?.image ?? l.extra?.img ?? null,
      priceSol: l.price,
      collectionSymbol: symbol,
      collectionName: name,
    }));
  } catch {
    return [];
  }
}

export async function GET() {
  const results = await Promise.all(COLLECTIONS.map((c) => fetchListings(c)));
  const listings = results.flat();
  return NextResponse.json({ listings, fetchedAt: Date.now() });
}
