# Evidence — runs-error-routing

**Change ID:** `runs-error-routing`
**Date:** `2026-07-24`
**Owner:** `@chacal88`
**Phase / Package:** `n/a (governance/engine)`
**PRD:** `n/a`
**Tech Spec:** `n/a`

> Pre-execution stub. Filled during implementation per [tasks.md §5](tasks.md) and §6.

## Validation Outputs

<!-- Populated during §5 of tasks.md. Each entry: the exact command, its exit code, and the last relevant lines of output. -->

- `node governance/__tests__/engine.test.mjs` — _pending (baseline: 127/0 pre-change; expected 132/0 post-change)_
- `node governance/__tests__/roadmap.test.mjs` — _pending (expected 28/0)_
- `node governance/validators/check-adr-format.js docs/decisions/ADR-010-runs-infra-error-routing.md` — _pending (expected exit 0)_
- `node governance/validators/check-links.js docs/features/runs-error-routing docs/decisions/ADR-010-runs-infra-error-routing.md docs/guides/flows.md docs/decisions/README.md docs/roadmap/epics/EPIC-flow-engine-leashes.md` — _pending (expected exit 0)_
- Full governance suite (`for f in governance/__tests__/*.test.mjs; do node "$f"; done`) — _pending (expected 0 failures across all files)_
- Manual repro per [tasks.md §"How to verify manually"](tasks.md) — _pending_

## Files Touched

<!-- Populated during implementation. One line per modified/created file with the change summary. -->

- `governance/engine/prelude/infra-detect.cjs` — _new; ~30 lines; uncaughtException remap to exit 250_
- `governance/engine/steps/runs.js` — _modified; classifier + NODE_OPTIONS injection_
- `governance/engine/engine.js` — _modified; new `kind:"infra"` routing clause + `outcomeKey` branch_
- `governance/engine/types.js` — _modified; JSDoc `StepOutcome` typedef union_
- `governance/__tests__/engine.test.mjs` — _modified; new §12 (5 tests)_
- `docs/decisions/ADR-010-runs-infra-error-routing.md` — _new_
- `docs/decisions/README.md` — _modified; index row + thematic grouping_
- `docs/guides/flows.md` — _modified; consumer-facing paragraph on infra-error surface_
- `docs/roadmap/epics/EPIC-flow-engine-leashes.md` — _modified post-merge; runs-error-routing marked **Entregue**_

## Unresolved Deviations

<!-- Populated at completion. If none, write "None." Otherwise list what was deviated from the plan and why (e.g. a design.md choice changed at implementation, an escalation surfaced mid-implementation). -->

_Pending._
