"use client";

import { useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";

/** Live SOL balance for the connected wallet, refreshed on account changes. */
export function useBalance() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [sol, setSol] = useState<number | null>(null);

  useEffect(() => {
    if (!publicKey) {
      setSol(null);
      return;
    }
    let active = true;

    const refresh = async () => {
      try {
        const lamports = await connection.getBalance(publicKey);
        if (active) setSol(lamports / LAMPORTS_PER_SOL);
      } catch {
        if (active) setSol(null);
      }
    };

    refresh();
    const subId = connection.onAccountChange(publicKey, (info) => {
      if (active) setSol(info.lamports / LAMPORTS_PER_SOL);
    });

    return () => {
      active = false;
      connection.removeAccountChangeListener(subId).catch(() => {});
    };
  }, [connection, publicKey]);

  return sol;
}
