# Evidence — acceptance-leash

**Change ID:** `acceptance-leash`
**Date:** `2026-07-24`
**Owner:** `@chacal88`
**Phase / Package:** `governance/ (validator + agent + flow wiring) — mechanical goal-leash on the PR gate`

> Pre-execution stub. The exact commands, outputs, files touched, and any unresolved deviations are recorded here during the `implement` phase.

## Validation Outputs

<!-- Fill in during implement. Expected shape (mirror engine-max-visits/evidence.md §Round 1):
- [ ] `node governance/__tests__/check-acceptance.test.mjs` → <N> passed, 0 failed.
- [ ] `node governance/__tests__/engine.test.mjs` → <total> passed, 0 failed (baseline 149 + §11 additions).
- [ ] Full suite per-file summary (mirror engine-max-visits table).
- [ ] `node governance/validators/check-adr-format.js docs/decisions/ADR-010-acceptance-leash.md` → exit 0.
- [ ] `node governance/validators/check-links.js docs/features/acceptance-leash docs/decisions` → exit 0.
- [ ] `node governance/validators/derive-roadmap-status.js --root .` → exit 0; acceptance-leash derives in-progress.
- [ ] Dogfooding: `node governance/validators/check-acceptance.js .aidakit/tasks/acceptance-leash/acceptance-manifest.json` → exit 0. -->

## Files Touched

<!-- Fill in during implement. Expected surfaces per proposal.md §Impact per surface:
NEW:
- governance/validators/check-acceptance.js
- governance/acceptance/parse-criteria.js
- governance/__tests__/check-acceptance.test.mjs
- governance/__tests__/brainstorm-schema.test.mjs (or extension of existing)
- agents/acceptance-planner.md
- docs/decisions/ADR-010-acceptance-leash.md

MODIFIED:
- governance/flows/full.yaml (3 new steps + 1 route edit)
- governance/flows/fast.yaml (3 new steps + 1 route edit)
- governance/__tests__/engine.test.mjs (new §11)
- agents/brainstorm.md (Output format §Acceptance criteria — id shape)
- skills/brainstorm/SKILL.md (schema reference)
- skills/plan/SKILL.md (## Acceptance criteria as MANDATORY proposal section)
- docs/decisions/README.md (index row + thematic grouping)
- docs/roadmap/epics/EPIC-flow-engine-leashes.md (Feature 2 delivered line — at ship time) -->

## Unresolved Deviations

<!-- Fill in during implement. Any assumption from design.md that changed against live code, any additional escalation, any decision the implementer had to make outside the plan. If empty at end of implement, write: "None." -->
