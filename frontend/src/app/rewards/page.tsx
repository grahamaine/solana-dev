"use client";

import { useEffect } from "react";
import { Container, ProgramHeader, WalletGate, Card, AddressLink, Spinner, RewardsIcon } from "@/components/ui";
import { useRewards } from "@/components/useRewards";
import { PROGRAM_IDS } from "@/lib/constants";

const POINTS_PER_TX = 10;

type Tier = { name: string; min: number; tone: string };
const TIERS: Tier[] = [
  { name: "Bronze", min: 0, tone: "text-amber-400" },
  { name: "Silver", min: 50, tone: "text-zinc-300" },
  { name: "Gold", min: 150, tone: "text-yellow-300" },
  { name: "Diamond", min: 400, tone: "text-cyan-300" },
];

function tierFor(points: number): Tier {
  return [...TIERS].reverse().find((t) => points >= t.min) ?? TIERS[0];
}

export default function RewardsPage() {
  return (
    <Container>
      <ProgramHeader
        title="Rewards"
        programId={PROGRAM_IDS.nftMarketplace.toBase58()}
        instructions={[]}
        icon={<RewardsIcon />}
      />
      <WalletGate>
        <RewardsApp />
      </WalletGate>
    </Container>
  );
}

function RewardsApp() {
  const { wallet, txCount, scanned, loading, error, scan } = useRewards();

  useEffect(() => {
    scan();
  }, [scan]);

  const points = (txCount ?? 0) * POINTS_PER_TX;
  const tier = tierFor(points);
  const nextTier = TIERS.find((t) => t.min > points);

  return (
    <div className="animate-rise flex flex-col gap-6">
      <Card className="border-dashed text-sm text-zinc-500">
        Points are derived live from your wallet&apos;s real transaction
        history with this program (its address showing up in one of your
        last 50 transactions) — nothing is stored or fabricated. Every
        listing, purchase, bid, and auction settlement counts.
      </Card>

      <Card className="relative flex flex-col items-center gap-2 overflow-hidden py-10 text-center">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-brand-purple/10 blur-3xl" />
        {loading ? (
          <div className="flex flex-col items-center gap-3">
            <Spinner />
            <p className="text-sm text-zinc-500">
              Scanning transaction history… {scanned}/50
            </p>
          </div>
        ) : error ? (
          <p className="text-sm text-red-300">{error}</p>
        ) : (
          <>
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Your tier
            </p>
            <p className={`text-4xl font-bold tracking-tight ${tier.tone}`}>{tier.name}</p>
            <p className="mt-2 text-6xl font-semibold tabular-nums text-gradient">{points}</p>
            <p className="text-sm text-zinc-500">points</p>
            {nextTier && (
              <p className="mt-3 text-xs text-zinc-500">
                {(nextTier.min - points) / POINTS_PER_TX} more transaction
                {(nextTier.min - points) / POINTS_PER_TX === 1 ? "" : "s"} to reach {nextTier.name}
              </p>
            )}
          </>
        )}
      </Card>

      <Card className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <span className="text-zinc-500">
          {txCount ?? 0} marketplace transaction{txCount === 1 ? "" : "s"} found ·{" "}
          {POINTS_PER_TX} points each
        </span>
        <button
          onClick={() => scan()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 transition-colors hover:text-zinc-300 disabled:opacity-40"
        >
          ↻ Rescan
        </button>
      </Card>

      <div className="flex flex-wrap gap-2">
        {TIERS.map((t) => (
          <div
            key={t.name}
            className={`flex-1 min-w-[7rem] rounded-xl border p-3 text-center ${
              tier.name === t.name
                ? "border-brand-purple/40 bg-brand-purple/[.08]"
                : "border-white/[.07] bg-white/[.02]"
            }`}
          >
            <p className={`text-sm font-semibold ${t.tone}`}>{t.name}</p>
            <p className="text-xs text-zinc-500">{t.min}+ pts</p>
          </div>
        ))}
      </div>

      {wallet && (
        <p className="text-center text-xs text-zinc-600">
          Wallet <AddressLink value={wallet.publicKey.toBase58()} />
        </p>
      )}
    </div>
  );
}
