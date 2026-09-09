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
  { symbol: "mad_lads", name: "Mad Lads" },
  { symbol: "claynosaurz", name: "Claynosaurz" },
  { symbol: "famous_fox_federation", name: "Famous Fox Federation" },
  { symbol: "the_heist_by_dreadfulz", name: "The Heist" },
  { symbol: "retardio_cousins", name: "Retardio Cousins" },
  { symbol: "galactic_geckos", name: "Galactic Geckos" },
  { symbol: "taiyo_robotics", name: "Taiyo Robotics" },
  { symbol: "smyths", name: "Smyths" },
] as const;

export type MarketCollection = {
  symbol: string;
  name: string;
  image: string | null;
  floorPriceLamports: number | null;
  listedCount: number | null;
  volume7dLamports: number | null;
};

async function fetchOne({ symbol, name }: (typeof COLLECTIONS)[number]): Promise<MarketCollection> {
  try {
    const [statsRes, infoRes] = await Promise.all([
      fetch(`https://api-mainnet.magiceden.dev/v2/collections/${symbol}/stats`, {
        next: { revalidate: 60 },
      }),
      fetch(`https://api-mainnet.magiceden.dev/v2/collections/${symbol}`, {
        next: { revalidate: 300 },
      }),
    ]);

    const stats = statsRes.ok
      ? ((await statsRes.json()) as { floorPrice?: number; listedCount?: number; volume7d?: number })
      : null;
    const info = infoRes.ok ? ((await infoRes.json()) as { image?: string }) : null;

    return {
      symbol,
      name,
      image: info?.image ?? null,
      floorPriceLamports: stats?.floorPrice ?? null,
      listedCount: stats?.listedCount ?? null,
      volume7dLamports: stats?.volume7d ?? null,
    };
  } catch {
    return { symbol, name, image: null, floorPriceLamports: null, listedCount: null, volume7dLamports: null };
  }
}

export async function GET() {
  const collections = await Promise.all(COLLECTIONS.map(fetchOne));
  return NextResponse.json({ collections, fetchedAt: Date.now() });
}
