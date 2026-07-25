# Proposal — runs-error-routing

**Change ID:** `runs-error-routing`
**Date:** `2026-07-24`
**Owner:** `@chacal88`
**Phase / Package:** `n/a (governance/engine — small structural fix on the runs step + engine router)`
**PRD:** `n/a`
**Tech Spec:** `n/a`

## Why

The `runs` step conflates **infrastructure errors** (command not found, missing Node module, spawn failure, signal-kill) with **validator verdicts** (exit≠0 = "test judged NO"). Both surface as `outcome:"failure"` and are routed via `step.on_failure` — which for the shipped flows means going back to a prior step to "correct" the code, spinning in a retry loop until `max_visits` trips (or forever, pre-`engine-max-visits`).

The direct source is [`docs/archive/2026-07-23-validator-path-resolution/proposal.md:14`](../../archive/2026-07-23-validator-path-resolution/proposal.md) — non-goal 1 explicitly deferred this to a separate debit. The failure mode was: a `node` validator that could not `require()` its target exited with code 1, indistinguishable from a validator that legitimately said NO; the flow entered `on_failure: implement` and burned rounds trying to "fix" code that had nothing to do with the actual error.

Two defects, one change:

1. **Router defect (`governance/engine/engine.js:223-228`)** — even when the runs step reports `{kind:"fail"}` (spawn failure), the engine routes via `on_failure` if the step declares one. The comment in [`governance/engine/steps/runs.js:52-54`](../../../governance/engine/steps/runs.js) claims spawn failure is "an infra error — not a routable test that failed", but nothing enforces it.
2. **Detector defect** — the `Cannot find module` case (`require()` throws inside a Node validator) never even reaches `res.error`. Node exits 1, structurally identical to a validator's `process.exit(1)` verdict-NO.

Locked resolutions from [`brainstorm.md`](brainstorm.md) §"Escalation resolutions" (owner-delegated Q1+Q2):

- **Q1**: infra errors ALWAYS bypass `on_failure`. No `on_infra_error` sibling target; fewer knobs, precedent [ADR-009](../../decisions/ADR-009-flow-commits-plan-early.md).
- **Q2**: structural signals only, no stderr heuristics. POSIX (`res.status===127|126`, `res.signal`, `res.error`) + Node-side sentinel exit **250** emitted by a `--require`d prelude that catches `MODULE_NOT_FOUND` / `ERR_MODULE_NOT_FOUND` / `require.resolve` ENOENT.
- **Q3 (deferred to this plan)**: ambiguous case (no structural signal matches) defaults to **validator-failure** — backward-compatible. Locked here; the Q2 detector is high-confidence so ambiguous cases are rare by construction.

## What Changes

- **`governance/engine/steps/runs.js`** — classify the spawn result BEFORE returning. New helper produces `{kind:"infra"}` for the POSIX signals + sentinel 250; otherwise unchanged (`success`/`failure` routing preserved). Injects `NODE_OPTIONS=--require=<prelude>` into the child env so any `node` sub-invocation carries the infra catcher.
- **`governance/engine/prelude/infra-detect.cjs`** (new module) — installs an `uncaughtException` handler that remaps `MODULE_NOT_FOUND` / `ERR_MODULE_NOT_FOUND` / `require.resolve` ENOENT to `process.exit(250)`. CommonJS so `--require` accepts it; zero call-site changes at validators.
- **`governance/engine/engine.js`** — new routing clause `if (outcome.kind === "infra")` BEFORE the existing `kind:"fail"` block: emits `runs_infra_error` log event, records the step_history entry with `result:"infra_error"`, and hard-stops the flow (`status:"failed"`, `outcome:"failed"`, error message names the exit code / signal / trailing stderr). Fail-closed: bypasses `on_failure`, no resume, no retry.
- **`governance/engine/persistence.js`** — no change; `logEvent` accepts any event shape (line 77) — `runs_infra_error` is a non-breaking addition.
- **`governance/__tests__/engine.test.mjs`** — new §12 covering: exit 127, exit 126, signal-kill (`res.signal`), spawnSync `res.error` even with `on_failure` declared, `require()`-throws-under-prelude → exit 250 → hard-stop. Regression proving the shipped flows' `on_failure` targets are NOT taken on any of these.
- **`docs/decisions/ADR-011-runs-infra-error-routing.md`** (new) — locks the contract: infra-error is a first-class outcome kind, always bypasses `on_failure`, detected via structural signals + Node prelude sentinel 250.

## Non-goals (explicit)

1. **Stderr pattern-matching** is rejected. Doctrine-in-prose-shaped; kills false positives from validators whose legitimate output mentions "cannot find module" (e.g. one asserting plugin absence). See [brainstorm.md](brainstorm.md) §"Q2 detector".
2. **Retry-on-infra** is not implemented. No automatic retry; infra errors surface immediately. Adding an `on_infra_error` target later is a non-breaking additive change if a real consumer flow ever needs it; the reverse would be breaking. YAGNI.
3. **Bash validators are not wrapped.** The Node prelude only reaches `node` sub-invocations (through `NODE_OPTIONS`); pure-bash `runs` (`test -n …`, `test -d …`) keep POSIX-signal-only detection. Those never `require()` anything, so the sentinel-250 path is not relevant. Documented in `design.md`.
4. **Agent/skill-invoked validator commands are NOT touched.** Same non-goal as [`validator-path-resolution` §non-goal 2](../../archive/2026-07-23-validator-path-resolution/proposal.md) — agent Bash sessions never receive `NODE_OPTIONS` from the engine. Tracked by the separate debit `agent-validator-paths` in [EPIC-flow-engine-leashes](../../roadmap/epics/EPIC-flow-engine-leashes.md).
5. **No behavioral change to `invoke` steps.** They have no process-spawn concept. Same scoping decision as `validator-path-resolution`.
6. **No consumer flow migration.** The change is transparent to any `.aidakit/flows/*.yaml` — no new YAML field, no rename, no target rewiring. Consumer flows that legitimately catch infra via `on_failure` today (none observed in the shipped audit) would need to stop; that's the intended contract change and belongs to the new ADR.

## Affected capabilities

- Flow engine (`governance/engine/`) — runs step + router error-routing contract. No canonical capability spec exists (`docs/specs/` absent, same as [`validator-path-resolution` §"Affected capabilities"](../../archive/2026-07-23-validator-path-resolution/proposal.md)). Behavioral contract pinned by the regression added to [`governance/__tests__/engine.test.mjs`](../../../governance/__tests__/engine.test.mjs). **No spec delta.**

## Impact per surface

| Surface | Impact |
|---|---|
| `governance/engine/` | 3 files: `steps/runs.js` (classifier + NODE_OPTIONS injection), `engine.js` (new `kind:"infra"` routing clause), `prelude/infra-detect.cjs` (new module, ~30 lines) |
| `governance/__tests__/` | 1 file: `engine.test.mjs` (+5 test cases, ≈150 lines) |
| `governance/flows/` | none — shipped flows unchanged; audit result in [design.md](design.md) confirms no `on_failure` target today depends on catching infra |
| `docs/decisions/` | 1 file: `ADR-011-runs-infra-error-routing.md` + index update in `docs/decisions/README.md` |
| `docs/guides/flows.md` | +1 short paragraph documenting the infra-error surface for consumer flow authors |
| `docs/features/runs-error-routing/` | this change directory |
| `agents/`, `skills/`, `commands/`, `hooks/` | none |

## Dependencies

- Structurally none. Compatible with `engine-max-visits` (already merged) — the max-visits cap is orthogonal (bounds loops on validator-verdict cycles), and infra hard-stop fires before max-visits has anything to count.
- Compatible with `flow-request-vs-change-id` (already merged, [ADR-006](../../decisions/ADR-006-flow-values-as-data.md)) — the classifier operates on `spawnSync` result, independent of interpolation.

## Exit criteria

- New §12 in `engine.test.mjs` covers: `res.status===127`, `res.status===126`, `res.signal` set, `res.error` from spawnSync even with `on_failure` declared, and a Node `require()` throw exiting 250 under the prelude. Every one asserts `state.status==="failed"`, `state.outcome==="failed"`, `runs_infra_error` event emitted, and — critically — that `on_failure` target step was NOT dispatched.
- Reproduction of the original `validator-path-resolution` bug: a synthesized `runs` step invoking `node` with a `require()` pointing at a nonexistent module now surfaces as infra-error, not as a `on_failure` retry loop. Recorded in [evidence.md](evidence.md).
- Full governance suite (`node governance/__tests__/*.test.mjs`) — 0 failures.
- `node governance/validators/check-adr-format.js docs/decisions/ADR-011-runs-infra-error-routing.md` → exit 0.
- `node governance/validators/check-links.js docs/features/runs-error-routing docs/decisions/ADR-011-runs-infra-error-routing.md docs/guides/flows.md` → exit 0.
- Evidence recorded in [evidence.md](evidence.md).

## Unblocks

- `psim-aidakit-migration` and any other dogfooding consumer that hits a validator-path-shaped infra error stops silently looping and surfaces the real error immediately.
- Any future Node-based validator or command inherits the sentinel-250 catcher for free.
- `aidakit:learn` gains a mineable event type (`runs_infra_error`) with structured `command`/`exit_code`/`signal`/`stderr` — recurring infra defects become first-class raw material.

## Recorded decisions and inherited open decisions

- Read the [decisions index](../../decisions/README.md).
  - [ADR-003](../../decisions/ADR-003-shared-knowledge-in-docs.md) placement boundary: routing + detection contract change with rejected alternatives and consumer-facing consequences is ADR-worthy.
  - [ADR-004](../../decisions/ADR-004-aidakit-governance-env-contract.md) — `AIDAKIT_GOVERNANCE` env contract. Adds precedent for engine-owned names in the `runs` child env; the new `NODE_OPTIONS` injection follows the same "engine wins over inherited" precedence.
  - [ADR-006](../../decisions/ADR-006-flow-values-as-data.md) — flow values as data. The infra detector operates on the spawn result AFTER interpolation, so ADR-006's data-passing guarantee is preserved; nothing this change does re-splices values into shell text.
  - [ADR-009](../../decisions/ADR-009-flow-commits-plan-early.md) — precedent for fewer knobs / structural mechanism over opt-in doctrine. Directly cited in the Q1 resolution.
- This change **introduces [ADR-011](../../decisions/ADR-011-runs-infra-error-routing.md)** locking the routing + detection contract. Numbered next-in-sequence per [`docs/decisions/README.md`](../../decisions/README.md) (ADR-009 is the current highest); ADR ID verified.
- No open-decisions log exists in this repo; nothing inherited.
