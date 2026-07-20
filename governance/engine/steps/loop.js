// loop step: iterates the body steps over an array from the context.
// Ported from recruit/.governance/orchestrator/steps/loop.ts.
// The executor does NOT run the body — it builds the iteration frame and hands
// control back to the engine, which recurses into the body per item. In-flight
// iteration state lives in ctx.state.context.__loops[<step_id>].

import { resolve as resolveExpr } from "../interpolate.js";

export function loadLoopFrame(state, stepId) {
  const loops = state.context.__loops ?? {};
  return loops[stepId] ?? null;
}

export function saveLoopFrame(state, frame) {
  const loops = state.context.__loops ?? {};
  loops[frame.step_id] = frame;
  state.context.__loops = loops;
}

export function clearLoopFrame(state, stepId) {
  const loops = state.context.__loops ?? {};
  delete loops[stepId];
  state.context.__loops = loops;
}

/**
 * @param {import('../types.js').LoopStep} step
 * @param {import('../types.js').ExecutionContext} ctx
 * @returns {import('../types.js').StepOutcome}
 */
export function executeLoop(step, ctx) {
  let frame = loadLoopFrame(ctx.state, step.id);
  if (!frame) {
    const items = resolveExpr(step.over, ctx);
    if (!Array.isArray(items)) {
      return {
        kind: "fail",
        error: `loop "${step.id}": over expression "${step.over}" did not resolve to an array`,
      };
    }
    frame = {
      step_id: step.id,
      index: 0,
      total: items.length,
      as: step.as ?? "item",
      items,
      results: [],
      iterations: 0,
    };
    saveLoopFrame(ctx.state, frame);
  }
  // Termination, in order of precedence:
  //  1. `until` — condition true after a previous iteration.
  //  2. `max`   — iteration cap (bounds back-edges/self-loops).
  //  3. index   — the classic for-each (array exhausted).
  // `until`/`max` only make sense after ≥1 iteration; a fresh frame (iterations===0)
  // skips them and enters the body.
  if (frame.iterations > 0 && step.until !== undefined && isTruthy(resolveExpr(step.until, ctx))) {
    clearLoopFrame(ctx.state, step.id);
    return { kind: "next", outcome: "success", output: { total: frame.total, results: frame.results, iterations: frame.iterations, terminated_by: "until" } };
  }
  if (step.max !== undefined && frame.iterations >= step.max) {
    clearLoopFrame(ctx.state, step.id);
    return { kind: "next", outcome: "success", output: { total: frame.total, results: frame.results, iterations: frame.iterations, terminated_by: "max" } };
  }
  if (frame.index >= frame.total) {
    clearLoopFrame(ctx.state, step.id);
    return { kind: "next", outcome: "success", output: { total: frame.total, results: frame.results, iterations: frame.iterations, terminated_by: "index" } };
  }
  // The engine handles the iteration; signal "iterate" via a custom outcome.
  return {
    kind: "next",
    outcome: "__iterate__",
    output: { index: frame.index, total: frame.total, item: frame.items[frame.index] },
  };
}

/** Truthiness of an `until` result: false for null/undefined/false/0/""/"false". */
function isTruthy(v) {
  if (v === null || v === undefined) return false;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") return v !== "" && v.toLowerCase() !== "false";
  return true;
}
