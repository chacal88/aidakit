# Proposal — flow-step-summaries

**Change ID:** `flow-step-summaries`
**Date:** `2026-07-24`
**Owner:** `@chacal88`
**Phase / Package:** `engine + CLI (governance/) — declarative per-step narrative on every pause; classification: domain=product, type=feature, flags=[ui, architecture→resolved: no new decision, extends ADR-006 values-as-data through a YAML template channel]`
**PRD:** `n/a`
**Tech Spec:** `n/a`

## Why

The [flow-run-progress-table](../../archive/2026-07-24-flow-run-progress-table/proposal.md) (theme 2, archived) shipped the **structural map** — one row per declared step, tagged `done`/`current`/`pending`. That map answers "where in the flow am I?" but is deliberately silent on **what actually happened at each `done` step** (criterion 6 of the sibling change, and its explicit theme-3 boundary). A driver reading `status <flow_id>` still has to open the JSON state or read the log to answer "what did `select` resolve to?", "which `choice` did the human pick at the pre-apply gate?", "why did `check_review_bench` fail?".

The flow runs across many short-lived CLI processes — the operator (human or Claude) cannot rely on session memory. The **narrative layer** must be persisted alongside the structural map, replayable at every `resume`/`status`. This change is **theme 3** of [EPIC-flow-cli-ux](../../roadmap/epics/EPIC-flow-cli-ux.md), unblocked by theme 2.

The right authoring surface is **the YAML flow definition** — values-as-data, per [ADR-006](../../decisions/ADR-006-flow-values-as-data.md): each step declares an optional `summary:` string template that interpolates the outputs it already captures (e.g. `summary: "resolved change_id={change_id}"` on `select`). The engine renders the template after the step resolves, hard-caps at 200 chars on ingest, and persists it. **ADR-006's `key=value` resume channel is NOT extended** — no prose channel is opened at resume-time; the prose lives in the YAML, sourced from declared outputs.

## What Changes

- **Engine — new state field `state.summaries[]`** and emission at pause-resolution: for every `invoke`/`human_gate`/`human_handoff` step, after the step produces an outcome, the engine renders the step's optional `summary:` template against the captured `context[step.id]` outputs and appends `{step_id, visit_n, outcome, text, ts}` to `state.summaries` (in [governance/engine/engine.js](../../../governance/engine/engine.js) — see [design.md](design.md) §Emission points for the exact site). `runs` steps do NOT emit (they never pause; criterion 3 of the sibling change already routes them via `step_history` only).
- **YAML schema — optional `summary:` field on any step** (`governance/engine/parser.js`, `types.js`). String template with `{key}` substitution, where keys resolve against `context[step.id]` (populated by the step executor: `context[step.id].outcome`, `context[step.id].change_id` on `select`, `context[step.id].choice` on a `human_gate`, etc.). Unset key → literal `<unset:key>` marker (visible, never crashes). Absent template → engine falls back to `{outcome}`.
- **Cap enforcement — 200 chars, engine-side, at ingest** ([design.md](design.md) §Cap enforcement): the rendered text is graceful-truncated with `…` as the last character; state stays well-shaped, no re-pause, no error. Truncation is a first-class deviation the owner sees in the log (documented in the guide).
- **Back-edge append semantics**: a re-entered step never overwrites prior entries — each pass appends a new `{step_id, visit_n:N+1, …}` record. Consumers see the full history in insertion order.
- **Failure/abort semantics**: an `invoke` returning `failure` still emits its summary before the flow routes to `on_failure`/terminal (assumption 4). `abort` preserves every prior `state.summaries[]` entry unchanged (assumption 5) — the array is append-only and never truncated by a terminal transition.
- **Progress-table renderer — indented second line under each `done` row** (`governance/engine/progress-table.js`): for every step whose id appears in `state.summaries`, print a second line indented under the row with the LATEST summary text for that step. The row itself (`id + marker`) is **not** mutated — the sibling's criterion 6 boundary ("id + marker only") is preserved by making the summary a **separate line**, not a row column. Absent summary (no template, no pause-emission) → no second line for that row (the map is uncluttered when nothing to say).
- **New CLI subcommand `summaries <flow_id>`** (`governance/cli.js`): prints the full ordered `state.summaries` log — one line per entry, `[<step_id>#<visit_n> <outcome>] <text>` — including back-edge history (each visit is its own line). Best-effort skip when state is absent (exit 2 usage error only for missing arg).
- **Tests** (`governance/__tests__/step-summaries.test.mjs`, new + engine-suite additions): YAML schema validation, template renderer, state append + back-edge history, cap enforcement, emission triggers per pause-emitting step type, failure/abort preservation, progress-table integration, `summaries` subcommand smoke.
- **Docs**: [governance/README.md](../../../governance/README.md) note on the new field/state/CLI + doctrine footer bump; a template-authoring line in the flows guide; roadmap enrichment on the theme-3 feature line (via `aidakit:roadmap`, never hand-editing derived files — [ADR-002](../../decisions/ADR-002-roadmap-status-derived-from-disk.md)).
- **Release**: `.claude-plugin/plugin.json` version bump so `claude plugin update` copies the new engine + CLI behavior ([PROCESS.md](../../../PROCESS.md) §5).

## Non-goals

1. **Row content is still `id + marker` only.** The sibling's criterion 6 is preserved. The summary renders as a **second, indented line** under the row — it does not become a row column, does not alter the row's status marker, and does not appear next to a `pending`/`current` row (only under `done` rows, i.e. only when a summary actually exists).
2. **No prose channel through `resume`.** [ADR-006](../../decisions/ADR-006-flow-values-as-data.md)'s `key=value` resume grammar is unchanged. The template lives in the YAML; the values it interpolates are the already-declared safe-token outputs (`change_id`, `choice`, `outcome`). Adding a `--message "…"` prose flag to `resume` is explicitly rejected here (would re-open the anti-prose leash ADR-006 closes).
3. **No emission on `runs` steps.** A `runs` step is deterministic (`{command, exit_code, stdout, stderr}` already persisted under `context[step.id]`); its result is machine-parseable. Adding a summary template there would either mirror `exit_code` (no value) or need `{stdout}` interpolation (potentially multiline/large — collides with the 1-line 200-char envelope).
4. **No emission on `loop`/`parallel`/`terminal`.** `loop`/`parallel` are structural containers; `terminal` is the end marker. None interpose a semantic pause the operator needs a narrative for.
5. **No live/animated widget, no ANSI color.** Same as sibling (theme 2): each CLI invocation is a fresh full redraw from disk; byte-identical output in a pipe and a TTY.
6. **No summary editing / redaction / retention policy.** Once appended, an entry stays for the life of the flow_id (until the state file is deleted). No `state.summaries.pop()`, no age cap, no "keep the last N" — the ordered log IS the artifact.
7. **No i18n of the built-in default `{outcome}`.** The word `outcome` is a machine-tagged classification (like the `done`/`current`/`pending` markers of the sibling change) and stays fixed regardless of project `language` ([DOCS.md](../../../DOCS.md) §5). The AUTHOR-supplied template text follows whatever language the flow author writes it in.
8. **No new ADR.** This change adds an OPTIONAL YAML field and one persisted array — it uses ADR-006's own values-as-data channel (declared outputs → template) rather than opening a new one. The `architecture` flag resolved in brainstorm to *no new decision*.

## Boundary with sibling `flow-run-progress-table` (explicit)

The two themes compose without overlap:

| Layer | Theme | Source | Where it renders in the table |
|---|---|---|---|
| **Position** (structural map) | theme 2 (shipped) | `flow.steps` order + `state.step_history`/`current_step`/`pause`/`status` | The ROW: `<gutter><marker> <step.id>` — untouched by this change. |
| **Narrative** (per-step story) | theme 3 (this change) | `state.summaries[]` (rendered from YAML `summary:` templates) | A **second, indented line UNDER** each `done` row that has a summary — never inside the row. |

`renderProgressTable` in this change still walks `flow.steps` in declared order, still tags each row `done`/`current`/`pending` by the sibling's exact derivation rule. The only mutation is: after emitting a `done` row, if `state.summaries` contains an entry for that `step.id`, append `\n      ↳ <latest.text>` (indented under the row). Everything the sibling's tests assert about the row itself still holds.

## Affected capabilities

Engine mechanism (`governance/engine/engine.js`, `parser.js`, `types.js`, `progress-table.js`) + CLI (`governance/cli.js`). **No `docs/specs/` in this repo** (confirmed by [engine-max-visits/proposal.md](../engine-max-visits/proposal.md) §Affected capabilities and by the sibling change) — **no capability spec delta**. The behavioral contract (emission rule, template grammar, cap, back-edge append) is pinned by `governance/__tests__/step-summaries.test.mjs` + the acceptance criteria below, mirroring the sibling change and `engine-max-visits`.

## Impact per surface

| Surface | Impact |
|---|---|
| `governance/engine/types.js` | `BaseStep` JSDoc extended with `summary?: string`; `FlowState` extended with `summaries?: StepSummary[]` (the `?` signals readers must tolerate absence — non-breaking). |
| `governance/engine/parser.js` | `validateSteps` accepts optional string `summary`; a non-string value is rejected. Does NOT validate that referenced `{key}` names exist in the step's declared outputs — validation of interpolation surfaces is a runtime concern (unset → `<unset:key>` marker, visible). |
| `governance/engine/engine.js` | After `state.step_history.push(history)` in `drive()`, if `step.type` is `invoke`/`human_gate`/`human_handoff` and the outcome is not `pause` (i.e., the step has resolved), render the template against `context[step.id]`, cap at 200, and append to `state.summaries`. No other engine change. |
| `governance/engine/progress-table.js` | For each `done` row, look up the LATEST `state.summaries` entry with that `step_id`; if present, emit a second indented line under the row. The row itself is untouched. Absent-`state.summaries` tolerated (older runs). |
| `governance/cli.js` | New `summaries <flow_id>` subcommand (`cmdSummaries`) — prints the ordered log. `start`/`resume`/`status` render the enriched progress table transparently (no wiring change — `progress-table.js` is the shared entrypoint). |
| `governance/__tests__/` | New `step-summaries.test.mjs` (see [tasks.md](tasks.md) for the enumerated cases). |
| `governance/flows/*.yaml` | **NO edits.** Kit-shipped flows do not need `summary:` templates to work — the fallback default renders `{outcome}`. Adding templates to `full`/`fast`/`design`/`docs-onboarding` is a **follow-up change** (each flow author decides where a template earns its keep). |
| `.aidakit/flows/*.yaml` | Consumer-authored flows may declare `summary:` on any pause-emitting step; parser accepts it out of the box. |
| `governance/README.md` | New line describing `state.summaries[]` + the `summaries` subcommand; doctrine footer bump. |
| `.claude-plugin/plugin.json` | `version` bump ([PROCESS.md](../../../PROCESS.md) §5). |
| `docs/roadmap/epics/EPIC-flow-cli-ux.md` | Feature-3 acceptance sub-bullet enriched (via `aidakit:roadmap`, never hand-editing derived `ROADMAP.md` — [ADR-002](../../decisions/ADR-002-roadmap-status-derived-from-disk.md)). |

## Acceptance criteria

Owner-locked in brainstorm; the design executes against these verbatim, and tests pin each one.

1. **Engine-persisted, replayable.** After a pause-emitting step (`invoke`, `human_gate`, `human_handoff`) resolves, `state.summaries[]` contains a new entry `{step_id, visit_n, outcome, text, ts}` in `.aidakit/flows/state/<flow_id>.json`. The next `resume`/`status` reads the same entry from disk — no in-memory-only state.
2. **Emitted on every pause-emitting step, uniformly across all flows.** `fast`, `full`, `design`, `docs-onboarding`, and any project `.aidakit/flows/*.yaml` receive the same treatment through the same engine mechanism. `runs` steps NEVER emit.
3. **`failure` outcome still emits.** An `invoke` that resolves with `failure` (routing to `on_failure`) emits its summary before routing. An `abort` outcome on a `human_gate` (routing to a terminal `aborted`) emits its summary before the terminal step runs.
4. **`abort` preserves prior summaries.** Aborting a running flow (`cli.js abort <flow_id>`, or a terminal-step reached via a routing decision) leaves every prior `state.summaries[]` entry unchanged. The `summaries <flow_id>` CLI still prints them.
5. **Back-edge appends.** A step re-entered via `on_result` (e.g. `critic: revise → specify` in `full.yaml`) generates a NEW `state.summaries` entry with `visit_n` incremented (`select#1`, `select#2`, …). No prior entry is overwritten; the ordered log preserves the loop history.
6. **YAML template channel driven by ADR-006.** A step's optional `summary:` string may reference `{outcome}` and any key the executor writes into `context[step.id]` (e.g. `change_id` from a declared `outputs: {success: [change_id]}`, `choice` from a `human_gate`). Unset key renders as `<unset:key>` (visible, non-fatal). Absent `summary:` field → fallback default `{outcome}`.
7. **1-line 200-char envelope, graceful truncation on ingest.** Rendered text longer than 200 chars is truncated (last char = `…`), so `state.summaries[i].text.length <= 200` always. Newlines in the rendered text are collapsed to single spaces. No re-pause, no error. The cap is engine-side; consumers can trust `state`.
8. **Progress-table integration preserves the sibling's row invariants.** For each `done` row that has at least one `state.summaries` entry, the table emits a second indented line under the row with the LATEST entry's `text`. The row line itself is byte-identical to what the sibling change produced (same `<gutter><marker> <step.id>`). Rows with no summary render exactly as before. `current`/`pending` rows never carry a second line.
9. **`summaries <flow_id>` CLI subcommand.** Prints the full ordered log — one line per entry, format `[<step_id>#<visit_n> <outcome>] <text>` — in insertion order (so back-edge history is chronological). Missing flow_id → exit 2 usage error; missing state file → same "flow not found" error as `status`.
10. **Non-breaking on old state files.** Reading a state file without `state.summaries` (an in-flight or archived flow that predates this change) works: the progress table renders exactly as before (no second lines), and `summaries <flow_id>` prints "no summaries recorded" gracefully.
11. **No prose channel through `resume`.** [ADR-006](../../decisions/ADR-006-flow-values-as-data.md)'s `key=value` grammar is unchanged; the value regex still rejects prose; no `--message`/`--note` flag is added.
12. **Identical output whether run directly or dispatched via Bash** — one code path, one text block (mirrors the sibling's criterion 8).

## Dependencies

- **[flow-run-progress-table](../../archive/2026-07-24-flow-run-progress-table/proposal.md)** — archived; this change edits `governance/engine/progress-table.js` to add the second-line rendering. The row-derivation logic and the three CLI render sites established by that change are inherited unchanged.
- **[ADR-006](../../decisions/ADR-006-flow-values-as-data.md)** — the template channel is a natural extension of the "flow values are data" principle: the summary template consumes structured outputs already declared under `outputs:`. The `key=value` resume channel and its regex are **not** modified; the prose lives in the YAML.
- **[engine-max-visits](../engine-max-visits/proposal.md)** (in-progress, sibling in the same worktree cluster) — its `state.context.__visits` counter is orthogonal (per-step visit cap, engine-side); this change derives `visit_n` locally from `state.summaries.filter(s => s.step_id === step.id).length + 1` and does not read `__visits` (kept decoupled to allow either to ship first).

## Exit criteria

Each maps to an acceptance criterion above; evidence recorded in [evidence.md](evidence.md).

- `node governance/__tests__/step-summaries.test.mjs` → green, covering: template renderer (unit); schema validation (parser accept + reject); emission on `invoke`/`human_gate`/`human_handoff` resolution (crit. 2); no emission on `runs` (crit. 2); `failure` outcome still emits (crit. 3); `abort` preserves prior entries (crit. 4); back-edge append with monotonic `visit_n` (crit. 5); template interpolation of `{outcome}` + declared output keys + unset key marker (crit. 6); 200-char cap + newline collapse (crit. 7); progress-table second-line rendering only under `done` rows with summaries (crit. 8); `summaries <flow_id>` subcommand output ordering + missing-summary graceful message (crit. 9, 10); non-breaking on state files without `summaries` (crit. 10).
- `node governance/__tests__/engine.test.mjs` → still green (no regression; the engine API and the shipped flows' behavior are unchanged because kit flows declare no `summary:` field — see Impact table).
- `node governance/__tests__/progress-table.test.mjs` → still green (row invariants unchanged; the second-line addition is under `done` rows with a summary and is asserted separately in `step-summaries.test.mjs`).
- Full suite `for t in governance/__tests__/*.test.mjs; do node "$t"; done` → all green.
- Live CLI smoke (isolated `AIDAKIT_PROJECT_ROOT`): a `.aidakit/flows/<name>.yaml` with a `summary:` template on `select` resolves; `resume` shows the second line under the `select` row; `summaries <flow_id>` prints the ordered log; a back-edge re-entry appends `#2` without touching `#1`; state file contains a well-shaped `summaries` array; a run with NO `summary:` templates still renders the same fallback `{outcome}` and back-compat progress table.
- `node governance/validators/check-links.js docs/features/flow-step-summaries` → exit 0.
- `node governance/validators/derive-roadmap-status.js --root .` → exit 0; this change derives `in-progress` from its `docs/features/` directory.
- `node governance/validators/check-plugin-version.js .` → exit 0 with the bumped manifest ([PROCESS.md](../../../PROCESS.md) §5).

## Unblocks

- Downstream authoring: any consumer flow gets per-step narrative for free — declare `summary: "…{key}…"` on the pause-emitting step and the engine records + renders it.
- Kit-shipped flows can later adopt templates (e.g. `select` → `summary: "resolved change_id={change_id}"`, `pre_apply_gate` → `summary: "chose {choice}"`, `implement` → `summary: "outcome={outcome}"`) as a follow-up polish change — each addition is a one-line YAML edit.
- Combined with the sibling structural map, `resume`/`status` now answers both "where am I?" and "what happened at each step?" without opening the JSON state or the event log.

## Recorded decisions and inherited open decisions

- Read the [decisions index](../../decisions/README.md) and every ADR whose subject this change touches:
  - [ADR-006](../../decisions/ADR-006-flow-values-as-data.md) (flow values are data) — **directly relevant**: the template channel consumes declared structured outputs, and the ADR's `key=value` resume grammar is deliberately NOT extended (see Non-goal 2). The prose lives in the YAML, sourced from safe-token outputs; the resume regex `RESUME_OUTPUT_VALUE_RE` continues to reject prose values, unchanged.
  - [ADR-005](../../decisions/ADR-005-command-namespacing.md) (command namespacing) — the `summaries <flow_id>` subcommand is added under `governance/cli.js` (the same CLI the sibling's `status` lives in), reached via the existing `flow-<name>` command surface. No new `/aidakit:*` command is added; the subcommand rides the same three entry points.
  - [ADR-002](../../decisions/ADR-002-roadmap-status-derived-from-disk.md) — constrains the docs task: the epic acceptance line is authored intent; the generated `ROADMAP.md` is never hand-edited.
  - [ADR-001](../../decisions/ADR-001-executable-dna-crystallization.md), [ADR-003](../../decisions/ADR-003-shared-knowledge-in-docs.md), [ADR-004](../../decisions/ADR-004-aidakit-governance-env-contract.md), [ADR-007](../../decisions/ADR-007-roadmap-status-from-shared-git.md), [ADR-008](../../decisions/ADR-008-opt-in-autonomous-pr-merge.md), [ADR-009](../../decisions/ADR-009-flow-commits-plan-early.md) — read; do not constrain a YAML template + persisted array + CLI subcommand addition.
- **No new decision is locked by this change**; no ADR is drafted and no escalation is triggered.
- No open-decisions log exists in this repo; nothing inherited.
