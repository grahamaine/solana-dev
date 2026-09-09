import { NextResponse } from "next/server";

/**
 * Server-side proxy for Magic Eden's public collection-stats API.
 *
 * Why this exists: Magic Eden's API has no Access-Control-Allow-Origin
 * header, so browsers block a direct client-side fetch. Routing it through
 * our own Next.js API route (a same-origin server request, not subject to
 * CORS) is the standard fix.
 *
 * Note: this reports real MAINNET floor prices for well-known collections —
 * it has no relationship to the devnet NFTs this app's marketplace program
 * actually trades. There is no real secondary market for devnet test NFTs.
 * This panel exists purely as a "live market" reference alongside the
 * devnet listings/auctions above it.
 */

const COLLECTIONS = [
  { symbol: "okay_bears", name: "Okay Bears" },
  { symbol: "degods", name: "DeGods" },
  { symbol: "solana_monkey_business", name: "SMB" },
  { symbol: "y00ts", name: "y00ts" },
] as const;

export type MarketCollection = {
  symbol: string;
  name: string;
  floorPriceLamports: number | null;
  listedCount: number | null;
};

export async function GET() {
  const collections: MarketCollection[] = await Promise.all(
    COLLECTIONS.map(async ({ symbol, name }) => {
      try {
        const res = await fetch(
          `https://api-mainnet.magiceden.dev/v2/collections/${symbol}/stats`,
          { next: { revalidate: 60 } }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { floorPrice?: number; listedCount?: number };
        return {
          symbol,
          name,
          floorPriceLamports: data.floorPrice ?? null,
          listedCount: data.listedCount ?? null,
        };
      } catch {
        return { symbol, name, floorPriceLamports: null, listedCount: null };
      }
    })
  );

  return NextResponse.json({ collections, fetchedAt: Date.now() });
}
