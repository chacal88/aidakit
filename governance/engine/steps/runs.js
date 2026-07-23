// runs step: executes a DETERMINISTIC shell command and routes by exit code
// (0 → success, ≠0 → failure). Ported from recruit/.governance/orchestrator/steps/runs.ts.
//
// It is the "command" half of the command-vs-agent split: whatever is deterministic
// (validate, lint, check) runs here, cheaply; whatever requires intelligence is an
// `agent` step. Default cwd = root of the target project.

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { interpolateString } from "../interpolate.js";
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
  const command = interpolateString(step.command, ctx);
  const cwd = step.cwd ? interpolateString(step.cwd, ctx) : projectRoot();
  const env = { ...process.env, AIDAKIT_GOVERNANCE };
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
