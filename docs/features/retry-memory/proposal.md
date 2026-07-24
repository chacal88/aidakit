# Proposal — retry-memory

**Change ID:** `retry-memory`
**Date:** `2026-07-24`
**Owner:** `@chacal88`
**Phase / Package:** `engine + flows (governance/) + skills — structured retry history for the implement loop`
**PRD:** `n/a`
**Tech Spec:** `n/a`

## Why

The `full` flow already caps runaway loops mechanically ([engine-max-visits](../engine-max-visits/proposal.md)), but it capped them **blindly**: when `check_implement_bench`, `review_bench` (via `bench_outcome`) or the `critic` route re-queues an earlier step, the receiving skill is invoked FRESH — the same prompt, the same context, no memory of why the previous round failed. So round N+1 of `aidakit:implement` sees "please implement <change>" and often re-produces the same defect that round N was rejected for, burning tokens on a loop that is bounded (by `max_visits`) but not INFORMED.

The [EPIC-flow-engine-leashes](../../roadmap/epics/EPIC-flow-engine-leashes.md) `Feature: Retry com memória` line makes the contract explicit:

> ao voltar para `implement`, o agente recebe histórico estruturado das tentativas (round, causa da falha em cada uma); os eventos de correção alimentam `aidakit:learn` como matéria-prima de DNA (erro recorrente ≥3x).

Two coupled outcomes:
- **Per-round context for the retrying skill** — a JSON array of `{round, cause}` handed to `aidakit:implement` (and, symmetrically, to `aidakit:plan` when `specify` re-enters via `critic: revise`) so it knows the shape of the previous rejections and can steer away from them.
- **Machine-readable correction stream for `aidakit:learn`** — the same records, keyed on stable snake_case `cause` identifiers, feed the `deriveCandidates(..., {threshold: 3})` funnel already documented in [aidakit:learn](../../../skills/learn/SKILL.md) §6 — a `cause` that recurs ≥3× across a change (or across changes, later) qualifies for DNA crystallization.

The record file is committed to git (`docs/features/<change-id>/retry-history.json`), not held in `.aidakit/` ephemeral state, for the same reason [ADR-007](../../decisions/ADR-007-roadmap-status-from-shared-git.md) / [ADR-009](../../decisions/ADR-009-flow-commits-plan-early.md) forced the plan to be committed early: a signal that is only visible in one worktree is not a signal.

## What Changes

- **New sidecar file per change** — `docs/features/${change_id}/retry-history.json`: a JSON array of `{round, step_id, cause}` records. Written by the engine (single writer, see design), read by the retrying skill on the next round and by `aidakit:learn` at the tail of the flow. Committed to git as part of the change's docs.
- **Cause-emission contract on failing steps** — `check_implement_bench`, `review_bench` and `critic` are extended to report a `cause=<snake_case_key>` on their failing outcome branch, using the resume-outputs mechanism of [ADR-006](../../decisions/ADR-006-flow-values-as-data.md) for invoke steps (`review_bench.rejected`, `critic.revise` declare `outputs: {<outcome>: [cause]}`) and a sidecar cause-file for runs steps (`check_implement_bench.on_failure` reads the `cause` written by `check-bench.js` to `.aidakit/tasks/<id>/last-cause`, then a new `record_check_implement_cause` runs-step appends to `retry-history.json` before routing to `implement`).
- **Engine writes the append; single writer** — a new zero-dep validator/helper `governance/validators/append-retry-history.js` (invoked from short `runs` steps positioned on each failure branch that leads back to `implement`/`specify`) writes one record atomically. The `round` field is READ from `state.context.__visits[target_step_id]` at write time — no separate counter, no re-invention of the mechanism [engine-max-visits](../engine-max-visits/design.md) already delivered.
- **Read-side injection into the retrying skill** — the `implement` invoke step's `input:` map gets `retry_history_path: "docs/features/${context.select.change_id}/retry-history.json"` (safe change_id interpolation per ADR-006 §3 — a path, never spliced into any shell). `aidakit:implement` (and `aidakit:plan` for the specify loop) read the file at the start of each round; when the file is absent or empty, round 1 semantics apply unchanged. This is the READ side of the "$AIDAKIT_RETRY_HISTORY" contract the brainstorm named.
- **Correction-event bridge to `aidakit:learn`** — the `learn` step's input map gets `retry_history_path` too, and the skill emits a `correction` event to `.aidakit/tasks/<change-id>/events.ndjson` for each record, using the ledger's existing `errorType`+`key` grouping (`errorType: "retry-cause"`, `key: <cause>`), so `deriveCandidates(change-id, {threshold: 3})` picks up recurrence with **no changes to the ledger module** — it already groups by that pair.
- **Starter cause-key registry** — see [design.md §Cause-key registry](design.md#cause-key-registry): `test-failure`, `bench-veto-security`, `bench-veto-architecture`, `bench-veto-quality`, `critic-reject`, `readiness-not-ready`, `check-failure`. Growth rule: adding a key is a doc-only PR; the validator does not enforce the closed set — the check is only that the value matches `RESUME_OUTPUT_VALUE_RE` (safe token). Registry lives in [design.md](design.md#cause-key-registry) until it grows large enough to earn its own guide.
- **Tests** — new `governance/__tests__/retry-memory.test.mjs`: append helper (record shape, atomic append, missing-dir create); resume-output extension on `review_bench`/`critic` (parser and driver — a resume without `cause=` re-pauses per ADR-006 fail-closed semantics); `full.yaml` schema (`implement.input.retry_history_path` present, `record_*_cause` runs steps wired on each failure branch); end-to-end drive that fails a round with `cause=critic-reject` and asserts `retry-history.json` contains `{round: 1, step_id: "specify", cause: "critic-reject"}` on the next entry.

## Non-goals

1. **Does not modify `state.context.__visits[step.id]`** or the max-visits mechanism itself — retry-memory READS `__visits` for `round`, it does not write to it. If the visit counter is missing (e.g. a very old flow state), `round` falls back to `1`. Independent counting would drift and would double the risk surface of [engine-max-visits](../engine-max-visits/proposal.md).
2. **Does not persist raw stdout/stderr in `retry-history.json`.** Only the snake_case `cause` key. A `cause: bench-veto-security` gives `aidakit:learn` everything it needs to bucket-count; the detail lives in the ledgers and the events file, not in a committed artifact. This is a git-visible file — noisy blobs would drown reviewers.
3. **Does not add a size cap on `retry-history.json`.** The file is bounded transitively by `max_visits` on the target step (already 3 for `specify`; when `implement` gets its own cap it will bound this too). A file of ≤ N records per target step per flow-run is not a scale problem.
4. **Does not touch `fast.yaml`.** `fast` has a `review → implement` back-edge that could benefit from the same mechanism, but scope-of-request is `full` first (matches the brainstorm and matches where `engine-max-visits` landed). Wiring `fast` is a follow-up change under the same epic.
5. **Does not introduce a new ADR.** The mechanism is fully expressible with [ADR-006](../../decisions/ADR-006-flow-values-as-data.md) (values as data, structured resume outputs) and [ADR-007](../../decisions/ADR-007-roadmap-status-from-shared-git.md) / [ADR-009](../../decisions/ADR-009-flow-commits-plan-early.md) (commit early so shared state is populated). The cause-key registry is a doc, not an ADR — no locked decision.
6. **Does not enforce a closed cause-key vocabulary in code.** The starter set is documented; the validator only checks the value is a safe single token (`RESUME_OUTPUT_VALUE_RE`, [ADR-006](../../decisions/ADR-006-flow-values-as-data.md) §2). Over-constraining would force an ADR the first time a new failure shape emerges. Growth rule keeps that friction low.
7. **Does not distinguish per-caller history** (e.g. history from `check_implement_bench` vs from `bench_outcome→implement`). Each record carries `step_id` (the failing source) but the retrying skill receives them as one ordered list — the round number is the retry axis, the source is metadata.

## Affected capabilities

- Engine mechanism — no new step type or new field, only a new zero-dep helper (`append-retry-history.js`) invoked from short `runs` steps and extended `outputs:` on two existing invoke steps.
- `full` flow — three failure branches gain a `record_*_cause` runs step in the position "between the failing step and the target of `on_failure`/`on_result`"; `implement`, `specify` and `learn` invoke steps gain a `retry_history_path` in `input:`.
- `aidakit:implement`, `aidakit:plan`, `aidakit:learn` skill instructions — updated to READ `input.retry_history_path` at start (and, for `learn`, to translate each record into a `correction` event).

**No `docs/specs/` in this repo** (confirmed same as [engine-max-visits/proposal.md](../engine-max-visits/proposal.md#affected-capabilities)) — no canonical capability spec exists yet for the retry-loop area. [spec-delta.md](spec-delta.md) proposes the addition of a first canonical spec (`docs/specs/flow-retry-loop.md`), promoted at archive time per [DOCS.md §4](../../../DOCS.md).

## Impact per surface

| Surface | Impact |
|---|---|
| `governance/validators/append-retry-history.js` (new) | zero-dep helper: reads `.aidakit/state/<flow_id>.json`, extracts `__visits[target_step_id]`, appends record to `docs/features/<change_id>/retry-history.json` atomically (write-tmp + rename). Fail-safe: missing state or missing dir → exit 0, no-op. |
| `governance/__tests__/retry-memory.test.mjs` (new) | append helper unit tests; resume-output extension parser/drive tests; `full.yaml` schema; end-to-end drive. |
| `governance/flows/full.yaml` | `review_bench.outputs = {rejected: [cause]}`, `critic.outputs = {revise: [cause]}`; three new `record_*_cause` runs steps on the branches back to `implement`/`specify`; `input.retry_history_path` added to `implement`, `specify`, `learn`. |
| `skills/implement/SKILL.md` | reads `retry_history_path`; when the file exists and is non-empty, PROMPT-preamble names each prior round's `cause` and asks the skill to explicitly steer away from it. |
| `skills/plan/SKILL.md` | same read pattern on the specify loop. |
| `skills/learn/SKILL.md` | reads `retry_history_path`; for each record appends a `{kind:"correction", errorType:"retry-cause", key:<cause>, phase:<step_id>}` line to `.aidakit/tasks/<change-id>/events.ndjson` (feeding the existing `deriveCandidates` funnel documented in [SKILL.md §6](../../../skills/learn/SKILL.md#6-crystallize-high-confidence-learnings-into-dna-executable-not-text)). |
| `docs/features/<change_id>/retry-history.json` (per change, at RUN time) | The artifact itself. Committed as part of the change's docs at merge time; birthed lazily on first retry (no file = round 1). |

## Dependencies

- **[engine-max-visits](../engine-max-visits/proposal.md) — SATISFIED in `main`** (PR #29, commit `73cefce`). Retry-memory reads `state.context.__visits[target_step_id]` for the `round` field; that counter is guaranteed to exist for any step re-entered via a back-edge in a post-#29 engine.
- **[flow-request-vs-change-id](../../archive/2026-07-24-flow-request-vs-change-id/proposal.md) / [ADR-006](../../decisions/ADR-006-flow-values-as-data.md) — SATISFIED in `main`** (PR #18). Retry-memory keys the sidecar path on `${context.select.change_id}` and uses the resume-output grammar (`cause=<key>`) exactly as that ADR designed it.
- **[flow-commit-plan-early](../../archive/2026-07-24-flow-commit-plan-early/proposal.md) / [ADR-009](../../decisions/ADR-009-flow-commits-plan-early.md) — SATISFIED in `main`** (PR #24, commit `38a83ac`). Because the plan (and now the retry-history file, which lives alongside it under `docs/features/<id>/`) is committed early, the shared-git derivation in [ADR-007](../../decisions/ADR-007-roadmap-status-from-shared-git.md) picks the change up as `in-progress` before the loop even starts.
- No new runtime dependency (Node stdlib only; the file lives on disk; the engine already persists `__visits` via `saveState`).

## Exit criteria

- `node governance/__tests__/retry-memory.test.mjs` → green.
- Full suite `governance/__tests__/*.test.mjs` → green (no regression).
- `node governance/__tests__/engine.test.mjs` → still 149/0 (no engine changes; new tests are in a dedicated file).
- `node governance/validators/derive-roadmap-status.js --root .` → exit 0; this change derives `in-progress` (directory exists).
- `node governance/validators/check-links.js docs/features/retry-memory` → exit 0.
- End-to-end drive test in `retry-memory.test.mjs`: two rounds of `full` where round 1 ends in `critic: revise cause=critic-reject`; on entry to `specify` round 2, `retry_history_path` resolves and `docs/features/<id>/retry-history.json` contains `[{round: 1, step_id: "specify", cause: "critic-reject"}]`; at `learn`, `events.ndjson` contains the matching `{kind:"correction", errorType:"retry-cause", key:"critic-reject"}` line.

## Unblocks

- Closes the `Feature: Retry com memória` line in [EPIC-flow-engine-leashes](../../roadmap/epics/EPIC-flow-engine-leashes.md), delivering the acceptance criterion verbatim.
- Feeds `aidakit:learn`'s DNA-promotion trigger with structured correction data (was previously reliant on scattered `errorType` inputs from ad-hoc reflection); the `≥3×` recurrence heuristic gets a first-class stream.
- Sets the pattern for symmetrical retry-memory in `fast.yaml` (follow-up change under this epic).

## Recorded decisions and inherited open decisions

- [EPIC-flow-engine-leashes](../../roadmap/epics/EPIC-flow-engine-leashes.md) Feature "Retry com memória" — the acceptance ("ao voltar para `implement`, o agente recebe histórico estruturado das tentativas (round, causa da falha em cada uma); os eventos de correção alimentam `aidakit:learn` como matéria-prima de DNA (erro recorrente ≥3x)") maps 1:1 to the two-sided design (per-round input to the retrying skill + correction-event stream to `learn`).
- [ADR-006](../../decisions/ADR-006-flow-values-as-data.md) — flow values as data: the `cause=<key>` reporting uses the resume-outputs mechanism (§2) — safe single tokens, fail-closed re-pause when missing. The `retry_history_path` interpolation on `input:` is the plain-string form the ADR explicitly permits for non-shell surfaces (§Decision 1: "prompts, invoke `input`" keep plain textual interpolation).
- [ADR-007](../../decisions/ADR-007-roadmap-status-from-shared-git.md) / [ADR-009](../../decisions/ADR-009-flow-commits-plan-early.md) — status derived from shared git + early plan commit. `retry-history.json` lives under `docs/features/<change-id>/` precisely so it is committed with the plan and visible from any worktree/clone, following the same reasoning as those ADRs.
- No new ADR — mechanism is fully expressible with existing decisions (see Non-goals #5).

No inherited open decisions block this change. The single tension is the READ-side injection shape (env var vs `input:` map) — the design resolves it via `input:` (plain-string path interpolation on a non-shell surface), which ADR-006 already sanctions.
