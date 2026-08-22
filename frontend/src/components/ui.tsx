"use client";

import Link from "next/link";
import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletButton } from "@/components/WalletButton";
import { explorerUrl } from "@/lib/constants";

/* ------------------------------- Layout ------------------------------- */

export function Container({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:py-14">
      {children}
    </main>
  );
}

export function Card({
  children,
  className = "",
  glow = false,
}: {
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border border-white/[.09] bg-white/[.026] p-6 backdrop-blur-sm ${
        glow ? "glow-purple" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

/* ------------------------------- Button ------------------------------- */

export function Button({
  children,
  onClick,
  disabled,
  loading,
  variant = "solid",
  type = "button",
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "solid" | "ghost" | "danger";
  type?: "button" | "submit";
  className?: string;
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0";
  const variants: Record<string, string> = {
    solid:
      "text-white bg-[linear-gradient(120deg,#9945ff,#7a5cff)] hover:brightness-110 hover:-translate-y-px hover:shadow-[0_10px_30px_-10px_rgba(153,69,255,0.8)]",
    ghost:
      "text-zinc-200 border border-white/[.14] bg-white/[.02] hover:bg-white/[.06] hover:border-white/[.24]",
    danger:
      "text-red-300 border border-red-500/25 bg-red-500/[.06] hover:bg-red-500/[.12]",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${base} ${variants[variant]} ${className}`}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

/* ------------------------------- Inputs ------------------------------- */

const fieldBase =
  "w-full rounded-xl border border-white/[.1] bg-white/[.03] px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition-colors focus:border-brand-purple/50 focus:bg-white/[.05]";

export function Input(
  props: React.InputHTMLAttributes<HTMLInputElement>
) {
  return <input {...props} className={`${fieldBase} ${props.className ?? ""}`} />;
}

export function Textarea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>
) {
  return (
    <textarea {...props} className={`${fieldBase} resize-none ${props.className ?? ""}`} />
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
      {children}
    </span>
  );
}

/* -------------------------- Address / Tx links -------------------------- */

export function AddressLink({
  value,
  kind = "address",
  label,
}: {
  value: string;
  kind?: "address" | "tx";
  label?: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Link
        href={explorerUrl(value, kind)}
        target="_blank"
        className="font-mono text-xs text-zinc-300 underline decoration-dotted decoration-white/30 underline-offset-2 transition-colors hover:text-brand-green hover:decoration-brand-green/60"
      >
        {label ?? `${value.slice(0, 6)}…${value.slice(-6)}`}
      </Link>
      <CopyButton value={value} />
    </span>
  );
}

export function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label="Copy to clipboard"
      onClick={() => {
        navigator.clipboard?.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        });
      }}
      className="text-zinc-500 transition-colors hover:text-zinc-200"
    >
      {copied ? <CheckIcon className="text-brand-green" /> : <CopyIcon />}
    </button>
  );
}

/* ------------------------------ Badges -------------------------------- */

export function Badge({
  children,
  tone = "brand",
}: {
  children: React.ReactNode;
  tone?: "brand" | "green" | "muted";
}) {
  const tones: Record<string, string> = {
    brand: "bg-brand-purple/15 text-purple-300 ring-1 ring-inset ring-brand-purple/25",
    green: "bg-brand-green/15 text-emerald-300 ring-1 ring-inset ring-brand-green/25",
    muted: "bg-white/[.06] text-zinc-400 ring-1 ring-inset ring-white/10",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

/* --------------------------- Program header --------------------------- */

export function ProgramHeader({
  title,
  programId,
  instructions,
  icon,
  children,
}: {
  title: string;
  programId: string;
  instructions: string[];
  icon?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-8 animate-rise">
      <Link
        href="/"
        className="mb-5 inline-flex items-center gap-1.5 text-xs text-zinc-500 transition-colors hover:text-zinc-300"
      >
        <ArrowLeftIcon /> All programs
      </Link>

      <div className="flex items-start gap-4">
        {icon && (
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[.03] text-brand-green">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-sm text-zinc-500">
            <span>Program</span>
            <AddressLink value={programId} />
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {instructions.map((ix) => (
          <code
            key={ix}
            className="rounded-md border border-white/[.06] bg-white/[.04] px-2 py-0.5 font-mono text-xs text-zinc-400"
          >
            {ix}
          </code>
        ))}
      </div>
      {children}
    </div>
  );
}

/* ------------------------------ Wallet gate --------------------------- */

/** Renders children only when a wallet is connected; otherwise a connect prompt. */
export function WalletGate({ children }: { children: React.ReactNode }) {
  const { connected } = useWallet();
  if (!connected) {
    return (
      <Card className="animate-rise flex flex-col items-center gap-4 border-dashed py-12 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-purple/10 text-brand-purple">
          <WalletIcon />
        </div>
        <div>
          <p className="font-medium text-zinc-200">Wallet not connected</p>
          <p className="mt-1 text-sm text-zinc-500">
            Connect a devnet wallet to interact with this program.
          </p>
        </div>
        <WalletButton />
      </Card>
    );
  }
  return <>{children}</>;
}

export function PendingWiring({ program }: { program: string }) {
  return (
    <Card className="animate-rise border-dashed">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/[.05] text-zinc-400">
          <ClockIcon />
        </div>
        <div>
          <p className="font-medium text-zinc-200">On-chain wiring coming soon</p>
          <p className="mt-1 text-sm text-zinc-500">
            Wiring for <span className="text-zinc-300">{program}</span> lands once
            the program is deployed to devnet and its IDL is added under{" "}
            <code className="rounded bg-white/[.06] px-1 py-0.5 font-mono text-xs text-zinc-300">
              src/idl/
            </code>
            . The wallet, RPC, and provider wiring above are already live.
          </p>
        </div>
      </div>
    </Card>
  );
}

/* -------------------------------- Icons ------------------------------- */

export function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        className="opacity-90"
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="9" y="9" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M5 12.5 10 17 19 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowLeftIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M14 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function WalletIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="6" width="18" height="13" rx="2.5" stroke="currentColor" strokeWidth="2" />
      <path d="M3 9h13a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H3" stroke="currentColor" strokeWidth="2" />
      <circle cx="16.5" cy="12.5" r="1.2" fill="currentColor" />
    </svg>
  );
}

/* Program icons — exported for the landing grid and program headers. */
export function CounterIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="4" width="18" height="16" rx="2.5" stroke="currentColor" strokeWidth="2" />
      <path d="M8 9v6M8 9l-2 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13 15h3M16 12v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function VotingIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 12l2.5 2.5L11 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" stroke="currentColor" strokeWidth="2" />
      <path d="M14 12h4M14 15.5h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function TokenIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="2" />
      <path d="M12 7v10M9.5 9.5c0-1.2 1.1-2 2.5-2s2.5.8 2.5 2-1.1 1.6-2.5 1.6-2.5.6-2.5 1.8 1.1 2 2.5 2 2.5-.8 2.5-2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
