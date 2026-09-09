"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

/**
 * Brief branded splash shown on first paint. Lives in the root layout, so it
 * mounts once per full page load (not on client-side navigation between
 * pages, since the layout doesn't remount for those).
 */
export function Splash() {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFading(true), 700);
    const hideTimer = setTimeout(() => setVisible(false), 1100);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-[#07060c] transition-opacity duration-400 ${
        fading ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
      aria-hidden={fading}
    >
      <div className="animate-splash-pop relative h-28 w-28 drop-shadow-[0_0_50px_rgba(153,69,255,0.5)]">
        <Image src="/logo.png" alt="" fill priority className="object-contain" />
      </div>

      <p className="animate-splash-pop text-lg font-semibold tracking-tight" style={{ animationDelay: "80ms" }}>
        solana<span className="text-gradient">-dev</span>
      </p>

      <div className="h-1 w-28 overflow-hidden rounded-full bg-white/[.08]">
        <div className="h-full w-1/2 rounded-full bg-[linear-gradient(90deg,#9945ff,#14f195)] animate-splash-bar" />
      </div>
    </div>
  );
}
