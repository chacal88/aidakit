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

// The Node infra-detect prelude — injected into every child's env via
// NODE_OPTIONS so any `node` sub-invocation of a `runs` step remaps a
// require()-resolution failure to the reserved sentinel exit 250 (ADR-011).
const AIDAKIT_PRELUDE = resolve(dirname(fileURLToPath(import.meta.url)), "..", "prelude", "infra-detect.cjs");

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
  // AIDAKIT_GOVERNANCE (path to this kit's governance/ dir), AIDAKIT_FLOW_ID
  // (this run's own flow_id) and NODE_OPTIONS (append of the infra-detect
  // prelude — ADR-011) are engine-owned env keys, alongside the
  // ${...}-derived $AIDAKIT_VAR_n data keys (ADR-006 §1: values are env-passed,
  // never spliced into command text). AIDAKIT_FLOW_ID lets a `runs` step locate
  // its OWN persisted state (governance/engine/persistence.js's statePath) —
  // e.g. the retry-memory append helper reads state.context.__visits from it
  // without the flow having to thread flow_id through `${...}` interpolation
  // (ADR-004: env carries structural/identity data, not flow-authored values).
  // NODE_OPTIONS is APPENDED to any inherited value — same "engine extends,
  // doesn't shadow" precedence as AIDAKIT_GOVERNANCE (ADR-004).
  const nodeOpts = (process.env.NODE_OPTIONS ?? "").trim();
  const injectedNodeOpts = `${nodeOpts} --require=${JSON.stringify(AIDAKIT_PRELUDE)}`.trim();
  const env = {
    ...process.env,
    ...vars,
    AIDAKIT_GOVERNANCE,
    AIDAKIT_FLOW_ID: ctx.state.flow_id,
    NODE_OPTIONS: injectedNodeOpts,
  };
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

  // Infra-error classification (ADR-011): structural signals ONLY, first match
  // wins — no stderr pattern-matching. Any of these ALWAYS bypasses
  // step.on_failure in engine.js, regardless of whether the step declared one.
  //   - res.error truthy      → spawnSync failed to start the child at all.
  //   - res.signal truthy     → child killed by a signal (res.status is null).
  //   - res.status === 127    → POSIX "command not found".
  //   - res.status === 126    → POSIX "permission denied".
  //   - res.status === 250    → reserved sentinel from the Node prelude
  //                             (require()-resolution failure remapped from
  //                             an indistinguishable exit 1 — see
  //                             prelude/infra-detect.cjs).
  const isInfra =
    !!res.error ||
    !!res.signal ||
    res.status === 127 ||
    res.status === 126 ||
    res.status === 250;
  if (isInfra) {
    const parts = [];
    if (res.error) parts.push(`spawn error: ${res.error.message}`);
    if (res.signal) parts.push(`killed by ${res.signal}`);
    if (res.status != null) parts.push(`exit ${res.status}`);
    const tail = (res.stderr ?? "").slice(-1000).trim();
    if (tail) parts.push(`stderr: ${tail}`);
    // Reuse the same `output` object, but with the RAW exit_code/signal (null
    // when not applicable) instead of output's -1 sentinel — the
    // runs_infra_error event and state.step_history[last].error must carry
    // every triage field faithfully (null means "no exit code", not "-1").
    const infraOutput = { ...output, exit_code: res.status ?? null, signal: res.signal ?? null };
    ctx.state.context[step.id] = infraOutput;
    return { kind: "infra", error: `runs infra error: ${parts.join("; ")}`, output: infraOutput };
  }

  if ((res.status ?? -1) === 0) return { kind: "next", outcome: "success", output };
  return { kind: "next", outcome: "failure", output };
}
