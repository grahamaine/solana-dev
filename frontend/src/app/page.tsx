import Link from "next/link";
import {
  Container,
  Card,
  Badge,
  CounterIcon,
  VotingIcon,
  TokenIcon,
  MarketplaceIcon,
} from "@/components/ui";
import { PROGRAM_IDS, CLUSTER } from "@/lib/constants";

const PROGRAMS = [
  {
    href: "/counter",
    title: "Counter",
    blurb: "A PDA counter: initialize, increment, decrement, reset.",
    id: PROGRAM_IDS.counter.toBase58(),
    icon: <CounterIcon />,
    status: "live" as const,
  },
  {
    href: "/voting",
    title: "Voting",
    blurb:
      "On-chain polls: create a poll, add candidates, activate, vote, close.",
    id: PROGRAM_IDS.voting.toBase58(),
    icon: <VotingIcon />,
    status: "soon" as const,
  },
  {
    href: "/token",
    title: "Token System",
    blurb: "SPL token flows: create, mint, transfer, burn, update metadata.",
    id: PROGRAM_IDS.tokenSystem.toBase58(),
    icon: <TokenIcon />,
    status: "soon" as const,
  },
  {
    href: "/nft-marketplace",
    title: "NFT Marketplace",
    blurb:
      "Fixed-price listings and timed auctions for existing NFTs, with a marketplace fee.",
    id: PROGRAM_IDS.nftMarketplace.toBase58(),
    icon: <MarketplaceIcon />,
    status: "live" as const,
  },
] as const;

export default function Home() {
  return (
    <Container>
      {/* Hero */}
      <section className="mb-14 max-w-2xl animate-rise">
        <Badge tone="brand">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-purple" />
          Anchor · {CLUSTER}
        </Badge>
        <h1 className="mt-5 text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
          Build on <span className="text-gradient">Solana</span>,
          <br />
          program by program.
        </h1>
        <p className="mt-5 text-lg text-zinc-400">
          A single frontend for four Anchor programs on Solana devnet. Connect a
          wallet in the top-right, then dive into any program below.
        </p>
      </section>

      {/* Program grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PROGRAMS.map((p, i) => (
          <Link
            key={p.href}
            href={p.href}
            className="animate-rise"
            style={{ animationDelay: `${80 + i * 70}ms` }}
          >
            <Card className="border-gradient group h-full transition-all duration-300 hover:-translate-y-1 hover:bg-white/[.045]">
              <div className="flex items-center justify-between">
                <div className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/[.03] text-brand-green">
                  {p.icon}
                </div>
                {p.status === "live" ? (
                  <Badge tone="green">live</Badge>
                ) : (
                  <Badge tone="muted">soon</Badge>
                )}
              </div>

              <h2 className="mt-4 text-lg font-semibold tracking-tight">
                {p.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                {p.blurb}
              </p>

              <div className="mt-5 flex items-center justify-between border-t border-white/[.06] pt-3">
                <span className="font-mono text-xs text-zinc-500">
                  {p.id.slice(0, 6)}…{p.id.slice(-6)}
                </span>
                <span className="text-zinc-500 transition-all group-hover:translate-x-0.5 group-hover:text-brand-green">
                  →
                </span>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {/* Footer note */}
      <p className="mt-10 text-center text-xs text-zinc-600">
        Deployed to Solana {CLUSTER} · powered by Anchor &amp; the Wallet Adapter
      </p>
    </Container>
  );
}
