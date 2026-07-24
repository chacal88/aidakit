# Evidence — acceptance-leash

**Change ID:** `acceptance-leash`
**Date:** `2026-07-24`
**Owner:** `@chacal88`
**Phase / Package:** `governance/ (validator + agent + flow wiring) — mechanical goal-leash on the PR gate`

> Filled in during `implement`. Anti-drift re-inspection (GOVERNANCE.md §8) confirmed all of design.md's assumptions against live code before coding began — no divergence found.

## Validation Outputs

**Round 1 — full TDD pass (§2–§8), executed 2026-07-24:**

- `node governance/__tests__/brainstorm-schema.test.mjs` → 24 passed, 0 failed (parse-criteria.js legacy/new/plan shapes, precedence, absence, and the acceptance-planner.md structural contract §4a).
- `node governance/__tests__/check-acceptance.test.mjs` → 19 passed, 0 failed (evidence-missing, all-resolved, n/a+condition skip, n/a-without-condition → manifest-invalid, `#anchor` stripping, missing `required` → manifest-invalid, `required: []` → manifest-invalid (readiness §12 nit), JSON output contract).
- `node governance/__tests__/engine.test.mjs` → 200 passed, 0 failed (baseline 149 + new §11 wiring/mechanism tests + assertion growth in the updated §2/§9 driveDry scenarios that now traverse the acceptance-leash).
- Full suite per-file summary (`for f in governance/__tests__/*.test.mjs; do node "$f"; done`, 16 files, 571 total assertions):

  | File | Result |
  |---|---|
  | brainstorm-schema.test.mjs | 24 passed, 0 failed |
  | candidates.test.mjs | 8 passed, 0 failed |
  | check-acceptance.test.mjs | 19 passed, 0 failed |
  | check-adr-format.test.mjs | 8 passed, 0 failed |
  | check-bench.test.mjs | 20 passed, 0 failed |
  | check-docs.test.mjs | 8 passed, 0 failed |
  | check-links.test.mjs | 7 passed, 0 failed |
  | dna-freshness.test.mjs | 7 passed, 0 failed |
  | dna-write.test.mjs | 14 passed, 0 failed |
  | engine.test.mjs | 200 passed, 0 failed |
  | ledger.test.mjs | 8 passed, 0 failed |
  | plugin-version.test.mjs | 12 passed, 0 failed |
  | pr-automation.test.mjs | 161 passed, 0 failed |
  | progress-table.test.mjs | 30 passed, 0 failed |
  | roadmap.test.mjs | 28 passed, 0 failed |
  | yaml-min.test.mjs | 17 passed, 0 failed |

- `node governance/validators/check-adr-format.js docs/decisions/ADR-010-acceptance-leash.md` → exit 0.
- `node governance/validators/check-links.js docs/features/acceptance-leash docs/decisions` → exit 0.
- `node governance/validators/derive-roadmap-status.js --root .` → exit 0; `acceptance-leash` derives `in-progress`.
- Dogfooding: **deferred** — `node governance/validators/check-acceptance.js .aidakit/tasks/acceptance-leash/acceptance-manifest.json` requires `aidakit:acceptance-planner` to have run inside a real flow session first (the manifest is the agent's deliverable, not the implementer's — see design.md §Agent contract and this change's own tasks.md §4). The flow reaches the `acceptance` step itself, later, when this change's own PR runs the wired `full` flow past `implement`; not reproducible synthetically without fabricating the agent's output.

## Per-criterion evidence (brainstorm.json `acceptance_criteria[]`, dogfooding this change's own leash)

| # | Criterion | Evidence | Status |
|---|---|---|---|
| 1 | New agent `aidakit:acceptance-planner` exists (mirrors `aidakit:doc-planner` shape) | [agents/acceptance-planner.md](../../../agents/acceptance-planner.md); structural contract asserted in [governance/__tests__/brainstorm-schema.test.mjs](../../../governance/__tests__/brainstorm-schema.test.mjs) §4a | resolved |
| 2 | New validator `check-acceptance.js` mirrors `check-doc-manifest.js`'s output contract | [governance/validators/check-acceptance.js](../../../governance/validators/check-acceptance.js); [governance/__tests__/check-acceptance.test.mjs](../../../governance/__tests__/check-acceptance.test.mjs) | resolved |
| 3 | `full.yaml` gains `acceptance` + `check_acceptance` with `max_visits`/`on_max_visits` | [governance/flows/full.yaml](../../../governance/flows/full.yaml); [governance/__tests__/engine.test.mjs](../../../governance/__tests__/engine.test.mjs) §11a/§11b/§11c | resolved |
| 4 | `fast.yaml` gains the same two steps, wired to the plan's criteria (no brainstorm dependency) | [governance/flows/fast.yaml](../../../governance/flows/fast.yaml); [governance/__tests__/engine.test.mjs](../../../governance/__tests__/engine.test.mjs) §11a/§11d | resolved |
| 5 | `aidakit:brainstorm` skill+agent updated to emit `acceptance_criteria[]` in a consumable shape | [agents/brainstorm.md](../../../agents/brainstorm.md) Output format §Acceptance criteria; [skills/brainstorm/SKILL.md](../../../skills/brainstorm/SKILL.md) §4; [governance/acceptance/parse-criteria.js](../../../governance/acceptance/parse-criteria.js) | resolved |
| 6 | New ADR documenting separate agent / weak-bar / both flows / `max_visits` day one | [docs/decisions/ADR-010-acceptance-leash.md](../../decisions/ADR-010-acceptance-leash.md) | resolved |
| 7 | `engine.test.mjs` gains coverage: pass / fail-loops-back / max_visits-exhaustion-escalates | [governance/__tests__/engine.test.mjs](../../../governance/__tests__/engine.test.mjs) §11a–§11d | resolved |

## Files Touched

**NEW:**
- `governance/validators/check-acceptance.js`
- `governance/acceptance/parse-criteria.js`
- `governance/__tests__/check-acceptance.test.mjs`
- `governance/__tests__/brainstorm-schema.test.mjs`
- `agents/acceptance-planner.md`

**MODIFIED:**
- `governance/flows/full.yaml` (`check_docs.on_success` re-routed; `acceptance` + `check_acceptance` + `acceptance_escalation` steps inserted)
- `governance/flows/fast.yaml` (same wiring, `criteria_source: "plan"`)
- `governance/__tests__/engine.test.mjs` (new §11; existing §2/§9 driveDry scenarios extended with `seedSatisfiedAcceptanceManifest` + the `acceptance` pause)
- `governance/__tests__/pr-automation.test.mjs` (its own `full`/`fast` end-to-end drives extended the same way — a regression this implementer found and fixed, not anticipated by tasks.md's file list)
- `agents/brainstorm.md` (Output format §Acceptance criteria — id shape)
- `skills/brainstorm/SKILL.md` (schema reference, §4)
- `skills/plan/SKILL.md` (`## Acceptance criteria` as MANDATORY proposal section)
- `docs/features/README.md` (proposal-template note, §2b)
- `docs/decisions/ADR-010-acceptance-leash.md` (already authored in the plan phase; one broken relative link fixed — see Unresolved Deviations)
- `docs/features/acceptance-leash/proposal.md` (one broken relative link fixed — see Unresolved Deviations)
- `docs/decisions/README.md` — already registered in the plan phase (index row + thematic grouping); re-verified, no change needed
- `docs/features/acceptance-leash/tasks.md` (checkboxes marked as each task landed)

**DEFERRED (per tasks.md §9, explicitly ship-time, not implement):**
- `docs/roadmap/epics/EPIC-flow-engine-leashes.md` Feature 2 "Delivered" line — appended at ship time, once the PR number is known.

## Findings from bench round 1 (rejected — fixed in this round)

**Round 1 verdict: rejected.** Two blocking findings, plus five non-blocking improvements landed in the same round (per the bench dispatch instructions — no separate round for the nits/tester follow-ups).

- **Finding A (BLOCKER — architecture: `parse-criteria.js` was dead code).** `check-acceptance.js` never imported the module and the agent has no `Bash` tool to shell out to it — the only runtime caller was `brainstorm-schema.test.mjs`'s structural test, so ADR-010 §Decision 3's "single-owner" claim was illusory (drift between the agent's LLM-judgment re-derivation and the module would never be caught). **Fix:** `check-acceptance.js` now imports `parseCriteria` and cross-validates the manifest against the parser's live output from the change's real source — every criterion the parser finds must have a `required[]` entry by id (new `criterion-orphan` error rule, exit 1); JSON output gains a `parsed_criteria` count. `ADR-010` Decision 3 gained a sentence naming `check-acceptance.js` as the enforcement point. 3 new tests in `check-acceptance.test.mjs`: orphan detection, clean pass when the manifest covers every parsed id, and the proposal.md fallback path (brainstorm.json absent).
- **Finding B (IMPORTANT — quality: empty-slug fallback).** Blank/whitespace-only/punctuation-only criterion prose produced empty ids (`""`) or dash-only ids (`"-2"`, `"-3"`) from `slugify()`. **Fix:** both `fromBrainstorm()` and `fromProposal()` in `parse-criteria.js` now fall back to a positional `criterion-<index>` id when the normalized slug strips to empty, before handing to `dedupeSlug()`. Covered by 2 new tests in `brainstorm-schema.test.mjs` (brainstorm-string path and proposal.md plain-bullet path), feeding `["", "   ", "!!!", "!!!"]`-style inputs.
- **Finding C (nits — quality comments, no restructuring).** One-line comments added at `check-acceptance.js`'s two exit-2 paths (the bad-JSON path emits stderr only; the missing/empty `required` path deliberately DOES emit a full JSON envelope — an intentional asymmetry, not an oversight) and at `parse-criteria.js`'s `dedupeSlug()` (rewriting a duplicate explicit id is intentional collision safety).
- **Finding D (tester follow-ups — 4 tests, severity 7/7/5/4).** (1) `check-acceptance.test.mjs`: `status:"resolved"` with a non-existent `evidence.path` still produces `evidence-missing` (guards "resolved is not trusted"). (2) `engine.test.mjs` §11e: a broken acceptance-manifest fixed before the 2nd `acceptance` round — flow completes, `check_acceptance` dispatches < 3 (recovery test). (3) `check-acceptance.test.mjs`: `evidence.path` pointing at an existing directory (not a file) → `evidence-missing` (exercises `isFile()`). (4) `brainstorm-schema.test.mjs`: malformed `brainstorm.json` (JSON.parse throws) falls back to `proposal.md` cleanly.

**Round 2 validation, re-executed after all five findings landed:**

- `for f in governance/__tests__/*.test.mjs; do node "$f"; done` — all 16 files 0-failed. Deltas from round 1's baseline: `brainstorm-schema.test.mjs` 24 → 34 passed; `check-acceptance.test.mjs` 19 → 31 passed; `engine.test.mjs` 200 → 204 passed. All other files unchanged.
- `node governance/validators/check-adr-format.js docs/decisions/ADR-010-acceptance-leash.md` → exit 0 (still valid after the Decision 3 addendum).

## Unresolved Deviations

- **Two pre-existing broken relative links, fixed during implement (not an escalation — plain doc hygiene within scope):**
  1. `docs/decisions/ADR-010-acceptance-leash.md`'s link to `EPIC-flow-engine-leashes.md` used `../../roadmap/epics/...` (two levels up from `docs/decisions/`, landing outside `docs/`) instead of `../roadmap/epics/...`. Fixed to the correct relative depth.
  2. `docs/features/acceptance-leash/proposal.md`'s reference to the sibling in-flight change `context-pack-l1` linked to `../context-pack-l1/`, a directory that does not exist in this worktree (that change lives on a separate branch, per the flow's own coordination note — confirmed via `git log --all` showing `context-pack-l1` commits absent from this branch's history). Converted to plain text (no link) since fabricating the directory would misrepresent the repo's real state; the coordination note itself is still accurate content.
  Both were caught by task §8's `check-links.js` exit-criterion gate, which is why they surfaced here rather than earlier.
- **`governance/__tests__/pr-automation.test.mjs` was not named in proposal.md/design.md/tasks.md as a file to touch, but it independently drives `full`/`fast` through the exact `document → check_docs → pr` tail this change rewires.** Anti-drift re-inspection during implement (before editing the flow YAMLs) had already surfaced `engine.test.mjs` as the file with equivalent end-to-end drives; `pr-automation.test.mjs` was found only after the full-suite run in task §8 caught the regression (`no answer for pause "acceptance"`), root-caused, and fixed with the same `seedSatisfiedAcceptanceManifest` pattern used in `engine.test.mjs`. This is exactly the class of finding GOVERNANCE.md §8 anticipates re-inspection catching before it reaches review — recorded here as a correction event, not an escalation (no scope/ADR conflict; the fix is mechanical and mirrors the established pattern).
- No assumption from design.md changed against live code. No ADR conflict. No scope expansion beyond the approved tasks.
