# Tasks — engine-max-visits

**Change ID:** `engine-max-visits`
**Date:** `2026-07-24`
**Owner:** `@chacal88`
**Phase / Package:** `engine + flows (governance/) — mechanical loop cap on back-edges`

> TDD, tests first. Each parser rejection case and the mechanism itself get a RED test before the GREEN implementation, then REFACTOR. Test idiom: pure Node `.mjs`, no framework — `let pass=0, fail=0`, `ok(cond,name)`, `eq(a,b,name)`, `process.exit(fail?1:0)`, modules via `await import(...)` (mirror [governance/__tests__/engine.test.mjs](../../../governance/__tests__/engine.test.mjs)). **Anti-drift ([GOVERNANCE.md](../../../GOVERNANCE.md) §8):** re-inspect the repo before coding; any assumption from [design.md](design.md) that changed → STOP and report.

## 1. Setup

- [x] Re-read [design.md](design.md) against live code: confirm the dispatch shape of [engine.js:126-134](../../../governance/engine/engine.js), the pause-then-resume drive semantics of [invoke.js:45-89](../../../governance/engine/steps/invoke.js), the routing-target walk of [parser.js:200-221](../../../governance/engine/parser.js), and the specify/critic/readiness structure of [full.yaml:69-132](../../../governance/flows/full.yaml). No divergence found.

## 2. Engine — types + parser (schema)

### 2a. RED (write first; fail — the fields do not exist yet)

- [x] Test §10a-i: `max_visits: 3` without `on_max_visits` is rejected at load; error mentions `on_max_visits`.
- [x] Test §10a-ii: `max_visits: 0` is rejected; error mentions "positive integer".
- [x] Test §10a-iii: `on_max_visits: nowhere` (nonexistent target) is rejected; error names the missing id.
- [x] Test §10a-iv: `on_max_visits` without `max_visits` is rejected; error mentions both fields.

### 2b. GREEN

- [x] Extend BaseStep JSDoc in [types.js](../../../governance/engine/types.js) with `max_visits` and `on_max_visits`, documenting the fail-closed semantics.
- [x] Add validation in [parser.js `validateSteps`](../../../governance/engine/parser.js): reject the four cases above.
- [x] Add `on_max_visits` to the [parser.js `checkRoutingTargets`](../../../governance/engine/parser.js) walk so it validates the target id against the collected set.

### 2c. REFACTOR

- [x] Re-run §10a → green; suite `node governance/__tests__/engine.test.mjs` → no regression.

## 3. Engine — dispatch guard

### 3a. RED (mechanism test)

- [x] Test §10b: minimal `work ↔ check` flow with `max_visits: 3` on `work`. Assertions: `work` dispatches exactly 3 times (via `driveDry`-style loop, counting `work` pauses); the 4th entry does NOT pause on `work` — the flow reaches `specify_escalation` instead; `state.context.__visits.work === 3`; `step_history` has a `max_visits_exceeded` entry with `output: { visits: 3, max_visits: 3 }`; the escalation gate's `abort` terminates the flow.

### 3b. GREEN

- [x] In [engine.js `drive()`](../../../governance/engine/engine.js), after `startedAt` and before `logEvent step_start`, add the visit-count check: read `state.context.__visits[step.id]`; if `priorEntries >= max_visits` AND `isFreshEntry` (`resumeValue === undefined && resumeOutput === undefined`), log `step_max_visits_exceeded`, push a `max_visits_exceeded` history entry, clear the resume single-shots, and `queue.unshift({stepId: on_max_visits, path, loopVars})` + `continue`. If `on_max_visits` is missing, mark the flow failed with a diagnostic (fail-closed — parser already rejects this shape, but the runtime backstops it).
- [x] Otherwise increment `visits[step.id]` and fall through to normal dispatch.

### 3c. REFACTOR

- [x] Re-run §10b → green; full suite unchanged.

## 4. Wire `full.yaml` — cap the specify ↔ critic loop

### 4a. RED (wiring tests)

- [x] Test §10c: load `full.yaml`; assert `specify.max_visits === 3`, `specify.on_max_visits === "specify_escalation"`; `specify_escalation` exists as `human_gate` with `abort` in options; `on_result.abort === "aborted"`.
- [x] Test §10d: start `full` flow, drive select/classify/brainstorm/specify (=success)/critic (=revise) repeatedly. Assert `specify` dispatched exactly 3 times, the flow reached `specify_escalation`, `abort` terminated the flow, and the pause right before `specify_escalation` was `critic` (no 4th `specify` pause).

### 4b. GREEN

- [x] Edit [full.yaml `specify`](../../../governance/flows/full.yaml): add `max_visits: 3` and `on_max_visits: specify_escalation`; expand description to name the cap and its rationale (100M-token session).
- [x] Insert a new `specify_escalation` `human_gate` between `specify`/`commit_plan` and `aborted`: prompt names the change directory (`docs/features/${context.select.change_id}/`), options `[abort]`, `on_result.abort → aborted`.

### 4c. REFACTOR

- [x] Re-run §10c/§10d → green; full suite → green.

## 5. Full suite + docs validators

- [x] `node governance/__tests__/engine.test.mjs` → **149 passed, 0 failed** (up from 127 — §10 added 22 assertions).
- [x] All `governance/__tests__/*.test.mjs` → green (no regression); see [evidence.md](evidence.md).
- [x] `node governance/validators/derive-roadmap-status.js --root .` → exit 0; `engine-max-visits` derives `in-progress`.
- [x] `node governance/validators/check-links.js docs/features/engine-max-visits` → exit 0.
