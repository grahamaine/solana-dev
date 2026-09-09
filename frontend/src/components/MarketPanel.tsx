"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Card, Spinner } from "@/components/ui";
import type { MarketCollection } from "@/app/api/market/route";

const LAMPORTS_PER_SOL = 1_000_000_000;
const SLIDE_MS = 5500;
const PER_SLIDE = 3;

/**
 * Live "trending NFTs" slideshow. Pulls real mainnet data (via our own
 * /api/market proxy, since Magic Eden's API blocks direct browser CORS
 * requests) for a curated set of well-known Solana NFT collections, sorted
 * by 7-day volume — highest-trading first — and pages through them a few
 * at a time.
 *
 * This is explicitly NOT the floor price of anything traded by this app's
 * devnet marketplace program — devnet test NFTs have no real secondary
 * market. It's shown as a separate "live market" reference, clearly
 * labeled, rather than implied to be connected to the listings above it.
 */
export function MarketPanel() {
  const [collections, setCollections] = useState<MarketCollection[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);

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

  // Only show collections we actually got real data for.
  const ranked = useMemo(
    () =>
      collections
        ?.filter((c) => c.floorPriceLamports !== null)
        .sort((a, b) => (b.volume7dLamports ?? 0) - (a.volume7dLamports ?? 0)) ?? null,
    [collections]
  );

  const pages = useMemo(() => {
    if (!ranked) return [];
    const chunks: MarketCollection[][] = [];
    for (let i = 0; i < ranked.length; i += PER_SLIDE) chunks.push(ranked.slice(i, i + PER_SLIDE));
    return chunks;
  }, [ranked]);

  // Auto-advance the slideshow.
  useEffect(() => {
    if (pages.length < 2) return;
    const id = setInterval(() => setPage((p) => (p + 1) % pages.length), SLIDE_MS);
    return () => clearInterval(id);
  }, [pages.length]);

  const current = pages[page % (pages.length || 1)];

  return (
    <Card className="flex flex-col gap-4">
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
        <div className="flex items-center gap-2 py-6 text-sm text-zinc-500">
          <Spinner /> Loading market data…
        </div>
      ) : current && current.length > 0 ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {current.map((c) => (
              <CollectionSlide key={c.symbol} collection={c} />
            ))}
          </div>

          {pages.length > 1 && (
            <div className="flex items-center justify-center gap-1.5">
              {pages.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i)}
                  aria-label={`Show page ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all ${
                    i === page % pages.length
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

function CollectionSlide({ collection: c }: { collection: MarketCollection }) {
  return (
    <div className="animate-splash-pop overflow-hidden rounded-xl border border-white/[.07] bg-white/[.02]">
      <div className="relative aspect-square bg-white/[.04]">
        {c.image ? (
          <Image src={c.image} alt={c.name} fill unoptimized className="object-cover" />
        ) : (
          <div className="grid h-full place-items-center text-4xl text-zinc-600">◈</div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        <p className="absolute bottom-2 left-3 right-3 truncate text-sm font-semibold text-white drop-shadow">
          {c.name}
        </p>
      </div>
      <div className="flex items-center justify-between p-3">
        <div>
          <p className="text-lg font-semibold tabular-nums text-gradient">
            {(c.floorPriceLamports! / LAMPORTS_PER_SOL).toFixed(2)} SOL
          </p>
          <p className="text-xs text-zinc-500">floor</p>
        </div>
        <div className="text-right text-xs text-zinc-500">
          {c.listedCount !== null && <p>{c.listedCount} listed</p>}
          {c.volume7dLamports !== null && (
            <p>{(c.volume7dLamports / LAMPORTS_PER_SOL).toFixed(0)} SOL · 7d</p>
          )}
        </div>
      </div>
    </div>
  );
}
