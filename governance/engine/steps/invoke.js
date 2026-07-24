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

import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { interpolate } from "../interpolate.js";
import { RESUME_OUTPUT_KEY_RE, RESUME_OUTPUT_VALUE_RE, RESERVED_OUTPUT_KEYS } from "../resume-output.js";
import { resolveProjectRoot } from "../project-root.js";
import { isValidChangeId, assertValidChangeId, CHANGE_ID_RE } from "../change-id.js";
import { appendTelemetry } from "../../telemetry/append.js";

/** Resolves the change-id this dispatch's telemetry line should key on: the
 * explicit `change_id` structured output on THIS resume if the step declared
 * it (the `select` step's own outcome), else whatever `select` already
 * persisted into context earlier in the run. Returns null if neither is
 * available (too early in the flow to have a change-id at all) — telemetry
 * is then skipped rather than written under a wrong/empty path. */
function resolveChangeIdForTelemetry(ctx) {
  if (ctx.resumeOutput && typeof ctx.resumeOutput.change_id === "string") return ctx.resumeOutput.change_id;
  const selectCtx = ctx.state.context && ctx.state.context.select;
  if (selectCtx && typeof selectCtx.change_id === "string") return selectCtx.change_id;
  return null;
}

/** Bytes of the on-disk pack for this change, or 0 if it doesn't exist
 * (fallback path — the dispatcher read the raw docs instead).
 *
 * Round-1 bench fix (Security veto #2): change_id reaches this FS-read sink
 * from the same resume `change_id=<value>` structured output as the write
 * sinks (build.js's packPathFor, telemetry/append.js's telemetryPathFor) —
 * guard fail-closed BEFORE any resolve()/join() here too, for the same
 * reason (see governance/engine/change-id.js). Exported for direct unit
 * testing of this sink in isolation. */
export function packSizeFor(changeId) {
  assertValidChangeId(changeId);
  const root = resolveProjectRoot(undefined, process.cwd());
  const packPath = resolve(root, "docs", "features", changeId, ".context-pack.md");
  return existsSync(packPath) ? statSync(packPath).size : 0;
}

/** Live write-site for `.telemetry.jsonl` (ADR-012 §"Live write-site — engine
 * extension"): the resume handler is the ONLY point where the engine holds
 * both the dispatched agent's usage numbers (via ctx.telemetry, supplied by
 * the parent Claude on `resume`) and the step that was actually dispatched.
 * A no-op when telemetry kwargs were absent from the resume call, or when no
 * change-id can be resolved yet — additive, never a new failure mode. */
function writeTelemetryIfPresent(step, ctx) {
  if (!ctx.telemetry) return;
  const changeId = resolveChangeIdForTelemetry(ctx);
  if (!changeId) return;
  appendTelemetry({
    changeId,
    subagent: step.invoke_target,
    cache_creation: ctx.telemetry.cache_creation,
    cache_read: ctx.telemetry.cache_read,
    output_tokens: ctx.telemetry.output_tokens,
    pack_size: packSizeFor(changeId),
    duration_ms: ctx.telemetry.duration_ms,
    pack_rebuilt: ctx.telemetry.pack_rebuilt,
  });
}

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
      if (v === undefined) { problems.push(`missing required output "${key}"`); continue; }
      if (!RESUME_OUTPUT_VALUE_RE.test(String(v))) { problems.push(`output "${key}" must be a single safe token matching ${RESUME_OUTPUT_VALUE_RE.source}`); continue; }
      // Round-1 bench fix (Security veto #2): change_id is the ONE structured
      // output that reaches path.resolve()/join() at multiple FS-write sinks
      // downstream (build.js's packPathFor, invoke.js's own packSizeFor,
      // telemetry/append.js's telemetryPathFor). The generic
      // RESUME_OUTPUT_VALUE_RE above permits `.` and `/` (needed for OTHER
      // outputs like branch names/paths/URLs), which is exactly what a
      // `change_id=/tmp/pwned` or `change_id=../../../../tmp/pwned` resume
      // would need to escape the project root — reject that shape at THIS
      // boundary, the earliest point change_id enters the flow's context, in
      // addition to each sink's own guard (defense in depth).
      if (key === "change_id" && !isValidChangeId(String(v))) {
        problems.push(`output "change_id" must be a single kebab-case segment matching ${CHANGE_ID_RE.source} (no "/", no ".", no uppercase)`);
      }
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
    writeTelemetryIfPresent(step, ctx);
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
