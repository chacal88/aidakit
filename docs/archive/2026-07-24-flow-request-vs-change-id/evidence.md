# Evidence — flow-request-vs-change-id

**Change ID:** `flow-request-vs-change-id`
**Date:** `2026-07-24`
**Owner:** `@chacal88`
**Phase / Package:** `engine + flows (governance/) — bugfix with contract change (ADR-006)`
**PRD:** `n/a`
**Tech Spec:** `n/a`

## The bug, grounded

Live capture `.aidakit/flows/state/full-260724-ca264a.json` (started 2026-07-24T11:25Z with a free-form multiline `request`): `context.check_implement_bench` shows the raw request spliced into the command — every request line executed as a shell command:

```
"exit_code": 127,
"stderr": "bash: line 0: test: too many arguments
bash: line 1: ao: command not found
…
grep: .aidakit/tasks/estou: No such file or directory
…"
```

`on_failure: implement` then looped the flow between `implement` and the check gates indefinitely.

## Validation Outputs

- [x] `node governance/__tests__/engine.test.mjs` → **127 passed, 0 failed** (includes the new §9 suite: 9a multiline-request end-to-end, 9b/9b-ii fail-closed outputs leash, 9c resume-output grammar, 9d data-passing at the bash seam, 9e parser rejection at load).
- [x] Full suite `for t in governance/__tests__/*.test.mjs` → all green:
  ```
  candidates 8 · check-adr-format 8 · check-bench 20 · check-docs 8 · check-links 7
  dna-freshness 7 · dna-write 14 · engine 127 · ledger 8 · plugin-version 12
  roadmap 25 · yaml-min 17  —  0 failed
  ```
- [x] Live CLI smoke (isolated `AIDAKIT_PROJECT_ROOT`, flow `full-260724-fc9ec2`, request = 3 hostile lines including `-- test: too many arguments` and `$(echo injected)`):
  - `resume … success` (no change_id) → re-paused at `select`: `Outcome "success" for step "select" needs its declared outputs: missing required output "change_id".`
  - `resume … success 'change_id=two words'` → usage error before touching state: `invalid resume output value for "change_id": must be a single safe token (^[A-Za-z0-9._:@/-]+$)`
  - `resume … success change_id=smoke-change` → advanced to `classify`; driven on to `review_bench`, the previously-exploding gate recorded:
    ```
    check_implement_bench: exit 0
    command: test ! -f ".aidakit/tasks/$AIDAKIT_VAR_0/bench.ndjson" || … 
    vars: { "AIDAKIT_VAR_0": "smoke-change" }
    stderr: ""
    ```
- [x] `node governance/validators/check-adr-format.js docs/decisions/ADR-006-flow-values-as-data.md` → `OK — 1 ADR(s), valid format.` (exit 0; renumbered ADR-005→ADR-006 in the merge with main, which minted ADR-005-command-namespacing first — numbering is global, never recycled)
- [x] `node governance/validators/check-plugin-version.js .` → exit 0 with manifest `0.6.1` (post-merge; main's `command-grouping-and-inputs` took `0.6.0`).
- [x] `node governance/validators/derive-roadmap-status.js --root .` → exit 0; `flow-request-vs-change-id` derives **in-progress** (this plan directory, via `hasInFlightArtifacts`); `ROADMAP.md` regenerated accordingly (one line added to Now; no other line touched).
- [x] `node governance/validators/check-links.js docs/features/flow-request-vs-change-id docs/decisions docs/guides governance/README.md commands/flow-build.md` → exit 0 across all touched doc surfaces.

## Files Touched

- `governance/engine/resume-output.js` (new) · `interpolate.js` · `steps/runs.js` · `steps/invoke.js` · `engine.js` · `parser.js` · `types.js` · `governance/cli.js`
- `governance/flows/full.yaml` · `governance/flows/fast.yaml` (`docs-onboarding.yaml` audited, unchanged — no command interpolates an input)
- `governance/__tests__/engine.test.mjs`
- `docs/decisions/ADR-006-flow-values-as-data.md` (new) · `docs/decisions/README.md`
- `governance/README.md` · `docs/guides/flows.md` · `commands/flow-build.md` (footers → v0.6)
- `docs/roadmap/epics/EPIC-flow-engine-leashes.md` · `docs/roadmap/ROADMAP.md`
- `docs/features/flow-request-vs-change-id/{proposal,design,tasks,evidence}.md` (this package)
- `.claude-plugin/plugin.json` (→ `0.6.1`)

## Ship

- Shipped in [PR #18](https://github.com/chacal88/aidakit/pull/18) `fix(engine): key flow task paths to the reported change-id; pass runs values as data (ADR-005)` (merged 2026-07-24; commit `c43205f`). The ADR was renumbered `ADR-005` → `ADR-006` in the merge with `command-grouping-and-inputs` (which took `ADR-005` first — global numbering, never recycled).
- Package archive tracked separately (this PR): `git mv docs/features/flow-request-vs-change-id docs/archive/2026-07-24-flow-request-vs-change-id/` + roadmap regen.

## Unresolved Deviations

- None in scope. Known adjacent debts stay declared on the roadmap, untouched: `engine-max-visits` (the retry cap that would have bounded the observed infinite loop) and `runs-error-routing` (infra-error vs verdict routing).
- The pre-fix broken run `full-260724-ca264a` is not migrated (proposal non-goal 2) — abort it and start fresh.
