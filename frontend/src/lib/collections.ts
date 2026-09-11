/** Curated set of well-known Solana NFT collections used for the "live
 *  market" reference panels (trending stats + real listings). Shared
 *  between /api/market and /api/market/listings so both stay in sync. */
export const COLLECTIONS = [
  { symbol: "okay_bears", name: "Okay Bears" },
  { symbol: "degods", name: "DeGods" },
  { symbol: "solana_monkey_business", name: "SMB" },
  { symbol: "y00ts", name: "y00ts" },
  { symbol: "mad_lads", name: "Mad Lads" },
  { symbol: "claynosaurz", name: "Claynosaurz" },
  { symbol: "famous_fox_federation", name: "Famous Fox Federation" },
  { symbol: "the_heist_by_dreadfulz", name: "The Heist" },
  { symbol: "retardio_cousins", name: "Retardio Cousins" },
  { symbol: "galactic_geckos", name: "Galactic Geckos" },
  { symbol: "taiyo_robotics", name: "Taiyo Robotics" },
  { symbol: "smyths", name: "Smyths" },
] as const;
