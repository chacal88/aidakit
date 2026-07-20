// human_handoff step: pauses and hands the human/Claude a free-form task; the
// resume value (free text) is stored in context[step.id].response and routes
// via on_success. Ported from recruit/.governance/orchestrator/steps/human-handoff.ts.

import { interpolateString } from "../interpolate.js";

/**
 * @param {import('../types.js').HumanHandoffStep} step
 * @param {import('../types.js').ExecutionContext} ctx
 * @returns {import('../types.js').StepOutcome}
 */
export function executeHumanHandoff(step, ctx) {
  if (ctx.resumeValue !== undefined) {
    const bag = ctx.state.context[step.id] ?? {};
    bag.response = ctx.resumeValue;
    ctx.state.context[step.id] = bag;
    return { kind: "next", outcome: "success", output: { response: ctx.resumeValue } };
  }
  return {
    kind: "pause",
    pause: {
      step_id: step.id,
      step_type: "human_handoff",
      prompt: interpolateString(step.prompt, ctx),
      path: ctx.path,
      paused_at: new Date().toISOString(),
    },
  };
}
