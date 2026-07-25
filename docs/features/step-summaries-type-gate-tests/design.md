# Design — step-summaries-type-gate-tests

**Change ID:** `step-summaries-type-gate-tests`
**Date:** `2026-07-24`
**Owner:** `@chacal88`
**Phase / Package:** `tests only (governance/__tests__/) — EPIC-kit-discipline-hardening, feature 3`
**PRD:** `n/a`
**Tech Spec:** `n/a`

## The gate is two gates

Live code, [`governance/engine/engine.js:221-226`](../../../governance/engine/engine.js) (verified against the worktree during planning, not quoted from the archived plan):

```js
if (
  (outcome.kind === "next" || outcome.kind === "fail") &&
  (step.type === "invoke" || step.type === "human_gate" || step.type === "human_handoff")
) {
  emitSummary(state, step, outcome);
}
```

Two independent conditions. Whether a mutation of the **type** half is observable depends entirely on what `kind` the excluded type's executor returns, so the four excluded types are **not** symmetric:

| Type | Executor return (verified in `governance/engine/steps/`) | Passes the kind gate? | Type-gate-only mutation observable? |
|---|---|---|---|
| `runs` | `{kind:"next", outcome:"success"\|"failure"}`, or `{kind:"infra"}` ([ADR-011](../../decisions/ADR-011-runs-infra-error-routing.md)) | yes (non-infra path) | **yes** — already locked by `§S3-v` |
| `loop` | `{kind:"next", outcome:"__iterate__"}` per item, then `{kind:"next", outcome:"success"}` at termination ([`steps/loop.js`](../../../governance/engine/steps/loop.js)) | yes | **yes** |
| `parallel` | `{kind:"next", outcome:"__branch__"}` per branch, then `{kind:"next", outcome:"success"\|"failure"}` ([`steps/parallel.js`](../../../governance/engine/steps/parallel.js)) | yes | **yes** — and today nothing catches it |
| `terminal` | `{kind:"terminal", outcome}` ([`steps/terminal.js`](../../../governance/engine/steps/terminal.js)) | **no** | **no** — the kind gate blocks it first |

Consequence for the plan: three of the four cases are pinned by a one-line type-gate mutation; `terminal` needs the **two-part** mutation (type gate `+ "terminal"` AND kind gate `+ outcome.kind === "terminal"`) to be discriminating. That asymmetry is a fact about the engine, not a weakness of the test, and it is recorded in the test file header so the next reader does not re-derive it.

### Measured baseline (planning-time mutation runs)

Executed against a throwaway copy of `governance/` in the session scratchpad — the worktree's engine was never edited:

- pristine → `95 passed, 0 failed`
- type gate `+ "parallel"` → `95 passed, 0 failed` ← **the hole**
- type gate `+ "loop"` → `94 passed, 1 failed` (`FAIL S3-vi: no summary entry for the loop step id`)
- type gate `+ "terminal"` → `95 passed, 0 failed` (expected no-op, per the table above)
- type + kind gate `+ "terminal"` → `89 passed, 6 failed` (S3-i, S3-ii, S3-iii, S3-v, S3-viii, S3-ix — all collateral entry-count assertions; no case names the terminal exclusion)

This **corrects the hypothesis carried in from the `select` step**: the existing empty-array `§S3-vi` is not a dead assertion. An empty-array loop still dispatches the loop step once (`frame.index >= frame.total` → `{kind:"next", outcome:"success"}`), so the mutated gate does reach `emitSummary` and the case does turn RED. What `§S3-vi` lacks is *coverage*: it never exercises the `__iterate__` dispatches, which are the shape a real flow produces. Therefore the plan **keeps** it (renamed) and **adds** an iterating sibling, rather than replacing it.

## Case layout inside the file

`§S3-v` (runs) stays exactly as it is, at [`step-summaries.test.mjs:296-313`](../../../governance/__tests__/step-summaries.test.mjs). The `§S3-vi` slot at `:315-343` becomes a four-case family; `§S3-vii`…`§S3-xiii` are untouched, so no label downstream moves and the archived `flow-step-summaries` artifacts keep resolving:

| Label | Origin | Excluded type under test |
|---|---|---|
| `§S3-v` | unchanged | `runs` |
| `§S3-vi-loop-empty` | today's `§S3-vi`, renamed verbatim (same fixture, same assertions, only the label strings change) | `loop` (degenerate) |
| `§S3-vi-loop` | new | `loop` (iterating) |
| `§S3-vi-parallel` | new | `parallel` |
| `§S3-vi-terminal` | new | `terminal` |

Renaming `§S3-vi` → `§S3-vi-loop-empty` touches only the two assertion-name strings in that block. It is a label change, not a semantic one; the mutation matrix re-verifies it did not become a no-op.

## Conventions the new cases must follow

From the existing file (no new idiom is introduced):

- **Harness**: `let pass/fail` counters with `ok(cond, name)` / `eq(a, b, name)` (`:21-23`); every assertion name starts with the section label, e.g. `"S3-vi-parallel: …"` (the file writes `S3-…` in names and `§S3-…` in comments).
- **Isolation**: one `mkdtempSync` project at `:26-29`, `AIDAKIT_PROJECT_ROOT` pointed at it, fixture flows written into `<tmp>/.aidakit/flows/`.
- **Fixture construction**: `writeFlow(name, yaml)` (`:39-42`) writes the YAML and returns `{flow, errors}` from `loadFlow`; every case asserts `eq(errors, [], "…parses")` first.
- **Driving**: `startFlow({ flow, inputs, startedBy: "test", idOpts: { rand: "<6 chars>", now: new Date("2026-07-24T00:00:00Z") } })`, then `resumeWith(loadState(res.state.flow_id), flow, "<outcome>")` per pause — reloading state from disk between steps models a fresh CLI process, and the outcome-only resume stays inside the [ADR-006](../../decisions/ADR-006-flow-values-as-data.md) grammar (no `outputs:` declared, so no `key=value` tokens are required).
- **Unique ids**: `rand` values are the flow-id suffix and must not collide with existing state files. `s3i001`…`s3i012` are taken; the new cases use `s3i013` (`§S3-vi-loop`), `s3i014` (`§S3-vi-parallel`), `s3i015` (`§S3-vi-terminal`). `§S3-vi-loop-empty` keeps `s3i006`.
- **Fixture flow names**: `s3-loopiter`, `s3-paralleltype`, `s3-terminaltype` (the existing loop fixture keeps `s3-looptype`).

### Assertion shape — negative plus positive control

Each case asserts three things, in this order:

1. **The flow really ran the excluded step** — the pause sequence (`res.state.pause?.step_id`) and/or the final `res.state.status === "completed"`. Without this, "no entry" would be satisfied by a flow that never executed.
2. **The neighbouring `invoke` steps DID emit** — the positive control. `state.summaries.map(e => e.step_id)` is compared to the exact expected list, which is what makes the mutation observable: a mutated gate adds the excluded step's id into that list and the `eq` fails with a readable diff.
3. **Zero entries carry the excluded step's id** — `s.filter(e => e.step_id === "<id>").length === 0`, the direct statement of the exclusion.

Each fixture also declares a `summary:` on the excluded step (mirroring `§S3-v`), so the case proves the field is *ignored*, not merely absent.

## The three new fixtures

All three were executed during planning against the scratch copy (green on the pristine engine, RED under the matching mutation) — the YAML below is the verified shape, not a sketch.

### `§S3-vi-loop` — `s3-loopiter`, rand `s3i013`

```yaml
flow: s3-loopiter
description: loop with a real pausing body — the loop step itself never emits
inputs:
  - name: items
    type: array<string>
steps:
  - id: lp
    type: loop
    over: inputs.items
    as: item
    summary: "loop summary should never appear"
    body:
      - id: body_step
        type: invoke
        invoke_target: aidakit:x
        summary: "body {outcome}"
    on_success: done
  - id: done
    type: terminal
    outcome: completed
```

Driver: `startFlow(… inputs: { items: ["a", "b"] } …)` → pauses at `body_step` (iteration 0) → `resumeWith(…, "success")` → pauses at `body_step` (iteration 1) → `resumeWith(…, "success")` → `status === "completed"`. Expected summaries: exactly `[["body_step", 1], ["body_step", 2]]` as `(step_id, visit_n)` — which doubles as a back-edge/visit_n check inside a loop body — and zero entries with `step_id === "lp"`. Under the `+loop` mutation the loop step's three dispatches (`__iterate__`, `__iterate__`, `success`) inject `lp` entries and both assertions fail.

### `§S3-vi-parallel` — `s3-paralleltype`, rand `s3i014`

```yaml
flow: s3-paralleltype
description: parallel step summary is ignored (structural container)
steps:
  - id: par
    type: parallel
    summary: "parallel summary should never appear"
    branches:
      -
        - id: b1
          type: invoke
          invoke_target: aidakit:x
          summary: "branch one {outcome}"
      -
        - id: b2
          type: invoke
          invoke_target: aidakit:y
          summary: "branch two {outcome}"
    on_success: done
  - id: done
    type: terminal
    outcome: completed
```

**`yaml-min` trap — load-bearing.** `branches` is a list of lists, and [`governance/engine/yaml-min.js:82-107`](../../../governance/engine/yaml-min.js) does not support the compact `- - id: b1` form: the `- ` prefix routes into the inline-map branch and the parser yields a map, which `validateFlowShape` then rejects with `steps[0].branches[0]: expected list`. The nested list must be written as a bare `-` on its own line followed by the indented inner list (the `after === undefined` path at `:85-89`, which parses the following block). This is the first parallel fixture written in YAML anywhere in `governance/__tests__/`; the two-line form above is the one that parses.

Driver: `startFlow` → pauses at `b1` → resume `"success"` → pauses at `b2` → resume `"success"` → `status === "completed"`. Expected summaries: exactly `["b1", "b2"]` by `step_id`, zero entries with `step_id === "par"`. Under the `+parallel` mutation the par step's three dispatches (`__branch__`, `__branch__`, `success`) inject `par` entries and both assertions fail.

### `§S3-vi-terminal` — `s3-terminaltype`, rand `s3i015`

```yaml
flow: s3-terminaltype
description: terminal step summary is ignored (flow end, not a semantic pause)
steps:
  - id: work
    type: invoke
    invoke_target: aidakit:x
    summary: "work {outcome}"
    on_success: done
  - id: done
    type: terminal
    outcome: completed
    summary: "terminal summary should never appear"
```

Driver: `startFlow` → pauses at `work` → resume `"success"` → `status === "completed"` (proves the terminal executed). Expected summaries: exactly `["work"]`, zero entries with `step_id === "done"`. The `summary:` on a terminal step is accepted by the parser (already pinned by `§S1-v` at `:128-129`), so the fixture is legal by design.

The block carries a comment stating the double gate explicitly: a type-gate-only mutation cannot flip this case because `executeTerminal` returns `kind:"terminal"`; the discriminating mutation is type + kind, and it is recorded in [evidence.md](evidence.md).

## Mutation-check protocol (how the evidence is produced)

The mutation is a **throwaway local edit of a production file that MUST be reverted and MUST NEVER be committed**. Protocol, per mutation:

1. `git diff --quiet governance/engine/engine.js` (clean before starting).
2. Apply the edit to the gate at `governance/engine/engine.js:221-226`:
   - `+parallel` / `+loop` / `+terminal`: append `|| step.type === "<type>"` to the type-gate line.
   - `+terminal (type+kind)`: the above **plus** `|| outcome.kind === "terminal"` on the kind-gate line.
3. `node governance/__tests__/step-summaries.test.mjs` — capture the full `FAIL …` lines and the `N passed, M failed` tail into [evidence.md](evidence.md), naming the mutation.
4. `git checkout -- governance/engine/engine.js` and re-run the suite; capture the green tail as proof of revert.

Expected signatures with the new cases in place (predicted from the planning-time prototype runs; the actual capture is what evidence.md records):

| Mutation | Expected |
|---|---|
| `+parallel` | RED on `S3-vi-parallel` (both the exact-list and the zero-entries assertions) |
| `+loop` | RED on `S3-vi-loop-empty` **and** `S3-vi-loop` |
| `+terminal` (type only) | **green** — documented no-op; the kind gate never lets a terminal reach `emitSummary` |
| `+terminal` (type + kind) | RED on `S3-vi-terminal`, plus the pre-existing collateral (S3-i, S3-ii, S3-iii, S3-v, S3-viii, S3-ix) and the new loop/parallel cases whose exact-list assertions now see terminal entries |

The final state of the worktree must show **zero** diff under `governance/engine/`; that is exit criterion `production-untouched` ([proposal.md](proposal.md) §Exit criteria — a command gate, so it lives there and not in `## Acceptance criteria`, per [ADR-010](../../decisions/ADR-010-acceptance-leash.md) §Decision 3), and step 4 above is what satisfies it.

## Alternatives considered

- **Replace the empty-array loop case with the iterating one.** Rejected: the measured matrix shows the empty-array case is a live lock (`+loop` → 1 failure today), and it covers the degenerate `total === 0` termination path the iterating case never reaches. Keeping both costs ~6 lines.
- **Renumber `§S3-v` → `§S3-vi-runs` for symmetry.** Rejected: churn on a case referenced by the archived `flow-step-summaries` evidence and by the tester's round-1 note, for cosmetic gain. The header comment carries the mapping instead.
- **Assert the exclusion by unit-testing the gate predicate directly** (extracting it from `engine.js` into an exported helper). Rejected twice over: it requires a production change (out of scope, and the epic's non-goal "surgery, not reform"), and a predicate test would not have caught the `terminal` case, whose exclusion lives in the *other* half of the condition.
- **A generic table-driven case looping over the four excluded types.** Rejected: the four types need structurally different fixtures and different drive sequences (empty vs. iterating loop, two-branch parallel, terminal reached by routing), so the table would be a switch statement wearing a table's clothes, and the roadmap pins named cases (`§S3-vi-parallel`, `§S3-vi-loop`, `§S3-vi-terminal`) for grep-ability.
- **Build a mutation-testing harness / CI mutation job.** Rejected here: a new mechanism with its own decisions (which mutants, what budget, where it runs) — that is a separate change, and [EPIC-kit-discipline-hardening](../../roadmap/epics/EPIC-kit-discipline-hardening.md) forbids bundling.

## Rollback

Test-only, single file. Rollback is reverting `governance/__tests__/step-summaries.test.mjs` to its `main` state; nothing at runtime depends on it and no consumer surface changes. The one non-obvious risk is a mutation edit escaping into the commit — closed mechanically by the `git status --short` + `git diff --stat` pair in [tasks.md](tasks.md) §6 and by exit criterion `production-untouched`. Both halves are required: `git diff --stat` reports only tracked paths, so a leaked untracked artifact under `governance/engine/` (a scratch copy, a `.orig`) is caught by `git status --short` alone.

## Evidence location

Fixed at [`docs/features/step-summaries-type-gate-tests/evidence.md`](evidence.md) — baseline run, the four mutation runs with their reverts, the final green suite, the whole-directory suite sweep, the validator outputs, and the `git status --short` + `git diff --stat` pair that proves `production-untouched` (both halves — see §Rollback for why `git diff --stat` alone is insufficient).

<!-- aidakit v0.6 — design for step-summaries-type-gate-tests, 2026-07-24 -->
