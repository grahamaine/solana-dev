"use client";

import { useEffect, useState } from "react";
import {
  Container,
  ProgramHeader,
  WalletGate,
  Card,
  Button,
  Badge,
  Input,
  Label,
  AddressLink,
  Spinner,
  MarketplaceIcon,
} from "@/components/ui";
import { PROGRAM_IDS } from "@/lib/constants";
import {
  useNftMarketplace,
  solToLamports,
  lamportsToSol,
  type ListingAccount,
  type AuctionAccount,
  type OwnedNft,
} from "@/components/useNftMarketplace";

export default function NftMarketplacePage() {
  return (
    <Container>
      <ProgramHeader
        title="Neon NFT Portal"
        programId={PROGRAM_IDS.nftMarketplace.toBase58()}
        instructions={[
          "initialize_marketplace",
          "create_listing",
          "buy_listing",
          "cancel_listing",
          "update_listing_price",
          "create_auction",
          "place_bid",
          "settle_auction",
          "cancel_auction",
          "withdraw_fees",
        ]}
        icon={<MarketplaceIcon />}
      />
      <WalletGate>
        <MarketplaceApp />
      </WalletGate>
    </Container>
  );
}

function MarketplaceApp() {
  const m = useNftMarketplace();
  const { refresh, refreshOwnedNfts } = m;

  useEffect(() => {
    refresh();
    refreshOwnedNfts();
  }, [refresh, refreshOwnedNfts]);

  const isAuthority =
    m.marketplace && m.wallet?.publicKey.equals(m.marketplace.authority);

  return (
    <div className="animate-rise flex flex-col gap-6">
      {!m.marketplace && !m.loading && <InitializeCard marketplace={m} />}

      {/* Global tx feedback */}
      {m.error && (
        <div className="rounded-lg border border-red-500/25 bg-red-500/[.07] px-3 py-2 text-sm text-red-300 break-words">
          {m.error}
        </div>
      )}
      {m.txSig && !m.busy && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-brand-green/20 bg-brand-green/[.06] px-3 py-2 text-sm text-emerald-200">
          <span className="h-2 w-2 rounded-full bg-brand-green" />
          Confirmed — <AddressLink value={m.txSig} kind="tx" />
        </div>
      )}

      {m.marketplace && (
        <Card className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="text-zinc-400">
            Marketplace fee:{" "}
            <span className="text-zinc-100">{(m.marketplace.feeBps / 100).toFixed(2)}%</span>
          </span>
          {isAuthority && <AdminWithdraw marketplace={m} />}
        </Card>
      )}

      {m.marketplace && <ListOrAuctionForm marketplace={m} />}

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-500">
          Listings {m.listings.length > 0 && `· ${m.listings.length}`}
        </h2>
        <button
          onClick={() => refresh()}
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 transition-colors hover:text-zinc-300"
        >
          {m.loading ? <Spinner /> : "↻"} Refresh
        </button>
      </div>
      {m.listings.length === 0 ? (
        <Card className="border-dashed py-8 text-center text-sm text-zinc-500">
          No active listings.
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {m.listings.map((l) => (
            <ListingCard key={l.pubkey.toBase58()} listing={l} marketplace={m} />
          ))}
        </div>
      )}

      <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-500">
        Auctions {m.auctions.length > 0 && `· ${m.auctions.length}`}
      </h2>
      {m.auctions.length === 0 ? (
        <Card className="border-dashed py-8 text-center text-sm text-zinc-500">
          No active auctions.
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {m.auctions.map((a) => (
            <AuctionCard key={a.pubkey.toBase58()} auction={a} marketplace={m} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ Initialize ------------------------------ */

function InitializeCard({ marketplace: m }: { marketplace: ReturnType<typeof useNftMarketplace> }) {
  const [feePct, setFeePct] = useState("2.5");
  const busy = m.busy === "init";
  return (
    <Card className="flex flex-col gap-3 border-dashed">
      <p className="font-medium text-zinc-200">Marketplace not initialized yet</p>
      <p className="text-sm text-zinc-500">
        Set the fee once — the wallet that calls this becomes the marketplace
        authority (able to withdraw collected fees later).
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label>Fee %</Label>
          <Input
            type="number"
            step="0.01"
            min={0}
            max={10}
            value={feePct}
            onChange={(e) => setFeePct(e.target.value)}
            className="w-28"
          />
        </div>
        <Button
          loading={busy}
          onClick={() => m.initializeMarketplace(Math.round(Number(feePct) * 100))}
        >
          Initialize marketplace
        </Button>
      </div>
    </Card>
  );
}

/* -------------------------- Admin fee withdrawal ------------------------- */

function AdminWithdraw({ marketplace: m }: { marketplace: ReturnType<typeof useNftMarketplace> }) {
  const busy = m.busy === "withdraw";
  return (
    <div className="flex items-center gap-3">
      <span className="text-zinc-400">
        Treasury: <span className="text-zinc-100">{lamportsToSol(m.treasuryBalance).toFixed(4)} SOL</span>
      </span>
      <Button
        variant="ghost"
        loading={busy}
        disabled={m.treasuryBalance === BigInt(0)}
        onClick={() => m.withdrawFees(m.treasuryBalance)}
      >
        Withdraw fees
      </Button>
    </div>
  );
}

/* ------------------------------ List / Auction form ------------------------------ */

function ListOrAuctionForm({ marketplace: m }: { marketplace: ReturnType<typeof useNftMarketplace> }) {
  const [mode, setMode] = useState<"fixed" | "auction">("fixed");
  const [selectedMint, setSelectedMint] = useState("");
  const [price, setPrice] = useState("");
  const [reserve, setReserve] = useState("");
  const [durationHours, setDurationHours] = useState("24");

  const busy = m.busy === "list" || m.busy === "auction";
  const nft = m.ownedNfts.find((n) => n.mint.toBase58() === selectedMint);

  const submit = async () => {
    if (!nft) return;
    if (mode === "fixed") {
      if (!price || Number(price) <= 0) return;
      await m.createListing(nft.mint, solToLamports(Number(price)));
    } else {
      if (!reserve || Number(reserve) <= 0) return;
      const endTime = Math.floor(Date.now() / 1000) + Math.round(Number(durationHours) * 3600);
      await m.createAuction(nft.mint, solToLamports(Number(reserve)), endTime);
    }
    setSelectedMint("");
    setPrice("");
    setReserve("");
  };

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className="text-brand-green">
          <MarketplaceIcon />
        </span>
        <h2 className="font-semibold tracking-tight">Sell an NFT</h2>
        <div className="ml-auto flex gap-1 rounded-lg border border-white/[.1] bg-white/[.03] p-0.5 text-xs">
          <button
            onClick={() => setMode("fixed")}
            className={`rounded-md px-2.5 py-1 transition-colors ${mode === "fixed" ? "bg-white/[.1] text-zinc-100" : "text-zinc-500"}`}
          >
            Fixed price
          </button>
          <button
            onClick={() => setMode("auction")}
            className={`rounded-md px-2.5 py-1 transition-colors ${mode === "auction" ? "bg-white/[.1] text-zinc-100" : "text-zinc-500"}`}
          >
            Auction
          </button>
        </div>
      </div>

      {m.ownedNfts.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No eligible NFTs found in your wallet (decimals=0, supply=1 tokens).
        </p>
      ) : (
        <>
          <div>
            <Label>Your NFT</Label>
            <select
              value={selectedMint}
              onChange={(e) => setSelectedMint(e.target.value)}
              className="w-full rounded-xl border border-white/[.1] bg-white/[.03] px-3.5 py-2.5 text-sm text-zinc-100 outline-none transition-colors focus:border-brand-purple/50"
            >
              <option value="">Select an NFT…</option>
              {m.ownedNfts.map((n: OwnedNft) => (
                <option key={n.mint.toBase58()} value={n.mint.toBase58()}>
                  {n.mint.toBase58()}
                </option>
              ))}
            </select>
          </div>

          {mode === "fixed" ? (
            <div>
              <Label>Price (SOL)</Label>
              <Input
                type="number"
                step="0.01"
                min={0}
                value={price}
                placeholder="1.5"
                onChange={(e) => setPrice(e.target.value)}
                className="w-40"
              />
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              <div>
                <Label>Reserve price (SOL)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  value={reserve}
                  placeholder="1.0"
                  onChange={(e) => setReserve(e.target.value)}
                  className="w-40"
                />
              </div>
              <div>
                <Label>Duration (hours)</Label>
                <Input
                  type="number"
                  min={1}
                  value={durationHours}
                  onChange={(e) => setDurationHours(e.target.value)}
                  className="w-32"
                />
              </div>
            </div>
          )}

          <div>
            <Button
              onClick={submit}
              loading={busy}
              disabled={
                !nft || (mode === "fixed" ? !price || Number(price) <= 0 : !reserve || Number(reserve) <= 0)
              }
            >
              {mode === "fixed" ? "List for sale" : "Start auction"}
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}

/* ------------------------------ Listing card ------------------------------ */

function ListingCard({
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

function AuctionCard({
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

function formatDuration(seconds: number): string {
  if (seconds <= 0) return "0s";
  if (seconds >= 86400) return `${Math.floor(seconds / 86400)}d`;
  if (seconds >= 3600) return `${Math.floor(seconds / 3600)}h`;
  if (seconds >= 60) return `${Math.floor(seconds / 60)}m`;
  return `${seconds}s`;
}
