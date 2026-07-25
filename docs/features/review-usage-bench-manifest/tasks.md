# Tasks — review-usage-bench-manifest

**Change ID:** `review-usage-bench-manifest`
**Date:** `2026-07-25`
**Owner:** `@chacal88`
**Phase / Package:** `n/a (doc-only surface fix on the review command + skill; classification: domain=product, type=feature, flags=[], confirmed)`
**PRD:** `n/a`
**Tech Spec:** `n/a`

> **Hard boundary, valid for every task below:** no file under `governance/` and no file under `docs/decisions/` is created or edited. §5 proves it mechanically. If a task seems to require either, stop and escalate ([GOVERNANCE.md](../../../GOVERNANCE.md) §1) instead of widening.
>
> Order: §1 → §2/§3 (independent of each other) → §4 (order-independent) → §5 → §6 → §7. §2 and §3 must both land before §6's link check is meaningful.

## 1. Setup

- [ ] Re-read the two edit targets at their live line numbers before touching them — [design.md](design.md) §3-§4 cites `commands/review.md:15/17` and `skills/review/SKILL.md:62/76`; confirm the anchors still say what the design claims (a concurrent commit may have shifted them). Anchor drift is a stop-and-re-derive, not a guess.
- [ ] Capture the pre-change baselines into [evidence.md](evidence.md): `node governance/validators/check-links.js .` and `node governance/validators/check-plugin-version.js .` (exit codes + JSON). Only NEW breaks count against this change.
- [ ] Re-read `.claude-plugin/plugin.json` on `main` (`git show main:.claude-plugin/plugin.json`) — the bump in §6 is relative to the live value (`0.9.0` at plan time), never to a number copied from the plan ([PROCESS.md](../../../PROCESS.md) §5).

## 2. Surface Work — `commands/` (`commands/review.md`)

- [ ] Insert the manifest paragraph from [design.md](design.md) §3 into `## Usage`, **after** the `**Examples (copy-paste):**` bullets and **before** the `Invoke this plugin's ...` paragraph. Keep every named token: `recordBenchManifest`, `__manifest__`, `.aidakit/tasks/<change-id>/bench.ndjson`, `check_review_bench`, `manifest-missing`, and the "the entire bench re-runs" consequence. *(criteria `usage-review-command-mentions-manifest`, `consequence-of-skipping-is-named`)*
- [ ] Confirm the inserted link is exactly `../skills/review/SKILL.md` (relative to `commands/`) and that it is the **only** pointer added — no second copy of the step-5 example anywhere in this file ([DOCS.md](../../../DOCS.md) §2 rule 1).
- [ ] Leave the `$ARGUMENTS` guard (lines 5-6), the `description:` frontmatter, and the existing Examples bullets byte-identical — the [ADR-005](../../decisions/ADR-005-command-namespacing.md) Usage contract (expected inputs + copy-paste invocation on empty/malformed `$ARGUMENTS`) must survive unchanged.
- [ ] Append the new doctrine footer line after the existing two (append, never rewrite): `<!-- aidakit v0.9 — review-usage-bench-manifest: bench manifest requirement + consequence surfaced in Usage, 2026-07-25 -->`.

## 3. Surface Work — `skills/` (`skills/review/SKILL.md`)

- [ ] Append the forward pointer to the existing step-5 manifest paragraph (line 62): `… Write it, THEN dispatch — copy-paste shape at the end of this step.` No other change to that paragraph.
- [ ] Insert the **Copy-paste dispatch shape** block from [design.md](design.md) §4(b) at the end of step 5 — after the "All summoned agents run in parallel, in a single message" paragraph, before step 6's heading — with the 3-space continuation indent the surrounding step-5 content uses. Must contain: the `recordBenchManifest` bash block, the "then dispatch in the SAME message" step, the `recordBench` bash block with real `dispatched_at`/`returned_at`, and the citations to [ledger.js](../../../governance/ledgers/ledger.js) and [check-bench.js](../../../governance/validators/check-bench.js). *(criterion `skill-review-gets-copypaste-example`)*
- [ ] Include the three invariants verbatim in substance (byte-identical role strings → `role-missing`; `dispatched_at` after the manifest write → `manifest-not-first`; one manifest per round, a re-summon is a NEW round → `manifest-duplicate`). The second one is the trap reproduced live at plan time ([design.md](design.md) §2) — do not drop it as "obvious".
- [ ] Include the skip-consequence sentence naming `manifest-missing` → exit 1 → `check_review_bench` back-edge → whole bench re-runs. Say **exit 1**, not "non-zero" ([ADR-011](../../decisions/ADR-011-runs-infra-error-routing.md): an infra exit hard-stops instead). *(criterion `consequence-of-skipping-is-named`)*
- [ ] Use `$AIDAKIT_GOVERNANCE/ledgers/ledger.js` in both snippets, never a relative import ([ADR-004](../../decisions/ADR-004-aidakit-governance-env-contract.md), [ADR-012](../../decisions/ADR-012-aidakit-governance-session-wide.md)) — `cwd` at dispatch time is the consumer repo, not the kit.
- [ ] Leave untouched: the role×flag matrix table, the Prerequisites context-pack paragraph (line 29, [ADR-013](../../decisions/ADR-013-context-pack-per-change.md)), the normative `recordBench` field schema at lines 87-93, and the Gates section at line 115. The schema is **not** replaced by the example.
- [ ] Append the new doctrine footer: `<!-- aidakit v0.9 — review-usage-bench-manifest: copy-paste manifest → dispatch → recordBench shape in step 5, 2026-07-25 -->`.

## 4. Surface Work — `docs/roadmap/` (the mechanical-writer debit)

Order-independent relative to §2/§3.

- [ ] **Collision check before writing** — run and record the output:
  ```
  node --input-type=module -e "import { findDeclaredChange } from './governance/roadmap/roadmap.js'; console.log(JSON.stringify(findDeclaredChange('review-bench-manifest-mechanical-writer', process.cwd())))"
  ```
  plus `ls docs/features/ docs/archive/ | grep -i mechanical-writer` (expect: nothing). A collision goes to the owner — never a silent rename ([skills/roadmap/SKILL.md](../../../skills/roadmap/SKILL.md), `register` step 2).
- [ ] Insert the `- **Feature:** … review-bench-manifest-mechanical-writer` bullet + its `- Aceite:` sub-bullet from [design.md](design.md) §5 into `docs/roadmap/epics/EPIC-kit-discipline-hardening.md`'s `## Features`, immediately after the `review-usage-bench-manifest` bullet, in the file's existing pt-BR prose. The sub-bullet **must** name the `manifest-duplicate` contract conflict as the crux. *(criterion `mechanical-writer-registered-as-debit`)*
- [ ] Write **no status field** anywhere in the epic ([ADR-002](../../decisions/ADR-002-roadmap-status-derived-from-disk.md)) and leave `## Não-goals` untouched.
- [ ] Regenerate `docs/roadmap/ROADMAP.md` from `node governance/validators/derive-roadmap-status.js --root .` (the `regen` mode of [aidakit:roadmap](../../../skills/roadmap/SKILL.md)) — **never hand-edit it** (ADR-002). Expected derivation: `review-usage-bench-manifest` → `in-progress` (its `docs/features/` dir exists and the plan is committed, [ADR-007](../../decisions/ADR-007-roadmap-status-from-shared-git.md)/[ADR-009](../../decisions/ADR-009-flow-commits-plan-early.md)); `review-bench-manifest-mechanical-writer` → `backlog`.
- [ ] Do **not** edit `docs/roadmap/README.md` — it indexes epics, and `EPIC-kit-discipline-hardening` is already listed.

## 5. Documentation

- [ ] Prove the doc-only boundary mechanically: `git diff --stat` (and `git status --porcelain`) show **zero** paths under `governance/` and **zero** under `docs/decisions/`. Paste the output into [evidence.md](evidence.md). *(criterion `no-mechanical-write-this-change`)*
- [ ] Confirm the copy-paste example exists in exactly one file: `grep -rn "recordBenchManifest" commands/ skills/` returns the pointer in `commands/review.md` **without** a fenced snippet, and the snippet only in `skills/review/SKILL.md`.
- [ ] Fill [evidence.md](evidence.md)'s `## Files Touched` with the final list (expected: `commands/review.md`, `skills/review/SKILL.md`, `docs/roadmap/epics/EPIC-kit-discipline-hardening.md`, `docs/roadmap/ROADMAP.md`, `.claude-plugin/plugin.json`, + this change package).

## 6. Validation

Every command below is run from the repo root; paste each exit code + output into [evidence.md](evidence.md).

- [ ] **Execute the example verbatim** — the load-bearing check, because a copy-paste example that does not run is a regression. In a scratch dir with `AIDAKIT_PROJECT_ROOT` set to it, run the step-5 manifest snippet and then the `recordBench` snippet for two roles with real timestamps, then:
  ```
  node governance/validators/check-bench.js <scratch>/.aidakit/tasks/<probe-id>/bench.ndjson --bench review --outcome consensus
  ```
  → **exit 0**. Copy the snippets out of the edited `SKILL.md`, not out of this plan. Record the resulting ndjson lines in [evidence.md](evidence.md). Delete the scratch dir in §7.
- [ ] Optionally also reproduce the negative case (a `dispatched_at` predating the manifest → `manifest-not-first`, exit 1) to confirm the invariant the doc claims is the one the validator enforces.
- [ ] `node governance/validators/check-links.js .` → exit 0, or no NEW break vs. the §1 baseline.
- [ ] `node governance/validators/check-links.js docs/features/review-usage-bench-manifest` → exit 0 (this change package's own links resolve).
- [ ] `node governance/validators/derive-roadmap-status.js --root .` → exit 0 with the two derivations expected in §4.
- [ ] `node governance/validators/check-plugin-version.js .` → exit 0 after the bump.
- [ ] Bump `version` in `.claude-plugin/plugin.json` strictly above the value read in §1 (`0.9.0` at plan time → recommended `0.9.1`, patch: doc-only). Without it `claude plugin update` no-ops and the fix reaches no installed user ([PROCESS.md](../../../PROCESS.md) §5).
- [ ] Regression floor (no code changed, so this must be trivially green): `for f in governance/__tests__/*.test.mjs; do node "$f"; done` — all suites pass, `check-bench.test.mjs` included.

## 7. Cleanup

- [ ] Delete the scratch dir used by §6's example probe (nothing from it is committed; `.aidakit/tasks/<probe-id>/` must not appear in `git status`).
- [ ] Verify no stray `<change-id>`/`<probe-id>` placeholder leaked into a committed file: `grep -rn "probe" commands/review.md skills/review/SKILL.md` returns nothing.
- [ ] Fill [evidence.md](evidence.md)'s `## Unresolved Deviations` — explicitly write "none" if there are none; an empty section is not an answer.
- [ ] Confirm the change package is committed before the review bench runs, so `review-usage-bench-manifest` derives `in-progress` from the shared git signal ([ADR-007](../../decisions/ADR-007-roadmap-status-from-shared-git.md), [ADR-009](../../decisions/ADR-009-flow-commits-plan-early.md)).
