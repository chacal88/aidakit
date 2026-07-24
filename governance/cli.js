#!/usr/bin/env node
// CLI for the aidakit flow engine.
//
// Usage (pure Node, no tsx):
//   node governance/cli.js start <flow> [key=value ...]     starts a flow
//   node governance/cli.js resume <flow_id> <outcome> [key=value ...]
//                                                           resumes a paused flow; the
//                                                           key=value tokens carry the
//                                                           step's declared structured
//                                                           outputs (e.g. change_id=...)
//   node governance/cli.js status <flow_id>                 shows the current state
//   node governance/cli.js abort <flow_id> [reason]         aborts a flow
//   node governance/cli.js list                             lists available flows
//
// Inversion of control: when the status returns "paused" with pause.step_type
// "agent", the CLI prints the dispatch and the Claude operator runs the skill and calls
// `resume` with the outcome. When it's "human_gate"/"human_handoff", the CLI prints
// the prompt for the human.

import { startFlow, resumeFlow } from "./engine/engine.js";
import { loadFlow, listFlowNames } from "./engine/parser.js";
import { loadState, saveState } from "./engine/persistence.js";
import { parseResumeOutput, parseTelemetryKwargs } from "./engine/resume-output.js";
import { renderProgressTable } from "./engine/progress-table.js";

function fail(msg) {
  process.stderr.write(`aidakit — error: ${msg}\n`);
  process.exit(2);
}

function printPauseOrEnd(res, flow) {
  const s = res.state;
  process.stdout.write(renderProgressTable(flow.steps, s));
  if (s.status === "paused" && s.pause) {
    const p = s.pause;
    process.stdout.write(`\n[${s.flow_id}] PAUSED at "${p.step_id}" (${p.step_type})\n\n`);
    process.stdout.write(p.prompt + "\n");
    if (p.options) process.stdout.write(`\nOptions: ${p.options.join(" | ")}\n`);
    process.stdout.write(`\nTo continue: node governance/cli.js resume ${s.flow_id} <outcome>${p.outputs ? " [key=value ...]" : ""}\n`);
  } else {
    process.stdout.write(`\n[${s.flow_id}] ${String(s.status).toUpperCase()}${s.outcome ? ` (${s.outcome})` : ""}\n`);
    const last = s.step_history[s.step_history.length - 1];
    if (last && last.output && last.output.message) process.stdout.write(`${last.output.message}\n`);
  }
}

function cmdStart(argv) {
  const flowName = argv[0];
  if (!flowName) fail("usage: start <flow> [key=value ...]");
  const { flow, errors } = loadFlow(flowName);
  if (errors.length) fail(errors.map((e) => `${e.path}: ${e.message}`).join("\n"));
  const inputs = {};
  for (const arg of argv.slice(1)) {
    const eq = arg.indexOf("=");
    if (eq < 0) fail(`invalid input "" (expected key=value)`);
    inputs[arg.slice(0, eq)] = arg.slice(eq + 1);
  }
  let res;
  try {
    res = startFlow({ flow, inputs, startedBy: process.env.USER || "aidakit" });
  } catch (err) {
    fail(err.message);
  }
  printPauseOrEnd(res, flow);
}

function cmdResume(argv) {
  const flowId = argv[0];
  const value = argv[1];
  if (!flowId || value === undefined || value === "") fail("usage: resume <flow_id> <outcome> [key=value ...] [--tokens-cache-read=N] [--tokens-cache-creation=N] [--tokens-output=N] [--duration-ms=N] [--pack-rebuilt=true|false]");
  // key=value tokens after the outcome are structured outputs (resume-output.js);
  // --<kwarg>=<value> tokens are the OPTIONAL telemetry kwargs (ADR-012) — additive,
  // backward compatible: absent kwargs = no telemetry, no error. Both kinds are
  // validated and split apart BEFORE any state is touched, same fail-closed contract.
  let resumeOutput;
  let telemetry;
  try {
    const tokens = argv.slice(2);
    const split = parseTelemetryKwargs(tokens);
    telemetry = split.telemetry;
    resumeOutput = split.rest.length > 0 ? parseResumeOutput(split.rest) : undefined;
  } catch (err) {
    fail(err.message);
  }
  const state = loadState(flowId);
  if (!state) fail(`flow not found: ${flowId}`);
  const { flow, errors } = loadFlow(state.flow_name);
  if (errors.length) fail(errors.map((e) => e.message).join("\n"));
  let res;
  try {
    res = resumeFlow({ state, flow, resumeValue: value, resumeOutput, telemetry });
  } catch (err) {
    fail(err.message);
  }
  printPauseOrEnd(res, flow);
}

function cmdStatus(argv) {
  const state = loadState(argv[0]);
  if (!state) fail(`flow not found: ${argv[0]}`);
  process.stdout.write(`flow: ${state.flow_name} (${state.flow_id})\n`);
  process.stdout.write(`status: ${state.status}${state.outcome ? ` / ${state.outcome}` : ""}\n`);
  process.stdout.write(`current step: ${state.current_step ?? "—"}\n`);
  process.stdout.write(`steps executed: ${state.step_history.length}\n`);
  if (state.pause) process.stdout.write(`paused at: ${state.pause.step_id} (${state.pause.step_type})\n`);
  // Best-effort: the table is additive, never a new failure mode for `status`.
  const { flow, errors } = loadFlow(state.flow_name);
  if (!errors.length) process.stdout.write(`\n${renderProgressTable(flow.steps, state)}`);
}

function cmdAbort(argv) {
  const state = loadState(argv[0]);
  if (!state) fail(`flow not found: ${argv[0]}`);
  state.status = "aborted";
  state.outcome = "aborted";
  state.finished_at = new Date().toISOString();
  saveState(state);
  process.stdout.write(`[${state.flow_id}] aborted.\n`);
}

function cmdList() {
  const names = listFlowNames();
  if (!names.length) process.stdout.write("No flow found.\n");
  for (const n of names) process.stdout.write(`  ${n}\n`);
}

const [cmd, ...argv] = process.argv.slice(2);
switch (cmd) {
  case "start": cmdStart(argv); break;
  case "resume": cmdResume(argv); break;
  case "status": cmdStatus(argv); break;
  case "abort": cmdAbort(argv); break;
  case "list": cmdList(); break;
  default:
    process.stdout.write("Usage: node governance/cli.js <start|resume|status|abort|list> ...\n");
    process.exit(cmd ? 2 : 0);
}
