# Evidence — roadmap-status-from-shared-git

**Change ID:** `roadmap-status-from-shared-git`
**Date:** `2026-07-24`
**PR:** [#21](https://github.com/chacal88/aidakit/pull/21) — merged `1e5019b`
**ADR:** [ADR-007](../../decisions/ADR-007-roadmap-status-from-shared-git.md) (amends ADR-002)

## What proves it shipped

| Acceptance criterion | Evidence |
|---|---|
| Status single-valued across worktrees (committed work) | `governance/roadmap/roadmap.js` unions `gitFeatureIds`/`gitArchiveDirs` (committed on any branch) with the local tree; `derive-roadmap-status.js` reads them via `git ls-tree` per ref. |
| Behavioral coverage | `governance/__tests__/roadmap.test.mjs` — **28/28**, incl. committed-dir-on-another-branch → `in-progress`/`done`, and no-git degradation. |
| Decision recorded (WORM) | ADR-007 accepted; ADR-002 gained an `## Amendments` section pointing to it; `check-adr-format` → ok. |
| Live proof | On the repo, `git ls-tree -d <ref> docs/features/` located a feature dir committed on a worktree branch **without** touching the worktree filesystem — the mechanism the deriver now uses. |

## Follow-up (separate change)

For an in-flight plan to reach the **shared** signal it must be committed. The full flow now commits the plan when it is authored — recorded in **ADR-009** (`commit_plan` step). That closes the window where an authored-but-uncommitted plan is visible only in its own worktree.
