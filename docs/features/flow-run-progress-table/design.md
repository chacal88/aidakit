# Design — flow-run-progress-table

**Change ID:** `flow-run-progress-table`
**Date:** `2026-07-24`
**Owner:** `@chacal88`
**Phase / Package:** `n/a (CLI presentation; classification: domain=process, type=feature, flags=[ui, architecture→resolved: pure CLI presentation, no ADR])`
**PRD:** `n/a`
**Tech Spec:** `n/a`

## The shape of the solution

One pure function, three thin call sites, one new test file. The function projects `(flow.steps, loaded state) → a text block`; each CLI entry point that already prints flow state writes that block. There is no engine change because everything the table needs is **already parsed** (`loadFlow(name).flow.steps`) and **already persisted** (`state.step_history`, `state.current_step`, `state.pause`, `state.status`) — the renderer is a read model over data the engine writes anyway.

## Grounding (verified against the code)

Confirmed shapes — and **two brainstorm assumptions the code forced me to correct**:

- **`flow.steps`** — array of step maps. Each carries `id` (required string), `type`, and an optional `description` (`governance/engine/types.js:33-46`; validated `governance/engine/parser.js:142`). **CORRECTION 1: there is NO `title` field on a step.** The brainstorm said "step id/title"; the schema has only `id` + a longer, sometimes multi-line `description` (e.g. `governance/flows/full.yaml:126` is a `|` block). The row label is therefore **`step.id`** — no fallback is needed (id is always present). The `description` is deliberately NOT rendered: it is narrative-shaped and would bleed into theme-3 territory (criterion 6).
- **`state.step_history`** — array; each entry has `step_id` (`governance/engine/types.js:60-70`; written `governance/engine/engine.js:142-152`). Field name and element key confirmed as the brainstorm assumed. The `done` set is `new Set(state.step_history.map(h => h.step_id))`.
- **`state.current_step`** — `string|null`; set to `step.id` for **every** dequeued step, including terminal steps (`governance/engine/engine.js:126`).
- **`state.pause.step_id`** — the paused step (`governance/engine/types.js:76-86`; set on pause `governance/engine/engine.js:155-158`). Confirmed.
- **`state.status`** — `"running"|"paused"|"completed"|"aborted"|"failed"` (`governance/engine/types.js:58`).
- **CORRECTION 2 (load-bearing): `current_step` is NEVER cleared on a terminal state.** When the flow ends, the engine sets `status`/`outcome`/`finished_at` and saves, but leaves `state.current_step` pointing at the last-executed step — the terminal step `done`/`aborted` (`governance/engine/engine.js:161-168`), or the failing step on an unrouted failure (`:169-181`), or the last step on implicit completion (`:237-243`). So on a completed `full` run, `state.current_step === "done"`. The brainstorm's derivation ("`current` is `state.pause.step_id` when paused else `state.current_step`") is therefore **incomplete**: taken literally it would mark the terminal step `current` on a finished flow and violate criterion 1 ("zero `current` once completed/aborted"). The rule must be **gated on non-terminal status** — see below.
- **Also confirmed:** the currently-paused step is pushed to `step_history` (with `result: "paused"`) *before* the pause is persisted (`engine.js:142-158`), so the paused step is in BOTH the done-set and `pause.step_id`. The precedence "`current` wins over `done`" (below) renders it `current`, satisfying criterion 3's "never a stale `done` while it's being re-executed".
- **All shipped flows are flat** — no `loop`/`parallel` step type in `fast.yaml`/`full.yaml`/`design.yaml`/`docs-onboarding.yaml` (verified). The renderer walks the top-level `flow.steps` array; nested expansion is a non-goal.

## The pure helper — `governance/engine/progress-table.js`

Signature (read-only, no I/O, zero-dep):

```js
/** @param {import('./types.js').Step[]} steps  flow.steps (top-level, declared order)
 *  @param {import('./types.js').FlowState} state
 *  @returns {string}  the whole table block (trailing newline included) */
export function renderProgressTable(steps, state) { … }
```

### Status derivation (the whole logic)

```
doneSet   = new Set(state.step_history.map(h => h.step_id))
isTerminal = state.status === "completed"
          || state.status === "aborted"
          || state.status === "failed"
currentId = isTerminal ? null
          : (state.pause ? state.pause.step_id : state.current_step)   // may be null

for each step of steps (declared order):
  marker = (currentId != null && step.id === currentId) ? "current"    // (a) current wins
         : doneSet.has(step.id)                          ? "done"       // (b) then done
         :                                                  "pending"   // (c) else pending
```

Why this exact order and gate:

- **(a) before (b) — precedence** — a step re-entered via a back-edge is in `step_history` (from the earlier pass) AND is the current step; `current` must win so it never shows a stale `done` while being re-executed (criterion 3). Same rule handles the paused step being in `step_history`.
- **`isTerminal` gate on `currentId`** — the correction from Grounding: a finished flow has `current_step` still pointing at a real step, so we null `currentId` and every row falls through to `done`/`pending` → **zero `current`** (criterion 1). While `running`/`paused`, exactly one declared step equals `currentId` (the flat shipped flows guarantee `currentId` is a top-level id), so **exactly one** `current` (criterion 1).
- **`runs` gate steps** (`check_implement_bench`, `check_docs`, `route_mode`, …) never pause but ARE pushed to `step_history` when they route (`engine.js:142-152`), so they resolve to `done` once passed and always render as rows (criterion 4).
- **Name-agnostic** — reads only `step.id` and `state.*`; no flow name, no step id is hardcoded (criterion 7). Any `.aidakit/flows/<name>.yaml` the engine can load renders identically.

### Formatting (zero-dep, terminal-safe)

A row is bounded and short — the longest shipped id is `check_implement_bench` (21 chars). No wrapping, no truncation, no ANSI/color, no `process.stdout.columns` dependency: byte-identical output in a pipe and in a TTY, which is exactly criterion 8 ("identical whether run directly or dispatched via Bash"). Pure string building.

```
Flow: <state.flow_name> · <state.flow_id> · <state.status>[/<state.outcome>]
   done     select
   done     classify
 > current  specify
   pending  critic
   pending  pre_apply
   …
```

Row template: `${isCurrent ? " > " : "   "}${marker.padEnd(7)}  ${step.id}` — a 3-char gutter (`" > "` only on the current row), the status word padded to 7 (`current`/`pending` are the widest, 7), two spaces, the id. Header line names the flow, id and status; `outcome` appended only when present. Returns the header + rows joined by `\n`, with a trailing `\n`. The status words `done`/`current`/`pending` are the marker contract (criterion 1) and stay FIXED regardless of project `language` (they are machine-tagged classifications, not prose).

## CLI wiring — `governance/cli.js` (three sites, one block)

Add the import: `import { renderProgressTable } from "./engine/progress-table.js";` (alongside the existing `./engine/*` imports, `governance/cli.js:20-23`).

1. **`printPauseOrEnd` (`governance/cli.js:30-43`)** — used by BOTH `start` and `resume`, so wiring it once covers two of the three entry points (criterion 5). It currently takes only `res`; give it the loaded flow: `printPauseOrEnd(res, flow)`. As its first output, write `renderProgressTable(flow.steps, res.state)` + a blank line, THEN the existing PAUSED/END detail and resume hint. The table is the structural map; the existing block stays the local detail.
2. **`cmdStart` (`governance/cli.js:45-63`)** — already has `flow` from `loadFlow(flowName)` (`:48`). Pass it: `printPauseOrEnd(res, flow)` (`:62`).
3. **`cmdResume` (`governance/cli.js:65-88`)** — already has `flow` from `loadFlow(state.flow_name)` (`:79`). Pass it: `printPauseOrEnd(res, flow)` (`:87`).
4. **`cmdStatus` (`governance/cli.js:90-98`)** — the **only** site that must change beyond a signature: it currently loads `state` only. Add `const { flow, errors } = loadFlow(state.flow_name);` (`loadFlow` is already imported, `:21`). After the existing four summary lines, if `!errors.length` write `renderProgressTable(flow.steps, state)`; if the flow no longer loads (e.g. the YAML was removed), **skip the table** (best-effort) so `status` still works — the table is additive, never a new failure mode.

`abort`/`list` (`governance/cli.js:100-114`) do not print flow *state* and are left untouched (criterion 5 names exactly the three state-printing entry points).

## Why no engine change

Everything the table reads is a byproduct the engine already writes: `step_history` (`engine.js:152`), `current_step` (`engine.js:126`), `pause` (`engine.js:155-158`), `status` (`engine.js:156-250`). The renderer is a **read model**; it neither writes state nor is imported by any executor module (`engine.js`, `steps/*`, `invoke.js`, `runs.js`). It lives under `governance/engine/` purely for import locality with the `types.js`/state shapes it reads — there is no path from the executor back into it. This keeps the change's blast radius to `cli.js` + one new pure file + tests, and keeps the "no state field, no schema change, no semantics change" guarantee literally true.

## Back-edge / looping handling

The flows loop by design — `critic: revise → specify`, `readiness: needs-revision → specify`, `check_implement_bench`/`bench_outcome`/`hardening: failure → implement`, `check_review_bench: failure → review_bench`, `check_docs: failure → document`, `dna_freshness: failure → learn` (`governance/flows/full.yaml` routing; `fast.yaml` has the analogous `review: fail → implement`, `check_docs: failure → document`). Because the table is derived from `step_history` (a set, order-independent) + a single `currentId`, and NEVER from a counter or a reconstructed path, a re-entered step simply flips `done → current` (precedence (a)) and its downstream steps stay `pending` until re-reached. There is no iteration number and no reordering (criterion 3). A step visited, left `done`, then re-entered shows `current` again — correct — and reverts to `done` once the run moves past it on the next print.

Terminal steps `done`/`aborted` are ordinary rows: on a completed `full` run, `done` is in `step_history` → `done`; the untaken `aborted` branch stays `pending`. That is honest (a declared-but-not-visited step) and satisfies criterion 1 (zero `current`).

## Rejected alternatives

- **A `state.progress` field written by the engine.** Rejected — violates non-goal 2 (new state field / schema change) for zero benefit: the table is fully derivable from data already persisted. A stored field would also drift from the truth (the same anti-pattern DOCS.md §5 warns about for status snapshots).
- **Linear "step N of M" counter.** Rejected by criterion 2 — the flows have back-edges; a monotonic counter would lie about a looped run.
- **Rendering `step.description` as the row label / a second column.** Rejected — it is narrative-shaped (multi-line `|` blocks) and crosses the theme-3 boundary (criterion 6). Row content stays `id + marker`.
- **A dependency for table formatting (e.g. `cli-table3`).** Rejected — governance is zero-dep by design (non-goal 3); `padEnd` suffices for bounded, short rows.
- **TTY-conditional formatting / ANSI color / a live-updating widget.** Rejected — the flow spans separate short-lived processes (criterion 5) and criterion 8 demands byte-identical output in a pipe and a TTY. Plain text, full redraw each print.
- **Putting the helper next to `cli.js` (`governance/progress-table.js`).** Minor — chose `governance/engine/progress-table.js` for import uniformity with the other `./engine/*` modules and locality with the `types.js` shapes it reads; either location is defensible.
- **Expanding nested loop/parallel bodies into rows.** Rejected/deferred — no shipped flow nests (verified); the top-level `flow.steps` walk honors criterion 2 exactly.

## Rollback notes

Low-risk and self-contained. Reverting = delete `governance/engine/progress-table.js`, drop the import and the three one-line render calls in `cli.js` (restore `printPauseOrEnd(res)` / `cmdStatus` to their pre-change form), delete `progress-table.test.mjs`, and revert the version bump. No state on disk carries any new field, so no migration and no state cleanup is needed — old and new state files are byte-compatible. The engine and all other tests are untouched, so a revert cannot regress flow execution.
