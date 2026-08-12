import Link from "next/link";
import { Container, Card } from "@/components/ui";
import { PROGRAM_IDS } from "@/lib/constants";

const PROGRAMS = [
  {
    href: "/counter",
    title: "Counter",
    blurb: "A PDA counter: initialize, increment, decrement, reset.",
    id: PROGRAM_IDS.counter.toBase58(),
  },
  {
    href: "/voting",
    title: "Voting",
    blurb:
      "On-chain polls: create a poll, add candidates, activate, vote, close.",
    id: PROGRAM_IDS.voting.toBase58(),
  },
  {
    href: "/token",
    title: "Token System",
    blurb: "SPL token flows: create, mint, transfer, burn, update metadata.",
    id: PROGRAM_IDS.tokenSystem.toBase58(),
  },
] as const;

export default function Home() {
  return (
    <Container>
      <section className="mb-12 max-w-2xl">
        <h1 className="text-4xl font-semibold leading-tight tracking-tight">
          Solana Devnet dApp
        </h1>
        <p className="mt-3 text-lg text-zinc-600 dark:text-zinc-400">
          A single frontend for three Anchor programs deployed to Solana
          devnet. Connect a wallet in the top-right, then explore each program.
        </p>
      </section>

      <div className="grid gap-4 sm:grid-cols-3">
        {PROGRAMS.map((p) => (
          <Link key={p.href} href={p.href}>
            <Card className="h-full transition-colors hover:border-emerald-500/50">
              <h2 className="text-lg font-semibold">{p.title}</h2>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                {p.blurb}
              </p>
              <p className="mt-4 font-mono text-xs text-zinc-500">
                {p.id.slice(0, 6)}…{p.id.slice(-6)}
              </p>
            </Card>
          </Link>
        ))}
      </div>
    </Container>
  );
}
