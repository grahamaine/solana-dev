"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useConnection, useAnchorWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import idl from "@/idl/counter.json";
import type { Counter } from "@/idl/counter";

/**
 * All the on-chain logic for the counter program in one hook:
 *  - builds an Anchor `Program` from the connected wallet + RPC connection
 *  - derives this wallet's counter PDA (seeds = [b"counter", wallet])
 *  - reads the stored count, and exposes initialize/increment/decrement/reset
 *
 * The seed string matches the program's `#[account(seeds = [b"counter", ...])]`,
 * which is why each wallet gets its own counter account.
 */
export function useCounter() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  // Program client — only exists once a wallet is connected (it signs txs).
  const program = useMemo(() => {
    if (!wallet) return null;
    const provider = new AnchorProvider(connection, wallet, {
      commitment: "confirmed",
    });
    return new Program(idl as Counter, provider);
  }, [connection, wallet]);

  // This wallet's counter PDA. TextEncoder/toBytes avoids needing a Buffer
  // polyfill just for the seed derivation.
  const counterPda = useMemo(() => {
    if (!wallet) return null;
    const [pda] = PublicKey.findProgramAddressSync(
      [new TextEncoder().encode("counter"), wallet.publicKey.toBytes()],
      new PublicKey(idl.address)
    );
    return pda;
  }, [wallet]);

  const [count, setCount] = useState<number | null>(null);
  const [exists, setExists] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txSig, setTxSig] = useState<string | null>(null);

  // Fetch the account. If the fetch throws, the PDA doesn't exist yet =>
  // this wallet hasn't run `initialize`.
  const refresh = useCallback(async () => {
    if (!program || !counterPda) return;
    try {
      const acct = await program.account.counter.fetch(counterPda);
      setCount(Number(acct.count));
      setExists(true);
    } catch {
      setCount(null);
      setExists(false);
    }
  }, [program, counterPda]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Wrap each instruction call with shared loading/error/refresh handling.
  const run = useCallback(
    async (build: () => Promise<string>) => {
      if (!program || !counterPda || !wallet) return;
      setLoading(true);
      setError(null);
      setTxSig(null);
      try {
        const sig = await build();
        setTxSig(sig);
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    },
    [program, counterPda, wallet, refresh]
  );

  const initialize = () =>
    run(() =>
      program!.methods
        .initialize()
        .accountsPartial({
          authority: wallet!.publicKey,
          counter: counterPda!,
          systemProgram: SystemProgram.programId,
        })
        .rpc()
    );

  const increment = () =>
    run(() =>
      program!.methods
        .increment()
        .accountsPartial({ authority: wallet!.publicKey, counter: counterPda! })
        .rpc()
    );

  const decrement = () =>
    run(() =>
      program!.methods
        .decrement()
        .accountsPartial({ authority: wallet!.publicKey, counter: counterPda! })
        .rpc()
    );

  const reset = () =>
    run(() =>
      program!.methods
        .reset()
        .accountsPartial({ authority: wallet!.publicKey, counter: counterPda! })
        .rpc()
    );

  return {
    counterPda,
    count,
    exists,
    loading,
    error,
    txSig,
    initialize,
    increment,
    decrement,
    reset,
    refresh,
  };
}
