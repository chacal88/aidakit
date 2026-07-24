// runs step: executes a DETERMINISTIC shell command and routes by exit code
// (0 → success, ≠0 → failure). Ported from recruit/.governance/orchestrator/steps/runs.ts.
//
// It is the "command" half of the command-vs-agent split: whatever is deterministic
// (validate, lint, check) runs here, cheaply; whatever requires intelligence is an
// `agent` step. Default cwd = root of the target project.

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { interpolateString, interpolateCommand } from "../interpolate.js";
import { projectRoot } from "../persistence.js";

// governance/engine/steps/runs.js → up two levels lands ON governance/ (the kit's
// governance dir), so $AIDAKIT_GOVERNANCE/validators/x resolves regardless of cwd.
const AIDAKIT_GOVERNANCE = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * @param {import('../types.js').RunsStep} step
 * @param {import('../types.js').ExecutionContext} ctx
 * @returns {import('../types.js').StepOutcome}
 */
export function executeRuns(step, ctx) {
  // ${...} values are handed to bash as environment DATA ($AIDAKIT_VAR_n),
  // never spliced as shell text (ADR-006): a multiline/metacharacter value
  // cannot break the command structure or inject commands.
  const { command, vars } = interpolateCommand(step.command, ctx);
  const cwd = step.cwd ? interpolateString(step.cwd, ctx) : projectRoot();
  // AIDAKIT_GOVERNANCE (path to this kit's governance/ dir) and AIDAKIT_FLOW_ID
  // (this run's own flow_id) are engine-owned env keys, alongside the
  // ${...}-derived $AIDAKIT_VAR_n data keys (ADR-006 §1: values are env-passed,
  // never spliced into command text). AIDAKIT_FLOW_ID lets a `runs` step locate
  // its OWN persisted state (governance/engine/persistence.js's statePath) —
  // e.g. the retry-memory append helper reads state.context.__visits from it
  // without the flow having to thread flow_id through `${...}` interpolation
  // (ADR-004: env carries structural/identity data, not flow-authored values).
  const env = { ...process.env, ...vars, AIDAKIT_GOVERNANCE, AIDAKIT_FLOW_ID: ctx.state.flow_id };
  if (step.env) {
    for (const [k, v] of Object.entries(step.env)) {
      env[k] = interpolateString(String(v), ctx);
    }
  }
  const res = spawnSync("bash", ["-lc", command], {
    cwd,
    env,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  const output = {
    command,
    vars,
    cwd,
    exit_code: res.status ?? -1,
    stdout: (res.stdout ?? "").slice(-4000),
    stderr: (res.stderr ?? "").slice(-4000),
  };
  // Persist under context[step.id] for downstream steps to inspect.
  ctx.state.context[step.id] = output;
  // Failure to START the process (nonexistent command, missing bash) is an infra
  // error — not a routable "test that failed". Distinct from exit≠0.
  if (res.error) {
    return { kind: "fail", error: `runs: error running the command: ${res.error.message}`, output };
  }
  if ((res.status ?? -1) === 0) return { kind: "next", outcome: "success", output };
  return { kind: "next", outcome: "failure", output };
}
