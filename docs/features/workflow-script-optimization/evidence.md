# Evidence — workflow-script-optimization

**Change ID:** `workflow-script-optimization`
**Date:** `2026-07-25`
**Owner:** `@chacal88`
**Phase / Package:** `n/a (audit-only, docs surface: docs/features/ + docs/roadmap/)`
**PRD:** `n/a`
**Tech Spec:** `n/a`

> Pre-execution stub. Everything below the plan-time sections is filled during implementation with the **command and its output**, verbatim, per criterion `no-fabricated-token-numbers` — no number ships here that a re-run of its own command does not reproduce.
>
> Two structural rules for whoever fills this file:
> 1. `## Context-pack telemetry rollup` is owned by `governance/telemetry/rollup.js`, which rewrites everything from that heading to the next `## ` heading (or EOF). It is deliberately the **last** section; never put content inside its span.
> 2. A fenced block whose last line matches `N files changed` is a claim gated by `governance/validators/check-evidence-stat.js` against the live diff. Capture it last and iterate to a fixpoint.

## Plan-time baselines (measured 2026-07-25, before any audit file existed)

Recorded so that implementation-time results are read against a real baseline rather than an assumption. Re-measure; do not copy.

- `node governance/validators/check-links.js .` → **exit 0**, `{"validator":"aidakit.check-links","ok":true,"files_checked":241,"errors":[]}`.
- `node governance/validators/check-plugin-version.js .` → **exit 0**, `{"validator":"aidakit.check-plugin-version","ok":true,"manifest":"0.9.1","highest":"0.9","behind":[],"scanned":309}` — so a docs-only change with no doctrine footer needs no version bump.
- `node governance/validators/derive-roadmap-status.js --root . --json` → **exit 0**, `ok=true`, **6 orphans per the deriver** (`post-merge-sweep`, `engine-parallel-fate`, `review-bench-manifest-mechanical-writer`, `context-pack-heading-alignment`, `context-pack-heading-drift`, `check-links-code-span-skip`) — i.e. 6 declared change-ids with no artifact dir on disk. This is why the validation task runs the deriver **without** `--strict`. No claim is made here that all 6 are open work: **3 of them describe work already shipped** (finding F4), and the other 3 were not audited by this change.
- Flow shape: `grep -cE '^\s+- id:' governance/flows/<f>.yaml` → `full: 36`, `fast: 23`, `design: 10`, `docs-onboarding: 9`. Type histogram (`awk '/^  - id:/{f=1} f&&/^    type:/{print $2; f=0}' … | sort | uniq -c`) → `full` 15 `invoke` / 15 `runs` / 4 `human_gate` / 2 `terminal`; `fast` 9/9/3/2; `design` 5/0/4/1; `docs-onboarding` 4/2/1/2.
- Agent prompt bodies: `wc -c -w agents/*.md` → **13 files, 20800 words, 139797 bytes** in total.
- Prior telemetry in this repo: `grep -rl '^No telemetry captured for this run' docs/` → **2** files (`docs/archive/2026-07-24-context-pack-l1/evidence.md:56`, `docs/features/review-usage-bench-manifest/evidence.md:179`), which are the only two `evidence.md` files carrying the section at all. This change's run is the first with rows on disk.

## Validation Outputs

_(filled during implementation — one entry per Exit criterion of [proposal.md](proposal.md), command + output + exit code)_

### Baselines re-measured at implementation start (2026-07-25, `fa580e5`)

- `git log -1 --format='%h %s'` → `fa580e5 plan(workflow-script-optimization): fix stale finding count in design.md §6`. `git status --short` → clean except `?? docs/features/workflow-script-optimization/.context-pack.md`. `git branch --show-current` → `claude/workflow-script-optimization-d03775` (not `main`).
- `ls agents/*.md | wc -l` → **13** (matches plan-time). `ls governance/flows/*.yaml` → `design.yaml docs-onboarding.yaml fast.yaml full.yaml` (the 4, matches). `grep -c "output_tokens" governance/telemetry/rollup.js` → **0** (F2 still open — matches plan-time assumption, no drift).
- `node governance/validators/check-links.js .` → **exit 0**, `{"validator":"aidakit.check-links","ok":true,"files_checked":246,"errors":[]}` (246 vs plan-time 241 — tree grew by 5 files since planning; no regression).
- `node governance/validators/check-plugin-version.js .` → **exit 0**, `{"validator":"aidakit.check-plugin-version","ok":true,"manifest":"0.9.1","highest":"0.9","behind":[],"scanned":314}` (314 vs plan-time 309 — same growth).
- `node governance/validators/derive-roadmap-status.js --root . --json` → **exit 0**, `ok=true`, same **6 orphans** as the plan-time baseline at this point (`post-merge-sweep`, `engine-parallel-fate`, `review-bench-manifest-mechanical-writer`, `context-pack-heading-alignment`, `context-pack-heading-drift`, `check-links-code-span-skip`) — no drift **yet**; see §Unresolved Deviations for the count after the mandatory rebase.
- `node governance/validators/check-evidence-stat.js workflow-script-optimization` → **exit 0**, `{"gate":"evidence-stat-freshness","ok":true,"blocks":0}`.
- `wc -l .aidakit/tasks/workflow-script-optimization/.telemetry.jsonl` → **8** lines (grew from the plan-time 3 — the flow continued through `specify`/`critic`/`readiness` while this implementation was authored; no hole, a growing prefix as expected).

### Post-authoring validation

- `node governance/validators/check-links.js .` → **exit 1**. `{"validator":"aidakit.check-links","ok":false,"files_checked":254,"errors":[{"rule":"link-broken","file":"docs/features/plan-gate-executor-internals-check/proposal.md","line":75,"href":"../../../.aidakit/tasks/plan-gate-executor-internals-check/brainstorm.json","message":"internal link does not resolve"}]}`. **This is a pre-existing defect, not a regression from this change**: `git show 80610ab:docs/features/plan-gate-executor-internals-check/proposal.md | grep -n brainstorm.json` reproduces the identical broken link on the exact commit this change rebased onto — it predates every edit in this diff, the file is outside this change's declared bound (`docs/features/plan-gate-executor-internals-check/**` is neither `docs/features/workflow-script-optimization/**` nor `docs/roadmap/**`), and fixing it would itself be a scope escalation under this change's own hard bound. Scoped re-run proving no regression from this diff: `node governance/validators/check-links.js docs/features/workflow-script-optimization/` → exit 0, 7 files, 0 errors; `node governance/validators/check-links.js docs/roadmap/` → exit 0, 7 files, 0 errors.
- `node governance/validators/check-plugin-version.js .` → **exit 0**, `{"ok":true,"manifest":"0.9.1","highest":"0.9","behind":[],"scanned":322}`.
- `node governance/validators/derive-roadmap-status.js --root .` (non-strict) → **exit 0**, `ok=true`; `workflow-script-optimization` derives `in-progress`; every newly registered candidate (`flow-request-classify-domain-contract`, `hardening-anti-hardcode-split`, `trim-doc-planner-agent-prompt`, `trim-reviewer-quality-agent-prompt`, `telemetry-rollup-missing-fields`, `stale-backlog-declaration-cleanup`) derives `backlog`.
- `node governance/telemetry/rollup.js --change-id workflow-script-optimization` → **exit 0**, `{"ok":true,"changeId":"workflow-script-optimization","dispatches":8}` — `Total dispatches: 8`, non-zero.
- `node governance/validators/check-evidence-stat.js workflow-script-optimization` → **exit 0**, `{"gate":"evidence-stat-freshness","ok":true,"change_id":"workflow-script-optimization","blocks":1,"stale":0,"errors":[]}` — the fixpoint, reached iteratively (each capture changes the diff, including `tasks.md`'s own `[x]` marks made after an earlier capture); the block below is the one that matches the live diff with `stale: 0`.
- `git diff HEAD --stat -- governance/ agents/ skills/ commands/ hooks/` → **prints nothing** (pasted above, §Files Touched) — mechanical proof of `audit-only-no-flow-edits`.
- `for f in governance/__tests__/*.test.mjs; do node "$f"; done` → **all 22 suites green**: `agent-validator-paths` 31/0, `brainstorm-schema` 34/0, `candidates` 8/0, `check-acceptance` 31/0, `check-adr-format` 8/0, `check-bench` 20/0, `check-docs` 8/0, `check-evidence-stat` 12/0, `check-links` 22/0, `context-pack` 155/0, `dna-freshness` 7/0, `dna-write` 14/0, `engine` 264/0, `ledger` 8/0, `plugin-version` 12/0, `pr-automation` 200/0, `prelude` 13/0, `progress-table` 30/0, `retry-memory` 87/0, `roadmap` 28/0, `step-summaries` 107/0, `yaml-min` 17/0. All exit 0.
- Acceptance-criteria byte-identity (criterion, [ADR-010](../../decisions/ADR-010-acceptance-leash.md) §Decision-3): all 8 `## Acceptance criteria` bullets in `proposal.md` verified programmatically to match `.aidakit/tasks/workflow-script-optimization/brainstorm.json`'s `acceptance_criteria[]` verbatim (id + criterion text) — 8/8 matched, 0 mismatches.

**Historical record (commit `856351f`, superseded — not re-checked live).** `git diff HEAD --stat` at that fixpoint, before the commit, reported 9 files changed: `.context-pack.md` (+81), `dispatch-cost.md` (+124), `evidence.md` (+102/-…), `inventory.md` (+351), `tasks.md` (+118/-…), `ROADMAP.md` (+13), the three `EPIC-*.md` files (+7/+4/+4) — 738 insertions(+), 66 deletions(-) total, matching `git show --stat 856351f` exactly at the time. Recorded as prose, deliberately not as a fenced `N files changed` block, because `HEAD` moved twice since (the bench-round-1 rebase, then this round's own fixes) and a stale fenced claim here would trip `check-evidence-stat.js` against a diff this text no longer describes — see the current fixpoint capture in §Bench round 1 fixes below for the live one.

### Reproduction of every quoted number

Every command quoted inside `inventory.md`/`dispatch-cost.md` was re-run against the shipped tree at validation time. **One defect found and fixed in the process** (criterion `no-fabricated-token-numbers`, the discipline it exists to catch): `inventory.md` §3's "19 distinct targets" claim originally cited `grep -oE 'invoke_target: [a-zA-Z0-9:_-]+' governance/flows/*.yaml | sort -u | wc -l` — that exact command returns **30**, not 19, because `grep` prepends a `filename:` prefix when given multiple file arguments (even with `-o`), so `sort -u` deduped `(file, target)` pairs instead of target names. Fixed by adding `-h` (suppress filename): `grep -ohE 'invoke_target: [a-zA-Z0-9:_-]+' governance/flows/*.yaml | sort -u | wc -l` → **19**, matching the claim. `inventory.md` now carries the corrected command and explains the `-h` flag explicitly.

A second, non-defect drift: `dispatch-cost.md`'s `skills/readiness/SKILL.md` row was measured before the mandatory rebase (3104 words / 21265 bytes) and re-measured after (3465 words / 23776 bytes) — the rebase's `80610ab` (PR #52) added "Process §14" to that exact file. The table now carries the post-rebase number with a drift note; the total row (25031 words / 173250 bytes) was recomputed to match.

Every other quoted command (step/type counts per flow, dispatch-tier resolution loop, the `grep -roE`/`grep -rc`/`grep -rn` forbidden-derivation counter-example, F1–F5's citations, the `static` per-flow `invoke_target` counts) reproduced its stated number exactly on this re-run — see the inline command blocks above (§Baselines re-measured, and the commands embedded in `inventory.md`/`dispatch-cost.md` themselves, which are the primary source and are not re-pasted here a third time). **Correction — this claim was false for the `wc -c -w agents/*.md` table, caught by review-bench round 2, not by this reproduction pass itself:** `agents/doc-planner.md` changed inside the rebase window (`48f4731`/PR #54, an ancestor of `6af0e7a`) between this table's first draft and this reproduction check, and was never re-measured — the identical drift class round 1 caught for `skills/readiness/SKILL.md`, missed here for the file driving the top-ranked cost row. Re-measured in response to the round-2 finding: `agents/doc-planner.md` moved from 2161/14752 to **2198 words / 15105 bytes**; the 13-file total from 20800/139797 to **20837/140150**; `dispatch-cost.md`'s doc-planner ranking cell from 44256 to **45315** (15105 × Σ happy-path 3) — ranking order unaffected, `doc-planner` was and remains rank 1. The other 12 `agents/*.md` and all 14 `skills/*/SKILL.md` bodies were re-confirmed byte-identical to their tabled values this pass. `dispatch-cost.md` §1 now carries this as a dated drift note, mirroring the `skills/readiness/SKILL.md` one from round 1, instead of the now-corrected "matches the plan-time baseline exactly; no drift" claim.

### Bench round 1 fixes (second rebase, commit `856351f` → `8a6ce73`, this pass)

Review bench round 1 on the first commit (`856351f`) returned 3 fail (`adr-reviewer`, `reviewer-quality`, `reviewer-architecture`) / 2 pass (`spec-reviewer`, `reviewer-security`). Fixes applied in the coordinator's order, each re-measured rather than copied from the finding text:

**Rebase result.** `git fetch origin` → tip moved from `80610ab` to `6af0e7a` (3 new commits: `db4443e`/PR #55 archived 4 shipped changes and regenerated `ROADMAP.md`; `48f4731`/PR #54 doc-leash fix; `eba1acb`/PR #56 fixed the exact pre-existing `check-links` defect this file's §Post-authoring validation already reported as pre-existing and out-of-scope; `6af0e7a`/PR #57 archived `plan-gate-executor-internals-check`). `git rebase origin/main` → **1 conflict**, `docs/roadmap/ROADMAP.md` only (`EPIC-kit-discipline-hardening.md` auto-merged cleanly — PR #55's only change there was an `Entregue` trailer on an unrelated line, `step-summaries-type-gate-tests`, that this change's own additions don't touch). Resolved by **regenerating from the deriver's fresh JSON** (never hand-merging the two conflict sides) — verified 0 missing / 0 extra against `derive-roadmap-status.js --root . --json` (34 change-ids both sides) before continuing the rebase. `git diff origin/main -- docs/roadmap/epics/` → 0 deletions (additions-only holds against the new base too). New HEAD after `--continue`: `8a6ce73`.

1. **ROADMAP.md conflict** — resolved by full regen from the post-rebase deriver output (not a hand-merge); re-verified 0 missing / 0 extra (34/34 ids) and additions-only vs the epics' legacy lines (0 deletions in `git diff origin/main -- docs/roadmap/epics/`).
2. **F4 reworked** — re-ran `derive-roadmap-status.js --root . --json` post-rebase: **4 pre-existing orphans** now (`post-merge-sweep`, `engine-parallel-fate`, `review-bench-manifest-mechanical-writer`, `design-claims-anchor-validator`), down from 7 — a concurrent PR (#55, `db4443e`) archived the 3 ids F4 had flagged stale (`context-pack-heading-alignment`, `context-pack-heading-drift`, `check-links-code-span-skip`) plus 2 more (`review-usage-bench-manifest`, `plan-gate-executor-internals-check`). `inventory.md` F4 now keeps both dated observations (2026-07-25 ~13:50 finding the 3 stale ids; 2026-07-25 later, the concurrent correction) rather than silently updating the count, and names the one thing the correction did NOT fix — `context-pack-heading-alignment`/`context-pack-heading-drift` are still two Feature lines for one defect (`grep -n 'changes: context-pack-heading' docs/roadmap/epics/EPIC-kit-discipline-hardening.md` → lines `35`, `38`). `stale-backlog-declaration-cleanup`'s Acceptance in `EPIC-kit-discipline-hardening.md` rescoped to the two things still real: the de-duplication, and auditing the 4 current orphans.
3. **`inventory.md` rejected-candidates Locus fixed** — the cited `full.yaml:33`–`34`/`fast.yaml:20` were table positions, not file lines. Re-measured: `grep -nE '^\s+- id: (merge_route|auto_merge|merge)\s*$' governance/flows/full.yaml governance/flows/fast.yaml` → `full.yaml:469` (`auto_merge`), `:491` (`merge`); `fast.yaml:287` (`auto_merge`), `:309` (`merge`). Cell corrected to cite these, with the exact re-verification command inline so the next pass re-runs it instead of copying.
4. **`aidakit:spec-reviewer` dual sourcing registered** — `inventory.md` §3a's `spec-reviewer` row now states the second-order path explicitly (`skills/review/SKILL.md:52`, the base-role text: "assemble the prompts for the two **base** reviewer agents... which run always") alongside the first-order `critic` path (`full.yaml:129`), both re-verified this pass; §3b carries a cross-reference note explaining why `spec-reviewer` is not a 9th row there (would double-count against both the 5-agent and 8-agent totals).
5. **ADR-015 cited** — F5 and all three `readiness` dispatcher rows (`inventory.md` §2 `full` row 10, §2 `fast` row 6, §3c skill-only table) now cite [ADR-015](../../decisions/ADR-015-readiness-owns-internals-claims-gate.md) §Decision-1, which independently locks `readiness` as the owner of a mandatory semantic gate — corroborating, not superseding, this audit's own four-question-test verdict.
6. **`check-context-pack-freshness.js` added to Exit criteria** — `proposal.md` §Exit criteria gained a new bullet requiring `node governance/validators/check-context-pack-freshness.js docs/features/workflow-script-optimization/.context-pack.md` → exit 0, explicitly ordered as the LAST artifact step (any `sources[]` edit after the rebuild re-stales it). Output recorded below, after the rebuild.
7. **Pack rebuild** — see the freshness-check output at the end of this section; run only after every other edit in this round.

Post-fix validator re-run (scoped, matching the criteria this round targeted):

- `node governance/validators/check-links.js docs/features/workflow-script-optimization/` → exit 0. `node governance/validators/check-links.js docs/roadmap/` → exit 0.
- `node governance/validators/check-plugin-version.js .` → exit 0.
- `node governance/validators/derive-roadmap-status.js --root .` (non-strict) → exit 0, `ok=true`, `workflow-script-optimization` still derives `in-progress`.
- `node governance/telemetry/rollup.js --change-id workflow-script-optimization` → exit 0.
- `for f in governance/__tests__/*.test.mjs; do node "$f"; done` → 22/22 suites green (unchanged; this round touched no code).
- `node governance/context-pack/build.js build --change-id workflow-script-optimization` → `{"ok":true,"subcommand":"build","path":".../docs/features/workflow-script-optimization/.context-pack.md"}`, exit 0. Then, with no further edit to any `sources[]` file (14 ADRs + `design.md` + `proposal.md` + `tasks.md`): `node governance/validators/check-context-pack-freshness.js docs/features/workflow-script-optimization/.context-pack.md` → `{"validator":"aidakit.check-context-pack-freshness","ok":true,"path":"docs/features/workflow-script-optimization/.context-pack.md","sources_checked":17,"errors":[]}`, **exit 0**, 17/17 sources fresh.

**Historical record (commit `3f5e150`, superseded — not re-checked live).** `git diff HEAD --stat` for that round, relative to `8a6ce73`, at its own fixpoint: 5 files changed — `.context-pack.md` (+17/-…), `evidence.md` (+64/-…), `inventory.md` (+30/-…), `proposal.md` (+1), `EPIC-kit-discipline-hardening.md` (+2/-1) — 77 insertions(+), 37 deletions(-) total, matching `git show --stat 3f5e150` at the time. Kept as prose, not a fenced `N files changed` block, for the same reason as the round-1 historical record above: `HEAD` has moved again (this round's own fixes), and a stale fenced claim here would trip `check-evidence-stat.js`. The live fixpoint for *this* round is captured in §Bench round 2 fix below.

### Bench round 2 fix (`agents/doc-planner.md` drift, commit `3f5e150` → this pass)

Review bench round 2 on `3f5e150`: `adr-reviewer` PASS, `reviewer-architecture` PASS (round 1's 3 fixes verified closed), `reviewer-quality` FAIL — 1 new blocking. `agents/doc-planner.md` changed inside the rebase window (`48f4731`/PR #54, an ancestor of `6af0e7a`) and was never re-measured after — the same drift class round 1 caught for `skills/readiness/SKILL.md`, missed here for the file driving the top-ranked cost row.

- Re-measured `wc -c -w agents/*.md`: `agents/doc-planner.md` **2198 words / 15105 bytes** (was 2161/14752); 13-file total **20837 words / 140150 bytes** (was 20800/139797). The other 12 files re-confirmed byte-identical to their tabled values.
- `dispatch-cost.md` §1 (body-size table + total) and §2 (doc-planner ranking cell, `15105 × 3 = 45315`, was `44256`) updated; the "Reading the extremes" prose corrected to the new numbers and states explicitly that ranking order is unaffected (`doc-planner` was rank 1, remains rank 1 — next-highest `reviewer-quality` at 26940 is unaffected).
- §1's now-false "matches the plan-time baseline exactly; no drift" claim replaced with a dated drift note citing `48f4731`/PR #54, mirroring §4's existing `skills/readiness/SKILL.md` note.
- `EPIC-context-caching.md`'s `trim-doc-planner-agent-prompt` Feature acceptance updated from the stale `14752 bytes, top-ranked at 44256` to the re-measured `15105 bytes`/`45315`, with the PR #54 citation.
- This file's own "Reproduction of every quoted number" claim corrected — it had asserted the `wc -c -w agents/*.md` table reproduced exactly, which was false for `doc-planner`; the correction is recorded above, in place, with the round-2 finding named as cause rather than silently fixed.

Post-fix checks: none of `dispatch-cost.md`/`EPIC-context-caching.md`/this file are in the pack's 17-source list (verified: `sed -n '/^sources:/,/^---/p' .context-pack.md | grep path:` → the 14 ADRs + `design.md`/`proposal.md`/`tasks.md`, none of this round's 3 edited files), so no rebuild is structurally required by this round's edits.

- `node governance/validators/check-context-pack-freshness.js docs/features/workflow-script-optimization/.context-pack.md` → `{"validator":"aidakit.check-context-pack-freshness","ok":true,"path":"docs/features/workflow-script-optimization/.context-pack.md","sources_checked":17,"errors":[]}`, **exit 0**, 17/17 fresh — confirms the prediction above rather than assuming it.
- `node governance/validators/check-links.js docs/features/workflow-script-optimization/` → exit 0. `node governance/validators/check-links.js docs/roadmap/` → exit 0.
- `git diff HEAD --stat -- governance/ agents/ skills/ commands/ hooks/` → empty — audit-only guard holds.

**Historical record (commit `09d1939`, superseded by its own commit — recorded as prose, not a fenced block).** `git diff HEAD --stat` for the round-2 fix (relative to `3f5e150`), captured last and iterated to the fixpoint before committing, reported 3 files changed — `dispatch-cost.md` (10 ±), `evidence.md` (32 ±), `docs/roadmap/epics/EPIC-context-caching.md` (2 ±) — 30 insertions(+), 14 deletions(-), matching `git show 09d1939 --stat` exactly (the permanent, commit-anchored reproduction command). Deliberately de-fenced after the commit landed, mirroring the `856351f` record above: a fenced `N files changed` block is gated by `check-evidence-stat.js` against the LIVE `git diff HEAD`, which is empty on a clean committed tree — the late-hardening pass reproduced exactly that (validator exit 1, `evidence-stat-stale`, on content that matches `git show 09d1939 --stat` byte-for-byte), the same commit-timing semantics documented for `856351f`.

## Raw dispatch telemetry (verbatim JSONL)

Source: `cat .aidakit/tasks/workflow-script-optimization/.telemetry.jsonl` — gitignored and worktree-local, which is why it is pasted here. **A prefix of the run, not a total:** dispatches continue after this capture (document, acceptance, pr…), so no per-flow total is derivable from these rows.

Capture at plan time (2026-07-25, after the `brainstorm` step resolved, while `specify` was paused — 3 dispatches):

```
{"ts":"2026-07-25T12:53:26.287Z","subagent":"aidakit:orchestrator","cache_creation":62356,"cache_read":125910,"output_tokens":3747,"pack_size":0,"duration_ms":53425,"pack_rebuilt":false}
{"ts":"2026-07-25T12:53:46.862Z","subagent":"aidakit:identify-domain","cache_creation":0,"cache_read":0,"output_tokens":0,"pack_size":0,"duration_ms":0,"pack_rebuilt":false}
{"ts":"2026-07-25T12:54:01.225Z","subagent":"aidakit:brainstorm","cache_creation":397550,"cache_read":1377529,"output_tokens":44539,"pack_size":0,"duration_ms":331959,"pack_rebuilt":false}
```

Reading, kept inside what the rows support:

- `aidakit:brainstorm` — `cache_read` 1377529 against `output_tokens` 44539 → **30.9×** (1377529 / 44539 = 30.93). Re-read context, not generation, is what the dispatch paid for.
- `aidakit:identify-domain` (the `classify` step) — every counter zero: the classification was reused from the change package, so the step consumed no new LLM tokens on this run. Recorded as finding F3, not as a missing measurement.
- `pack_size` is 0 on all three rows: `docs/features/workflow-script-optimization/.context-pack.md` does not exist yet at this point in the flow (the `context_pack` phase sits between `readiness` and `implement`). Not a defect; a consequence of where in the graph these dispatches happened.

Capture mid-implementation (2026-07-25T13:39:26Z, while `inventory.md`/`dispatch-cost.md` were being authored — 8 dispatches, still a **prefix**: `implement`, `document`, `acceptance`, `pr`… have not run yet):

```
{"ts":"2026-07-25T12:53:26.287Z","subagent":"aidakit:orchestrator","cache_creation":62356,"cache_read":125910,"output_tokens":3747,"pack_size":0,"duration_ms":53425,"pack_rebuilt":false}
{"ts":"2026-07-25T12:53:46.862Z","subagent":"aidakit:identify-domain","cache_creation":0,"cache_read":0,"output_tokens":0,"pack_size":0,"duration_ms":0,"pack_rebuilt":false}
{"ts":"2026-07-25T12:54:01.225Z","subagent":"aidakit:brainstorm","cache_creation":397550,"cache_read":1377529,"output_tokens":44539,"pack_size":0,"duration_ms":331959,"pack_rebuilt":false}
{"ts":"2026-07-25T13:12:18.208Z","subagent":"aidakit:plan","cache_creation":491909,"cache_read":10705539,"output_tokens":73767,"pack_size":0,"duration_ms":1015840,"pack_rebuilt":false}
{"ts":"2026-07-25T13:20:50.440Z","subagent":"aidakit:spec-reviewer","cache_creation":294882,"cache_read":4985828,"output_tokens":36776,"pack_size":0,"duration_ms":475619,"pack_rebuilt":false}
{"ts":"2026-07-25T13:27:52.984Z","subagent":"aidakit:plan","cache_creation":446233,"cache_read":11386314,"output_tokens":24322,"pack_size":0,"duration_ms":375005,"pack_rebuilt":false}
{"ts":"2026-07-25T13:31:51.814Z","subagent":"aidakit:spec-reviewer","cache_creation":649237,"cache_read":3646729,"output_tokens":5388,"pack_size":0,"duration_ms":134332,"pack_rebuilt":false}
{"ts":"2026-07-25T13:38:24.251Z","subagent":"aidakit:readiness","cache_creation":321216,"cache_read":2654668,"output_tokens":19822,"pack_size":0,"duration_ms":260598,"pack_rebuilt":false}
```

Reading, kept inside what these 5 new rows (beyond the plan-time 3) support:

- `aidakit:plan` fired **twice** (491909/10705539/73767/1015840ms, then 446233/11386314/24322/375005ms) — this is the `specify`→`critic`(revise)→`record_critic_cause`→`specify` back-edge from `inventory.md` §2 row 8, consumed exactly once: `retry-history.json` on disk records `{"round": 1, "step_id": "specify", "cause": "plan-citations-and-methodology-not-yet-measure-dont-recall-clean"}`. The second `aidakit:plan` dispatch (round 2, 375005ms) is markedly cheaper in `output_tokens` (24322 vs round 1's 73767 — 33%) though `cache_read` is nearly identical (~10.7M vs ~11.4M) — consistent with round 2 re-reading the same durable context but producing a smaller, more targeted revision.
- `aidakit:spec-reviewer` (the `critic` step) also fired **twice**, matching the same back-edge: round 1 (`revise`, 294882/4985828/36776/475619ms) and round 2 (`ok`, 649237/3646729/5388/134332ms). Round 2's `output_tokens` (5388) is roughly **7×** smaller than round 1's (36776) and its `duration_ms` (134332) is roughly **3.5×** shorter (475619) — a second-round approval verdict is cheap relative to a first-round rejection with findings, arithmetic: 36776/5388 ≈ 6.83; 475619/134332 ≈ 3.54.
- `aidakit:readiness` fired once (321216/2654668/19822/260598ms) — no back-edge consumed for this step in this run (the flow reached `context_pack`/`implement` on the first `readiness` visit).
- No row for `aidakit:doc-planner` or `aidakit:acceptance-planner` yet — `document`/`acceptance` sit after `learn` in `full.yaml`, not yet reached by this prefix. Not a hole; simply not-yet-dispatched.

_(a further capture at implementation end, if `implement`'s own dispatch adds rows before this file is committed, is out of this dispatch's own scope — the flow's `learn` step is the designated rollup point per [ADR-013](../../decisions/ADR-013-context-pack-per-change.md) §Decision-7, and `## Context-pack telemetry rollup` below is regenerated there, not hand-maintained)_

## Files Touched

- `docs/features/workflow-script-optimization/inventory.md` (new) — the audit's entry point: §1 method + reproduction commands, §2 four per-flow step tables (78 rows total), §3 dispatcher register (first-order/second-order/skill-only), §4 findings F1–F5, §5 candidate register (2 admitted, 4 rejected).
- `docs/features/workflow-script-optimization/dispatch-cost.md` (new) — the measured agent-prompt cost table (`body_bytes × happy_path_dispatches` ranking, 13 agents), the skill-body table (14 skill-only dispatchers), and the raw-telemetry cross-reference for the `observed` tier.
- `docs/features/workflow-script-optimization/evidence.md` (modified) — baselines re-measured at implementation start, the re-captured raw telemetry paste (8 dispatches, mid-`implement`), the Unresolved Deviations entries for both rebase-driven orphan-count drifts (7 then 4), this Files Touched section, and the validation outputs below.
- `docs/features/workflow-script-optimization/proposal.md` (modified) — added a `check-context-pack-freshness.js` bullet to `## Exit criteria` (architecture-bench finding: this change's own rigor never checked pack freshness).
- `docs/features/workflow-script-optimization/tasks.md` (modified) — every completed bullet marked `[x]` as the work happened.
- `docs/features/workflow-script-optimization/.context-pack.md` (new, staged by name) — built by the flow's `context_pack` phase before `implement`; tracked per [ADR-013](../../decisions/ADR-013-context-pack-per-change.md) / [design.md](design.md) §9 so it survives the [DOCS.md](../../../DOCS.md) §4 archive move.
- `docs/roadmap/epics/EPIC-context-caching.md` (modified, additions-only) — registers this change itself as a Feature, plus the two dispatch-cost trim candidates (`trim-doc-planner-agent-prompt`, `trim-reviewer-quality-agent-prompt`).
- `docs/roadmap/epics/EPIC-flow-engine-leashes.md` (modified, additions-only) — registers the two admitted leash/contract candidates (`flow-request-classify-domain-contract` for F1, `hardening-anti-hardcode-split` for the hardening split).
- `docs/roadmap/epics/EPIC-kit-discipline-hardening.md` (modified, additions-only) — registers F2 (`telemetry-rollup-missing-fields`) and F4 (`stale-backlog-declaration-cleanup`) as new, separate Features; the two pre-existing `context-pack-heading-*` entries are untouched.
- `docs/roadmap/ROADMAP.md` (regenerated) — the Now/Next/Later view rebuilt from the deriver's post-rebase output; verified 0 missing / 0 extra against `derive-roadmap-status.js --root .` (34 change-ids on both sides).

**Zero files under `governance/`, `agents/`, `skills/`, `commands/`, `hooks/`** — the mechanical proof of `audit-only-no-flow-edits`:

```bash
git diff HEAD --stat -- governance/ agents/ skills/ commands/ hooks/
```

```
(empty — no output)
```

## Unresolved Deviations

_(filled during implementation. Record here — never by editing the plan into agreement — any assumption of [design.md](design.md) §12 that reality contradicted, any finding that a sibling worktree closed before this landed, any candidate the five-slot rule rejected that a reviewer may disagree about, and any telemetry hole where a resume did not carry the kwargs.)_

- **Orphan count drifted from 6 to 7 pre-existing after the mandatory rebase.** [design.md](design.md) §12's own assumptions section named this exact risk ("no sibling worktree is editing the same three epic files... check `git branch` and `docs/archive/` for jurisprudence"). The plan-time and pre-rebase baselines both measured 6 orphans (`node governance/validators/derive-roadmap-status.js --root . --json` → `ok=true`). Per [design.md](design.md) §7, `docs/roadmap/ROADMAP.md` may only be regenerated after rebasing onto the current `origin/main`; that rebase (`git rebase origin/main`, clean, no conflicts against this change's own diff) pulled in `80610ab` (PR #52, `plan-gate-executor-internals-check`'s Process §14 gate), which concurrently declared a 7th Feature — `design-claims-anchor-validator` — on `EPIC-kit-discipline-hardening.md`, the same epic this change's F2/F4 Features register into. Post-rebase (commit `07ab640`), the deriver reports **7 pre-existing orphans**, not 6; `docs/features/workflow-script-optimization/inventory.md` §4's F4 finding and this evidence file both record the corrected number rather than the plan-time one. `design-claims-anchor-validator` is not itself stale — it was declared in the same commit this change rebased onto, so "outlived its delivery" cannot apply to it; it is simply unaudited, alongside the pre-existing `post-merge-sweep`/`engine-parallel-fate`/`review-bench-manifest-mechanical-writer`.
- **`skills/readiness/SKILL.md` grew mid-authoring, from the same rebase.** The same `80610ab` commit added "Process §14" to `skills/readiness/SKILL.md` (17 lines). `dispatch-cost.md`'s skill-body table was drafted before the rebase (3104 words / 21265 bytes) and re-measured after (3465 words / 23776 bytes) during the §5 validation pass; the file now carries the post-rebase number with a drift note, and the skill-body total (25031 words / 173250 bytes) was recomputed to match. No claim in the shipped file uses the stale pre-rebase figure.
- **`check-links.js .` (whole-repo) returned exit 1 at the first authoring pass — a pre-existing defect, not a regression, subsequently fixed upstream.** `docs/features/plan-gate-executor-internals-check/proposal.md:75` linked to `.aidakit/tasks/plan-gate-executor-internals-check/brainstorm.json`, gitignored and unresolvable by construction (the same class of mistake [design.md](design.md) §9 warns against for this very change's own artifacts). Reproduced on the exact rebase-base commit alone (`git show 80610ab:docs/features/plan-gate-executor-internals-check/proposal.md | grep -n brainstorm.json`) at the time, confirming it predated every edit in this diff — outside this change's declared bound, so not fixed here (GOVERNANCE.md §3, report don't fix). **Resolved independently** by `eba1acb` (PR #56, "fix(docs): unlink gitignored brainstorm.json path in plan-gate proposal"), pulled in by this pass's own mandatory rebase; `plan-gate-executor-internals-check/proposal.md` itself was archived one commit later (`6af0e7a`, PR #57). `node governance/validators/check-links.js .` re-run this pass reports **exit 0** repo-wide — the earlier finding was correct and is now moot, not silently dropped.
- **Second rebase, second race: orphan count moved 7→4 mid-authoring.** Between this change's first commit (`856351f`, orphans=7 per the first drift note above) and the bench-round-1 fix pass, `origin/main` advanced 3 more commits (`db4443e`/PR #55, `48f4731`/PR #54, `eba1acb`/PR #56, `6af0e7a`/PR #57). PR #55 archived exactly the 3 ids this change's own F4 finding had flagged as stale declarations (`context-pack-heading-alignment`, `context-pack-heading-drift`, `check-links-code-span-skip`), plus 2 more (`review-usage-bench-manifest`, `plan-gate-executor-internals-check`) — the deriver now reports **4 pre-existing orphans**, not 7. `inventory.md` F4 was reworked to carry both dated observations rather than overwrite the first; `stale-backlog-declaration-cleanup`'s acceptance in `EPIC-kit-discipline-hardening.md` was rescoped to what remains real (the still-unmerged `context-pack-heading-*` duplicate registration, and auditing the 4 current orphans). [design.md](design.md) §12 anticipated concurrent-worktree drift as a named risk; this pass is the second time it materialized in one authoring session, not the first — worth recording as a frequency observation for whatever change eventually addresses `post-merge-sweep`.

## Context-pack telemetry rollup

- Total dispatches: 15
- Mean pack_size: 2889 bytes
- Sum cache_read: 277349552 tokens
- Sum cache_creation: 11468998 tokens
- Pack rebuilds: 0

| subagent | dispatches | mean cache_read | mean pack_size |
|---|---|---|---|
| aidakit:acceptance-planner | 1 | 972604 | 6489 |
| aidakit:brainstorm | 1 | 1377529 | 0 |
| aidakit:doc-planner | 1 | 1807466 | 6489 |
| aidakit:identify-domain | 1 | 0 | 0 |
| aidakit:implement | 1 | 57005411 | 4396 |
| aidakit:learn | 1 | 9682716 | 6489 |
| aidakit:orchestrator | 1 | 125910 | 0 |
| aidakit:plan | 2 | 11045927 | 0 |
| aidakit:readiness | 1 | 2654668 | 0 |
| aidakit:review | 1 | 163616078 | 6489 |
| aidakit:ship | 1 | 4389919 | 6489 |
| aidakit:spec-reviewer | 2 | 4316279 | 0 |
| aidakit:test | 1 | 4992841 | 6489 |

