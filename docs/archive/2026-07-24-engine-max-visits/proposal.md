# Proposal — engine-max-visits

**Change ID:** `engine-max-visits`
**Date:** `2026-07-24`
**Owner:** `@chacal88`
**Phase / Package:** `engine + flows (governance/) — mechanical loop cap on back-edges`
**PRD:** `n/a`
**Tech Spec:** `n/a`

## Why

The engine's `loop` step bounds body iterations via its `max` field, but it cannot see the OTHER loop shape the engine produces: a back-edge via `on_result` (e.g. `critic: revise → specify`, `readiness: needs-revision → specify`). In [governance/flows/full.yaml](../../../governance/flows/full.yaml), the `specify` step is re-entered by both routes with no ceiling — the only cap lives in the *text* of the `aidakit:review` skill ("capped rounds"), which is doctrine, not mechanics.

Cost is real: a live session ran the `specify ↔ critic` pair 4 times and burned ~102M tokens on the 4th round (`aidakit:plan` re-authoring proposal/design/tasks with the critic's revise notes). The [flow-request-vs-change-id proposal](../../archive/2026-07-24-flow-request-vs-change-id/proposal.md) §Non-goals #1 explicitly named this debit ("No retry cap on the `implement`↔`check_*` back-edges — the infinite loop was the *symptom*; the mechanical cap is the already-declared `engine-max-visits` debit"), pointing at [EPIC-flow-engine-leashes](../../roadmap/epics/EPIC-flow-engine-leashes.md).

This change adds a per-step visit cap declared in the YAML — `max_visits: N` bounds how many times the engine may dispatch a step in a single `flow_id`; the (N+1)-th entry short-circuits BEFORE dispatch and routes via `on_max_visits` (typically a `human_gate` escalation), never a silent loop.

## What Changes

- **Engine — new step fields `max_visits` + `on_max_visits`** (`governance/engine/engine.js`, `parser.js`, `types.js`): the engine tracks per-`flow_id` visit counts under `state.context.__visits[step.id]`, incremented on each FRESH entry (`resumeValue === undefined`, so 1 visit = 1 count regardless of whether the step pauses and resumes). Once the counter reaches `max_visits`, the next entry short-circuits BEFORE dispatch, logs a `step_max_visits_exceeded` event, records a `max_visits_exceeded` step_history entry, and routes to `on_max_visits`.
- **Parser — fail-closed validation** (`governance/engine/parser.js`): `max_visits` requires a positive integer AND an accompanying `on_max_visits` string — a cap with no escalation target is REJECTED at load, because an unbounded loop is worse than a hard stop. `on_max_visits` must point at an existing step id (extends `checkRoutingTargets`). Declaring `on_max_visits` without `max_visits` is also REJECTED.
- **`full.yaml` — cap the `specify ↔ critic` loop**: `specify` declares `max_visits: 3` + `on_max_visits: specify_escalation`; a new `specify_escalation` `human_gate` reports the situation ("the spec loop ran 3 rounds without landing an approved plan") and routes `abort → aborted`. No auto-retry option — a fresh flow starts a fresh counter, which is the intended reset semantics (see design.md §Escalation semantics).
- **Tests** (`governance/__tests__/engine.test.mjs` §10): parser rejection cases (missing/invalid fields, target check); mechanism (a step with `max_visits: 3` dispatches exactly 3 times before the 4th entry escalates); wiring in `full.yaml` (schema check + end-to-end drive where critic keeps returning revise).

## Non-goals

1. **Does not add a default `max_visits` to other steps of `full.yaml`.** This change delivers the mechanism and wires only `specify` (the pair the session actually hit). The same field can later gate `implement` (the `review_bench → implement` and `hardening → implement` back-edges) and `document` (the doc-leash loop) in a follow-up — each flow author decides where a cap belongs.
2. **Does not touch `fast.yaml`.** `fast` has a `review → implement` back-edge that could benefit from the same cap, but the pair the user pointed at is `full`'s `specify ↔ critic`. Wiring `fast` is a follow-up.
3. **Does not offer a "retry with counter reset" option in the escalation gate.** Options are `abort` only — the human intervenes out-of-band and re-runs the flow (fresh `flow_id`, fresh counter). Adding an `intervene → reset → specify` route is possible but out of scope; it needs new mechanism (counter reset semantics) and offers thin value over "abort + re-run".
4. **Does not distinguish "loop caused by `revise`" from "loop caused by `needs-revision`".** Both back-edges enter `specify` and both count; the escalation prompt names the loop as a whole. A per-caller counter would need composite keys and more machinery for negligible benefit.
5. **Does not modify the loop step's existing `max` field.** That is a body-iteration cap for `type: loop`; this is a back-edge cap for `on_result` routes — distinct shapes, distinct fields. Both live on `BaseStep`/`LoopStep` without overlap.

## Affected capabilities

Engine mechanism (`governance/engine/engine.js`, `parser.js`, `types.js`) and the `full` flow tail around specify/critic (`governance/flows/full.yaml`). **No `docs/specs/` in this repo** (confirmed in [flow-request-vs-change-id/proposal.md](../../archive/2026-07-24-flow-request-vs-change-id/proposal.md) §Affected capabilities) — no capability spec delta. No ADR: this is a new field on an existing contract (BaseStep), not a supersession of a locked decision — the epic already declared the mechanism as the design target.

## Impact per surface

| Surface | Impact |
|---|---|
| `governance/engine/types.js` | BaseStep JSDoc extended with `max_visits` + `on_max_visits` |
| `governance/engine/parser.js` | `validateSteps` rejects malformed `max_visits`/`on_max_visits`; `checkRoutingTargets` includes `on_max_visits` |
| `governance/engine/engine.js` | dispatch guarded by visit-count check; new `step_max_visits_exceeded` log event; new `max_visits_exceeded` step_history result |
| `governance/flows/full.yaml` | `specify` declares `max_visits: 3` + `on_max_visits: specify_escalation`; new `specify_escalation` human_gate step |
| `governance/__tests__/engine.test.mjs` | new §10 covering parser rejection, mechanism, and `full.yaml` wiring |

## Dependencies

- **`flow-request-vs-change-id` — SATISFIED in `main`** (commit `c43205f`). The `specify_escalation` prompt interpolates `${context.select.change_id}` (already declared as a structured output on `select`), so the escalation message names the change directory the human should edit.
- No new runtime dependency (Node stdlib only; the counter lives in `state.context`, already persisted by `saveState`).

## Exit criteria

- `node governance/__tests__/engine.test.mjs` → green, including §10 (parser rejection, mechanism dispatch count, `full.yaml` schema + end-to-end drive).
- Full suite `governance/__tests__/*.test.mjs` → green (no regression).
- `node governance/validators/derive-roadmap-status.js --root .` → exit 0; this change derives `in-progress` (directory exists).
- `node governance/validators/check-links.js docs/features/engine-max-visits` → exit 0.

## Unblocks

- Closes the `engine-max-visits` debit called out in [flow-request-vs-change-id/proposal.md](../../archive/2026-07-24-flow-request-vs-change-id/proposal.md) §Non-goals #1.
- Makes `max_visits` available for any future flow to bound its own back-edges — `implement`, `document`, `hardening` are all candidates for a follow-up wiring change.

## Recorded decisions and inherited open decisions

- [EPIC-flow-engine-leashes](../../roadmap/epics/EPIC-flow-engine-leashes.md) Feature 1 (Cap mecânico de retries) — the acceptance ("uma aresta de retorno visitada >N vezes cai em `human_gate` de escalação … N configurável por step no YAML") maps directly to this change; the "intervir ou abortar" wording is realized as `abort` only in the escalation gate (see Non-goals #3).
- [ADR-006](../../decisions/ADR-006-flow-values-as-data.md) — flow values as data: the escalation prompt interpolates `${context.select.change_id}` (structured output already declared on `select`), consistent with the ADR. No new interpolation contract.
