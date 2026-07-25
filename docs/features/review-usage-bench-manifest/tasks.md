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

- [x] Re-read the two edit targets at their live line numbers before touching them — [design.md](design.md) §3-§4 cites `commands/review.md:15/17` and `skills/review/SKILL.md:62/76`; confirm the anchors still say what the design claims (a concurrent commit may have shifted them). Anchor drift is a stop-and-re-derive, not a guess.
- [x] Capture the pre-change baselines into [evidence.md](evidence.md): `node governance/validators/check-links.js .` and `node governance/validators/check-plugin-version.js .` (exit codes + JSON). Only NEW breaks count against this change. *(Superseded by the rebase: ADR-014 took the link baseline to zero, so the bar in §6 is a flat exit 0.)*
- [x] Re-read `.claude-plugin/plugin.json` on `main` (`git show main:.claude-plugin/plugin.json`) — the bump in §6 is relative to the live value (`0.9.0` at plan time), never to a number copied from the plan ([PROCESS.md](../../../PROCESS.md) §5).

## 2. Surface Work — `commands/` (`commands/review.md`)

- [x] Insert the manifest paragraph from [design.md](design.md) §3 into `## Usage`, **after** the `**Examples (copy-paste):**` bullets and **before** the `Invoke this plugin's ...` paragraph. Keep every named token: `recordBenchManifest`, `__manifest__`, `.aidakit/tasks/<change-id>/bench.ndjson`, `check_review_bench`, `manifest-missing`, and the "the entire bench re-runs" consequence. *(criteria `usage-review-command-mentions-manifest`, `consequence-of-skipping-is-named`)*
- [x] Confirm the inserted link is exactly `../skills/review/SKILL.md` (relative to `commands/`) and that it is the **only** pointer added — no second copy of the step-5 example anywhere in this file ([DOCS.md](../../../DOCS.md) §2 rule 1).
- [x] Leave the `$ARGUMENTS` guard (lines 5-6), the `description:` frontmatter, and the existing Examples bullets byte-identical — the [ADR-005](../../decisions/ADR-005-command-namespacing.md) Usage contract (expected inputs + copy-paste invocation on empty/malformed `$ARGUMENTS`) must survive unchanged.
- [x] Append the new doctrine footer line after the existing two (append, never rewrite): `<!-- aidakit v0.9 — review-usage-bench-manifest: bench manifest requirement + consequence surfaced in Usage, 2026-07-25 -->`.

## 3. Surface Work — `skills/` (`skills/review/SKILL.md`)

- [x] Append the forward pointer to the existing step-5 manifest paragraph (line 62): `… Write it, THEN dispatch — copy-paste shape at the end of this step.` No other change to that paragraph.
- [x] Insert the **Copy-paste dispatch shape** block from [design.md](design.md) §4(b) at the end of step 5 — after the "All summoned agents run in parallel, in a single message" paragraph, before step 6's heading — with the 3-space continuation indent the surrounding step-5 content uses. Must contain: the `recordBenchManifest` bash block, the "then dispatch in the SAME message" step, the `recordBench` bash block with real `dispatched_at`/`returned_at`, and the citations to [ledger.js](../../../governance/ledgers/ledger.js) and [check-bench.js](../../../governance/validators/check-bench.js). *(criterion `skill-review-gets-copypaste-example`)*
- [x] Include the three invariants verbatim in substance (byte-identical role strings → `role-missing`; `dispatched_at` after the manifest write → `manifest-not-first`; one manifest per round, a re-summon is a NEW round → `manifest-duplicate`). The second one is the trap reproduced live at plan time ([design.md](design.md) §2) — do not drop it as "obvious".
- [x] Include the skip-consequence sentence naming `manifest-missing` → exit 1 → `check_review_bench` back-edge → whole bench re-runs. Say **exit 1**, not "non-zero" ([ADR-011](../../decisions/ADR-011-runs-infra-error-routing.md): an infra exit hard-stops instead). *(criterion `consequence-of-skipping-is-named`)*
- [x] Use `$AIDAKIT_GOVERNANCE/ledgers/ledger.js` in both snippets, never a relative import ([ADR-004](../../decisions/ADR-004-aidakit-governance-env-contract.md), [ADR-012](../../decisions/ADR-012-aidakit-governance-session-wide.md)) — `cwd` at dispatch time is the consumer repo, not the kit.
- [x] Leave untouched: the role×flag matrix table, the Prerequisites context-pack paragraph (line 29, [ADR-013](../../decisions/ADR-013-context-pack-per-change.md)), the normative `recordBench` field schema at lines 87-93, and the Gates section at line 115. The schema is **not** replaced by the example.
- [x] Append the new doctrine footer: `<!-- aidakit v0.9 — review-usage-bench-manifest: copy-paste manifest → dispatch → recordBench shape in step 5, 2026-07-25 -->`.

## 4. Surface Work — `docs/roadmap/` (the mechanical-writer debit)

Order-independent relative to §2/§3.

- [x] **Collision check before writing** — run and record the output:
  ```
  node --input-type=module -e "import { findDeclaredChange } from './governance/roadmap/roadmap.js'; console.log(JSON.stringify(findDeclaredChange('review-bench-manifest-mechanical-writer', process.cwd())))"
  ```
  plus `ls docs/features/ docs/archive/ | grep -i mechanical-writer` (expect: nothing). A collision goes to the owner — never a silent rename ([skills/roadmap/SKILL.md](../../../skills/roadmap/SKILL.md), `register` step 2).
- [x] Insert the `- **Feature:** … review-bench-manifest-mechanical-writer` bullet + its `- Aceite:` sub-bullet from [design.md](design.md) §5 into `docs/roadmap/epics/EPIC-kit-discipline-hardening.md`'s `## Features`, immediately after the `review-usage-bench-manifest` bullet, in the file's existing pt-BR prose. The sub-bullet **must** name the `manifest-duplicate` contract conflict as the crux. *(criterion `mechanical-writer-registered-as-debit`)*
- [x] **Reconcile the stale clause on the EXISTING `review-usage-bench-manifest` bullet** (raised by the `critic` step). Its current `Pino:` clause still promises the copy-paste example *in `commands/review.md`* and still frames the mechanical route as an open branch of **this** change — both contradicted by what actually ships (the example is single-sourced in `skills/review/SKILL.md` per [DOCS.md](../../../DOCS.md) §2 rule 1, and the mechanical route became its own change-id). Trim that clause so the epic does not carry two features half-describing the same idea with contradictory pins; point the mechanical half at `review-bench-manifest-mechanical-writer`. Editorial only — do **not** rewrite the `Aceite:` sub-bullet, which is the declared acceptance this change is delivering against.
- [x] Write **no status field** anywhere in the epic ([ADR-002](../../decisions/ADR-002-roadmap-status-derived-from-disk.md)) and leave `## Não-goals` untouched.
- [x] Bring `docs/roadmap/ROADMAP.md` up to date — **never hand-edit it into disagreement with the deriver** (ADR-002). `derive-roadmap-status.js` only *reports*; it does not write the file. The bar that matters is derivability: every `` `id` → status `` line in the file must appear in `derive-roadmap-status.js --root .`, and every change the deriver returns must appear in the file (0 orphans, 0 missing), against the tree the file ships in — not against a newer `origin/main`. Expected derivation: `review-usage-bench-manifest` → `in-progress` (its `docs/features/` dir exists and the plan is committed, [ADR-007](../../decisions/ADR-007-roadmap-status-from-shared-git.md)/[ADR-009](../../decisions/ADR-009-flow-commits-plan-early.md)); `review-bench-manifest-mechanical-writer` → `backlog`.
- [x] Do **not** edit `docs/roadmap/README.md` — it indexes epics, and `EPIC-kit-discipline-hardening` is already listed.

## 5. Documentation

- [x] Prove the doc-only boundary mechanically: `git diff --stat` (and `git status --porcelain`) show **zero** paths under `governance/` and **zero** under `docs/decisions/`. Paste the output into [evidence.md](evidence.md). *(criterion `no-mechanical-write-this-change`)*
- [x] Confirm the copy-paste example exists in exactly one file: `grep -rn "recordBenchManifest" commands/ skills/` returns the pointer in `commands/review.md` **without** a fenced snippet, and the snippet only in `skills/review/SKILL.md`.
- [x] Fill [evidence.md](evidence.md)'s `## Files Touched` with the final list (expected: `commands/review.md`, `skills/review/SKILL.md`, `docs/roadmap/epics/EPIC-kit-discipline-hardening.md`, `docs/roadmap/ROADMAP.md`, `.claude-plugin/plugin.json`, + this change package).

## 6. Validation

Every command below is run from the repo root; paste each exit code + output into [evidence.md](evidence.md).

- [x] **Execute the example verbatim** — the load-bearing check, because a copy-paste example that does not run is a regression. In a scratch dir with `AIDAKIT_PROJECT_ROOT` set to it, run the step-5 manifest snippet and then the `recordBench` snippet for two roles with real timestamps, then:
  ```
  node governance/validators/check-bench.js <scratch>/.aidakit/tasks/<probe-id>/bench.ndjson --bench review --outcome consensus
  ```
  → **exit 0**. Copy the snippets out of the edited `SKILL.md`, not out of this plan. Record the resulting ndjson lines in [evidence.md](evidence.md). Delete the scratch dir in §7.
- [x] Optionally also reproduce the negative case (a `dispatched_at` predating the manifest → `manifest-not-first`, exit 1) to confirm the invariant the doc claims is the one the validator enforces.
- [x] `node governance/validators/check-links.js .` → **exit 0** flatly. (While the branch was based on `ab037b7` this bullet allowed "no NEW break vs. the §1 baseline", because 13 links into archived dirs were broken repo-wide. The rebase pulled [ADR-014](../../decisions/ADR-014-archive-aware-link-resolution.md) / PR #46, which resolves all 13 — the baseline is zero and the strict form applies.)
- [x] `node governance/validators/check-links.js docs/features/review-usage-bench-manifest` → exit 0 (this change package's own links resolve).
- [x] `node governance/validators/derive-roadmap-status.js --root .` → exit 0 with the two derivations expected in §4.
- [x] `node governance/validators/check-plugin-version.js .` → exit 0 after the bump.
- [x] Bump `version` in `.claude-plugin/plugin.json` strictly above the value read in §1 (`0.9.0` at plan time → recommended `0.9.1`, patch: doc-only). Without it `claude plugin update` no-ops and the fix reaches no installed user ([PROCESS.md](../../../PROCESS.md) §5).
- [x] Regression floor (no code changed, so this must be trivially green): `for f in governance/__tests__/*.test.mjs; do node "$f"; done` — all suites pass, `check-bench.test.mjs` included. *(All 21 suites green at the shipped base `ec2ce7e` (`context-pack.test.mjs` 155/0, `check-bench.test.mjs` 20/0). An earlier run showed 12 failures in `context-pack.test.mjs`; that was a stale-base artifact, not a deviation — see [evidence.md](evidence.md) § Unresolved Deviations §1.)*

## 7. Cleanup

- [x] Delete the scratch dir used by §6's example probe (nothing from it is committed; `.aidakit/tasks/<probe-id>/` must not appear in `git status`).
- [x] Verify no stray `<change-id>`/`<probe-id>` placeholder leaked into a committed file: `grep -rn "probe" commands/review.md skills/review/SKILL.md` returns nothing.
- [x] Fill [evidence.md](evidence.md)'s `## Unresolved Deviations` — explicitly write "none" if there are none; an empty section is not an answer.
- [x] Confirm the change package is committed before the review bench runs, so `review-usage-bench-manifest` derives `in-progress` from the shared git signal ([ADR-007](../../decisions/ADR-007-roadmap-status-from-shared-git.md), [ADR-009](../../decisions/ADR-009-flow-commits-plan-early.md)).
