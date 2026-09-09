"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Card, Button, Badge, Input, AddressLink, MarketplaceIcon } from "@/components/ui";
import {
  useNftMarketplace,
  solToLamports,
  lamportsToSol,
  type ListingAccount,
  type AuctionAccount,
  type OwnedNft,
} from "@/components/useNftMarketplace";

/* ------------------------------ Your NFTs ------------------------------ */

export function YourNfts({ nfts }: { nfts: OwnedNft[] }) {
  if (nfts.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-500">
        Your NFTs · {nfts.length}
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {nfts.map((n) => (
          <NftThumb key={n.mint.toBase58()} nft={n} />
        ))}
      </div>
    </div>
  );
}

export function NftThumb({ nft: n }: { nft: OwnedNft }) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/[.07] bg-white/[.02]">
      <div className="relative aspect-square bg-white/[.03]">
        {n.image ? (
          <Image src={n.image} alt={n.name ?? ""} fill unoptimized className="object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-zinc-600">
            <MarketplaceIcon />
          </div>
        )}
      </div>
      <div className="p-2">
        <p className="truncate text-xs text-zinc-300">
          {n.name === undefined ? "Loading…" : n.name ?? `${n.mint.toBase58().slice(0, 6)}…`}
        </p>
      </div>
    </div>
  );
}

/* ------------------------------ Listing card ------------------------------ */

export function ListingCard({
  listing,
  marketplace: m,
}: {
  listing: ListingAccount;
  marketplace: ReturnType<typeof useNftMarketplace>;
}) {
  const isSeller = m.wallet?.publicKey.equals(listing.seller) ?? false;
  const [newPrice, setNewPrice] = useState(lamportsToSol(listing.price).toString());

  return (
    <Card className="border-gradient relative flex flex-col gap-3 overflow-hidden">
      <div className="pointer-events-none absolute -right-14 -top-14 h-40 w-40 rounded-full bg-brand-purple/10 blur-3xl" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-zinc-500">NFT mint</p>
          <AddressLink value={listing.nftMint.toBase58()} />
        </div>
        {isSeller && <Badge tone="muted">your listing</Badge>}
      </div>
      <div className="relative flex items-baseline justify-between">
        <span className="text-2xl font-semibold tabular-nums text-gradient">
          {lamportsToSol(listing.price).toFixed(3)} SOL
        </span>
        <span className="text-xs text-zinc-500">
          seller <AddressLink value={listing.seller.toBase58()} />
        </span>
      </div>

      {isSeller ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-white/[.06] pt-3">
          <Input
            type="number"
            step="0.01"
            min={0}
            value={newPrice}
            onChange={(e) => setNewPrice(e.target.value)}
            className="w-28"
          />
          <Button
            variant="ghost"
            loading={m.busy === "update-price"}
            onClick={() => m.updateListingPrice(listing, solToLamports(Number(newPrice)))}
          >
            Update price
          </Button>
          <Button
            variant="danger"
            loading={m.busy === "cancel-listing"}
            onClick={() => m.cancelListing(listing)}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <Button loading={m.busy === "buy"} onClick={() => m.buyListing(listing)}>
          Buy now
        </Button>
      )}
    </Card>
  );
}

/* ------------------------------ Auction card ------------------------------ */

export function AuctionCard({
  auction,
  marketplace: m,
}: {
  auction: AuctionAccount;
  marketplace: ReturnType<typeof useNftMarketplace>;
}) {
  const [nowTs, setNowTs] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = setInterval(() => setNowTs(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  const isSeller = m.wallet?.publicKey.equals(auction.seller) ?? false;
  const hasBids = auction.highestBid > BigInt(0);
  const ended = nowTs >= auction.endTime;
  const currentMin = hasBids
    ? lamportsToSol(auction.highestBid + BigInt(1))
    : lamportsToSol(auction.reservePrice);
  const [bid, setBid] = useState(currentMin.toString());

  const timeLeft = auction.endTime - nowTs;

  return (
    <Card className="border-gradient relative flex flex-col gap-3 overflow-hidden">
      <div className="pointer-events-none absolute -right-14 -top-14 h-40 w-40 rounded-full bg-brand-green/10 blur-3xl" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-zinc-500">NFT mint</p>
          <AddressLink value={auction.nftMint.toBase58()} />
        </div>
        <Badge tone={ended ? "muted" : "green"}>{ended ? "ended" : "live"}</Badge>
      </div>

      <div className="relative flex items-baseline justify-between">
        <div>
          <span className="text-2xl font-semibold tabular-nums text-gradient">
            {hasBids ? lamportsToSol(auction.highestBid).toFixed(3) : lamportsToSol(auction.reservePrice).toFixed(3)}{" "}
            SOL
          </span>
          <p className="text-xs text-zinc-500">{hasBids ? "current bid" : "reserve price"}</p>
        </div>
        <span className={`text-xs ${!ended && timeLeft < 3600 ? "text-amber-400" : "text-zinc-500"}`}>
          {ended ? "auction ended" : `${formatDuration(timeLeft)} left`}
        </span>
      </div>

      {hasBids && (
        <p className="text-xs text-zinc-500">
          leading bidder <AddressLink value={auction.highestBidder!.toBase58()} />
        </p>
      )}

      <div className="border-t border-white/[.06] pt-3">
        {!ended && (
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="number"
              step="0.01"
              min={currentMin}
              value={bid}
              onChange={(e) => setBid(e.target.value)}
              className="w-28"
            />
            <Button
              loading={m.busy === "bid"}
              disabled={!bid || Number(bid) < currentMin}
              onClick={() => m.placeBid(auction, solToLamports(Number(bid)))}
            >
              Place bid
            </Button>
          </div>
        )}

        {ended && hasBids && (
          <Button loading={m.busy === "settle"} onClick={() => m.settleAuction(auction)}>
            Settle auction
          </Button>
        )}

        {!hasBids && isSeller && (
          <Button
            variant="danger"
            loading={m.busy === "cancel-auction"}
            onClick={() => m.cancelAuction(auction)}
          >
            Cancel auction
          </Button>
        )}
      </div>
    </Card>
  );
}

export function formatDuration(seconds: number): string {
  if (seconds <= 0) return "0s";
  if (seconds >= 86400) return `${Math.floor(seconds / 86400)}d`;
  if (seconds >= 3600) return `${Math.floor(seconds / 3600)}h`;
  if (seconds >= 60) return `${Math.floor(seconds / 60)}m`;
  return `${seconds}s`;
}
