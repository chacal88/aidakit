# Evidence — retry-memory

**Change ID:** `retry-memory`
**Date:** `2026-07-24`
**Owner:** `@chacal88`
**Phase / Package:** `engine + flows (governance/) + skills — structured retry history for the implement loop`

## Tests

- [ ] `node governance/__tests__/retry-memory.test.mjs` → **N passed, 0 failed** (fill in after implementation)
  - [ ] §1 Append helper — 6 subtests (`1a` create, `1b` append, `1c` empty-arg no-op, `1d` invalid cause, `1e` atomic write, `1f` round from state)
  - [ ] §2 Resume-output extension — 3 subtests (`2a` parser accept, `2b` re-pause, `2c` context populated)
  - [ ] §3 `full.yaml` schema — 4 subtests (`3a` input path, `3b` outputs shape, `3c` record steps exist, `3d` back-edges wired)
  - [ ] §4 End-to-end drive — 3 subtests (`4a` single revise round, `4b` learn correction event, `4c` exhaustion → escalation)
  - [ ] §env AIDAKIT_FLOW_ID surface in runs children — 1 subtest
- [ ] `node governance/__tests__/engine.test.mjs` → **149 passed, 0 failed** (unchanged — engine core untouched save the one-line `AIDAKIT_FLOW_ID` addition covered by §env)
- [ ] Full suite — per-file counts:
  ```
  candidates.test.mjs       :: 8 passed, 0 failed
  check-adr-format.test.mjs :: 8 passed, 0 failed
  check-bench.test.mjs      :: 20 passed, 0 failed
  check-docs.test.mjs       :: 8 passed, 0 failed
  check-links.test.mjs      :: 7 passed, 0 failed
  dna-freshness.test.mjs    :: 7 passed, 0 failed
  dna-write.test.mjs        :: 14 passed, 0 failed
  engine.test.mjs           :: 149 passed, 0 failed
  ledger.test.mjs           :: 8 passed, 0 failed
  plugin-version.test.mjs   :: 12 passed, 0 failed
  pr-automation.test.mjs    :: 161 passed, 0 failed
  progress-table.test.mjs   :: 30 passed, 0 failed
  retry-memory.test.mjs     :: N passed, 0 failed   (this change)
  roadmap.test.mjs          :: 28 passed, 0 failed
  yaml-min.test.mjs         :: 17 passed, 0 failed
  ```
  Fill in `N` after implementation. Any regression in another file blocks the change.

## Manual verification

- [ ] Drive `full` locally for a throwaway change-id:
  1. Start the flow, reach `critic`, resume with `resume <flow_id> revise cause=critic-reject`.
  2. Confirm `docs/features/<change-id>/retry-history.json` exists on disk with one record `{round:1, step_id:"specify", cause:"critic-reject"}`.
  3. Re-enter `specify` and confirm the invoke pause carries `input.retry_history_path` (visible in the pause prompt).
  4. Simulate a `specify` success then `critic: ok`; confirm the file is unchanged (no bookkeeping on success).
- [ ] Drive to `learn`; simulate `aidakit:learn` emitting the correction event; confirm `deriveCandidates(<change-id>, {threshold:1})` returns the expected candidate (via a small ad-hoc `node -e` snippet).

## Docs/ADR updates

- [ ] No new ADR — mechanism is fully expressible with existing decisions ([ADR-006](../../decisions/ADR-006-flow-values-as-data.md), [ADR-007](../../decisions/ADR-007-roadmap-status-from-shared-git.md), [ADR-009](../../decisions/ADR-009-flow-commits-plan-early.md)). Reasoning captured in [proposal.md #Non-goals](proposal.md#non-goals) item 5.
- [ ] Skill updates: [skills/implement/SKILL.md](../../../skills/implement/SKILL.md), [skills/plan/SKILL.md](../../../skills/plan/SKILL.md), [skills/learn/SKILL.md](../../../skills/learn/SKILL.md) — each gains one paragraph on the retry-history read (§7 of [tasks.md](tasks.md)).
- [ ] Cause-key registry lives in [design.md #Cause-key registry](design.md#cause-key-registry). Growth rule (doc-only PR) documented; no code-level enforcement (see [proposal.md #Non-goals](proposal.md#non-goals) item 6).
- [ ] Spec-delta: this change proposes the FIRST canonical spec under `docs/specs/` (see [spec-delta.md](spec-delta.md)). Because `docs/specs/` does not yet exist in this repo, the delta doubles as a proposal for the spec's initial content, to be promoted at archive time per [DOCS.md §4](../../../DOCS.md).
- [ ] Doc-manifest for this change (`.aidakit/tasks/retry-memory/doc-manifest.json`) is authored by the `document` step of the flow, not this task list.

## Roadmap impact

- [ ] [EPIC-flow-engine-leashes](../../roadmap/epics/EPIC-flow-engine-leashes.md) — the `Feature: Retry com memória` acceptance is met (see [proposal.md #Why](proposal.md#why) — 1:1 mapping to the epic line).
- [ ] `node governance/validators/derive-roadmap-status.js --root .` → exit 0; `retry-memory` derives `in-progress` from the presence of `docs/features/retry-memory/` (committed early per [ADR-009](../../decisions/ADR-009-flow-commits-plan-early.md)); moves to `done` at archive time.
- [ ] Follow-up unblocked: wire `fast.yaml`'s `review → implement` back-edge with the same mechanism (Non-goal #4 in [proposal.md](proposal.md#non-goals)); refine `check-bench.js` and `hardening` cause granularity (design.md notes).

## Unresolved Deviations

- [ ] (empty during planning; will list any deviations from the plan encountered at implementation time — same shape as [engine-max-visits/evidence.md #Deviations from the plan](../engine-max-visits/evidence.md#deviations-from-the-plan))
