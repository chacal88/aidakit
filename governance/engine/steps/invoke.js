// invoke step: dispatches a SKILL or an AGENT by its canonical name and routes via
// on_result. (The legacy "agent" type is normalized to "invoke" in the parser.)
//
// INVERSION OF CONTROL (the central point): the engine has NO way to dispatch a
// skill/subagent — that is the operator Claude's job. So an `invoke` step records
// the request in the flow state and PAUSES, asking Claude to run the
// skill/agent and report back via `node governance/cli.js resume <flow_id> <outcome>`.
//
// Outcomes are constrained to the step's `expects` list when present, otherwise to
// ["success", "failure"].

import { interpolate } from "../interpolate.js";

/**
 * @param {import('../types.js').InvokeStep} step
 * @param {import('../types.js').ExecutionContext} ctx
 * @returns {import('../types.js').StepOutcome}
 */
export function executeInvoke(step, ctx) {
  // If the parent Claude already ran the skill/agent and resumed with a value, that's the outcome.
  if (ctx.resumeValue !== undefined) {
    const allowed = step.expects ?? ["success", "failure"];
    const outcome = ctx.resumeValue.trim();
    if (!allowed.includes(outcome)) {
      // An invalid outcome does NOT kill the flow — re-pause so Claude can report
      // again with a valid outcome. (Preserves the run instead of destroying it.)
      const renderedInput2 = step.input ? interpolate(step.input, ctx) : {};
      return {
        kind: "pause",
        pause: {
          step_id: step.id,
          step_type: "invoke",
          invoca: step.invoca,
          input: renderedInput2,
          prompt: `Outcome "" invalid for step "". Expected one of: . Run the skill/agent and resume with a valid outcome.`,
          path: ctx.path,
          paused_at: new Date().toISOString(),
        },
      };
    }
    // Persist the outcome in state.context[step.id] so downstream steps can
    // reference ${context.<step_id>.outcome}.
    const bag = ctx.state.context[step.id] ?? {};
    bag.outcome = outcome;
    bag.invoca = step.invoca;
    ctx.state.context[step.id] = bag;
    return { kind: "next", outcome, output: { invoca: step.invoca, outcome } };
  }

  // First entry into the step — pause and ask the parent Claude to dispatch.
  const renderedInput = step.input ? interpolate(step.input, ctx) : {};
  const expects = step.expects ?? ["success", "failure"];
  const prompt = [
    `Dispatch skill/agent: ${step.invoca}`,
    step.description ? `Purpose: ${step.description}` : null,
    Object.keys(renderedInput).length ? `Input: ${JSON.stringify(renderedInput, null, 2)}` : null,
    `Expected outcomes: ${expects.join(" | ")}`,
    `When done, run:`,
    `  node governance/cli.js resume ${ctx.state.flow_id} <outcome>`,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    kind: "pause",
    pause: {
      step_id: step.id,
      // Labeled "invoke" (not "human_handoff") so a driver can distinguish a
      // skill/agent dispatch from a genuine human gate and resolve it
      // automatically. `invoca` + `input` carry what the driver needs.
      step_type: "invoke",
      invoca: step.invoca,
      input: renderedInput,
      prompt,
      path: ctx.path,
      paused_at: new Date().toISOString(),
    },
    output: { invoca: step.invoca, input: renderedInput },
  };
}
