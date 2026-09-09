import { PublicKey } from "@solana/web3.js";

/**
 * Solana cluster this dApp targets. All programs below are (to be) deployed to
 * devnet. Override the RPC via NEXT_PUBLIC_RPC_URL for a private/faster endpoint.
 */
export const CLUSTER = "devnet" as const;

export const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ?? "https://api.devnet.solana.com";

/**
 * On-chain program ID (declare_id! in the Anchor program) this dApp talks
 * to on devnet.
 */
export const PROGRAM_IDS = {
  nftMarketplace: new PublicKey("DPZVLmiip36N4TnJBghu7opiZTBx6C4LBH4j9WhRPEpN"),
} as const;

export const EXPLORER = "https://explorer.solana.com";

/** Build a Solana Explorer URL for an address or tx, pinned to devnet. */
export function explorerUrl(value: string, kind: "address" | "tx" = "address") {
  return `${EXPLORER}/${kind}/${value}?cluster=${CLUSTER}`;
}
