# Tasks — step-summaries-type-gate-tests

**Change ID:** `step-summaries-type-gate-tests`
**Date:** `2026-07-24`
**Owner:** `@chacal88`
**Phase / Package:** `tests only (governance/__tests__/) — EPIC-kit-discipline-hardening, feature 3`
**PRD:** `n/a`
**Tech Spec:** `n/a`

> **Hard constraint for every task below:** `governance/engine/**` and every other production source are OFF LIMITS for committed edits. The only committed change is `governance/__tests__/step-summaries.test.mjs` plus this change package. The mutation edits of §5 are throwaway, reverted in the same task, never committed.

## 1. Setup

- [x] Run the baseline and record the tail: `node governance/__tests__/step-summaries.test.mjs` → expected `95 passed, 0 failed`. Paste into [evidence.md](evidence.md) §Validation Outputs.
- [x] Re-read the live gate at [`governance/engine/engine.js:221-226`](../../../governance/engine/engine.js) and confirm both halves match [design.md](design.md) §The gate is two gates (kind gate `next|fail`, type gate `invoke|human_gate|human_handoff`). If the anchors moved, stop and report — the plan's mutation protocol keys on those lines.
- [x] Confirm the fixture `rand` ids `s3i013`/`s3i014`/`s3i015` are unused in the file (`grep -n "s3i0" governance/__tests__/step-summaries.test.mjs`).

## 2. Surface Work — `governance/__tests__/step-summaries.test.mjs`

Ordered TDD-style: each case is added, run immediately on the pristine engine (must be green), and only then mutation-checked in §5.

- [x] Rename the existing `§S3-vi` block (`:315-343`) to `§S3-vi-loop-empty`: the section comment and both assertion-name strings (`"S3-vi: s3-looptype parses"` → `"S3-vi-loop-empty: …"`, and the two following). Fixture, `rand` (`s3i006`) and assertions unchanged. Re-run the suite → still `95 passed, 0 failed`.
- [x] Add `§S3-vi-loop` (fixture `s3-loopiter`, rand `s3i013`) per [design.md](design.md) §`§S3-vi-loop`: loop over `["a","b"]` with a pausing `invoke` body; assert parse, pause at `body_step` twice, `status === "completed"`, `summaries` `(step_id, visit_n)` exactly `[["body_step",1],["body_step",2]]`, and zero entries with `step_id === "lp"`. Run the suite → green.
- [x] Add `§S3-vi-parallel` (fixture `s3-paralleltype`, rand `s3i014`) per [design.md](design.md) §`§S3-vi-parallel`: two branches, each one pausing `invoke`; assert parse (watch the `yaml-min` nested-list form — bare `-` then the indented inner list, never `- - id:`), pause at `b1` then `b2`, `status === "completed"`, `summaries` step_ids exactly `["b1","b2"]`, zero entries with `step_id === "par"`. Run the suite → green.
- [x] Add `§S3-vi-terminal` (fixture `s3-terminaltype`, rand `s3i015`) per [design.md](design.md) §`§S3-vi-terminal`: `invoke` → `terminal` that declares a `summary:`; assert parse, `status === "completed"`, `summaries` step_ids exactly `["work"]`, zero entries with `step_id === "done"`. Include the in-block comment recording the double gate (a type-gate-only mutation cannot flip this case; the discriminating mutation is type + kind). Run the suite → green.

## 3. Documentation

- [x] Update the file header comment (`:1-8`) so the `§S3` inventory reads as "one named case per excluded type": `§S3-v` = runs, `§S3-vi-loop-empty` / `§S3-vi-loop` = loop, `§S3-vi-parallel` = parallel, `§S3-vi-terminal` = terminal — with the one-line note that `terminal` is excluded by the KIND half of the gate, not the type half.
- [x] Fill [evidence.md](evidence.md): baseline, the four mutation runs with their reverts, the final green suite, the whole-directory sweep, validator outputs, `git diff --stat`. Nothing invented — paste real output.
- [x] `node governance/validators/derive-roadmap-status.js --root .` → exit 0 and this change's line derives `in-progress` from this directory ([ADR-002](../../decisions/ADR-002-roadmap-status-derived-from-disk.md) / [ADR-007](../../decisions/ADR-007-roadmap-status-from-shared-git.md); nothing hand-written). The validator is **report-only** — it does not write `docs/roadmap/ROADMAP.md`, so this change leaves that file untouched; the sync is a separate chore of the `aidakit:roadmap` skill. The `in-progress` derivation is worktree-local while the package is untracked; the shared-git half of [ADR-007](../../decisions/ADR-007-roadmap-status-from-shared-git.md) lands at commit.
- [x] No `governance/README.md` edit — the documented contract ("`runs`/`loop`/`parallel`/`terminal` never emit") is unchanged; this change only makes it enforced. Confirm and note it in evidence.md rather than editing.

## 4. Validation

- [x] `node governance/__tests__/step-summaries.test.mjs` → `0 failed`, passing count strictly greater than 95 (exit criterion `suite-no-regression`).
- [x] Whole directory sweep: `for f in governance/__tests__/*.test.mjs; do echo "== $f"; node "$f" || echo "FAILED $f"; done` → every suite exit 0 **except `context-pack.test.mjs`** (12 failures pre-dating this change; prove it by re-running on a stashed tree and capturing the identical tally).
- [x] `node governance/validators/check-links.js docs/features/step-summaries-type-gate-tests` → exit 0.
- [x] `node governance/validators/check-plugin-version.js .` → exit 0 (no doctrine footer moved, so no manifest bump — [PROCESS.md](../../../PROCESS.md) §5).

## 5. Mutation checks (throwaway edits — revert every one)

Protocol per row: `git diff --quiet governance/engine/engine.js` → apply the edit at `:221-226` → run the suite and capture the `FAIL …` lines + the `N passed, M failed` tail → `git checkout -- governance/engine/engine.js` → re-run and capture the green tail.

- [x] `+parallel` (type gate `|| step.type === "parallel"`) → expect RED on the `S3-vi-parallel` assertions. Capture, revert, re-run green. (criterion `parallel-exclusion-locked`)
- [x] `+loop` (type gate `|| step.type === "loop"`) → expect RED on `S3-vi-loop-empty` **and** `S3-vi-loop`. Capture, revert, re-run green. (criterion `loop-exclusion-strengthened`)
- [x] `+terminal`, type gate only → expect **green**, and record it as the documented no-op (the kind gate blocks `kind:"terminal"` before the type gate is read). Capture, revert. (criterion `terminal-exclusion-locked`, part 1)
- [x] `+terminal`, type gate **and** kind gate (`|| outcome.kind === "terminal"`) → expect RED including `S3-vi-terminal`. Capture, revert, re-run green. (criterion `terminal-exclusion-locked`, part 2)
- [x] If any mutation does NOT produce the expected colour, stop and report instead of adjusting the assertion to match — a surprise here means the plan's model of the gate is wrong. (Not triggered — all four rows matched the predicted colour exactly.)

## 6. Cleanup

- [x] `git status --short` and `git diff --stat` → only `governance/__tests__/step-summaries.test.mjs`, `docs/features/step-summaries-type-gate-tests/*` and `docs/roadmap/epics/EPIC-kit-discipline-hardening.md` (the registered debit; **not** `docs/roadmap/ROADMAP.md` — see §3); **no path under `governance/engine/`**. Paste both into [evidence.md](evidence.md) (exit criterion `production-untouched`). Both commands are load-bearing: `git diff --stat` sees only tracked paths, so an untracked leak under `governance/engine/` shows up only in `git status --short`.
- [x] Delete any scratch copy of `governance/` used for mutation experiments; confirm no temp fixture or `.orig` file leaked into the worktree.

## 7. Ship (separate workflow step — out of scope for the implementer)

- [ ] Commit / PR / merge are the shipping step's, not this plan's ([GOVERNANCE.md](../../../GOVERNANCE.md) §1).

<!-- aidakit v0.6 — tasks for step-summaries-type-gate-tests, 2026-07-24 -->
