# Tasks — acceptance-leash

**Change ID:** `acceptance-leash`
**Date:** `2026-07-24`
**Owner:** `@chacal88`
**Phase / Package:** `governance/ (validator + agent + flow wiring) — mechanical goal-leash on the PR gate`

> TDD, tests first. The validator, the schema formalizer, and the flow wiring each get a RED test before the GREEN implementation. Test idiom: pure Node `.mjs`, no framework — `let pass=0, fail=0`, `ok(cond,name)`, `execFileSync` for validator calls, `driveDry`-style loops for engine tests (mirror [governance/__tests__/engine.test.mjs](../../../governance/__tests__/engine.test.mjs), [governance/__tests__/check-docs.test.mjs](../../../governance/__tests__/check-docs.test.mjs)). **Anti-drift ([GOVERNANCE.md](../../../GOVERNANCE.md) §8):** re-inspect the repo before coding; any assumption from [design.md](design.md) that changed → STOP and report.

## 1. Setup

- [x] Re-read [design.md](design.md) §Anti-drift against live code: confirm the `check-doc-manifest.js` output contract, `check_docs → pr` current wiring in both flows, `max_visits` semantics on `runs` steps (non-pausing, no `resumeValue` guard needed), and the doc-planner/brainstorm agent shapes. No divergence expected; report if any is found.
- [x] Read `.aidakit/tasks/acceptance-leash/brainstorm.json` — the 7 acceptance criteria that gate this change's own PR (dogfooding).

## 2. Brainstorm schema — canonical `acceptance_criteria` shape

### 2a. RED (write first; will fail — the shape is not yet documented/enforced)

- [x] Test (new `governance/__tests__/brainstorm-schema.test.mjs` OR extend an existing test): a `brainstorm.json` with `acceptance_criteria: ["free prose"]` (legacy shape) is still accepted; a `brainstorm.json` with `acceptance_criteria: [{ id: "kebab", criterion: "prose" }]` (new shape) is preferred and parsed by a shared helper `governance/acceptance/parse-criteria.js`. The helper returns `[{ id, criterion, source }]` normalizing either shape.
- [x] Test that a `proposal.md` with a `## Acceptance criteria` section (Markdown list of `- \`criterion-id\` — prose` OR plain `- prose` bullets) is parsed by the same helper when brainstorm is absent (fast-flow path).

### 2b. GREEN

- [x] Author `governance/acceptance/parse-criteria.js` — shared helper (Node ESM, zero-dep) that takes `{ change_id, root }` and returns `{ criteria: [{ id, criterion, source: "brainstorm"|"plan" }], source_path }`. Precedence: `brainstorm.json` first; fall back to `proposal.md` `## Acceptance criteria`. Auto-slug the id when absent (kebab-case of the first 6 words of the prose, deduplicated across the list).
- [x] Update [agents/brainstorm.md](../../../agents/brainstorm.md) Output format §"Acceptance criteria" to specify the `- \`criterion-id\` — prose` line shape.
- [x] Update [skills/brainstorm/SKILL.md](../../../skills/brainstorm/SKILL.md) to reference the schema (doctrine layer; the agent enforces it).
- [x] Update [skills/plan/SKILL.md](../../../skills/plan/SKILL.md) to declare `## Acceptance criteria` as a NEW MANDATORY section of `proposal.md` for changes from this PR onward — distinct from the existing `## Exit criteria` section (which lists validator commands). Existing archived / in-flight proposals are grandfathered (`engine-max-visits`, `configurable-pr-automation`) — no retrofit required.
- [x] Update [docs/features/README.md](../README.md) with a one-line note that new proposals MUST carry `## Acceptance criteria` (observable-effect promises) in addition to `## Exit criteria` (validator commands) — the closest to a proposal template the kit has today, and the discovery surface a plan author reads before authoring `docs/features/<id>/proposal.md`.

### 2c. REFACTOR

- [x] Re-run §2a tests → green.

## 3. Validator — `check-acceptance.js`

### 3a. RED (write first; will fail — validator does not exist)

- [x] Test (new `governance/__tests__/check-acceptance.test.mjs`, mirror of `check-docs.test.mjs`): manifest with a missing evidence path → exit 1, error rule `evidence-missing`.
- [x] Test: manifest with all evidence paths present → exit 0, `resolved === required`.
- [x] Test: item with `status: "n/a"` and a `condition` → skipped, doesn't block.
- [x] Test: item with `status: "n/a"` and NO `condition` → exit 2, `manifest-invalid`.
- [x] Test: manifest with an evidence path carrying a `#anchor` suffix → validator strips the anchor before `existsSync` (same convention as `check-links.js`).
- [x] Test: manifest without a `required` list → exit 2 with `manifest-invalid` diagnostic (matches `check-doc-manifest.js:43`).
- [x] Test: JSON output contract — `validator` field is `"aidakit.check-acceptance"`, includes `change_id`, `level`, `required`, `resolved`, `errors[]`.

### 3b. GREEN

- [x] Author `governance/validators/check-acceptance.js` — pure Node, zero-dep. Copy the shape of `check-doc-manifest.js` (imports, `fail()` helper, `main()`, `findProjectRoot` fallback to `AIDAKIT_PROJECT_ROOT`). Iterate `manifest.required`, skip `n/a`, resolve `evidence.path` against root, strip `#anchor`, `existsSync + isFile`. Push `evidence-missing` errors. Emit the JSON output on stdout; stderr summary when `--json` is absent. Exit 0/1/2 per contract.

### 3c. REFACTOR

- [x] Re-run §3a → green; no other test file affected.

## 4. Agent — `aidakit:acceptance-planner`

### 4a. RED (contract test)

- [x] Test (part of `governance/__tests__/brainstorm-schema.test.mjs` OR a new small test): the agent file `agents/acceptance-planner.md` exists, has the mandatory GOVERNANCE.md §7 anatomy sections (Role · Protocol · Decisions · Escalations · Not-do · Output), declares `tools: Read, Glob, Grep, Write`, and `model: sonnet`. (Structural check via file read + regex.)

### 4b. GREEN

- [x] Author `agents/acceptance-planner.md` — mirror of [agents/doc-planner.md](../../../agents/doc-planner.md) in structure; deliverable is `.aidakit/tasks/<change-id>/acceptance-manifest.json`. Frontmatter and full Protocol per [design.md](design.md) §Agent contract. Includes:
  - Step 0 — Detect the criteria source (brainstorm.json vs proposal.md via the `parse-criteria.js` helper).
  - Step 1 — Read the plan (proposal/design/tasks).
  - Step 2 — Map each criterion to an evidence path (test / file / evidence-section); when no mapping fits cleanly, `n/a` with a written `condition` (never a fictional path).
  - Step 3 — Write the manifest.
  - Step 4 — Cross-check (every non-`n/a` has `evidence.path`; every `n/a` has `condition`; JSON valid; `required` list non-empty).
  - Escalation triggers (§3 scope: source missing, plan absent, criterion unmappable; §2 ADR: N/A; §1 merge: N/A).
  - What it does NOT do (write tests/evidence; run the validator; mark `resolved` for convenience; invent evidence paths).

### 4c. REFACTOR

- [x] Re-run §4a → green. No test executes the agent live (agents are Claude subagents; the contract check is structural).

## 5. Flow wiring — `full.yaml`

### 5a. RED (parser + wiring tests)

- [x] Test (extend `governance/__tests__/engine.test.mjs` §11 or new §): load `full.yaml`; assert `check_docs.on_success === "acceptance"`; `acceptance` exists as `invoke` with `invoke_target: aidakit:acceptance-planner`, `input.change_id: "${context.select.change_id}"`, `input.criteria_source: "brainstorm"`; `check_acceptance` exists as `runs` with the exact command string, `max_visits: 3`, `on_max_visits: "acceptance_escalation"`, `on_success: "pr"`, `on_failure: "acceptance"`; `acceptance_escalation` exists as `human_gate` with `options: [abort]`, `on_result.abort: "aborted"`.
- [x] Test §11 end-to-end (mirror of `engine-max-visits` §10d): drive `full` past select/classify/brainstorm/specify/critic/…/document/check_docs (all success), then acceptance (success)/check_acceptance (success) → reaches `pr` normally. Then a second scenario where `check_acceptance` fails 3 times → `acceptance_escalation` fires, `abort` terminates the flow.

### 5b. GREEN

- [x] Edit `governance/flows/full.yaml`:
  - `check_docs.on_success`: `pr` → `acceptance`.
  - Insert `acceptance` invoke step after `check_docs`.
  - Insert `check_acceptance` runs step with `max_visits: 3` + `on_max_visits: acceptance_escalation`.
  - Insert `acceptance_escalation` human_gate step (`options: [abort]`, `on_result.abort: aborted`).
  - Descriptions match [design.md](design.md) §Flow wiring.

### 5c. REFACTOR

- [x] Re-run §5a → green.

## 6. Flow wiring — `fast.yaml`

### 6a. RED (parser + wiring tests)

- [x] Test (same file as §5a): load `fast.yaml`; assert the same shape, with `input.criteria_source: "plan"`.
- [x] Test end-to-end (mirror of §5a end-to-end but on `fast`): success path reaches `pr`; failure path reaches `acceptance_escalation` after 3 rounds.

### 6b. GREEN

- [x] Edit `governance/flows/fast.yaml`: same three-step insertion, `criteria_source: "plan"`.

### 6c. REFACTOR

- [x] Re-run §6a → green.

## 7. ADR-010

### 7a. RED

- [x] Test: `node governance/validators/check-adr-format.js docs/decisions/ADR-010-acceptance-leash.md` → exit 0.

### 7b. GREEN

- [x] Author `docs/decisions/ADR-010-acceptance-leash.md` following the 5-section shape (Status+Date · Context · Decision · Consequences · Alternatives considered), naming the four load-bearing decisions:
  1. Separate agent (not overloading `brainstorm` or `plan`) — Write-tool authorized, isolated context, mirrors doc-planner.
  2. Weak-bar validator (path-exists, no re-execution) — separation of concerns from `hardening`.
  3. Gates BOTH `full` and `fast` — one leash, two source types (brainstorm.json vs proposal.md).
  4. `max_visits` from day one on `check_acceptance` — consistent with [engine-max-visits](../../decisions/) precedent; escalate rather than loop.
- [x] Register in `docs/decisions/README.md` index (append row + thematic grouping line).

### 7c. REFACTOR

- [x] Re-run §7a → green.

## 8. Full suite + docs validators

- [x] `node governance/__tests__/check-acceptance.test.mjs` → green.
- [x] `node governance/__tests__/engine.test.mjs` → green with new §11.
- [x] `node governance/__tests__/brainstorm-schema.test.mjs` (or the extended existing test) → green.
- [x] All `governance/__tests__/*.test.mjs` → green (no regression from the 149-baseline `engine-max-visits` left).
- [x] `node governance/validators/check-adr-format.js docs/decisions/ADR-010-acceptance-leash.md` → exit 0.
- [x] `node governance/validators/check-links.js docs/features/acceptance-leash docs/decisions` → exit 0.
- [x] `node governance/validators/derive-roadmap-status.js --root .` → exit 0; `acceptance-leash` derives `in-progress`.
- [ ] Dogfooding smoke: manually run `node governance/validators/check-acceptance.js .aidakit/tasks/acceptance-leash/acceptance-manifest.json` after `aidakit:acceptance-planner` has been invoked in a real flow session — exit 0 confirms the change's own PR clears its own leash.

## 9. Cleanup / documentation

- [ ] Update `docs/roadmap/epics/EPIC-flow-engine-leashes.md` Feature 2 line to point at the completed change (append a "**Delivered** — PR #XX" suffix during ship; deferred to implement/ship, not planning).
- [x] `docs/features/README.md` proposal-template update is covered in §2b (GREEN) — no additional cleanup here.

## 10. Bench round 1 fixes (blocking + non-blocking, landed same round)

- [x] **Finding A (BLOCKER — architecture, dead code):** `check-acceptance.js` now imports `parseCriteria` from `governance/acceptance/parse-criteria.js` and cross-validates the manifest against the parser's live extraction from the change's real source (`brainstorm.json`/`proposal.md`). New error rule `criterion-orphan` (a parsed criterion with no manifest entry) → exit 1. JSON output gains `parsed_criteria`. `check-acceptance.test.mjs` gained 3 tests (orphan detection, clean-pass echo, proposal.md fallback). `ADR-010` Decision 3 updated with the enforcement-point sentence.
- [x] **Finding B (IMPORTANT — empty-slug fallback):** `slugify()` callers in `parse-criteria.js` (`fromBrainstorm`, `fromProposal`) now fall back to a positional `criterion-<index>` id when the normalized prose strips to `""` — no more empty ids or dash-only ids (`"-2"`). Covered in `brainstorm-schema.test.mjs` for both the brainstorm-string path and the proposal.md plain-bullet path.
- [x] **Finding C (nits):** one-line comments added at `check-acceptance.js`'s two exit-2 paths (bad-JSON vs missing/empty `required` — the latter deliberately emits a full JSON envelope) and at `parse-criteria.js`'s `dedupeSlug()` (intentional collision-safety rewrite of duplicate explicit ids).
- [x] **Finding D (tester follow-ups, 4 tests):** `check-acceptance.test.mjs` gained (1) `status:"resolved"` with a non-existent path → still `evidence-missing`, (3) evidence path pointing at an existing directory → `evidence-missing` (exercises `isFile()`). `engine.test.mjs` gained (2) §11e — a broken manifest fixed before the 2nd `acceptance` round, flow completes with `check_acceptance` visits < 3 (recovery). `brainstorm-schema.test.mjs` gained (4) malformed `brainstorm.json` (JSON.parse throws) falls back to `proposal.md` cleanly.
