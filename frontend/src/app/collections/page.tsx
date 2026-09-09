"use client";

import { useEffect, useMemo, useState } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { Container, ProgramHeader, Card, Badge, Spinner, CollectionsIcon } from "@/components/ui";
import { ListingCard } from "@/components/nft-cards";
import { useNftMarketplace, fetchNftMeta, type NftMeta } from "@/components/useNftMarketplace";
import { PROGRAM_IDS } from "@/lib/constants";

const UNCATEGORIZED = "Uncategorized";

export default function CollectionsPage() {
  const { connection } = useConnection();
  const m = useNftMarketplace();
  const { refresh, listings } = m;
  const [meta, setMeta] = useState<Record<string, NftMeta>>({});

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    listings.forEach((l) => {
      const key = l.nftMint.toBase58();
      if (meta[key]) return;
      fetchNftMeta(connection, l.nftMint).then((data) =>
        setMeta((prev) => ({ ...prev, [key]: data }))
      );
    });
  }, [listings, connection, meta]);

  const groups = useMemo(() => {
    const byCollection = new Map<string, typeof listings>();
    for (const l of listings) {
      const symbol = meta[l.nftMint.toBase58()]?.symbol || UNCATEGORIZED;
      const bucket = byCollection.get(symbol) ?? [];
      bucket.push(l);
      byCollection.set(symbol, bucket);
    }
    return Array.from(byCollection.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [listings, meta]);

  return (
    <Container>
      <ProgramHeader
        title="Collections"
        programId={PROGRAM_IDS.nftMarketplace.toBase58()}
        instructions={[]}
        icon={<CollectionsIcon />}
      />
      <p className="mb-6 text-sm text-zinc-500">
        Active listings grouped by their on-chain metadata symbol. Devnet test
        NFTs minted without Metaplex metadata fall under &ldquo;{UNCATEGORIZED}&rdquo;.
      </p>

      {m.loading && m.listings.length === 0 ? (
        <Card className="flex items-center gap-3 text-sm text-zinc-500">
          <Spinner /> Loading listings…
        </Card>
      ) : m.listings.length === 0 ? (
        <Card className="border-dashed py-10 text-center text-sm text-zinc-500">
          No active listings to group into collections yet.
        </Card>
      ) : (
        <div className="flex flex-col gap-8">
          {groups.map(([symbol, listings]) => (
            <div key={symbol} className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold tracking-tight">{symbol}</h2>
                <Badge tone="muted">{listings.length}</Badge>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {listings.map((l) => (
                  <ListingCard key={l.pubkey.toBase58()} listing={l} marketplace={m} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Container>
  );
}
