"use client";

import { useCallback, useState } from "react";
import { useConnection, useAnchorWallet } from "@solana/wallet-adapter-react";
import { PROGRAM_IDS } from "@/lib/constants";

/**
 * Reward "points" derived live from the connected wallet's own recent
 * transaction history — real, verifiable on devnet, nothing stored or
 * fabricated. The program itself tracks no per-user activity (Listing/
 * Auction accounts are closed once a sale completes), so this reads the
 * wallet's last 50 signatures and counts how many actually touched the
 * marketplace program.
 */
export function useRewards() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  const [txCount, setTxCount] = useState<number | null>(null);
  const [scanned, setScanned] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scan = useCallback(async () => {
    if (!wallet) return;
    setLoading(true);
    setError(null);
    setTxCount(null);
    setScanned(0);
    try {
      const sigs = await connection.getSignaturesForAddress(wallet.publicKey, { limit: 50 });
      let matches = 0;
      for (const { signature } of sigs) {
        const tx = await connection.getParsedTransaction(signature, { maxSupportedTransactionVersion: 0 });
        const touchesProgram = tx?.transaction.message.accountKeys.some((k) =>
          k.pubkey.equals(PROGRAM_IDS.nftMarketplace)
        );
        if (touchesProgram) matches++;
        setScanned((n) => n + 1);
      }
      setTxCount(matches);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [connection, wallet]);

  return { wallet, txCount, scanned, loading, error, scan };
}
