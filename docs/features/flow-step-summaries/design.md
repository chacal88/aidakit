# Design — flow-step-summaries

**Change ID:** `flow-step-summaries`
**Date:** `2026-07-24`
**Owner:** `@chacal88`
**Phase / Package:** `engine + CLI (governance/) — declarative per-step narrative on every pause`

## The shape of the solution

One new persisted array (`state.summaries`), one new optional YAML field (`summary:`), one small template renderer, one emission block in `drive()`, one added second-line branch in the existing `renderProgressTable`, one new CLI subcommand (`summaries <flow_id>`). No new file lives outside `governance/engine/` and `governance/cli.js`; every module already imported by the engine is reused.

The whole design lives inside three constraints:

1. **[ADR-006](../../decisions/ADR-006-flow-values-as-data.md) is not extended.** The `key=value` resume regex is untouched; no prose channel is opened at resume-time. Prose lives in the YAML, sourced from the safe-token outputs the executors already write into `context[step.id]`.
2. **Sibling change [flow-run-progress-table](../../archive/2026-07-24-flow-run-progress-table/design.md) invariants hold.** Row content stays `id + marker` only; the summary is a SECOND, indented line under `done` rows — never a row column, never on `pending`/`current`.
3. **State schema stays non-breaking.** Readers must tolerate missing `summaries` (an in-flight run started before this change ships) — every access is `state.summaries ?? []`.

## Grounding (verified against the code)

- **`state.step_history`** — array; each entry `{step_id, step_type, path, started_at, ended_at, result, output?, error?}` ([governance/engine/types.js:70-80](../../../governance/engine/types.js), pushed at [governance/engine/engine.js:196-207](../../../governance/engine/engine.js)). A step re-entered by a back-edge appears MULTIPLE times in this array — one entry per drive-loop iteration through the step. **`step_history` therefore already double-counts pause-emitting steps** (one entry to pause, one to resolve), which is why nesting `summaries` inside `step_history` would be wrong (see §State schema decision).
- **`context[step.id]`** — populated by each step's executor **before** the outcome is returned:
  - `invoke.js`: on resume-success, writes every supplied output key + `outcome` + `invoke_target` into `context[step.id]` at [governance/engine/steps/invoke.js:79-87](../../../governance/engine/steps/invoke.js), *then* returns `{kind:"next", outcome}`.
  - `human-gate.js`: writes `context[step.id].choice = <resume-value>` at [governance/engine/steps/human-gate.js:30-33](../../../governance/engine/steps/human-gate.js), then returns `{kind:"next", outcome: choice}`.
  - `human-handoff.js`: writes `context[step.id].response = <resume-value>` at [governance/engine/steps/human-handoff.js:14-17](../../../governance/engine/steps/human-handoff.js), then returns `{kind:"next", outcome:"success"}`.
  - `runs.js`: writes `{command, vars, cwd, exit_code, stdout, stderr}` at [governance/engine/steps/runs.js:41-50](../../../governance/engine/steps/runs.js) — we do NOT emit for `runs`, so this is only listed for completeness.
- **Emission site in `drive()`** — the whole outcome-resolution block is [governance/engine/engine.js:186-234](../../../governance/engine/engine.js): `dispatch(step, ctx)` returns an outcome, then `state.step_history.push(history)` at :206, then branching on `outcome.kind`. The summary emission fits between :207 and :209 — after the history entry, before the pause/terminal/fail/next branches. Everything downstream (`saveState`, log events, routing) is unchanged.
- **`step.type` on pause-emitting steps** — `invoke`, `human_gate`, `human_handoff`. `runs`/`loop`/`parallel`/`terminal` are excluded from emission by the type gate.
- **Renderer** — [governance/engine/progress-table.js:19-42](../../../governance/engine/progress-table.js). Row template is `${gutter}${marker.padEnd(7)}  ${step.id}`. Modification is a single conditional append: for `done` marker, if `state.summaries` has an entry for `step.id`, append `\n             ↳ <text>` (13-space indent to sit under the id column: 3-char gutter + 7-char padded marker + 2 spaces + 1 space = 13 chars; the `↳` sits at column 13 — see §Progress-table sample below and §Progress-table rendering below for the implementation).
- **CLI** — `governance/cli.js` dispatches via a `switch(cmd)` at :121-131. Add a `case "summaries": cmdSummaries(argv); break;` line and the `cmdSummaries` function alongside the existing `cmdStatus` shape (loads state, prints).

## State schema decision

**Choice: per-flow top-level `state.summaries: StepSummary[]` array. NOT nested inside `step_history` entries.**

Rationale:

- **`step_history` double-counts pause-emitting steps** (one entry per drive-loop pass, so an `invoke` pause + resume is TWO history entries; back-edge re-entry adds another PAIR). Nesting one summary per history entry either duplicates the summary (redundant) or leaves half the entries with `summary: null` (noise). The top-level array is exactly one entry per completed pause-emitting visit — matches the mental model.
- **CLI consumers (progress-table, `summaries <flow_id>`) want an ORDERED log** keyed on `step_id`. A flat array is `O(n)` to scan and trivial to filter for the LATEST entry per step (`arr.filter(s => s.step_id === id).pop()`) or to iterate for the CLI print. Nesting would force every consumer to walk `step_history` and re-order.
- **Back-edge append is one push** to the top-level array; nesting would require reaching into the correct `step_history[i].summary` and duplicating the append logic per pass.
- **Non-breaking guarantee is trivial** on a top-level array (`state.summaries ?? []` everywhere it is read); nesting would leak into every `step_history` reader.
- **Roadmap-status derivation** (`governance/roadmap/`) reads the docs tree (per [ADR-002](../../decisions/ADR-002-roadmap-status-derived-from-disk.md), amended by [ADR-007](../../decisions/ADR-007-roadmap-status-from-shared-git.md)) and the shared git state — **it does not read `.aidakit/flows/state/*.json`** (grep of `governance/roadmap/` confirmed: no `flows/state` reference). So adding a top-level field cannot break status derivation.

Shape:

```jsonc
// .aidakit/flows/state/<flow_id>.json
{
  "flow_id": "full-260724-abcdef",
  "flow_name": "full",
  // ... every existing field unchanged ...
  "step_history": [ /* unchanged */ ],
  "summaries": [
    { "step_id": "select",   "visit_n": 1, "outcome": "success", "text": "resolved change_id=flow-step-summaries", "ts": "2026-07-24T15:22:03.114Z" },
    { "step_id": "classify", "visit_n": 1, "outcome": "success", "text": "domain=product type=feature",             "ts": "2026-07-24T15:22:07.402Z" },
    { "step_id": "specify",  "visit_n": 1, "outcome": "success", "text": "success",                                  "ts": "2026-07-24T15:23:11.001Z" },
    { "step_id": "critic",   "visit_n": 1, "outcome": "revise",  "text": "revise",                                   "ts": "2026-07-24T15:24:44.220Z" },
    { "step_id": "specify",  "visit_n": 2, "outcome": "success", "text": "success",                                  "ts": "2026-07-24T15:26:02.998Z" }
  ]
}
```

`StepSummary` fields — every one is machine-friendly:

| Field | Type | Meaning |
|---|---|---|
| `step_id` | string | The `step.id` this entry describes. |
| `visit_n` | integer ≥1 | Monotonic count of pause-emitting visits to this step in this `flow_id`. Derived at push time: `state.summaries.filter(s => s.step_id === id).length + 1`. |
| `outcome` | string | The outcome the step resolved to (`"success"` / `"failure"` / a `human_gate` choice like `"abort"` / `"apply"` / …). Same value as `step_history[i].result` for the corresponding pass. |
| `text` | string, ≤200 chars | The rendered + capped summary. Never `null`; the fallback default `{outcome}` always yields a non-empty string. |
| `ts` | ISO-8601 string | Emission timestamp — the moment the engine appended the entry (`new Date().toISOString()` at push time). |

## YAML schema — the optional `summary:` field

```yaml
  - id: select
    type: invoke
    invoke_target: aidakit:orchestrator
    outputs:
      success:
        - change_id
    summary: "resolved change_id={change_id}"     # ← this change
    on_success: classify
    on_failure: aborted
```

Rules (validated by `governance/engine/parser.js validateSteps`):

- **Optional, string only.** Absent field → engine falls back to the default template `"{outcome}"`. A non-string value (list, map, number) → parser rejects at LOAD with `{at}: 'summary' must be a string when present` (fail-closed, same style as the existing `outputs`/`max_visits` rejections).
- **Any step type may declare `summary:`** at the parser level (permissive schema). At RUNTIME the engine only emits for `invoke`/`human_gate`/`human_handoff` — the parser does NOT reject `summary:` on `runs`/`loop`/`parallel`/`terminal`, it is simply ignored. Rationale: keeping the schema permissive avoids a wave of `summary:`-on-`runs` warnings for future authors who add it defensively and doesn't hurt anyone. If misuse becomes a pattern, a lint warning is a cheap follow-up.
- **NO validation that `{key}` names exist** in the step's declared outputs at LOAD time. Rationale: outputs may be written by generic executors (`choice` on `human_gate`, `outcome`/`invoke_target` on any invoke, structured outputs declared under `outputs:`), and a template that references `{some_key_you_forgot_to_declare}` renders as `<unset:some_key_you_forgot_to_declare>` (visible, non-fatal) — the author sees the marker on the first run and fixes the template. Load-time validation would need to know every executor's write-set, which duplicates knowledge from the executor into the parser.

Fallback default when `summary:` is absent: literal string `"{outcome}"` — the renderer resolves `{outcome}` from `context[step.id].outcome` (populated by every pause-emitting executor), yielding e.g. `"success"`, `"failure"`, `"apply"`, `"abort"`.

## Template rendering — the tiny renderer

New pure helper, no I/O, zero-dep: `governance/engine/summary-template.js`:

```js
/**
 * @param {string} template        e.g. "resolved change_id={change_id}"
 * @param {Object.<string,unknown>} bag  the step's context[step.id] object
 * @returns {string}               the rendered text, with unset keys shown as <unset:key>
 */
export function renderSummary(template, bag) {
  return String(template).replace(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_, key) => {
    const v = bag[key];
    if (v === undefined || v === null) return `<unset:${key}>`;
    // Collapse any newline/CR in a value to a single space, so the whole rendered
    // text stays on ONE line before the 200-char cap logic runs.
    return String(v).replace(/[\r\n]+/g, " ");
  });
}
```

Design choices:

- **Substitution grammar: `{key}`** (single braces), NOT `${…}`. Rationale: the engine's existing `${…}` interpolation (`interpolate.js`) resolves against `state.inputs`/`state.context.<step>.<key>`/`flow_id`/loop vars — a template that ran through it would need `${context.select.change_id}` instead of `{change_id}`, which is verbose (the template is already scoped to `context[step.id]`, so keys are unambiguous). Single-brace `{key}` mirrors Python-style format strings, is unambiguous inside a one-line human-readable string, and does not collide with any existing template surface in the flow YAMLs (verified — no `{…}` occurrences in `governance/flows/*.yaml`).
- **Key pattern: `[A-Za-z_][A-Za-z0-9_]*`** — matches the executors' write-key vocabulary (`outcome`, `invoke_target`, `choice`, `response`, `change_id`, any safe-token key from `outputs:` per `RESUME_OUTPUT_KEY_RE`). Anything else in braces is left literal (e.g. `{}`, `{123}`, `{a.b}` — never substituted, printed as-is).
- **Unset key: `<unset:key>` marker** — visible, non-fatal, catches template typos on the first run. Never throws.
- **Newline collapse in values** — a value that happens to contain a newline (rare — safe-token regex forbids it for structured outputs, but `human_handoff.response` is free-text) would break the 1-line envelope; collapse to spaces up front so the cap sees a single line.
- **No brace escaping** (no `{{…}}` → `{…}` literal). Rationale: keep the surface minimal for v1; templates are one-liners and literal braces are exceptional. If a template ever needs a literal `{`, it can be added later without breaking existing templates (the regex is strict on the key shape, so `{{x}}` today renders `<unset:{x>` visibly — the author flags it).

## Emission points in the engine

Precisely one insertion in `drive()`, [governance/engine/engine.js:196-234](../../../governance/engine/engine.js) — after the `state.step_history.push(history)` at :206 and BEFORE the `outcome.kind` switch at :209:

```js
// (unchanged)
state.step_history.push(history);
logEvent(state.flow_id, { event: "step_end", step_id: step.id, result: history.result });

// ── NEW: emit a step summary for pause-emitting step types on resolution ─────
// Emits when the step has RESOLVED (kind: "next" or "fail") — NOT on the
// initial pause (kind: "pause"), because context[step.id] is only fully
// populated after resume. The type gate excludes `runs`/`loop`/`parallel`/
// `terminal` (which never pause and do not carry a per-step narrative).
if (
  (outcome.kind === "next" || outcome.kind === "fail") &&
  (step.type === "invoke" || step.type === "human_gate" || step.type === "human_handoff")
) {
  const bag = (state.context[step.id] ?? {});
  const template = typeof step.summary === "string" ? step.summary : "{outcome}";
  const rawText = renderSummary(template, bag);
  const cappedText = capSummary(rawText);        // graceful truncation to 200
  const priorVisits = (state.summaries ?? []).filter((s) => s.step_id === step.id).length;
  state.summaries = state.summaries ?? [];
  state.summaries.push({
    step_id: step.id,
    visit_n: priorVisits + 1,
    outcome: outcomeKey(outcome),   // "success" | "failure" | choice-string
    text: cappedText,
    ts: new Date().toISOString(),
  });
  logEvent(state.flow_id, { event: "step_summary", step_id: step.id, visit_n: priorVisits + 1, text: cappedText });
}
// ── END NEW ──────────────────────────────────────────────────────────────────

if (outcome.kind === "pause") { /* unchanged */ }
```

Why here and nowhere else:

- **After `step_history.push`, before the outcome switch** — this is the single point in `drive()` where every step (every type, every outcome except `pause`) is guaranteed to have (a) resolved, (b) written its outputs into `context[step.id]` (see Grounding for the three executor sites), (c) not yet been routed. Any earlier and `context[step.id]` may be incomplete; any later and we're inside one of four kind-specific branches, each of which either persists state and returns or routes to another queue entry — we'd need four insertions to cover the same cases.
- **`kind: "pause"` is NOT emitted here** — a pause is the FIRST traversal of an invoke/human_gate (waiting for the operator to report). The SECOND traversal (after `resume`) reaches this block with `kind: "next"` (or `"fail"` if the executor throws) and `context[step.id]` populated — that's the emission point.
- **`kind: "fail"` is EMITTED** (crit. 3) — an `invoke` that resolves to `failure` returns `{kind:"next", outcome:"failure"}`; that's covered by the `"next"` branch. A step whose executor throws returns `{kind:"fail"}` (see `dispatch`'s try/catch at :187-191); we include it in the emission so a genuine crash still gets a `text` (which renders to `<unset:outcome>` if the executor threw before writing to `context[step.id]` — visible, no throw).
- **Terminal steps** (`type: "terminal"`) return `{kind: "terminal"}`, which the type gate excludes — the terminal step is a marker, not a semantic pause. Prior summaries are still on `state.summaries` when the terminal branch persists state at :218-221 (crit. 4).
- **Abort via `cli.js abort <flow_id>`** — `cmdAbort` at [governance/cli.js:105-113](../../../governance/cli.js) sets `state.status = "aborted"`, `state.outcome = "aborted"`, writes `finished_at`, and `saveState(state)`. It does NOT touch `state.summaries`, so every prior entry is preserved (crit. 4). No change to `cmdAbort` is needed.

`saveState(state)` — already called by the next branch (`pause`/`terminal`/`fail`/`next`) at :212/:219/:232/:295/:303, so the new `state.summaries` entry rides the existing persistence. No extra write.

`capSummary` — a tiny helper in the same `summary-template.js` module:

```js
const MAX_SUMMARY_CHARS = 200;
export function capSummary(text) {
  const single = String(text).replace(/[\r\n]+/g, " ");     // belt-and-braces: also collapse at the cap boundary
  if (single.length <= MAX_SUMMARY_CHARS) return single;
  return single.slice(0, MAX_SUMMARY_CHARS - 1) + "…"; // "…" one-char ellipsis
}
```

Cap enforcement lives at **ingest** (engine-side, one call before the push): state is guaranteed well-shaped for every consumer (progress-table, `summaries` CLI, downstream code) — no reader has to defensively re-truncate. Truncation is graceful (never re-pauses, never errors); the author sees the `…` and shortens the template.

## Progress-table rendering — the second-line addition

Only edit in [governance/engine/progress-table.js](../../../governance/engine/progress-table.js): after computing `marker` for each row, if `marker === "done"` and `state.summaries` has at least one entry for `step.id`, emit a second line under the row with the LATEST entry's text.

```js
export function renderProgressTable(steps, state) {
  const doneSet = new Set(state.step_history.map((h) => h.step_id));
  const isTerminal = TERMINAL_STATUSES.has(state.status);
  const currentId = isTerminal ? null : (state.pause ? state.pause.step_id : state.current_step);
  const summariesByStep = groupLatestByStep(state.summaries ?? []);   // Map<step_id, latestEntry>

  const header = `Flow: ${state.flow_name} · ${state.flow_id} · ${state.status}${state.outcome ? `/${state.outcome}` : ""}`;
  const lines = [header];
  for (const step of steps) {
    const marker = markerFor(step, currentId, doneSet);
    const gutter = marker === "current" ? " > " : "   ";
    lines.push(`${gutter}${marker.padEnd(7)}  ${step.id}`);
    if (marker === "done") {
      const entry = summariesByStep.get(step.id);
      if (entry) lines.push(`             ↳ ${entry.text}`);   // 13-space indent to sit under the id column
    }
  }
  return lines.join("\n") + "\n";
}
```

Row-invariant preservation (sibling change's criterion 6, criterion 8):

- The row line itself (`${gutter}${marker.padEnd(7)}  ${step.id}`) is byte-identical to the sibling's output — the current `progress-table.js` test suite continues to pass unchanged (asserted in [tasks.md](tasks.md) §Validation).
- The second line is ONLY under `done` rows that have a summary — `current`/`pending` rows never carry it; a `done` row without a summary (a `runs` step that passed, or a pause-emitting step whose flow ran before this change shipped) renders exactly as before.
- The 13-space indent aligns the `↳` marker roughly under the step id column (3-char gutter + 7-char padded marker + 2 spaces = 12 chars to reach the id; the `↳` sits at column 13, one past the id column start, visually clearly a continuation of the row above).

### Before / after ASCII sample

Before (theme 2 shipped state), driving `full` with `select` → `classify` → `brainstorm` → paused at `specify`:

```
Flow: full · full-260724-abcdef · paused
   done     select
   done     classify
   done     brainstorm
 > current  specify
   pending  commit_plan
   pending  pre_apply_gate
   …
```

After (this change, with `summary:` templates on `select`/`classify`/`brainstorm`):

```
Flow: full · full-260724-abcdef · paused
   done     select
             ↳ resolved change_id=flow-step-summaries
   done     classify
             ↳ domain=product type=feature
   done     brainstorm
             ↳ done
 > current  specify
   pending  commit_plan
   pending  pre_apply_gate
   …
```

After a back-edge re-entry (`critic: revise → specify`, then `specify` succeeds a second time — the LATEST `specify` summary is what renders under the row):

```
Flow: full · full-260724-abcdef · paused
   done     select
             ↳ resolved change_id=flow-step-summaries
   done     classify
             ↳ domain=product type=feature
   done     brainstorm
             ↳ done
   done     specify
             ↳ success                                 ← the LATEST (#2) shows here; #1 is still in state.summaries
   done     critic
             ↳ revise
   done     specify         ← same id appears TWICE in the table only if the flow declares it twice
   …
```

Note: the progress table walks `flow.steps` (declared order, no duplicates), so a re-entered step id appears ONCE in the table (that's the sibling's own criterion 3 semantics). The full loop history is not in the TABLE — it lives in the `summaries` CLI output (below).

## `summaries <flow_id>` CLI subcommand

```
node governance/cli.js summaries <flow_id>
```

Loads state, prints the full ordered log. One line per entry:

```
[<step_id>#<visit_n> <outcome>] <text>
```

Example (same run as above, after two `specify` visits):

```
$ node governance/cli.js summaries full-260724-abcdef
[select#1 success] resolved change_id=flow-step-summaries
[classify#1 success] domain=product type=feature
[brainstorm#1 done] done
[specify#1 success] success
[critic#1 revise] revise
[specify#2 success] success
```

Contract:

- Missing arg → exit 2 usage error (`usage: summaries <flow_id>`, same style as the other `cmd*` handlers via `fail()` at [governance/cli.js:26-29](../../../governance/cli.js)).
- State not found → exit 2 (`flow not found: <flow_id>`, same message as `cmdStatus`/`cmdAbort`).
- State has no `summaries` field OR an empty array → print `no summaries recorded for <flow_id>` and exit 0. Non-breaking on old state files (crit. 10).
- One entry per `state.summaries[i]`, in insertion order — no filtering, no sorting, no reordering. Back-edge visits appear chronologically (`select#1`, `select#2`, …) — the visit sequence IS the log.

Implementation sketch (parallel to `cmdStatus`):

```js
function cmdSummaries(argv) {
  const flowId = argv[0];
  if (!flowId) fail("usage: summaries <flow_id>");
  const state = loadState(flowId);
  if (!state) fail(`flow not found: ${flowId}`);
  const summaries = state.summaries ?? [];
  if (!summaries.length) {
    process.stdout.write(`no summaries recorded for ${flowId}\n`);
    return;
  }
  for (const s of summaries) {
    process.stdout.write(`[${s.step_id}#${s.visit_n} ${s.outcome}] ${s.text}\n`);
  }
}
```

Wired in the `switch(cmd)` at [governance/cli.js:121-131](../../../governance/cli.js) — new `case "summaries": cmdSummaries(argv); break;` line. `abort`/`list` and the other commands untouched.

## Failure / abort semantics — worked cases

**Case A: `invoke` returns `failure` (routed via `on_failure`).**
`resumeFlow` → `drive` → `dispatch(invoke)` → executor validates outcome ("failure" is in `expects`) → writes `context[step.id].outcome = "failure"` (invoke.js:79-86) → returns `{kind:"next", outcome:"failure"}` → `step_history.push` → **emission block runs** (kind is `"next"`, type is `invoke`) → `state.summaries.push({outcome:"failure", text: <rendered>, …})` → routing block picks `on_failure` target → next iteration. ✅ Crit. 3.

**Case B: `human_gate` resolves to a non-`success` choice like `abort`.**
Same path: executor writes `context[step.id].choice = "abort"` (human-gate.js:30-33), returns `{kind:"next", outcome:"abort"}` → **emission runs** → summary appended with `outcome:"abort"` (and `{choice}` interpolated as `abort` if the template uses it) → routing follows `on_result.abort` (typically → `aborted` terminal). ✅ Crit. 3, 4.

**Case C: dispatch throws (`kind:"fail"`).**
`dispatch(step, ctx)` at :187-191 catches the throw and returns `{kind:"fail", error}`. `context[step.id]` may or may not be populated depending on where the throw happened. **Emission runs** (kind is `"fail"`, type is one of the three); `{outcome}` in the template resolves against `context[step.id].outcome` — if the executor threw before writing it, `renderSummary` yields `<unset:outcome>` visibly. Non-fatal. Routing follows `on_failure` or fails the flow. ✅ Crit. 3.

**Case D: `cli.js abort <flow_id>` on a running flow.**
`cmdAbort` at [governance/cli.js:105-113](../../../governance/cli.js) sets terminal fields and `saveState`; it does NOT enter `drive()` and does NOT touch `state.summaries`. Every prior summary stays on disk. Subsequent `summaries <flow_id>` and `status` reads see them intact. ✅ Crit. 4.

**Case E: `terminal` step reached via routing.**
`dispatch(terminal)` returns `{kind:"terminal"}`. Emission block skips (type gate: `terminal` not in `{invoke, human_gate, human_handoff}`). Terminal branch persists state; prior summaries preserved. ✅ Crit. 4.

## Non-breaking guarantees

- **State schema.** `state.summaries` is OPTIONAL. Every read path uses `state.summaries ?? []`. An in-flight `full-260724-…` run started before this change ships continues to work: `resume` succeeds, `status` prints the progress table without any second lines (no summaries in state), `summaries <flow_id>` prints "no summaries recorded". Once the run reaches its next pause-emitting step under the new engine build, the array is created and populated from that point on — no migration.
- **Flow YAMLs.** Every existing kit flow (`fast`, `full`, `design`, `docs-onboarding`) still loads and executes identically — the parser now ACCEPTS an optional `summary:` field, but no shipped flow declares it. The engine's emission runs on every pause-emitting step regardless of whether `summary:` is set (fallback default `{outcome}`), so shipped flows automatically start producing minimal summaries (`success`/`failure`/etc.) — a low-noise, low-value default that authors can enrich with a one-line YAML edit.
- **Engine API.** `startFlow`/`resumeFlow` signatures unchanged. `drive()` return shape unchanged. `progress-table.js` export unchanged. Only the CLI adds a new `case`.
- **Tests.** The existing `engine.test.mjs` (149 assertions) and `progress-table.test.mjs` (30 assertions) continue to pass: the row-line output is byte-identical (asserted); the engine's routing and pause/resume are unchanged; the state files the existing tests build now carry an extra `summaries` array on pause-emitting steps, but no existing assertion inspects that field (grep confirmed).

## Rejected alternatives

- **Nest the template under `outputs:` (as `outputs.summary`).** Rejected — the existing `outputs:` map is keyed by outcome name (`success:`, `failure:`, `revise:`, …) and holds the list of output keys the executor captures from that outcome's `key=value` resume args (see [ADR-006](../../decisions/ADR-006-flow-values-as-data.md)). A `summary` key at that same level would collide with the outcome-name namespace (a hypothetical future outcome literally named `summary` would silently overwrite the template), and semantically the summary is a per-STEP concern (rendered once per pause, regardless of which outcome fired) — not a per-OUTCOME concern. Top-level `summary:` sibling to `outputs:` keeps outcomes as a pure list-of-outcomes map and puts the summary at the level where it actually lives (the step). The brainstorm's shorthand phrasing `outputs.summary` was treated as informal ("the summary output of the step"), confirmed with the owner before this revision.
- **Nest `summary` inside each `step_history[i]` entry.** Rejected — `step_history` double-counts pause-emitting steps (one entry per drive pass), so summaries would either duplicate or half be null; ordered-log consumers would need to reconstruct the top-level view anyway (see §State schema decision).
- **Emit at the `pause` (first drive-loop pass) instead of at resolution.** Rejected — `context[step.id]` is not populated until after `resume` (the executor writes it in the resume-value branch); a template like `{change_id}` would render `<unset:change_id>` on every first pause and only get real values after resume. Emission at resolution is the natural point where BOTH the outcome AND the outputs are known.
- **Open a prose channel through `resume` (`resume … --message "…"`).** Rejected — directly contradicts [ADR-006](../../decisions/ADR-006-flow-values-as-data.md)'s locked "no prose in the resume channel" (the `RESUME_OUTPUT_VALUE_RE` regex explicitly rejects prose). Would require a new ADR to supersede, which the change scope does not justify (assumption 7).
- **Store the RAW rendered text uncapped, cap only in the renderer.** Rejected — a rogue template (accidentally interpolating a `{stdout}` from a giant `runs` output) would balloon state file size; consumers would each need to defensively re-cap. Cap at ingest keeps state ≤200 chars per entry, always.
- **Use the existing `${…}` interpolation grammar for `summary:`.** Rejected — verbose (`${context.select.change_id}` vs. `{change_id}` — the template is already scoped to `context[step.id]`) and would resolve against a broader surface (`inputs.*`, other steps' context) than the summary needs. The narrow single-brace grammar makes the template a pure formatter of THIS step's data.
- **Reject `summary:` on non-pause-emitting steps at parse time.** Rejected — permissive schema is friendlier for authors who add it defensively on a `runs` step (it is silently ignored, no error); a lint warning can be added later if the pattern proves problematic. Fail-closed makes sense for structural bugs (`max_visits` without escalation); ignoring a harmless optional field does not warrant it.
- **Live-updating widget / ANSI color for the second line.** Rejected — same as sibling change (theme 2): the flow spans separate short-lived processes; each print is a full redraw from disk; byte-identical output in a pipe and a TTY (criterion 12).
- **Store the template AS-RENDERED in `step_history[i].output.summary_text` and have progress-table read from there.** Rejected — couples two different mental models (`step_history` = per-drive-pass raw record; `summaries` = per-visit ordered log) and forces consumers to re-derive the ordered log by filtering `step_history` for pause-emitting entries. The top-level array is the single source of truth for the narrative layer.
- **A new `/aidakit:flow-summaries <flow_id>` command.** Rejected — the sibling change already established `governance/cli.js` as the entry point for read-only flow queries (`status`, `list`); adding a fourth `cli.js` subcommand fits the same shape. A `/aidakit:*` command would need a new namespaced entry, its own docs, and a `flow-<name>` prefix per [ADR-005](../../decisions/ADR-005-command-namespacing.md) — overkill for a read-only accessor.

## Rollback notes

Low-risk, additive, self-contained. Reverting = drop the new `summaries` field from `types.js`, delete the emission block in `engine.js` (revert to the current shape at :196-209), remove the second-line append in `progress-table.js` (revert to the sibling's shape), delete the `summaries` case in `cli.js`'s switch, delete `cmdSummaries`, delete `summary-template.js`, delete `step-summaries.test.mjs`, revert the parser's `summary:` acceptance, revert the version bump.

**State-file compat on rollback:** state files that ran under this change carry an extra `state.summaries` array; the old engine `JSON.parse`s state as-is (it doesn't validate schema on load — see [governance/engine/persistence.js:66-70](../../../governance/engine/persistence.js)) and simply ignores the unknown top-level field. No migration on either direction; no state cleanup needed. The engine and every other test are untouched.

## Anti-drift check (re-inspected before writing this design)

- [engine.js:196-234](../../../governance/engine/engine.js) — `drive()` outcome-resolution block, insertion point confirmed between `step_history.push` and the `outcome.kind` switch.
- [engine/steps/invoke.js:79-87](../../../governance/engine/steps/invoke.js) — `context[step.id]` populated BEFORE the executor returns `{kind:"next"}`. Confirmed.
- [engine/steps/human-gate.js:30-33](../../../governance/engine/steps/human-gate.js) — `context[step.id].choice` populated before return. Confirmed.
- [engine/steps/human-handoff.js:14-17](../../../governance/engine/steps/human-handoff.js) — `context[step.id].response` populated before return. Confirmed.
- [engine/steps/runs.js:41-50](../../../governance/engine/steps/runs.js) — `context[step.id]` populated with `{command, exit_code, stdout, …}`; excluded from emission by type gate. Confirmed.
- [engine/progress-table.js:19-42](../../../governance/engine/progress-table.js) — single-function shape, no back-references from engine executors — adding the second-line branch cannot cause any engine coupling. Confirmed.
- [cli.js:121-131](../../../governance/cli.js) — flat `switch(cmd)` dispatch; adding a `case` is one line. Confirmed.
- [governance/roadmap/*.js](../../../governance/roadmap/) — no reference to `.aidakit/flows/state/*.json` (grep). Adding `state.summaries` cannot break roadmap-status derivation. Confirmed.

No divergence between the proposal and the live code.
