"use client";

import {
  Container,
  ProgramHeader,
  WalletGate,
  Card,
  Button,
  AddressLink,
  CounterIcon,
} from "@/components/ui";
import { PROGRAM_IDS } from "@/lib/constants";
import { useCounter } from "@/components/useCounter";

export default function CounterPage() {
  return (
    <Container>
      <ProgramHeader
        title="Counter"
        programId={PROGRAM_IDS.counter.toBase58()}
        instructions={["initialize", "increment", "decrement", "reset"]}
        icon={<CounterIcon />}
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
    <div className="animate-rise flex flex-col gap-4">
      {/* Value display */}
      <Card className="relative overflow-hidden">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-brand-purple/10 blur-3xl" />
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          Your count
        </p>
        <p className="mt-2 text-7xl font-semibold tabular-nums leading-none">
          {exists ? (
            <span className="text-gradient">{count}</span>
          ) : (
            <span className="text-zinc-700">—</span>
          )}
        </p>
        {!exists && (
          <p className="mt-3 text-sm text-zinc-500">
            No counter yet for this wallet. Run{" "}
            <code className="rounded bg-white/[.06] px-1 py-0.5 font-mono text-xs text-zinc-300">
              initialize
            </code>{" "}
            to create one.
          </p>
        )}
      </Card>

      {/* Actions */}
      <Card className="flex flex-col gap-5">
        <div className="flex flex-wrap gap-2.5">
          {!exists ? (
            <Button onClick={initialize} loading={loading}>
              Initialize counter
            </Button>
          ) : (
            <>
              <Button onClick={increment} disabled={loading}>
                Increment +1
              </Button>
              <Button onClick={decrement} disabled={loading} variant="ghost">
                Decrement −1
              </Button>
              <Button onClick={reset} disabled={loading} variant="danger">
                Reset
              </Button>
            </>
          )}
        </div>

        {/* Live status */}
        {loading && (
          <div className="flex items-center gap-2 rounded-lg border border-brand-purple/20 bg-brand-purple/[.06] px-3 py-2 text-sm text-purple-200">
            <span className="h-2 w-2 animate-pulse rounded-full bg-brand-purple" />
            Sending transaction…
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-500/25 bg-red-500/[.07] px-3 py-2 text-sm text-red-300 break-words">
            {error}
          </div>
        )}

        {txSig && !loading && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-brand-green/20 bg-brand-green/[.06] px-3 py-2 text-sm text-emerald-200">
            <span className="h-2 w-2 rounded-full bg-brand-green" />
            Confirmed —
            <AddressLink value={txSig} kind="tx" />
          </div>
        )}

        {counterPda && (
          <p className="flex flex-wrap items-center gap-1.5 border-t border-white/[.06] pt-3 text-xs text-zinc-500">
            Counter PDA <AddressLink value={counterPda.toBase58()} />
          </p>
        )}
      </Card>
    </div>
  );
}
