"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Card, Spinner } from "@/components/ui";
import type { MarketCollection } from "@/app/api/market/route";

const LAMPORTS_PER_SOL = 1_000_000_000;
const SLIDE_MS = 4500;

/**
 * Live "trending NFTs" slideshow. Pulls real mainnet data (via our own
 * /api/market proxy, since Magic Eden's API blocks direct browser CORS
 * requests) for a handful of well-known Solana NFT collections, sorted by
 * 7-day volume — highest-trading first.
 *
 * This is explicitly NOT the floor price of anything traded by this app's
 * devnet marketplace program — devnet test NFTs have no real secondary
 * market. It's shown as a separate "live market" reference, clearly
 * labeled, rather than implied to be connected to the listings above it.
 */
export function MarketPanel() {
  const [collections, setCollections] = useState<MarketCollection[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);

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

  const ranked = useMemo(
    () =>
      collections
        ? [...collections].sort((a, b) => (b.volume7dLamports ?? 0) - (a.volume7dLamports ?? 0))
        : null,
    [collections]
  );

  // Auto-advance the slideshow.
  useEffect(() => {
    if (!ranked || ranked.length < 2) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % ranked.length), SLIDE_MS);
    return () => clearInterval(id);
  }, [ranked]);

  const current = ranked?.[index % (ranked.length || 1)];

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold tracking-tight">Trending on Solana</h2>
        <span className="rounded-full bg-white/[.06] px-2 py-0.5 text-xs text-zinc-500 ring-1 ring-inset ring-white/10">
          mainnet reference
        </span>
      </div>
      <p className="text-xs text-zinc-500">
        Real floor prices &amp; volume from Magic Eden, ranked by 7-day
        trading volume — for context only. Devnet test NFTs have no real
        secondary market of their own.
      </p>

      {error && <p className="text-sm text-red-300">{error}</p>}

      {!ranked && !error ? (
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Spinner /> Loading market data…
        </div>
      ) : current ? (
        <>
          <div className="relative flex items-center gap-4 overflow-hidden rounded-xl border border-white/[.07] bg-white/[.02] p-4">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-white/[.04]">
              {current.image ? (
                <Image
                  key={current.symbol}
                  src={current.image}
                  alt={current.name}
                  fill
                  unoptimized
                  className="animate-splash-pop object-cover"
                />
              ) : (
                <div className="grid h-full place-items-center text-2xl text-zinc-600">◈</div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold tracking-tight">{current.name}</p>
              <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <span className="text-xl font-semibold tabular-nums text-gradient">
                  {current.floorPriceLamports !== null
                    ? `${(current.floorPriceLamports / LAMPORTS_PER_SOL).toFixed(2)} SOL`
                    : "—"}
                </span>
                <span className="text-xs text-zinc-500">floor</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-zinc-500">
                {current.listedCount !== null && <span>{current.listedCount} listed</span>}
                {current.volume7dLamports !== null && (
                  <span>{(current.volume7dLamports / LAMPORTS_PER_SOL).toFixed(0)} SOL · 7d vol</span>
                )}
              </div>
            </div>
          </div>

          {ranked && ranked.length > 1 && (
            <div className="flex items-center justify-center gap-1.5">
              {ranked.map((c, i) => (
                <button
                  key={c.symbol}
                  onClick={() => setIndex(i)}
                  aria-label={`Show ${c.name}`}
                  className={`h-1.5 rounded-full transition-all ${
                    i === index % ranked.length
                      ? "w-5 bg-brand-green"
                      : "w-1.5 bg-white/[.15] hover:bg-white/[.3]"
                  }`}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-zinc-500">No market data available right now.</p>
      )}
    </Card>
  );
}
