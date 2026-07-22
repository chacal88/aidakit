# Tasks — loop-var-resume

**Change ID:** `loop-var-resume`
**Date:** `2026-07-22`
**Owner:** `@chacal88`
**Phase / Package:** `n/a (fast flow — small reversible bugfix)`
**PRD:** `n/a`
**Tech Spec:** `n/a`

> Retrofit: the work below is already delivered uncommitted in this worktree. The implement step VERIFIES each item against the diff and the test run, then marks the checkbox. Do not re-implement.

## 1. Surface Work — governance (RED regression test)

- [x] Section 7 exists in `governance/__tests__/engine.test.mjs` with the bug provenance comment (psim-kernel, run `new-device-driver-260722-8598f2`, engine v0.2.0) and the `driveLoopFlow` helper that reloads state from disk on every resume (mirrors a fresh `cli.js resume` session).
- [x] Case 7a (simple loop): asserts pause inputs `work/report × alpha/beta` all interpolate `${feature}`, and the `runs` commands in `step_history` are `echo building alpha` / `echo building beta` (no literal `${feature}`).
- [x] Case 7b (nested loops): asserts both `${group}` and `${feature}` resolve in every pause input after resume, innermost included.
- [x] RED-first is documented: both cases failed against the pre-fix `rebuildLoopVars`, reproducing the production symptom.

## 2. Surface Work — governance (fix)

- [x] `rebuildLoopVars` in `governance/engine/engine.js` iterates `i < path.length` (was `i < path.length - 1`); no other logic change.
- [x] Comment above `rebuildLoopVars` explains why the full path is walked (paused body step's path ends in `iter[N]`; non-iter segments skipped by the regex, so the full walk is safe).

## 3. Validation (GREEN + full suite)

- [x] `node governance/__tests__/engine.test.mjs` → `60 passed, 0 failed`; record output in [evidence.md](evidence.md).
- [x] Full governance suite: every file in `governance/__tests__/*.test.mjs` (11 files) exits 0; record in [evidence.md](evidence.md).
- [x] `git diff --stat` matches the scope declared in [proposal.md](proposal.md) (exactly 2 files: `governance/engine/engine.js`, `governance/__tests__/engine.test.mjs`).

## 4. Documentation

- [x] Change artifacts complete under `docs/features/loop-var-resume/` (proposal, design, tasks, evidence).
- [x] `## Files Touched` filled in [evidence.md](evidence.md).

## 5. Cleanup

- [x] No stray files outside the declared scope (worktree clean apart from the 2 code files + this change directory).
