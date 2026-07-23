# Proposal — loop-var-resume

**Change ID:** `loop-var-resume`
**Date:** `2026-07-22`
**Owner:** `@chacal88`
**Phase / Package:** `n/a (fast flow — small reversible bugfix)`
**PRD:** `n/a`
**Tech Spec:** `n/a`

> **Retrofit notice:** the implementation ALREADY EXISTS uncommitted in this worktree. This change directory retrofits the flow artifacts onto delivered work; the content below describes the actual diff (`governance/engine/engine.js`, `governance/__tests__/engine.test.mjs`), not a plan to be executed from scratch. The implement step verifies the delivered work against `tasks.md` rather than producing it.

## Why

Observed in production: psim-kernel, flow `new-device-driver`, run `new-device-driver-260722-8598f2`, engine v0.2.0. Resuming a flow paused at a step INSIDE a loop body lost the loop iteration variable — `${feature}` (the loop's `as` var) leaked unresolved as a literal into the next pause's input/prompt and into `runs` commands.

Root cause: `rebuildLoopVars(state, flow, path)` in `governance/engine/engine.js` iterated `for (let i = 0; i < path.length - 1; i++)`, excluding the path's LAST segment. But a paused body step's path ENDS in `iter[N]` — the body step id is not appended to the path (see the `__iterate__` frame in `drive()`) — so the innermost loop's frame was never read on resume. Nested loops only lost the INNERMOST var, because intermediate `iter[N]` segments were already within the examined range.

## What Changes

- `governance/engine/engine.js` — `rebuildLoopVars` walks the FULL path (`i < path.length`). Segments not matching `/^iter\[(\d+)\]$/` are skipped by the existing regex guard, so including the last segment is always safe. A comment above the function records why the full path is walked.
- `governance/__tests__/engine.test.mjs` — new section 7, written RED-first (both cases failed before the fix, reproducing the exact production symptom):
  - **7a — simple loop:** invoke pause → resume (state reloaded from disk, like a fresh `cli.js resume` session) → both the next `runs` command and the next pause's input interpolate the loop var.
  - **7b — nested loops:** both levels are rebuilt on resume, innermost included.

## Non-goals

- No change to the path format (the body step id is intentionally NOT appended — the fix adapts the reader, not the writer; see `design.md`).
- No change to loop semantics, `over`/`as` grammar, or state persistence format.
- No engine version bump policy decision (left to the ship step / repo convention).

## Affected capabilities

- Flow engine (`governance/engine/`). No canonical capability spec exists for the engine in this repo (there is no `docs/specs/`), so **no spec delta** — the behavioral contract is pinned by the regression tests in `governance/__tests__/engine.test.mjs` section 7.

## Impact per surface

| Surface | Impact |
|---|---|
| `governance/` (engine + tests) | 2 files: one-line logic fix + comment in `engine/engine.js`; regression section 7 in `__tests__/engine.test.mjs` |
| `agents/` | none |
| `commands/` | none |
| `skills/` | none |
| `hooks/` | none |
| `docs/` | this change directory only |

## Dependencies

None. Self-contained, reversible (single-commit revert restores prior behavior).

## Exit criteria

- Section 7 tests exist and are documented RED-first (they reproduce the production symptom against the pre-fix code).
- `node governance/__tests__/engine.test.mjs` → 0 failed (currently 60 passed).
- Full governance suite (`node governance/__tests__/*.test.mjs`, 11 files) → 0 failures.
- Evidence recorded in [evidence.md](evidence.md).

## Unblocks

Resumable flows with loops become trustworthy in dogfooding projects (psim-kernel `new-device-driver` was the failing consumer).

## Recorded decisions and inherited open decisions

- Read the [decisions index](../../decisions/README.md): ADR-001 (executable DNA), ADR-002 (roadmap from disk), ADR-003 (knowledge in docs) — none constrains engine internals; no ADR applies to this fix and no new decision is locked by it.
- No open-decisions log exists in this repo; nothing inherited.
