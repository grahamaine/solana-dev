"use client";

import { useCallback, useMemo, useState } from "react";
import { useConnection, useAnchorWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider, Program, BN } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import idl from "@/idl/nftMarketplace.json";
import type { NftMarketplace } from "@/idl/nftMarketplace";

/** Classic SPL Token + Associated Token program ids (the marketplace works
 *  with plain decimals=0 NFT mints, not Token-2022). */
const TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
);
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
);

const PROGRAM_ID = new PublicKey(idl.address);

/* ------------------------------ Types ------------------------------ */

export type MarketplaceConfig = {
  authority: PublicKey;
  feeBps: number;
};

export type ListingAccount = {
  pubkey: PublicKey;
  seller: PublicKey;
  nftMint: PublicKey;
  price: bigint;
};

export type AuctionAccount = {
  pubkey: PublicKey;
  seller: PublicKey;
  nftMint: PublicKey;
  reservePrice: bigint;
  endTime: number;
  highestBidder: PublicKey | null;
  highestBid: bigint;
};

export type OwnedNft = {
  mint: PublicKey;
  tokenAccount: PublicKey;
};

/* --------------------------- Seed helpers --------------------------- */

const enc = new TextEncoder();

function marketplacePda(): PublicKey {
  return PublicKey.findProgramAddressSync([enc.encode("marketplace")], PROGRAM_ID)[0];
}

function treasuryPda(): PublicKey {
  return PublicKey.findProgramAddressSync([enc.encode("treasury")], PROGRAM_ID)[0];
}

function listingPda(mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [enc.encode("listing"), mint.toBytes()],
    PROGRAM_ID
  )[0];
}

function auctionPda(mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [enc.encode("auction"), mint.toBytes()],
    PROGRAM_ID
  )[0];
}

function vaultPda(mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [enc.encode("auction_vault"), mint.toBytes()],
    PROGRAM_ID
  )[0];
}

function ata(owner: PublicKey, mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [owner.toBytes(), TOKEN_PROGRAM_ID.toBytes(), mint.toBytes()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  )[0];
}

export function solToLamports(sol: number): bigint {
  return BigInt(Math.round(sol * LAMPORTS_PER_SOL));
}

export function lamportsToSol(lamports: bigint | number): number {
  return Number(lamports) / LAMPORTS_PER_SOL;
}

/* ------------------------------ Hook ------------------------------ */

export function useNftMarketplace() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  const program = useMemo(() => {
    if (!wallet) return null;
    const provider = new AnchorProvider(connection, wallet, {
      commitment: "confirmed",
    });
    return new Program(idl as NftMarketplace, provider);
  }, [connection, wallet]);

  const [marketplace, setMarketplace] = useState<MarketplaceConfig | null>(null);
  const [treasuryBalance, setTreasuryBalance] = useState(BigInt(0));
  const [listings, setListings] = useState<ListingAccount[]>([]);
  const [auctions, setAuctions] = useState<AuctionAccount[]>([]);
  const [ownedNfts, setOwnedNfts] = useState<OwnedNft[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [txSig, setTxSig] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!program) return;
    setLoading(true);
    try {
      const [mp, ls, as, treasuryLamports] = await Promise.all([
        program.account.marketplace.fetchNullable(marketplacePda()),
        program.account.listing.all(),
        program.account.auction.all(),
        connection.getBalance(treasuryPda()),
      ]);
      setMarketplace(mp ? { authority: mp.authority, feeBps: mp.feeBps } : null);
      setTreasuryBalance(BigInt(treasuryLamports));
      setListings(
        ls.map(({ publicKey, account }) => ({
          pubkey: publicKey,
          seller: account.seller,
          nftMint: account.nftMint,
          price: BigInt(account.price.toString()),
        }))
      );
      setAuctions(
        as.map(({ publicKey, account }) => ({
          pubkey: publicKey,
          seller: account.seller,
          nftMint: account.nftMint,
          reservePrice: BigInt(account.reservePrice.toString()),
          endTime: Number(account.endTime),
          highestBidder: account.highestBidder,
          highestBid: BigInt(account.highestBid.toString()),
        }))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [program, connection]);

  const refreshOwnedNfts = useCallback(async () => {
    if (!wallet) {
      setOwnedNfts([]);
      return;
    }
    const resp = await connection.getParsedTokenAccountsByOwner(wallet.publicKey, {
      programId: TOKEN_PROGRAM_ID,
    });
    const nfts = resp.value
      .filter(({ account }) => {
        const amount = account.data.parsed.info.tokenAmount;
        return amount.decimals === 0 && amount.uiAmount === 1;
      })
      .map(({ pubkey, account }) => ({
        tokenAccount: pubkey,
        mint: new PublicKey(account.data.parsed.info.mint as string),
      }));
    setOwnedNfts(nfts);
  }, [wallet, connection]);

  // Shared wrapper: track which action is in-flight, surface errors + the
  // signature, and refresh state afterward.
  const run = useCallback(
    async (label: string, build: () => Promise<string>) => {
      if (!program || !wallet) return;
      setBusy(label);
      setError(null);
      setTxSig(null);
      try {
        const sig = await build();
        setTxSig(sig);
        await Promise.all([refresh(), refreshOwnedNfts()]);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(null);
      }
    },
    [program, wallet, refresh, refreshOwnedNfts]
  );

  const initializeMarketplace = (feeBps: number) =>
    run("init", () =>
      program!.methods
        .initializeMarketplace(feeBps)
        .accountsPartial({
          authority: wallet!.publicKey,
          marketplace: marketplacePda(),
          treasury: treasuryPda(),
          systemProgram: SystemProgram.programId,
        })
        .rpc()
    );

  const createListing = (mint: PublicKey, priceLamports: bigint) =>
    run("list", () => {
      const seller = wallet!.publicKey;
      const listing = listingPda(mint);
      return program!.methods
        .createListing(new BN(priceLamports.toString()))
        .accountsPartial({
          seller,
          nftMint: mint,
          sellerNftAccount: ata(seller, mint),
          listing,
          escrowNftAccount: ata(listing, mint),
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    });

  const cancelListing = (listing: ListingAccount) =>
    run("cancel-listing", () => {
      const seller = wallet!.publicKey;
      return program!.methods
        .cancelListing()
        .accountsPartial({
          seller,
          nftMint: listing.nftMint,
          listing: listing.pubkey,
          escrowNftAccount: ata(listing.pubkey, listing.nftMint),
          sellerNftAccount: ata(seller, listing.nftMint),
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    });

  const updateListingPrice = (listing: ListingAccount, newPriceLamports: bigint) =>
    run("update-price", () =>
      program!.methods
        .updateListingPrice(new BN(newPriceLamports.toString()))
        .accountsPartial({ seller: wallet!.publicKey, listing: listing.pubkey })
        .rpc()
    );

  const buyListing = (listing: ListingAccount) =>
    run("buy", () => {
      const buyer = wallet!.publicKey;
      return program!.methods
        .buyListing()
        .accountsPartial({
          buyer,
          seller: listing.seller,
          nftMint: listing.nftMint,
          listing: listing.pubkey,
          marketplace: marketplacePda(),
          treasury: treasuryPda(),
          escrowNftAccount: ata(listing.pubkey, listing.nftMint),
          buyerNftAccount: ata(buyer, listing.nftMint),
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    });

  const createAuction = (mint: PublicKey, reserveLamports: bigint, endTimeUnix: number) =>
    run("auction", () => {
      const seller = wallet!.publicKey;
      const auction = auctionPda(mint);
      return program!.methods
        .createAuction(new BN(reserveLamports.toString()), new BN(endTimeUnix))
        .accountsPartial({
          seller,
          nftMint: mint,
          sellerNftAccount: ata(seller, mint),
          auction,
          vault: vaultPda(mint),
          escrowNftAccount: ata(auction, mint),
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    });

  const placeBid = (auction: AuctionAccount, amountLamports: bigint) =>
    run("bid", () => {
      const bidder = wallet!.publicKey;
      const previousBidder = auction.highestBidder ?? bidder;
      return program!.methods
        .placeBid(new BN(amountLamports.toString()))
        .accountsPartial({
          bidder,
          auction: auction.pubkey,
          vault: vaultPda(auction.nftMint),
          previousBidder,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    });

  const settleAuction = (auction: AuctionAccount) =>
    run("settle", () => {
      if (!auction.highestBidder) throw new Error("No bids to settle");
      return program!.methods
        .settleAuction()
        .accountsPartial({
          caller: wallet!.publicKey,
          seller: auction.seller,
          highestBidder: auction.highestBidder,
          nftMint: auction.nftMint,
          auction: auction.pubkey,
          vault: vaultPda(auction.nftMint),
          marketplace: marketplacePda(),
          treasury: treasuryPda(),
          escrowNftAccount: ata(auction.pubkey, auction.nftMint),
          winnerNftAccount: ata(auction.highestBidder, auction.nftMint),
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    });

  const cancelAuction = (auction: AuctionAccount) =>
    run("cancel-auction", () => {
      const seller = wallet!.publicKey;
      return program!.methods
        .cancelAuction()
        .accountsPartial({
          seller,
          nftMint: auction.nftMint,
          auction: auction.pubkey,
          escrowNftAccount: ata(auction.pubkey, auction.nftMint),
          sellerNftAccount: ata(seller, auction.nftMint),
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    });

  const withdrawFees = (amountLamports: bigint) =>
    run("withdraw", () =>
      program!.methods
        .withdrawFees(new BN(amountLamports.toString()))
        .accountsPartial({
          authority: wallet!.publicKey,
          marketplace: marketplacePda(),
          treasury: treasuryPda(),
          systemProgram: SystemProgram.programId,
        })
        .rpc()
    );

  return {
    wallet,
    marketplace,
    treasuryBalance,
    listings,
    auctions,
    ownedNfts,
    loading,
    busy,
    error,
    txSig,
    refresh,
    refreshOwnedNfts,
    initializeMarketplace,
    createListing,
    cancelListing,
    updateListingPrice,
    buyListing,
    createAuction,
    placeBid,
    settleAuction,
    cancelAuction,
    withdrawFees,
  };
}
