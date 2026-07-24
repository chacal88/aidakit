// Table test for the flow progress-table renderer (pure Node, no framework).
// Mirrors the idiom of engine.test.mjs: let pass/fail counters, ok/eq helpers,
// modules loaded via await import(...), a final process.exit(fail?1:0).
//
// Proves: the derivation rules in docs/features/flow-run-progress-table/design.md
// (done/current/pending precedence, the isTerminal gate on `currentId`, the
// id+marker-only row content), generalization across the real `full`/`fast`
// flows (no hardcoded step id), and the CLI wiring smoke at start/resume/status.

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const { renderProgressTable } = await import("../engine/progress-table.js");
const { loadFlow } = await import("../engine/parser.js");
const { startFlow, resumeFlow } = await import("../engine/engine.js");
const { saveState } = await import("../engine/persistence.js");

let pass = 0, fail = 0;
function ok(cond, name) { if (cond) pass++; else { fail++; console.log(`FAIL ${name}`); } }
function eq(a, b, name) { const r = JSON.stringify(a) === JSON.stringify(b); if (!r) console.log(`  ${name}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); ok(r, name); }

// ── Fixture builders ─────────────────────────────────────

/** Minimal flat step list — only `id` (and an optional `description`) matter to
 * the renderer; the type is irrelevant to a read-only projection over ids. */
function makeSteps(defs) {
  return defs.map((d) => (typeof d === "string" ? { id: d } : d));
}

/** Fabricates a FlowState for the derivation tests. Defaults model a fresh,
 * never-paused, never-terminal state so each test only overrides what it needs.
 * @param {{status?:string, current_step?:string|null, pause?:{step_id:string}|null, history?:string[]}} [opts]
 */
function makeState({ status = "running", current_step = null, pause = null, history = [] } = {}) {
  return {
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
}

/** Extracts the trailing step-id token from every row (skips the header line).
 * Row shape is bounded (`gutter + marker.padEnd(7) + "  " + id`), and ids are
 * single whitespace-free tokens, so the last whitespace-split token IS the id
 * regardless of the marker/gutter width — no row-format assumption baked in. */
function rowIds(output) {
  return output.split("\n").filter((l) => l.trim() && !l.startsWith("Flow:")).map((l) => l.trim().split(/\s+/).pop());
}

/** Extracts { id, marker } pairs per row (marker = the first whitespace token
 * on the row after the optional " > " gutter is stripped). */
function rowMarkers(output) {
  return output.split("\n").filter((l) => l.trim() && !l.startsWith("Flow:")).map((l) => {
    const stripped = l.startsWith(" > ") ? l.slice(3) : l.trimStart();
    const [marker, ...rest] = stripped.trim().split(/\s+/);
    return { marker, id: rest.pop() };
  });
}

function countCurrent(output) {
  return rowMarkers(output).filter((r) => r.marker === "current").length;
}

// ── 2a. RED — derivation tests ──────────────────────────

// Base derivation (crit. 1, 3): paused step is current, ids before it (in
// step_history) are done, everything after is pending; exactly one `current`.
{
  const steps = makeSteps(["s1", "s2", "s3", "s4", "s5"]);
  const state = makeState({ status: "paused", current_step: "s3", pause: "s3", history: ["s1", "s2"] });
  const out = renderProgressTable(steps, state);
  const rows = rowMarkers(out);
  eq(rows.map((r) => r.marker), ["done", "done", "current", "pending", "pending"], "base derivation: done/done/current/pending/pending");
  eq(countCurrent(out), 1, "base derivation: exactly one current row");
}

// `current` beats `done` on back-edge re-entry (crit. 3): a step that is BOTH
// current AND already in step_history renders `current`, not a stale `done`.
{
  const steps = makeSteps(["s1", "s2", "s3"]);
  const state = makeState({ status: "paused", current_step: "s1", pause: "s1", history: ["s1", "s2", "s1"] });
  const out = renderProgressTable(steps, state);
  const rows = rowMarkers(out);
  eq(rows.find((r) => r.id === "s1").marker, "current", "back-edge: re-entered step renders current, not stale done");
  eq(countCurrent(out), 1, "back-edge: still exactly one current row");
}

// Terminal → zero `current` (crit. 1): current_step still points at the
// terminal step (real engine behavior, engine.js:161-168) — zero current rows,
// the terminal step itself shows `done`. Repeated for completed/aborted/failed.
for (const status of ["completed", "aborted", "failed"]) {
  const steps = makeSteps(["s1", "s2", "term"]);
  const state = makeState({ status, current_step: "term", pause: null, history: ["s1", "s2", "term"] });
  const out = renderProgressTable(steps, state);
  eq(countCurrent(out), 0, `terminal (${status}): zero current rows`);
  eq(rowMarkers(out).find((r) => r.id === "term").marker, "done", `terminal (${status}): the terminal step itself shows done`);
}

// `runs` gate steps appear (crit. 4): never-pausing steps sourced from
// step_history render as `done` rows (present in the table).
{
  const steps = makeSteps(["implement", "check_implement_bench", "review_bench", "check_docs", "pr"]);
  const state = makeState({ status: "paused", current_step: "pr", pause: "pr", history: ["implement", "check_implement_bench", "review_bench", "check_docs"] });
  const out = renderProgressTable(steps, state);
  const rows = rowMarkers(out);
  eq(rows.find((r) => r.id === "check_implement_bench").marker, "done", "runs gate check_implement_bench appears as done");
  eq(rows.find((r) => r.id === "check_docs").marker, "done", "runs gate check_docs appears as done");
}

// Row content is id + marker only (crit. 6): never the step's description.
{
  const steps = makeSteps([{ id: "s1", description: "THIS-NARRATIVE-MUST-NOT-APPEAR-IN-THE-TABLE" }, { id: "s2" }]);
  const state = makeState({ status: "paused", current_step: "s1", pause: "s1", history: [] });
  const out = renderProgressTable(steps, state);
  ok(!out.includes("THIS-NARRATIVE-MUST-NOT-APPEAR-IN-THE-TABLE"), "row content: description text is never rendered");
  ok(/\b(done|current|pending)\b/.test(out), "row content: a marker word is present");
  ok(out.includes("s1") && out.includes("s2"), "row content: both step ids are present");
}

// No-null-crash: a fresh state (current_step: null, empty history, no pause,
// status: running) → every row pending, no throw.
{
  const steps = makeSteps(["s1", "s2", "s3"]);
  const state = makeState({ status: "running", current_step: null, pause: null, history: [] });
  let out;
  let threw = false;
  try { out = renderProgressTable(steps, state); } catch { threw = true; }
  ok(!threw, "no-null-crash: renders without throwing on a fresh state");
  eq(rowMarkers(out).map((r) => r.marker), ["pending", "pending", "pending"], "no-null-crash: every row pending");
}

// ── 2c. Generalization across real flows (crit. 2, 7) ──────

// Loads `full` AND `fast` via loadFlow (real YAMLs), fabricates a paused state
// for each, and asserts the rendered rows == flow.steps ids in DECLARED order —
// nothing hardcoded in the assertion (the expected list is derived from the
// flow itself), proving the helper is name-agnostic.
function testFlowGeneralization(flowName) {
  const { flow, errors } = loadFlow(flowName);
  eq(errors, [], `${flowName}: parses without error (generalization fixture)`);
  const expectedIds = flow.steps.map((s) => s.id);
  const midIndex = Math.floor(expectedIds.length / 2);
  const currentId = expectedIds[midIndex];
  const history = expectedIds.slice(0, midIndex);
  const state = makeState({ status: "paused", current_step: currentId, pause: currentId, history });
  const out = renderProgressTable(flow.steps, state);
  eq(rowIds(out), expectedIds, `${flowName}: rendered rows == flow.steps ids, in declared order`);
  eq(countCurrent(out), 1, `${flowName}: exactly one current row`);
}
testFlowGeneralization("full");
testFlowGeneralization("fast");

// ── 3a. RED — CLI wiring smoke (subprocess, isolated AIDAKIT_PROJECT_ROOT) ──
// Drives `fast` to a paused state via the engine API + saveState, then runs
// `node governance/cli.js status|start|resume` as a real subprocess and
// asserts the table block (header + a `current` row) is in stdout.

const tmp = mkdtempSync(join(tmpdir(), "aidakit-progress-table-"));
process.env.AIDAKIT_PROJECT_ROOT = tmp;
const here = new URL(".", import.meta.url).pathname;
const cliPath = join(here, "..", "cli.js");

function runCli(args) {
  return execFileSync(process.execPath, [cliPath, ...args], {
    env: { ...process.env, AIDAKIT_PROJECT_ROOT: tmp },
    encoding: "utf8",
  });
}

function assertTableBlock(stdout, label) {
  ok(/^Flow: /m.test(stdout), `${label}: table header is present`);
  ok(/ > current  \S+/.test(stdout), `${label}: a current row is present`);
}

// `start` — real subprocess, real flow.
{
  const stdout = runCli(["start", "fast", "request=progress-table-smoke-start"]);
  assertTableBlock(stdout, "start");
}

// `resume` — start once (subprocess) to get a real flow_id, then resume (subprocess).
{
  const startOut = runCli(["start", "fast", "request=progress-table-smoke-resume"]);
  const m = /\[([\w-]+)\]/.exec(startOut);
  ok(!!m, "resume: flow_id extracted from the start output");
  const flowId = m && m[1];
  const resumeOut = runCli(["resume", flowId, "success", "change_id=progress-table-smoke-resume"]);
  assertTableBlock(resumeOut, "resume");
}

// `status` — build a paused state directly via the engine API + saveState,
// then read it back through the CLI subprocess.
{
  const { flow } = loadFlow("fast");
  const res = startFlow({ flow, inputs: { request: "progress-table-smoke-status" }, startedBy: "test", idOpts: { rand: "ptstat1", now: new Date("2026-07-24T00:00:00Z") } });
  saveState(res.state);
  const stdout = runCli(["status", res.state.flow_id]);
  assertTableBlock(stdout, "status");
}

console.log(`\n${pass} passed, ${fail} failed`);
rmSync(tmp, { recursive: true, force: true });
process.exit(fail ? 1 : 0);
