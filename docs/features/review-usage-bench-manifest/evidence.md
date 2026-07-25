# Evidence — review-usage-bench-manifest

**Change ID:** `review-usage-bench-manifest`
**Date:** `2026-07-25`
**Owner:** `@chacal88`
**Phase / Package:** `n/a (doc-only surface fix on the review command + skill)`
**PRD:** `n/a`
**Tech Spec:** `n/a`

> **STUB authored during planning.** Every section below is filled during implementation with real command output — never with a summary of what was intended. The single pre-implementation entry is the plan-time probe recorded below, which is the empirical basis for [design.md](design.md) §2 and must be **re-run against the edited `SKILL.md`** at [tasks.md](tasks.md) §6 (the probe below used the plan's draft of the snippet, not the shipped one).

## Plan-time probe (2026-07-25, pre-implementation)

Run in a scratch dir with `AIDAKIT_PROJECT_ROOT` pointed at it, to verify the example's invocation form before writing it into the skill.

- **The ESM-from-Bash form works.** `node --input-type=module -e "import { recordBenchManifest } from '<gov>/ledgers/ledger.js'; …"` appended
  `{"at":"…","type":"bench-manifest","role":"__manifest__","bench":"review","round":1,"roles":["adr","spec"]}` to `.aidakit/tasks/<probe>/bench.ndjson`.
- **The naive attempt FAILS the leash.** With `dispatched_at` values fabricated *earlier* than the manifest write, `check-bench.js … --bench review --outcome consensus` returned exit 1 with `{"rule":"manifest-not-first", …}` — despite both roles reporting and the mechanical consensus matching. This is the non-obvious half of the requirement and is why the example carries the invariant explicitly.
- **Correct ordering passes.** Manifest first, `dispatched_at` after it → `{"validator":"aidakit.check-bench","ok":true,"roles_expected":["adr","spec"],"roles_reported":["adr","spec"],"mechanical_consensus":"pass","errors":[]}`, exit 0.

## Validation Outputs

_(populated during implementation — one entry per [tasks.md](tasks.md) §6 bullet, with the exact command, the exit code, and the output verbatim)_

### Baselines (§1, pre-implementation)

> **These figures are the pre-rebase tree** (branch cut from `ab037b7`). They are kept verbatim as the historical baseline they were, and deliberately NOT retrofitted to the final numbers — the whole point of a baseline is what was true before. The rebase onto `origin/main` later pulled [ADR-014](../../decisions/ADR-014-archive-aware-link-resolution.md) (PR #46), which resolves all 13 links below, and added files (309 scanned / 241 link-checked at the end, vs 293 scanned / 225 link-checked here). See the post-edit section for the final state.

`node governance/validators/check-links.js .` → **exit 1**, 13 broken links (all pre-existing, matches the known baseline: ADR-008/010/011 + `skills/{context-pack,implement,learn,plan}/SKILL.md`, all pointing at archived/non-existent feature dirs). Full JSON:
```
{"validator":"aidakit.check-links","ok":false,"files_checked":225,"errors":[
 {"file":"docs/decisions/ADR-008-opt-in-autonomous-pr-merge.md","line":43,"href":"../features/configurable-pr-automation/design.md"},
 {"file":"docs/decisions/ADR-010-acceptance-leash.md","line":23,"href":"../features/engine-max-visits/proposal.md"},
 {"file":"docs/decisions/ADR-010-acceptance-leash.md","line":25,"href":"../features/engine-max-visits/proposal.md"},
 {"file":"docs/decisions/ADR-010-acceptance-leash.md","line":33,"href":"../features/acceptance-leash/design.md"},
 {"file":"docs/decisions/ADR-010-acceptance-leash.md","line":35,"href":"../features/engine-max-visits/proposal.md"},
 {"file":"docs/decisions/ADR-010-acceptance-leash.md","line":39,"href":"../features/acceptance-leash/design.md"},
 {"file":"docs/decisions/ADR-011-runs-infra-error-routing.md","line":13,"href":"../features/runs-error-routing/proposal.md"},
 {"file":"docs/decisions/ADR-011-runs-infra-error-routing.md","line":13,"href":"../features/runs-error-routing/design.md"},
 {"file":"docs/roadmap/epics/EPIC-flow-engine-leashes.md","line":14,"href":"../../features/retry-memory/evidence.md"},
 {"file":"skills/context-pack/SKILL.md","line":26,"href":"path"},
 {"file":"skills/implement/SKILL.md","line":40,"href":"../../docs/features/retry-memory/design.md#..."},
 {"file":"skills/learn/SKILL.md","line":23,"href":"../../docs/features/retry-memory/design.md#..."},
 {"file":"skills/plan/SKILL.md","line":38,"href":"../../docs/features/retry-memory/design.md#..."}
]}
```

`node governance/validators/check-plugin-version.js .` → **exit 0**:
```
{"validator":"aidakit.check-plugin-version","ok":true,"manifest":"0.9.0","highest":"0.8","behind":[],"scanned":293}
```

`git show main:.claude-plugin/plugin.json` → `version: "0.9.0"` (confirmed live, matches plan-time value; bump target `0.9.1`).

Anchor re-verification (§1 bullet 1): `commands/review.md:15` is the last `Examples (copy-paste)` bullet, `:17` is the `Invoke this plugin's ...` paragraph — matches design.md §3. `skills/review/SKILL.md:62` is the `**Before dispatching anyone, write the bench manifest**` paragraph, `:76` is the `**All summoned agents run in parallel, in a single message**` paragraph — matches design.md §4. No anchor drift.

### Step-5 example, executed verbatim from the edited `skills/review/SKILL.md` (§6 bullet 1, the load-bearing check)

Scratch dir: `<scratchpad>/review-manifest-probe`, `AIDAKIT_PROJECT_ROOT` pointed at it. Manifest snippet run with the roles array trimmed to 2 for the probe (`adr-reviewer`, `spec-reviewer`); the ESM-from-Bash form, the `$AIDAKIT_GOVERNANCE/ledgers/ledger.js` import, and the `recordBench` field shape are copied verbatim, unchanged, from the shipped `skills/review/SKILL.md`.

**Positive case — round 1, change-id `probe-1`:**
```
{"at":"2026-07-25T01:16:05.957Z","type":"bench-manifest","role":"__manifest__","bench":"review","round":1,"roles":["adr-reviewer","spec-reviewer"]}
{"at":"2026-07-25T01:16:09.129Z","type":"bench","bench":"review","round":1,"role":"adr-reviewer","agent":"aidakit:adr-reviewer","verdict_raw":"Status: APPROVED","verdict":"pass","dispatched_at":"2026-07-25T01:16:06.985Z","returned_at":"2026-07-25T01:16:09.043Z"}
{"at":"2026-07-25T01:16:09.151Z","type":"bench","bench":"review","round":1,"role":"spec-reviewer","agent":"aidakit:spec-reviewer","verdict_raw":"Status: APPROVED","verdict":"pass","dispatched_at":"2026-07-25T01:16:08.009Z","returned_at":"2026-07-25T01:16:09.093Z"}
```
`node governance/validators/check-bench.js <scratch>/.aidakit/tasks/probe-1/bench.ndjson --bench review --outcome consensus` → **exit 0**:
```
{"validator":"aidakit.check-bench","ok":true,"bench":"review","round":1,"roles_expected":["adr-reviewer","spec-reviewer"],"roles_reported":["adr-reviewer","spec-reviewer"],"mechanical_consensus":"pass","errors":[]}
```

**Negative case (§6 bullet 2) — `dispatched_at` fabricated to predate the manifest write, change-id `probe-2`:**
```
{"at":"2026-07-25T01:16:22.479Z","type":"bench-manifest","role":"__manifest__","bench":"review","round":1,"roles":["adr-reviewer","spec-reviewer"]}
{"at":"2026-07-25T01:16:22.502Z","type":"bench","bench":"review","round":1,"role":"adr-reviewer","agent":"aidakit:adr-reviewer","verdict_raw":"Status: APPROVED","verdict":"pass","dispatched_at":"2020-01-01T00:00:00.000Z","returned_at":"2020-01-01T00:00:01.000Z"}
{"at":"2026-07-25T01:16:22.523Z","type":"bench","bench":"review","round":1,"role":"spec-reviewer","agent":"aidakit:spec-reviewer","verdict_raw":"Status: APPROVED","verdict":"pass","dispatched_at":"2020-01-01T00:00:00.000Z","returned_at":"2020-01-01T00:00:01.000Z"}
```
`node governance/validators/check-bench.js <scratch>/.aidakit/tasks/probe-2/bench.ndjson --bench review --outcome consensus` → **exit 1**:
```
{"validator":"aidakit.check-bench","ok":false,"bench":"review","round":1,"roles_expected":["adr-reviewer","spec-reviewer"],"roles_reported":["adr-reviewer","spec-reviewer"],"mechanical_consensus":"pass","errors":[{"rule":"manifest-not-first","message":"bench \"review\" round 1: role \"adr-reviewer\" was dispatched before the __manifest__ record was written — the manifest must be committed BEFORE any dispatch"}]}
```
Confirms the invariant the doc claims (§4 of the skill's step-5 block) is exactly the one `check-bench.js` enforces. Scratch dir deleted per §7.

### Post-edit link/version/roadmap validation (§6)

`node governance/validators/check-links.js .` → **exit 0**, `{"ok":true,"files_checked":241,"errors":[]}`.

This bullet read "exit 1, still 13 broken links, byte-identical to the §1 baseline" for most of this change's life, and that was accurate at the time: the branch was cut from `ab037b7`, where 13 links into archived feature dirs were broken repo-wide. Rebasing onto `origin/main` pulled [ADR-014](../../decisions/ADR-014-archive-aware-link-resolution.md) (archive-aware link resolution, PR #46), which resolves all 13. The baseline is now zero, so the criterion at [proposal.md](proposal.md) § Exit criteria was tightened back from the "no NEW break" hedge to a flat **exit 0** — and this run satisfies the strict form, not the hedged one.

`node governance/validators/check-links.js docs/features/review-usage-bench-manifest` → **exit 0**:
```
{"validator":"aidakit.check-links","ok":true,"files_checked":5,"errors":[]}
```

`node governance/validators/derive-roadmap-status.js --root .` → **exit 0**. Confirmed derivations: `review-usage-bench-manifest` → `in-progress`; `review-bench-manifest-mechanical-writer` → `backlog` (both under `Endurecimento da disciplina do próprio kit`).

`node governance/validators/check-plugin-version.js .` → **exit 0**:
```
{"validator":"aidakit.check-plugin-version","ok":true,"manifest":"0.9.1","highest":"0.9","behind":[],"scanned":309}
```
`.claude-plugin/plugin.json` bumped `0.9.0` → `0.9.1` (patch, doc-only, strictly above the live `main` value re-read at §1).

`git diff HEAD --stat` (mechanical proof of `no-mechanical-write-this-change`), re-captured after the round-3 fixes:
```
 .claude-plugin/plugin.json                         |   2 +-
 commands/review.md                                 |   3 +
 .../review-usage-bench-manifest/.context-pack.md   |  85 +++++++++++
 .../review-usage-bench-manifest/evidence.md        | 166 ++++++++++++++++++---
 .../review-usage-bench-manifest/proposal.md        |   4 +-
 .../review-usage-bench-manifest/retry-history.json |  22 +++
 docs/features/review-usage-bench-manifest/tasks.md |  69 ++++-----
 docs/roadmap/ROADMAP.md                            |   1 +
 .../roadmap/epics/EPIC-kit-discipline-hardening.md |   6 +-
 skills/review/SKILL.md                             |  51 ++++++-
 10 files changed, 352 insertions(+), 57 deletions(-)
```
Zero paths under `governance/`, zero under `docs/decisions/` — confirmed by grep on both `git diff HEAD --stat` and `git status --porcelain`. (This block goes stale on every edit; re-capture it at ship time as the final proof.)

`grep -rn "recordBenchManifest" commands/ skills/` → `commands/review.md` ×1 (prose mention, no fenced snippet), `skills/review/SKILL.md` ×3 (lines 62, 85, 86 — the forward pointer + the fenced snippet), `skills/implement/SKILL.md` ×1 (pre-existing, untouched, out-of-scope analogous mechanism — not part of this diff). Single-source confirmed for the review surface.

### Governance suite (§6, regression floor)

`for f in governance/__tests__/*.test.mjs; do node "$f"; done` — **21 suites, all green, 0 failed**, `check-bench.test.mjs` (20/0) and `context-pack.test.mjs` (155/0) included, measured at the shipped base `ec2ce7e`. (`context-pack.test.mjs` was 142/0 at `c2dbfbf`; PR #47 added 13 cases after it.)

An earlier run of this same command recorded 20/21 with 12 failures in `context-pack.test.mjs`. That was a **stale-base artifact, not a real deviation** — see `## Unresolved Deviations` §1 for the root cause and the corrected verification method. The `git stash` check used at the time was inconclusive (it leaves untracked files in place and still carried this change's committed plan package), which is why the wrong conclusion survived one round.

## Files Touched

Final list, `git diff --stat` at implementation end (see above), all modified (no file created except this change package's own artifacts, which pre-existed as stubs):

- `commands/review.md` (modified) — manifest requirement + consequence + link inserted in `## Usage`, doctrine footer appended.
- `skills/review/SKILL.md` (modified) — forward pointer appended to the line-62 paragraph; the copy-paste dispatch shape block inserted at the end of step 5; doctrine footer appended.
- `docs/roadmap/epics/EPIC-kit-discipline-hardening.md` (modified) — new `review-bench-manifest-mechanical-writer` debit bullet inserted after `review-usage-bench-manifest`; the latter's stale `Pino:`/`Preferencial:` trailing clause reconciled (the `Aceite:` declaration itself left byte-identical).
- `docs/roadmap/ROADMAP.md` (**hand-assembled from the tree's own committed file + one inserted line, then verified derivable** — stated plainly rather than as "regenerated", because that word was doing work it hadn't earned). The base is the file already committed at the branch's rebase base; the single insertion is `review-bench-manifest-mechanical-writer` → backlog, in the kit-discipline subsection of `## Later`. `git diff origin/main -- docs/roadmap/ROADMAP.md` → **1 insertion, nothing else**.

  Verified derivable from *this* tree, which is the property ADR-002 actually cares about: every `` `id` → status `` line in the file appears in `derive-roadmap-status.js --root .`, and every change the deriver returns appears in the file — **0 orphans, 0 missing**. `git merge-tree origin/main HEAD` is conflict-free.

  Two failed attempts preceded this, both caught by the bench and both worth recording. (1) A regen that predated the rebase would have **demoted** `step-summaries-type-gate-tests` and `brainstorm-schema-path-literal-lock` back to backlog on merge. (2) The fix for that copied `origin/main`'s file while the branch sat on an older base, importing `check-links-code-span-skip` — an entry whose epic declaration did not exist in this tree, making the artifact unreproducible from its own source and conflicting on merge. Rebasing onto the current `origin/main` is what actually resolved it. This is ADR-002/ADR-007's cross-branch race in practice: a generated snapshot of a moving substrate is only honest if it is regenerated against the substrate it ships with.
- `.claude-plugin/plugin.json` (modified) — `version` `0.9.0` → `0.9.1`.
- `docs/features/review-usage-bench-manifest/proposal.md` (modified) — the Exit criteria link-check bullet now demands a flat **exit 0**, citing ADR-014. It briefly carried a "no NEW break vs. baseline" hedge, correct while the baseline was 13 broken links and obsolete once the rebase pulled #46.
- `docs/features/review-usage-bench-manifest/tasks.md` (modified) — all checklist bullets marked `[x]`.
- `docs/features/review-usage-bench-manifest/evidence.md` (this file, modified) — filled with real command output throughout implementation.
- `docs/features/review-usage-bench-manifest/.context-pack.md` (**added**, was left untracked) — the ADR-013 first-class per-change artifact. Raised by the round-2 bench: `git check-ignore` confirms it is not ignored, and every other change commits it (`docs/archive/2026-07-24-context-pack-l1/.context-pack.md`). Left untracked it would be invisible to reviewers and to the DOCS.md §4 archive move.

- `docs/features/review-usage-bench-manifest/retry-history.json` (**added**, was left untracked) — written by `governance/validators/append-retry-history.js` each time `bench_outcome` routed back to `implement`. Four `bench-veto` entries, one per rejected review round. Not gitignored, and the sibling change `plan-gate-executor-internals-check` commits its own, so leaving it untracked would keep it out of the [DOCS.md](../../../DOCS.md) §4 archive move. Same artifact-accounting class the round-2 bench caught on `.context-pack.md`.

No file under `governance/` and no file under `docs/decisions/` touched — confirmed mechanically above (`no-mechanical-write-this-change`).

## Review-bench rounds (the change reviewed by the mechanism it documents)

**Round 1 — spoiled by the orchestrator, not by the diff.** A 4-role manifest was written, then only `adr-reviewer` was dispatched: a sequential dispatch wearing a bench's clothes, the exact failure this change exists to prevent. No role records were written; the orphan round-1 manifest is inert because `check-bench.js` defaults to the highest round. Recorded here rather than quietly discarded — it is the change's own thesis demonstrated against its author.

**Round 2 — 4/4 roles, genuinely parallel, mechanical consensus `fail`.** `check-bench.js … --outcome rejected` → exit 0 ("dispatch genuinely parallel. Gate cleared"). Verdicts: `spec-reviewer` APPROVED, `tester` Coverage PASS, `adr-reviewer` NEEDS-REVISION, `reviewer-quality` rejected. Two findings were load-bearing and **both were regressions introduced by the round-1 fixes, not by the original implementation**:

- **`roles: [/* comment */]` is a valid empty array.** The round-1 fix replaced a hardcoded six-role list with a comment placeholder to stop callers over-dispatching. But `check-bench.js` only verifies `expected ⊆ reported`, so an empty manifest clears the leash vacuously — every heuristic role can be dropped and nothing notices. The round-1 version failed *loud* on a verbatim paste (`role-missing`); the fix made it fail *silent*. Inverting the anti-tamper property is strictly worse than the problem it fixed.
- **Unfilled `'<ISO — …>'` timestamps clear the parallelism gate.** `Date.parse` yields `NaN`, the overlap check drops unparseable windows, and with fewer than two left it reports "not checked" and passes. A paste that never substituted the timestamps gets "Gate cleared" for a bench never proven parallel.

**Fix applied to both — make every placeholder non-executable.** All `<…>` tokens in both snippets are now unquoted, so an unsubstituted paste dies with a `SyntaxError` before writing anything. Verified:

```
A) unsubstituted paste          exit=1   ndjson_created=no
B) substituted manifest         exit=0
C) substituted happy path       exit=0   (check-bench --outcome consensus)
```

Also fixed from round 2: the "three invariants" heading now says these are the three *most commonly tripped*, naming `role-duplicate`, `consensus-mismatch` and the window-overlap check as the others (`check-bench.js` enforces seven rules, not three); `round: 1` became `<N — …>`; the epic's overwritten `Pino:` gained an explicit `Desvio registrado` line instead of silently replacing a commitment the delivery did not meet.

**Carried to the debit, not fixed here:** `governance/__tests__/check-bench.test.mjs` has no regression case for `manifest-duplicate` — one of the three rules this doc now cites by name. The rule fires correctly today (reproduced live), but its truth is unpinned. Added to `review-bench-manifest-mechanical-writer`'s acceptance in the epic; fixing it here would breach `no-mechanical-write-this-change`.

## Unresolved Deviations

1. ~~**`governance/__tests__/context-pack.test.mjs` has 12 pre-existing failures**~~ — **RESOLVED, not a deviation.** The 12 failures (`§dogfood-regression-code-map-pointers` ×10, `§dogfood-regression-adrs` ×2) were real but were an artifact of a **stale base**, not of this change and not an untracked debt. The branch was cut from `ab037b7`; `main` had since advanced to `c2dbfbf` — *"test(context-pack): make the dogfood block archive-proof (#42)"* — which fixes exactly these cases. The original `git stash` check was inconclusive: `git stash` without `-u` leaves untracked files in place, and the comparison tree still carried this change's committed plan package, so it could only ever show "unchanged", never "pre-existing on `main`". Verified properly by running the suite in a **clean detached worktree at `main`**: `142 passed, 0 failed`. The branch was then rebased onto `c2dbfbf` (unpushed, single plan commit, no conflicts — this change touches no file that #42 touches). Post-rebase the full floor is green: all 21 suites in `governance/__tests__/*.test.mjs` report `0 failed`, `context-pack.test.mjs` included. No debit to file.
2. **`plugin.json` version bump chosen as `0.9.1`** (patch), per the design's own recommendation — not a deviation from the plan, noted here for completeness since the plan only fixed the number as "≥ live value, e.g. 0.9.1" rather than mandating it exactly.

No other divergence from [design.md](design.md) §3-§6: no anchor drift (§1), no wording tightened away from the design's literal text beyond normal prose copy, no scope changes.

## Context-pack telemetry rollup

No telemetry captured for this run.
