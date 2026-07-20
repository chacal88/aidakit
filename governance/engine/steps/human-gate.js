// human_gate step: pauses and asks the human to pick one of `options`.
// The resume value must be one of the options; routes via on_result[value].
// Ported from recruit/.governance/orchestrator/steps/human-gate.ts.

import { interpolateString } from "../interpolate.js";

/**
 * @param {import('../types.js').HumanGateStep} step
 * @param {import('../types.js').ExecutionContext} ctx
 * @returns {import('../types.js').StepOutcome}
 */
export function executeHumanGate(step, ctx) {
  if (ctx.resumeValue !== undefined) {
    const choice = ctx.resumeValue.trim();
    if (!step.options.includes(choice)) {
      // An invalid value does NOT kill the flow — re-pause at the same gate so the
      // human can try again. (A typo must not be able to destroy the run.)
      return {
        kind: "pause",
        pause: {
          step_id: step.id,
          step_type: "human_gate",
          prompt: `Invalid answer "${choice}". Choose one of: ${step.options.join(", ")}.\n\n` + interpolateString(step.prompt, ctx),
          options: step.options,
          path: ctx.path,
          paused_at: new Date().toISOString(),
        },
      };
    }
    const bag = ctx.state.context[step.id] ?? {};
    bag.choice = choice;
    ctx.state.context[step.id] = bag;
    return { kind: "next", outcome: choice, output: { choice } };
  }
  return {
    kind: "pause",
    pause: {
      step_id: step.id,
      step_type: "human_gate",
      prompt: interpolateString(step.prompt, ctx),
      options: step.options,
      path: ctx.path,
      paused_at: new Date().toISOString(),
    },
  };
}
