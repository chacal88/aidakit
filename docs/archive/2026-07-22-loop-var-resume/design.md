# Design — loop-var-resume

**Change ID:** `loop-var-resume`
**Date:** `2026-07-22`
**Owner:** `@chacal88`
**Phase / Package:** `n/a (fast flow — small reversible bugfix)`
**PRD:** `n/a`
**Tech Spec:** `n/a`

## Design decisions

None needed beyond the fix itself — this is a one-line off-by-one correction in an existing function, with no new contracts, data models, or file layout. The only choice point was WHERE to fix the mismatch between the path writer and the path reader:

**Chosen: fix the reader.** `rebuildLoopVars` in `governance/engine/engine.js` now walks the full path (`i < path.length` instead of `i < path.length - 1`). Safe because non-`iter[N]` segments do not match `/^iter\[(\d+)\]$/` and are skipped; the loop body of the function is a no-op for them. A comment above the function freezes the rationale (a paused body step's path ends in `iter[N]`; the body step id is not appended — see the `__iterate__` frame in `drive()`).

## Alternatives considered

- **Append the body step id to the path (fix the writer).** Rejected: changes the persisted path format, invalidating in-flight paused states of running flows (the production run that surfaced the bug included) and touching every path consumer, for zero behavioral gain.
- **Special-case only the last segment when it matches `iter[N]`.** Rejected: equivalent outcome with more code; the regex guard already makes the unconditional full walk correct.

## Constraining ADRs

None — [ADR-001](../../decisions/ADR-001-executable-dna-crystallization.md), [ADR-002](../../decisions/ADR-002-roadmap-status-derived-from-disk.md) and [ADR-003](../../decisions/ADR-003-shared-knowledge-in-docs.md) govern learning/roadmap/knowledge processes, not engine internals.

## Rollback

Revert the single commit. The fix is 1 logic line + 1 comment; the tests in section 7 would go RED again, which is the desired signal if the revert is ever needed.

## Conventions and evidence location

- Test naming follows the existing numbered-section convention of `governance/__tests__/engine.test.mjs` (`// ── 7. … ──`, cases `7a`/`7b`).
- Canonical test commands (from `governance/README.md`): `node governance/__tests__/engine.test.mjs`; full suite = each file under `governance/__tests__/*.test.mjs` run with `node`.
- Evidence is recorded at the fixed location `docs/features/loop-var-resume/evidence.md`.
