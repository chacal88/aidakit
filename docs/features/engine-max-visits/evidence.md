# Evidence — engine-max-visits

**Change ID:** `engine-max-visits`
**Date:** `2026-07-24`
**Owner:** `@chacal88`
**Phase / Package:** `engine + flows (governance/) — mechanical loop cap on back-edges`

## Validation Outputs

### Round 1 (implementation-first, authoritative)

- [x] `node governance/__tests__/engine.test.mjs` → **149 passed, 0 failed** (up from 127 — §10 added 22 assertions covering parser rejection, mechanism dispatch count, `full.yaml` schema, and end-to-end drive).
- [x] Full suite — result per file:
  ```
  candidates.test.mjs       :: 8 passed, 0 failed
  check-adr-format.test.mjs :: 8 passed, 0 failed
  check-bench.test.mjs      :: 20 passed, 0 failed
  check-docs.test.mjs       :: 8 passed, 0 failed
  check-links.test.mjs      :: 7 passed, 0 failed
  dna-freshness.test.mjs    :: 7 passed, 0 failed
  dna-write.test.mjs        :: 14 passed, 0 failed
  engine.test.mjs           :: 149 passed, 0 failed
  ledger.test.mjs           :: 8 passed, 0 failed
  plugin-version.test.mjs   :: 12 passed, 0 failed
  pr-automation.test.mjs    :: 161 passed, 0 failed
  progress-table.test.mjs   :: 30 passed, 0 failed
  roadmap.test.mjs          :: 28 passed, 0 failed
  yaml-min.test.mjs         :: 17 passed, 0 failed
  ```
  No regressions across any surface.
- [x] `node governance/validators/derive-roadmap-status.js --root .` → exit 0; `engine-max-visits → in-progress` derived from the presence of `docs/features/engine-max-visits/`.
- [x] `node governance/validators/check-links.js docs/features/engine-max-visits` → exit 0 (all internal links resolve).

## Deviations from the plan

- **Off-by-one on the first cut of the visit counter (round 1 dev loop).** First implementation incremented on every `drive()` entry into the step, which double-counts invoke/human_gate steps (they traverse `drive()` twice per logical visit: once to pause, once to consume the resume). Test §10b caught it (`workDispatches=2 got 2`, expected 3). Fix: gate the increment on `resumeValue === undefined && resumeOutput === undefined` — one visit = one count regardless of pause semantics. All 149 assertions green after the fix. This is now documented in [design.md](design.md) §Mechanism and in the inline comment above the check.

## Notes for reviewers

- The check runs BEFORE `logEvent step_start`, so a capped entry does NOT emit a spurious `step_start` — the event stream stays truthful.
- The counter persists in `state.context.__visits`, which is serialized by the existing `saveState` — no new persistence code.
- Fail-closed at both layers: the parser rejects `max_visits` without `on_max_visits` at LOAD, and the runtime backstops it with a `failed` outcome if a hand-crafted state ever slips through.
