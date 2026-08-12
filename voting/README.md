# Voting — program states & failure tests

Week 2 exercise: a poll program built around an explicit **state machine**,
with a **Token-2022 ballot token** and a test suite that leans on
**failure tests** (every custom error is asserted at least once).

## States

```
            activate_poll                close_poll
  Draft ───────────────────▶ Active ───────────────────▶ Closed
    │                          │
    │ create_poll,             │ vote (until end_time)
    │ add_candidate            │
```

| State | What's allowed | Guarded by |
|-------|----------------|-----------|
| `Draft` | add candidates (creator only) | `PollNotDraft`, `Unauthorized` |
| `Active` | vote, one per wallet, until `end_time` | `PollNotActive`, `PollEnded` |
| `Closed` | nothing — tallies are final | `PollNotActive` |

Activation requires ≥ 2 candidates (`NotEnoughCandidates`) and a positive
duration (`InvalidDuration`). The creator may close early; anyone else can
close only after `end_time` (`PollNotEnded`).

## Accounts (all PDAs)

- `Poll` — `["poll", creator, poll_id]`: status, tallies, timing.
- `Candidate` — `["candidate", poll, index]`: one per option, added in Draft.
- `VoteReceipt` — `["vote", poll, voter]`: created on vote; its existence is
  what makes double voting impossible (the second `init` fails).
- Ballot mint — `["mint", poll]`: a **Token-2022** mint whose
  **TokenMetadata extension** stores the poll title on the mint account
  itself. Each vote mints exactly one ballot token to the voter's ATA as
  proof of participation. The `Poll` PDA is the mint authority and signs
  the CPIs.

## Run it

```bash
anchor build
cargo test    # 18 LiteSVM tests: 5 happy-path, 13 failure tests
```

The failure tests cover: wrong state for every instruction, unauthorized
signers, double voting, voting after the deadline (clock warping), string
length limits, the candidate cap, and closing rules.
