/**
 * Week 5 — DeFi exercise: read a Pyth oracle price and a Jupiter swap quote
 * for the same pair, then compute the spread between them — the gap
 * between the "reference" price and what you'd actually get executing a
 * real swap right now (slippage + fees + routing, at that trade size).
 *
 * Usage:
 *   npm run spread                  # 1 SOL -> USDC, default pair
 *   npm run spread -- --amount 5    # 5 SOL -> USDC
 */
import { Connection, clusterApiUrl } from "@solana/web3.js";
import { PythHttpClient, PriceStatus, getPythProgramKeyForCluster } from "@pythnetwork/client";

const SOL = {
  mint: "So11111111111111111111111111111111111111112",
  decimals: 9,
  symbol: "SOL",
};
const USDC = {
  mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  decimals: 6,
  symbol: "USDC",
};

const STALE_AFTER_SECONDS = 30;
const JUPITER_QUOTE_URL = "https://quote-api.jup.ag/v6/quote";

// Hermes (Pyth's off-chain aggregator API) is used only as a fallback: see
// fetchOnChainDevnetPrice()'s doc comment for why the on-chain devnet feed
// this exercise asks for often has nothing live to read.
const HERMES_URL = "https://hermes.pyth.network/v2/updates/price/latest";
const SOL_USD_HERMES_FEED_ID =
  "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56";

interface PythPrice {
  price: number;
  confidence: number;
  publishTime: number; // unix seconds
  source: string;
}

interface JupiterQuote {
  inAmount: string;
  outAmount: string;
  priceImpactPct: string;
}

/**
 * Reads SOL/USD off Pyth's on-chain price account on Solana **devnet**
 * (program `gSbePebfvPy7tRqimPoVecS2UsBvYv46ynrzWocc92s`), the way this
 * exercise asks for — not Hermes.
 *
 * In practice this devnet deployment is not kept continuously updated:
 * `PriceStatus` comes back `Unknown` with a `timestamp` that's often
 * months old, because Pyth's production price flow has moved to the
 * pull-oracle model (Hermes + on-demand on-chain updates) and the classic
 * always-on devnet price accounts are a legacy leftover. Returns `null`
 * when the feed has no live trading price so the caller can fall back.
 */
async function fetchOnChainDevnetPrice(): Promise<PythPrice | null> {
  const connection = new Connection(clusterApiUrl("devnet"));
  const pythProgramKey = getPythProgramKeyForCluster("devnet");
  const client = new PythHttpClient(connection, pythProgramKey);
  const data = await client.getData();
  const priceData = data.productPrice.get("Crypto.SOL/USD");

  if (
    !priceData ||
    priceData.status !== PriceStatus.Trading ||
    priceData.price === undefined ||
    priceData.confidence === undefined
  ) {
    return null;
  }

  return {
    price: priceData.price,
    confidence: priceData.confidence,
    publishTime: Number(priceData.timestamp),
    source: "Pyth on-chain devnet feed",
  };
}

/** Fallback used only when the on-chain devnet feed isn't live. */
async function fetchHermesPrice(): Promise<PythPrice> {
  const url = `${HERMES_URL}?ids[]=${SOL_USD_HERMES_FEED_ID}&parsed=true`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Hermes request failed: ${res.status} ${await res.text()}`);
  }
  const body = await res.json();
  const parsed = body.parsed?.[0];
  if (!parsed) {
    throw new Error("Hermes returned no parsed price for the SOL/USD feed");
  }
  const { price, conf, expo, publish_time } = parsed.price;
  return {
    price: Number(price) * 10 ** expo,
    confidence: Number(conf) * 10 ** expo,
    publishTime: publish_time,
    source: "Hermes (fallback — devnet feed unavailable)",
  };
}

/** Jupiter has no separate "devnet" quote service — it routes real mainnet
 * liquidity, so the quote call always targets mainnet regardless of where
 * the Pyth price came from. */
async function fetchJupiterQuote(
  inputMint: string,
  outputMint: string,
  amountAtomic: bigint,
): Promise<JupiterQuote> {
  const url = `${JUPITER_QUOTE_URL}?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountAtomic}&slippageBps=50`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Jupiter request failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

function parseAmountArg(): number {
  const flagIndex = process.argv.indexOf("--amount");
  if (flagIndex === -1) return 1;
  const value = Number(process.argv[flagIndex + 1]);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("--amount must be a positive number");
  }
  return value;
}

async function main() {
  const amountSol = parseAmountArg();
  const amountAtomic = BigInt(Math.round(amountSol * 10 ** SOL.decimals));

  let pyth = await fetchOnChainDevnetPrice();
  if (!pyth) {
    console.warn(
      "Pyth's on-chain devnet SOL/USD feed has no live trading price right now " +
        "(status != Trading — this legacy devnet deployment isn't continuously updated). " +
        "Falling back to Hermes for a live number.\n",
    );
    pyth = await fetchHermesPrice();
  }

  const quote = await fetchJupiterQuote(SOL.mint, USDC.mint, amountAtomic);

  const inSol = Number(quote.inAmount) / 10 ** SOL.decimals;
  const outUsdc = Number(quote.outAmount) / 10 ** USDC.decimals;
  const jupiterPrice = outUsdc / inSol;

  const spread = jupiterPrice - pyth.price;
  const spreadPct = (spread / pyth.price) * 100;
  const ageSeconds = Math.floor(Date.now() / 1000) - pyth.publishTime;
  const staleness =
    ageSeconds > STALE_AFTER_SECONDS
      ? `  ⚠ STALE (>${STALE_AFTER_SECONDS}s threshold)`
      : "";

  console.log(`\n${SOL.symbol}/${USDC.symbol} — oracle vs. executable price\n`);
  console.log(`  Source: ${pyth.source}`);
  console.log(`  SOL/USD (Pyth): $${pyth.price.toFixed(4)} +/- $${pyth.confidence.toFixed(4)}`);
  console.log(`  Last updated: ${ageSeconds}s ago${staleness}`);
  console.log(`  ${SOL.symbol}/${USDC.symbol} (Jupiter): $${jupiterPrice.toFixed(4)} (for ${amountSol} ${SOL.symbol})`);
  console.log(`  Jupiter price impact: ${quote.priceImpactPct}%`);
  console.log(`  Spread: $${spread.toFixed(4)} (${spreadPct.toFixed(3)}%)`);
  console.log(
    spread < 0
      ? `  -> Jupiter fills below the Pyth mark; the trade is cheaper than the oracle price.`
      : `  -> Jupiter fills above the Pyth mark; the trade costs more than the oracle price.`,
  );
  console.log();
}

main().catch((err) => {
  console.error("spread check failed:", err.message ?? err);
  process.exit(1);
});
