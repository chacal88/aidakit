# Design — archive-loop-var-resume

**Change ID:** `archive-loop-var-resume`
**Date:** `2026-07-23`
**Owner:** `@chacal88`
**Phase / Package:** `n/a (fast flow — bookkeeping / doc archival)`
**PRD:** `n/a`
**Tech Spec:** `n/a`

## The archival move (pure `git mv`, content-identical)

```
git mv docs/features/loop-var-resume docs/archive/2026-07-22-loop-var-resume
```

- **Date prefix `2026-07-22`** = the merge date of `loop-var-resume`'s PR #5 (`2026-07-22T19:54:51Z`), per DOCS.md §4 ("the change directory goes to `archive/YYYY-MM-DD-<change-id>/`"). Precedent: `docs/archive/2026-07-22-add-debit/` and `docs/archive/2026-07-23-validator-path-resolution/` are both content-identical moves of a completed change directory.
- **§4, not §2 rule 6.** DOCS.md §2 rule 6 (legacy banner + anti-link-rot stub) governs *decision/reference* docs (ADRs). Change-artifact archival is DOCS.md §4: a plain promotion move of the working directory — **no banner, no stub, no content edit**. The two existing archives confirm this: neither carries a legacy banner. WORM archives the change dir as-is.

## The regen decision (load-bearing)

`ROADMAP.md` is a *generated* snapshot ([ADR-002](../../decisions/ADR-002-roadmap-status-derived-from-disk.md)): status derives from the disk, strongest evidence first (archived → `done`; open PR → `in-review`; `docs/features/<id>/` → `in-progress`; branch but no artifacts → `planned`; declared but nowhere → `backlog`). Two independent facts decide whether the move requires a regen — they point in opposite directions, and both must be checked:

1. **The `mv` itself changes no *declared* change's on-disk footprint.** `loop-var-resume` is **undeclared** on the roadmap (no feature line says `changes: loop-var-resume`); it is the *subject* of the `archive-loop-var-resume` feature, not a declared id itself. Relocating an undeclared id from `features/` to `archive/` derives nothing new — no status line moves *because of the mv*. This half of the original reasoning was correct (same shape as the `validator-path-resolution` archival, also undeclared, which regenerated nothing).

2. **This change's OWN plan directory durably flips its OWN declared line — this half of the earlier draft was wrong.** `archive-loop-var-resume` IS declared (`EPIC-flow-engine-leashes.md`, feature "Arquivamento do loop-var-resume (bookkeeping)"). The deriver's real mechanism is `deriveChangeStatus` → `hasInFlightArtifacts` ([governance/roadmap/roadmap.js:41-57](../../../governance/roadmap/roadmap.js)): a pure `existsSync(docs/features/<changeId>)` check, with **no branch-name heuristic and no dependency on git state at all**. There is no `getStatus` branch-matching function — that function does not exist in the deriver. `docs/features/archive-loop-var-resume/` existing on disk is sufficient, on any branch, merged or not, to derive `in-progress`. That directory ships **with** this PR and persists on `main` after merge — precedent: `docs/features/add-debit/` and `docs/features/validator-path-resolution/` both landed on `main` and stayed `in-progress`-eligible until a *later, separate* archival commit moved them out. The signal is therefore **durable**, not a transient branch-local artifact.

Consequence: the **committed** `ROADMAP.md` line held `backlog` (written when `archive-loop-var-resume` was only *registered*, before any plan dir existed — commit `4a21daa`). That value is stale the moment this change's plan dir lands on disk. By the Aceite's own conditional ("regen do ROADMAP.md apenas se a visão derivada mudar"), the regen is due — this change performs it (`archive-loop-var-resume`: `backlog` → `in-progress`), the opposite of what the first draft of this section froze.

**The recursive tail, named explicitly and accepted:** the line reaches `done` only when `docs/features/archive-loop-var-resume/` is itself later archived — a *change dir archiving a change dir*. This is the same tail `add-debit` and `validator-path-resolution` already walked (each needed its own later, separate archival commit to reach `done`); the repo accepts it by precedent. This design does not park a new debit for that future archival — it is simply the same pattern recursing one level, expected and not tracked as new work.

The verification: `derive-roadmap-status.js --root .` stays **exit 0** before and after the move (no `--strict`, so declared-but-undocumented ids never fail); the *derived view* differs from the pre-move committed file exactly on the `archive-loop-var-resume` line (`backlog` → `in-progress`) — and `ROADMAP.md` is regenerated in this change to match that delta, no other line changes.

## Link inventory (what the move does and does not break)

The moved directory's own internal links **all survive** the move — `features/<id>/` and `archive/<date>-<id>/` sit at the identical depth (two levels below `docs/`), so relative paths are depth-preserving:

| Link (in the moved files) | Resolves after move to | OK? |
|---|---|---|
| `../../decisions/README.md` (proposal.md) | `docs/decisions/README.md` | yes |
| `../../decisions/ADR-00{1,2,3}-*.md` (design.md) | `docs/decisions/…` | yes |
| `evidence.md` / `proposal.md` (same-dir refs) | moved siblings | yes |

Therefore `check-links docs/archive/2026-07-22-loop-var-resume` passes. **No sibling link breaks BY this move.** The two pre-existing broken links (`add-debit/proposal.md:46`, `validator-path-resolution/proposal.md:34`, both `../loop-var-resume/proposal.md`) were already broken before the move (their target never lived under `docs/archive/loop-var-resume/`) and remain broken after (the correct target now needs the `2026-07-22-` prefix) — WORM forbids editing those archived files. Named debt, out of scope (proposal.md non-goal 1); a repo-wide `check-links docs/` would still flag them, which is why validation is scoped to the moved directory.

## Constraining ADRs

- [ADR-002](../../decisions/ADR-002-roadmap-status-derived-from-disk.md) — constrains the regen decision (above): the derived view changed durably, so `ROADMAP.md` is regenerated to match it, per the ADR's own generated-snapshot model. No contradiction, no supersession.
- [ADR-001](../../decisions/ADR-001-executable-dna-crystallization.md), [ADR-003](../../decisions/ADR-003-shared-knowledge-in-docs.md), [ADR-004](../../decisions/ADR-004-aidakit-governance-env-contract.md) — not touched (DNA / knowledge / governance-env contract; none governs doc archival).

## Rollback

`git mv docs/archive/2026-07-22-loop-var-resume docs/features/loop-var-resume` restores the prior layout exactly. Pure rename, no state, no migration.

## Conventions and evidence location

- Archive dir name frozen: `docs/archive/2026-07-22-loop-var-resume/` (merge-date prefix, single key §2.7).
- Canonical validators (repo-real, no invention): `node governance/validators/derive-roadmap-status.js --root .`; `node governance/validators/check-links.js <dir>`.
- Evidence at the fixed location `docs/features/archive-loop-var-resume/evidence.md`.
