// Table test for the flows engine (pure Node, no framework).
// Proves: parse+validation of the real flows, execution order, pause/resume with
// persisted state, routing via on_result, and loop with max/until.

import { mkdtempSync, rmSync, existsSync, symlinkSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// State goes into an isolated temporary project.
const tmp = mkdtempSync(join(tmpdir(), "aidakit-engine-"));
process.env.AIDAKIT_PROJECT_ROOT = tmp;

// THE DOC-LEASH: the flows' `check_docs` step is a `runs` that fires
//   node governance/validators/check-doc-manifest.js .aidakit/tasks/<request>/doc-manifest.json
// with cwd = project root (the isolated tmp). For the gate to actually run in the
// test, the validator must be reachable from tmp and the change's manifest must
// exist. We link the real governance into tmp and expose a helper that seeds
// (or removes) the manifest per change.
const govReal = resolve(new URL(".", import.meta.url).pathname, "..");
symlinkSync(govReal, join(tmp, "governance"), "dir");

function manifestPathFor(request) {
  return join(tmp, ".aidakit", "tasks", request, "doc-manifest.json");
}
// Seeds a SATISFIED manifest (empty required ⇒ 0/0 resolved ⇒ exit 0):
// models the leash already closed, so the gate releases and the flow proceeds to the PR.
function seedSatisfiedManifest(request) {
  const p = manifestPathFor(request);
  mkdirSync(join(p, ".."), { recursive: true });
  writeFileSync(p, JSON.stringify({ change_id: request, level: "change", required: [] }));
}

const { startFlow, resumeFlow } = await import("../engine/engine.js");
const { loadFlow, parseFlowFile, listFlowNames } = await import("../engine/parser.js");
const { loadState } = await import("../engine/persistence.js");

let pass = 0, fail = 0;
function ok(cond, name) { if (cond) pass++; else { fail++; console.log(`FAIL ${name}`); } }
function eq(a, b, name) { const r = JSON.stringify(a) === JSON.stringify(b); if (!r) console.log(`  ${name}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); ok(r, name); }

const here = new URL(".", import.meta.url).pathname;
const flowsDir = join(here, "..", "flows");

// ── 1. Both real flows parse and validate ──────────────────
for (const name of ["fast", "full"]) {
  const res = parseFlowFile(join(flowsDir, `${name}.yaml`));
  eq(res.errors, [], `flow ${name} with no parse/validation errors`);
  ok(res.flow && res.flow.flow === name, `flow ${name} loaded with correct name`);
  ok(res.flow && Array.isArray(res.flow.steps) && res.flow.steps.length > 0, `flow ${name} has steps`);
}
ok(listFlowNames().includes("fast") && listFlowNames().includes("full"), "listFlowNames finds both");

// ── 2. Run the "fast" flow dry, resolving each pause ───────
// Driver: while paused, injects the expected outcome and resumes. `answers` maps
// step_id → outcome, OR step_id → list of outcomes (consumed in order, for
// steps revisited in a correction loop).
function driveDry(flowName, inputs, answers) {
  const { flow } = loadFlow(flowName);
  let res = startFlow({ flow, inputs, startedBy: "test", idOpts: { rand: "test01", now: new Date("2026-07-17T00:00:00Z") } });
  const visited = [];
  const cursors = {};
  let guard = 0;
  while (res.state.status === "paused" && guard++ < 50) {
    const p = res.state.pause;
    visited.push(p.step_id);
    let answer = answers[p.step_id];
    if (Array.isArray(answer)) {
      const idx = cursors[p.step_id] ?? 0;
      cursors[p.step_id] = idx + 1;
      answer = answer[Math.min(idx, answer.length - 1)];
    }
    if (answer === undefined) throw new Error(`no answer for pause "${p.step_id}"`);
    res = resumeFlow({ state: loadState(res.state.flow_id), flow, resumeValue: answer });
  }
  return { res, visited };
}

// Happy path of fast: select→plan→readiness(approved)→implement→review(pass)
//   →document→[check_docs=runs, exit 0]→pr→merge(merged)→done
// The leash sits between review and pr: `document` (invoke, PAUSES — appears in
// visited) builds the manifest; `check_docs` (runs, does NOT pause — doesn't appear in
// visited) checks and releases the gate. We seed the satisfied manifest first.
// The `request` here is the change-id (slug) that `select`/orchestrator already resolved —
// the leash gate uses ${inputs.request} in the manifest path.
{
  seedSatisfiedManifest("cancel-appointment");
  const { res, visited } = driveDry("fast", { request: "cancel-appointment" }, {
    select: "success",
    plan: "success",
    readiness: "approved",
    implement: "success",
    review: "pass",
    document: "success",
    pr: "success",
    merge: "merged",
  });
  eq(visited, ["select", "plan", "readiness", "implement", "review", "document", "pr", "merge"], "fast: pause order (happy path, with the leash)");
  eq(res.state.status, "completed", "fast: final status completed");
  eq(res.state.outcome, "completed", "fast: outcome completed");
}

// Satisfied manifest for the "x" changes that proceed to the leash gate.
seedSatisfiedManifest("x");

// Rejection path: review(fail) goes back to implement (correction loop)
{
  const { res, visited } = driveDry("fast", { request: "x" }, {
    select: "success", plan: "success", readiness: "approved",
    implement: ["success", "success"], // revisited after the review fail
    review: ["fail", "pass"], // 1st time fails → back to implement; 2nd passes
    document: "success", // review pass → document → check_docs (exit 0) → pr
    pr: "success", merge: "merged",
  });
  // The sequence must re-enter implement after the review fail.
  const idxReview = visited.indexOf("review");
  eq(visited[idxReview + 1], "implement", "fast: review fail re-enters implement");
  eq(res.state.status, "completed", "fast: recovers and completes after correction");
}

// Human gate discard → aborts
{
  const { res } = driveDry("fast", { request: "x" }, {
    select: "success", plan: "success", readiness: "approved", implement: "success", review: "pass",
    document: "success", pr: "success",
    merge: "discard",
  });
  eq(res.state.status, "aborted", "fast: merge=discard aborts");
}

// readiness=blocked → aborts early
{
  const { res, visited } = driveDry("fast", { request: "x" }, {
    select: "success", plan: "success", readiness: "blocked",
  });
  eq(visited, ["select", "plan", "readiness"], "fast: stops at readiness when blocked");
  eq(res.state.status, "aborted", "fast: blocked aborts");
}

// ── 2b. THE DOC-LEASH: the check_docs gate holds the flow until the list closes ──
// Proves the heart of the leash: while the manifest is NOT 100%, check_docs
// (runs, exit≠0) routes back to `document` — the flow does NOT reach the PR. Only
// when the list closes (satisfied manifest on disk) does the gate release and proceed.
{
  const request = "leash-loop";
  // No manifest on disk: the gate is LOCKED.
  rmSync(manifestPathFor(request), { force: true });
  const { flow } = loadFlow("fast");
  let res = startFlow({ flow, inputs: { request }, startedBy: "test", idOpts: { rand: "leash1", now: new Date("2026-07-17T00:00:00Z") } });
  const visited = [];
  let documentVisits = 0;
  let guard = 0;
  while (res.state.status === "paused" && guard++ < 50) {
    const p = res.state.pause;
    visited.push(p.step_id);
    let answer;
    switch (p.step_id) {
      case "select": case "plan": case "implement": answer = "success"; break;
      case "readiness": answer = "approved"; break;
      case "review": answer = "pass"; break;
      case "document":
        documentVisits++;
        // On the 3rd pass through `document`, the list finally closes (the workstreams
        // filled in the docs): seed the satisfied manifest BEFORE resuming,
        // so the following check_docs exits with exit 0 and the gate opens.
        if (documentVisits === 3) seedSatisfiedManifest(request);
        answer = "success";
        break;
      case "pr": answer = "success"; break;
      case "merge": answer = "merged"; break;
      default: throw new Error(`unexpected pause "${p.step_id}"`);
    }
    res = resumeFlow({ state: loadState(res.state.flow_id), flow, resumeValue: answer });
  }
  // While the list was incomplete, the flow re-entered `document` (the locked
  // gate handed control back) — exactly 3 visits before it closed.
  eq(documentVisits, 3, "leash: check_docs returns to document until the list closes (3 rounds)");
  // No `pr` pause occurred before the 3rd visit to `document`.
  ok(visited.indexOf("pr") > visited.lastIndexOf("document"), "leash: only reaches pr AFTER the gate releases");
  eq(res.state.status, "completed", "leash: gate released → flow completes through the merge");
}

// ── 2c. Leash in the full flow: learn → document → check_docs → pr ──
// The full inserts the same trio between `learn` and `pr`. Happy path with the
// satisfied manifest: the pause order now includes `document`.
{
  const request = "full-doc";
  seedSatisfiedManifest(request);
  const { res, visited } = driveDry("full", { request }, {
    select: "success",
    classify: "success",
    brainstorm: "done",
    specify: "success",
    critic: "ok",
    pre_apply: "yes",
    readiness: "approved",
    implement: "success",
    review_bench: "consensus",
    hardening: "success",
    learn: "success",
    document: "success",
    pr: "success",
    merge: "merged",
  });
  eq(visited,
    ["select", "classify", "brainstorm", "specify", "critic", "pre_apply", "readiness", "implement", "review_bench", "hardening", "learn", "document", "pr", "merge"],
    "full: pause order with the leash (document between learn and pr)");
  eq(res.state.status, "completed", "full: final status completed");
  eq(res.state.outcome, "completed", "full: outcome completed");
}

// ── 3. Pause/resume with persisted state survives (end of session) ──
{
  const { flow } = loadFlow("fast");
  const r1 = startFlow({ flow, inputs: { request: "persist" }, startedBy: "test", idOpts: { rand: "persist1", now: new Date("2026-07-17T00:00:00Z") } });
  const fid = r1.state.flow_id;
  ok(r1.state.status === "paused" && r1.state.pause.step_id === "select", "persist: pauses at the first agent");
  ok(existsSync(join(tmp, ".aidakit", "flows", "state", `${fid}.json`)), "persist: state written to disk");
  // Simulates a new session: reloads from disk and resumes.
  const reloaded = loadState(fid);
  eq(reloaded.flow_id, fid, "persist: reloads the same flow_id");
  const r2 = resumeFlow({ state: reloaded, flow, resumeValue: "success" });
  eq(r2.state.pause.step_id, "plan", "persist: resume advances to plan");
  eq(r2.state.step_history.length >= 2, true, "persist: history accumulates across sessions");
}

// ── 4. Loop with max/until (synthetic flow on temporary disk) ──
{
  const { writeFileSync, mkdirSync } = await import("node:fs");
  const flowsUser = join(tmp, ".aidakit", "flows");
  mkdirSync(flowsUser, { recursive: true });
  // Loop over a list of 5, but max=2 → only 2 iterations.
  // Loop over a list of 5, but max=2. Body is a trivial `runs` (echo) that
  // routes on success and falls into the next iteration (empty on_success = fallthrough).
  writeFileSync(join(flowsUser, "loopmax.yaml"), `flow: loopmax
description: loop with a ceiling test
version: 1
inputs:
  - name: items
    type: array<string>
    default:
      - a
      - b
      - c
      - d
      - e
steps:
  - id: loop1
    type: loop
    over: inputs.items
    as: x
    max: 2
    body:
      - id: step
        type: runs
        command: "true"
        on_success: ""
    on_success: end
  - id: end
    type: terminal
    outcome: completed
    message: "loop finished"
`);
  const { flow, errors } = loadFlow("loopmax");
  eq(errors, [], "loopmax: parses without error");
  const res = startFlow({ flow, inputs: {}, startedBy: "test", idOpts: { rand: "loop1", now: new Date("2026-07-17T00:00:00Z") } });
  eq(res.state.status, "completed", "loopmax: completes (doesn't run infinitely)");
  // The body step must have run exactly max=2 times (not 5).
  const bodyRuns = res.state.step_history.filter((h) => h.step_id === "step").length;
  eq(bodyRuns, 2, "loopmax: body ran exactly max=2 times (not the 5 items)");
  ok(res.state.context.__loops === undefined || Object.keys(res.state.context.__loops).length === 0, "loopmax: loop frame cleared on finish");
}

// ── 5. Regressions of bugs found in adversarial verification ──

// (5a) Resume with an invalid value at a gate RE-PAUSES (doesn't destroy the run).
{
  seedSatisfiedManifest("regression"); // leash gate released along the path
  const { flow } = loadFlow("fast");
  let res = startFlow({ flow, inputs: { request: "regression" }, startedBy: "test", idOpts: { rand: "reg5a", now: new Date("2026-07-17T00:00:00Z") } });
  // Advances to the merge gate. Pauses up to there: select, plan, readiness, implement,
  // review, document, pr (check_docs is `runs`, runs inline without pausing).
  for (const v of ["success", "success", "approved", "success", "pass", "success", "success"]) {
    res = resumeFlow({ state: loadState(res.state.flow_id), flow, resumeValue: v });
  }
  eq(res.state.pause && res.state.pause.step_id, "merge", "5a: reached the merge gate");
  // Typo: "merge" instead of "merged" — should RE-PAUSE, not fail.
  res = resumeFlow({ state: loadState(res.state.flow_id), flow, resumeValue: "merge" });
  eq(res.state.status, "paused", "5a: invalid value re-pauses (doesn't fail)");
  eq(res.state.pause.step_id, "merge", "5a: stays at the same gate");
  // Recovers with the correct value.
  res = resumeFlow({ state: loadState(res.state.flow_id), flow, resumeValue: "merged" });
  eq(res.state.status, "completed", "5a: recovers with a valid value");
}

// (5b) A nonexistent routing target is caught at LOAD.
{
  const { writeFileSync, mkdirSync } = await import("node:fs");
  const flowsUser = join(tmp, ".aidakit", "flows");
  mkdirSync(flowsUser, { recursive: true });
  writeFileSync(join(flowsUser, "broken.yaml"), `flow: broken
description: nonexistent target
steps:
  - id: a
    type: terminal
    on_success: DOES_NOT_EXIST
`);
  const { errors } = loadFlow("broken");
  ok(errors.length > 0, "5b: flow with a nonexistent target is REJECTED at load");
  ok(errors.some((e) => e.message.includes("DOES_NOT_EXIST")), "5b: error names the invalid target");
}

// (5c) '#' in an unquoted value is preserved (not truncated as a comment).
{
  const { parse } = await import("../engine/yaml-min.js");
  eq(parse("prompt: fix the bug #42 now"), { prompt: "fix the bug #42 now" }, "5c: # in value preserved");
  eq(parse("title: use ## heading"), { title: "use ## heading" }, "5c: ## in value preserved");
}

// ── 6. invoke/invoke_target: new format AND backward-compat of legacy 'agent'/'invoca' ──
{
  const { writeFileSync, mkdirSync } = await import("node:fs");
  const flowsUser = join(tmp, ".aidakit", "flows");
  mkdirSync(flowsUser, { recursive: true });

  // (6a) NEW format: type: invoke + invoke_target: — should pause with step_type "invoke".
  writeFileSync(join(flowsUser, "new-format.yaml"), `flow: new-format
description: new invoke format
steps:
  - id: step1
    type: invoke
    invoke_target: aidakit:plan
    expects:
      - success
    on_success: end
  - id: end
    type: terminal
    outcome: completed
`);
  const rNew = loadFlow("new-format");
  eq(rNew.errors, [], "6a: flow with type:invoke/invoke_target loads without error");
  const res6a = startFlow({ flow: rNew.flow, inputs: {}, startedBy: "test", idOpts: { rand: "inv6a", now: new Date("2026-07-17T00:00:00Z") } });
  eq(res6a.state.status, "paused", "6a: pauses at the invoke step");
  eq(res6a.state.pause.step_type, "invoke", "6a: step_type is 'invoke'");
  eq(res6a.state.pause.invoke_target, "aidakit:plan", "6a: pause.invoke_target names the skill/agent");

  // (6b) BACKWARD-COMPAT: type: agent + agent: (legacy) — parser normalizes to invoke.
  writeFileSync(join(flowsUser, "legacy.yaml"), `flow: legacy
description: legacy agent format
steps:
  - id: p1
    type: agent
    agent: aidakit:review
    expects:
      - pass
    on_result:
      pass: end
  - id: end
    type: terminal
    outcome: completed
`);
  const rLeg = loadFlow("legacy");
  eq(rLeg.errors, [], "6b: legacy flow (type:agent) loads without error");
  ok(rLeg.flow.steps[0].type === "invoke", "6b: parser normalized type agent→invoke");
  ok(rLeg.flow.steps[0].invoke_target === "aidakit:review" && rLeg.flow.steps[0].agent === undefined, "6b: agent→invoke_target field");
  const res6b = startFlow({ flow: rLeg.flow, inputs: {}, startedBy: "test", idOpts: { rand: "inv6b", now: new Date("2026-07-17T00:00:00Z") } });
  eq(res6b.state.pause.step_type, "invoke", "6b: legacy flow pauses as 'invoke'");

  // (6c) BACKWARD-COMPAT: type: invoke + invoca: (legacy field name) — parser normalizes to invoke_target.
  writeFileSync(join(flowsUser, "legacy-invoca.yaml"), `flow: legacy-invoca
description: legacy invoca field
steps:
  - id: p1
    type: invoke
    invoca: aidakit:review
    expects:
      - pass
    on_result:
      pass: end
  - id: end
    type: terminal
    outcome: completed
`);
  const rLegInvoca = loadFlow("legacy-invoca");
  eq(rLegInvoca.errors, [], "6c: legacy flow (invoca:) loads without error");
  ok(rLegInvoca.flow.steps[0].invoke_target === "aidakit:review" && rLegInvoca.flow.steps[0].invoca === undefined, "6c: invoca→invoke_target field");
}

console.log(`\n${pass} passed, ${fail} failed`);
rmSync(tmp, { recursive: true, force: true });
process.exit(fail ? 1 : 0);
