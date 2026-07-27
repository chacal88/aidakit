# Evidence — per-flow-commands

**Change ID:** `per-flow-commands`
**Date:** `2026-07-27`
**Owner:** `@chacal88`
**Phase / Package:** `n/a (command-surface + generator; classification: domain=process, type=feature, flags=[architecture, contract], confirmed)`
**PRD:** `n/a`
**Tech Spec:** `n/a`

> Pre-execution stub. Everything below is filled during implementation with the **command and its output**, verbatim — no number or verdict ships here that a re-run of its own command does not reproduce (measure, don't recall). The plan-time baselines below are captured *before* any file changes so implementation-time results read against a real baseline; re-measure, do not copy.

## Plan-time baselines (capture before any change — Task 1)

_(filled at implementation start)_

- `node governance/validators/check-links.js .` → exit __, `{…}`
- `node governance/validators/check-plugin-version.js .` → exit __, `{…manifest…highest…}`
- Live `.claude-plugin/plugin.json` `version`: `__`; highest `aidakit vX.Y` footer in tree: `v__`.
- flow-build reference inventory: `grep -rnE "\baidakit:flow-build\b" --include="*.md" --include="*.yaml" --include="*.js" . | grep -vE "docs/archive|docs/features/per-flow-commands"` → __ hits (the set Task 7's leash drives to empty).

## Validation Outputs

_(filled during implementation — one entry per Exit criterion of [proposal.md](proposal.md#exit-criteria) and per Validation task of [tasks.md §8](tasks.md), command + output + exit code)_

- RED run — `node governance/__tests__/flow-command-generation.test.mjs` (before the generator exists) → exit __
- GREEN run — same test after Task 3 → exit __ (drift + behavior cases)
- Full suite — `governance/__tests__/*.mjs` → __
- `node governance/validators/check-adr-format.js docs/decisions/ADR-017-flow-command-generation.md` → exit __
- `node governance/validators/check-links.js .` → exit __
- `node governance/validators/check-plugin-version.js .` → exit __
- `node governance/validators/check-runtime-bump.js . --base origin/main` → exit __
- flow-build leash (`grep …`) → __ residual hits (each reasoned, or empty)
- absence/sentinel/usage-block leashes → __
- Manual post plugin-reload: `/aidakit:flow-fast <request>` observed pause / dispatch → __

## Acceptance evidence map

_(filled during implementation — each of the 10 acceptance ids from [proposal.md](proposal.md#acceptance-criteria) → the concrete case/command that proves it)_

| Acceptance id | Evidence (test case / command / file) | Result |
|---|---|---|
| `per-flow-start-shortcut` | | |
| `input-key-derived-from-yaml` | | |
| `full-lifecycle-self-contained` | | |
| `flow-name-command-rule` | | |
| `generator-single-source-of-truth` | | |
| `generator-consumer-sync-command` | | |
| `generator-fail-closed-collision` | | |
| `adr017-extends-flow-group` | | |
| `plugin-version-bumped` | | |
| `adr005-conventions-preserved` | | |

## Files Touched

_(filled during implementation — `git status --short` at completion)_

## Unresolved Deviations

_(filled during implementation — any deviation from [design.md](design.md)/[tasks.md](tasks.md), or "None")_
