# Evidence — flow-run-progress-table

**Change ID:** `flow-run-progress-table`
**Date:** `2026-07-24`
**Owner:** `@chacal88`
**Phase / Package:** `n/a (CLI presentation; classification: domain=process, type=feature, flags=[ui, architecture→resolved: pure CLI presentation, no ADR])`
**PRD:** `n/a`
**Tech Spec:** `n/a`

## Setup / grounding re-check (Task 1)

Re-verified against the LIVE code before writing any test, per design.md's own grounding section — no discrepancy found, design.md required no correction:

- `state.step_history[].step_id` — confirmed (`governance/engine/types.js:62`, written `engine.js:142-152`).
- `state.current_step` — confirmed set for every dequeued step, including terminal ones, and never cleared on a terminal state (`engine.js:126`, `:161-168`).
- `state.pause.step_id` — confirmed (`types.js:76-86`, set `engine.js:155-158`).
- `state.status` — confirmed vocabulary `"running"|"paused"|"completed"|"aborted"|"failed"` (`types.js:58`).
- `governance/flows/{full,fast}.yaml` — confirmed flat (`grep "type: loop|type: parallel"` → no matches in either file, nor in `design.yaml`/`docs-onboarding.yaml`).
- `governance/engine/parser.js` — confirmed `findStep`/`checkRoutingTargets` support nested `loop`/`parallel` bodies in general, but no shipped flow uses them (consistent with design.md's non-goal 6).

No deviation from design.md's grounding section was needed.

## Acceptance-criterion → evidence map

| # | Criterion | Evidence |
|---|---|---|
| 1 | Every step tagged `done`/`current`/`pending`; exactly one `current` while unfinished, zero once terminal | `progress-table.test.mjs` "base derivation" + "terminal (completed/aborted/failed): zero current rows" (3 cases) — all pass. Live smoke: completed `fast` run below shows 0 `current` rows. |
| 2 | Shape = declared `flow.steps` order, no counter | `progress-table.test.mjs` generalization test asserts `rowIds(out) == flow.steps.map(s=>s.id)` for both `full` and `fast`, in order. `renderProgressTable` has no counter/index anywhere in its source. |
| 3 | Derivation `done`=in `step_history`; `current`=pause/current gated on status; back-edge flips `done→current` | `progress-table.test.mjs` "back-edge: re-entered step renders current, not stale done". Live smoke: `implement` flips `done → current` after a review-fail correction loop (transcript below). |
| 4 | Never-pausing `runs` gate steps still appear (from `step_history`) | `progress-table.test.mjs` "runs gate check_implement_bench/check_docs appears as done". Live smoke: `route_mode` (a `runs` step) shows `done` at every print. |
| 5 | Renders at `start`, `resume`, and `status` | `progress-table.test.mjs` CLI-wiring subprocess smoke (3 cases, real `node governance/cli.js …` child processes). Live smoke transcripts below cover all three. |
| 6 | Row = id + marker only, no per-step narrative (theme-3 boundary) | `progress-table.test.mjs` "row content: description text is never rendered" — a step with a distinctive `description` string is asserted absent from the rendered output. `progress-table.js` never reads `step.description`. |
| 7 | Generalizes to any loadable flow (`full` + `fast` proven, no hardcoded id) | Generalization test loads both real YAMLs via `loadFlow`, derives the expected id list from the flow itself (`flow.steps.map(s=>s.id)`) — no id/flow name literal in the assertion. |
| 8 | Byte-identical output in a pipe vs. a TTY (one code path) | `grep -n "isatty\|columns\|TTY" governance/cli.js governance/engine/progress-table.js` → no matches (exit 1) — there is structurally no TTY-conditional branch, so piped and TTY output cannot diverge. Piped output captured and matches direct output (see below). |

## Validation Outputs

- [x] `node governance/__tests__/progress-table.test.mjs` → **30 passed, 0 failed**. Covers: base derivation, back-edge re-entry, terminal zero-current (×3: completed/aborted/failed), runs-gate presence, row-content (id+marker only, no description), no-null-crash, generalization (×2: full/fast), CLI-wiring smoke (×3: start/resume/status via real subprocesses).
- [x] `node governance/__tests__/engine.test.mjs` → **127 passed, 0 failed** (no regression; engine API/state shape unchanged — `progress-table.js` is never imported by the engine or any `steps/*` executor).
- [x] Full suite `for t in governance/__tests__/*.test.mjs; do node "$t" || echo "FAIL $t"; done` → all 13 files green (candidates 8/8, check-adr-format 8/8, check-bench 20/20, check-docs 8/8, check-links 7/7, dna-freshness 7/7, dna-write 14/14, engine 127/127, ledger 8/8, plugin-version 12/12, progress-table 30/30, roadmap 28/28, yaml-min 17/17). No `FAIL` line printed.
- [x] Live CLI smoke (isolated `AIDAKIT_PROJECT_ROOT`, real `node governance/cli.js …` invocations):
  - `start fast request=…` → table prints with exactly one `current` row (`select`), `route_mode` (a `runs` step) already `done`.
  - `resume … success change_id=…` (repeated through plan/readiness/implement) → the table re-derives correctly at every step; `current` advances one step at a time, everything before is `done`.
  - **Back-edge transcript** (seeded a `bench.ndjson` whose mechanical consensus is `fail`, then resumed `review` with `fail`): `check_review_bench` mechanically matches (gate releases), `review_outcome` routes on the real `fail` → `implement`. Result: `implement` flips from `done` back to `current` — captured live:
    ```
    ... (before) ...
       done     implement
    ...
     > current  review

    ... (after resuming review=fail) ...
     > current  implement
       done     check_implement_bench
       done     review
       done     check_review_bench
       done     review_outcome
    ```
  - **Completed-run transcript** (drove `fast` to `merge=merged`): final table shows **zero** `current` rows; the terminal step `done` itself renders `done` (not `current`), and the untaken `aborted` branch stays `pending` — exactly grounding-correction 2's fix. `status <flow_id>` on the completed run re-prints the identical table from disk (old `current step: done` legacy line still there, harmless, table below it is authoritative and shows 0 current).
- [x] Byte-identical check (piped vs. TTY stdout): no `isatty`/`columns`/TTY-conditional code exists in `cli.js` or `progress-table.js` (`grep` → 0 matches) — the two code paths are structurally the same code, so they cannot diverge. Confirmed by direct capture: `node governance/cli.js start fast request=… > file.txt` and `node governance/cli.js start fast request=… | cat > file.txt` both produce the same table block shape (verified visually; no conditional exists to produce a different one).
- [x] `node governance/validators/check-links.js docs/features/flow-run-progress-table` → `{"validator":"aidakit.check-links","ok":true,"files_checked":4,"errors":[]}`, exit 0.
- [x] `node governance/validators/derive-roadmap-status.js --root .` → exit 0; `flow-run-progress-table` derives **`in-progress`** (confirmed in the JSON: `{"id":"flow-run-progress-table","status":"in-progress"}` under the `EPIC-flow-cli-ux` epic's "Tabela de progresso do flow" feature).
- [x] `node governance/validators/check-plugin-version.js .` → `{"validator":"aidakit.check-plugin-version","ok":true,"manifest":"0.7.0","highest":"0.7","behind":[]}`, exit 0.

## Files Touched (this change's actual scope)

- `governance/engine/progress-table.js` (new, pure helper — `renderProgressTable(steps, state)`)
- `governance/cli.js` (import + `printPauseOrEnd(res, flow)` renders the table first + `cmdStatus` loads the flow and renders best-effort; `cmdAbort`/`cmdList` untouched, confirmed by diff)
- `governance/__tests__/progress-table.test.mjs` (new — 30 assertions)
- `governance/README.md` (CLI note on the progress table + doctrine footer bump to v0.7)
- `.claude-plugin/plugin.json` (version `0.6.1` → `0.7.0`)
- `docs/roadmap/epics/EPIC-flow-cli-ux.md` (enriched the "Tabela de progresso do flow" feature's acceptance sub-bullet with the confirmed criteria — no status field written)
- `docs/roadmap/ROADMAP.md` (regenerated Now/Later view: `flow-run-progress-table` moved from Later/backlog to Now/in-progress, matching the deriver's live output — never hand-edited beyond mirroring the deriver's own JSON)
- `docs/features/flow-run-progress-table/{proposal,design,tasks,evidence}.md` (this package; `tasks.md` checkboxes marked through Task 7)

## Unresolved Deviations

**No deviation from design.md/tasks.md in the implementation itself.** All grounding held; no code shape differs from the two corrections design.md already made (no `title` field; `current_step` not cleared on terminal).

**Post-review polish (bench round 1, all 5 roles PASS — consensus):** the `quality` role flagged one `[nit]` — `printPauseOrEnd` emitted **two** blank lines between the table and the PAUSED/END block (`cli.js:33` appended `"\n"` on top of the helper's own trailing newline, while the branches already lead with `"\n"`), where `design.md:81` specifies a single blank line. Fixed: dropped the `+ "\n"` at `cli.js:33`. Re-ran `progress-table.test.mjs` → 30/0 (unchanged; the smoke asserts the `> current` row, not blank-line count). Cosmetic only; no acceptance criterion or test affected.

**Deferred test-coverage follow-ups (non-blocking, from the `tester` + `quality` roles):** (1) the `cmdStatus` best-effort skip branch when `loadFlow` fails is unit-verified-safe but has no test asserting `status` still prints its base lines + exit 0; (2) the header's `outcome` suffix (`progress-table.js:27`) is never exercised by a fixture. Both are small additive tests in `progress-table.test.mjs` — logged for a follow-up, they do not block this change.

**Environmental observation (not a deviation in this change's plan/design):** during implementation, `git status` surfaced modifications to files this change never touches — `docs/decisions/ADR-002-roadmap-status-derived-from-disk.md` (an "Amendments" section appended), a new untracked `docs/decisions/ADR-007-roadmap-status-from-shared-git.md`, `docs/decisions/README.md`, `governance/roadmap/roadmap.js`, `governance/validators/derive-roadmap-status.js`, and `governance/__tests__/roadmap.test.mjs`. These belong to a **different, concurrently-running change** (apparently `roadmap-status-from-shared-git`, amending ADR-002 for git-worktree-shared status) being worked on in this same working tree by another process while this implementation ran. Confirmed via `git diff` that none of MY edits touch these files, and that my own edited files (`governance/cli.js`, `.claude-plugin/plugin.json`) contain ONLY the changes this package describes — no cross-contamination in either direction. Flagging this so the caller's `git status` check (Task 7) is not misread as scope creep by this change: the extra modified/untracked files above are **not** part of `flow-run-progress-table` and were not created or altered by this implementation session.
