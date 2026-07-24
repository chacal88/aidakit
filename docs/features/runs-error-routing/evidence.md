# Evidence — runs-error-routing

**Change ID:** `runs-error-routing`
**Date:** `2026-07-24`
**Owner:** `@chacal88`
**Phase / Package:** `n/a (governance/engine)`
**PRD:** `n/a`
**Tech Spec:** `n/a`

Filled during implementation per [tasks.md §5](tasks.md) and §6.

**Baseline note (anti-drift):** task 1.2 assumed a pre-change baseline of `127/0` for `engine.test.mjs`. Re-inspection at implementation time (2026-07-24) measured `149/0` — other merged work (`engine-max-visits`, `EPIC-context-caching`) landed additional assertions on this branch's base after the plan was authored, but every concrete line reference the design cited (`engine.js:204`, `:223`, `:320-325`) matched the real file exactly, so this is a stale count in the plan text, not a scope-breaking drift. Proceeded; target below is baseline+new, not the literal `132` the plan named.

## Validation Outputs

- `node governance/__tests__/engine.test.mjs` — exit 0. `201 passed, 0 failed` (baseline 149/0 + 52 new assertions across the 5 new §12 scenarios — each scenario asserts `status`/`outcome`/`step_history[last]` shape/`on_failure`-not-dispatched/`runs_infra_error` event, several checks per scenario rather than one).
- `node governance/__tests__/roadmap.test.mjs` — exit 0. `28 passed, 0 failed`.
- `node governance/validators/check-adr-format.js docs/decisions/ADR-011-runs-infra-error-routing.md` — exit 0. `{"validator":"aidakit.check-adr-format","ok":true,"adrs_checked":1,"errors":[]}`.
- `node governance/validators/check-links.js docs/features/runs-error-routing docs/decisions/ADR-011-runs-infra-error-routing.md docs/guides/flows.md docs/decisions/README.md docs/roadmap/epics/EPIC-flow-engine-leashes.md` — exit 0. `{"validator":"aidakit.check-links","ok":true,"files_checked":10,"errors":[]}` (fixed 6 pre-existing broken relative links in `planning-review.md`, an untracked readiness artifact already present before this implementation started — links were written root-relative instead of relative to the file's own directory).
- Full governance suite (`for f in governance/__tests__/*.test.mjs; do node "$f"; done`) — 0 failures across all 13 files: `candidates 8/0`, `check-adr-format 8/0`, `check-bench 20/0`, `check-docs 8/0`, `check-links 7/0`, `dna-freshness 7/0`, `dna-write 14/0`, `engine 201/0`, `ledger 8/0`, `plugin-version 12/0`, `pr-automation 161/0`, `progress-table 30/0`, `roadmap 28/0`, `yaml-min 17/0`.
- Manual repro per [tasks.md §"How to verify manually"](tasks.md):
  - One-liner: `NODE_OPTIONS="--require=<repo>/governance/engine/prelude/infra-detect.cjs" node needs-missing.cjs` (a `.cjs` file with `require('./absolutely-not-here')`) → stderr `aidakit-prelude: infra error: MODULE_NOT_FOUND: Cannot find module './absolutely-not-here'`, `exit: 250`. Matches expected.
  - Full engine round-trip: a synthesized flow with `{ id: 'r', type: 'runs', command: 'node <path>/needs-missing.cjs', on_failure: 'never_taken' }` → `status: failed outcome: failed`, `history: [ 'r:infra_error' ]`. `never_taken` never dispatched. Matches expected exactly.
  - Prelude non-pollution (task 6.4): `NODE_OPTIONS="--require=<repo>/governance/engine/prelude/infra-detect.cjs" node governance/validators/check-adr-format.js docs/decisions/ADR-011-runs-infra-error-routing.md` → clean `{"ok":true,...}` output, no `aidakit-prelude:` line — the handler only fires inside the exception path.

## Files Touched

<!-- Populated during implementation. One line per modified/created file with the change summary. -->

- `governance/engine/prelude/infra-detect.cjs` — _new; ~30 lines; uncaughtException remap to exit 250_
- `governance/engine/steps/runs.js` — _modified; classifier + NODE_OPTIONS injection_
- `governance/engine/engine.js` — _modified; new `kind:"infra"` routing clause + `outcomeKey` branch_
- `governance/engine/types.js` — _modified; JSDoc `StepOutcome` typedef union_
- `governance/__tests__/engine.test.mjs` — _modified; new §12 (5 tests)_
- `docs/decisions/ADR-011-runs-infra-error-routing.md` — _new_
- `docs/decisions/README.md` — _modified; index row + thematic grouping_
- `docs/guides/flows.md` — _modified; consumer-facing paragraph on infra-error surface_
- `docs/roadmap/epics/EPIC-flow-engine-leashes.md` — _modified post-merge; runs-error-routing marked **Entregue**_

## Unresolved Deviations

1. **Baseline count mismatch (non-blocking).** Plan assumed `engine.test.mjs` baseline 127/0; actual pre-implementation baseline was 149/0 (other merged changes landed more assertions after the plan was authored). All design.md line-number references matched the real files exactly, so this is a stale count, not a scope break. Post-implementation total is 201/0, not the literal "132" the plan named.
2. **`output.exit_code` corrected for infra outcomes (small deviation from task 2.9's literal snippet).** Task 2.9's snippet reuses `{...output, signal: res.signal ?? null}` — but `output.exit_code` is computed upstream as `res.status ?? -1`, which would make the `runs_infra_error` event's `exit_code` field read `-1` (not `null`) for the signal-kill (§12.3) and spawn-error (§12.4) cases — contradicting the explicit acceptance criteria in tasks.md 2.3/2.4 ("`exit_code: null`"). Fixed by having the infra-only branch construct `exit_code: res.status ?? null` instead of inheriting the general-path sentinel. Does not change the classifier's decision logic, only the exit_code field's null-vs-`-1` representation in the infra event/history.
3. **6 pre-existing broken relative links fixed in `planning-review.md`.** Not a task in tasks.md — this file is a readiness-gate artifact already untracked in the worktree before implementation started. Its links were authored root-relative (`docs/archive/...`) instead of relative to the file's own directory, which `check-links.js` requires. Fixed mechanically (path-only edits, no content change) to unblock task 5.4's validator command, which explicitly names `docs/features/runs-error-routing` as a scan target.

No other deviations. No escalation triggers fired (no assumption invalidated the approved design, no ADR conflict, no scope expansion beyond the approved tasks).
