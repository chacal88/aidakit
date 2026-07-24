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
//
// STRUCTURED OUTPUTS (ADR-006): a step may declare `outputs: {<outcome>: [key...]}`.
// Resuming with that outcome then REQUIRES the declared keys as `key=value`
// tokens after the outcome (safe single tokens — see resume-output.js); the
// engine re-pauses until they arrive, and persists them into context[step.id]
// for downstream ${context.<step>.<key>} interpolation. This is how `select`
// carries the resolved change-id into the flow instead of the free-form request.

import { interpolate } from "../interpolate.js";
import { RESUME_OUTPUT_KEY_RE, RESUME_OUTPUT_VALUE_RE, RESERVED_OUTPUT_KEYS } from "../resume-output.js";

/** Re-pause at the same step with an explanatory prompt — an invalid resume
 * must never destroy the run (same doctrine as the human_gate typo re-pause). */
function repause(step, ctx, message) {
  return {
    kind: "pause",
    pause: {
      step_id: step.id,
      step_type: "invoke",
      invoke_target: step.invoke_target,
      input: step.input ? interpolate(step.input, ctx) : {},
      outputs: step.outputs,
      prompt: message,
      path: ctx.path,
      paused_at: new Date().toISOString(),
    },
  };
}

/**
 * @param {import('../types.js').InvokeStep} step
 * @param {import('../types.js').ExecutionContext} ctx
 * @returns {import('../types.js').StepOutcome}
 */
export function executeInvoke(step, ctx) {
  const expects = step.expects ?? ["success", "failure"];

  // If the parent Claude already ran the skill/agent and resumed with a value, that's the outcome.
  if (ctx.resumeValue !== undefined) {
    const outcome = ctx.resumeValue.trim();
    if (!expects.includes(outcome)) {
      // An invalid outcome does NOT kill the flow — re-pause so Claude can report
      // again with a valid outcome. (Preserves the run instead of destroying it.)
      return repause(step, ctx, `Outcome "${outcome}" invalid for step "${step.id}". Expected one of: ${expects.join(" | ")}. Run the skill/agent and resume with a valid outcome.`);
    }

    // `outputs` leash — fail-closed: the keys declared for this outcome must
    // arrive with the resume and be safe single tokens, so a downstream
    // ${context.<id>.<key>} can never interpolate an unresolved or unsafe
    // value into a command or path.
    const required = (step.outputs && step.outputs[outcome]) ?? [];
    const supplied = ctx.resumeOutput ?? {};
    const problems = [];
    for (const key of required) {
      const v = supplied[key];
      if (v === undefined) problems.push(`missing required output "${key}"`);
      else if (!RESUME_OUTPUT_VALUE_RE.test(String(v))) problems.push(`output "${key}" must be a single safe token matching ${RESUME_OUTPUT_VALUE_RE.source}`);
    }
    if (problems.length) {
      return repause(step, ctx, [
        `Outcome "${outcome}" for step "${step.id}" needs its declared outputs: ${problems.join("; ")}.`,
        `Re-run:`,
        `  node governance/cli.js resume ${ctx.state.flow_id} ${outcome} ${required.map((k) => `${k}=<value>`).join(" ")}`,
      ].join("\n"));
    }

    // Persist the outcome (and any supplied outputs) in state.context[step.id]
    // so downstream steps can reference ${context.<step_id>.outcome} etc.
    const bag = ctx.state.context[step.id] ?? {};
    for (const [k, v] of Object.entries(supplied)) {
      if (RESUME_OUTPUT_KEY_RE.test(k) && !RESERVED_OUTPUT_KEYS.has(k) && RESUME_OUTPUT_VALUE_RE.test(String(v))) {
        bag[k] = String(v);
      }
    }
    bag.outcome = outcome;
    bag.invoke_target = step.invoke_target;
    ctx.state.context[step.id] = bag;
    return { kind: "next", outcome, output: { invoke_target: step.invoke_target, outcome } };
  }

  // First entry into the step — pause and ask the parent Claude to dispatch.
  const renderedInput = step.input ? interpolate(step.input, ctx) : {};
  const outputsLine = step.outputs
    ? `Required outputs (append key=value after the outcome): ${Object.entries(step.outputs).map(([o, keys]) => `${o} → ${keys.map((k) => `${k}=<value>`).join(" ")}`).join(" · ")}`
    : null;
  const prompt = [
    `Dispatch skill/agent: ${step.invoke_target}`,
    step.description ? `Purpose: ${step.description}` : null,
    Object.keys(renderedInput).length ? `Input: ${JSON.stringify(renderedInput, null, 2)}` : null,
    `Expected outcomes: ${expects.join(" | ")}`,
    outputsLine,
    `When done, run:`,
    `  node governance/cli.js resume ${ctx.state.flow_id} <outcome>${step.outputs ? " [key=value ...]" : ""}`,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    kind: "pause",
    pause: {
      step_id: step.id,
      // Labeled "invoke" (not "human_handoff") so a driver can distinguish a
      // skill/agent dispatch from a genuine human gate and resolve it
      // automatically. `invoke_target` + `input` carry what the driver needs.
      step_type: "invoke",
      invoke_target: step.invoke_target,
      input: renderedInput,
      outputs: step.outputs,
      prompt,
      path: ctx.path,
      paused_at: new Date().toISOString(),
    },
    output: { invoke_target: step.invoke_target, input: renderedInput },
  };
}
