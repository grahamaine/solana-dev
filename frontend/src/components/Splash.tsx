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
      className={`fixed inset-0 z-50 overflow-hidden bg-[#07060c] transition-opacity duration-400 ${
        fading ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
      aria-hidden={fading}
    >
      <Image
        src="/splash-hero.jpg"
        alt=""
        fill
        priority
        className="animate-splash-pop object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#07060c] via-transparent to-[#07060c]/40" />

      <div className="relative flex h-full flex-col items-center justify-end gap-4 pb-16">
        <p
          className="animate-splash-pop text-lg font-semibold tracking-tight drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]"
          style={{ animationDelay: "150ms" }}
        >
          Neon <span className="text-gradient">NFT Portal</span>
        </p>

        <div className="h-1 w-28 overflow-hidden rounded-full bg-white/[.12]">
          <div className="h-full w-1/2 rounded-full bg-[linear-gradient(90deg,#9945ff,#14f195)] animate-splash-bar" />
        </div>
      </div>
    </div>
  );
}
