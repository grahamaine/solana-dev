"use client";

import Link from "next/link";
import { Container, ProgramHeader, WalletGate, Card } from "@/components/ui";
import { PROGRAM_IDS, explorerUrl } from "@/lib/constants";
import { useCounter } from "@/components/useCounter";

export default function CounterPage() {
  return (
    <Container>
      <ProgramHeader
        title="Counter"
        programId={PROGRAM_IDS.counter.toBase58()}
        instructions={["initialize", "increment", "decrement", "reset"]}
      />
      <WalletGate>
        <CounterPanel />
      </WalletGate>
    </Container>
  );
}

function CounterPanel() {
  const {
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
  } = useCounter();

  return (
    <Card className="flex flex-col gap-6">
      {/* Current value */}
      <div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Your count</p>
        <p className="mt-1 text-5xl font-semibold tabular-nums">
          {exists ? count : "—"}
        </p>
        {!exists && (
          <p className="mt-2 text-sm text-zinc-500">
            No counter yet for this wallet. Run <code>initialize</code> to
            create one.
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {!exists ? (
          <Button onClick={initialize} disabled={loading}>
            Initialize
          </Button>
        ) : (
          <>
            <Button onClick={increment} disabled={loading}>
              Increment +1
            </Button>
            <Button onClick={decrement} disabled={loading} variant="ghost">
              Decrement −1
            </Button>
            <Button onClick={reset} disabled={loading} variant="ghost">
              Reset
            </Button>
          </>
        )}
      </div>

      {loading && (
        <p className="text-sm text-zinc-500">Sending transaction…</p>
      )}

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400 break-words">
          {error}
        </p>
      )}

      {txSig && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Last tx:{" "}
          <Link
            href={explorerUrl(txSig, "tx")}
            target="_blank"
            className="font-mono text-xs underline decoration-dotted underline-offset-2"
          >
            {txSig.slice(0, 8)}…{txSig.slice(-8)}
          </Link>
        </p>
      )}

      {counterPda && (
        <p className="text-xs text-zinc-500">
          Counter PDA:{" "}
          <Link
            href={explorerUrl(counterPda.toBase58())}
            target="_blank"
            className="font-mono underline decoration-dotted underline-offset-2"
          >
            {counterPda.toBase58().slice(0, 6)}…
            {counterPda.toBase58().slice(-6)}
          </Link>
        </p>
      )}
    </Card>
  );
}

function Button({
  children,
  onClick,
  disabled,
  variant = "solid",
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: "solid" | "ghost";
}) {
  const base =
    "rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed";
  const styles =
    variant === "solid"
      ? "bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
      : "border border-black/[.12] hover:bg-black/[.04] dark:border-white/[.16] dark:hover:bg-white/[.06]";
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${styles}`}>
      {children}
    </button>
  );
}
