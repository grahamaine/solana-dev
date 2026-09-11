"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Spinner } from "@/components/ui";
import type { LiveListing } from "@/app/api/market/listings/route";

/**
 * Real, currently-listed NFTs on Solana mainnet (via Magic Eden), shown so
 * the marketplace page has something populated to look at even while this
 * program's own devnet listings/auctions are empty. These are NOT listings
 * on this program and can't be bought through it — each card links out to
 * Magic Eden itself, same "live market reference" framing as MarketPanel.
 */
export function LiveListings() {
  const [listings, setListings] = useState<LiveListing[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetch("/api/market/listings");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { listings: LiveListing[] };
        if (active) setListings(data.listings);
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

  const shown = listings?.filter((l) => l.image) ?? null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold tracking-tight">Live listings on Magic Eden</h2>
        <span className="rounded-full bg-white/[.06] px-2 py-0.5 text-xs text-zinc-500 ring-1 ring-inset ring-white/10">
          mainnet reference
        </span>
      </div>

      {error && <p className="text-sm text-red-300">{error}</p>}

      {!shown && !error ? (
        <div className="flex items-center gap-2 rounded-2xl border border-white/[.09] bg-white/[.026] py-10 text-sm text-zinc-500">
          <Spinner /> Loading real listings…
        </div>
      ) : shown && shown.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {shown.map((l) => (
            <LiveListingCard key={l.mint} listing={l} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-zinc-500">No live listings available right now.</p>
      )}

      <p className="text-xs text-zinc-600">
        Real NFTs currently for sale on Solana mainnet, via Magic Eden — for
        visual reference only. Not listed on this program; each card opens
        Magic Eden itself.
      </p>
    </div>
  );
}

function LiveListingCard({ listing: l }: { listing: LiveListing }) {
  return (
    <a
      href={`https://magiceden.io/item-details/${l.mint}`}
      target="_blank"
      rel="noreferrer"
      className="group overflow-hidden rounded-xl border border-white/[.07] bg-white/[.02] transition-colors hover:border-white/[.18]"
    >
      <div className="relative aspect-square bg-white/[.03]">
        {l.image && (
          <Image
            src={l.image}
            alt={l.name}
            fill
            unoptimized
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        )}
      </div>
      <div className="p-2">
        <p className="truncate text-xs text-zinc-300">{l.name}</p>
        <div className="mt-0.5 flex items-center justify-between gap-1">
          <p className="truncate text-[11px] text-zinc-500">{l.collectionName}</p>
          <p className="shrink-0 text-xs font-semibold tabular-nums text-gradient">
            {l.priceSol.toFixed(2)}
          </p>
        </div>
      </div>
    </a>
  );
}
