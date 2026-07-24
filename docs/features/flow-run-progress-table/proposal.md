# Proposal — flow-run-progress-table

**Change ID:** `flow-run-progress-table`
**Date:** `2026-07-24`
**Owner:** `@chacal88`
**Phase / Package:** `n/a (CLI presentation; classification: domain=process, type=feature, flags=[ui, architecture→resolved: pure CLI presentation, no ADR])`
**PRD:** `n/a`
**Tech Spec:** `n/a`

## Why

A flow runs across **many separate short-lived CLI processes** — each `/aidakit:flow-build` or `/aidakit:flow-design` invocation dispatches one `node governance/cli.js start|resume|status …`, prints, and exits. Today those prints show only the *local* state: `printPauseOrEnd` (`governance/cli.js:30-43`) names the single paused step + its prompt, and `cmdStatus` (`governance/cli.js:90-98`) prints `current step` + a bare `steps executed: <N>` count. Neither shows the **shape of the whole flow** — where in the declared sequence the run sits, what is already done, what remains. The operator (human or Claude) has to hold the flow map in their head, or open the YAML, to know how far along a run is.

`full.yaml` (23 steps) and `fast.yaml` (17 steps) have real correction loops — `critic: revise → specify`, `readiness: needs-revision → specify`, `check_implement_bench: failure → implement`, `bench_outcome`/`hardening: failure → implement`, `check_docs: failure → document`, `dna_freshness: failure → learn` (grounded in `governance/flows/full.yaml` routing targets). A linear "step N of M" counter would lie about a run that has looped back. What the operator needs is a **structural map** of the declared steps with a single "you are here" marker.

This is **theme 2** of [EPIC-flow-cli-ux](../../roadmap/epics/EPIC-flow-cli-ux.md), unblocked by [command-grouping-and-inputs](../../archive/2026-07-24-command-grouping-and-inputs/proposal.md) (theme 1, archived). It adds a **read-only progress table** to the three CLI entry points that already print flow state. It is a pure presentation addition: it invents no engine state, changes no step-execution semantics, adds no dependency, and requires no ADR.

## Acceptance criteria (owner-confirmed)

Settled in brainstorm — the design executes against these, verbatim:

1. `start`, `resume`, and `status` on ANY loadable flow print a table listing every step declared in that flow's YAML, each tagged `done` / `current` / `pending`, with **exactly one** row marked `current` while the flow is unfinished (zero once status is `completed`/`aborted`/`failed`).
2. **Shape = declared YAML order** (`flow.steps` array order) — NOT a reconstructed execution path, and NOT a linear "step N of M" counter (the flows have real back-edges).
3. **Status derivation:** a step is `done` if its id appears in `state.step_history`; `current` is `state.pause.step_id` when paused else `state.current_step`; everything else `pending`. A step revisited via a back-edge flips back to `current` on re-entry — never a stale `done` while it is being re-executed. No iteration counter, no reordering.
4. `runs`-type gate/leash steps that never pause (`route_mode`, `check_registered`, `check_implement_bench`, `check_docs`, `bench_outcome`, `dna_gate`, `dna_freshness`) STILL appear in the table (sourced from `step_history` once passed) — the table is a structural map of the whole flow, not a dispatch-only log.
5. Renders at all three CLI entry points that print flow state — `start` + `resume` (both go through `printPauseOrEnd`) and `status` (`cmdStatus`). Each render is a **fresh complete redraw from disk** — there is no live-updating TTY widget.
6. Row content = step id + status marker **ONLY**. NEVER per-step outcome/result narrative — the deliberate boundary with sibling theme 3 `flow-step-summaries` (unbuilt).
7. Generalizes to ANY flow the engine can load (`fast.yaml`, `full.yaml`, the `design.yaml`, any project-authored `.aidakit/flows/<name>.yaml`) — reads only `flow.steps` / `state`, no hardcoded flow name or step id.
8. Identical output whether invoked directly in a terminal or dispatched by Claude via Bash from the flow-build/flow-design commands — one code path, one text block.

## What Changes

- **New pure module** `governance/engine/progress-table.js` — `renderProgressTable(steps, state) → string`. A read-only projection of `(flow.steps, loaded state) → text block`. It reads already-parsed and already-persisted data only (`step.id`, `state.step_history[].step_id`, `state.current_step`, `state.pause.step_id`, `state.status`). Zero-dep, no I/O, no engine coupling (the executor never imports it).
- **CLI wiring** `governance/cli.js` — `printPauseOrEnd` gains the loaded `flow` and renders the table on `start`/`resume`; `cmdStatus` loads the flow (via the already-imported `loadFlow`) and renders it too. One helper, one text block, three call sites.
- **Tests** — a new `governance/engine/__tests__`-idiom file `governance/__tests__/progress-table.test.mjs` (pure Node, no framework, `ok`/`eq`, `process.exit(fail?1:0)`) for the derivation logic, plus a CLI-wiring smoke that proves the table prints at `start`/`resume`/`status`.
- **Docs** — `governance/README.md` step/CLI note + doctrine footer bump; the `flow-run-progress-table` acceptance line enriched in [EPIC-flow-cli-ux](../../roadmap/epics/EPIC-flow-cli-ux.md) (via `aidakit:roadmap`, never hand-editing the derived `ROADMAP.md` — [ADR-002](../../decisions/ADR-002-roadmap-status-derived-from-disk.md)).
- **Release** — `.claude-plugin/plugin.json` version bump so `claude plugin update` copies the new CLI behavior to installed users ([PROCESS.md](../../../PROCESS.md) §5).

## Non-goals

1. **Theme 3 — step summaries** (`flow-step-summaries`): a short narrative of what happened in the previous step, between steps and at human gates. **Out.** The table's row content is deliberately `id + marker` only (criterion 6). No file in this change emits a per-step outcome/result narrative.
2. **No engine-core change.** No new state field, no state-schema change, no change to `startFlow`/`resumeFlow`/`drive` step-execution semantics, no change to `governance/engine/engine.js` or `governance/engine/steps/*`. The engine's execution modules are not touched or imported-from-back.
3. **No new dependency.** Governance is zero-dep by design; the renderer is pure string building.
4. **No new ADR.** The `architecture` flag was resolved in brainstorm to *pure CLI presentation* — the change locks no new decision. (The `flow-<name>` command surface it renders under is already locked by [ADR-005](../../decisions/ADR-005-command-namespacing.md).)
5. **No live/animated widget.** Each print is a full redraw from disk; there is no in-process progress bar, no cursor control, no ANSI redraw. The flow spans separate CLI processes.
6. **No nested loop/parallel expansion.** All shipped flows (`fast`, `full`, `design`, `docs-onboarding`) are flat top-level `steps` (verified: no `loop`/`parallel` step type in any shipped flow). The table walks the top-level `flow.steps` array; expanding loop bodies / parallel branches into rows is out of scope and needs no shipped-flow support.

## Affected capabilities

The **flow CLI presentation surface** (`governance/cli.js`) plus one new pure helper (`governance/engine/progress-table.js`). No capability spec exists for this repo (there is **no `docs/specs/`**), so **no spec delta** — mirroring [command-grouping-and-inputs](../../archive/2026-07-24-command-grouping-and-inputs/proposal.md), whose command-surface contract was pinned by tests + an ADR rather than a spec. Here the behavioral contract (the derivation rule, the three render sites, the row-content boundary) is pinned by `governance/__tests__/progress-table.test.mjs` + the acceptance criteria above. No engine capability changes.

## Impact per surface

| Surface | Impact |
|---|---|
| `governance/engine/` | `progress-table.js` (new, pure, read-only) — the only added engine-dir file; the executor is untouched |
| `governance/cli.js` | `printPauseOrEnd(res, flow)` renders the table; `cmdStatus` loads the flow and renders it; one import added |
| `governance/__tests__/` | `progress-table.test.mjs` (new): derivation table + back-edge re-entry + terminal zero-current + generalization across `full`/`fast` + CLI-wiring smoke at `start`/`resume`/`status` |
| `docs/` | this change package; `governance/README.md` note; epic acceptance line (via `aidakit:roadmap`) |
| `.claude-plugin/plugin.json` | `version` bump (PROCESS.md §5) |
| `governance/engine/engine.js`, `steps/*`, `parser.js`, `persistence.js`, `types.js` | **none** — read-only consumers, no schema/semantics change |

## Dependencies

- Builds on [command-grouping-and-inputs](../../archive/2026-07-24-command-grouping-and-inputs/proposal.md) (theme 1, archived): the entry points criterion 5 names are the renamed `/aidakit:flow-build` and `/aidakit:flow-design` commands locked by [ADR-005](../../decisions/ADR-005-command-namespacing.md). No hard code dependency — this change touches `governance/cli.js`, which those commands dispatch.
- Reads the state shape that [ADR-006](../../decisions/ADR-006-flow-values-as-data.md) formalized (`state.context[step.id]`, `pause.outputs`); it only *reads*, so it neither constrains nor is constrained by that contract.

## Exit criteria

Each maps to an owner-confirmed acceptance criterion; evidence recorded in [evidence.md](evidence.md).

- `node governance/__tests__/progress-table.test.mjs` → green, covering: derivation `done`/`current`/`pending` (crit. 1, 3); back-edge re-entry flips a `done` step back to `current` (crit. 3); a `completed`/`aborted`/`failed` flow renders **zero** `current` rows (crit. 1); `runs` gate steps appear as rows sourced from `step_history` (crit. 4); every declared step of BOTH `full` and `fast` appears as a row in declared order with no hardcoded id (crit. 2, 7); the table prints at `start`, `resume`, and `status` (crit. 5, 8).
- `node governance/__tests__/engine.test.mjs` → still green (no regression; the engine API is unchanged).
- Full suite `for t in governance/__tests__/*.test.mjs; do node "$t"; done` → all green.
- Live CLI smoke (isolated `AIDAKIT_PROJECT_ROOT`): `start full …` prints the table with one `current` row; `status <flow_id>` re-prints the same table from disk; driving a back-edge (`review fail`/`check_* failure`) shows the re-entered step flip from `done` to `current`; a completed run shows zero `current` rows. Byte-identical stdout piped vs. in a TTY (crit. 8).
- No file in this change emits a per-step outcome/result narrative (crit. 6 / theme-3 boundary).
- `node governance/validators/check-links.js docs/features/flow-run-progress-table` → exit 0.
- `node governance/validators/derive-roadmap-status.js --root .` → exit 0; this change derives `in-progress` from its `docs/features/` directory.
- `node governance/validators/check-plugin-version.js .` → exit 0 with the bumped manifest (PROCESS.md §5).

## Unblocks

Once the structural map is on-screen, sibling theme 3 (`flow-step-summaries`) can add the *narrative* layer on top of the *structural* layer without re-deriving progress — the two themes compose (map = this change; per-step story = theme 3). Consumer-authored flows in `.aidakit/flows/` inherit the table for free (criterion 7).

## Recorded decisions and inherited open decisions

- Read the [decisions index](../../decisions/README.md) and the ADRs whose subject this task touches:
  - [ADR-005](../../decisions/ADR-005-command-namespacing.md) (command namespacing — the `flow` group prefix / locked `flow-<name>` syntax) — defines the two command entry points criterion 5 renders under. Its mechanical, name-agnostic grouping spirit is mirrored by criterion 7's "no hardcoded flow name". Not superseded, not contradicted.
  - [ADR-006](../../decisions/ADR-006-flow-values-as-data.md) (flow values are data — structured invoke outputs) — pins `state.context`/`pause.outputs` shape the renderer *reads*. Read-only; no contract change.
  - [ADR-002](../../decisions/ADR-002-roadmap-status-derived-from-disk.md) (roadmap status derived from disk) — **constrains the docs task**: the epic acceptance line is authored intent; the generated `ROADMAP.md` is never hand-edited.
  - [ADR-001](../../decisions/ADR-001-executable-dna-crystallization.md), [ADR-003](../../decisions/ADR-003-shared-knowledge-in-docs.md), [ADR-004](../../decisions/ADR-004-aidakit-governance-env-contract.md) — read; do not constrain a read-only CLI presentation addition.
- **No new decision is locked by this change** (the `architecture` flag resolved to pure presentation), so no ADR is drafted and no escalation is triggered.
- No open-decisions log exists in this repo; nothing inherited.
