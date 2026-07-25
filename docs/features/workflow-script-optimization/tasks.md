# Tasks — workflow-script-optimization

**Change ID:** `workflow-script-optimization`
**Date:** `2026-07-25`
**Owner:** `@chacal88`
**Phase / Package:** `n/a (audit-only, docs surface: docs/features/ + docs/roadmap/)`
**PRD:** `n/a`
**Tech Spec:** `n/a`

> Local-first and reviewable. Every command below exists on this tree and was exercised at plan time; nothing here invents a script. Section references point at [design.md](design.md).
>
> **Hard bound for the whole list:** the diff touches only `docs/features/workflow-script-optimization/**` and `docs/roadmap/**`. Editing `governance/flows/*.yaml`, `agents/*.md`, or anything under `skills/`, `commands/`, `hooks/`, `governance/` is a scope escalation ([GOVERNANCE.md](../../../GOVERNANCE.md) §1 rule 3) — stop and report.

## 1. Setup

- [x] Re-inspect the real state before writing anything ([GOVERNANCE.md](../../../GOVERNANCE.md) §8): `git log -1 --format='%h %s'`, `git status --short`, `git branch --show-current`. Confirm the branch is not `main` and record the commit the audit is measured at (`git rev-parse --short HEAD`) — every table in the audit files carries it.
- [x] Re-run the plan-time assumption checks in [design.md](design.md) §12 and record any drift as a deviation instead of adjusting the numbers silently: `ls agents/*.md | wc -l` (expect 13), `ls governance/flows/*.yaml` (expect the 4), `grep -c "output_tokens" governance/telemetry/rollup.js` (expect 0 — finding F2 still open).
- [x] Capture the four validator baselines into `evidence.md` §Baselines, verbatim with exit codes: `node governance/validators/check-links.js .`, `node governance/validators/check-plugin-version.js .`, `node governance/validators/derive-roadmap-status.js --root . --json`, `node governance/validators/check-evidence-stat.js workflow-script-optimization`.
- [x] Confirm the telemetry file is present and note how many dispatches it holds: `wc -l .aidakit/tasks/workflow-script-optimization/.telemetry.jsonl`. If it is missing or shorter than at plan time (3 lines), record that as a hole ([design.md](design.md) §5) — never reconstruct rows.

## 2. Surface Work — `docs/features/workflow-script-optimization/`

### 2a. `inventory.md` — the entry point ([design.md](design.md) §1)

- [x] Create `docs/features/workflow-script-optimization/inventory.md` with a scope/anti-scope header that declares it the entry point of a **two-file single artifact**, links `dispatch-cost.md`, states the measured commit, and carries the precedence line ([DOCS.md](../../../DOCS.md) §2 rule 5).
- [x] §1 Method — paste the four reproduction commands of [design.md](design.md) §2 with their live output, including the `awk` type-histogram one-liner and the note that the `/^  - id:/` guard is what keeps the `inputs:` block out of the count.
- [x] §2 — four per-flow step tables (`full`, `fast`, `design`, `docs-onboarding` — step-count descending, an order that **encodes no priority**; the owner's `all-4-equal-priority` decision is honoured by equal depth per flow, not by the sequence), identical column set per [design.md](design.md) §2: `#`, `id`, `type`, `invoke_target`, `dispatch tier`, `command`, `routing`, `judgment`, `candidate`. Row counts must equal 36 / 23 / 10 / 9.
- [x] Mark every back-edge in the `routing` column as such, with `max_visits`/`on_max_visits` when declared (`specify` → `specify_escalation` and `check_acceptance` → `acceptance_escalation` are the two capped ones on this tree).
- [x] For each `runs` step, record whether its `on_failure` is a real correction back-edge or a fail-safe pass-through (`commit_plan` and `context_pack` route both outcomes forward), and note that exit 127/126/250/signal hard-stops instead ([ADR-011](../../decisions/ADR-011-runs-infra-error-routing.md)).

### 2b. `inventory.md` §3 — dispatcher register ([design.md](design.md) §3)

- [x] Resolve every `invoke_target` to its dispatch tier by **file existence** (`agents/<name>.md` and/or `skills/<name>/SKILL.md`), using the loop in [design.md](design.md) §2; record `both` where it applies (`brainstorm` is the one).
- [x] Section 3a — first-order table: the targets named by the flow YAMLs, with the flow(s) that name them. State explicitly that only 5 of the 13 `agents/*.md` appear here and name them.
- [x] Section 3b — second-order table: the 8 agents dispatched from inside a skill, with the skill and the declared role set as the source (review bench: [skills/review/SKILL.md](../../../skills/review/SKILL.md) step 5 matrix + `check-bench.js`'s `__manifest__` contract; implement fan-out: [skills/implement/SKILL.md](../../../skills/implement/SKILL.md)). Include the forbidden-derivation note with its counter-example, quoting the command **with its flags and paths** (`grep -roE 'aidakit:planner' skills/ commands/ | wc -l` → 25 occurrences, 0 dispatches) and the reason the mode matters (`grep -rc` over `skills/` returns 23 for the same agent — a number that disagrees with its stated command is the defect, whichever value is right).
- [x] Section 3c — skill-only dispatchers table (the 14 skills named by the flows), same columns, per brainstorm assumption 5.
- [x] Fill the `judgment` verdict for every dispatcher and every `invoke` step using the four-question test of [design.md](design.md) §3b, and for each `load-bearing` verdict record **which question it fails** — that is the reusable part, not the label.

### 2c. `inventory.md` §4-§5 — findings and candidates ([design.md](design.md) §6, §3c)

- [x] §4 Findings — write F1 (`classify` → `domain: "success"`), F2 (rollup drops `output_tokens`/`duration_ms`) and F3 (package-carried state makes some `invoke` steps free on re-entry) in the fixed shape (F4 has its own bullet below) (what · mechanical evidence at `path:line` or command+output · leash family · routed to), re-verifying each citation on the live tree before writing it — **re-run the locating grep, never copy a line number from this plan** (round 1 shipped `full.yaml:63` for a line that is at `61`): `grep -n 'domain:' governance/flows/full.yaml` → `61` for the `domain: "${context.classify.outcome}"` site, `grep -n '  - id: classify' governance/flows/full.yaml` → `43` with the block ending at `53`, `.aidakit/flows/state/full-260725-642b02.json` → `step_history[4].output.input.domain`, and the absence of `output_tokens`/`duration_ms` in `governance/telemetry/rollup.js`.
- [x] Write F4 (3 of the deriver's 6 orphans are stale declarations of shipped work), re-verifying each of the three on the live tree before writing it: `grep -nE '## Why|## Acceptance criteria' governance/context-pack/build.js` and `git log --oneline -3 -- governance/context-pack/build.js` (expect `43201d5`) for the two `context-pack-heading-*` entries; `grep -niE 'code span' governance/validators/check-links.js` and `git log --oneline -3 -- governance/validators/check-links.js` (expect `ec2ce7e`) for `check-links-code-span-skip`. State plainly that the other 3 orphans were **not** audited.
- [x] Purge any gloss on the orphan count across all audit files — never "legitimate", "open" or "pending"; the deriver's word is "orphan" and it means declared-and-not-on-disk (`grep -rn 'legitimate' docs/features/workflow-script-optimization/` → empty).
- [x] Add any further findings the pass produces, in the same shape. A finding without mechanical evidence does not ship. (F5 added — `readiness`'s "mechanical GATE 1" label disagrees with its dispatched skill's actual judgment-heavy process.)
- [x] §5 Candidates — state the escalation bound above the tables (no candidate may touch `merge_route`/`auto_merge`/`merge`, `specify_escalation`, `acceptance_escalation`, `pre_apply`, `parked`, `gate_migration`, `gate1`–`gate4`, or any `max_visits` wiring) and give every admitted candidate a `touches escalation: no` column ([design.md](design.md) §3c).
- [x] Fill all five slots for every admitted candidate (locus · predicate · judgment lost · precedent mirrored · ADR the follow-up needs). A candidate that cannot fill a slot moves to the rejected table with the failing slot named.
- [x] Author the **rejected candidates** table — it is a deliverable, not scrap: it is what shows `leash-pattern-preserved` was applied rather than asserted.
- [x] Cross-check each admitted candidate against `docs/features/`, `docs/archive/` (any date prefix) and every `epics/EPIC-*.md` for change-id collision before the id is written down ([design.md](design.md) §7).

### 2d. `dispatch-cost.md` — the measured cost table ([design.md](design.md) §4)

- [x] Create `docs/features/workflow-script-optimization/dispatch-cost.md` with a header stating the ranking metric (`body_bytes × happy_path_dispatches`), its lower-bound semantics, and a link back to `inventory.md`.
- [x] Paste `wc -c -w agents/*.md` verbatim (13 rows + total) as the body-size source. Record bytes and words; do **not** convert either to tokens.
- [x] Build the agent table with one row per `agents/*.md` and the three declared frequency tiers, each carrying its **per-flow scope** explicitly ([design.md](design.md) §4): `static` → 4 columns, one per flow (`grep -oE 'invoke_target: [a-z:-]+' governance/flows/<f>.yaml | sort | uniq -c`, run once per YAML); `happy-path` → **4 separate graph walks, one per flow, in 4 columns** (a target absent from a flow is `0`, never blank); `observed` → **`full` only** (this run is a `full` traversal), so the `fast`/`design`/`docs-onboarding` cells read `n/a (not exercised by this run)` — never `0`, never inferred. Then the ranking column.
- [x] State the `observed` hole in `dispatch-cost.md`'s header: the ranking is empirically grounded for `full` and structurally grounded (`static`/`happy-path`) for the other three flows, and the four columns are therefore not comparable. Do not interpolate across the hole.
- [x] Record the `observed` vs `happy-path` ratio for `full` wherever they differ instead of smoothing it, and name the back-edges that explain the gap.
- [x] Add the separate skill-body table (`wc -c -w skills/<name>/SKILL.md` for the 14 skill-only dispatchers) with the stated reason it is **not** merged into the agent ranking (a skill body loads into the caller's context; an agent body starts a fresh isolated one).
- [x] Rank the trim candidates and hand each one to §5 of `inventory.md` so it gets the five-slot treatment before it becomes a roadmap Feature.

### 2e. `evidence.md` — telemetry ([design.md](design.md) §5)

- [x] Run `node governance/telemetry/rollup.js --change-id workflow-script-optimization` and confirm the `## Context-pack telemetry rollup` section of `evidence.md` reports a **non-zero** `Total dispatches` (a rendered "No telemetry captured for this run" is a FAIL). (`{"ok":true,"changeId":"workflow-script-optimization","dispatches":8}` — Total dispatches: 8.)
- [x] Add the `## Raw dispatch telemetry (verbatim JSONL)` section as its own `## ` heading — never inside the rollup heading's span, which `writeRollupIntoEvidence` overwrites — with the `cat` command, the capture time, and the unedited lines.
- [x] Label the paste a **prefix of the run, not a total**, and list which steps have rows and which do not; record the all-zero `classify` row as a zero-cost re-entry (F3), not as a missing measurement.
- [x] Add a one-paragraph reading of the numbers that stays inside what the rows support (e.g. the `brainstorm` row's `cache_read`:`output` ratio), with the arithmetic shown so it is checkable, and no extrapolation to a per-flow total the rows do not contain.

## 3. Surface Work — `docs/roadmap/`

- [x] Declare **this change** as a Feature under [EPIC-context-caching](../../roadmap/epics/EPIC-context-caching.md) (`— changes: workflow-script-optimization`) with an `Acceptance:` sub-bullet naming the two audit files and the populated rollup — it is currently undeclared, so the roadmap cannot see it.
- [x] Register the leash/contract candidates (including F1) as Features on [EPIC-flow-engine-leashes](../../roadmap/epics/EPIC-flow-engine-leashes.md), each with the ADR requirement stated in its `Acceptance:` sub-bullet (criterion `flow-shape-change-gets-adr`).
- [x] Register the prompt-trim / dispatch-cost candidates as Features on [EPIC-context-caching](../../roadmap/epics/EPIC-context-caching.md), each citing the measured ranking row in `dispatch-cost.md` that justifies its priority.
- [x] Register F2 (rollup drops persisted fields) and F4 (stale backlog declarations) as Features on [EPIC-kit-discipline-hardening](../../roadmap/epics/EPIC-kit-discipline-hardening.md). The two `context-pack-heading-*` entries already there are pre-existing **and already shipped** (F4): do not add a third, do not edit or close them — this change appends only.
- [x] Use the English `- **Feature:** … — changes: <id>` / `  - Acceptance: …` grammar for every new line, never a status field ([ADR-002](../../decisions/ADR-002-roadmap-status-derived-from-disk.md)), and leave every existing (Portuguese) line **byte-identical** — verify with `git diff docs/roadmap/epics/` that only additions appear.
- [x] Rebase onto the current base **before** touching `docs/roadmap/ROADMAP.md` — a regen from a stale base once demoted two in-progress sibling changes back to backlog on merge ([design.md](design.md) §7). (Rebased onto `origin/main`'s `80610ab`; surfaced a 7th pre-existing orphan from a concurrent sibling PR — recorded in `evidence.md` §Unresolved Deviations and `inventory.md` F4, not smoothed over.)
- [x] Regenerate `docs/roadmap/ROADMAP.md` via the `aidakit:roadmap` skill in `regen` mode (the deriver reports; the skill writes — [ADR-002](../../decisions/ADR-002-roadmap-status-derived-from-disk.md), [skills/roadmap/SKILL.md](../../../skills/roadmap/SKILL.md) §`regen`). Never hand-edit it, and never copy another branch's copy.
- [x] Verify the regenerated view against `node governance/validators/derive-roadmap-status.js --root .`: every `` `id` → status `` line appears in the deriver's output and every change the deriver returns appears in the file (0 missing), no orphan beyond the 6 the deriver already reports on this tree plus the candidates this change registers, and `git diff -- docs/roadmap/ROADMAP.md` shows only the expected additions (a deletion or a status downgrade on an untouched line means the base was stale). (0 missing / 0 extra verified programmatically; diff is additions-only.)

## 4. Documentation

- [x] Mark every bullet of this file `[x]` as it completes — the checklist is the reviewable trace, not a summary written at the end.
- [x] Update [proposal.md](proposal.md) / [design.md](design.md) only if reality contradicted them, and record the contradiction in `evidence.md` §Unresolved Deviations rather than editing the plan into agreement silently. (Neither needed an edit — the one deviation, the orphan-count drift from the mandatory rebase, was anticipated by [design.md](design.md) §12's own assumptions section and recorded in `evidence.md`, not a contradiction of a plan claim.)
- [x] Keep every reference to `inventory.md` / `dispatch-cost.md` inside the plan artifacts as a **bare path in a code span**, never a markdown link ([design.md](design.md) §9) — the two new files carry the real links.
- [x] Add **no** doctrine footer to any file in this change and do **not** bump `.claude-plugin/plugin.json` ([design.md](design.md) §9).
- [x] Fill `evidence.md` §Files Touched from the final `git diff HEAD --stat`, one line per file with what changed and why.

## 5. Validation

Run each command, paste the command **and** its output with the exit code into `evidence.md`.

- [x] `node governance/validators/check-links.js .` → exit 0 (plan-time baseline: exit 0, 241 files). **Deviation:** returns exit 1 on this tree due to a pre-existing broken link in `docs/features/plan-gate-executor-internals-check/proposal.md:75`, inherited from the mandatory rebase (`80610ab`), outside this change's bound to fix — recorded in `evidence.md` §Post-authoring validation and §Unresolved Deviations; scoped re-run over this change's own two path prefixes is exit 0 / 0 errors, proving no regression from this diff.
- [x] `node governance/validators/check-plugin-version.js .` → exit 0 with no bump (baseline: manifest `0.9.1`, highest footer `0.9`, 309 files).
- [x] `node governance/validators/derive-roadmap-status.js --root .` → exit 0, `workflow-script-optimization` derives `in-progress`, every new candidate derives `backlog`. **Do not pass `--strict`** — it exits 1 on any declared id not yet on disk, which is what a fresh backlog candidate is ([design.md](design.md) §7).
- [x] `node governance/telemetry/rollup.js --change-id workflow-script-optimization` → exit 0 and `Total dispatches` non-zero.
- [x] `node governance/validators/check-evidence-stat.js workflow-script-optimization` → exit 0. Capture the `git diff HEAD --stat` block last and iterate to a fixpoint (capturing changes the diff).
- [x] `git diff HEAD --stat -- governance/ agents/ skills/ commands/ hooks/` → **prints nothing**; paste the empty output as the mechanical proof of `audit-only-no-flow-edits`.
- [x] `for f in governance/__tests__/*.test.mjs; do node "$f"; done` → all suites green (22 files on this tree). Expected trivially; run it as the regression floor.
- [x] Re-run every command quoted inside `inventory.md` and `dispatch-cost.md` against the shipped tree and confirm each reproduces the number printed next to it (criterion `no-fabricated-token-numbers`). Any mismatch is fixed by correcting the number, never the prose around it. (One real mismatch found and fixed: the "19 distinct targets" `grep`/`sort -u`/`wc -l` command was missing `-h`, so it reproduced 30, not 19 — corrected in `inventory.md` §3, recorded in `evidence.md`.)
- [x] Confirm the `## Acceptance criteria` section of [proposal.md](proposal.md) is still byte-identical to the criteria in `.aidakit/tasks/workflow-script-optimization/brainstorm.json` (the ids are the acceptance-manifest correlation key, [ADR-010](../../decisions/ADR-010-acceptance-leash.md) §Decision-3).

## 6. Cleanup

- [x] Stage by name, never `git add -A`/`git add .` ([GOVERNANCE.md](../../../GOVERNANCE.md) §4). Include `docs/features/workflow-script-optimization/.context-pack.md` and `retry-history.json` if present — neither is gitignored, and leaving them untracked keeps them out of the [DOCS.md](../../../DOCS.md) §4 archive move. (`retry-history.json` was already tracked, from an earlier plan commit — nothing further to stage for it.)
- [x] Confirm nothing under `.aidakit/` is staged (`git diff --cached --name-only | grep '^\.aidakit/'` → empty) — it is gitignored operational state, and the telemetry evidence lives in `evidence.md`, not in the commit.
- [x] Verify no file in the diff carries a secret-shaped name and that the commit message is conventional with the change-id as its scope suffix ([DOCS.md](../../../DOCS.md) §2 rule 7: change-id = branch = PR title suffix = archive directory).
- [ ] Leave the PR at its URL. The merge is the human's ([GOVERNANCE.md](../../../GOVERNANCE.md) §1 rule 1); the `pr.auto_merge` opt-in of [ADR-008](../../decisions/ADR-008-opt-in-autonomous-pr-merge.md) is read from the trusted base branch by the flow's own merge step, never granted from this diff. (Out of this implementer dispatch's scope — the `ship`/`pr` step of the flow opens the PR, not `implement`.)
