// parallel step: runs the branches sequentially in this engine (single-threaded;
// the parallelism is logical, not concurrent). Semantic guarantee: "all
// branches must pass for the parallel step to pass". Order within each
// branch is preserved. Ported from recruit/.governance/orchestrator/steps/parallel.ts.
//
// Usage note in aidakit: when a step needs REAL subagent parallelism
// (e.g. the review board), that is handled by the operator Claude
// via the Task tool in a single message — the engine only declares the intent and
// collects the verdicts. This parallel is for logical ordering in the flow.

export function loadParallelFrame(state, stepId) {
  const bag = state.context.__parallels ?? {};
  return bag[stepId] ?? null;
}

export function saveParallelFrame(state, frame) {
  const bag = state.context.__parallels ?? {};
  bag[frame.step_id] = frame;
  state.context.__parallels = bag;
}

export function clearParallelFrame(state, stepId) {
  const bag = state.context.__parallels ?? {};
  delete bag[stepId];
  state.context.__parallels = bag;
}

/**
 * @param {import('../types.js').ParallelStep} step
 * @param {import('../types.js').ExecutionContext} ctx
 * @returns {import('../types.js').StepOutcome}
 */
export function executeParallel(step, ctx) {
  let frame = loadParallelFrame(ctx.state, step.id);
  if (!frame) {
    frame = {
      step_id: step.id,
      branch_index: 0,
      total_branches: step.branches.length,
      branch_results: step.branches.map(() => "pending"),
    };
    saveParallelFrame(ctx.state, frame);
  }
  if (frame.branch_index >= frame.total_branches) {
    const allOk = frame.branch_results.every((r) => r === "success");
    clearParallelFrame(ctx.state, step.id);
    return { kind: "next", outcome: allOk ? "success" : "failure", output: { branch_results: frame.branch_results } };
  }
  return { kind: "next", outcome: "__branch__", output: { branch: frame.branch_index, total: frame.total_branches } };
}
