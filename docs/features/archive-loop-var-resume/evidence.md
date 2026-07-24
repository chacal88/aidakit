# Evidence — archive-loop-var-resume

**Change ID:** `archive-loop-var-resume`
**Date:** `2026-07-23`
**Owner:** `@chacal88`
**Phase / Package:** `n/a (fast flow — bookkeeping / doc archival)`
**PRD:** `n/a`
**Tech Spec:** `n/a`

> Pre-execution stub. The implement/ship steps record here: exact commands, outputs, files, PR URL, and any unresolved deviations.

## Validation Outputs

- [x] Baseline `node governance/validators/derive-roadmap-status.js --root .` → exit 0.
  ```
  $ node governance/validators/derive-roadmap-status.js --root .
  {"validator":"aidakit.derive-roadmap-status","ok":true,"epics_count":1,...}
  EXIT:0
  ```
  (Ran before the move; `archive-loop-var-resume` already shows `in-progress` in the derived view — its own plan directory, `docs/features/archive-loop-var-resume/`, already exists at baseline time, via `hasInFlightArtifacts`. See "Review Round 1 — Fixes" below: the committed `ROADMAP.md` still read `backlog` at this point, which is exactly the staleness round 1 caught.)

- [x] Post-move `node governance/validators/derive-roadmap-status.js --root .` → exit 0 (green).
  ```
  $ node governance/validators/derive-roadmap-status.js --root .
  {"validator":"aidakit.derive-roadmap-status","ok":true,"epics_count":1,...}
  EXIT:0
  ```
  Identical output to baseline — the `mv` itself (an undeclared id, `loop-var-resume`) does not change the derived status; `archive-loop-var-resume` was already `in-progress` before and after, driven by its own plan dir, not by the `mv`.

- [x] `node governance/validators/check-links.js docs/archive/2026-07-22-loop-var-resume` → exit 0.
  ```
  $ node governance/validators/check-links.js docs/archive/2026-07-22-loop-var-resume
  {"validator":"aidakit.check-links","ok":true,"files_checked":4,"errors":[]}
  OK — 4 file(s), no broken links.
  EXIT:0
  ```

- [x] `node governance/validators/check-links.js docs/features/archive-loop-var-resume` → exit 0 (re-run after the round-1 rewrite, confirms the new citation links — including `../../../governance/roadmap/roadmap.js` — still resolve).
  ```
  $ node governance/validators/check-links.js docs/features/archive-loop-var-resume
  {"validator":"aidakit.check-links","ok":true,"files_checked":4,"errors":[]}
  OK — 4 file(s), no broken links.
  EXIT:0
  ```

- [x] `git diff --cached --find-renames --summary` → exactly 4 `rename … (100%)` lines; `git diff --cached --stat` → 4 files, no content insertions/deletions.

  **Readiness finding applied (Low):** tasks.md §4 originally said to validate "after `git add -A`". `git add -A` is blocked by the pre-bash hook (GOVERNANCE.md §4, nominal staging) and is unnecessary — `git mv` already stages the renames in the index. Validated directly against the index staged by `git mv`, no `git add` run.

  ```
  $ git diff --cached --find-renames --summary
   rename docs/{features/loop-var-resume => archive/2026-07-22-loop-var-resume}/design.md (100%)
   rename docs/{features/loop-var-resume => archive/2026-07-22-loop-var-resume}/evidence.md (100%)
   rename docs/{features/loop-var-resume => archive/2026-07-22-loop-var-resume}/proposal.md (100%)
   rename docs/{features/loop-var-resume => archive/2026-07-22-loop-var-resume}/tasks.md (100%)

  $ git diff --cached --stat
   .../loop-var-resume => archive/2026-07-22-loop-var-resume}/design.md      | 0
   .../loop-var-resume => archive/2026-07-22-loop-var-resume}/evidence.md    | 0
   .../loop-var-resume => archive/2026-07-22-loop-var-resume}/proposal.md    | 0
   .../loop-var-resume => archive/2026-07-22-loop-var-resume}/tasks.md       | 0
   4 files changed, 0 insertions(+), 0 deletions(-)
  ```

- [x] `git status --short` (post round-1 fixes): the 4 staged renames, the modified `docs/roadmap/ROADMAP.md`, plus this change directory. Sibling archives untouched.
  ```
  $ git status --short
  R  docs/features/loop-var-resume/design.md -> docs/archive/2026-07-22-loop-var-resume/design.md
  R  docs/features/loop-var-resume/evidence.md -> docs/archive/2026-07-22-loop-var-resume/evidence.md
  R  docs/features/loop-var-resume/proposal.md -> docs/archive/2026-07-22-loop-var-resume/proposal.md
  R  docs/features/loop-var-resume/tasks.md -> docs/archive/2026-07-22-loop-var-resume/tasks.md
   M docs/roadmap/ROADMAP.md
  ?? docs/features/

  $ git status --short docs/archive/2026-07-22-add-debit docs/archive/2026-07-23-validator-path-resolution
  (no output — both sibling archives untouched)
  ```
  `docs/features/` shows untracked because `loop-var-resume/` (renamed away) was its only other prior sibling under version control at this path level; the sole remaining entry under `docs/features/` is this change directory, `docs/features/archive-loop-var-resume/`.

## ROADMAP.md regeneration (Review Round 1 fix)

Round 1 found the original "no-regen" reasoning factually wrong (real mechanism: `deriveChangeStatus` → `hasInFlightArtifacts`, [governance/roadmap/roadmap.js:41-57](../../../governance/roadmap/roadmap.js) — a pure `existsSync(docs/features/<changeId>)` check, no branch dependency). This change's own plan dir durably flips its own declared line, so the Aceite's regen conditional fires. Regenerated by hand from the deriver's current view (same procedure as the `add-debit` regen, commit `8bb64b8`):

Before (committed, stale):
```
### Coleiras mecânicas do flow engine — **backlog**

- ...
- Arquivamento do loop-var-resume (bookkeeping) — `archive-loop-var-resume` → backlog
- ...
```

After (regenerated, matches `derive-roadmap-status.js --root .` above):
```
$ git diff -- docs/roadmap/ROADMAP.md
@@ -4,7 +4,9 @@

 ## Now (in-progress / in-review)

-_(nada em andamento)_
+### Coleiras mecânicas do flow engine — **in-progress**
+
+- Arquivamento do loop-var-resume (bookkeeping) — `archive-loop-var-resume` → in-progress

 ## Next (planned)

@@ -12,13 +14,12 @@ _(nada planejado)_

 ## Later (backlog)

-### Coleiras mecânicas do flow engine — **backlog**
+### Coleiras mecânicas do flow engine — **in-progress**

 - Cap mecânico de retries — `engine-max-visits` → backlog
 - Coleira das metas — `acceptance-leash` → backlog
 - Retry com memória — `retry-memory` → backlog
 - Bench paralelo estrutural — `flow-parallel-bench` → backlog
-- Arquivamento do loop-var-resume (bookkeeping) — `archive-loop-var-resume` → backlog
 - `runs` distingue erro de infraestrutura de veredito negativo — `runs-error-routing` → backlog
 - Caminho de validador para invocações diretas de agente/skill — `agent-validator-paths` → backlog
```

Delta: **only** the `archive-loop-var-resume` line moves (Later→Now, `backlog`→`in-progress`), and the epic aggregate header flips `backlog`→`in-progress` in both sections (a direct consequence of aggregation, not an independent edit). No other change-id line touched; `add-debit` stays `done`; the three `runs-error-routing`/`agent-validator-paths`/other backlog lines are unchanged text. `loop-var-resume` itself remains undeclared (the `mv` moves no declared line — confirmed unchanged from the original reasoning).

## Review Round 1 — Fixes

Both reviewers (adr, specs) returned NEEDS-REVISION on round 1. Findings and resolutions:

1. **Core finding (both reviewers): the "no-regen decision" in design.md was factually wrong.** It claimed a `getStatus` branch-name heuristic that does not exist in `governance/roadmap/roadmap.js`, and treated `archive-loop-var-resume`'s `in-progress` derivation as a transient branch-local signal. The real mechanism, `deriveChangeStatus` → `hasInFlightArtifacts` (roadmap.js:41-57), is a pure disk check with no git/branch dependency — durable, and the change's own plan dir persists on `main` post-merge (precedent: `add-debit`, `validator-path-resolution`). **Fix:** rewrote design.md's section as "The regen decision", correcting the mechanism, citing the real function names and line range, naming the recursive-tail consequence explicitly (accepted, not a new debit); regenerated `docs/roadmap/ROADMAP.md` (see above); updated proposal.md's "What Changes" bullet, non-goal 3, and the "Recorded decisions" ADR-002 line to match; updated tasks.md item 3.1 and its §4 verification bullet (git status now expects the ROADMAP.md change, not its absence).
2. **Citation fixes (adr finding 2).** design.md:17 and tasks.md:17 `"DOCS.md §6"` → `"DOCS.md §2 rule 6"` (the banner/stub rule; §6 is the doc-leash manifest, a different section). design.md's roadmap.js citation now uses the full repo-relative path (`governance/roadmap/roadmap.js`, not the bare `roadmap/roadmap.js`). Dropped the bracketed `"[to lie]"` insertion from the ADR-002 paraphrase — the ADR's actual text is "regenerated by `aidakit:roadmap`, never edited" with no such clause; the paraphrase now quotes it as written.
3. **Re-validation** (this round): `derive-roadmap-status.js --root .` exit 0 (unchanged epic/feature JSON, `archive-loop-var-resume: in-progress`); `check-links.js docs/features/archive-loop-var-resume` exit 0 (new citation links resolve); `check-links.js docs/archive/2026-07-22-loop-var-resume` exit 0 (unaffected by the docs fixes, re-confirmed); `git status --short` shows exactly the 4 staged renames + modified `ROADMAP.md` + this change dir; sibling archives (`add-debit`, `validator-path-resolution`) untouched.

No git state was touched to apply these fixes — the 4 staged renames from `git mv` are unchanged; only working-tree file contents (`design.md`, `proposal.md`, `tasks.md`, `evidence.md`, `docs/roadmap/ROADMAP.md`) were edited.

## Files Touched

```
docs/features/loop-var-resume/proposal.md  → docs/archive/2026-07-22-loop-var-resume/proposal.md  (100%)
docs/features/loop-var-resume/design.md    → docs/archive/2026-07-22-loop-var-resume/design.md    (100%)
docs/features/loop-var-resume/tasks.md     → docs/archive/2026-07-22-loop-var-resume/tasks.md     (100%)
docs/features/loop-var-resume/evidence.md  → docs/archive/2026-07-22-loop-var-resume/evidence.md  (100%)
```

Plus:
- `docs/roadmap/ROADMAP.md` — modified (regenerated per Review Round 1 fix, above): `archive-loop-var-resume` line `backlog` → `in-progress`, epic aggregate header `backlog` → `in-progress` in both Now/Later sections; no other line changed.
- This change directory: `docs/features/archive-loop-var-resume/` (proposal, design, tasks, evidence — all edited in place during implementation and again during the round-1 fix pass, not moved).

## Unresolved Deviations

None. Two prior notes, both resolved:
- The readiness finding on tasks.md §4's third bullet (staging-command wording, `git add -A` → validate directly on the `git mv`-staged index) — applied at implementation time, unaffected by round 1.
- Review Round 1's core finding (the no-regen reasoning was factually wrong) — fully resolved per "Review Round 1 — Fixes" above: `ROADMAP.md` is now regenerated, design/proposal/tasks corrected, citations fixed, re-validated green.

## Ship

- PR: _(fill — `chore(docs): archive loop-var-resume`, stopped at the URL; merge is the human's, GOVERNANCE.md §1)_
