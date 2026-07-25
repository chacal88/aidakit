# Evidence — retry-memory

**Change ID:** `retry-memory`
**Date:** `2026-07-24`
**Owner:** `@chacal88`
**Phase / Package:** `engine + flows (governance/) + skills — structured retry history for the implement loop`

## Tests

- [x] `node governance/__tests__/retry-memory.test.mjs` → **87 passed, 0 failed**
  - [x] §1 Append helper — 1a–1f + 1f-anti-drift (missing dir/file create, existing-file append/order, empty change_id/cause no-op, invalid cause exit 1, atomic write incl. stale `.tmp` overwrite, round from mock state incl. missing-state → null, anti-drift pin against `persistence.statePath`)
  - [x] §2-env — `AIDAKIT_FLOW_ID` surfaced to `runs` step children (a synthetic flow echoes it, asserted equal to `state.flow_id`)
  - [x] §2a–2c Resume-output extension on invoke — parser accepts `outputs: {revise: [cause]}` (compat guard, no code changed), re-pause without `cause=`, `context.<step>.cause` populated on a valid resume
  - [x] §3a–3d `full.yaml` schema — `retry_history_path` wired into `specify`/`implement`/`learn` inputs, `critic`/`readiness` `outputs` shape, the five `record_*_cause` runs steps exist with `on_success === on_failure === <target>`, back-edges route through them (no leftover direct edge)
  - [x] §4a–4c End-to-end drive — round-1 `critic: revise cause=critic-reject` writes the record and re-enters `specify`; round-2 `critic: ok` leaves the file unchanged; drive continues to `learn` and asserts `pause.input.retry_history_path`; the correction-event bridge (`events.ndjson` + `recordError`) is simulated and `deriveCandidates(..., {threshold:1})` finds it; a 3-round exhaustion asserts 3 accumulated records and the unchanged `specify_escalation` → `abort` semantic
- [x] `node governance/__tests__/engine.test.mjs` → **149 passed, 0 failed** (see "Deviations" — test `10d` was adapted, not left untouched, but the assertion COUNT and the escalation semantic it pins are unchanged)
- [x] Full suite — per-file counts (all green, no regressions):
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
  retry-memory.test.mjs     :: 87 passed, 0 failed   (this change, NEW file)
  roadmap.test.mjs          :: 28 passed, 0 failed
  yaml-min.test.mjs         :: 17 passed, 0 failed
  ```

## Manual verification

- [x] Covered end-to-end by §4a–4c of `retry-memory.test.mjs` (drives the real `full.yaml` through the engine, not a mock) — a manual CLI drive was not additionally performed; the automated e2e exercises the same seam (`startFlow`/`resumeFlow` against the real flow file, real `append-retry-history.js` subprocess via `runs`).

## Docs/ADR updates

- [x] No new ADR — mechanism is fully expressible with existing decisions ([ADR-006](../../decisions/ADR-006-flow-values-as-data.md), [ADR-007](../../decisions/ADR-007-roadmap-status-from-shared-git.md), [ADR-009](../../decisions/ADR-009-flow-commits-plan-early.md)). Reasoning captured in [proposal.md #Non-goals](proposal.md#non-goals) item 5.
- [x] Skill updates: [skills/implement/SKILL.md](../../../skills/implement/SKILL.md), [skills/plan/SKILL.md](../../../skills/plan/SKILL.md), [skills/learn/SKILL.md](../../../skills/learn/SKILL.md) — each gains the retry-history read (§7 of [tasks.md](tasks.md)). `implement`/`plan` needed the paragraph folded into their existing dispatch-prompt/prompt-building mechanics (not a bare standalone paragraph) to actually reach the downstream agent/session; `learn` got the literal Prerequisites bullet as specified.
- [x] Cause-key registry lives in [design.md #Cause-key registry](design.md#cause-key-registry). Growth rule (doc-only PR) documented; no code-level enforcement (see [proposal.md #Non-goals](proposal.md#non-goals) item 6).
- [x] Spec-delta: this change proposes the FIRST canonical spec under `docs/specs/` (see [spec-delta.md](spec-delta.md)). Because `docs/specs/` does not yet exist in this repo, the delta doubles as a proposal for the spec's initial content, to be promoted at archive time per [DOCS.md §4](../../../DOCS.md). **Known gap** (see Deviations): `check-links.js` flags the delta's forward reference to the not-yet-created `docs/specs/flow-retry-loop.md` as broken — this is intentional/self-documented in spec-delta.md's own "Merge instructions at archive time" section, not something introduced by this implementation.
- [ ] Doc-manifest for this change (`.aidakit/tasks/retry-memory/doc-manifest.json`) is authored by the `document` step of the flow, not this task list.

## Roadmap impact

- [x] [EPIC-flow-engine-leashes](../../roadmap/epics/EPIC-flow-engine-leashes.md) — the `Feature: Retry com memória` acceptance is met (see [proposal.md #Why](proposal.md#why) — 1:1 mapping to the epic line).
- [x] `node governance/validators/derive-roadmap-status.js --root .` → exit 0; `retry-memory` derives `in-progress` from the presence of `docs/features/retry-memory/` (committed early per [ADR-009](../../decisions/ADR-009-flow-commits-plan-early.md)); moves to `done` at archive time.
- [ ] Follow-up unblocked: wire `fast.yaml`'s `review → implement` back-edge with the same mechanism (Non-goal #4 in [proposal.md](proposal.md#non-goals)); refine `check-bench.js` and `hardening` cause granularity (design.md notes).

## Unresolved Deviations

1. **`governance/__tests__/engine.test.mjs` test `10d` required a mechanical adaptation** (not left untouched, contrary to design.md's Backwards-compatibility claim). `full.yaml`'s `critic.on_result.revise` now targets `record_critic_cause` and requires the `outputs: {revise: [cause]}` leash on every resume (design.md's own wiring diff, §`full.yaml` diff shape). Test `10d` (the max-visits cap E2E drive, added by `engine-max-visits`) resumed `critic` with a bare `"revise"` string — under the new wiring this re-pauses at `critic` requesting `cause=`, instead of advancing. Fixed by resuming with `{outcome: "revise", output: {cause: "critic-reject"}}` (the `resumeWith`-style structured answer the harness already supports). The assertion COUNT is unchanged (149/0 before and after) and the escalation semantic the test pins (3 dispatches, then `specify_escalation` → `abort`) is unchanged — only the resume payload for one branch was adapted to the new leash. Not an ADR conflict or scope escalation: it is a direct, foreseeable, minimal consequence of implementing the approved `full.yaml` wiring diff on a pre-existing test that exercises the same flow.
2. **`check-links.js docs/features/retry-memory` exits 1** (tasks.md §8 expected exit 0), due to `spec-delta.md:94`'s link to `../specs/flow-retry-loop.md`, which does not exist yet by design (it is the archive-time promotion target, per spec-delta.md's own "Merge instructions at archive time" section). Implementer scope explicitly excludes editing `spec-delta.md`, and `check-links.js`'s exemption mechanism (`<!-- check-links: ignore -->`) would itself be an edit to that file. This is a pre-existing plan-internal inconsistency (between tasks.md's acceptance line and spec-delta.md's intentional forward reference), not introduced by this implementation and not a regression — flagged here for the caller to route (e.g., waive the check-links line for spec-delta forward-references, or have a human add the ignore marker).
