# Tasks — flow-request-vs-change-id

**Change ID:** `flow-request-vs-change-id`
**Date:** `2026-07-24`
**Owner:** `@chacal88`
**Phase / Package:** `engine + flows (governance/) — bugfix with contract change (ADR-005)`
**PRD:** `n/a`
**Tech Spec:** `n/a`

## 1. Setup

- [x] Reproduce/ground the failure from the live capture `.aidakit/flows/state/full-260724-ca264a.json` (exit 127, `test: too many arguments`, implement↔check loop) and locate every `${inputs.request}` command site in `full.yaml`/`fast.yaml`/`docs-onboarding.yaml`.

## 2. Surface Work — engine (`governance/engine/`)

- [x] `resume-output.js` (new): `RESUME_OUTPUT_KEY_RE`, `RESUME_OUTPUT_VALUE_RE`, `RESERVED_OUTPUT_KEYS`, `parseResumeOutput` (throws on malformed tokens).
- [x] `interpolate.js`: `interpolateCommand` — `${expr}` → `$AIDAKIT_VAR_n` + `vars` map; unique var per expression; unresolved left as-is.
- [x] `runs.js`: render via `interpolateCommand`; child env `{...process.env, ...vars, AIDAKIT_GOVERNANCE}`; record `command` + `vars` in output.
- [x] `invoke.js`: fail-closed `outputs` enforcement (missing/unsafe → re-pause with the exact resume line); merge supplied keys into the context bag with `outcome`/`invoke_target` protected; dispatch prompt names required outputs; fix the broken (empty-placeholder) invalid-outcome prompt.
- [x] `engine.js`: thread `resumeOutput` through `resumeFlow`/`drive` single-shot, logged on `flow_resume`.
- [x] `parser.js`: validate `outputs` at LOAD (map outcome→non-empty identifier list, outcomes ⊆ expects, reserved keys refused).
- [x] `types.js`: JSDoc for `InvokeStep.outputs`, `ExecutionContext.resumeOutput`, `PauseInfo.outputs`.
- [x] `cli.js`: `resume <flow_id> <outcome> [key=value ...]` — parse/validate tokens before touching state; pause hint prints `[key=value ...]` when the step declares outputs.

## 3. Surface Work — flows (`governance/flows/`)

- [x] `full.yaml`: `select` declares `outputs: {success: [change_id]}`; `check_implement_bench`, `check_review_bench`, `dna_gate`, `dna_freshness`, `check_docs` key on `"${context.select.change_id}"` (quoted); `--outcome` quoted; `learn`/`dna_pr`/`document` inputs gain `change_id`; `dna_pr` branch keys on the id; descriptions updated.
- [x] `fast.yaml`: same treatment (`check_implement_bench`, `check_review_bench`, `check_docs`, `plan`/`document` inputs). Register mode untouched — there `${inputs.request}` IS the declared change-id.
- [x] `docs-onboarding.yaml`: audited — no command interpolates an input; no change.

## 4. Tests (`governance/__tests__/engine.test.mjs`)

- [x] Driver upgraded: answers accept `{outcome, output}`; `resumeWith`/`selectAnswer` helpers; every existing `select: "success"` site supplies `change_id`.
- [x] §7a rewritten to assert what bash saw (stdout + `vars`) instead of spliced command text.
- [x] §9a: hostile multiline request → full flow completes keyed to the change-id; no 127/`too many arguments`; raw request absent from every command; gates exit 0.
- [x] §9b/§9b-ii: leash fail-closed (missing → re-pause naming the key; unsafe → re-pause; valid → advances & persists) and outcome-scoped.
- [x] §9c: `parseResumeOutput` grammar accept/reject table.
- [x] §9d: metachar/multiline payload reaches bash byte-identical (`$(…)` not executed).
- [x] §9e: parser rejects malformed `outputs` at LOAD.

## 5. Documentation

- [x] [ADR-005](../../decisions/ADR-005-flow-values-as-data.md) — the `runs` interpolation contract changed (condition for an ADR met); registered in [docs/decisions/README.md](../../decisions/README.md).
- [x] `governance/README.md` (step table, expression convention, IoC resume grammar) + footer v0.6.
- [x] `docs/guides/flows.md` §3 (data-passing + single-quote caveat), §4 (outputs), §5 (resume grammar, example) + footer v0.6.
- [x] `commands/build.md` (resume grammar; report `change_id` on select) + footer v0.6.
- [x] Roadmap: feature line in [EPIC-flow-engine-leashes](../../roadmap/epics/EPIC-flow-engine-leashes.md); `ROADMAP.md` regenerated (line derives `in-progress` from this directory).
- [x] Change package complete (proposal, design, tasks, evidence).

## 6. Release

- [x] `.claude-plugin/plugin.json` `0.5.1` → `0.6.0` (PROCESS.md §5); `node governance/validators/check-plugin-version.js .` → exit 0.

## 7. Validation

- [x] `node governance/__tests__/engine.test.mjs` green; full `governance/__tests__/*.test.mjs` suite green (outputs in [evidence.md](evidence.md)).
- [x] Live CLI smoke (isolated `AIDAKIT_PROJECT_ROOT`): multiline request → select re-pauses until `change_id=…` → `check_implement_bench` exit 0 on the change-id path (capture in [evidence.md](evidence.md)).
- [x] `check-adr-format`, `check-links`, `derive-roadmap-status`, `check-plugin-version` → exit 0 (outputs in [evidence.md](evidence.md)).

## 8. Ship (separate step — out of scope for the implementer)

- [ ] Ship: conventional commit on the worktree branch, PR `fix(engine): key flow task paths to the reported change-id, pass runs values as data (ADR-005)` to main, **stop at the URL** — the merge is the human's (GOVERNANCE.md §1).
