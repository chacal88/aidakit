# Tasks — flow-run-progress-table

**Change ID:** `flow-run-progress-table`
**Date:** `2026-07-24`
**Owner:** `@chacal88`
**Phase / Package:** `n/a (CLI presentation; classification: domain=process, type=feature, flags=[ui, architecture→resolved: pure CLI presentation, no ADR])`
**PRD:** `n/a`
**Tech Spec:** `n/a`

> **TDD, tests-first.** Each derivation rule and each render site gets a **failing** test (RED) before the code that satisfies it (GREEN), then a REFACTOR pass. Idiom: pure Node `.mjs`, no framework — `let pass=0, fail=0`, `ok(cond,name)`, `eq(a,b,name)`, `process.exit(fail?1:0)`, modules via `await import(...)` (mirror `governance/__tests__/engine.test.mjs`). Run a single file with `node governance/__tests__/<file>.test.mjs` ([governance/README.md](../../../governance/README.md)). Do NOT touch `governance/engine/engine.js` or `governance/engine/steps/*`.

## 1. Setup

- [x] Re-read the grounding in [design.md](design.md) against the live code: confirm `state.step_history[].step_id`, `state.current_step` set for terminal steps (`governance/engine/engine.js:126`, `:161-168`), `state.pause.step_id`, `state.status` values, and that `governance/flows/{full,fast,design}.yaml` are flat (no `loop`/`parallel`). If any shape differs, correct [design.md](design.md) before writing code.
- [x] Create `governance/__tests__/progress-table.test.mjs` with the harness skeleton (`pass`/`fail`, `ok`/`eq`, `await import("../engine/progress-table.js")`, final `process.exit(fail?fail:0)`), and a small `makeState({status, current_step, pause, history})` fixture builder for fabricated states.

## 2. Surface Work — the pure helper `governance/engine/progress-table.js`

### 2a. RED — derivation tests (write first; they fail: the module does not exist yet)

- [x] **Base derivation (crit. 1, 3):** a fabricated flat `steps` + a `paused` state → the paused step is `current`, every `step_history` id before it is `done`, everything after is `pending`; assert **exactly one** `current` row.
- [x] **`current` beats `done` on back-edge re-entry (crit. 3):** a state whose `current_step`/`pause.step_id` is a step that is ALSO already in `step_history` → that step renders `current`, NOT a stale `done`.
- [x] **Terminal → zero `current` (crit. 1):** a `completed` state with `current_step` still pointing at the terminal step `done` (the real engine behavior, `engine.js:161-168`) → **zero** rows marked `current`, and the terminal step shows `done`. Repeat for `status: "aborted"` and `status: "failed"`.
- [x] **`runs` gate steps appear (crit. 4):** a state whose `step_history` includes `check_implement_bench`/`check_docs` (never-pausing `runs` steps) → they render as `done` rows (present in the table, sourced from history).
- [x] **Row content is id + marker only (crit. 6):** assert a rendered row contains the `step.id` and one of `done`/`current`/`pending` and does NOT contain the step's `description` text.
- [x] **No-null-crash:** a fresh state (`current_step: null`, empty `step_history`, no `pause`, `status: "running"`) → every row `pending`, no throw.

### 2b. GREEN — implement the helper

- [x] Write `governance/engine/progress-table.js` exporting `renderProgressTable(steps, state)` exactly per [design.md](design.md): `doneSet` from `step_history`; `isTerminal` gate on `completed|aborted|failed`; `currentId = isTerminal ? null : (state.pause ? state.pause.step_id : state.current_step)`; per-step marker with precedence `current > done > pending`; the bounded plain-text row format (gutter + `padEnd(7)` marker + id) and header line. Zero-dep, no I/O. Run 2a → all green.

### 2c. RED+GREEN — generalization across real flows (crit. 2, 7)

- [x] **RED:** load `full` AND `fast` via `loadFlow` (real YAMLs), fabricate a paused state for each, assert the rendered rows == the flow's declared `flow.steps` ids **in declared order** (no reordering, no id hardcoded in the assertion — derive the expected list from `flow.steps.map(s => s.id)`). Assert the same helper works unchanged for both flows.
- [x] **GREEN:** confirm no code change is needed (the helper is already name-agnostic); if the test surfaces any hardcoded assumption, remove it.

### 2d. REFACTOR

- [x] Tidy the helper (single-responsibility, no dead branches); re-run `node governance/__tests__/progress-table.test.mjs` → green.

## 3. Surface Work — CLI wiring `governance/cli.js` (crit. 5, 8)

### 3a. RED — wiring smoke (write first)

- [x] In `progress-table.test.mjs`, add a subprocess smoke (zero-dep, `node:child_process.execFileSync`, isolated `AIDAKIT_PROJECT_ROOT`): drive `full` to a paused state via the engine API, `saveState`, then run `node governance/cli.js status <flow_id>` and assert the table block (header + a `current` row) is in stdout. Repeat asserting the block appears from `start <flow>` and from `resume <flow_id> <outcome>`. These fail until 3b.

### 3b. GREEN — wire the three entry points

- [x] Add `import { renderProgressTable } from "./engine/progress-table.js";` to `governance/cli.js` (`:20-23`).
- [x] Change `printPauseOrEnd(res)` → `printPauseOrEnd(res, flow)` (`governance/cli.js:30`); render `renderProgressTable(flow.steps, res.state)` + a blank line as its FIRST output, before the existing PAUSED/END block. Pass `flow` at both call sites: `cmdStart` (`:62`) and `cmdResume` (`:87`) — both already hold `flow`.
- [x] In `cmdStatus` (`:90-98`), add `const { flow, errors } = loadFlow(state.flow_name);` (already imported) and, after the existing summary lines, render the table when `!errors.length`; skip it (best-effort) when the flow no longer loads. Run 3a → green.
- [x] Confirm `abort`/`list` are untouched (they do not print flow state).

### 3c. REFACTOR + criterion-8 check

- [x] Confirm one code path / one text block: all three sites call the same helper; no TTY/`isatty` branch, no ANSI, no `columns` dependency. Verify stdout is byte-identical piped vs. in a TTY (record in [evidence.md](evidence.md)).

## 4. Documentation

- [x] `governance/README.md` — note the progress table on the `start`/`resume`/`status` CLI lines; bump the trailing `<!-- aidakit vX.Y — … -->` doctrine footer.
- [x] Via `aidakit:roadmap`, enrich the `flow-run-progress-table` feature's acceptance line in [EPIC-flow-cli-ux](../../roadmap/epics/EPIC-flow-cli-ux.md) to the confirmed criteria — **never write a status field, never hand-edit the derived `ROADMAP.md`** ([ADR-002](../../decisions/ADR-002-roadmap-status-derived-from-disk.md)). Order-independent with Tasks 1–3.
- [x] This change package complete (proposal, design, tasks, evidence).

## 5. Validation (executable)

- [x] `node governance/__tests__/progress-table.test.mjs` → green (derivation + back-edge + terminal zero-current + generalization + CLI-wiring smoke). Record counts in [evidence.md](evidence.md).
- [x] `node governance/__tests__/engine.test.mjs` → green (no regression; engine API unchanged).
- [x] Full suite: `for t in governance/__tests__/*.test.mjs; do node "$t" || echo "FAIL $t"; done` → all green. Record in [evidence.md](evidence.md).
- [x] Live CLI smoke (isolated `AIDAKIT_PROJECT_ROOT`): `start full …` shows one `current` row; `status <flow_id>` re-prints the same table from disk; drive a back-edge (`review fail` on `fast`, or a `check_*` failure on `full`) and confirm the re-entered step flips `done → current`; a completed run shows zero `current`. Capture the transcripts in [evidence.md](evidence.md).
- [x] `node governance/validators/check-links.js docs/features/flow-run-progress-table` → exit 0.
- [x] `node governance/validators/derive-roadmap-status.js --root .` → exit 0; this change derives `in-progress`.
- [x] Confirm no file in the diff emits a per-step outcome/result narrative (crit. 6 / theme-3 boundary).

## 6. Release

- [x] Bump `version` in `.claude-plugin/plugin.json` **strictly above the manifest version on main at implementation start — re-read it, don't assume** (currently `0.6.1`; recommended `0.7.0` for a shipped CLI feature). This is what makes `claude plugin update` copy the new CLI behavior to installed users ([PROCESS.md](../../../PROCESS.md) §5). `node governance/validators/check-plugin-version.js .` → exit 0; record in [evidence.md](evidence.md).

## 7. Cleanup

- [x] No stray files outside the declared scope; `git status` shows only `governance/engine/progress-table.js`, `governance/cli.js`, `governance/__tests__/progress-table.test.mjs`, `governance/README.md`, `.claude-plugin/plugin.json`, the roadmap files from Task 4, and this change directory.
- [x] `## Files Touched` and `## Unresolved Deviations` filled in [evidence.md](evidence.md).

## 8. Ship (separate step — out of scope for the implementer)

- [ ] Ship: conventional commit on the worktree branch, PR `feat(cli): flow progress table at start/resume/status` to main, **stop at the URL** — the merge is the human's ([GOVERNANCE.md](../../../GOVERNANCE.md) §1).
