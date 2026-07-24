// aidakit flow engine.
// Ported from recruit/.governance/orchestrator/engine.ts.
//
// Drives a parsed flow forward until it completes, pauses or fails.
// Single-threaded; loop/parallel recursion is unrolled into an explicit
// step queue so state can survive crashes via persistence.

import { findStep } from "./parser.js";
import { logEvent, newFlowId, saveState } from "./persistence.js";
import { executeInvoke } from "./steps/invoke.js";
import { executeRuns } from "./steps/runs.js";
import { executeHumanHandoff } from "./steps/human-handoff.js";
import { executeHumanGate } from "./steps/human-gate.js";
import { executeTerminal } from "./steps/terminal.js";
import { executeLoop, loadLoopFrame, saveLoopFrame } from "./steps/loop.js";
import { executeParallel, loadParallelFrame, saveParallelFrame } from "./steps/parallel.js";

/**
 * @param {{flow:import('./types.js').Flow, inputs:Object.<string,unknown>, startedBy:string, idOpts?:object}} opts
 * @returns {{status:string, state:import('./types.js').FlowState}}
 */
export function startFlow(opts) {
  const { flow, inputs, startedBy } = opts;

  // Apply input defaults.
  /** @type {Object.<string,unknown>} */
  const resolvedInputs = {};
  for (const def of flow.inputs ?? []) {
    if (def.name in inputs) resolvedInputs[def.name] = inputs[def.name];
    else if ("default" in def) resolvedInputs[def.name] = def.default;
    else if (def.required) throw new Error(`flow "${flow.flow}" requires input "${def.name}"`);
  }
  // Validate enums.
  for (const def of flow.inputs ?? []) {
    if (def.type === "enum" && def.name in resolvedInputs) {
      const v = resolvedInputs[def.name];
      if (!def.values || !def.values.includes(v)) {
        throw new Error(`input "${def.name}"=${JSON.stringify(v)} is outside the allowed values: ${(def.values ?? []).join(", ")}`);
      }
    }
  }

  const flowId = newFlowId(flow.flow, opts.idOpts);
  /** @type {import('./types.js').FlowState} */
  const state = {
    flow_id: flowId,
    flow_name: flow.flow,
    flow_version: flow.version ?? 1,
    started_at: new Date().toISOString(),
    started_by: startedBy,
    current_step: null,
    status: "running",
    inputs: resolvedInputs,
    context: {},
    step_history: [],
  };
  saveState(state);
  logEvent(flowId, { event: "flow_start", flow: flow.flow, inputs: resolvedInputs });

  const firstStep = flow.steps[0];
  if (!firstStep) throw new Error(`flow "${flow.flow}" has no steps`);
  const entryId = flow.entry ?? firstStep.id;
  const queue = [{ stepId: entryId, path: [], loopVars: {} }];
  return drive(state, flow, queue);
}

/**
 * @param {{state:import('./types.js').FlowState, flow:import('./types.js').Flow, resumeValue:string, resumeOutput?:Object.<string,string>}} opts
 * @returns {{status:string, state:import('./types.js').FlowState}}
 */
export function resumeFlow(opts) {
  const { state, flow, resumeValue, resumeOutput } = opts;
  if (state.status !== "paused") throw new Error(`cannot resume flow ${state.flow_id}: status is ${state.status}`);
  if (!state.pause) throw new Error(`cannot resume flow ${state.flow_id}: no pause record`);
  const frame = {
    stepId: state.pause.step_id,
    path: state.pause.path,
    loopVars: rebuildLoopVars(state, flow, state.pause.path),
  };
  state.status = "running";
  state.pause = undefined;
  saveState(state);
  logEvent(state.flow_id, { event: "flow_resume", step: frame.stepId, value: resumeValue, output: resumeOutput });
  return drive(state, flow, [frame], resumeValue, resumeOutput);
}

/** Rebuilds loopVars by walking the path and reading the saved loop frames.
 * The FULL path is walked — including the last segment: a paused body step's
 * path ENDS in "iter[N]" (the body step id is not appended to the path; see the
 * __iterate__ frame in drive()), so stopping at length-1 would skip the
 * innermost loop and lose its variable on resume. Non-iter segments don't
 * match the regex and are ignored, so including the last one is always safe. */
function rebuildLoopVars(state, _flow, path) {
  /** @type {Object.<string,unknown>} */
  const vars = {};
  for (let i = 0; i < path.length; i++) {
    const seg = path[i];
    if (!seg) continue;
    const m = /^iter\[(\d+)\]$/.exec(seg);
    if (!m || !m[1]) continue;
    const loopId = path[i - 1];
    if (!loopId) continue;
    const frame = loadLoopFrame(state, loopId);
    if (!frame) continue;
    vars[frame.as] = frame.items[Number(m[1])];
  }
  return vars;
}

function drive(state, flow, queue, initialResumeValue, initialResumeOutput) {
  let resumeValue = initialResumeValue;
  let resumeOutput = initialResumeOutput;

  while (queue.length > 0) {
    const frame = queue.shift();
    const step = findStep(flow.steps, frame.stepId);
    if (!step) {
      state.status = "failed";
      state.outcome = "failed";
      state.finished_at = new Date().toISOString();
      saveState(state);
      logEvent(state.flow_id, { event: "step_not_found", step_id: frame.stepId });
      return { status: state.status, state };
    }

    state.current_step = step.id;
    const ctx = { state, flow, resumeValue, resumeOutput, loopVars: frame.loopVars, path: frame.path };

    const startedAt = new Date().toISOString();
    logEvent(state.flow_id, { event: "step_start", step_id: step.id, type: step.type, path: frame.path });

    let outcome;
    try {
      outcome = dispatch(step, ctx);
    } catch (err) {
      outcome = { kind: "fail", error: err && err.message ? err.message : String(err) };
    }
    // Single-shot: only consume resumeValue/resumeOutput on the first step we dequeue.
    resumeValue = undefined;
    resumeOutput = undefined;

    const history = {
      step_id: step.id,
      step_type: step.type,
      path: frame.path,
      started_at: startedAt,
      ended_at: new Date().toISOString(),
      result: outcomeKey(outcome),
      output: "output" in outcome ? outcome.output : undefined,
      error: outcome.kind === "fail" ? outcome.error : undefined,
    };
    state.step_history.push(history);
    logEvent(state.flow_id, { event: "step_end", step_id: step.id, result: history.result });

    if (outcome.kind === "pause") {
      state.status = "paused";
      state.pause = outcome.pause;
      saveState(state);
      return { status: state.status, state };
    }
    if (outcome.kind === "terminal") {
      state.status = outcome.outcome === "aborted" ? "aborted" : "completed";
      state.outcome = outcome.outcome;
      state.finished_at = new Date().toISOString();
      saveState(state);
      logEvent(state.flow_id, { event: "flow_end", outcome: state.outcome });
      return { status: state.status, state };
    }
    if (outcome.kind === "fail") {
      const target = step.on_failure;
      if (target) {
        queue.unshift({ stepId: target, path: frame.path, loopVars: frame.loopVars });
        continue;
      }
      state.status = "failed";
      state.outcome = "failed";
      state.finished_at = new Date().toISOString();
      saveState(state);
      logEvent(state.flow_id, { event: "flow_end", outcome: "failed", error: outcome.error });
      return { status: state.status, state };
    }

    // outcome.kind === "next"
    if (outcome.outcome === "__iterate__") {
      const loopFrame = loadLoopFrame(state, step.id);
      const bodySteps = step.body;
      const iterPath = [...frame.path, step.id, `iter[${loopFrame.index}]`];
      const iterVars = { ...frame.loopVars, [loopFrame.as]: loopFrame.items[loopFrame.index] };
      const advanceMarker = `__advance__:${step.id}`;
      const firstBody = bodySteps[0];
      if (!firstBody) {
        const lf = loadLoopFrame(state, step.id);
        if (lf) { lf.index += 1; saveLoopFrame(state, lf); }
        queue.unshift({ stepId: step.id, path: frame.path, loopVars: frame.loopVars });
        continue;
      }
      queue.unshift({ stepId: firstBody.id, path: iterPath, loopVars: iterVars });
      pushFallthrough(state, iterPath.join("/"), advanceMarker);
      continue;
    }

    if (outcome.outcome === "__branch__") {
      const pf = loadParallelFrame(state, step.id);
      const branchSteps = step.branches[pf.branch_index];
      const branchPath = [...frame.path, step.id, `branch[${pf.branch_index}]`];
      const advanceMarker = `__advance_parallel__:${step.id}`;
      const firstBranchStep = branchSteps && branchSteps[0];
      if (!firstBranchStep) {
        if (pf) { pf.branch_results[pf.branch_index] = "success"; pf.branch_index += 1; saveParallelFrame(state, pf); }
        queue.unshift({ stepId: step.id, path: frame.path, loopVars: frame.loopVars });
        continue;
      }
      queue.unshift({ stepId: firstBranchStep.id, path: branchPath, loopVars: frame.loopVars });
      pushFallthrough(state, branchPath.join("/"), advanceMarker);
      continue;
    }

    const target =
      (step.on_result && step.on_result[outcome.outcome]) ??
      (outcome.outcome === "success" ? step.on_success : undefined) ??
      (outcome.outcome === "failure" ? step.on_failure : undefined);

    if (target) {
      const t = expandAdvanceTarget(state, flow, target, frame, queue);
      if (t.handled) continue;
      queue.unshift({ stepId: target, path: frame.path, loopVars: frame.loopVars });
      continue;
    }

    // No explicit target. Try fallthrough (loop/parallel advance).
    const ft = popFallthrough(state, frame.path.join("/"));
    if (ft) {
      handleFallthrough(state, flow, ft, queue, frame);
      continue;
    }

    // No target and no fallthrough — implicit completion.
    state.status = "completed";
    state.outcome = "completed";
    state.finished_at = new Date().toISOString();
    saveState(state);
    logEvent(state.flow_id, { event: "flow_end", outcome: "completed", reason: "implicit" });
    return { status: state.status, state };
  }

  state.status = "completed";
  state.outcome = "completed";
  state.finished_at = new Date().toISOString();
  saveState(state);
  return { status: state.status, state };
}

function dispatch(step, ctx) {
  switch (step.type) {
    case "invoke": return executeInvoke(step, ctx);
    case "runs": return executeRuns(step, ctx);
    case "human_handoff": return executeHumanHandoff(step, ctx);
    case "human_gate": return executeHumanGate(step, ctx);
    case "loop": return executeLoop(step, ctx);
    case "parallel": return executeParallel(step, ctx);
    case "terminal": return executeTerminal(step, ctx);
    default: return { kind: "fail", error: `unknown step type: ${step.type}` };
  }
}

function outcomeKey(o) {
  if (o.kind === "next") return o.outcome === "success" ? "success" : o.outcome === "failure" ? "failure" : o.outcome;
  if (o.kind === "pause") return "paused";
  if (o.kind === "fail") return "failure";
  return "success"; // terminal
}

// ── fallthrough plumbing for loop/parallel ───────────────

function getFallthroughs(state) {
  return state.context.__fallthroughs ?? {};
}
function pushFallthrough(state, pathKey, marker) {
  const ft = getFallthroughs(state);
  ft[pathKey] = ft[pathKey] ?? [];
  ft[pathKey].push(marker);
  state.context.__fallthroughs = ft;
}
function popFallthrough(state, pathKey) {
  const ft = getFallthroughs(state);
  const stack = ft[pathKey];
  if (!stack || stack.length === 0) return null;
  const v = stack.pop();
  if (stack.length === 0) delete ft[pathKey];
  state.context.__fallthroughs = ft;
  return v;
}
function expandAdvanceTarget(state, flow, target, frame, queue) {
  if (target.startsWith("__advance__:")) {
    advanceLoop(state, flow, target.slice("__advance__:".length), frame, queue);
    return { handled: true };
  }
  if (target.startsWith("__advance_parallel__:")) {
    advanceParallel(state, flow, target.slice("__advance_parallel__:".length), frame, queue);
    return { handled: true };
  }
  return { handled: false };
}
function handleFallthrough(state, flow, marker, queue, frame) {
  expandAdvanceTarget(state, flow, marker, frame, queue);
}
function advanceLoop(state, _flow, loopId, frame, queue) {
  const lf = loadLoopFrame(state, loopId);
  if (!lf) return;
  lf.results.push({ index: lf.index });
  lf.index += 1;
  lf.iterations = (lf.iterations ?? 0) + 1;
  saveLoopFrame(state, lf);
  const parentPath = frame.path.slice(0, Math.max(0, frame.path.length - 2));
  queue.unshift({ stepId: loopId, path: parentPath, loopVars: stripLastLoopVar(frame.loopVars, lf.as) });
}
function advanceParallel(state, _flow, parallelId, frame, queue) {
  const pf = loadParallelFrame(state, parallelId);
  if (!pf) return;
  pf.branch_results[pf.branch_index] = "success";
  pf.branch_index += 1;
  saveParallelFrame(state, pf);
  const parentPath = frame.path.slice(0, Math.max(0, frame.path.length - 2));
  queue.unshift({ stepId: parallelId, path: parentPath, loopVars: frame.loopVars });
}
function stripLastLoopVar(vars, varName) {
  const next = { ...vars };
  delete next[varName];
  return next;
}
