"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletButton } from "@/components/WalletButton";
import { useBalance } from "@/components/useBalance";
import { CLUSTER } from "@/lib/constants";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/counter", label: "Counter" },
  { href: "/voting", label: "Voting" },
  { href: "/token", label: "Token" },
  { href: "/nft-marketplace", label: "Neon Portal" },
] as const;

export function Nav() {
  const pathname = usePathname();
  const sol = useBalance();

  return (
    <header className="sticky top-0 z-30 border-b border-white/[.07] bg-[#07060c]/70 backdrop-blur-xl">
      <nav className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
        <Link href="/" className="group flex items-center gap-2.5">
          <LogoMark />
          <span className="text-[15px] font-semibold tracking-tight">
            solana<span className="text-gradient">-dev</span>
          </span>
        </Link>

        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-green/[.12] px-2.5 py-0.5 text-xs font-medium text-emerald-300 ring-1 ring-inset ring-brand-green/25">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-green animate-pulse-ring" />
          {CLUSTER}
        </span>

        <div className="ml-4 hidden gap-1 sm:flex">
          {LINKS.map((l) => {
            const active =
              l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`relative rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  active
                    ? "font-medium text-white"
                    : "text-zinc-400 hover:text-zinc-100"
                }`}
              >
                {l.label}
                {active && (
                  <span className="absolute inset-x-3 -bottom-px h-px bg-[linear-gradient(90deg,transparent,#14f195,transparent)]" />
                )}
              </Link>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-3">
          {sol !== null && (
            <span className="hidden items-center gap-1.5 rounded-lg border border-white/[.08] bg-white/[.03] px-2.5 py-1 text-sm tabular-nums text-zinc-300 sm:inline-flex">
              <span className="text-zinc-500">◎</span>
              {sol.toFixed(3)}
            </span>
          )}
          <WalletButton />
        </div>
      </nav>
    </header>
  );
}

function LogoMark() {
  return (
    <span className="relative grid h-8 w-8 place-items-center overflow-hidden rounded-lg bg-[#0d0b16] ring-1 ring-white/10 transition-shadow group-hover:shadow-[0_0_18px_-4px_rgba(153,69,255,0.7)]">
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
        <defs>
          <linearGradient id="logo-g" x1="0" y1="0" x2="24" y2="24">
            <stop stopColor="#9945FF" />
            <stop offset="1" stopColor="#14F195" />
          </linearGradient>
        </defs>
        <path d="M6 8.5h10.5L14 11H3.5L6 8.5Z" fill="url(#logo-g)" />
        <path d="M6 12.75h10.5L14 15.25H3.5L6 12.75Z" fill="url(#logo-g)" opacity="0.85" />
        <path d="M8 4.25h12.5L18 6.75H5.5L8 4.25Z" fill="url(#logo-g)" opacity="0.7" />
      </svg>
    </span>
  );
}
