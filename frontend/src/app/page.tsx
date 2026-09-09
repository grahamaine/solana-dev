"use client";

import { useEffect, useState } from "react";
import {
  Container,
  ProgramHeader,
  WalletGate,
  Card,
  Button,
  Input,
  Label,
  AddressLink,
  Spinner,
  MarketplaceIcon,
} from "@/components/ui";
import { MarketPanel } from "@/components/MarketPanel";
import { YourNfts, ListingCard, AuctionCard } from "@/components/nft-cards";
import { PROGRAM_IDS } from "@/lib/constants";
import { useNftMarketplace, solToLamports, lamportsToSol, type OwnedNft } from "@/components/useNftMarketplace";

export default function Home() {
  return (
    <Container>
      <ProgramHeader
        title="Neon NFT Portal"
        programId={PROGRAM_IDS.nftMarketplace.toBase58()}
        icon={<MarketplaceIcon />}
      />
      <div className="mb-6">
        <MarketPanel />
      </div>
      <WalletGate>
        <MarketplaceApp />
      </WalletGate>
    </Container>
  );
}

const TYPE_FILTERS = [
  { id: "all", label: "All" },
  { id: "listings", label: "Listings" },
  { id: "auctions", label: "Auctions" },
] as const;
type TypeFilter = (typeof TYPE_FILTERS)[number]["id"];

function MarketplaceApp() {
  const m = useNftMarketplace();
  const { refresh, refreshOwnedNfts } = m;
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

  useEffect(() => {
    refresh();
    refreshOwnedNfts();
  }, [refresh, refreshOwnedNfts]);

  const isAuthority =
    m.marketplace && m.wallet?.publicKey.equals(m.marketplace.authority);

  const query = search.trim().toLowerCase();
  const matches = (mint: string, seller: string) =>
    !query || mint.toLowerCase().includes(query) || seller.toLowerCase().includes(query);

  const filteredListings = m.listings.filter((l) =>
    matches(l.nftMint.toBase58(), l.seller.toBase58())
  );
  const filteredAuctions = m.auctions.filter((a) =>
    matches(a.nftMint.toBase58(), a.seller.toBase58())
  );
  const showListings = typeFilter !== "auctions";
  const showAuctions = typeFilter !== "listings";

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

      {m.wallet && <YourNfts nfts={m.ownedNfts} />}

      {m.marketplace && <ListOrAuctionForm marketplace={m} />}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500">
            <SearchIcon />
          </span>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by NFT mint or seller address"
            className="rounded-full pl-10"
          />
        </div>
        <div className="flex shrink-0 gap-1 rounded-full border border-white/[.1] bg-white/[.03] p-1 text-sm">
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setTypeFilter(f.id)}
              className={`rounded-full px-3.5 py-1.5 transition-colors ${
                typeFilter === f.id ? "bg-white/[.1] text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => refresh()}
          className="inline-flex shrink-0 items-center gap-1.5 self-start text-xs text-zinc-500 transition-colors hover:text-zinc-300 sm:self-auto"
        >
          {m.loading ? <Spinner /> : "↻"} Refresh
        </button>
      </div>

      {showListings && (
        <>
          <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-500">
            Listings {filteredListings.length > 0 && `· ${filteredListings.length}`}
          </h2>
          {filteredListings.length === 0 ? (
            <Card className="border-dashed py-8 text-center text-sm text-zinc-500">
              {m.listings.length === 0 ? "No active listings." : "No listings match your search."}
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {filteredListings.map((l) => (
                <ListingCard key={l.pubkey.toBase58()} listing={l} marketplace={m} />
              ))}
            </div>
          )}
        </>
      )}

      {showAuctions && (
        <>
          <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-500">
            Auctions {filteredAuctions.length > 0 && `· ${filteredAuctions.length}`}
          </h2>
          {filteredAuctions.length === 0 ? (
            <Card className="border-dashed py-8 text-center text-sm text-zinc-500">
              {m.auctions.length === 0 ? "No active auctions." : "No auctions match your search."}
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {filteredAuctions.map((a) => (
                <AuctionCard key={a.pubkey.toBase58()} auction={a} marketplace={m} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
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
                  {n.name ?? n.mint.toBase58()}
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
