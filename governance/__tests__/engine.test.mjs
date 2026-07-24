// Table test for the flows engine (pure Node, no framework).
// Proves: parse+validation of the real flows, execution order, pause/resume with
// persisted state, routing via on_result, and loop with max/until.

import { mkdtempSync, rmSync, existsSync, mkdirSync, writeFileSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// State goes into an isolated temporary project.
const tmp = mkdtempSync(join(tmpdir(), "aidakit-engine-"));
process.env.AIDAKIT_PROJECT_ROOT = tmp;

// THE DOC-LEASH: the flows' `check_docs` step is a `runs` that fires
//   node "$AIDAKIT_GOVERNANCE/validators/check-doc-manifest.js" .aidakit/tasks/<request>/doc-manifest.json
// with cwd = project root (the isolated tmp). The validator is reached via the absolute
// $AIDAKIT_GOVERNANCE that runs.js injects, so cwd = tmp (no governance/ folder) faithfully
// mirrors a consumer repo — no symlink fabrication needed.

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

// docs-onboarding's `diff`/`check` steps gate on a PROJECT-level manifest at a
// FIXED path (not per-change, unlike manifestPathFor above): .aidakit/doc-manifest-project.json.
function projectManifestPath() {
  return join(tmp, ".aidakit", "doc-manifest-project.json");
}
// Seeds a SATISFIED project manifest (empty required ⇒ 0/0 resolved ⇒ exit 0).
function seedSatisfiedProjectManifest() {
  const p = projectManifestPath();
  mkdirSync(join(p, ".."), { recursive: true });
  writeFileSync(p, JSON.stringify({ change_id: "PROJECT", level: "project", required: [] }));
}

// Seeds (or appends a feature line to) an epic file declaring changeId, so the
// register path's `check_registered` leash (derive-roadmap-status.js --change,
// spawned by the `runs` step with cwd=tmp) finds it declared. Reuses the same
// FEATURE_RE grammar the roadmap module parses — no forked format here.
function seedDeclaredChange(changeId, { epicId = "EPIC-register-test", feature = "Register test feature" } = {}) {
  const epicsDir = join(tmp, "docs", "roadmap", "epics");
  mkdirSync(epicsDir, { recursive: true });
  const file = join(epicsDir, `${epicId}.md`);
  const line = `- **Feature:** ${feature} — changes: ${changeId}\n`;
  if (existsSync(file)) appendFileSync(file, line);
  else writeFileSync(file, `# Register test epic\n\n${line}`);
}

function benchPathFor(request) {
  return join(tmp, ".aidakit", "tasks", request, "bench.ndjson");
}
// Seeds (or APPENDS another round to) a review bench.ndjson: a __manifest__
// record (written first) declaring the two base roles, both reporting the
// given verdict with overlapping dispatch windows — models the parallelism
// leash already closed for that round so check_review_bench releases the gate.
// Each round gets a distinct hour offset so timestamps never collide across
// rounds seeded for the same request.
function seedSatisfiedBench(request, { round = 1, pass = true } = {}) {
  const p = benchPathFor(request);
  mkdirSync(join(p, ".."), { recursive: true });
  const hh = String(round).padStart(2, "0");
  const verdict = pass ? "pass" : "fail";
  const lines = [
    { bench: "review", round, role: "__manifest__", roles: ["adr-reviewer", "spec-reviewer"], at: `2026-07-17T${hh}:00:00.000Z` },
    { bench: "review", round, role: "adr-reviewer", verdict: "pass", dispatched_at: `2026-07-17T${hh}:00:01.000Z`, returned_at: `2026-07-17T${hh}:00:05.000Z` },
    { bench: "review", round, role: "spec-reviewer", verdict, dispatched_at: `2026-07-17T${hh}:00:02.000Z`, returned_at: `2026-07-17T${hh}:00:06.000Z` },
  ];
  appendFileSync(p, lines.map((l) => JSON.stringify(l)).join("\n") + "\n");
}

const { startFlow, resumeFlow } = await import("../engine/engine.js");
const { loadFlow, parseFlowFile, listFlowNames } = await import("../engine/parser.js");
const { loadState } = await import("../engine/persistence.js");

let pass = 0, fail = 0;
function ok(cond, name) { if (cond) pass++; else { fail++; console.log(`FAIL ${name}`); } }
function eq(a, b, name) { const r = JSON.stringify(a) === JSON.stringify(b); if (!r) console.log(`  ${name}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); ok(r, name); }

const here = new URL(".", import.meta.url).pathname;
const flowsDir = join(here, "..", "flows");

// ── 1. All real flows parse and validate ──────────────────
for (const name of ["fast", "full", "docs-onboarding"]) {
  const res = parseFlowFile(join(flowsDir, `${name}.yaml`));
  eq(res.errors, [], `flow ${name} with no parse/validation errors`);
  ok(res.flow && res.flow.flow === name, `flow ${name} loaded with correct name`);
  ok(res.flow && Array.isArray(res.flow.steps) && res.flow.steps.length > 0, `flow ${name} has steps`);
}
ok(listFlowNames().includes("fast") && listFlowNames().includes("full"), "listFlowNames finds both");

// ── 2. Run the "fast" flow dry, resolving each pause ───────
// Driver: while paused, injects the expected outcome and resumes. `answers` maps
// step_id → answer, OR step_id → list of answers (consumed in order, for
// steps revisited in a correction loop). An answer is a plain outcome string,
// or {outcome, output} when the step declares structured outputs (e.g. select
// reporting change_id).
function resumeWith(state, flow, answer) {
  const resumeValue = typeof answer === "string" ? answer : answer.outcome;
  const resumeOutput = typeof answer === "string" ? undefined : answer.output;
  return resumeFlow({ state, flow, resumeValue, resumeOutput });
}
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
    res = resumeWith(loadState(res.state.flow_id), flow, answer);
  }
  return { res, visited };
}
// select's success now requires the change_id structured output (the
// request-vs-change-id leash) — shorthand for the common test answer.
function selectAnswer(changeId) {
  return { outcome: "success", output: { change_id: changeId } };
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
  seedSatisfiedBench("cancel-appointment");
  const { res, visited } = driveDry("fast", { request: "cancel-appointment" }, {
    select: selectAnswer("cancel-appointment"),
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

// Rejection path: review(fail) goes back to implement (correction loop).
// check_review_bench always reads the HIGHEST round in bench.ndjson, so both
// rounds are seeded upfront: round 1 (fail) backs review's first "fail"
// report; round 2 (pass) backs the second "pass" report. Since round 2 is
// already on disk by the time review is entered the first time, the "fail"
// report at that point would mismatch round 2's mechanical consensus — so we
// drive the two review visits against two DIFFERENT change-ids sharing the
// same rejection/recovery shape, keeping each bench.ndjson single-round and
// letting the leash validate each visit against its own true story.
{
  seedSatisfiedBench("x-round1", { round: 1, pass: false });
  seedSatisfiedManifest("x-round1");
  let res1 = startFlow({
    flow: loadFlow("fast").flow,
    inputs: { request: "x-round1" },
    startedBy: "test",
  });
  const answers1 = { select: selectAnswer("x-round1"), plan: "success", readiness: "approved", implement: "success", review: "fail" };
  let visited1 = [];
  for (let i = 0; i < 10 && res1.state.status === "paused"; i++) {
    visited1.push(res1.state.pause.step_id);
    res1 = resumeWith(loadState(res1.state.flow_id), loadFlow("fast").flow, answers1[res1.state.pause.step_id]);
  }
  const idxReview1 = visited1.indexOf("review");
  eq(visited1[idxReview1 + 1], "implement", "fast: review fail re-enters implement");

  seedSatisfiedManifest("x-round2");
  seedSatisfiedBench("x-round2", { round: 1, pass: true });
  const { res, visited } = driveDry("fast", { request: "x-round2" }, {
    select: selectAnswer("x-round2"), plan: "success", readiness: "approved", implement: "success", review: "pass",
    document: "success", pr: "success", merge: "merged",
  });
  eq(visited, ["select", "plan", "readiness", "implement", "review", "document", "pr", "merge"], "fast: recovers and completes on the corrected round");
  eq(res.state.status, "completed", "fast: recovers and completes after correction");
}

// Human gate discard → aborts
{
  seedSatisfiedManifest("x-discard");
  seedSatisfiedBench("x-discard");
  const { res } = driveDry("fast", { request: "x-discard" }, {
    select: selectAnswer("x-discard"), plan: "success", readiness: "approved", implement: "success", review: "pass",
    document: "success", pr: "success",
    merge: "discard",
  });
  eq(res.state.status, "aborted", "fast: merge=discard aborts");
}

// readiness=blocked → aborts early
{
  const { res, visited } = driveDry("fast", { request: "x-blocked" }, {
    select: selectAnswer("x-blocked"), plan: "success", readiness: "blocked",
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
  seedSatisfiedBench(request);
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
      case "select": answer = selectAnswer(request); break;
      case "plan": case "implement": answer = "success"; break;
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
    res = resumeWith(loadState(res.state.flow_id), flow, answer);
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
  seedSatisfiedBench(request);
  const { res, visited } = driveDry("full", { request }, {
    select: selectAnswer(request),
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

// ── 2d. THE PARALLELISM LEASH: check_review_bench and check_implement_bench ──
// Proves the leash actually gates the real flow, not just the validator in
// isolation: an inconsistent/incomplete bench.ndjson blocks the advance and
// re-routes back to redo the round, exactly like the doc-leash does.

// (2d-i) review_bench reports "consensus" but the ndjson's own verdicts say a
// role failed — check_review_bench must catch the mismatch and re-enter
// review_bench (not silently trust the reported outcome).
{
  const request = "leash-bench-mismatch";
  seedSatisfiedManifest(request);
  const benchPath = benchPathFor(request);
  mkdirSync(join(benchPath, ".."), { recursive: true });
  writeFileSync(benchPath, [
    { bench: "review", round: 1, role: "__manifest__", roles: ["adr-reviewer", "spec-reviewer"], at: "2026-07-17T00:00:00.000Z" },
    { bench: "review", round: 1, role: "adr-reviewer", verdict: "pass", dispatched_at: "2026-07-17T00:00:01.000Z", returned_at: "2026-07-17T00:00:05.000Z" },
    { bench: "review", round: 1, role: "spec-reviewer", verdict: "fail", dispatched_at: "2026-07-17T00:00:02.000Z", returned_at: "2026-07-17T00:00:06.000Z" },
  ].map((l) => JSON.stringify(l)).join("\n") + "\n");

  const { flow } = loadFlow("full");
  let res = startFlow({ flow, inputs: { request }, startedBy: "test", idOpts: { rand: "leashb1", now: new Date("2026-07-17T00:00:00Z") } });
  const answers = { select: selectAnswer(request), classify: "success", brainstorm: "done", specify: "success", critic: "ok", pre_apply: "yes", readiness: "approved", implement: "success", review_bench: "consensus" };
  const visited = [];
  // Bounded loop: the mismatched bench.ndjson never resolves on its own (this
  // test writes it once, statically), so review_bench re-pauses forever — cap
  // the drive and assert it re-entered at least twice instead of draining it.
  for (let i = 0; i < 12 && res.state.status === "paused"; i++) {
    const p = res.state.pause;
    visited.push(p.step_id);
    res = resumeWith(loadState(res.state.flow_id), flow, answers[p.step_id]);
  }
  ok(visited.filter((s) => s === "review_bench").length >= 2, "parallelism leash: mismatched bench.ndjson re-enters review_bench (doesn't trust the reported outcome)");
  const lastCheck = res.state.step_history.filter((h) => h.step_id === "check_review_bench").pop();
  ok(lastCheck && lastCheck.result === "failure" && lastCheck.output.stdout.includes("consensus-mismatch"), "parallelism leash: check_review_bench recorded the consensus-mismatch");
}

// (2d-ii) A "surface" role never reported for the implement bench — the
// caller skipped dispatching it — check_implement_bench must catch the
// missing role and re-enter implement (never silently advance to review_bench).
{
  const request = "leash-implement-missing-role";
  const benchPath = benchPathFor(request);
  mkdirSync(join(benchPath, ".."), { recursive: true });
  writeFileSync(benchPath, [
    { bench: "implement", round: 1, role: "__manifest__", roles: ["surface-web", "surface-api"], at: "2026-07-17T00:00:00.000Z" },
    { bench: "implement", round: 1, role: "surface-web", verdict: "pass", dispatched_at: "2026-07-17T00:00:01.000Z", returned_at: "2026-07-17T00:00:05.000Z" },
    // surface-api never reported — a role was skipped.
  ].map((l) => JSON.stringify(l)).join("\n") + "\n");

  const { flow } = loadFlow("full");
  let res = startFlow({ flow, inputs: { request }, startedBy: "test", idOpts: { rand: "leashb2", now: new Date("2026-07-17T00:00:00Z") } });
  const answers = { select: selectAnswer(request), classify: "success", brainstorm: "done", specify: "success", critic: "ok", pre_apply: "yes", readiness: "approved", implement: "success" };
  const visited = [];
  // Bounded loop: the incomplete bench.ndjson never resolves on its own (this
  // test writes it once, statically), so implement re-pauses forever — cap
  // the drive and assert it re-entered at least twice instead of draining it.
  for (let i = 0; i < 12 && res.state.status === "paused"; i++) {
    const p = res.state.pause;
    visited.push(p.step_id);
    res = resumeWith(loadState(res.state.flow_id), flow, answers[p.step_id]);
  }
  ok(visited.filter((s) => s === "implement").length >= 2, "parallelism leash: missing implement role re-enters implement (doesn't advance to review_bench)");
  const lastCheck = res.state.step_history.filter((h) => h.step_id === "check_implement_bench").pop();
  ok(lastCheck && lastCheck.result === "failure" && lastCheck.output.stdout.includes("role-missing"), "parallelism leash: check_implement_bench recorded the missing role");
}

// ── 2e. THE REGISTER PATH: mode=register routes route_mode → check_registered → parked ──
// Proves the register-mode leash (add-debit): a request whose change-id IS
// declared on the roadmap parks at a NAMED human_gate ("parked") without ever
// dispatching select/plan; an undeclared id (or a raw free-form sentence) is
// refused mechanically by check_registered and the flow terminates aborted,
// nothing parked. `route_mode` is a `runs` step (never pauses) — the build-mode
// (default) happy path must remain byte-identical, unaffected by its addition.

// (2e-i) A declared change-id parks at "parked"; step_history carries no
// select/plan before the park; the state on disk is keyed to the change-id.
{
  const declaredId = "register-declared-debit";
  seedDeclaredChange(declaredId);

  const { flow } = loadFlow("fast");
  const res = startFlow({
    flow, inputs: { request: declaredId, mode: "register" }, startedBy: "test",
    idOpts: { rand: "reg2e1", now: new Date("2026-07-17T00:00:00Z") },
  });
  eq(res.state.status, "paused", "register: parks (paused)");
  ok(res.state.pause && res.state.pause.step_id === "parked", "register: pause.step_id is 'parked'");
  ok(res.state.pause && res.state.pause.step_type === "human_gate", "register: pause.step_type is 'human_gate'");
  ok(!res.state.step_history.some((h) => h.step_id === "select" || h.step_id === "plan"),
    "register: step_history has no select/plan entry before the park");
  eq(res.state.inputs.request, declaredId, "register: state on disk keyed to the declared change-id");

  // resume with "plan" (reloading state from disk first, like the §7 idiom) →
  // next pause is `select`, with the change-id preserved into its input.
  const r2 = resumeFlow({ state: loadState(res.state.flow_id), flow, resumeValue: "plan" });
  ok(r2.state.status === "paused" && r2.state.pause.step_id === "select", "register: resume 'plan' continues into select");
  eq(r2.state.pause.input.request, declaredId, "register: select's pause.input.request === the change-id");
}

// (2e-ii) resume with "discard" (a separate flow instance) → terminal aborted.
{
  const declaredId = "register-discard-debit";
  seedDeclaredChange(declaredId);
  const { flow } = loadFlow("fast");
  const res = startFlow({
    flow, inputs: { request: declaredId, mode: "register" }, startedBy: "test",
    idOpts: { rand: "reg2e2", now: new Date("2026-07-17T00:00:00Z") },
  });
  ok(res.state.pause && res.state.pause.step_id === "parked", "register-discard: parks first");
  const r2 = resumeFlow({ state: loadState(res.state.flow_id), flow, resumeValue: "discard" });
  eq(r2.state.status, "aborted", "register: resume 'discard' terminates aborted");
}

// (2e-iii) An undeclared id (or a raw free-form sentence) → the leash refuses
// mechanically: terminal aborted, no `parked` pause ever occurs.
{
  const undeclaredId = "totally-undeclared-change";
  const { flow } = loadFlow("fast");
  const res = startFlow({
    flow, inputs: { request: undeclaredId, mode: "register" }, startedBy: "test",
    idOpts: { rand: "reg2e3", now: new Date("2026-07-17T00:00:00Z") },
  });
  eq(res.state.status, "aborted", "register: start … mode=register with an undeclared id → terminal aborted");
  ok(!res.state.step_history.some((h) => h.step_id === "parked"), "register: no 'parked' pause for an undeclared id (the leash)");
}

// (2e-iv) Regression guard: the existing §2 happy path (mode defaulting to
// build) still passes UNMODIFIED — route_mode is a `runs` step and must not
// appear in `visited` (runs steps never pause).
{
  seedSatisfiedManifest("register-regression-build");
  seedSatisfiedBench("register-regression-build");
  const { res, visited } = driveDry("fast", { request: "register-regression-build" }, {
    select: selectAnswer("register-regression-build"), plan: "success", readiness: "approved", implement: "success", review: "pass",
    document: "success", pr: "success", merge: "merged",
  });
  eq(visited, ["select", "plan", "readiness", "implement", "review", "document", "pr", "merge"],
    "register: build-mode (default, mode omitted) happy path unaffected by route_mode's addition");
  ok(!visited.includes("route_mode"), "register: route_mode (a runs step) never appears in visited");
  eq(res.state.status, "completed", "register: build-mode still completes");
}

// (2e-v) REGRESSION (review round 1, reproduced live by the tester): a
// MULTI-WORD request whose FIRST token is a declared id must NOT falsely
// park. Before the fix, ${inputs.request} interpolates UNQUOTED into
// `bash -lc`, so check_registered's command word-splits — `--change
// <declared-id> plus extra free-form words` — and derive-roadmap-status.js
// only reads argv right after --change (the first token), silently ignoring
// the rest. The leash exits 0 as if the polluted sentence were declared, and
// the flow falsely PARKS with the full sentence sitting in inputs.request on
// disk — exactly the pollution acceptance criteria #2/#6 (proposal.md) forbid.
// Driven through the REAL engine/shell seam (no mock): this is what actually
// runs inside the `runs` step's spawnSync("bash", ["-lc", command]).
{
  const declaredId = "register-word-split-debit";
  seedDeclaredChange(declaredId);
  const pollutedRequest = `${declaredId} plus extra free-form words`;
  const { flow } = loadFlow("fast");
  const res = startFlow({
    flow, inputs: { request: pollutedRequest, mode: "register" }, startedBy: "test",
    idOpts: { rand: "reg2e5", now: new Date("2026-07-17T00:00:00Z") },
  });
  eq(res.state.status, "aborted",
    "register: a multi-word request whose first token is a declared id must NOT falsely park (quoting)");
  ok(!res.state.step_history.some((h) => h.step_id === "parked"),
    "register: no 'parked' pause when the request word-splits past a declared first token");
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
  const r2 = resumeWith(reloaded, flow, selectAnswer("persist"));
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
  seedSatisfiedBench("regression");
  const { flow } = loadFlow("fast");
  let res = startFlow({ flow, inputs: { request: "regression" }, startedBy: "test", idOpts: { rand: "reg5a", now: new Date("2026-07-17T00:00:00Z") } });
  // Advances to the merge gate. Pauses up to there: select, plan, readiness, implement,
  // review, document, pr (check_docs is `runs`, runs inline without pausing).
  for (const v of [selectAnswer("regression"), "success", "approved", "success", "pass", "success", "success"]) {
    res = resumeWith(loadState(res.state.flow_id), flow, v);
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

// ── 7. Regression: loop variable survives pause/resume inside a loop body ──
// Bug: rebuildLoopVars iterated `i < path.length - 1`, excluding the path's LAST
// segment. A paused body step's path ends in "iter[N]" (the body step id is not
// appended — see the __iterate__ frame in drive()), so the innermost loop's
// variable was never rebuilt on resume: ${feature} leaked literally into the
// next pause's input and into `runs` commands. Seen in production (psim-kernel,
// flow new-device-driver, run new-device-driver-260722-8598f2, engine v0.2.0).
// Nested loops only lost the INNERMOST var (intermediate iter[N] segments were
// already examined) — both shapes are pinned here.

// Drives a flow answering every invoke pause with "success", snapshotting
// {step_id, input} at each pause so the interpolated loop var is asserted
// exactly as the operator Claude would see it.
function driveLoopFlow(flowName) {
  const { flow, errors } = loadFlow(flowName);
  eq(errors, [], `${flowName}: parses without error`);
  let res = startFlow({ flow, inputs: {}, startedBy: "test", idOpts: { rand: `${flowName}1`, now: new Date("2026-07-17T00:00:00Z") } });
  const pauses = [];
  let guard = 0;
  while (res.state.status === "paused" && guard++ < 20) {
    pauses.push({ step_id: res.state.pause.step_id, input: res.state.pause.input });
    // Reload from disk: resume must rebuild loopVars from the persisted state,
    // exactly like a fresh `cli.js resume` session.
    res = resumeFlow({ state: loadState(res.state.flow_id), flow, resumeValue: "success" });
  }
  return { res, pauses };
}

// (7a) Simple loop: invoke pauses → resume → the next runs command and the next
// invoke pause still see ${feature}.
{
  const flowsUser = join(tmp, ".aidakit", "flows");
  mkdirSync(flowsUser, { recursive: true });
  writeFileSync(join(flowsUser, "looppause.yaml"), `flow: looppause
description: pause/resume inside a loop body keeps the loop variable
version: 1
inputs:
  - name: features
    type: array<string>
    default:
      - alpha
      - beta
steps:
  - id: feats
    type: loop
    over: inputs.features
    as: feature
    body:
      - id: work
        type: invoke
        invoke_target: aidakit:implement
        input:
          feature: "\${feature}"
        expects:
          - success
        on_success: build
      - id: build
        type: runs
        command: "echo building \${feature}"
        on_success: report
      - id: report
        type: invoke
        invoke_target: aidakit:ship
        input:
          feature: "\${feature}"
        expects:
          - success
        on_success: ""
    on_success: end
  - id: end
    type: terminal
    outcome: completed
    message: "done"
`);
  const { res, pauses } = driveLoopFlow("looppause");
  eq(pauses, [
    { step_id: "work", input: { feature: "alpha" } },   // first entry: var built inline (already worked)
    { step_id: "report", input: { feature: "alpha" } }, // AFTER resume: var must be rebuilt from the path
    { step_id: "work", input: { feature: "beta" } },    // next iteration advances the var
    { step_id: "report", input: { feature: "beta" } },
  ], "7a: loop var resolves in every pause input across resumes");
  // The `runs` command between the two pauses runs AFTER a resume — the loop
  // var must reach the shell, not leak as a literal \${feature}. Since ADR-005
  // the value travels as env DATA ($AIDAKIT_VAR_n), so assert what bash saw:
  // the executed stdout and the recorded vars.
  const buildRuns = res.state.step_history.filter((h) => h.step_id === "build");
  eq(buildRuns.map((h) => h.output.stdout.trim()), ["building alpha", "building beta"], "7a: runs command receives the loop var after resume (as data)");
  ok(buildRuns.every((h) => !h.output.command.includes("${feature}")), "7a: no literal ${feature} leaks into the executed command");
  eq(buildRuns.map((h) => Object.values(h.output.vars)[0]), ["alpha", "beta"], "7a: the loop var value is recorded in output.vars");
  eq(res.state.status, "completed", "7a: flow completes");
}

// (7b) Nested loops: the OUTER var already survived (its iter[N] is an
// intermediate path segment) — the INNERMOST was the one lost. Pin both.
{
  const flowsUser = join(tmp, ".aidakit", "flows");
  writeFileSync(join(flowsUser, "loopnested.yaml"), `flow: loopnested
description: nested loops keep every level's variable across pause/resume
version: 1
inputs:
  - name: groups
    type: array<string>
    default:
      - g1
  - name: feats
    type: array<string>
    default:
      - f1
      - f2
steps:
  - id: outer
    type: loop
    over: inputs.groups
    as: group
    body:
      - id: inner
        type: loop
        over: inputs.feats
        as: feature
        body:
          - id: w1
            type: invoke
            invoke_target: aidakit:implement
            input:
              group: "\${group}"
              feature: "\${feature}"
            expects:
              - success
            on_success: w2
          - id: w2
            type: invoke
            invoke_target: aidakit:ship
            input:
              group: "\${group}"
              feature: "\${feature}"
            expects:
              - success
            on_success: ""
        on_success: ""
    on_success: end
  - id: end
    type: terminal
    outcome: completed
    message: "done"
`);
  const { res, pauses } = driveLoopFlow("loopnested");
  eq(pauses, [
    { step_id: "w1", input: { group: "g1", feature: "f1" } },
    { step_id: "w2", input: { group: "g1", feature: "f1" } }, // after resume: BOTH levels rebuilt
    { step_id: "w1", input: { group: "g1", feature: "f2" } },
    { step_id: "w2", input: { group: "g1", feature: "f2" } },
  ], "7b: nested loops rebuild every level's var on resume (innermost included)");
  eq(res.state.status, "completed", "7b: flow completes");
}

// ── 8. THE DOCS-ONBOARDING FLOW: parsed (§1) AND actually driven ──
// Before this section, `docs-onboarding.yaml` was dark: §1 only parsed
// "fast"/"full", and nothing drove its steps end to end — a live mutation of
// either of its two check-doc-manifest.js call sites (`diff`/`check`, the
// flow's own lines 66/128) left the whole 12-file suite green (tester finding,
// review round 1). This closes the gap: drive the flow through its full happy
// path AND inspect the two `runs` steps' actual output — not just their
// routing — so a broken validator path (module-not-found) is caught even when
// routing alone would mask it (see the mutation proof below `diff`'s asserts:
// `diff`'s on_success/on_failure BOTH route to "propose", so a broken `diff`
// validator call would still let the flow complete if only the final status
// were checked).
{
  seedSatisfiedProjectManifest();
  const { res, visited } = driveDry("docs-onboarding", { project: "razor-example" }, {
    inventory: "issues",
    manifest: "success",
    propose: "success",
    gate_migration: "approve",
    apply: "success",
  });
  eq(visited, ["inventory", "manifest", "propose", "gate_migration", "apply"],
    "docs-onboarding: pause order (diff/check are runs steps, never pause)");
  eq(res.state.status, "completed", "docs-onboarding: satisfied project manifest → flow completes");
  eq(res.state.outcome, "completed", "docs-onboarding: outcome completed");

  // The two `runs` steps must have ACTUALLY invoked check-doc-manifest.js — not
  // merely routed to the expected next step. This is exactly what a broken
  // $AIDAKIT_GOVERNANCE/relative-path regression breaks silently if only
  // routing/final-status were asserted (see the mutation proof in evidence.md).
  const diffRun = res.state.step_history.filter((h) => h.step_id === "diff").pop();
  const checkRun = res.state.step_history.filter((h) => h.step_id === "check").pop();
  ok(diffRun && diffRun.output.exit_code === 0, "docs-onboarding: diff step (runs) exited 0");
  ok(diffRun && !diffRun.output.stderr.includes("Cannot find module") && !diffRun.output.stderr.includes("MODULE_NOT_FOUND"),
    "docs-onboarding: diff step actually resolved the validator (no MODULE_NOT_FOUND in stderr)");
  ok(checkRun && checkRun.output.exit_code === 0, "docs-onboarding: check step (runs) exited 0");
  ok(checkRun && !checkRun.output.stderr.includes("Cannot find module") && !checkRun.output.stderr.includes("MODULE_NOT_FOUND"),
    "docs-onboarding: check step actually resolved the validator (no MODULE_NOT_FOUND in stderr)");
}

// ── 9. REQUEST vs CHANGE-ID: a free-form multiline request must never reach
// a shell command (regression for flow-request-vs-change-id; live capture
// full-260724-ca264a — exit 127, "test: too many arguments", infinite
// implement↔check loop). The `select` step now REPORTS the resolved change-id
// as a structured output (change_id), every task path keys on
// ${context.select.change_id}, and `runs` interpolation passes values to bash
// as env DATA ($AIDAKIT_VAR_n), never as spliced shell text (ADR-005).

// (9a) A hostile multiline request drives the FULL flow to completion, keyed
// to the change-id select reported — no shell breakage in any runs step.
{
  const changeId = "multiline-request-change";
  const request = [
    "estou tendo dificuldades no uso da lib.",
    "ao utilizar comandos -- nao tem \"exemplos\" de facil uso; $(echo injected) `backticks`",
    "",
    "test: too many arguments && exit 127",
  ].join("\n");
  seedSatisfiedManifest(changeId);
  seedSatisfiedBench(changeId);
  const { res, visited } = driveDry("full", { request }, {
    select: selectAnswer(changeId),
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
  eq(res.state.status, "completed", "9a: multiline free-form request completes the full flow");
  eq(res.state.context.select.change_id, changeId, "9a: context.select.change_id carries the id select reported");
  eq(visited,
    ["select", "classify", "brainstorm", "specify", "critic", "pre_apply", "readiness", "implement", "review_bench", "hardening", "learn", "document", "pr", "merge"],
    "9a: pause order identical to the slug-request happy path");
  const runsSteps = res.state.step_history.filter((h) => h.step_type === "runs");
  ok(runsSteps.length >= 4, "9a: the runs gates actually executed");
  ok(runsSteps.every((h) => h.output.exit_code !== 127), "9a: no runs step exits 127 (command-not-found)");
  ok(runsSteps.every((h) => !h.output.stderr.includes("command not found") && !h.output.stderr.includes("too many arguments")),
    "9a: no shell breakage in any runs stderr");
  ok(runsSteps.every((h) => !h.output.command.includes("estou tendo")),
    "9a: the raw request is never spliced into a command");
  for (const gate of ["check_implement_bench", "check_review_bench", "bench_outcome", "check_docs"]) {
    const h = res.state.step_history.filter((x) => x.step_id === gate).pop();
    ok(h && h.output.exit_code === 0, `9a: ${gate} gate released (exit 0) against the change-id path`);
  }
  const checkReview = res.state.step_history.filter((x) => x.step_id === "check_review_bench").pop();
  ok(checkReview && Object.values(checkReview.output.vars).includes(changeId),
    "9a: check_review_bench received the change-id as env data");
}

// (9b) The outputs leash is fail-closed: select success WITHOUT change_id (or
// with an unsafe value) RE-PAUSES at select — the flow can never advance into
// the task-path steps with ${context.select.change_id} unresolved.
{
  const { flow } = loadFlow("full");
  let res = startFlow({ flow, inputs: { request: "free-form multiline\nrequest" }, startedBy: "test", idOpts: { rand: "leash9b", now: new Date("2026-07-17T00:00:00Z") } });
  eq(res.state.pause.step_id, "select", "9b: pauses at select");
  ok(res.state.pause.prompt.includes("change_id"), "9b: dispatch prompt names the required change_id output");
  eq(res.state.pause.outputs, { success: ["change_id"] }, "9b: pause record carries the declared outputs");

  res = resumeFlow({ state: loadState(res.state.flow_id), flow, resumeValue: "success" });
  eq(res.state.status, "paused", "9b: success without change_id re-pauses (fail-closed)");
  eq(res.state.pause.step_id, "select", "9b: stays at select");
  ok(res.state.pause.prompt.includes('missing required output "change_id"'), "9b: re-pause prompt names the missing key");

  res = resumeFlow({ state: loadState(res.state.flow_id), flow, resumeValue: "success", resumeOutput: { change_id: "two words" } });
  eq(res.state.pause && res.state.pause.step_id, "select", "9b: an unsafe change_id (spaces) re-pauses");

  res = resumeFlow({ state: loadState(res.state.flow_id), flow, resumeValue: "success", resumeOutput: { change_id: "good-id" } });
  eq(res.state.pause.step_id, "classify", "9b: a valid change_id advances");
  eq(res.state.context.select.change_id, "good-id", "9b: change_id persisted into context.select");
}

// (9b-ii) An outcome with NO declared outputs (select failure) needs none.
{
  const { flow } = loadFlow("full");
  let res = startFlow({ flow, inputs: { request: "whatever" }, startedBy: "test", idOpts: { rand: "leash9b2", now: new Date("2026-07-17T00:00:00Z") } });
  res = resumeFlow({ state: loadState(res.state.flow_id), flow, resumeValue: "failure" });
  eq(res.state.status, "aborted", "9b-ii: select failure needs no outputs and aborts normally");
}

// (9c) parseResumeOutput: the CLI-boundary grammar for key=value tokens.
{
  const { parseResumeOutput } = await import("../engine/resume-output.js");
  eq(parseResumeOutput(["change_id=my-change", "pr_url=https://github.com/x/y/pull/1"]),
    { change_id: "my-change", pr_url: "https://github.com/x/y/pull/1" },
    "9c: parses key=value tokens (ids and URLs)");
  const rejects = (tokens, name) => {
    let threw = false;
    try { parseResumeOutput(tokens); } catch { threw = true; }
    ok(threw, name);
  };
  rejects(["nokv"], "9c: token without = rejected");
  rejects(["=v"], "9c: empty key rejected");
  rejects(["outcome=x"], "9c: reserved key 'outcome' rejected");
  rejects(["__proto__=x"], "9c: __proto__ rejected");
  rejects(["k=two words"], "9c: value with spaces rejected");
  rejects(["k=a\nb"], "9c: multiline value rejected");
  rejects(["k=$(pwn)"], "9c: shell metacharacters rejected");
}

// (9d) runs data-passing: a metacharacter/multiline value interpolated into a
// command reaches the child EXACTLY as data — nothing inside it is executed.
{
  const flowsUser = join(tmp, ".aidakit", "flows");
  mkdirSync(flowsUser, { recursive: true });
  writeFileSync(join(flowsUser, "shellsafe.yaml"), `flow: shellsafe
description: interpolated values are env data, not shell text
version: 1
inputs:
  - name: payload
    type: string
    required: true
steps:
  - id: emit
    type: runs
    command: "printf %s \\"\${inputs.payload}\\""
    on_success: end
  - id: end
    type: terminal
    outcome: completed
    message: "ok"
`);
  const payload = "line one\nline \"two\" $(echo pwned) `backticks` ; exit 127 -- test: too many arguments";
  const { flow, errors } = loadFlow("shellsafe");
  eq(errors, [], "9d: shellsafe flow parses");
  const res = startFlow({ flow, inputs: { payload }, startedBy: "test", idOpts: { rand: "safe9d", now: new Date("2026-07-17T00:00:00Z") } });
  eq(res.state.status, "completed", "9d: flow completes despite the hostile payload");
  const emit = res.state.step_history.find((h) => h.step_id === "emit");
  eq(emit.output.exit_code, 0, "9d: command exits 0");
  eq(emit.output.stdout, payload, "9d: the payload reaches the child byte-identical ($(…) NOT executed)");
  ok(!emit.output.command.includes("pwned"), "9d: the payload is not spliced into the command text");
  ok(emit.output.command.includes("$AIDAKIT_VAR_0"), "9d: the command references the env var instead");
}

// (9e) Parser rejects a malformed `outputs` declaration at LOAD.
{
  const flowsUser = join(tmp, ".aidakit", "flows");
  mkdirSync(flowsUser, { recursive: true });
  writeFileSync(join(flowsUser, "badoutputs.yaml"), `flow: badoutputs
description: outputs referencing an undeclared outcome
steps:
  - id: a
    type: invoke
    invoke_target: aidakit:plan
    expects:
      - success
    outputs:
      nonexistent:
        - change_id
    on_success: end
  - id: end
    type: terminal
    outcome: completed
`);
  const { errors } = loadFlow("badoutputs");
  ok(errors.length > 0, "9e: outputs with an outcome outside expects is REJECTED at load");
  ok(errors.some((e) => e.message.includes("nonexistent")), "9e: error names the invalid outcome");

  writeFileSync(join(flowsUser, "badoutputkey.yaml"), `flow: badoutputkey
description: outputs with a reserved key
steps:
  - id: a
    type: invoke
    invoke_target: aidakit:plan
    outputs:
      success:
        - outcome
    on_success: end
  - id: end
    type: terminal
    outcome: completed
`);
  const rBadKey = loadFlow("badoutputkey");
  ok(rBadKey.errors.length > 0 && rBadKey.errors.some((e) => e.message.includes('"outcome"')),
    "9e: outputs declaring the reserved key 'outcome' is REJECTED at load");
}

console.log(`\n${pass} passed, ${fail} failed`);
rmSync(tmp, { recursive: true, force: true });
process.exit(fail ? 1 : 0);
