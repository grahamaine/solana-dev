"use client";

import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletButton } from "@/components/WalletButton";
import { explorerUrl } from "@/lib/constants";

export function Container({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">{children}</main>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.12] dark:bg-zinc-950 ${className}`}
    >
      {children}
    </div>
  );
}

export function ProgramHeader({
  title,
  programId,
  instructions,
  children,
}: {
  title: string;
  programId: string;
  instructions: string[];
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-8">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Program{" "}
        <Link
          href={explorerUrl(programId)}
          target="_blank"
          className="font-mono text-xs underline decoration-dotted underline-offset-2"
        >
          {programId.slice(0, 6)}…{programId.slice(-6)}
        </Link>
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {instructions.map((ix) => (
          <code
            key={ix}
            className="rounded bg-black/[.06] px-1.5 py-0.5 font-mono text-xs dark:bg-white/[.08]"
          >
            {ix}
          </code>
        ))}
      </div>
      {children}
    </div>
  );
}

/** Renders children only when a wallet is connected; otherwise a connect prompt. */
export function WalletGate({ children }: { children: React.ReactNode }) {
  const { connected } = useWallet();
  if (!connected) {
    return (
      <Card className="flex flex-col items-start gap-4">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Connect a devnet wallet to interact with this program.
        </p>
        <WalletButton />
      </Card>
    );
  }
  return <>{children}</>;
}

export function PendingWiring({ program }: { program: string }) {
  return (
    <Card className="border-dashed">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        On-chain wiring for <span className="font-medium">{program}</span> lands
        once the program is deployed to devnet and its IDL is added under{" "}
        <code className="font-mono text-xs">src/idl/</code>. The wallet
        connection, RPC, and provider wiring above are already live.
      </p>
    </Card>
  );
}
