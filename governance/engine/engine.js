// aidakit flow engine.
// Ported from recruit/.governance/orchestrator/engine.ts.
//
// Drives a parsed flow forward until it completes, pauses or fails.
// Single-threaded; loop/parallel recursion is unrolled into an explicit
// step queue so state can survive crashes via persistence.

import { findStep } from "./parser.js";
import { logEvent, newFlowId, saveState } from "./persistence.js";
import { renderSummary, capSummary } from "./summary-template.js";
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

    // Back-edge visit cap: bounds loops formed by on_result routes (e.g.
    // critic → revise → specify) that the loop step's `max` cannot see. The
    // check runs BEFORE dispatch so an entry that trips the cap does NOT run
    // the (typically expensive) step body — the whole point is to stop burning
    // tokens on a runaway loop.
    //
    // A pausing step (invoke, human_gate) traverses drive() TWICE per logical
    // visit: once to pause, once to consume the resume. Counting only fresh
    // entries (resumeValue === undefined) makes 1 visit = 1 count regardless of
    // step type — runs/terminal/etc are always fresh, so the semantics are
    // uniform: "how many times did the engine start executing this step".
    const isFreshEntry = resumeValue === undefined && resumeOutput === undefined;
    if (typeof step.max_visits === "number" && isFreshEntry) {
      const visits = state.context.__visits ?? {};
      const priorEntries = visits[step.id] ?? 0;
      if (priorEntries >= step.max_visits) {
        const target = step.on_max_visits;
        logEvent(state.flow_id, {
          event: "step_max_visits_exceeded",
          step_id: step.id,
          visits: priorEntries,
          max_visits: step.max_visits,
          escalation: target ?? null,
        });
        state.step_history.push({
          step_id: step.id,
          step_type: step.type,
          path: frame.path,
          started_at: startedAt,
          ended_at: new Date().toISOString(),
          result: "max_visits_exceeded",
          output: { visits: priorEntries, max_visits: step.max_visits },
        });
        resumeValue = undefined;
        resumeOutput = undefined;
        if (target) {
          queue.unshift({ stepId: target, path: frame.path, loopVars: frame.loopVars });
          continue;
        }
        // Fail-closed: parser rejects max_visits without on_max_visits, but if
        // a hand-crafted state ever reaches here, treat it as a hard failure
        // rather than silently swallowing the loop cap.
        state.status = "failed";
        state.outcome = "failed";
        state.finished_at = new Date().toISOString();
        saveState(state);
        logEvent(state.flow_id, { event: "flow_end", outcome: "failed", error: `step "${step.id}" exceeded max_visits (${step.max_visits}) with no on_max_visits escalation` });
        return { status: state.status, state };
      }
      visits[step.id] = priorEntries + 1;
      state.context.__visits = visits;
    }

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
      error: outcome.kind === "fail" || outcome.kind === "infra" ? outcome.error : undefined,
    };
    state.step_history.push(history);
    logEvent(state.flow_id, { event: "step_end", step_id: step.id, result: history.result });

    // ── per-step narrative emission (flow-step-summaries) ──────────────────
    // Emits when the step has RESOLVED (kind: "next" or "fail") — NOT on the
    // initial pause (kind: "pause"), because context[step.id] is only fully
    // populated after resume (see invoke.js/human-gate.js/human-handoff.js).
    // The type gate excludes `runs`/`loop`/`parallel`/`terminal` (which never
    // pause and do not carry a per-step narrative — see design.md §Emission
    // points). A re-entered step (back-edge) appends a NEW entry; visit_n is
    // derived from the count of PRIOR entries for this step_id, never mutating
    // an earlier entry.
    if (
      (outcome.kind === "next" || outcome.kind === "fail") &&
      (step.type === "invoke" || step.type === "human_gate" || step.type === "human_handoff")
    ) {
      emitSummary(state, step, outcome);
    }

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
    if (outcome.kind === "infra") {
      // Infra errors (command not found, permission denied, signal-kill,
      // spawn failure, Node require() failure) ALWAYS hard-stop the flow —
      // the on_failure lookup is not performed. ADR-010.
      logEvent(state.flow_id, {
        event: "runs_infra_error",
        step_id: step.id,
        command: outcome.output?.command,
        exit_code: outcome.output?.exit_code,
        signal: outcome.output?.signal,
        stderr: (outcome.output?.stderr ?? "").slice(-2000),
      });
      state.status = "failed";
      state.outcome = "failed";
      state.finished_at = new Date().toISOString();
      saveState(state);
      logEvent(state.flow_id, { event: "flow_end", outcome: "failed", error: outcome.error });
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

/** Renders and appends one state.summaries entry for a resolved pause-emitting
 * step. Never throws (renderSummary/capSummary are total functions); a template
 * referencing an unset key renders a visible `<unset:key>` marker instead of
 * crashing the flow. See docs/features/flow-step-summaries/design.md
 * §Emission points. */
function emitSummary(state, step, outcome) {
  const resolvedOutcome = outcomeKey(outcome);
  // `{outcome}` must always resolve, regardless of step type: only invoke.js
  // writes an explicit `.outcome` into context[step.id] (human-gate.js writes
  // `.choice`; human-handoff.js writes `.response` — neither sets `.outcome`).
  // Synthesizing it here from the SAME value persisted as the entry's own
  // `outcome` field keeps the default template `{outcome}` uniform across
  // invoke/human_gate/human_handoff (crit. 2, 6) without depending on each
  // executor's individual write-set.
  const bag = { ...(state.context[step.id] ?? {}), outcome: resolvedOutcome };
  const template = typeof step.summary === "string" ? step.summary : "{outcome}";
  const rawText = renderSummary(template, bag);
  const cappedText = capSummary(rawText);
  const priorVisits = (state.summaries ?? []).filter((s) => s.step_id === step.id).length;
  state.summaries = state.summaries ?? [];
  const visitN = priorVisits + 1;
  state.summaries.push({
    step_id: step.id,
    visit_n: visitN,
    outcome: resolvedOutcome,
    text: cappedText,
    ts: new Date().toISOString(),
  });
  logEvent(state.flow_id, { event: "step_summary", step_id: step.id, visit_n: visitN, text: cappedText });
}

function outcomeKey(o) {
  if (o.kind === "next") return o.outcome === "success" ? "success" : o.outcome === "failure" ? "failure" : o.outcome;
  if (o.kind === "pause") return "paused";
  if (o.kind === "infra") return "infra_error";
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
