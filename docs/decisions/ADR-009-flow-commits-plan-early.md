<!-- File: docs/decisions/ADR-009-flow-commits-plan-early.md — global sequential numbering, never recycled. Registered in the index docs/decisions/README.md. -->
<!-- An ADR is WORM: never edit a past decision. Changed your mind → a new ADR that supersedes or amends this one. -->

# ADR-009: The full flow commits the plan when it is authored, so in-progress derives from shared git

- **Status:** accepted (completes [ADR-007](ADR-007-roadmap-status-from-shared-git.md))
- **Date:** 2026-07-24

## Context

[ADR-007](ADR-007-roadmap-status-from-shared-git.md) made the roadmap status single-valued by deriving it from the **shared git state** — the artifact dirs committed on any branch — instead of the local working tree. It left one window open, explicitly deferred: for a change's plan to reach that shared signal it must be **committed**. An authored-but-uncommitted plan lives only in the working tree that wrote it, so a flow running in a worktree still shows `backlog` everywhere else until much later.

The `full` flow authors the plan at `specify` (via `aidakit:plan`, writing `docs/features/<id>/`) but does not commit anything until the `pr` step (`aidakit:ship`), near the very end — after implement, review, hardening. So for the entire middle of the flow the change is invisible to the shared-git derivation, defeating ADR-007 precisely for the flows that motivated it.

There is precedent for committing mid-flow: `dna_pr` already commits the crystallized DNA on its own branch before the feature PR. Committing the plan the moment it exists is the same shape.

## Decision

Insert a `commit_plan` `runs` step immediately after `specify` succeeds (before `critic`). It stages `docs/features/${context.select.change_id}/` and commits it (skipping an empty commit), so the plan enters the shared git state as soon as it is authored and the roadmap derives `in-progress` from any worktree/clone.

The step is **best-effort and fail-safe**:

- Keyed on `${context.select.change_id}`, passed as environment **data** (`$AIDAKIT_VAR_n`, [ADR-006](ADR-006-flow-values-as-data.md)). A `test -n` guard short-circuits when the id is empty; when the id is *unresolved* the engine leaves the token literal and the shell aborts the command on bad-substitution **before** any `git` runs — so a bare `docs/features/` is never staged.
- Both `on_success` and `on_failure` route to `critic`. A commit hiccup must never block the feature or loop the flow; `aidakit:ship` still commits the remaining delta at the `pr` step.

Reliable population of `change_id` is delivered by `flow-request-vs-change-id` (structured `select` output). Until that lands, `commit_plan` simply no-ops on runs where `change_id` is not reported — it never misbehaves, it just does not yet fire.

## Consequences

- Positive: closes ADR-007's uncommitted-plan window for flow-driven work — a plan authored in a worktree is committed at once and becomes visible to the single-valued derivation everywhere; reuses the existing `runs` + env-data mechanism (no new engine surface); the mid-flow commit mirrors the established `dna_pr` pattern.
- Negative:
  - A plan revised later (`critic`/`readiness` → `specify`) produces a second plan commit rather than one clean commit — **Accepted** (the `git diff --cached --quiet` guard skips empty commits; multiple plan commits in one feature branch are normal and are squashed at merge if desired).
  - The step is inert until `flow-request-vs-change-id` makes `change_id` reliable — **Accepted** (it fails safe as a no-op in the meantime; no wrong behavior, only a deferred benefit).
  - Only the `full` flow is wired here — **Mitigated** (the other flows author plans through the same `aidakit:plan`; the same step can be added when their commit discipline is revisited, tracked on the engine-leashes epic).

### Review trigger

The revised-plan double-commit becoming noisy enough that `commit_plan` should amend instead of add; or the other flows needing the same early commit often enough to lift it into a shared step.

## Alternatives considered

| Option | Pros | Cons | Cost to undo |
|---|---|---|---|
| Leave commit at `pr`/`ship` only (status quo) | One commit point; simplest | ADR-007's shared signal stays empty for the whole flow — the bug it fixed persists for worktree flows | — |
| Deriver walks worktrees for uncommitted plans | Sees uncommitted work | Rejected in ADR-007 — ephemeral, local-only, fragile | medium |
| Make `aidakit:plan` itself commit | No new flow step | Buries a git side effect in a plan-authoring skill; harder to see/route; couples the skill to git state | medium |
| A `commit_plan` runs step after `specify`, best-effort & fail-safe (**chosen**) | Commits at the earliest honest point; reuses runs+env-data; never blocks | Inert until change_id is reliable; possible revised-plan double commit | low |
