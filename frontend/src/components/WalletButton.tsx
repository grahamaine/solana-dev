"use client";

import dynamic from "next/dynamic";

// Rendered client-only: the button label depends on wallet state, which would
// otherwise cause a hydration mismatch.
export const WalletButton = dynamic(
  async () =>
    (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false },
);
