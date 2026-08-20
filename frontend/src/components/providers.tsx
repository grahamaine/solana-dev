"use client";

import { Buffer } from "buffer";
import { useMemo } from "react";

// Anchor's (de)serialization relies on the Node `Buffer` global, which the
// browser doesn't provide. Polyfill it once on the client.
if (typeof window !== "undefined") {
  const w = window as unknown as { Buffer?: typeof Buffer };
  if (!w.Buffer) w.Buffer = Buffer;
}
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-wallets";
import { RPC_URL } from "@/lib/constants";

import "@solana/wallet-adapter-react-ui/styles.css";

export function Providers({ children }: { children: React.ReactNode }) {
  const endpoint = RPC_URL;

  // Most modern wallets (Phantom, Solflare, Backpack) auto-register via the
  // Wallet Standard, so this array can stay minimal.
  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
