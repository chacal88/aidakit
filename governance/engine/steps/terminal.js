// terminal step: ends the flow with an outcome (completed | aborted).
// Ported from recruit/.governance/orchestrator/steps/terminal.ts.

import { interpolateString } from "../interpolate.js";

/**
 * @param {import('../types.js').TerminalStep} step
 * @param {import('../types.js').ExecutionContext} ctx
 * @returns {import('../types.js').StepOutcome}
 */
export function executeTerminal(step, ctx) {
  return {
    kind: "terminal",
    outcome: step.outcome ?? "completed",
    message: step.message ? interpolateString(step.message, ctx) : undefined,
  };
}
