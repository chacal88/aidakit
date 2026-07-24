# Tasks — flow-step-summaries

**Change ID:** `flow-step-summaries`
**Date:** `2026-07-24`
**Owner:** `@chacal88`
**Phase / Package:** `engine + CLI (governance/) — declarative per-step narrative on every pause`

> **TDD, tests-first.** Each behavior gets a **failing** test (RED) before the code that satisfies it (GREEN), then a REFACTOR pass. Test idiom: pure Node `.mjs`, no framework — `let pass=0, fail=0`, `ok(cond,name)`, `eq(a,b,name)`, `process.exit(fail?1:0)`, modules via `await import(...)` (mirror [governance/__tests__/engine.test.mjs](../../../governance/__tests__/engine.test.mjs) and [governance/__tests__/progress-table.test.mjs](../../../governance/__tests__/progress-table.test.mjs)). Run a single file with `node governance/__tests__/<file>.test.mjs` ([governance/README.md](../../../governance/README.md)). **Anti-drift ([GOVERNANCE.md](../../../GOVERNANCE.md) §8):** re-inspect the repo before coding; any assumption from [design.md](design.md) that changed → STOP and report.

## 1. Setup

- [x] Re-read [design.md](design.md) against live code: confirm the `state.step_history.push` site at [governance/engine/engine.js:206](../../../governance/engine/engine.js), the `context[step.id]` write-points in [invoke.js:79-87](../../../governance/engine/steps/invoke.js) / [human-gate.js:30-33](../../../governance/engine/steps/human-gate.js) / [human-handoff.js:14-17](../../../governance/engine/steps/human-handoff.js), the current row template in [progress-table.js:19-42](../../../governance/engine/progress-table.js), and the `switch(cmd)` in [cli.js:121-131](../../../governance/cli.js). If any shape differs from [design.md](design.md), correct the design before writing code.
- [x] Create `governance/__tests__/step-summaries.test.mjs` with the harness skeleton (`pass`/`fail`, `ok`/`eq`, `await import("../engine/summary-template.js")`, `await import("../engine/engine.js")`, `await import("../engine/progress-table.js")`, isolated `AIDAKIT_PROJECT_ROOT` via `mkdtempSync`, final `process.exit(fail?1:0)`), and a small `makeState({status, current_step, pause, history, summaries})` fixture builder for fabricated states.

## 2. Surface Work — YAML schema + parser validation

### 2a. RED (write first)

- [x] Test §S1-i: `summary: "…"` (string) — parser accepts. Load a minimal flow with `summary: "hi {outcome}"` on an `invoke` step; assert `errors == []` and `flow.steps[0].summary === "hi {outcome}"`.
- [x] Test §S1-ii: `summary: 42` (non-string) — parser rejects with a message containing `'summary' must be a string`.
- [x] Test §S1-iii: `summary: ["a"]` (list) — parser rejects with the same class of error.
- [x] Test §S1-iv: `summary:` absent — parser accepts; `step.summary === undefined`.
- [x] Test §S1-v: `summary:` on a `runs`/`loop`/`parallel`/`terminal` step — parser ACCEPTS (permissive schema; runtime just ignores it; see design §YAML schema).

### 2b. GREEN

- [x] Extend `BaseStep` JSDoc in [types.js](../../../governance/engine/types.js) with `summary?: string`, and `FlowState` with `summaries?: StepSummary[]` + a `StepSummary` typedef matching design §State schema decision.
- [x] In [parser.js `validateSteps`](../../../governance/engine/parser.js), after the existing type/field checks, add `if (s.summary !== undefined && typeof s.summary !== "string") errs.push(\`${at}: 'summary' must be a string when present\`);` — one line, one message. Run §S1 → all green.

### 2c. REFACTOR

- [x] Confirm the parser rejection matches the message pattern used by the existing `outputs`/`max_visits` rejections (same `${at}: '<field>' …` shape). Adjust wording if needed. Re-run §S1.

## 3. Surface Work — the tiny renderer `governance/engine/summary-template.js`

### 3a. RED (write first — module does not exist yet)

- [x] Test §S2-i (basic substitution): `renderSummary("resolved {change_id}", {change_id: "flow-step-summaries"}) === "resolved flow-step-summaries"`.
- [x] Test §S2-ii (multi-key): `renderSummary("{outcome} → {change_id}", {outcome: "success", change_id: "x"}) === "success → x"`.
- [x] Test §S2-iii (unset key marker): `renderSummary("{missing}", {}) === "<unset:missing>"`.
- [x] Test §S2-iv (partial unset): `renderSummary("{outcome} {change_id}", {outcome: "success"}) === "success <unset:change_id>"`.
- [x] Test §S2-v (non-substitutable brace content is left literal): `renderSummary("{}", {}) === "{}"`, `renderSummary("{123}", {}) === "{123}"`, `renderSummary("{a.b}", {}) === "{a.b}"`.
- [x] Test §S2-vi (newline collapse in values): `renderSummary("{x}", {x: "line1\nline2\r\nline3"}) === "line1 line2 line3"`.
- [x] Test §S2-vii (null/undefined values render as unset marker): `renderSummary("{x}", {x: null}) === "<unset:x>"`, `renderSummary("{x}", {x: undefined}) === "<unset:x>"`.
- [x] Test §S2-viii (`capSummary` under limit): `capSummary("short") === "short"`.
- [x] Test §S2-ix (`capSummary` at exactly 200): a 200-char string returns unchanged.
- [x] Test §S2-x (`capSummary` over 200): a 250-char string returns `slice(0, 199) + "…"`, length exactly 200, last char `"…"`.
- [x] Test §S2-xi (`capSummary` collapses newlines even under 200): input with newlines returns them replaced by spaces.

### 3b. GREEN

- [x] Create `governance/engine/summary-template.js` exporting `renderSummary(template, bag)` and `capSummary(text)` exactly per design §Template rendering + §Cap enforcement. Include `MAX_SUMMARY_CHARS = 200` as a module constant. Zero-dep, no I/O. Run §S2 → all green.

### 3c. REFACTOR

- [x] Tidy the helper (single-responsibility; the regex and the newline collapse are the whole surface). Re-run §S2.

## 4. Surface Work — engine emission block

### 4a. RED (write first — behavior does not exist yet)

- [x] Test §S3-i (emission on `invoke` resolution — success): build a minimal flow with a single `invoke` step declaring `summary: "resolved change_id={change_id}"` and `outputs: {success: [change_id]}`. `startFlow` → paused at the invoke; `resumeFlow(…, "success", {change_id: "abc"})`. Assert `state.summaries.length === 1`; `state.summaries[0]` equals `{step_id: "<id>", visit_n: 1, outcome: "success", text: "resolved change_id=abc", ts: /ISO8601/}`; `state.summaries[0].text.length <= 200`.
- [x] Test §S3-ii (emission on `human_gate` choice): minimal flow with a `human_gate` step, options `["apply", "abort"]`, `summary: "chose {choice}"`. Drive → paused → resume `"apply"`. Assert one `summaries` entry with `outcome:"apply"`, `text:"chose apply"`.
- [x] Test §S3-iii (emission on `human_handoff` resolution): minimal flow with a `human_handoff`, `summary: "handoff {outcome}"`. Drive → resume `"anything"`. Assert one entry with `outcome:"success"` (per handoff executor) and `text:"handoff success"`.
- [x] Test §S3-iv (fallback default when `summary:` absent): minimal `invoke` with NO `summary:` field. Drive → resume `"success"`. Assert `state.summaries[0].text === "success"` (the fallback `{outcome}` template resolves against `context[step.id].outcome`).
- [x] Test §S3-v (no emission on `runs`): flow with a `runs` step that exits 0. Drive it to a terminal. Assert `state.summaries` is either absent (`undefined`) or an empty array — no entry for the `runs` step.
- [x] Test §S3-vi (no emission on `terminal`/`loop`/`parallel`): a flow with a `terminal` step reached — assert no summary entry for the terminal step id.
- [x] Test §S3-vii (`failure` outcome still emits — crit. 3): `invoke` with `expects: [success, failure]`, `summary: "{outcome}"`, `on_failure: <next>`. Drive → resume `"failure"`. Assert `state.summaries[0].outcome === "failure"` and `text === "failure"`; flow proceeds to `on_failure` target.
- [x] Test §S3-viii (`human_gate` `abort` choice still emits + routes — crit. 3): options `["apply", "abort"]`, `on_result: {apply: <next>, abort: aborted}` (`aborted` terminal). Drive → resume `"abort"`. Assert one summary entry with `outcome:"abort"`, then flow reaches the terminal `aborted` with prior summaries intact (crit. 4 sub-case).
- [x] Test §S3-ix (back-edge append — crit. 5): flow with `A (invoke) → B (invoke) → back to A` (via `on_result` — a critic-style loop). Summary template on A: `"visit {outcome}"`. Drive: A#1 → B#1 (revise) → A#2 → B#2 (success) → terminal. Assert `state.summaries` has entries in insertion order: `[{step_id:"A", visit_n:1}, {step_id:"B", visit_n:1}, {step_id:"A", visit_n:2}, {step_id:"B", visit_n:2}]`; prior A#1 unchanged; the LATEST A entry is A#2.
- [x] Test §S3-x (200-char cap on ingest — crit. 7): flow with `summary: "{blob}"` and a `human_handoff` whose response is a 500-char string (which the executor writes into `context[step.id].response`, so a template like `{response}` would render the whole thing). Actually — do this via an `invoke` with `outputs: {success:[note]}` where the resume value can be arranged; SIMPLER: monkey-test the emission block by fabricating a state where `context[stepId] = {outcome: "success", note: "x".repeat(500)}` and running the emission path. Simplest: unit-test `capSummary` in §S2 already covers the primitive; here assert that when the rendered text would be >200 chars, `state.summaries[0].text.length === 200` and `text.endsWith("…")`. (Setup: use a very long `change_id` value in a resume — but the resume-output regex forbids very long values? Alt: use a `human_handoff` template and a long resume value; the value is stored in `context[step.id].response` without regex constraints. Use that.)
- [x] Test §S3-xi (unset key does not throw — crit. 6): flow with `summary: "{does_not_exist}"` on an `invoke`. Drive → resume `"success"`. Assert `state.summaries[0].text === "<unset:does_not_exist>"`; no throw.
- [x] Test §S3-xii (`abort` via CLI preserves prior summaries — crit. 4): drive a flow past two summary emissions; `cmdAbort` (imported from cli.js OR simulated with `state.status="aborted"; saveState(state);`). Reload state. Assert both prior summaries intact.
- [x] Test §S3-xiii (non-breaking — old state without `summaries` field): fabricate a state where `state.summaries` is absent, then run through `renderProgressTable` and (below) `cmdSummaries` — assert both handle it gracefully (`renderProgressTable` still renders; `cmdSummaries` prints "no summaries recorded").

### 4b. GREEN

- [x] Insert the emission block in [engine.js `drive()`](../../../governance/engine/engine.js) after `state.step_history.push(history)` at :206 and BEFORE the `outcome.kind` switch at :209, exactly per design §Emission points (type gate on `invoke`/`human_gate`/`human_handoff`; kind gate on `"next"`/`"fail"`; visit_n derived from filtered length; log the `step_summary` event; do NOT save state here — the next branch already does).
- [x] Import `renderSummary`, `capSummary` at the top of `engine.js`.
- [x] Add the log event to the persistence event stream: `logEvent(state.flow_id, { event: "step_summary", step_id, visit_n, text })` (immediately after the push in the emission block).
- [x] Run §S3 → all green.

### 4c. REFACTOR

- [x] Extract the emission body into a small helper (`emitSummary(state, step, outcome, outcomeKey)`) inside `engine.js` if the inline block clutters `drive()`; otherwise leave inline with a comment banner (design §Emission points). Re-run §S3 + `engine.test.mjs` (should still be 149/0).

## 5. Surface Work — progress-table second-line rendering

### 5a. RED (write first)

- [x] Test §S4-i (second line under `done` rows with a summary — crit. 8): fabricate `steps` + a state with `step_history: [{step_id:"A"}, {step_id:"B"}]`, `summaries: [{step_id:"A", visit_n:1, outcome:"success", text:"hello", ts:"…"}]`, `status:"paused"`, `pause.step_id:"C"`. Render → assert the row for A is followed by a second line containing `↳ hello`; the row for B is a plain row (no second line); the `current` row for C has no second line.
- [x] Test §S4-ii (LATEST entry wins when multiple visits): state with two `A` summaries (`visit_n:1 text:"first"`, `visit_n:2 text:"second"`). Render → assert only ONE second line under A, with text `"second"`.
- [x] Test §S4-iii (no second line when `summaries` absent — crit. 10): state without a `summaries` field. Render → assert the output matches the sibling change's pure row-only shape (no `↳` characters anywhere).
- [x] Test §S4-iv (row content is byte-identical to sibling — invariant): fabricate a state with NO summaries; render → assert the output equals what the current `progress-table.js` produces (import both and compare, OR use the golden output that `progress-table.test.mjs` already validates).
- [x] Test §S4-v (`pending` and `current` rows never carry a second line — crit. 8): state with a summary whose `step_id` is the `current` step (edge case: engine emits summary on resolve, then re-enters; the step is `done` in step_history AND `current` in pause). Per sibling's precedence rule, marker is `current`; assert NO second line on the `current` row.

### 5b. GREEN

- [x] Modify [progress-table.js `renderProgressTable`](../../../governance/engine/progress-table.js) exactly per design §Progress-table sample: compute `summariesByStep = groupLatestByStep(state.summaries ?? [])`; in the per-step loop, append the indented second line only when `marker === "done"` AND `summariesByStep.get(step.id)` is present. Add a small pure helper `groupLatestByStep(arr)` in the same file.
- [x] Run §S4 → all green.

### 5c. REFACTOR

- [x] Confirm no coupling back to the engine or to `state.pause.step_id` for the second line (only `state.summaries` matters). Re-run `progress-table.test.mjs` → still 30/0 (byte-identical row output).

## 6. Surface Work — `summaries <flow_id>` CLI subcommand

### 6a. RED (write first)

- [x] Test §S5-i (subprocess smoke — full log printed): drive a fabricated flow to a state with 3 summaries, `saveState`. `execFileSync("node", ["governance/cli.js", "summaries", flowId], {env: {...process.env, AIDAKIT_PROJECT_ROOT: tmp}})` → stdout contains all 3 lines in insertion order, each formatted `[<step_id>#<visit_n> <outcome>] <text>`.
- [x] Test §S5-ii (back-edge history in order): state with `[A#1, B#1, A#2]` → stdout lines in exactly that order.
- [x] Test §S5-iii (missing flow_id → usage error, exit 2): `execFileSync("node", ["governance/cli.js", "summaries"], …)` → non-zero exit; stderr contains `usage: summaries <flow_id>`.
- [x] Test §S5-iv (state not found → error, exit 2): pass a non-existent flow_id → non-zero exit; stderr contains `flow not found`.
- [x] Test §S5-v (no summaries recorded — old state): fabricate a state WITHOUT a `summaries` field → stdout contains `no summaries recorded for <flow_id>`, exit 0.

### 6b. GREEN

- [x] Add `cmdSummaries(argv)` to [governance/cli.js](../../../governance/cli.js) exactly per design §`summaries <flow_id>` CLI subcommand.
- [x] Add `case "summaries": cmdSummaries(argv); break;` to the `switch(cmd)` at :121-131.
- [x] Update the top-of-file usage comment (`:4-13`) to list the new subcommand.
- [x] Update the default-case usage line (`:129`) to include `summaries` in the accepted list.
- [x] Run §S5 → all green.

### 6c. REFACTOR

- [x] Confirm the message-shape parity with `cmdStatus`/`cmdAbort` (fail() usage strings, `flow not found` wording). Re-run §S5.

## 7. Documentation

- [x] `governance/README.md` — add a short note under the CLI paragraph describing (a) the new `state.summaries` field, (b) the optional `summary:` YAML template with the fallback default, (c) the `summaries <flow_id>` subcommand. Bump the trailing `<!-- aidakit vX.Y — … -->` doctrine footer.
- [x] Optional (non-blocking, only if flow-authoring guidance is affected): note the `summary:` template in [DOCS.md](../../../DOCS.md) OR the flows guide ([docs/guides/flows.md](../../guides/flows.md)) — the single-brace `{key}` grammar and the fallback default. **Do NOT edit DOCS.md unless the flow-authoring section actually needs the note**; per instructions.
- [x] Via `aidakit:roadmap`, enrich the `flow-step-summaries` feature's acceptance line in [EPIC-flow-cli-ux](../../roadmap/epics/EPIC-flow-cli-ux.md) to the confirmed criteria — **never write a status field, never hand-edit the derived `ROADMAP.md`** ([ADR-002](../../decisions/ADR-002-roadmap-status-derived-from-disk.md), amended by [ADR-007](../../decisions/ADR-007-roadmap-status-from-shared-git.md)). Order-independent with Tasks 2-6.
- [x] Confirm status derivation: this change lives at `docs/features/flow-step-summaries/` and is committed to a shared branch → roadmap should derive `in-progress` from disk automatically (per `af88b62` — the flow commits the plan early, [ADR-009](../../decisions/ADR-009-flow-commits-plan-early.md)).
- [x] This change package complete (proposal, design, tasks, evidence).

## 8. Validation (executable)

- [x] `node governance/__tests__/step-summaries.test.mjs` → green (covering §S1-§S5, every enumerated case). Record counts in [evidence.md](evidence.md).
- [x] `node governance/__tests__/engine.test.mjs` → still green (no regression; the engine API is unchanged; kit flows declare no `summary:`, so shipped flow drive tests emit fallback summaries but no existing assertion inspects `state.summaries`).
- [x] `node governance/__tests__/progress-table.test.mjs` → still green (row-line output byte-identical; the second-line addition only activates when `state.summaries` is present, which existing fixtures do not set).
- [x] Full suite `for t in governance/__tests__/*.test.mjs; do node "$t" || echo "FAIL $t"; done` → all green (record per-file counts in [evidence.md](evidence.md), mirroring `flow-run-progress-table/evidence.md` §Validation Outputs shape).
- [x] Live CLI smoke (isolated `AIDAKIT_PROJECT_ROOT`): (a) create a `.aidakit/flows/summ-smoke.yaml` with a `select`-style `invoke` step declaring `summary: "resolved change_id={change_id}"` and `outputs: {success:[change_id]}`; `start summ-smoke request="…"`; `resume … success change_id=xyz`; `status` prints the second line `↳ resolved change_id=xyz` under the step's row; `summaries <flow_id>` prints the same as `[<id>#1 success] resolved change_id=xyz`. Capture in [evidence.md](evidence.md). (b) Drive a back-edge in a hand-authored 3-step flow; assert `summaries` grows to 2 entries for the re-entered step; the LATEST is what the table shows. (c) Drive a flow with NO `summary:` templates; assert every pause-emitting step gets a fallback `{outcome}` summary and the table shows `↳ success` under `done` rows.
- [x] `node governance/validators/check-links.js docs/features/flow-step-summaries` → exit 0. Record output.
- [x] `node governance/validators/derive-roadmap-status.js --root .` → exit 0; `flow-step-summaries` derives `in-progress`. Record the JSON entry.
- [x] Confirm no file in the diff modifies the sibling change's row invariants (row content stays `id + marker`; no code path emits per-step narrative INTO the row). Record the sibling-boundary check.

## 9. Release

- [x] Bump `version` in `.claude-plugin/plugin.json` **strictly above the manifest version on main at implementation start — re-read it, don't assume**. This is what makes `claude plugin update` copy the new engine + CLI behavior to installed users ([PROCESS.md](../../../PROCESS.md) §5). `node governance/validators/check-plugin-version.js .` → exit 0; record in [evidence.md](evidence.md).

## 10. Cleanup

- [x] No stray files outside the declared scope; `git status` matches, plus ONE documented deviation (`docs/guides/flows.md` — see evidence.md §Unresolved Deviations #3):
  - `governance/engine/summary-template.js` (new)
  - `governance/engine/engine.js` (emission block)
  - `governance/engine/types.js` (JSDoc)
  - `governance/engine/parser.js` (schema line)
  - `governance/engine/progress-table.js` (second-line branch)
  - `governance/cli.js` (subcommand + switch entry + usage comments)
  - `governance/__tests__/step-summaries.test.mjs` (new)
  - `governance/README.md` (note + footer bump)
  - `.claude-plugin/plugin.json` (version bump)
  - `docs/roadmap/epics/EPIC-flow-cli-ux.md` (enriched acceptance line — see evidence.md §Unresolved Deviations #4 for why `aidakit:roadmap` wasn't dispatched as a separate agent)
  - `docs/roadmap/ROADMAP.md` (minimally regenerated — never hand-edited a status field; see evidence.md §Unresolved Deviations #4)
  - `docs/features/flow-step-summaries/{proposal,design,tasks,evidence}.md` (this package; tasks.md checkboxes marked through Task 9)
  - `docs/guides/flows.md` (deviation — see evidence.md §Unresolved Deviations #3)
- [x] `## Files Touched` and `## Unresolved Deviations` sections filled in [evidence.md](evidence.md).

## 11. Ship (separate step — out of scope for the implementer)

- [ ] Ship: conventional commit on the worktree branch, PR `feat(engine): per-step summaries emitted on every pause` to main, **stop at the URL** — the merge is the human's ([GOVERNANCE.md](../../../GOVERNANCE.md) §1). PR body notes: closes the theme-3 debit of [EPIC-flow-cli-ux](../../roadmap/epics/EPIC-flow-cli-ux.md); composes with the sibling `flow-run-progress-table` (position layer + narrative layer, no boundary violation).
