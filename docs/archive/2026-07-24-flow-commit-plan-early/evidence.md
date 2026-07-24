# Evidence — flow-commit-plan-early

**Change ID:** `flow-commit-plan-early`
**Date:** `2026-07-24`
**Commit:** `38a83ac` — merged via PR [#24](https://github.com/chacal88/aidakit/pull/24)
**ADR:** [ADR-009](../../decisions/ADR-009-flow-commits-plan-early.md) (completes ADR-007)

## What proves it shipped

| Acceptance criterion | Evidence |
|---|---|
| Plan committed the moment it is authored | `governance/flows/full.yaml:79` — `commit_plan` `runs` step between `specify` (`on_success: commit_plan`) and `critic`; stages `docs/features/${context.select.change_id}/` and commits via env-passed data (ADR-006). |
| Fail-safe on empty/unresolved `change_id` | `test -n "${context.select.change_id}"` guard short-circuits when the id is empty; when unresolved the shell aborts on bad-substitution before any `git` runs — a bare `docs/features/` is never staged. |
| Fail-safe on commit hiccup | `on_success: critic` **and** `on_failure: critic` — a git failure routes forward, never blocks the flow or loops back; `aidakit:ship` still commits the remaining delta at the `pr` step. |
| No noise on revised plans | `git diff --cached --quiet` guard skips empty commits; multiple plan commits per feature branch are normal and squash at merge if desired. |
| Decision recorded (WORM) | [ADR-009](../../decisions/ADR-009-flow-commits-plan-early.md) accepted; index at `docs/decisions/README.md` links it under Flow engine; `check-adr-format` → ok. |
| Engine regressions | `engine.test` — 127/127 (unchanged by the new step). |

## Companion change

The shared-git side of the same bug was delivered by [`roadmap-status-from-shared-git`](../2026-07-24-roadmap-status-from-shared-git/proposal.md) (ADR-007, PR #21). This change closes its remaining window: the deriver can only see committed plans; the flow now commits them as soon as they exist.
