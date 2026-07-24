# Proposal — archive-loop-var-resume

**Change ID:** `archive-loop-var-resume`
**Date:** `2026-07-23`
**Owner:** `@chacal88`
**Phase / Package:** `n/a (fast flow — bookkeeping / doc archival)`
**PRD:** `n/a`
**Tech Spec:** `n/a`

## Why

`loop-var-resume` shipped and merged (PR [#5](https://github.com/chacal88/aidakit/pull/5), merged `2026-07-22T19:54:51Z`), but its change directory was never promoted out of the working area — `docs/features/loop-var-resume/` still sits alongside live work. Per DOCS.md §4, a completed change's directory moves to `archive/YYYY-MM-DD-<change-id>/` at the human promotion gate; that gate was skipped at the time and parked as a roadmap debit (feature "Arquivamento do loop-var-resume (bookkeeping)" in [EPIC-flow-engine-leashes](../../roadmap/epics/EPIC-flow-engine-leashes.md), lines 19–20). This change resumes that debit and performs exactly the parked acceptance — nothing more.

## What Changes

- `docs/features/loop-var-resume/` (4 files) moved via `git mv` to `docs/archive/2026-07-22-loop-var-resume/`. Date prefix = the PR #5 merge date (`2026-07-22`), matching the naming precedent of [add-debit](../../archive/2026-07-22-add-debit/proposal.md) and [validator-path-resolution](../../archive/2026-07-23-validator-path-resolution/proposal.md).
- The move is content-identical (WORM archival, as-is): no file inside the moved directory is edited — `git` records 4 renames at 100% similarity.
- **`ROADMAP.md` regenerated** — this change's own plan directory (`docs/features/archive-loop-var-resume/`) durably flips its own declared line (`archive-loop-var-resume`: `backlog` → `in-progress`) via `hasInFlightArtifacts`, a pure on-disk check with no branch dependency; the Aceite's regen conditional ("apenas se a visão derivada mudar") is triggered and the file is regenerated to match (reasoning in [design.md](design.md)).
- No code, no ADR, no spec delta, no plugin version bump.

## Non-goals

1. **The two known-broken sibling links in existing archives are NOT touched** — [add-debit/proposal.md:46](../../archive/2026-07-22-add-debit/proposal.md) and [validator-path-resolution/proposal.md:34](../../archive/2026-07-23-validator-path-resolution/proposal.md) both link `../loop-var-resume/proposal.md`. They were already broken before this move (their target never lived under `docs/archive/`), and stay broken after (the correct target now carries the `2026-07-22-` date prefix). WORM forbids editing archived files. Pre-existing debt, out of scope.
2. **The stray worktree `.claude/worktrees/loop-var-resume-bug-e0a1ce` (detached HEAD) is ignored** — different id, no claim on these paths; cleanup is not in the acceptance.
3. **This change never flips a roadmap line to `done`.** The `mv` archives a *different* id (`loop-var-resume`, undeclared on the roadmap) — that half derives no line, matching the Aceite's "change não declarado no roadmap na época". Separately, this change's **own** declared line, `archive-loop-var-resume`, DOES flip — `backlog` → `in-progress`, durably, the moment its plan directory lands on disk (`hasInFlightArtifacts`, no branch dependency; see [design.md](design.md)) — but never to `done`: that only happens when `docs/features/archive-loop-var-resume/` is itself later archived (the accepted recursive tail, same shape as `add-debit`/`validator-path-resolution`, which each needed a later, separate archival commit to reach `done`). No line reaches `done` as a result of this change; `ROADMAP.md` IS regenerated per the Aceite's own conditional ("regen do `ROADMAP.md` apenas se a visão derivada mudar" — it did).

## Affected capabilities

Documentation archival only (`docs/features/` → `docs/archive/`, DOCS.md §4). No `docs/specs/` exists in this repo and this change creates or modifies no capability spec, so **no spec delta**. No behavioral surface changes.

## Impact per surface

| Surface | Impact |
|---|---|
| `docs/` | `git mv docs/features/loop-var-resume` → `docs/archive/2026-07-22-loop-var-resume/` (4 renames, R100); this change directory |
| `governance/` | none (validators are run, not edited) |
| `agents/` · `commands/` · `skills/` · `hooks/` | none |

## Dependencies

`loop-var-resume` PR #5 merged — satisfied (`2026-07-22`). Self-contained and reversible (a single `git mv` back).

## Exit criteria

- `docs/features/loop-var-resume/` no longer exists; `docs/archive/2026-07-22-loop-var-resume/` holds the same 4 files, unmodified.
- `node governance/validators/derive-roadmap-status.js --root .` → exit 0 (green) after the move.
- `node governance/validators/check-links.js docs/archive/2026-07-22-loop-var-resume` → exit 0 (the moved directory's own internal links still resolve).
- `git diff --cached` shows exactly 4 renames at 100% similarity, no content edits.
- `docs/roadmap/ROADMAP.md` regenerated: `archive-loop-var-resume` line reads `in-progress` (was `backlog`); no other line changes.
- Evidence recorded in [evidence.md](evidence.md); PR `chore(docs): archive loop-var-resume` opened to main and stopped at the URL — the merge is the human's (GOVERNANCE.md §1).

## Unblocks

Closes the last non-thematic bookkeeping debit on [EPIC-flow-engine-leashes](../../roadmap/epics/EPIC-flow-engine-leashes.md); the working area (`docs/features/`) is left holding only in-flight changes.

## Recorded decisions and inherited open decisions

- Read the [decisions index](../../decisions/README.md): [ADR-002](../../decisions/ADR-002-roadmap-status-derived-from-disk.md) **constrains the regen decision** — `ROADMAP.md` is a generated snapshot of the disk truth, regenerated whenever the derived view durably changes (here: `archive-loop-var-resume` backlog → in-progress, driven by its own plan dir, no branch dependency) (see [design.md](design.md)). [ADR-001](../../decisions/ADR-001-executable-dna-crystallization.md), [ADR-003](../../decisions/ADR-003-shared-knowledge-in-docs.md) and [ADR-004](../../decisions/ADR-004-aidakit-governance-env-contract.md) are not touched. No contradiction; no new ADR.
- No open-decisions log exists in this repo; nothing inherited.
