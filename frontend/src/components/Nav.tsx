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
] as const;

export function Nav() {
  const pathname = usePathname();
  const sol = useBalance();

  return (
    <header className="sticky top-0 z-20 border-b border-black/[.08] bg-white/80 backdrop-blur dark:border-white/[.12] dark:bg-black/60">
      <nav className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
        <Link href="/" className="font-semibold tracking-tight">
          solana-dev
        </Link>
        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
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
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                  active
                    ? "bg-black/[.06] font-medium dark:bg-white/[.10]"
                    : "text-zinc-600 hover:bg-black/[.04] dark:text-zinc-400 dark:hover:bg-white/[.06]"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-3">
          {sol !== null && (
            <span className="hidden text-sm tabular-nums text-zinc-600 dark:text-zinc-400 sm:inline">
              {sol.toFixed(3)} SOL
            </span>
          )}
          <WalletButton />
        </div>
      </nav>
    </header>
  );
}
