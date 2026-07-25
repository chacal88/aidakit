# Design — engine-max-visits

**Change ID:** `engine-max-visits`
**Date:** `2026-07-24`
**Owner:** `@chacal88`
**Phase / Package:** `engine + flows (governance/) — mechanical loop cap on back-edges`

## Problem shape

The engine has two distinct loop shapes:

1. **Body iteration** — `type: loop` with `over`, bounded by `max` (see [loop.js](../../../governance/engine/steps/loop.js) — the executor checks `frame.iterations >= step.max` before entering the body).
2. **Back-edge via `on_result`** — a step routes its own outcome back to an earlier step (e.g. `critic: revise → specify`). The engine has NO bound on this; the same step id can be dispatched arbitrarily many times per `flow_id`.

The `full.yaml` `specify` step is a textbook (2): both `critic.on_result.revise` and `readiness.on_result.needs-revision` route back to it ([full.yaml:106,131](../../../governance/flows/full.yaml)). Nothing in the engine prevents this from repeating N times. In a live session, `aidakit:plan` ran 4 times on the same change and cost ~102M tokens — an unbounded loop on a big-context skill.

## Mechanism

A new pair of fields on `BaseStep`:

```yaml
max_visits: 3              # positive integer — total dispatches per flow_id
on_max_visits: escalation  # step id to route to when the cap trips
```

**Semantics.** The engine tracks per-`flow_id` visit counts under `state.context.__visits[step.id]`. On each **fresh entry** (`resumeValue === undefined`), the engine:

1. Reads `priorEntries = visits[step.id] ?? 0`.
2. If `priorEntries >= max_visits`, short-circuits BEFORE dispatch: logs `step_max_visits_exceeded`, appends a `max_visits_exceeded` step_history entry, and routes to `on_max_visits` (unshifted into the queue).
3. Otherwise increments `visits[step.id]` and dispatches normally.

Counting only fresh entries is the key detail: a pausing step (invoke, human_gate) traverses `drive()` twice per logical visit — once to pause, once to consume the resume. Counting every drive-loop iteration would double-count invoke and human_gate steps, so the check gates on `resumeValue === undefined && resumeOutput === undefined`. For non-pausing step types (`runs`, `terminal`, `loop`, `parallel`), fresh entry is the only shape; the check is a no-op there.

**Counter reset on `flow_id`.** The counter lives in `state.context`, which is per-`flow_id`. A new `startFlow` creates a fresh context — the counter resets naturally. There is no in-flow reset primitive; if a human resumes a stuck flow via the escalation gate, they abort and start a new flow (see §Escalation semantics).

**Fail-closed validation.** The parser rejects at LOAD:

- `max_visits` not a positive integer.
- `max_visits` set without `on_max_visits` (an unbounded loop is worse than a hard stop — no silent bypass).
- `on_max_visits` set without `max_visits` (an unreachable route is a config error).
- `on_max_visits` pointing at a nonexistent step id (extends the existing `checkRoutingTargets` walk).

**Runtime fail-closed.** If a hand-crafted state ever reaches the engine with `max_visits` but no `on_max_visits` (bypassing the parser), the engine marks the flow `failed` with a diagnostic — same principle: never a silent loop.

## Where the check lives in the engine

The dispatch loop in [engine.js `drive()`](../../../governance/engine/engine.js) currently:

```
state.current_step = step.id
ctx = { ... }
startedAt = new Date().toISOString()
logEvent step_start
dispatch(step, ctx)
```

The new block sits between `startedAt` and `logEvent step_start`:

- Guard on `typeof step.max_visits === "number" && isFreshEntry`.
- If capped, log `step_max_visits_exceeded`, push the history entry, clear `resumeValue`/`resumeOutput`, and either `queue.unshift(target)` and `continue`, or fail-close the flow.
- Otherwise increment and fall through to `step_start` + `dispatch`.

Placing the check BEFORE `step_start` keeps the log stream tidy — a capped entry does not emit a spurious step-start.

## Wiring in `full.yaml`

The change is minimal and additive:

- `specify` gets `max_visits: 3` and `on_max_visits: specify_escalation`. The `description` is expanded to name the cap and its rationale.
- A new `specify_escalation` `human_gate` sits between `specify` and `aborted` in the file. Options: `[abort]`. `on_result.abort → aborted`.
- Existing steps are untouched.

Why `specify` and not `critic`: `specify` is the expensive step (aidakit:plan re-authoring proposal/design/tasks). Capping `specify` means the 4th dispatch of `aidakit:plan` is the one that never happens; capping `critic` would let the 4th `specify` run before catching. The counter has to be on the step whose dispatch we want to suppress.

Why `max_visits: 3`: the user's captured session ran 4 rounds. Three rounds gives the critic two revise cycles (initial + 2 revises), which is generous — most changes converge in 1–2 rounds. If a change genuinely needs more, the escalation gate is the signal that the plan needs a human's eye.

## Escalation semantics

The escalation is a **hard stop**, not a retry loop:

- Options: `[abort]` only. Choosing abort routes to the `aborted` terminal, same as every other abort path in `full.yaml`.
- Rationale: adding an `intervene → specify` option requires a counter reset mechanism (otherwise the specify counter is still at 3 and the flow immediately re-escalates). We could add a `reset_visits` field, but the value is thin — a fresh `startFlow` gets a fresh counter and lets the human genuinely re-check the request from the top. The friction of "abort and re-run" is intentional: it forces the human to look at the change instead of clicking through another round.
- The prompt names the change directory (`docs/features/${context.select.change_id}/`) so the human knows what to inspect. `${context.select.change_id}` is populated by the `select` step's structured output ([full.yaml:37-39](../../../governance/flows/full.yaml), commit `c43205f`).

## Interaction with existing loop shapes

- **`type: loop` `max`** is untouched. It bounds body iterations of a for-each loop; `max_visits` bounds back-edge visits of any step. They co-exist without overlap.
- **Existing back-edges** (`readiness: needs-revision → specify`, `bench_outcome: fail → implement`, `check_review_bench: on_failure → review_bench`, `check_docs: on_failure → document`) continue to work unchanged. Only steps that opt in via `max_visits` are affected. This change opts in only `specify`; the rest keep today's semantics.
- **Retries via `on_failure`** (e.g. `hardening.on_failure: implement`) similarly count as visits if the target has `max_visits`. Nothing special-cases them — the cap is on entries, regardless of what routed here.

## Test surface

New §10 in [engine.test.mjs](../../../governance/__tests__/engine.test.mjs), covering:

- **10a — parser rejection**: `max_visits` without `on_max_visits`, non-positive-integer `max_visits`, `on_max_visits` pointing at a missing step, `on_max_visits` without `max_visits`. Each writes a minimal YAML in `AIDAKIT_PROJECT_ROOT/.aidakit/flows/` (same idiom as §9d/§9e) and asserts `loadFlow` returns the expected error.
- **10b — mechanism**: a two-step back-edge (`work ↔ check`, revise route) with `max_visits: 3` on `work`. Drive it: `work` dispatches exactly 3 times; the 4th entry does NOT pause on `work` (it escalates); `state.context.__visits.work === 3`; `step_history` has the `max_visits_exceeded` entry with `{visits: 3, max_visits: 3}`; the escalation gate reaches `abort`.
- **10c — full.yaml schema**: reads the real `full.yaml` and asserts `specify.max_visits === 3`, `specify.on_max_visits === "specify_escalation"`, and `specify_escalation` exists as a `human_gate` with `abort` in options routing to `aborted`.
- **10d — full.yaml end-to-end**: starts the `full` flow, drives it through select/classify/brainstorm/specify/critic where critic always returns `revise`, and asserts `specify` dispatched exactly 3 times, the flow reached `specify_escalation`, `abort` terminated the flow, and there was no 4th `specify` pause (the escalation lands right after the 3rd `critic: revise`).

All four sub-blocks use the existing `driveDry`-style harness with per-step answer maps; no new test infrastructure.

## Backwards compatibility

- Existing flows without `max_visits` behave identically — the check is guarded by `typeof step.max_visits === "number"`. Every current flow (`fast`, `docs-onboarding`, the existing `full` steps other than `specify`) is unaffected.
- Existing tests (127 total before this change) continue to pass — see evidence.md.

## Anti-drift check

Re-inspected before writing code:

- [engine.js:126-131](../../../governance/engine/engine.js) `drive()` — dispatch shape as described. `startedAt` defined before `dispatch()`. Confirmed.
- [invoke.js:45-89](../../../governance/engine/steps/invoke.js) — invoke steps traverse `drive()` twice per visit (pause + resume). Confirmed the need for the `resumeValue === undefined` guard on counting.
- [parser.js:200-221](../../../governance/engine/parser.js) `checkRoutingTargets` — walks `on_success`/`on_failure`/`on_result`; adding `on_max_visits` to the same list is one line. Confirmed.
- [full.yaml:69-77,97-106,121-132](../../../governance/flows/full.yaml) — `specify`, `critic`, `readiness` structure. Both `critic.revise` and `readiness.needs-revision` route to `specify`. Confirmed.

No divergence from proposal assumptions.
