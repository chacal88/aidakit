# Proposal — flow-commit-plan-early

**Change ID:** `flow-commit-plan-early`
**Date:** `2026-07-24`
**Owner:** `@chacal88`
**Epic:** [Coleiras mecânicas do flow engine](../../roadmap/epics/EPIC-flow-engine-leashes.md)
**Status:** shipped — commit `38a83ac` (merged via PR [#24](https://github.com/chacal88/aidakit/pull/24)).

> Retroactive archive stub. This change shipped as a direct fix in the same commit that recorded ADR-009 (no `docs/features/` lifecycle), so its roadmap status is recorded here — the archive dir is the disk evidence the deriver reads for `done` (ADR-002, as amended by ADR-007).

## Problem

ADR-007 made the roadmap status single-valued by deriving it from the **shared git state** — the artifact dirs committed on any branch — instead of the local working tree. It left one window open, explicitly deferred: for a change's plan to reach the shared signal it must be **committed**. The `full` flow, however, authors the plan at `specify` (via `aidakit:plan`) but does not commit anything until the `pr` step, near the very end. For the entire middle of the flow the change lived only in the worktree that wrote it, and the roadmap kept showing `backlog` everywhere else — defeating ADR-007 precisely for the flows that motivated it.

## What shipped

A `commit_plan` `runs` step inserted immediately after `specify` in `governance/flows/full.yaml` (before `critic`). It stages `docs/features/${context.select.change_id}/` and commits it, so the plan enters the shared git state as soon as it is authored and the roadmap derives `in-progress` from any worktree/clone. The step is **best-effort and fail-safe**:

- Keyed on `${context.select.change_id}`, passed as environment data (`$AIDAKIT_VAR_n`, ADR-006). A `test -n` guard short-circuits when the id is empty; when the id is unresolved the shell aborts on bad-substitution **before** any `git` runs — so a bare `docs/features/` is never staged.
- Empty-commit guard (`git diff --cached --quiet`) prevents noise on revised plans.
- Both `on_success` and `on_failure` route to `critic`: a commit hiccup must never block the feature or loop the flow; `aidakit:ship` still commits the remaining delta at the `pr` step.

Recorded as **ADR-009** (completes ADR-007). Reliable population of `change_id` was delivered separately by `flow-request-vs-change-id`; until that landed the step safely no-oped.

## Acceptance (met)

- The `full` flow commits the authored plan the moment it exists, so the shared-git deriver sees it from any worktree/clone. ✔ (`governance/flows/full.yaml:79`, `commit_plan` step between `specify` and `critic`.)
- Fail-safe: empty/unresolved `change_id` → no-op; commit failure → routes to `critic`; never blocks or loops. ✔ (`test -n` guard + `on_success: critic`/`on_failure: critic`.)
- Decision recorded (WORM). ✔ ([ADR-009](../../decisions/ADR-009-flow-commits-plan-early.md); `check-adr-format` green.)
