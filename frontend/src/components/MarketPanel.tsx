"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Spinner } from "@/components/ui";
import type { MarketCollection } from "@/app/api/market/route";

const LAMPORTS_PER_SOL = 1_000_000_000;
const SLIDE_MS = 5500;

/**
 * Live "trending NFTs" panel. Pulls real mainnet data (via our own
 * /api/market proxy, since Magic Eden's API blocks direct browser CORS
 * requests) for a curated set of well-known Solana NFT collections, sorted
 * by 7-day volume — highest-trading first — and shows it as a featured
 * hero + ranked list, the way a marketplace browse page would.
 *
 * This is explicitly NOT the floor price of anything traded by this app's
 * devnet marketplace program — devnet test NFTs have no real secondary
 * market. It's shown as a separate "live market" reference, clearly
 * labeled, rather than implied to be connected to the listings above it.
 */
export function MarketPanel() {
  const [collections, setCollections] = useState<MarketCollection[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [heroIndex, setHeroIndex] = useState(0);

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

  // Auto-advance the hero through the top few collections.
  useEffect(() => {
    if (!ranked || ranked.length < 2) return;
    const id = setInterval(() => setHeroIndex((i) => (i + 1) % Math.min(ranked.length, 6)), SLIDE_MS);
    return () => clearInterval(id);
  }, [ranked]);

  const hero = ranked?.[heroIndex % (ranked.length || 1)];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold tracking-tight">Trending on Solana</h2>
        <span className="rounded-full bg-white/[.06] px-2 py-0.5 text-xs text-zinc-500 ring-1 ring-inset ring-white/10">
          mainnet reference
        </span>
      </div>

      {error && <p className="text-sm text-red-300">{error}</p>}

      {!ranked && !error ? (
        <div className="flex items-center gap-2 rounded-2xl border border-white/[.09] bg-white/[.026] py-10 text-sm text-zinc-500">
          <Spinner /> Loading market data…
        </div>
      ) : ranked && ranked.length > 0 && hero ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_340px]">
          <Hero
            collection={hero}
            index={heroIndex % Math.min(ranked.length, 6)}
            count={Math.min(ranked.length, 6)}
            onSelect={setHeroIndex}
            thumbs={ranked.slice(0, 6)}
          />
          <RankingsList collections={ranked} activeSymbol={hero.symbol} onSelect={(i) => setHeroIndex(i)} />
        </div>
      ) : (
        <p className="text-sm text-zinc-500">No market data available right now.</p>
      )}

      <p className="text-xs text-zinc-600">
        Real floor prices &amp; volume from Magic Eden — for context only.
        Devnet test NFTs traded below have no real secondary market.
      </p>
    </div>
  );
}

function Hero({
  collection: c,
  index,
  count,
  onSelect,
  thumbs,
}: {
  collection: MarketCollection;
  index: number;
  count: number;
  onSelect: (i: number) => void;
  thumbs: MarketCollection[];
}) {
  return (
    <div className="animate-splash-pop relative flex h-[360px] flex-col justify-end overflow-hidden rounded-2xl border border-white/[.09] sm:h-[420px]">
      {c.image ? (
        <Image
          key={c.symbol}
          src={c.image}
          alt=""
          fill
          unoptimized
          priority
          className="object-cover"
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center bg-white/[.03] text-6xl text-zinc-700">◈</div>
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#07060c] via-[#07060c]/10 to-transparent" />

      {/* Thumbnail strip, top right */}
      <div className="absolute right-4 top-4 hidden gap-2 sm:flex">
        {thumbs
          .filter((t) => t.symbol !== c.symbol)
          .slice(0, 3)
          .map((t) => {
            const i = thumbs.findIndex((x) => x.symbol === t.symbol);
            return (
              <button
                key={t.symbol}
                onClick={() => onSelect(i)}
                className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-white/20 bg-white/[.05] transition-transform hover:scale-105 hover:border-white/40"
              >
                {t.image && <Image src={t.image} alt="" fill unoptimized className="object-cover" />}
              </button>
            );
          })}
      </div>

      <div className="relative flex flex-col gap-4 p-5 sm:p-7">
        <div>
          <p className="flex items-center gap-1.5 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            {c.name}
            <VerifiedIcon />
          </p>
          <p className="mt-1 text-sm text-zinc-400">By Solana</p>
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-2 rounded-xl border border-white/[.1] bg-black/40 px-4 py-3 backdrop-blur-sm">
          <Stat label="Floor price" value={`${(c.floorPriceLamports! / LAMPORTS_PER_SOL).toFixed(2)} SOL`} />
          {c.listedCount !== null && <Stat label="Listed" value={c.listedCount.toLocaleString()} />}
          {c.volume7dLamports !== null && (
            <Stat label="7d volume" value={`${(c.volume7dLamports / LAMPORTS_PER_SOL).toFixed(0)} SOL`} />
          )}
        </div>

        {count > 1 && (
          <div className="flex items-center gap-1.5">
            {Array.from({ length: count }).map((_, i) => (
              <button
                key={i}
                onClick={() => onSelect(i)}
                aria-label={`Show collection ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? "w-6 bg-brand-green" : "w-1.5 bg-white/[.25] hover:bg-white/[.45]"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="text-sm font-semibold tabular-nums text-zinc-100">{value}</p>
    </div>
  );
}

function RankingsList({
  collections,
  activeSymbol,
  onSelect,
}: {
  collections: MarketCollection[];
  activeSymbol: string;
  onSelect: (i: number) => void;
}) {
  return (
    <div className="flex h-[360px] flex-col overflow-hidden rounded-2xl border border-white/[.09] bg-white/[.026] sm:h-[420px]">
      <div className="flex items-center justify-between border-b border-white/[.07] px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
        <span>Collection</span>
        <span>Floor</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {collections.map((c, i) => (
          <button
            key={c.symbol}
            onClick={() => onSelect(i)}
            className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-white/[.04] ${
              c.symbol === activeSymbol ? "bg-white/[.05]" : ""
            }`}
          >
            <span className="w-4 shrink-0 text-xs tabular-nums text-zinc-600">{i + 1}</span>
            <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-lg bg-white/[.06]">
              {c.image ? (
                <Image src={c.image} alt="" fill unoptimized className="object-cover" />
              ) : (
                <span className="grid h-full place-items-center text-xs text-zinc-600">◈</span>
              )}
            </span>
            <span className="flex min-w-0 items-center gap-1 truncate text-sm text-zinc-200">
              <span className="truncate">{c.name}</span>
              <VerifiedIcon small />
            </span>
            <span className="ml-auto shrink-0 text-right text-sm tabular-nums text-zinc-100">
              {c.floorPriceLamports !== null
                ? `${(c.floorPriceLamports / LAMPORTS_PER_SOL).toFixed(2)}`
                : "—"}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function VerifiedIcon({ small = false }: { small?: boolean }) {
  const size = small ? 12 : 18;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0">
      <path
        d="M12 2.5 14.5 5h3.5v3.5L21 11l-2.5 2.5V17h-3.5L12 21.5 9.5 17H6v-3.5L3.5 11 6 8.5V5h3.5L12 2.5Z"
        fill="#14f195"
        fillOpacity="0.9"
      />
      <path d="m8.5 12 2.3 2.3L15.5 9.5" stroke="#07060c" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
