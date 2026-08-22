"use client";

import { useEffect, useState } from "react";
import {
  Container,
  ProgramHeader,
  WalletGate,
  Card,
  Button,
  Badge,
  Input,
  Textarea,
  Label,
  AddressLink,
  Spinner,
  VotingIcon,
} from "@/components/ui";
import { PROGRAM_IDS } from "@/lib/constants";
import {
  useVoting,
  type PollAccount,
  type CandidateAccount,
  type PollStatus,
} from "@/components/useVoting";

export default function VotingPage() {
  return (
    <Container>
      <ProgramHeader
        title="Voting"
        programId={PROGRAM_IDS.voting.toBase58()}
        instructions={[
          "create_poll",
          "add_candidate",
          "activate_poll",
          "vote",
          "close_poll",
        ]}
        icon={<VotingIcon />}
      />
      <WalletGate>
        <VotingApp />
      </WalletGate>
    </Container>
  );
}

function VotingApp() {
  const v = useVoting();
  const { refreshPolls } = v;

  // Initial load. refreshPolls is external to this component, so calling it
  // here does not trip the "setState in effect" rule.
  useEffect(() => {
    refreshPolls();
  }, [refreshPolls]);

  return (
    <div className="animate-rise flex flex-col gap-6">
      <CreatePoll voting={v} />

      {/* Global tx feedback */}
      {v.error && (
        <div className="rounded-lg border border-red-500/25 bg-red-500/[.07] px-3 py-2 text-sm text-red-300 break-words">
          {v.error}
        </div>
      )}
      {v.txSig && !v.busy && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-brand-green/20 bg-brand-green/[.06] px-3 py-2 text-sm text-emerald-200">
          <span className="h-2 w-2 rounded-full bg-brand-green" />
          Confirmed — <AddressLink value={v.txSig} kind="tx" />
        </div>
      )}

      {/* Poll list */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-500">
          Polls {v.polls.length > 0 && `· ${v.polls.length}`}
        </h2>
        <button
          onClick={() => refreshPolls()}
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 transition-colors hover:text-zinc-300"
        >
          {v.loadingPolls ? <Spinner /> : "↻"} Refresh
        </button>
      </div>

      {v.loadingPolls && v.polls.length === 0 ? (
        <Card className="flex items-center gap-3 text-sm text-zinc-500">
          <Spinner /> Loading polls…
        </Card>
      ) : v.polls.length === 0 ? (
        <Card className="border-dashed py-10 text-center text-sm text-zinc-500">
          No polls yet. Create the first one above.
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {v.polls.map((poll) => (
            <PollCard key={poll.pubkey.toBase58()} poll={poll} voting={v} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ----------------------------- Create poll ----------------------------- */

function CreatePoll({ voting }: { voting: ReturnType<typeof useVoting> }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const creating = voting.busy === "create";

  const submit = async () => {
    if (!title.trim()) return;
    await voting.createPoll(title.trim(), description.trim());
    setTitle("");
    setDescription("");
  };

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className="text-brand-green">
          <VotingIcon />
        </span>
        <h2 className="font-semibold tracking-tight">Create a poll</h2>
      </div>
      <div>
        <Label>Title</Label>
        <Input
          value={title}
          maxLength={64}
          placeholder="Favourite L1?"
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div>
        <Label>Description</Label>
        <Textarea
          value={description}
          maxLength={200}
          rows={2}
          placeholder="What this poll is about…"
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div>
        <Button onClick={submit} loading={creating} disabled={!title.trim()}>
          Create poll
        </Button>
      </div>
    </Card>
  );
}

/* ------------------------------ Poll card ------------------------------ */

const STATUS_TONE: Record<PollStatus, "brand" | "green" | "muted"> = {
  draft: "muted",
  active: "green",
  closed: "brand",
};

function PollCard({
  poll,
  voting,
}: {
  poll: PollAccount;
  voting: ReturnType<typeof useVoting>;
}) {
  const [candidates, setCandidates] = useState<CandidateAccount[]>([]);
  const [voted, setVoted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [nowTs, setNowTs] = useState(0);
  const isCreator = voting.wallet?.publicKey.equals(poll.creator) ?? false;

  const { fetchCandidates, hasVoted } = voting;
  const pollKey = poll.pubkey.toBase58();

  // (Re)load this poll's candidates + vote status whenever it changes or a tx
  // lands. All setState lives inside the async closure (never synchronously in
  // the effect body), guarded by `active`.
  useEffect(() => {
    let active = true;
    (async () => {
      if (active) setLoading(true);
      try {
        const [cands, didVote] = await Promise.all([
          fetchCandidates(poll.pubkey),
          hasVoted(poll.pubkey),
        ]);
        if (active) {
          setCandidates(cands);
          setVoted(didVote);
          setNowTs(Math.floor(Date.now() / 1000));
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
    // Re-run when the tally/status changes (identity changes on refreshPolls).
  }, [pollKey, poll.totalVotes, poll.status, fetchCandidates, hasVoted, poll.pubkey]);

  const timeLeft = poll.endTime - nowTs;

  return (
    <Card className="border-gradient flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-lg font-semibold tracking-tight">
              {poll.title}
            </h3>
            <Badge tone={STATUS_TONE[poll.status]}>{poll.status}</Badge>
            {isCreator && <Badge tone="muted">your poll</Badge>}
          </div>
          {poll.description && (
            <p className="mt-1 text-sm text-zinc-400">{poll.description}</p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-2xl font-semibold tabular-nums text-gradient">
            {poll.totalVotes}
          </p>
          <p className="text-xs text-zinc-500">votes</p>
        </div>
      </div>

      {/* Meta */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
        <span>{poll.candidateCount} candidates</span>
        {poll.status === "active" && (
          <span className={timeLeft <= 0 ? "text-amber-400" : ""}>
            {timeLeft > 0 ? `${formatDuration(timeLeft)} left` : "voting window ended"}
          </span>
        )}
        <span className="inline-flex items-center gap-1">
          poll <AddressLink value={pollKey} />
        </span>
      </div>

      {/* Candidates */}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Spinner /> Loading candidates…
        </div>
      ) : candidates.length > 0 ? (
        <div className="flex flex-col gap-2">
          {candidates.map((c) => {
            const pct =
              poll.totalVotes > 0 ? (c.votes / poll.totalVotes) * 100 : 0;
            const canVote = poll.status === "active" && !voted && timeLeft > 0;
            return (
              <div
                key={c.index}
                className="relative overflow-hidden rounded-xl border border-white/[.07] bg-white/[.02] p-3"
              >
                <div
                  className="pointer-events-none absolute inset-y-0 left-0 bg-[linear-gradient(90deg,rgba(153,69,255,0.16),rgba(20,241,149,0.14))]"
                  style={{ width: `${pct}%` }}
                />
                <div className="relative flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-100">
                      {c.name}
                    </p>
                    <p className="text-xs tabular-nums text-zinc-500">
                      {c.votes} {c.votes === 1 ? "vote" : "votes"} · {pct.toFixed(0)}%
                    </p>
                  </div>
                  {canVote && (
                    <Button
                      variant="ghost"
                      onClick={() => voting.vote(poll, c.index)}
                      loading={voting.busy === "vote"}
                      className="shrink-0 !px-3 !py-1.5"
                    >
                      Vote
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-zinc-500">No candidates yet.</p>
      )}

      {voted && poll.status === "active" && (
        <p className="flex items-center gap-1.5 text-xs text-emerald-300">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-green" /> You&apos;ve
          voted in this poll
        </p>
      )}

      {/* Actions */}
      <PollActions poll={poll} voting={voting} isCreator={isCreator} />
    </Card>
  );
}

/* ---------------------------- Poll actions ---------------------------- */

function PollActions({
  poll,
  voting,
  isCreator,
}: {
  poll: PollAccount;
  voting: ReturnType<typeof useVoting>;
  isCreator: boolean;
}) {
  const [candidateName, setCandidateName] = useState("");
  const [minutes, setMinutes] = useState("60");

  if (poll.status === "closed") return null;

  const draftControls = poll.status === "draft" && isCreator;
  const canActivate = poll.candidateCount >= 2;

  return (
    <div className="flex flex-col gap-3 border-t border-white/[.06] pt-4">
      {draftControls && (
        <>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={candidateName}
              maxLength={32}
              placeholder="Add a candidate…"
              onChange={(e) => setCandidateName(e.target.value)}
              className="sm:flex-1"
            />
            <Button
              variant="ghost"
              disabled={!candidateName.trim() || poll.candidateCount >= 10}
              loading={voting.busy === "candidate"}
              onClick={async () => {
                await voting.addCandidate(poll, candidateName.trim());
                setCandidateName("");
              }}
            >
              Add candidate
            </Button>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                className="w-24"
              />
              <span className="text-sm text-zinc-500">min duration</span>
            </div>
            <Button
              disabled={!canActivate}
              loading={voting.busy === "activate"}
              onClick={() =>
                voting.activatePoll(poll, Math.max(1, Number(minutes)) * 60)
              }
            >
              Activate poll
            </Button>
            {!canActivate && (
              <span className="text-xs text-zinc-500">
                needs ≥ 2 candidates
              </span>
            )}
          </div>
        </>
      )}

      {poll.status === "active" && isCreator && (
        <div>
          <Button
            variant="danger"
            loading={voting.busy === "close"}
            onClick={() => voting.closePoll(poll)}
          >
            Close poll
          </Button>
        </div>
      )}

      {poll.status === "draft" && !isCreator && (
        <p className="text-sm text-zinc-500">
          Waiting for the creator to add candidates and activate this poll.
        </p>
      )}
    </div>
  );
}

function formatDuration(seconds: number): string {
  if (seconds >= 86400) return `${Math.floor(seconds / 86400)}d`;
  if (seconds >= 3600) return `${Math.floor(seconds / 3600)}h`;
  if (seconds >= 60) return `${Math.floor(seconds / 60)}m`;
  return `${seconds}s`;
}
