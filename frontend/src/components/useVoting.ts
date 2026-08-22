"use client";

import { useCallback, useMemo, useState } from "react";
import { useConnection, useAnchorWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider, Program, BN } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import idl from "@/idl/voting.json";
import type { Voting } from "@/idl/voting";

/** Token-2022 + Associated Token program ids (the voting program mints
 *  Token-2022 ballot tokens, so these are fixed, well-known addresses). */
const TOKEN_2022_PROGRAM_ID = new PublicKey(
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
);
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
);

const PROGRAM_ID = new PublicKey(idl.address);

/* ------------------------------ Types ------------------------------ */

export type PollStatus = "draft" | "active" | "closed";

export type PollAccount = {
  pubkey: PublicKey;
  creator: PublicKey;
  pollId: bigint;
  title: string;
  description: string;
  status: PollStatus;
  candidateCount: number;
  totalVotes: number;
  startTime: number;
  endTime: number;
};

export type CandidateAccount = {
  pubkey: PublicKey;
  index: number;
  name: string;
  votes: number;
};

/* --------------------------- Seed helpers --------------------------- */

const enc = new TextEncoder();

/** little-endian u64 as a Uint8Array — avoids needing a Buffer polyfill. */
function u64le(value: bigint): Uint8Array {
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setBigUint64(0, value, true);
  return bytes;
}

function pollPda(creator: PublicKey, pollId: bigint): PublicKey {
  return PublicKey.findProgramAddressSync(
    [enc.encode("poll"), creator.toBytes(), u64le(pollId)],
    PROGRAM_ID
  )[0];
}

function mintPda(poll: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [enc.encode("mint"), poll.toBytes()],
    PROGRAM_ID
  )[0];
}

function candidatePda(poll: PublicKey, index: number): PublicKey {
  return PublicKey.findProgramAddressSync(
    [enc.encode("candidate"), poll.toBytes(), Uint8Array.of(index)],
    PROGRAM_ID
  )[0];
}

function receiptPda(poll: PublicKey, voter: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [enc.encode("vote"), poll.toBytes(), voter.toBytes()],
    PROGRAM_ID
  )[0];
}

function ballotAta(owner: PublicKey, mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [owner.toBytes(), TOKEN_2022_PROGRAM_ID.toBytes(), mint.toBytes()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  )[0];
}

// Anchor returns rust enums as `{ draft: {} } | { active: {} } | { closed: {} }`.
function decodeStatus(status: Record<string, unknown>): PollStatus {
  if ("active" in status) return "active";
  if ("closed" in status) return "closed";
  return "draft";
}

/* ------------------------------ Hook ------------------------------ */

export function useVoting() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  const program = useMemo(() => {
    if (!wallet) return null;
    const provider = new AnchorProvider(connection, wallet, {
      commitment: "confirmed",
    });
    return new Program(idl as Voting, provider);
  }, [connection, wallet]);

  const [polls, setPolls] = useState<PollAccount[]>([]);
  const [loadingPolls, setLoadingPolls] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [txSig, setTxSig] = useState<string | null>(null);

  const refreshPolls = useCallback(async () => {
    if (!program) return;
    setLoadingPolls(true);
    try {
      const all = await program.account.poll.all();
      const mapped: PollAccount[] = all.map(({ publicKey, account }) => ({
        pubkey: publicKey,
        creator: account.creator,
        pollId: BigInt(account.pollId.toString()),
        title: account.title,
        description: account.description,
        status: decodeStatus(account.status as Record<string, unknown>),
        candidateCount: account.candidateCount,
        totalVotes: Number(account.totalVotes),
        startTime: Number(account.startTime),
        endTime: Number(account.endTime),
      }));
      // Newest first, by activation/creation time then poll id.
      mapped.sort((a, b) =>
        b.startTime - a.startTime || Number(b.pollId - a.pollId)
      );
      setPolls(mapped);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingPolls(false);
    }
  }, [program]);

  const fetchCandidates = useCallback(
    async (poll: PublicKey): Promise<CandidateAccount[]> => {
      if (!program) return [];
      const all = await program.account.candidate.all([
        { memcmp: { offset: 8, bytes: poll.toBase58() } },
      ]);
      return all
        .map(({ publicKey, account }) => ({
          pubkey: publicKey,
          index: account.index,
          name: account.name,
          votes: Number(account.votes),
        }))
        .sort((a, b) => a.index - b.index);
    },
    [program]
  );

  const hasVoted = useCallback(
    async (poll: PublicKey): Promise<boolean> => {
      if (!program || !wallet) return false;
      const info = await connection.getAccountInfo(
        receiptPda(poll, wallet.publicKey)
      );
      return info !== null;
    },
    [program, wallet, connection]
  );

  // Shared wrapper: track which action is in-flight, surface errors + the
  // signature, and refresh the poll list afterward.
  const run = useCallback(
    async (label: string, build: () => Promise<string>) => {
      if (!program || !wallet) return;
      setBusy(label);
      setError(null);
      setTxSig(null);
      try {
        const sig = await build();
        setTxSig(sig);
        await refreshPolls();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(null);
      }
    },
    [program, wallet, refreshPolls]
  );

  const createPoll = (title: string, description: string) =>
    run("create", () => {
      const pollId = BigInt(Date.now());
      const creator = wallet!.publicKey;
      const poll = pollPda(creator, pollId);
      return program!.methods
        .createPoll(new BN(pollId.toString()), title, description)
        .accountsPartial({
          creator,
          poll,
          ballotMint: mintPda(poll),
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    });

  const addCandidate = (poll: PollAccount, name: string) =>
    run("candidate", () =>
      program!.methods
        .addCandidate(name)
        .accountsPartial({
          creator: wallet!.publicKey,
          poll: poll.pubkey,
          candidate: candidatePda(poll.pubkey, poll.candidateCount),
          systemProgram: SystemProgram.programId,
        })
        .rpc()
    );

  const activatePoll = (poll: PollAccount, durationSeconds: number) =>
    run("activate", () =>
      program!.methods
        .activatePoll(new BN(durationSeconds))
        .accountsPartial({
          creator: wallet!.publicKey,
          poll: poll.pubkey,
        })
        .rpc()
    );

  const vote = (poll: PollAccount, candidateIndex: number) =>
    run("vote", () => {
      const voter = wallet!.publicKey;
      const mint = mintPda(poll.pubkey);
      return program!.methods
        .vote(candidateIndex)
        .accountsPartial({
          voter,
          poll: poll.pubkey,
          candidate: candidatePda(poll.pubkey, candidateIndex),
          receipt: receiptPda(poll.pubkey, voter),
          ballotMint: mint,
          voterBallotAccount: ballotAta(voter, mint),
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    });

  const closePoll = (poll: PollAccount) =>
    run("close", () =>
      program!.methods
        .closePoll()
        .accountsPartial({
          signer: wallet!.publicKey,
          poll: poll.pubkey,
        })
        .rpc()
    );

  return {
    wallet,
    polls,
    loadingPolls,
    busy,
    error,
    txSig,
    refreshPolls,
    fetchCandidates,
    hasVoted,
    createPoll,
    addCandidate,
    activatePoll,
    vote,
    closePoll,
  };
}
