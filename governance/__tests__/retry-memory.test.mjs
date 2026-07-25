// Tests for retry-memory (docs/features/retry-memory/): structured retry
// history for full.yaml's back-edges — the append helper, the engine's
// AIDAKIT_FLOW_ID env var, the invoke outputs-leash extension (compat guard),
// full.yaml's record_*_cause wiring, and an end-to-end drive.
// Pure Node, no framework — mirrors governance/__tests__/engine.test.mjs and
// governance/__tests__/check-bench.test.mjs idiom.

import { mkdtempSync, rmSync, existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

let pass = 0, fail = 0;
function ok(cond, name) { if (cond) pass++; else { fail++; console.log(`FAIL ${name}`); } }
function eq(a, b, name) { const r = JSON.stringify(a) === JSON.stringify(b); if (!r) console.log(`  ${name}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); ok(r, name); }

const here = new URL(".", import.meta.url).pathname;
const validatorPath = join(here, "..", "validators", "append-retry-history.js");

const { statePath } = await import("../engine/persistence.js");

// ── §1 — Append helper unit tests (governance/validators/append-retry-history.js) ──
// Each test gets its own isolated project root (mkdtempSync) so
// AIDAKIT_PROJECT_ROOT scoping is real, not shared/coincidental.

function freshRoot(prefix) {
  return mkdtempSync(join(tmpdir(), `retry-memory-${prefix}-`));
}

function historyPathFor(root, changeId) {
  return join(root, "docs", "features", changeId, "retry-history.json");
}

/** Runs the append helper with the given args, env-scoped to `root`. */
function runAppend(root, args, extraEnv = {}) {
  try {
    const out = execFileSync("node", [validatorPath, ...args], {
      encoding: "utf8",
      env: { ...process.env, AIDAKIT_PROJECT_ROOT: root, ...extraEnv },
    });
    return { code: 0, stdout: out.trim(), json: out.trim() ? JSON.parse(out.trim().split("\n").pop()) : null };
  } catch (e) {
    const out = (e.stdout || "").trim();
    return { code: e.status, stdout: out, stderr: e.stderr || "", json: out ? JSON.parse(out.split("\n").pop()) : null };
  }
}

function readHistoryFile(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

// (1a) Append into a missing dir/file — helper creates both; contents match; exit 0.
{
  const root = freshRoot("1a");
  const changeId = "retry-memory-1a";
  const r = runAppend(root, [changeId, "specify", "critic-reject"]);
  eq(r.code, 0, "1a: exit 0");
  const p = historyPathFor(root, changeId);
  ok(existsSync(p), "1a: retry-history.json created");
  eq(readHistoryFile(p), [{ round: null, step_id: "specify", cause: "critic-reject" }],
    "1a: file contents = [{round: null (no --flow-id), step_id, cause}]");
  rmSync(root, { recursive: true, force: true });
}

// (1b) Append into an existing file with a prior record — both present, in order, no dup.
{
  const root = freshRoot("1b");
  const changeId = "retry-memory-1b";
  const p = historyPathFor(root, changeId);
  mkdirSync(join(p, ".."), { recursive: true });
  writeFileSync(p, JSON.stringify([{ round: 1, step_id: "specify", cause: "critic-reject" }]));
  const r = runAppend(root, [changeId, "specify", "readiness-not-ready"]);
  eq(r.code, 0, "1b: exit 0");
  eq(readHistoryFile(p), [
    { round: 1, step_id: "specify", cause: "critic-reject" },
    { round: null, step_id: "specify", cause: "readiness-not-ready" },
  ], "1b: both records present, in order, no dup");
  rmSync(root, { recursive: true, force: true });
}

// (1c) Empty change_id or empty cause → exit 0 no-op; file untouched.
{
  const root = freshRoot("1c");
  const changeId = "retry-memory-1c";
  const p = historyPathFor(root, changeId);

  const r1 = runAppend(root, ["", "specify", "critic-reject"]);
  eq(r1.code, 0, "1c: empty change_id → exit 0");
  ok(!existsSync(p), "1c: empty change_id → file untouched (never created)");

  const r2 = runAppend(root, [changeId, "specify", ""]);
  eq(r2.code, 0, "1c: empty cause → exit 0");
  ok(!existsSync(p), "1c: empty cause → file untouched (never created)");
  rmSync(root, { recursive: true, force: true });
}

// (1d) Invalid cause (contains a space) → exit 1, diagnostic mentions RESUME_OUTPUT_VALUE_RE; file untouched.
{
  const root = freshRoot("1d");
  const changeId = "retry-memory-1d";
  const p = historyPathFor(root, changeId);
  const r = runAppend(root, [changeId, "specify", "has space"]);
  eq(r.code, 1, "1d: invalid cause → exit 1");
  ok(r.stderr.includes("RESUME_OUTPUT_VALUE_RE"), "1d: diagnostic mentions RESUME_OUTPUT_VALUE_RE");
  ok(!existsSync(p), "1d: invalid cause → file untouched");
  rmSync(root, { recursive: true, force: true });
}

// (1e) Atomic write — .tmp does not exist after success; a stale pre-existing
// .tmp is cleanly overwritten by the next append (no leftover).
{
  const root = freshRoot("1e");
  const changeId = "retry-memory-1e";
  const p = historyPathFor(root, changeId);
  const tmpFile = `${p}.tmp`;
  mkdirSync(join(p, ".."), { recursive: true });
  writeFileSync(tmpFile, "stale garbage from a crashed prior write");

  const r = runAppend(root, [changeId, "specify", "critic-reject"]);
  eq(r.code, 0, "1e: exit 0 despite a stale pre-existing .tmp");
  ok(!existsSync(tmpFile), "1e: .tmp does not exist after a successful call (renamed away)");
  eq(readHistoryFile(p), [{ round: null, step_id: "specify", cause: "critic-reject" }],
    "1e: the stale .tmp was overwritten cleanly, not appended to the real file");
  rmSync(root, { recursive: true, force: true });
}

// (1f) round computed from a mock state file's __visits[target]; missing state → round: null.
{
  const root = freshRoot("1f");
  const changeId = "retry-memory-1f";
  const flowId = "full-260724-1f0001";
  const sp = statePath(flowId);
  // statePath resolves against the CURRENT process's AIDAKIT_PROJECT_ROOT (this
  // process, not the child) — override it around the write, then restore.
  const prevRoot = process.env.AIDAKIT_PROJECT_ROOT;
  process.env.AIDAKIT_PROJECT_ROOT = root;
  const resolvedStatePath = statePath(flowId);
  mkdirSync(join(resolvedStatePath, ".."), { recursive: true });
  writeFileSync(resolvedStatePath, JSON.stringify({ flow_id: flowId, context: { __visits: { specify: 2 } } }));
  process.env.AIDAKIT_PROJECT_ROOT = prevRoot;

  const r = runAppend(root, [changeId, "specify", "critic-reject", "--flow-id", flowId]);
  eq(r.code, 0, "1f: exit 0");
  const p = historyPathFor(root, changeId);
  eq(readHistoryFile(p), [{ round: 2, step_id: "specify", cause: "critic-reject" }],
    "1f: round computed from the mock state file's __visits.specify (2)");

  // Missing state file (different flow-id, never written) → round: null, record still written.
  const changeId2 = "retry-memory-1f-missing";
  const r2 = runAppend(root, [changeId2, "specify", "critic-reject", "--flow-id", "nope-000000-000000"]);
  eq(r2.code, 0, "1f: missing state file → exit 0");
  eq(readHistoryFile(historyPathFor(root, changeId2)), [{ round: null, step_id: "specify", cause: "critic-reject" }],
    "1f: missing state file → round: null, record still written");
  rmSync(root, { recursive: true, force: true });
}

// (1f-anti-drift) Pins the state path against persistence.js's own statePath —
// if persistence.js ever moves the state root, THIS test fails before the
// append helper silently starts returning round: null on every real run.
{
  const root = freshRoot("1f-anti-drift");
  const flowId = "full-260724-antidrift1";
  const prevRoot = process.env.AIDAKIT_PROJECT_ROOT;
  process.env.AIDAKIT_PROJECT_ROOT = root;
  const p = statePath(flowId);
  ok(p.includes(join(".aidakit", "flows", "state")), "1f-anti-drift: statePath resolves under .aidakit/flows/state");
  mkdirSync(join(p, ".."), { recursive: true });
  writeFileSync(p, JSON.stringify({ flow_id: flowId, context: { __visits: { implement: 5 } } }));
  process.env.AIDAKIT_PROJECT_ROOT = prevRoot;

  const changeId = "retry-memory-1f-antidrift";
  const r = runAppend(root, [changeId, "implement", "bench-veto", "--flow-id", flowId]);
  eq(r.code, 0, "1f-anti-drift: exit 0");
  eq(readHistoryFile(historyPathFor(root, changeId)), [{ round: 5, step_id: "implement", cause: "bench-veto" }],
    "1f-anti-drift: reads the visit count from EXACTLY persistence.statePath(id)");
  rmSync(root, { recursive: true, force: true });
}

// ── §2-env — the engine surfaces AIDAKIT_FLOW_ID to `runs` step children ──
// A minimal test flow with a single `runs` step that echoes $AIDAKIT_FLOW_ID;
// drive it and assert the captured stdout equals the flow's own flow_id.
{
  const root = freshRoot("engine-env");
  const prevRoot = process.env.AIDAKIT_PROJECT_ROOT;
  process.env.AIDAKIT_PROJECT_ROOT = root;

  const { startFlow } = await import("../engine/engine.js");
  const { loadFlow } = await import("../engine/parser.js");

  const flowsUser = join(root, ".aidakit", "flows");
  mkdirSync(flowsUser, { recursive: true });
  writeFileSync(join(flowsUser, "echoflowid.yaml"), `flow: echoflowid
description: echoes AIDAKIT_FLOW_ID to prove the runs child env carries it
version: 1
steps:
  - id: echo
    type: runs
    command: "echo -n \\"$AIDAKIT_FLOW_ID\\""
    on_success: end
  - id: end
    type: terminal
    outcome: completed
`);
  const { flow, errors } = loadFlow("echoflowid");
  eq(errors, [], "2-env: echoflowid flow parses without error");
  const res = startFlow({ flow, inputs: {}, startedBy: "test", idOpts: { rand: "envtest1", now: new Date("2026-07-24T00:00:00Z") } });
  eq(res.state.status, "completed", "2-env: flow completes");
  const echoStep = res.state.step_history.find((h) => h.step_id === "echo");
  eq(echoStep.output.stdout, res.state.flow_id, "2-env: runs step's $AIDAKIT_FLOW_ID equals the flow's own flow_id");

  process.env.AIDAKIT_PROJECT_ROOT = prevRoot;
  rmSync(root, { recursive: true, force: true });
}

// ── §2a-2c — Resume-output extension on invoke steps: outputs: {revise: [cause]} ──
// Compat guard: invoke.js's outputs leash is already generic (ADR-006 §2). No
// new parser/engine change is expected here — proof of leverage, not new code.
{
  const root = freshRoot("outputs-leash");
  const prevRoot = process.env.AIDAKIT_PROJECT_ROOT;
  process.env.AIDAKIT_PROJECT_ROOT = root;

  const { startFlow, resumeFlow } = await import("../engine/engine.js");
  const { loadFlow } = await import("../engine/parser.js");
  const { loadState } = await import("../engine/persistence.js");

  const flowsUser = join(root, ".aidakit", "flows");
  mkdirSync(flowsUser, { recursive: true });
  writeFileSync(join(flowsUser, "criticlike.yaml"), `flow: criticlike
description: minimal critic-like invoke step declaring outputs on its revise outcome
version: 1
steps:
  - id: critic
    type: invoke
    invoke_target: aidakit:spec-reviewer
    expects:
      - ok
      - revise
    outputs:
      revise:
        - cause
    on_result:
      ok: end
      revise: end
  - id: end
    type: terminal
    outcome: completed
`);

  // (2a) loadFlow accepts the outputs: {revise: [cause]} shape.
  const { flow, errors } = loadFlow("criticlike");
  eq(errors, [], "2a: outputs: {revise: [cause]} shape accepted by loadFlow (no new parser change)");
  eq(flow.steps[0].outputs, { revise: ["cause"] }, "2a: parsed outputs map preserved verbatim");

  // (2b) resume with "revise" alone (no cause=) → re-pauses at the SAME step,
  // the pause prompt names "cause".
  let res = startFlow({ flow, inputs: {}, startedBy: "test", idOpts: { rand: "leash2b", now: new Date("2026-07-24T00:00:00Z") } });
  eq(res.state.pause.step_id, "critic", "2b: starts paused at critic");
  res = resumeFlow({ state: loadState(res.state.flow_id), flow, resumeValue: "revise" });
  eq(res.state.status, "paused", "2b: resume 'revise' alone re-pauses (doesn't destroy the run)");
  eq(res.state.pause.step_id, "critic", "2b: re-pauses at the SAME step");
  ok(res.state.pause.prompt.includes("cause"), "2b: re-pause prompt names the missing 'cause' output");

  // (2c) resume with "revise cause=critic-reject" → context.critic.cause set,
  // outcome set, the flow proceeds.
  res = resumeFlow({ state: loadState(res.state.flow_id), flow, resumeValue: "revise", resumeOutput: { cause: "critic-reject" } });
  eq(res.state.context.critic.cause, "critic-reject", "2c: context.critic.cause === 'critic-reject'");
  eq(res.state.context.critic.outcome, "revise", "2c: context.critic.outcome === 'revise'");
  eq(res.state.status, "completed", "2c: the flow proceeds (reaches the terminal)");

  process.env.AIDAKIT_PROJECT_ROOT = prevRoot;
  rmSync(root, { recursive: true, force: true });
}

// ── §3 — full.yaml schema: record_*_cause wiring + retry_history_path inputs ──
{
  const { loadFlow } = await import("../engine/parser.js");
  const { flow, errors } = loadFlow("full");
  eq(errors, [], "3: full.yaml still parses without error");
  const byId = Object.fromEntries(flow.steps.map((s) => [s.id, s]));

  // (3a) retry_history_path wired into specify/implement/learn's input.
  const RH_PATH = "docs/features/${context.select.change_id}/retry-history.json";
  eq(byId.specify.input?.retry_history_path, RH_PATH, "3a: specify.input.retry_history_path");
  eq(byId.implement.input?.retry_history_path, RH_PATH, "3a: implement.input.retry_history_path");
  eq(byId.learn.input?.retry_history_path, RH_PATH, "3a: learn.input.retry_history_path");

  // (3b) critic/readiness declare outputs on their retry-triggering outcome.
  eq(byId.critic.outputs, { revise: ["cause"] }, "3b: critic.outputs === {revise: [cause]}");
  eq(byId.readiness.outputs, { "needs-revision": ["cause"] }, "3b: readiness.outputs === {needs-revision: [cause]}");

  // (3c) the five record_*_cause steps exist as `runs`, on_success === on_failure === retry target.
  const recordSteps = {
    record_critic_cause: "specify",
    record_readiness_cause: "specify",
    record_check_implement_cause: "implement",
    record_bench_outcome_cause: "implement",
    record_hardening_cause: "implement",
  };
  for (const [id, target] of Object.entries(recordSteps)) {
    const s = byId[id];
    ok(s, `3c: ${id} exists`);
    ok(s && s.type === "runs", `3c: ${id} is type: runs`);
    ok(s && s.on_success === target && s.on_failure === target, `3c: ${id}.on_success === on_failure === ${target}`);
  }

  // (3d) back-edges wire THROUGH the new record steps; no leftover direct back-edge.
  eq(byId.critic.on_result.revise, "record_critic_cause", "3d: critic.on_result.revise -> record_critic_cause");
  eq(byId.readiness.on_result["needs-revision"], "record_readiness_cause", "3d: readiness.on_result.needs-revision -> record_readiness_cause");
  eq(byId.check_implement_bench.on_failure, "record_check_implement_cause", "3d: check_implement_bench.on_failure -> record_check_implement_cause");
  eq(byId.bench_outcome.on_failure, "record_bench_outcome_cause", "3d: bench_outcome.on_failure -> record_bench_outcome_cause");
  eq(byId.hardening.on_failure, "record_hardening_cause", "3d: hardening.on_failure -> record_hardening_cause");
  ok(byId.critic.on_result.revise !== "specify", "3d: no leftover direct critic.revise -> specify back-edge");
  ok(byId.readiness.on_result["needs-revision"] !== "specify", "3d: no leftover direct readiness.needs-revision -> specify back-edge");
  ok(byId.check_implement_bench.on_failure !== "implement", "3d: no leftover direct check_implement_bench.on_failure -> implement back-edge");
  ok(byId.bench_outcome.on_failure !== "implement", "3d: no leftover direct bench_outcome.on_failure -> implement back-edge");
  ok(byId.hardening.on_failure !== "implement", "3d: no leftover direct hardening.on_failure -> implement back-edge");
}

// ── §4 — End-to-end drive of the full flow's retry-memory wiring ──

function selectAnswer(changeId) {
  return { outcome: "success", output: { change_id: changeId } };
}

// (4a, 4b) One flow instance: round-1 critic=revise writes the record and
// re-enters specify; round-2 critic=ok leaves the file unchanged; the drive
// continues through implement/review/hardening to learn, where the injected
// retry_history_path is asserted and the correction-event bridge is simulated.
{
  const root = freshRoot("e2e");
  const prevRoot = process.env.AIDAKIT_PROJECT_ROOT;
  process.env.AIDAKIT_PROJECT_ROOT = root;

  const { startFlow, resumeFlow } = await import("../engine/engine.js");
  const { loadFlow } = await import("../engine/parser.js");
  const { loadState } = await import("../engine/persistence.js");
  const { recordError, deriveCandidates } = await import("../ledgers/ledger.js");

  const changeId = "retry-memory-e2e";
  const rhPath = join(root, "docs", "features", changeId, "retry-history.json");

  function manifestPathFor(id) { return join(root, ".aidakit", "tasks", id, "doc-manifest.json"); }
  function seedSatisfiedManifest(id) {
    const p = manifestPathFor(id);
    mkdirSync(join(p, ".."), { recursive: true });
    writeFileSync(p, JSON.stringify({ change_id: id, level: "change", required: [] }));
  }
  function benchPathFor(id) { return join(root, ".aidakit", "tasks", id, "bench.ndjson"); }
  function seedSatisfiedBench(id) {
    const p = benchPathFor(id);
    mkdirSync(join(p, ".."), { recursive: true });
    const lines = [
      { bench: "review", round: 1, role: "__manifest__", roles: ["adr-reviewer", "spec-reviewer"], at: "2026-07-24T00:00:00.000Z" },
      { bench: "review", round: 1, role: "adr-reviewer", verdict: "pass", dispatched_at: "2026-07-24T00:00:01.000Z", returned_at: "2026-07-24T00:00:05.000Z" },
      { bench: "review", round: 1, role: "spec-reviewer", verdict: "pass", dispatched_at: "2026-07-24T00:00:02.000Z", returned_at: "2026-07-24T00:00:06.000Z" },
    ];
    appendFileSync(p, lines.map((l) => JSON.stringify(l)).join("\n") + "\n");
  }

  seedSatisfiedManifest(changeId);
  const { flow } = loadFlow("full");
  let res = startFlow({ flow, inputs: { request: "retry-memory e2e test" }, startedBy: "test", idOpts: { rand: "e2e0001", now: new Date("2026-07-24T00:00:00Z") } });
  function resumeWith(answer) {
    const resumeValue = typeof answer === "string" ? answer : answer.outcome;
    const resumeOutput = typeof answer === "string" ? undefined : answer.output;
    res = resumeFlow({ state: loadState(res.state.flow_id), flow, resumeValue, resumeOutput });
  }

  eq(res.state.pause.step_id, "select", "4a: starts paused at select");
  resumeWith(selectAnswer(changeId));
  eq(res.state.pause.step_id, "classify", "4a: select -> classify");
  resumeWith("success");
  eq(res.state.pause.step_id, "brainstorm", "4a: classify -> brainstorm");
  resumeWith("done");
  eq(res.state.pause.step_id, "specify", "4a: brainstorm -> specify (round 1)");
  resumeWith("success");
  // commit_plan is `runs` (auto, best-effort) — falls straight through to critic.
  eq(res.state.pause.step_id, "critic", "4a: specify(success) -> commit_plan(runs) -> critic");

  // ROUND 1: critic revises with cause=critic-reject.
  resumeWith({ outcome: "revise", output: { cause: "critic-reject" } });
  eq(res.state.pause.step_id, "specify", "4a: critic(revise) -> record_critic_cause(runs) -> specify (round 2)");
  ok(res.state.step_history.some((h) => h.step_id === "record_critic_cause"), "4a: record_critic_cause ran (in step_history)");
  ok(existsSync(rhPath), "4a: retry-history.json created on disk");
  eq(JSON.parse(readFileSync(rhPath, "utf8")), [{ round: 1, step_id: "specify", cause: "critic-reject" }],
    "4a: retry-history.json = [{round: 1, step_id: specify, cause: critic-reject}]");

  // ROUND 2: specify succeeds again, critic now says ok — no bookkeeping on success.
  resumeWith("success");
  eq(res.state.pause.step_id, "critic", "4a: specify(success, round 2) -> commit_plan(runs) -> critic");
  resumeWith("ok");
  eq(res.state.pause.step_id, "pre_apply", "4a: critic(ok) -> pre_apply");
  eq(JSON.parse(readFileSync(rhPath, "utf8")), [{ round: 1, step_id: "specify", cause: "critic-reject" }],
    "4a: retry-history.json UNCHANGED after a critic=ok round (no bookkeeping on success)");

  // (4b) Continue through readiness/implement/review/hardening to learn.
  resumeWith("yes");
  eq(res.state.pause.step_id, "readiness", "4b: pre_apply(yes) -> readiness");
  resumeWith("approved");
  eq(res.state.pause.step_id, "implement", "4b: readiness(approved) -> implement");
  resumeWith("success");
  // check_implement_bench: no bench.ndjson with an "implement" record for this
  // change yet (single-surface change) — the leash SKIPS (exit 0) straight to review_bench.
  eq(res.state.pause.step_id, "review_bench", "4b: implement(success) -> check_implement_bench(skip) -> review_bench");
  seedSatisfiedBench(changeId);
  resumeWith("consensus");
  eq(res.state.pause.step_id, "hardening", "4b: review_bench(consensus) -> check_review_bench(runs, ok) -> bench_outcome(runs, ok) -> hardening");
  resumeWith("success");
  eq(res.state.pause.step_id, "learn", "4b: hardening(success) -> learn");

  const expectedRhPath = `docs/features/${changeId}/retry-history.json`;
  eq(res.state.pause.input.retry_history_path, expectedRhPath, "4b: learn's pause.input.retry_history_path resolves to the change's retry-history.json");

  // Simulate the skill's translation of the retry-history record into the
  // correction-event bridge (design.md §Interop with aidakit:learn): a
  // `{kind:"correction", errorType:"retry-cause", key:<cause>, phase:<step_id>}`
  // line in events.ndjson (the human-readable correction stream, SKILL.md §1)
  // AND a matching recordError call (the SAME errorType/key/phase pair) so
  // deriveCandidates — which groups by errorType+key with NO ledger changes —
  // picks the recurrence up organically.
  const eventsPath = join(root, ".aidakit", "tasks", changeId, "events.ndjson");
  mkdirSync(join(eventsPath, ".."), { recursive: true });
  appendFileSync(eventsPath, JSON.stringify({ kind: "correction", errorType: "retry-cause", key: "critic-reject", phase: "specify", at: "2026-07-24T00:10:00.000Z" }) + "\n");
  recordError(changeId, { errorType: "retry-cause", key: "critic-reject", phase: "specify" });

  const candidates = deriveCandidates(changeId, { threshold: 1 });
  ok(candidates.some((c) => c.errorType === "retry-cause" && c.key === "critic-reject"),
    "4b: deriveCandidates picks up the retry-cause/critic-reject grouping with no ledger changes");

  process.env.AIDAKIT_PROJECT_ROOT = prevRoot;
  rmSync(root, { recursive: true, force: true });
}

// (4c) Exhaust the specify loop: three consecutive critic=revise rounds hit
// max_visits=3 and escalate; retry-history.json accumulates all 3 records;
// the escalation semantic (abort) is unchanged.
{
  const root = freshRoot("e2e-cap");
  const prevRoot = process.env.AIDAKIT_PROJECT_ROOT;
  process.env.AIDAKIT_PROJECT_ROOT = root;

  const { startFlow, resumeFlow } = await import("../engine/engine.js");
  const { loadFlow } = await import("../engine/parser.js");
  const { loadState } = await import("../engine/persistence.js");

  const changeId = "retry-memory-e2e-cap";
  const rhPath = join(root, "docs", "features", changeId, "retry-history.json");

  const { flow } = loadFlow("full");
  let res = startFlow({ flow, inputs: { request: "retry-memory e2e cap test" }, startedBy: "test", idOpts: { rand: "e2ecap01", now: new Date("2026-07-24T00:00:00Z") } });
  const visited = [];
  for (let i = 0; i < 30 && res.state.status === "paused"; i++) {
    const p = res.state.pause;
    visited.push(p.step_id);
    let answer;
    switch (p.step_id) {
      case "select": answer = selectAnswer(changeId); break;
      case "classify": answer = "success"; break;
      case "brainstorm": answer = "done"; break;
      case "specify": answer = "success"; break;
      case "critic": answer = { outcome: "revise", output: { cause: "critic-reject" } }; break;
      case "specify_escalation": answer = "abort"; break;
      default: throw new Error(`4c: unexpected pause "${p.step_id}"`);
    }
    const resumeValue = typeof answer === "string" ? answer : answer.outcome;
    const resumeOutput = typeof answer === "string" ? undefined : answer.output;
    res = resumeFlow({ state: loadState(res.state.flow_id), flow, resumeValue, resumeOutput });
  }
  ok(visited.includes("specify_escalation"), "4c: reaches specify_escalation after 3 revise rounds");
  eq(res.state.status, "aborted", "4c: specify_escalation -> abort terminates the flow (escalation semantic unchanged)");
  eq(JSON.parse(readFileSync(rhPath, "utf8")), [
    { round: 1, step_id: "specify", cause: "critic-reject" },
    { round: 2, step_id: "specify", cause: "critic-reject" },
    { round: 3, step_id: "specify", cause: "critic-reject" },
  ], "4c: retry-history.json has 3 records, round 1..3, before max_visits escalates");

  process.env.AIDAKIT_PROJECT_ROOT = prevRoot;
  rmSync(root, { recursive: true, force: true });
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
