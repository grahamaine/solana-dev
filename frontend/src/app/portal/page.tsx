"use client";

import { useEffect } from "react";
import { Container, ProgramHeader, WalletGate, Card, AddressLink, WalletIcon } from "@/components/ui";
import { YourNfts, ListingCard, AuctionCard } from "@/components/nft-cards";
import { useNftMarketplace } from "@/components/useNftMarketplace";
import { PROGRAM_IDS } from "@/lib/constants";

export default function PortalPage() {
  return (
    <Container>
      <ProgramHeader
        title="Your Portal"
        programId={PROGRAM_IDS.nftMarketplace.toBase58()}
        instructions={[]}
        icon={<WalletIcon />}
      />
      <WalletGate>
        <PortalApp />
      </WalletGate>
    </Container>
  );
}

function PortalApp() {
  const m = useNftMarketplace();
  const { refresh, refreshOwnedNfts, wallet } = m;

  useEffect(() => {
    refresh();
    refreshOwnedNfts();
  }, [refresh, refreshOwnedNfts]);

  if (!wallet) return null;

  const myListings = m.listings.filter((l) => l.seller.equals(wallet.publicKey));
  const myAuctions = m.auctions.filter((a) => a.seller.equals(wallet.publicKey));
  const myBids = m.auctions.filter(
    (a) => a.highestBidder && a.highestBidder.equals(wallet.publicKey) && !a.seller.equals(wallet.publicKey)
  );

  return (
    <div className="animate-rise flex flex-col gap-6">
      <Card className="flex items-center gap-3">
        <span className="text-zinc-500">Connected</span>
        <AddressLink value={wallet.publicKey.toBase58()} />
      </Card>

      <YourNfts nfts={m.ownedNfts} />
      {m.ownedNfts.length === 0 && (
        <Card className="border-dashed py-8 text-center text-sm text-zinc-500">
          No NFTs found in this wallet yet.
        </Card>
      )}

      <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-500">
        Your listings {myListings.length > 0 && `· ${myListings.length}`}
      </h2>
      {myListings.length === 0 ? (
        <Card className="border-dashed py-8 text-center text-sm text-zinc-500">
          You have nothing listed for sale right now.
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {myListings.map((l) => (
            <ListingCard key={l.pubkey.toBase58()} listing={l} marketplace={m} />
          ))}
        </div>
      )}

      <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-500">
        Your auctions {myAuctions.length > 0 && `· ${myAuctions.length}`}
      </h2>
      {myAuctions.length === 0 ? (
        <Card className="border-dashed py-8 text-center text-sm text-zinc-500">
          You don&apos;t have any auctions running.
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {myAuctions.map((a) => (
            <AuctionCard key={a.pubkey.toBase58()} auction={a} marketplace={m} />
          ))}
        </div>
      )}

      {myBids.length > 0 && (
        <>
          <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-500">
            Auctions you&apos;re winning · {myBids.length}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {myBids.map((a) => (
              <AuctionCard key={a.pubkey.toBase58()} auction={a} marketplace={m} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
