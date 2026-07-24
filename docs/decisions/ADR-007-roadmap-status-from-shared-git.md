<!-- File: docs/decisions/ADR-007-roadmap-status-from-shared-git.md — global sequential numbering, never recycled. Registered in the index docs/decisions/README.md. -->
<!-- An ADR is WORM: never edit a past decision. Changed your mind → a new ADR that supersedes or amends this one. -->

# ADR-007: The roadmap derives status from the shared git state, so it is single-valued across worktrees

- **Status:** accepted (amends [ADR-002](ADR-002-roadmap-status-derived-from-disk.md))
- **Date:** 2026-07-24

## Context

[ADR-002](ADR-002-roadmap-status-derived-from-disk.md) decided the roadmap never hand-writes a status: `derive-roadmap-status.js` reads reality and computes it. Its central promise — "the roadmap cannot drift" — rested on an unstated premise: **there is one disk**. The `in-progress` check was `existsSync(docs/features/<id>/)` on the local working tree.

That premise breaks under **git worktrees**. A worktree is a second working tree sharing one `.git`, and the kit's own flows run in them (Claude Code's `isolation: worktree`, the `.claude/worktrees/*` trees). Two facts make the working tree the wrong source of truth:

- `docs/features/<id>/` is a *working-tree* path — a change planned in worktree A physically exists in A's tree, not in main's. A deriver run in main `existsSync`-es nothing and answers `backlog`; the same deriver run in A answers `in-progress`. **The status now depends on WHERE you ask** — the exact drift ADR-002 set out to kill, reintroduced by geometry instead of by a stale field.
- `.aidakit/` (the engine's flow state) is gitignored, so it is per-worktree and cannot be the reconciler either.

Observed directly: a `full` flow authored `docs/features/flow-run-progress-table/` while, in the main tree, `derive-roadmap-status.js --root .` still reported `backlog`. Walking every worktree from the deriver was rejected as unviable — worktrees are ephemeral (auto-removed), local to one machine, and a filesystem sweep is fragile.

The one thing every worktree — and every clone — shares is the **git object store and refs**. So the fix is to derive from that shared substrate, not the local working tree.

## Decision

`derive-roadmap-status.js` additionally reads the **committed** artifact dirs across **all refs** (`refs/heads` + `refs/remotes`): for each ref, one `git ls-tree -d docs/features/ docs/archive/` yields the change-id dirs committed on that branch. These become `gitFeatureIds` / `gitArchiveDirs`, injected into `deriveRoadmap` exactly as the pre-existing `prChangeIds` / `branchChangeIds` git heuristics already were — so `roadmap.js` stays pure and unit-testable, with no git spawn of its own.

`deriveChangeStatus` **unions** each disk check: a change is `in-progress` / `done` if its dir is committed on **any** branch (the shared, single-valued signal) **OR** present in the local working tree (which still catches your own not-yet-committed work). Because refs are shared, the committed half of the answer is **identical from any working tree or clone** — the roadmap is single-valued again. Cost is `O(branches)`, not `O(worktrees)`: a handful of millisecond `ls-tree` calls, never a worktree filesystem walk. With git absent or erroring, the injected sets are empty and derivation falls back to the local working tree — byte-for-byte the pre-ADR-007 behavior, never a throw.

For a change to reach the **shared** signal its plan must be **committed**; an authored-but-uncommitted plan is visible only in the tree that wrote it. That is deliberate — uncommitted work is not yet shared reality — and it is the reason the flow should commit the plan early (tracked separately; not decided here).

## Consequences

- Positive: the derived status is single-valued across worktrees and clones — the same question gets the same answer everywhere, restoring ADR-002's "cannot drift" promise under a multi-worktree reality; the fix reuses the existing `ctx`-injection seam, so `roadmap.js` gains no dependency and no impurity; graceful degradation to disk-only is preserved.
- Negative:
  - A plan authored but **not yet committed** in one worktree is invisible to the shared status (still shows there via the local-tree union, but not elsewhere) — **Accepted** (uncommitted work is not shared reality; the early-plan-commit follow-up closes the window for flow-driven work).
  - Scanning `refs/remotes` can surface a dir on a stale/abandoned remote branch as `in-progress` — **Mitigated** (a merged change is `done` via `archive/`, which outranks `in-progress`; an abandoned branch is a pre-existing looseness the `branchChangeIds` heuristic already carried).
  - Per-ref `ls-tree` cost grows with branch count — **Accepted** (one cheap call per ref; even hundreds of branches stay well under a second, and the deriver is not on a hot path).

### Review trigger

Branch counts large enough that per-ref `ls-tree` becomes perceptible (batch via a single `git log --all`-style pass instead); or the uncommitted-plan blind spot biting often enough that the flow must be made to commit the plan the moment it is authored.

## Alternatives considered

| Option | Pros | Cons | Cost to undo |
|---|---|---|---|
| Keep `existsSync` on the local working tree (ADR-002 as written) | Simplest; zero git | Status depends on which worktree asks — drift by geometry; the reported bug | — |
| Deriver walks every worktree (`git worktree list` + stat each tree) | Sees uncommitted work in other trees | Worktrees are ephemeral & local-only; fragile filesystem sweep; nothing for other clones; the option the owner rejected | medium |
| Write status into a shared ledger the engine updates | Any state expressible; instant | Resurrects the hand-maintained field ADR-002 exists to reject — a ledger drifts | medium |
| Derive from shared git refs, union with local tree (**chosen**) | Single-valued across worktrees/clones; reuses the injection seam; degrades to disk-only | Shared signal needs a commit; a per-ref call per branch | low |
