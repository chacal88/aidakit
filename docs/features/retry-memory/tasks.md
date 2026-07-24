# Tasks — retry-memory

**Change ID:** `retry-memory`
**Date:** `2026-07-24`
**Owner:** `@chacal88`
**Phase / Package:** `engine + flows (governance/) + skills — structured retry history for the implement loop`

> TDD, tests first. Each helper case, each parser/driver extension, each YAML wiring bit gets a RED test before the GREEN implementation, then REFACTOR. Test idiom: pure Node `.mjs`, no framework — `let pass=0, fail=0`, `ok(cond,name)`, `eq(a,b,name)`, `process.exit(fail?1:0)`, modules via `await import(...)` (mirror [governance/__tests__/engine.test.mjs](../../../governance/__tests__/engine.test.mjs) and [governance/__tests__/check-bench.test.mjs](../../../governance/__tests__/check-bench.test.mjs)). **Anti-drift ([GOVERNANCE.md](../../../GOVERNANCE.md) §8):** re-inspect the repo before coding; any assumption from [design.md](design.md) that changed → STOP and report.

## 1. Setup

- [ ] Re-read [design.md](design.md) against live code: confirm the max-visits shape of [engine.js:130-182](../../../governance/engine/engine.js), the fail-closed outputs behavior of [invoke.js:60-75](../../../governance/engine/steps/invoke.js), the plain-string input interpolation of [invoke.js:92](../../../governance/engine/steps/invoke.js), the runs child-env shape of [runs.js](../../../governance/engine/steps/runs.js), and the `commit_plan` best-effort pattern of [full.yaml:106-122](../../../governance/flows/full.yaml). Any divergence → STOP and report before writing code.
- [ ] Create the empty test file [governance/__tests__/retry-memory.test.mjs](../../../governance/__tests__/retry-memory.test.mjs) with the `pass/fail`/`ok`/`eq` harness. All subsequent §2/§3/§4 tests go here.

## 2. Append helper — `append-retry-history.js`

### 2a. RED

- [ ] Test §1a: append into a missing dir/file — helper creates both; file contents = `[{"round":1,"step_id":"specify","cause":"critic-reject"}]`; exit 0. Assertion set writes to a per-test temp dir with `$AIDAKIT_PROJECT_ROOT` overridden (idiom from `check-doc-manifest.test.mjs`).
- [ ] Test §1b: append into an existing file with `[{"round":1,...}]` — result has both records in order; no dup.
- [ ] Test §1c: empty `change_id` (empty string arg) → exit 0 no-op; file untouched. Same for empty `cause`.
- [ ] Test §1d: invalid `cause` (`"has space"`) → exit 1 with a diagnostic mentioning `RESUME_OUTPUT_VALUE_RE`; file untouched.
- [ ] Test §1e: atomic write — after a successful call, `<path>.tmp` does not exist; pre-create a stale `.tmp` and confirm the next append overwrites cleanly (no leftover).
- [ ] Test §1f: `round` computed from a mock state file — write `.aidakit/state/<flow_id>.json` with `context.__visits = {specify: 2}`, call with `--flow-id <flow_id>` and `target=specify`, assert the record's `round === 2`. Missing state file → `round: null`.

### 2b. GREEN

- [ ] Create [governance/validators/append-retry-history.js](../../../governance/validators/append-retry-history.js): zero-dep, pure Node ESM. CLI: `<change_id> <target_step_id> <cause> [--flow-id <flow_id>]`. Behaviors per [design.md §The append helper](design.md#the-append-helper--governancevalidatorsappend-retry-historyjs). Emit JSON on stdout `{validator:"append-retry-history", ok, change_id, target_step_id, cause, round}`; use `.tmp` + `rename` for atomic write; import `RESUME_OUTPUT_VALUE_RE` from [governance/engine/resume-output.js](../../../governance/engine/resume-output.js) for cause validation; import `projectRoot` from [governance/engine/persistence.js](../../../governance/engine/persistence.js) to resolve `docs/features/…` and `.aidakit/state/…` paths.

### 2c. REFACTOR

- [ ] Re-run §1a–§1f → all green. Confirm no leaked temp dirs (test uses `mkdtempSync` + cleanup).

## 3. Engine — surface AIDAKIT_FLOW_ID to runs children

### 3a. RED

- [ ] Test §2-env: write a minimal test flow with a `runs` step that echoes `$AIDAKIT_FLOW_ID`; drive it; assert the captured stdout equals the flow's own `flow_id`. (Small, direct.)

### 3b. GREEN

- [ ] Edit [governance/engine/steps/runs.js](../../../governance/engine/steps/runs.js): add `AIDAKIT_FLOW_ID: ctx.state.flow_id` to the child-env map, alongside the existing `AIDAKIT_GOVERNANCE` and `AIDAKIT_VAR_n` entries. Document in the same comment block that names the two env-owned keys ([ADR-004](../../decisions/ADR-004-aidakit-governance-env-contract.md), [ADR-006](../../decisions/ADR-006-flow-values-as-data.md)).

### 3c. REFACTOR

- [ ] Re-run §2-env → green; `node governance/__tests__/engine.test.mjs` → still **149/0**.

## 4. Resume-output extension on invoke steps (`outputs: {revise: [cause]}`)

### 4a. RED

- [ ] Test §2a: minimal test flow with a `critic`-like invoke step declaring `outputs: {revise: [cause]}`; assert `loadFlow` accepts the shape (no new parser change expected — [invoke.js:60-75](../../../governance/engine/steps/invoke.js) already handles arbitrary `outputs` maps; this test is a compat guard).
- [ ] Test §2b: drive the flow; resume with `revise` alone (no `cause=`) → the invoke re-pauses at the same step with the outputs-leash prompt naming `cause`.
- [ ] Test §2c: resume with `revise cause=critic-reject` → `context.<step>.cause === "critic-reject"`, `context.<step>.outcome === "revise"`, the flow proceeds.

### 4b. GREEN

- [ ] These tests should pass with NO changes to [invoke.js](../../../governance/engine/steps/invoke.js) — the outputs leash is already generic. If any assertion fails, investigate before adding code (likely a divergence from design → escalate). If all green, this section is proof of leverage, not new code.

### 4c. REFACTOR

- [ ] `node governance/__tests__/engine.test.mjs` → still 149/0.

## 5. Wire `full.yaml` — record-cause runs steps + `retry_history_path` in inputs

### 5a. RED (schema tests)

- [ ] Test §3a: load `full.yaml`; assert `implement.input.retry_history_path === "docs/features/${context.select.change_id}/retry-history.json"`; assert the same for `specify` and `learn`.
- [ ] Test §3b: `critic.outputs === {revise: ["cause"]}`; `readiness.outputs === {"needs-revision": ["cause"]}`.
- [ ] Test §3c: `record_critic_cause`, `record_readiness_cause`, `record_check_implement_cause`, `record_bench_outcome_cause`, `record_hardening_cause` all exist as `type: runs`; each has `on_success === on_failure === <its retry target>`.
- [ ] Test §3d: back-edges wire through the new record steps: `critic.on_result.revise === "record_critic_cause"`; `readiness.on_result["needs-revision"] === "record_readiness_cause"`; `check_implement_bench.on_failure === "record_check_implement_cause"`; `bench_outcome.on_failure === "record_bench_outcome_cause"`; `hardening.on_failure === "record_hardening_cause"`. No leftover direct back-edge to `specify`/`implement`.

### 5b. GREEN

- [ ] Edit [governance/flows/full.yaml](../../../governance/flows/full.yaml):
  - `specify.input`: add `retry_history_path: "docs/features/${context.select.change_id}/retry-history.json"`.
  - `critic`: add `outputs: {revise: [cause]}`; change `on_result.revise` to `record_critic_cause`.
  - `readiness`: add `outputs: {"needs-revision": [cause]}`; change `on_result.needs-revision` to `record_readiness_cause`.
  - Insert `record_critic_cause` (`type: runs`, `command: node "$AIDAKIT_GOVERNANCE/validators/append-retry-history.js" "${context.select.change_id}" specify "${context.critic.cause}" --flow-id "$AIDAKIT_FLOW_ID"`, `on_success: specify`, `on_failure: specify`).
  - Insert `record_readiness_cause` (analogous, target `specify`, cause `${context.readiness.cause}`).
  - `check_implement_bench.on_failure` → `record_check_implement_cause`. Insert step with fixed `cause bench-violation` (per design §Cause-key registry note about `check-bench.js` finer-grain being a follow-up), `on_success: implement`, `on_failure: implement`.
  - `bench_outcome.on_failure` → `record_bench_outcome_cause`. Insert step with fixed `cause bench-veto`, back to `implement`.
  - `hardening.on_failure` → `record_hardening_cause`. Insert step with fixed `cause test-failure`, back to `implement`.
  - `implement.input`: add `retry_history_path` (same shape).
  - `learn.input`: add `retry_history_path` (same shape). (`learn` already interpolates `change_id` in input; adding one more key is a two-line edit.)

### 5c. REFACTOR

- [ ] Re-run §3a–§3d → green; `node governance/__tests__/engine.test.mjs` → still 149/0.

## 6. End-to-end drive test

### 6a. RED

- [ ] Test §4a: mock a change-id (`retry-memory-e2e`); drive `full` start → select (success, change_id=retry-memory-e2e) → classify → brainstorm → specify (success) → commit_plan → critic (revise, `cause=critic-reject`) → assert `record_critic_cause` ran (via step_history) → assert `docs/features/retry-memory-e2e/retry-history.json` on disk is `[{"round":1,"step_id":"specify","cause":"critic-reject"}]` → drive next round: specify (success) → commit_plan → critic (ok) → assert the file is UNCHANGED (no bookkeeping on success).
- [ ] Test §4b: continue 4a through pre_apply/readiness (approved)/implement (success)/check_implement_bench (success)/review_bench (consensus)/check_review_bench (success)/bench_outcome (success — pass through to hardening)/hardening (success)/learn (success); assert the `learn` pause payload's `input.retry_history_path` resolves to the same file path; simulate the skill emitting one `{errorType:"retry-cause", key:"critic-reject", phase:"specify"}` correction event to `.aidakit/tasks/retry-memory-e2e/events.ndjson`; assert `deriveCandidates("retry-memory-e2e", {threshold:1})` returns a candidate whose grouping key matches (proves the ledger picks up the stream without changes).
- [ ] Test §4c: exhaust the specify loop — three consecutive `critic: revise cause=critic-reject` rounds; assert `retry-history.json` has three records `{round:1..3, step_id:"specify", cause:"critic-reject"}`; assert `specify_escalation` was reached and `abort` terminated the flow. Confirms retry-memory writes each round before max-visits escalates and does NOT alter the escalation semantic.

### 6b. GREEN

- [ ] No new code — 6a exercises the wiring from §2, §3, §4, §5. Any assertion failure here indicates a wiring gap → fix by returning to the offending section.

### 6c. REFACTOR

- [ ] Full run of `governance/__tests__/retry-memory.test.mjs` → all sections green.

## 7. Skills — read the injected path

- [ ] Update [skills/implement/SKILL.md](../../../skills/implement/SKILL.md): add a paragraph in the "Process" section: "Before starting a round, read `input.retry_history_path` (may be absent/empty). If it contains records, filter by `step_id === 'implement'` and PREAMBLE your work with the prior rounds' `cause` list; steer explicitly away from repeating those failure classes. A malformed/missing file is round-1 semantics, never a bug." Include one small JSON example.
- [ ] Update [skills/plan/SKILL.md](../../../skills/plan/SKILL.md): same paragraph, filter `step_id === 'specify'`.
- [ ] Update [skills/learn/SKILL.md](../../../skills/learn/SKILL.md): add a bullet under "Prerequisites" — "The change's `retry_history_path` (when provided by the flow, e.g. the `full` flow's `learn` step) — each record translates to a correction event of shape `{kind:"correction", errorType:"retry-cause", key:<cause>, phase:<step_id>}` appended to `events.ndjson` (idempotent — skip duplicates by `{errorType, key, phase, round}`)." Cross-link back to [retry-memory/design.md §Interop with `aidakit:learn`](design.md#interop-with-aidakitlearn) so a future reader has one hop to the mechanism.

## 8. Full suite + docs validators

- [ ] `node governance/__tests__/retry-memory.test.mjs` → all assertions green.
- [ ] `node governance/__tests__/engine.test.mjs` → still **149/0** (engine core untouched; the single one-line `AIDAKIT_FLOW_ID` addition is covered by §3a).
- [ ] All `governance/__tests__/*.test.mjs` → green (no regression). Record per-file counts in [evidence.md](evidence.md).
- [ ] `node governance/validators/derive-roadmap-status.js --root .` → exit 0; `retry-memory` derives `in-progress` (directory + committed plan).
- [ ] `node governance/validators/check-links.js docs/features/retry-memory` → exit 0.
- [ ] `node governance/validators/check-doc-manifest.js .aidakit/tasks/retry-memory/doc-manifest.json` → exit 0 once the doc-manifest for this change is authored (that is a `document`-step job, not this task list's).

## 9. Cleanup

- [ ] Confirm no orphaned test artifacts under `/private/tmp/` from §2 unit tests (they use `mkdtempSync` + cleanup).
- [ ] Confirm `docs/features/retry-memory/retry-history.json` is not created by the test suite (tests scope writes to per-test temp roots via `AIDAKIT_PROJECT_ROOT`).
- [ ] Update [evidence.md](evidence.md) with the actual per-suite pass counts, the commands run, and any deviations from this plan.
