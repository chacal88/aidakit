# Tasks — archive-loop-var-resume

**Change ID:** `archive-loop-var-resume`
**Date:** `2026-07-23`
**Owner:** `@chacal88`
**Phase / Package:** `n/a (fast flow — bookkeeping / doc archival)`
**PRD:** `n/a`
**Tech Spec:** `n/a`

## 1. Setup

- [x] Baseline: `node governance/validators/derive-roadmap-status.js --root .` → exit 0 (record in [evidence.md](evidence.md)).
- [x] Confirm the source exists and the target does not: `docs/features/loop-var-resume/` present (4 files); `docs/archive/2026-07-22-loop-var-resume/` absent.

## 2. Surface Work — docs (the archival move)

- [x] `git mv docs/features/loop-var-resume docs/archive/2026-07-22-loop-var-resume` — no content edits (WORM archive as-is; DOCS.md §4). No legacy banner, no stub (that is DOCS.md §2 rule 6, for ADRs — see [design.md](design.md)).
- [x] Confirm `docs/features/loop-var-resume/` is gone and the 4 files now live under `docs/archive/2026-07-22-loop-var-resume/`.

## 3. Documentation

- [x] `ROADMAP.md`: **regenerate** — this change's own plan directory (`docs/features/archive-loop-var-resume/`) durably flips its own declared line (`hasInFlightArtifacts`, no branch dependency; [design.md](design.md), regen decision), so the Aceite's conditional ("regen apenas se a visão derivada mudar") fires: `archive-loop-var-resume` → `in-progress`. Run `node governance/validators/derive-roadmap-status.js --root .` and rewrite `docs/roadmap/ROADMAP.md`'s Now/Later sections to match (same procedure as the `add-debit` regen precedent). Verify `git diff -- docs/roadmap/ROADMAP.md` shows only the `archive-loop-var-resume` line moving Later→Now (backlog→in-progress) and the epic aggregate header flipping to `in-progress` — no other change-id line touched.
- [x] Change artifacts complete under `docs/features/archive-loop-var-resume/` (proposal, design, tasks, evidence).

## 4. Validation

- [x] `node governance/validators/derive-roadmap-status.js --root .` → exit 0 (green) after the move; record output in [evidence.md](evidence.md).
- [x] `node governance/validators/check-links.js docs/archive/2026-07-22-loop-var-resume` → exit 0 — the moved directory's own internal links (`../../decisions/…`, same-dir refs) still resolve (depth-preserving move; [design.md](design.md) link inventory). Record in [evidence.md](evidence.md).
- [x] `node governance/validators/check-links.js docs/features/archive-loop-var-resume` → exit 0 — this working package's own internal links (design/proposal/tasks/evidence cross-refs, the `../../roadmap/...`, `../../decisions/...`, `../../../governance/roadmap/roadmap.js` citation) resolve after the round-1 rewrite. Record in [evidence.md](evidence.md).
- [x] `git diff --cached --find-renames --summary` — **readiness finding applied (Low)**: do not run `git add -A` first (blocked by the pre-bash hook per GOVERNANCE §4 nominal staging; also unnecessary — `git mv` already stages the renames). Validated directly on the index staged by `git mv`: lists exactly **4 renames at 100% similarity** for the moved files and **no** content modification; `git diff --cached --stat` confirms 4 files, 0 insertions/0 deletions to the moved content. Record in [evidence.md](evidence.md).
- [x] `git status --short`: the working-tree changes are the 4 renames, the modified `docs/roadmap/ROADMAP.md` (regenerated per the corrected regen decision — see item 3.1), plus this change directory (`docs/features/archive-loop-var-resume/`). No edits to sibling archives (the two pre-existing broken links stay untouched — proposal.md non-goal 1).

## 5. Cleanup

- [x] No stray files outside the declared scope. The stray worktree `.claude/worktrees/loop-var-resume-bug-e0a1ce` is left as-is (proposal.md non-goal 2).
- [x] `## Files Touched` and `## Validation Outputs` filled in [evidence.md](evidence.md); `## Unresolved Deviations` recorded (expected: none).

## 6. Ship (separate step — out of scope for the implementer)

- [ ] Ship via `aidakit:ship`: conventional commit, branch carries the change-id suffix (single key §2.7), PR `chore(docs): archive loop-var-resume` to main, **stop at the URL** — the merge is the human's (GOVERNANCE.md §1).
