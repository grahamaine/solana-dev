"use client";

import { useEffect, useState } from "react";
import { Card, Spinner } from "@/components/ui";
import type { MarketCollection } from "@/app/api/market/route";

const LAMPORTS_PER_SOL = 1_000_000_000;

/**
 * Live floor-price reference panel. Pulls real mainnet data (via our own
 * /api/market proxy, since Magic Eden's API blocks direct browser CORS
 * requests) for a handful of well-known Solana NFT collections.
 *
 * This is explicitly NOT the floor price of anything traded by this app's
 * devnet marketplace program — devnet test NFTs have no real secondary
 * market. It's shown as a separate "live market" reference, clearly
 * labeled, rather than implied to be connected to the listings above it.
 */
export function MarketPanel() {
  const [collections, setCollections] = useState<MarketCollection[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetch("/api/market");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { collections: MarketCollection[] };
        if (active) setCollections(data.collections);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : String(e));
      }
    };
    load();
    const id = setInterval(load, 60_000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold tracking-tight">Live Solana NFT market</h2>
        <span className="rounded-full bg-white/[.06] px-2 py-0.5 text-xs text-zinc-500 ring-1 ring-inset ring-white/10">
          mainnet reference
        </span>
      </div>
      <p className="text-xs text-zinc-500">
        Real floor prices from Magic Eden, for context only — devnet test
        NFTs have no real secondary market of their own.
      </p>

      {error && <p className="text-sm text-red-300">{error}</p>}

      {!collections && !error ? (
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Spinner /> Loading market data…
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {collections?.map((c) => (
            <div
              key={c.symbol}
              className="rounded-xl border border-white/[.07] bg-white/[.02] p-3"
            >
              <p className="truncate text-xs text-zinc-500">{c.name}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-gradient">
                {c.floorPriceLamports !== null
                  ? `${(c.floorPriceLamports / LAMPORTS_PER_SOL).toFixed(2)} SOL`
                  : "—"}
              </p>
              {c.listedCount !== null && (
                <p className="text-xs text-zinc-500">{c.listedCount} listed</p>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
