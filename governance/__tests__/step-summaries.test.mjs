// Table test for per-step summaries (pure Node, no framework).
// Mirrors the idiom of engine.test.mjs / progress-table.test.mjs:
// let pass/fail counters, ok/eq helpers, modules loaded via await import(...),
// a final process.exit(fail?1:0).
//
// Proves: docs/features/flow-step-summaries/design.md — YAML schema (§S1),
// template renderer + cap (§S2), engine emission (§S3), progress-table
// second-line rendering (§S4), `summaries <flow_id>` CLI subcommand (§S5).
//
// §S3's negative-emission family (one named case per excluded type, per
// docs/features/step-summaries-type-gate-tests/design.md): the emission
// gate at engine.js:221-226 is TWO independent conditions (a kind gate and
// a type gate), and the four excluded types are NOT symmetric under a
// type-gate-only mutation:
//   §S3-v            — `runs`   (kind gate passes; type-gate-only mutation observable)
//   §S3-vi-loop-empty — `loop`  (degenerate empty-array termination dispatch)
//   §S3-vi-loop       — `loop`  (iterating: exercises the `__iterate__` dispatches)
//   §S3-vi-parallel   — `parallel` (kind gate passes; type-gate-only mutation observable)
//   §S3-vi-terminal   — `terminal` — excluded by the KIND half of the gate, NOT
//                        the type half: `executeTerminal` returns `kind:"terminal"`,
//                        which the kind gate rejects before the type gate is ever
//                        consulted, so a type-gate-only mutation on `terminal` is a
//                        documented no-op; the discriminating mutation adds BOTH
//                        `step.type === "terminal"` and `outcome.kind === "terminal"`.
// Mutation logs for all four are captured in
// docs/features/step-summaries-type-gate-tests/evidence.md.

import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const { validateFlowShape, loadFlow } = await import("../engine/parser.js");
const { renderSummary, capSummary } = await import("../engine/summary-template.js");
const { startFlow, resumeFlow } = await import("../engine/engine.js");
const { loadState, saveState } = await import("../engine/persistence.js");
const { renderProgressTable } = await import("../engine/progress-table.js");

let pass = 0, fail = 0;
function ok(cond, name) { if (cond) pass++; else { fail++; console.log(`FAIL ${name}`); } }
function eq(a, b, name) { const r = JSON.stringify(a) === JSON.stringify(b); if (!r) console.log(`  ${name}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); ok(r, name); }

// State goes into an isolated temporary project (mirrors engine.test.mjs).
const tmp = mkdtempSync(join(tmpdir(), "aidakit-step-summaries-"));
process.env.AIDAKIT_PROJECT_ROOT = tmp;
const flowsUser = join(tmp, ".aidakit", "flows");
mkdirSync(flowsUser, { recursive: true });

/** Minimal valid flow-shape fixture, with `steps` overridable. */
function minimalFlow(steps) {
  return { flow: "fixture", description: "fixture flow", steps };
}

/** Writes a fixture flow YAML into the isolated project's .aidakit/flows/ dir
 * (mirrors the writeFileSync(join(flowsUser, "<name>.yaml"), ...) idiom used
 * throughout engine.test.mjs) and loads it back via loadFlow. */
function writeFlow(name, yaml) {
  writeFileSync(join(flowsUser, `${name}.yaml`), yaml);
  return loadFlow(name);
}

/** Drives a paused flow one resume step forward, mirroring resumeWith() in
 * engine.test.mjs (reloads state from disk to model a fresh CLI process). */
function resumeWith(state, flow, resumeValue, resumeOutput) {
  return resumeFlow({ state, flow, resumeValue, resumeOutput });
}

/** Fabricates a minimal FlowState for progress-table / CLI fixture tests
 * (mirrors progress-table.test.mjs's makeState). `summaries` is only set on
 * the returned object when explicitly passed — omitting it models an
 * old/pre-this-change state file (crit. 10). */
function makeState({ status = "running", current_step = null, pause = null, history = [], summaries } = {}) {
  const state = {
    flow_id: "fixture-000000-abcdef",
    flow_name: "fixture",
    flow_version: 1,
    started_at: "2026-07-24T00:00:00.000Z",
    started_by: "test",
    current_step,
    status,
    inputs: {},
    context: {},
    step_history: history.map((step_id) => ({ step_id, step_type: "invoke", path: [], started_at: "2026-07-24T00:00:00.000Z", result: "success" })),
    ...(pause ? { pause: { step_id: pause, step_type: "invoke", prompt: "", path: [], paused_at: "2026-07-24T00:00:00.000Z" } } : {}),
  };
  if (summaries !== undefined) state.summaries = summaries;
  return state;
}

// ── §S1 — YAML schema: optional `summary:` field ──────────

// §S1-i: summary: "…" (string) — parser accepts.
{
  const data = minimalFlow([
    { id: "a", type: "invoke", invoke_target: "aidakit:x", summary: "hi {outcome}", on_success: "a" },
  ]);
  const errs = validateFlowShape(data);
  eq(errs, [], "S1-i: string summary — parser accepts (no errors)");
  eq(data.steps[0].summary, "hi {outcome}", "S1-i: flow.steps[0].summary carries the template string");
}

// §S1-ii: summary: 42 (non-string) — parser rejects.
{
  const data = minimalFlow([
    { id: "a", type: "invoke", invoke_target: "aidakit:x", summary: 42, on_success: "a" },
  ]);
  const errs = validateFlowShape(data);
  ok(errs.some((m) => m.includes("'summary' must be a string")), "S1-ii: numeric summary — parser rejects with 'summary' must be a string");
}

// §S1-iii: summary: ["a"] (list) — parser rejects.
{
  const data = minimalFlow([
    { id: "a", type: "invoke", invoke_target: "aidakit:x", summary: ["a"], on_success: "a" },
  ]);
  const errs = validateFlowShape(data);
  ok(errs.some((m) => m.includes("'summary' must be a string")), "S1-iii: list summary — parser rejects with 'summary' must be a string");
}

// §S1-iv: summary: absent — parser accepts; step.summary === undefined.
{
  const data = minimalFlow([
    { id: "a", type: "invoke", invoke_target: "aidakit:x", on_success: "a" },
  ]);
  const errs = validateFlowShape(data);
  eq(errs, [], "S1-iv: absent summary — parser accepts");
  eq(data.steps[0].summary, undefined, "S1-iv: step.summary is undefined when absent");
}

// §S1-v: summary: on a runs/loop/parallel/terminal step — parser ACCEPTS
// (permissive schema; runtime just ignores it).
{
  const runsData = minimalFlow([{ id: "a", type: "runs", command: "true", summary: "ran" }]);
  ok(validateFlowShape(runsData).length === 0, "S1-v: summary on a runs step — parser accepts");

  const loopData = minimalFlow([
    { id: "a", type: "loop", over: "inputs.items", body: [{ id: "b", type: "runs", command: "true" }], summary: "loop" },
  ]);
  ok(validateFlowShape(loopData).length === 0, "S1-v: summary on a loop step — parser accepts");

  const parallelData = minimalFlow([
    { id: "a", type: "parallel", branches: [[{ id: "b", type: "runs", command: "true" }]], summary: "parallel" },
  ]);
  ok(validateFlowShape(parallelData).length === 0, "S1-v: summary on a parallel step — parser accepts");

  const terminalData = minimalFlow([{ id: "a", type: "terminal", outcome: "completed", summary: "term" }]);
  ok(validateFlowShape(terminalData).length === 0, "S1-v: summary on a terminal step — parser accepts");
}

// ── §S2 — the tiny renderer: renderSummary / capSummary ────

// §S2-i: basic substitution.
eq(renderSummary("resolved {change_id}", { change_id: "flow-step-summaries" }), "resolved flow-step-summaries", "S2-i: basic substitution");

// §S2-ii: multi-key.
eq(renderSummary("{outcome} → {change_id}", { outcome: "success", change_id: "x" }), "success → x", "S2-ii: multi-key substitution");

// §S2-iii: unset key marker.
eq(renderSummary("{missing}", {}), "<unset:missing>", "S2-iii: unset key renders <unset:key>");

// §S2-iv: partial unset.
eq(renderSummary("{outcome} {change_id}", { outcome: "success" }), "success <unset:change_id>", "S2-iv: partial unset renders mixed");

// §S2-v: non-substitutable brace content is left literal.
eq(renderSummary("{}", {}), "{}", "S2-v: empty braces left literal");
eq(renderSummary("{123}", {}), "{123}", "S2-v: numeric-only braces left literal");
eq(renderSummary("{a.b}", {}), "{a.b}", "S2-v: dotted key braces left literal");

// §S2-vi: newline collapse in values.
eq(renderSummary("{x}", { x: "line1\nline2\r\nline3" }), "line1 line2 line3", "S2-vi: newline/CR collapsed to single spaces");

// §S2-vii: null/undefined values render as unset marker.
eq(renderSummary("{x}", { x: null }), "<unset:x>", "S2-vii: null value renders <unset:x>");
eq(renderSummary("{x}", { x: undefined }), "<unset:x>", "S2-vii: undefined value renders <unset:x>");

// §S2-viii: capSummary under limit.
eq(capSummary("short"), "short", "S2-viii: capSummary leaves a short string unchanged");

// §S2-ix: capSummary at exactly 200.
{
  const s200 = "x".repeat(200);
  eq(capSummary(s200), s200, "S2-ix: capSummary leaves an exactly-200-char string unchanged");
}

// §S2-x: capSummary over 200.
{
  const s250 = "y".repeat(250);
  const capped = capSummary(s250);
  eq(capped, "y".repeat(199) + "…", "S2-x: capSummary truncates to slice(0,199) + ellipsis");
  eq(capped.length, 200, "S2-x: capped length is exactly 200");
  eq(capped[capped.length - 1], "…", "S2-x: last char is the ellipsis");
}

// §S2-xi: capSummary collapses newlines even under 200.
eq(capSummary("line1\nline2\r\nline3"), "line1 line2 line3", "S2-xi: capSummary collapses newlines under the cap");

// §S2-xii (owner's optional improvement — multi-byte cap behavior): capSummary
// operates on JS string length (UTF-16 code units), not visual/grapheme width.
// A string of 250 multi-byte (but single-code-unit, e.g. Latin-1 supplement)
// characters is capped the same way as any other 250-char string — locks down
// risk #3 (no surrogate-pair splitting for BMP-only content).
{
  const s250accented = "é".repeat(250); // each "é" is ONE UTF-16 code unit (U+00E9)
  const capped = capSummary(s250accented);
  eq(capped.length, 200, "S2-xii: capSummary caps a 250-char multi-byte string to 200 code units");
  eq(capped[capped.length - 1], "…", "S2-xii: multi-byte cap still ends with the ellipsis");
  eq(capped.slice(0, 5), "ééééé", "S2-xii: multi-byte characters before the cut are preserved intact, not mangled");
}

// ── §S3 — engine emission block ─────────────────────────────

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

// §S3-i: emission on `invoke` resolution (success), interpolating a declared output.
{
  const { flow, errors } = writeFlow("s3-invoke", `flow: s3-invoke
description: single invoke step, summary + outputs
steps:
  - id: work
    type: invoke
    invoke_target: aidakit:x
    outputs:
      success:
        - change_id
    summary: "resolved change_id={change_id}"
    on_success: done
  - id: done
    type: terminal
    outcome: completed
`);
  eq(errors, [], "S3-i: s3-invoke parses");
  let res = startFlow({ flow, inputs: {}, startedBy: "test", idOpts: { rand: "s3i001", now: new Date("2026-07-24T00:00:00Z") } });
  res = resumeWith(loadState(res.state.flow_id), flow, "success", { change_id: "abc" });
  const s = res.state.summaries ?? [];
  eq(s.length, 1, "S3-i: exactly one summary entry emitted");
  eq(s[0].step_id, "work", "S3-i: entry step_id == work");
  eq(s[0].visit_n, 1, "S3-i: entry visit_n == 1");
  eq(s[0].outcome, "success", "S3-i: entry outcome == success");
  eq(s[0].text, "resolved change_id=abc", "S3-i: template interpolated the declared output");
  ok(s[0].text.length <= 200, "S3-i: text respects the 200-char envelope");
  ok(ISO_RE.test(s[0].ts), "S3-i: ts is ISO-8601");
}

// §S3-ii: emission on `human_gate` choice.
{
  const { flow, errors } = writeFlow("s3-gate", `flow: s3-gate
description: human_gate summary
steps:
  - id: gate
    type: human_gate
    prompt: "pick one"
    options:
      - apply
      - abort
    summary: "chose {choice}"
    on_result:
      apply: done
      abort: done
  - id: done
    type: terminal
    outcome: completed
`);
  eq(errors, [], "S3-ii: s3-gate parses");
  let res = startFlow({ flow, inputs: {}, startedBy: "test", idOpts: { rand: "s3i002", now: new Date("2026-07-24T00:00:00Z") } });
  res = resumeWith(loadState(res.state.flow_id), flow, "apply");
  const s = res.state.summaries ?? [];
  eq(s.length, 1, "S3-ii: exactly one summary entry emitted");
  eq(s[0].outcome, "apply", "S3-ii: entry outcome == apply (the choice)");
  eq(s[0].text, "chose apply", "S3-ii: template interpolated {choice}");
}

// §S3-iii: emission on `human_handoff` resolution.
{
  const { flow, errors } = writeFlow("s3-handoff", `flow: s3-handoff
description: human_handoff summary
steps:
  - id: handoff
    type: human_handoff
    prompt: "do something and report back"
    summary: "handoff {outcome}"
    on_success: done
  - id: done
    type: terminal
    outcome: completed
`);
  eq(errors, [], "S3-iii: s3-handoff parses");
  let res = startFlow({ flow, inputs: {}, startedBy: "test", idOpts: { rand: "s3i003", now: new Date("2026-07-24T00:00:00Z") } });
  res = resumeWith(loadState(res.state.flow_id), flow, "anything");
  const s = res.state.summaries ?? [];
  eq(s.length, 1, "S3-iii: exactly one summary entry emitted");
  eq(s[0].outcome, "success", "S3-iii: entry outcome == success (per handoff executor)");
  eq(s[0].text, "handoff success", "S3-iii: template interpolated {outcome}");
}

// §S3-iv: fallback default when `summary:` is absent.
{
  const { flow, errors } = writeFlow("s3-fallback", `flow: s3-fallback
description: no summary field — fallback default
steps:
  - id: work
    type: invoke
    invoke_target: aidakit:x
    on_success: done
  - id: done
    type: terminal
    outcome: completed
`);
  eq(errors, [], "S3-iv: s3-fallback parses");
  let res = startFlow({ flow, inputs: {}, startedBy: "test", idOpts: { rand: "s3i004", now: new Date("2026-07-24T00:00:00Z") } });
  res = resumeWith(loadState(res.state.flow_id), flow, "success");
  eq((res.state.summaries ?? [])[0]?.text, "success", "S3-iv: fallback template {outcome} renders the resolved outcome");
}

// §S3-v: no emission on `runs`.
{
  const { flow, errors } = writeFlow("s3-runs", `flow: s3-runs
description: runs step never emits
steps:
  - id: r
    type: runs
    command: "true"
    summary: "ran"
    on_success: done
  - id: done
    type: terminal
    outcome: completed
`);
  eq(errors, [], "S3-v: s3-runs parses");
  const res = startFlow({ flow, inputs: {}, startedBy: "test", idOpts: { rand: "s3i005", now: new Date("2026-07-24T00:00:00Z") } });
  ok(!res.state.summaries || res.state.summaries.length === 0, "S3-v: no summary entry for a runs step, even with a summary: field declared");
}

// §S3-vi-loop-empty: no emission on `loop` (structural container; type gate
// excludes it regardless of outcome kind — the loop's own summary: is
// ignored, while the body's runs step still emits nothing either, since
// it's a runs step). Degenerate empty-array case: still dispatches the loop
// step once (index >= total → kind:"next"), so this mutation-checks the
// termination path but never exercises the `__iterate__` dispatches — see
// §S3-vi-loop below for the iterating sibling.
{
  const { flow, errors } = writeFlow("s3-looptype", `flow: s3-looptype
description: loop step summary is ignored (structural container)
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
        type: runs
        command: "true"
    on_success: done
  - id: done
    type: terminal
    outcome: completed
`);
  eq(errors, [], "S3-vi-loop-empty: s3-looptype parses");
  const res = startFlow({ flow, inputs: { items: [] }, startedBy: "test", idOpts: { rand: "s3i006", now: new Date("2026-07-24T00:00:00Z") } });
  eq(res.state.status, "completed", "S3-vi-loop-empty: empty-array loop completes without pausing");
  ok(!res.state.summaries || !res.state.summaries.some((e) => e.step_id === "lp"), "S3-vi-loop-empty: no summary entry for the loop step id");
}

// §S3-vi-loop: no emission on `loop` — iterating case with a real pausing
// body. Exercises the `__iterate__` dispatches the empty-array case above
// never reaches: two body-step pauses, two resumes, then the loop's own
// termination dispatch. Positive control: the body_step entries DO emit
// (with visit_n incrementing per iteration); negative: zero entries carry
// the loop step's own id.
{
  const { flow, errors } = writeFlow("s3-loopiter", `flow: s3-loopiter
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
`);
  eq(errors, [], "S3-vi-loop: s3-loopiter parses");
  let res = startFlow({ flow, inputs: { items: ["a", "b"] }, startedBy: "test", idOpts: { rand: "s3i013", now: new Date("2026-07-24T00:00:00Z") } });
  res = resumeWith(loadState(res.state.flow_id), flow, "success"); // body_step iteration 0
  res = resumeWith(loadState(res.state.flow_id), flow, "success"); // body_step iteration 1
  eq(res.state.status, "completed", "S3-vi-loop: flow completes after both iterations");
  const s = res.state.summaries ?? [];
  eq(s.map((e) => ({ step_id: e.step_id, visit_n: e.visit_n })), [
    { step_id: "body_step", visit_n: 1 },
    { step_id: "body_step", visit_n: 2 },
  ], "S3-vi-loop: exactly the two body_step entries emit, positive control");
  eq(s.filter((e) => e.step_id === "lp").length, 0, "S3-vi-loop: zero entries carry the loop step's own id");
}

// §S3-vi-parallel: no emission on `parallel` (structural container). Two
// branches, each a pausing `invoke`; positive control on both branch
// entries, negative on the parallel step's own id.
{
  const { flow, errors } = writeFlow("s3-paralleltype", `flow: s3-paralleltype
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
`);
  eq(errors, [], "S3-vi-parallel: s3-paralleltype parses");
  let res = startFlow({ flow, inputs: {}, startedBy: "test", idOpts: { rand: "s3i014", now: new Date("2026-07-24T00:00:00Z") } });
  res = resumeWith(loadState(res.state.flow_id), flow, "success"); // b1
  res = resumeWith(loadState(res.state.flow_id), flow, "success"); // b2
  eq(res.state.status, "completed", "S3-vi-parallel: flow completes after both branches");
  const s = res.state.summaries ?? [];
  eq(s.map((e) => e.step_id), ["b1", "b2"], "S3-vi-parallel: exactly the two branch entries emit, positive control");
  eq(s.filter((e) => e.step_id === "par").length, 0, "S3-vi-parallel: zero entries carry the parallel step's own id");
}

// §S3-vi-terminal: no emission on `terminal` — the ONE excluded type that a
// type-gate-only mutation cannot flip: `executeTerminal` returns
// `kind:"terminal"`, which the KIND half of the gate rejects before the type
// half is ever consulted (see engine.js:221-226). The discriminating
// mutation is type+kind together (evidence.md M4); type-gate-only (M3) is a
// documented no-op. `done` declares a `summary:`, proving the field is
// ignored, not merely absent.
{
  const { flow, errors } = writeFlow("s3-terminaltype", `flow: s3-terminaltype
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
`);
  eq(errors, [], "S3-vi-terminal: s3-terminaltype parses");
  let res = startFlow({ flow, inputs: {}, startedBy: "test", idOpts: { rand: "s3i015", now: new Date("2026-07-24T00:00:00Z") } });
  res = resumeWith(loadState(res.state.flow_id), flow, "success"); // work
  eq(res.state.status, "completed", "S3-vi-terminal: flow completes, proving the terminal genuinely executed");
  const s = res.state.summaries ?? [];
  eq(s.map((e) => e.step_id), ["work"], "S3-vi-terminal: exactly the work entry emits, positive control");
  eq(s.filter((e) => e.step_id === "done").length, 0, "S3-vi-terminal: zero entries carry the terminal step's own id");
}

// §S3-vii: `failure` outcome still emits (crit. 3).
{
  const { flow, errors } = writeFlow("s3-failure", `flow: s3-failure
description: failure outcome still emits
steps:
  - id: work
    type: invoke
    invoke_target: aidakit:x
    expects:
      - success
      - failure
    summary: "{outcome}"
    on_success: done
    on_failure: recover
  - id: recover
    type: terminal
    outcome: completed
  - id: done
    type: terminal
    outcome: completed
`);
  eq(errors, [], "S3-vii: s3-failure parses");
  let res = startFlow({ flow, inputs: {}, startedBy: "test", idOpts: { rand: "s3i007", now: new Date("2026-07-24T00:00:00Z") } });
  res = resumeWith(loadState(res.state.flow_id), flow, "failure");
  eq((res.state.summaries ?? [])[0]?.outcome, "failure", "S3-vii: entry outcome == failure");
  eq((res.state.summaries ?? [])[0]?.text, "failure", "S3-vii: entry text == failure");
  eq(res.state.status, "completed", "S3-vii: flow proceeded to on_failure target (recover), which completes");
}

// §S3-viii: `human_gate` abort choice still emits + routes (crit. 3, 4 sub-case).
{
  const { flow, errors } = writeFlow("s3-gateabort", `flow: s3-gateabort
description: human_gate abort still emits and routes to terminal
steps:
  - id: gate
    type: human_gate
    prompt: "apply or abort?"
    options:
      - apply
      - abort
    summary: "chose {choice}"
    on_result:
      apply: done
      abort: aborted
  - id: done
    type: terminal
    outcome: completed
  - id: aborted
    type: terminal
    outcome: aborted
`);
  eq(errors, [], "S3-viii: s3-gateabort parses");
  let res = startFlow({ flow, inputs: {}, startedBy: "test", idOpts: { rand: "s3i008", now: new Date("2026-07-24T00:00:00Z") } });
  res = resumeWith(loadState(res.state.flow_id), flow, "abort");
  eq((res.state.summaries ?? []).length, 1, "S3-viii: one summary entry emitted before the abort terminal");
  eq((res.state.summaries ?? [])[0]?.outcome, "abort", "S3-viii: entry outcome == abort");
  eq(res.state.status, "aborted", "S3-viii: flow reaches the aborted terminal");
}

// §S3-ix: back-edge append (crit. 5) — monotonic visit_n, insertion order, no overwrite.
{
  const { flow, errors } = writeFlow("s3-backedge", `flow: s3-backedge
description: A → B → back to A (critic-style loop)
steps:
  - id: A
    type: invoke
    invoke_target: aidakit:x
    expects:
      - success
    summary: "visit {outcome}"
    on_success: B
  - id: B
    type: invoke
    invoke_target: aidakit:y
    expects:
      - revise
      - success
    on_result:
      revise: A
      success: done
  - id: done
    type: terminal
    outcome: completed
`);
  eq(errors, [], "S3-ix: s3-backedge parses");
  let res = startFlow({ flow, inputs: {}, startedBy: "test", idOpts: { rand: "s3i009", now: new Date("2026-07-24T00:00:00Z") } });
  res = resumeWith(loadState(res.state.flow_id), flow, "success"); // A#1
  res = resumeWith(loadState(res.state.flow_id), flow, "revise");  // B#1 → back to A
  res = resumeWith(loadState(res.state.flow_id), flow, "success"); // A#2
  res = resumeWith(loadState(res.state.flow_id), flow, "success"); // B#2 → done
  const s = res.state.summaries ?? [];
  eq(s.map((e) => ({ step_id: e.step_id, visit_n: e.visit_n })), [
    { step_id: "A", visit_n: 1 },
    { step_id: "B", visit_n: 1 },
    { step_id: "A", visit_n: 2 },
    { step_id: "B", visit_n: 2 },
  ], "S3-ix: insertion order + monotonic per-step visit_n, no overwrite");
  eq(s[0].text, "visit success", "S3-ix: A#1 unchanged after A#2 is appended");
  const latestA = s.filter((e) => e.step_id === "A").pop();
  eq(latestA.visit_n, 2, "S3-ix: the LATEST A entry is visit_n 2");
}

// §S3-x: 200-char cap on ingest (crit. 7).
{
  const { flow, errors } = writeFlow("s3-cap", `flow: s3-cap
description: 200-char cap on ingest
steps:
  - id: h
    type: human_handoff
    prompt: "report back with a long response"
    summary: "{response}"
    on_success: done
  - id: done
    type: terminal
    outcome: completed
`);
  eq(errors, [], "S3-x: s3-cap parses");
  let res = startFlow({ flow, inputs: {}, startedBy: "test", idOpts: { rand: "s3i010", now: new Date("2026-07-24T00:00:00Z") } });
  const longResponse = "x".repeat(500);
  res = resumeWith(loadState(res.state.flow_id), flow, longResponse);
  const text = (res.state.summaries ?? [])[0]?.text ?? "";
  eq(text.length, 200, "S3-x: capped entry text.length === 200 (crit. 7 envelope)");
  ok(text.endsWith("…"), "S3-x: capped entry text ends with the ellipsis");
}

// §S3-xi: unset key does not throw (crit. 6).
{
  const { flow, errors } = writeFlow("s3-unset", `flow: s3-unset
description: unset key renders a visible marker, never throws
steps:
  - id: work
    type: invoke
    invoke_target: aidakit:x
    summary: "{does_not_exist}"
    on_success: done
  - id: done
    type: terminal
    outcome: completed
`);
  eq(errors, [], "S3-xi: s3-unset parses");
  let res = startFlow({ flow, inputs: {}, startedBy: "test", idOpts: { rand: "s3i011", now: new Date("2026-07-24T00:00:00Z") } });
  let threw = false;
  try {
    res = resumeWith(loadState(res.state.flow_id), flow, "success");
  } catch { threw = true; }
  ok(!threw, "S3-xi: unset-key template never throws");
  eq((res.state.summaries ?? [])[0]?.text, "<unset:does_not_exist>", "S3-xi: unset key renders the visible marker");
}

// §S3-xii: `abort` preserves prior summaries (crit. 4).
{
  const { flow, errors } = writeFlow("s3-abortpreserve", `flow: s3-abortpreserve
description: abort preserves prior summaries
steps:
  - id: s1
    type: invoke
    invoke_target: aidakit:x
    summary: "{outcome}"
    on_success: s2
  - id: s2
    type: invoke
    invoke_target: aidakit:y
    summary: "{outcome}"
    on_success: s3
  - id: s3
    type: invoke
    invoke_target: aidakit:z
    summary: "{outcome}"
    on_success: done
  - id: done
    type: terminal
    outcome: completed
`);
  eq(errors, [], "S3-xii: s3-abortpreserve parses");
  let res = startFlow({ flow, inputs: {}, startedBy: "test", idOpts: { rand: "s3i012", now: new Date("2026-07-24T00:00:00Z") } });
  res = resumeWith(loadState(res.state.flow_id), flow, "success"); // s1 emits, pauses at s2
  res = resumeWith(loadState(res.state.flow_id), flow, "success"); // s2 emits, pauses at s3
  eq((res.state.summaries ?? []).length, 2, "S3-xii: two summaries emitted before the abort");
  // Simulate cmdAbort (governance/cli.js:105-113) — does NOT touch state.summaries.
  const state = loadState(res.state.flow_id);
  state.status = "aborted";
  state.outcome = "aborted";
  state.finished_at = new Date().toISOString();
  saveState(state);
  const reloaded = loadState(res.state.flow_id);
  eq(reloaded.summaries.length, 2, "S3-xii: both prior summaries intact after abort");
  eq(reloaded.summaries.map((e) => e.step_id), ["s1", "s2"], "S3-xii: summaries order preserved after abort");
}

// §S3-xiii: non-breaking on old state without `summaries` (renderProgressTable
// half of crit. 10 — the `summaries` CLI half is covered by §S5-v).
{
  const steps = [{ id: "a" }, { id: "b" }];
  const state = makeState({ status: "paused", current_step: "b", pause: "b", history: ["a"] }); // no `summaries` key
  ok(!("summaries" in state), "S3-xiii: fixture state genuinely has no summaries field");
  let out;
  let threw = false;
  try { out = renderProgressTable(steps, state); } catch { threw = true; }
  ok(!threw, "S3-xiii: renderProgressTable tolerates an absent summaries field");
  ok(!out.includes("↳"), "S3-xiii: no second lines rendered when summaries is absent");
}

// ── §S4 — progress-table second-line rendering ──────────────

// §S4-i: second line under `done` rows with a summary (crit. 8); plain row
// (no second line) when a `done` row has no summary; no second line on `current`.
{
  const steps = [{ id: "A" }, { id: "B" }, { id: "C" }];
  const state = makeState({
    status: "paused",
    current_step: "C",
    pause: "C",
    history: ["A", "B"],
    summaries: [{ step_id: "A", visit_n: 1, outcome: "success", text: "hello", ts: "2026-07-24T00:00:00.000Z" }],
  });
  const out = renderProgressTable(steps, state);
  const lines = out.split("\n");
  const aIdx = lines.findIndex((l) => l.trim().endsWith("A"));
  ok(aIdx >= 0 && lines[aIdx + 1].includes("↳ hello"), "S4-i: row A is followed by a second line with its summary text");
  const bIdx = lines.findIndex((l) => l.trim().endsWith("B"));
  ok(bIdx >= 0 && !lines[bIdx + 1].includes("↳"), "S4-i: row B (done, no summary) has no second line");
  const cIdx = lines.findIndex((l) => l.trim().endsWith("C"));
  ok(cIdx >= 0 && (cIdx + 1 >= lines.length || !lines[cIdx + 1].includes("↳")), "S4-i: current row C has no second line");
}

// §S4-ii: LATEST entry wins when multiple visits.
{
  const steps = [{ id: "A" }];
  const state = makeState({
    status: "completed",
    current_step: "A",
    history: ["A", "A"],
    summaries: [
      { step_id: "A", visit_n: 1, outcome: "revise", text: "first", ts: "2026-07-24T00:00:00.000Z" },
      { step_id: "A", visit_n: 2, outcome: "success", text: "second", ts: "2026-07-24T00:01:00.000Z" },
    ],
  });
  const out = renderProgressTable(steps, state);
  const lines = out.split("\n").filter((l) => l.includes("↳"));
  eq(lines.length, 1, "S4-ii: exactly ONE second line under A despite two visits");
  ok(lines[0].includes("second"), "S4-ii: the second line shows the LATEST (visit_n 2) text");
  ok(!lines[0].includes("first"), "S4-ii: the stale (visit_n 1) text does not appear");
}

// §S4-iii: no second line when `summaries` absent (crit. 10).
{
  const steps = [{ id: "A" }, { id: "B" }];
  const state = makeState({ status: "paused", current_step: "B", pause: "B", history: ["A"] }); // no summaries key
  const out = renderProgressTable(steps, state);
  ok(!out.includes("↳"), "S4-iii: no ↳ characters anywhere when state.summaries is absent");
}

// §S4-iv: row content is byte-identical to the sibling (no summaries case).
{
  const steps = [{ id: "A" }, { id: "B" }, { id: "C" }];
  const stateNoSummaries = makeState({ status: "paused", current_step: "C", pause: "C", history: ["A", "B"] });
  const stateWithEmptySummaries = makeState({ status: "paused", current_step: "C", pause: "C", history: ["A", "B"], summaries: [] });
  const out1 = renderProgressTable(steps, stateNoSummaries);
  const out2 = renderProgressTable(steps, stateWithEmptySummaries);
  eq(out1, out2, "S4-iv: absent vs. empty-array summaries render byte-identically");
  ok(/^ {3}done {5}A$/m.test(out1), "S4-iv: row content is still exactly gutter+marker+id (sibling invariant)");
}

// §S4-v: `current` row never carries a second line, even if a summary exists
// for that step_id (a step that is both `done` in step_history AND `current`
// via a back-edge re-entry — precedence rule: marker wins as `current`).
{
  const steps = [{ id: "A" }, { id: "B" }];
  const state = makeState({
    status: "paused",
    current_step: "A",
    pause: "A",
    history: ["A", "B", "A"],
    summaries: [{ step_id: "A", visit_n: 1, outcome: "revise", text: "should not render", ts: "2026-07-24T00:00:00.000Z" }],
  });
  const out = renderProgressTable(steps, state);
  ok(!out.includes("↳"), "S4-v: current row (re-entered A) carries no second line, even though a summary exists for it");
}

// ── §S5 — `summaries <flow_id>` CLI subcommand ───────────────

const here = new URL(".", import.meta.url).pathname;
const cliPath = join(here, "..", "cli.js");

function runCli(args) {
  return execFileSync(process.execPath, [cliPath, ...args], {
    env: { ...process.env, AIDAKIT_PROJECT_ROOT: tmp },
    encoding: "utf8",
  });
}
function runCliExpectFail(args) {
  try {
    execFileSync(process.execPath, [cliPath, ...args], {
      env: { ...process.env, AIDAKIT_PROJECT_ROOT: tmp },
      encoding: "utf8",
    });
    return { code: 0, stderr: "" };
  } catch (err) {
    return { code: err.status, stderr: err.stderr ? err.stderr.toString() : "" };
  }
}

/** Fabricates a state file directly on disk (bypassing the engine) so the CLI
 * subcommand can be exercised in isolation, mirroring the makeState fixture
 * but with a real flow_id and persisted via saveState. */
function fabricateState(flowId, { summaries } = {}) {
  const state = {
    flow_id: flowId,
    flow_name: "fixture",
    flow_version: 1,
    started_at: "2026-07-24T00:00:00.000Z",
    started_by: "test",
    current_step: null,
    status: "completed",
    outcome: "completed",
    inputs: {},
    context: {},
    step_history: [],
  };
  if (summaries !== undefined) state.summaries = summaries;
  saveState(state);
  return state;
}

// §S5-i: subprocess smoke — full log printed, insertion order, correct format.
{
  const flowId = "s5-smoke-000001-aaaaaa";
  fabricateState(flowId, {
    summaries: [
      { step_id: "select", visit_n: 1, outcome: "success", text: "resolved change_id=x", ts: "2026-07-24T00:00:01.000Z" },
      { step_id: "classify", visit_n: 1, outcome: "success", text: "domain=product", ts: "2026-07-24T00:00:02.000Z" },
      { step_id: "brainstorm", visit_n: 1, outcome: "success", text: "done", ts: "2026-07-24T00:00:03.000Z" },
    ],
  });
  const stdout = runCli(["summaries", flowId]);
  const lines = stdout.trim().split("\n");
  eq(lines, [
    "[select#1 success] resolved change_id=x",
    "[classify#1 success] domain=product",
    "[brainstorm#1 success] done",
  ], "S5-i: full log printed, insertion order, [<step_id>#<visit_n> <outcome>] <text> format");
}

// §S5-ii: back-edge history in order.
{
  const flowId = "s5-backedge-000001-bbbbbb";
  fabricateState(flowId, {
    summaries: [
      { step_id: "A", visit_n: 1, outcome: "revise", text: "visit revise", ts: "2026-07-24T00:00:01.000Z" },
      { step_id: "B", visit_n: 1, outcome: "success", text: "success", ts: "2026-07-24T00:00:02.000Z" },
      { step_id: "A", visit_n: 2, outcome: "success", text: "visit success", ts: "2026-07-24T00:00:03.000Z" },
    ],
  });
  const stdout = runCli(["summaries", flowId]);
  const lines = stdout.trim().split("\n");
  eq(lines, [
    "[A#1 revise] visit revise",
    "[B#1 success] success",
    "[A#2 success] visit success",
  ], "S5-ii: back-edge history prints in exactly chronological order");
}

// §S5-iii: missing flow_id → usage error, exit 2.
{
  const { code, stderr } = runCliExpectFail(["summaries"]);
  eq(code, 2, "S5-iii: missing flow_id — exit 2");
  ok(stderr.includes("usage: summaries <flow_id>"), "S5-iii: stderr contains the usage message");
}

// §S5-iv: state not found → error, exit 2.
{
  const { code, stderr } = runCliExpectFail(["summaries", "nonexistent-flow-000000-ffffff"]);
  eq(code, 2, "S5-iv: nonexistent flow_id — exit 2");
  ok(stderr.includes("flow not found"), "S5-iv: stderr contains 'flow not found'");
}

// §S5-v: no summaries recorded — old state without a `summaries` field (crit. 10, CLI half).
{
  const flowId = "s5-old-000001-cccccc";
  fabricateState(flowId); // no summaries key at all
  const stdout = runCli(["summaries", flowId]);
  ok(stdout.includes(`no summaries recorded for ${flowId}`), "S5-v: old state without summaries — graceful message");
}

// §S5-vi (crit. 12 — identical output whether run directly or dispatched via
// Bash): the CLI has one code path; a pipe vs. a captured exec output are
// byte-identical (no TTY-conditional branch anywhere in cmdSummaries).
{
  const flowId = "s5-pipe-000001-dddddd";
  fabricateState(flowId, {
    summaries: [{ step_id: "x", visit_n: 1, outcome: "success", text: "hi", ts: "2026-07-24T00:00:00.000Z" }],
  });
  const out1 = runCli(["summaries", flowId]);
  const out2 = execFileSync("bash", ["-lc", `node "${cliPath}" summaries ${flowId}`], {
    env: { ...process.env, AIDAKIT_PROJECT_ROOT: tmp },
    encoding: "utf8",
  });
  eq(out1, out2, "S5-vi: identical output run directly vs. dispatched via bash -lc");
}

console.log(`\n${pass} passed, ${fail} failed`);
rmSync(tmp, { recursive: true, force: true });
process.exit(fail ? 1 : 0);
