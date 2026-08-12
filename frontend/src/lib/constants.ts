import { PublicKey } from "@solana/web3.js";

/**
 * Solana cluster this dApp targets. All programs below are (to be) deployed to
 * devnet. Override the RPC via NEXT_PUBLIC_RPC_URL for a private/faster endpoint.
 */
export const CLUSTER = "devnet" as const;

export const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ?? "https://api.devnet.solana.com";

/**
 * On-chain program IDs (declare_id! in each Anchor program).
 * These are the addresses the programs deploy to on devnet.
 */
export const PROGRAM_IDS = {
  anchorStarter: new PublicKey("5QHECrupbXq7KZdpoEo14iE7mJ5UFek4m38Q2Q38NpXU"),
  counter: new PublicKey("68pjM74E2ow8dRxKPCh1cjcaHYEpAtjJRPJmxstQNCVp"),
  voting: new PublicKey("2QaArRLt7zTe3orXxpv1Epx9v5a4Ga9KbCp5655QbCtg"),
  tokenSystem: new PublicKey("7yzFYbiTKKjqyLmNUpBidXs8kRgn7BcpJJAN3NKQvkg5"),
} as const;

export const EXPLORER = "https://explorer.solana.com";

/** Build a Solana Explorer URL for an address or tx, pinned to devnet. */
export function explorerUrl(value: string, kind: "address" | "tx" = "address") {
  return `${EXPLORER}/${kind}/${value}?cluster=${CLUSTER}`;
}
