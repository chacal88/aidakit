# Evidence — plan-gate-executor-internals-check

**Change ID:** `plan-gate-executor-internals-check`
**Date:** `2026-07-25`
**Owner:** `@chacal88`
**Phase / Package:** `skills/readiness — the plan gate verifies internals claims against live code`

> **Pre-execution stub.** Every section below is filled during implementation with the **real** command and its **real** output — never a paraphrase, never a prediction. A criterion without a runnable proof line stays `pending`.

> **Reading note, added 2026-07-25 (§Round 5 — owner ruling: change split).** This change went through 4 implementation/bench rounds before the owner split it: `governance/validators/check-design-claims.js` and its test are **removed** from this change entirely — see [design.md](design.md) §Mechanical check: split out and [ADR-015](../../decisions/ADR-015-readiness-owns-internals-claims-gate.md) §Decision 2. Everything in this file dated Round 1 through Round 4 that documents that validator, its tests, and the two criteria it satisfied (`mechanical-validator-scoped-as-secondary`, `new-file-citations-excluded`) is a **historical record of work that was ultimately reverted** — real at the time, useful for the successor change, but **not** evidence for what this change finally ships. Jump to §Round 5 at the bottom for the final, accurate state.

## Setup / grounding re-check (Task 1)

Re-verified every shape in [design.md](design.md) §Grounding against live code before writing anything. **No divergence found; no correction needed.**

- `check-acceptance.js` argv/envelope/exit shape — confirmed: `process.argv.slice(2)` + `--json` flag at :50-52, envelope `{validator, ok, change_id, level, required, resolved, parsed_criteria, errors}` at :142-150, `process.exit(errors.length === 0 ? 0 : 1)` at :162, asymmetric exit-2 paths at :53/:74-88.
- `check-adr-format.js` target-list shape — confirmed at :75-92 (`argv.filter`, `collectAdrs`, envelope `{validator, ok, adrs_checked, errors}`).
- `check-links.js` `LINK_RE` + fenced-skip — confirmed: `LINK_RE = /\[[^\]]*\]\(([^)]+)\)/g` at :23, fenced toggle + per-line scan at :55-79 (`fenced = !fenced` on a line starting with `` ``` ``).
- `skills/readiness/SKILL.md` section boundaries — confirmed: `### 4. Review the design` at line 165, `### 13. Answer the mandatory review questions` at line 296, `### Severity classification` at line 311, `## 14. Mandatory review questions` (output template) at line 407.
- `agent-validator-paths.test.mjs` — confirmed: `SOURCE_FILES` array at lines 47-53 (5 entries, `skills/readiness/SKILL.md` not yet present), §3 sweep regex + exclusions (`skills/catalog/INDEX.md`, `skills/review/SKILL.md`) at lines 90-99.
- `governance/engine/project-root.js` present with `findProjectRoot`/`resolveProjectRoot` exports, matching the import design.md prescribes.
- 21 `.test.mjs` files under `governance/__tests__/` on disk today (→ 22 after this change adds one — confirmed at implementation end, see §Validation Outputs).
- `docs/OVERVIEW.md` validator table: `check-doc-manifest` at line 121, `check-adr-format` 122, `check-links` 123 — new row goes after 123, confirmed.
- The `13-step` grep (`grep -rn "13-step\|13 steps\|13 planning" --include="*.md" .`, excluding `docs/archive/` and this change package) returns exactly the 8 edit sites in 5 files design.md/tasks.md enumerate: `PROCESS.md:73,100,182`, `docs/guides/existing-repo-flow.md:119`, `docs/guides/change-flow.md:112`, `docs/reference/skills.md:16,60`, `skills/catalog/INDEX.md:27`.
- `docs/roadmap/epics/EPIC-kit-discipline-hardening.md` line 13 still names the ghost `skills/planner/SKILL.md` in its `Aceite:` bullet — confirmed present, corrected in Task 7.
- `docs/decisions/ADR-015-readiness-owns-internals-claims-gate.md` present, 5-section format, registered in `docs/decisions/README.md`'s index table (row `[ADR-015]`) and thematic grouping (`Planning gates & review discipline`) — both already done at plan time.

## Acceptance-criterion → evidence map

| # | Criterion id | Status | Evidence |
|---|---|---|---|
| 1 | `readiness-owns-the-gate` | resolved | §1 below |
| 2 | `mechanical-validator-scoped-as-secondary` | **REMOVED 2026-07-25** | validator split out — see §Round 5 below; §2's evidence is historical only |
| 3 | `not-flow-wired-by-default` | resolved | §3 below (trivially true with no validator — see §Round 5) |
| 4 | `planner-naming-corrected` | resolved | §4 below |
| 5 | `new-file-citations-excluded` | **REMOVED 2026-07-25** | validator split out — see §Round 5 below; §5's evidence is historical only |
| 6 | `precedent-incident-documented` | resolved | §6 below (re-derived for `design.md`, the validator header no longer exists — see §Round 5) |

**Final shipped set: 4 criteria** (`readiness-owns-the-gate`, `not-flow-wired-by-default`, `planner-naming-corrected`, `precedent-incident-documented`) — confirmed byte-identical between `proposal.md` and `.aidakit/tasks/plan-gate-executor-internals-check/brainstorm.json` in §Round 5.

### 1. `readiness-owns-the-gate`

`skills/readiness/SKILL.md` now carries `### 14. Verify claims about internals against live code` (line 312), placed after `### 13. Answer the mandatory review questions` (line 297) and before `### Severity classification` (line 337). Body covers the three claim shapes (line-anchored / unanchored / generalization), the `Critical`/`Mandatory before implementation` rule for generalizations that fail even one member of the quantified set, the byte-identical guarded `$AIDAKIT_GOVERNANCE` invocation, and the `Read`/`Grep` fallback for a `Bash`-less session. One cross-reference bullet was added to `### 4. Review the design`'s checklist.

Proof — test §C20 (10 assertions, all green) inside `governance/__tests__/check-design-claims.test.mjs`:
```
$ node governance/__tests__/check-design-claims.test.mjs
76 passed, 0 failed
```
Proof — `agent-validator-paths.test.mjs` (byte-identity of the new call site's guard against the canonical `GUARD` literal, `SOURCE_FILES` now includes `skills/readiness/SKILL.md`):
```
$ node governance/__tests__/agent-validator-paths.test.mjs
33 passed, 0 failed
```

### 2. `mechanical-validator-scoped-as-secondary`

`governance/validators/check-design-claims.js` exists (257 lines), pure Node/zero-dep ESM, implementing the full §Surface 2 contract: argv/`--json`/exit 0-1-2, directory-vs-file targets, fenced-block skip, the three citation forms (linked / bare-root-relative / bare-basename), the two failure rules (`citation-file-missing`, `citation-line-out-of-range`), the `## New files` waiver with `tasks.md` corroboration, the `docs/archive/` carve-out, and the JSON envelope. Tests §C1-§C19 (61 assertions) all green; §C20-§C22 (15 more) also green — 76 total in the file.

Sample envelope, passing run (dogfood on this package):
```
$ node governance/validators/check-design-claims.js docs/features/plan-gate-executor-internals-check
{"validator":"aidakit.check-design-claims","ok":true,"files_checked":2,"citations_checked":85,"waived_new_files":0,"skipped":[...12 citation-unresolvable entries for basename-only citations like "cli.js:121"...],"errors":[]}
exit=0
```
Sample envelope, failing run (negative dogfood, §Validation Outputs below) demonstrates `citation-file-missing`; test §C5/§C6/§C18 demonstrate `citation-line-out-of-range`; exit 2 demonstrated by §C1 (no args) and §C2 (nonexistent target).

### 3. `not-flow-wired-by-default`

```
$ git diff --stat governance/flows/full.yaml governance/flows/fast.yaml
(empty output)
```
Test §C21 (2 assertions, green): neither `governance/flows/full.yaml` nor `governance/flows/fast.yaml` contains the string `check-design-claims`. The validator is invoked only from `skills/readiness/SKILL.md`'s Process §14 via `Bash`.

**Scope note (unchanged from plan time):** this criterion covers the flow-wiring half only. The original "and no new ADR" clause was struck on 2026-07-25 by owner ruling — `agents/doc-planner.md:47` makes an ADR mandatory for an `architecture`-flagged change, so the clause was mechanically unsatisfiable against the doc-leash. The ADR is [ADR-015](../../decisions/ADR-015-readiness-owns-internals-claims-gate.md) and it **records** the standalone wiring rather than reversing it.

### 4. `planner-naming-corrected`

`docs/roadmap/epics/EPIC-kit-discipline-hardening.md` line 13's `Aceite:` sub-bullet no longer names `skills/planner/SKILL.md`; it now reads `skills/readiness/SKILL.md` (decidido em `plan-gate-executor-internals-check`, ver ADR-015).

```
$ grep -rn "skills/planner/SKILL.md" docs/roadmap skills governance agents commands
(no output, exit 1 = no match)
$ grep -rnE "\]\([^)]*skills/planner/SKILL\.md" . --exclude-dir=node_modules --exclude-dir=.git
(no output, exit 1 = no match)
```
Test §C22 (3 assertions, green): the literal ghost path occurs nowhere under `docs/roadmap/|skills/|governance/|agents/|commands/`; no markdown link targets it; the epic's feature bullet contains `skills/readiness/SKILL.md`. (This change's own package prose — `design.md`, `proposal.md`, `classification.json` — legitimately still names the ghost string to declare it absent; those live under `docs/features/`, outside the swept dirs, per the criterion's own scoping note.)

### 5. `new-file-citations-excluded`

Test §C10 (the criterion's proof, 4 assertions, green): a fixture `design.md` cites an absent path declared under a live `## New files (created by this change)` heading, corroborated by the literal path string in the sibling `tasks.md` → exit 0, `waived_new_files: 1`, `errors: []`, one `skipped[]` entry `rule: "new-file-waived"`.

§C11 (path missing from `tasks.md` → waiver withheld, exit 1), §C12 (no `tasks.md` at all → waiver withheld, exit 1), §C10b (the waiver-declaring heading sits inside a fenced ` ```md ` block → does **not** count, exit 1, `waived_new_files: 0`), §C13 (a declared new-file path that **does** exist on disk is checked normally — the waiver never masks a real file's rotten line anchor, exit 1 `citation-line-out-of-range`) — all green.

### 6. `precedent-incident-documented`

Shipped header comment of `governance/validators/check-design-claims.js` (verbatim, first 28 lines):
```
#!/usr/bin/env node
// check-design-claims — CITATION-STALENESS check for a change package. SECONDARY
// by decision: it greps every `<file>.<ext>:<NN>` / `:<NN>-<NN>` citation in the
// change's design.md/proposal.md and fails only when the anchor no longer
// resolves (file gone, or cited line past the file's current line count).
//
// IT IS NOT A TRUTH-CHECKER. It cannot tell whether a sentence about engine
// internals is correct, and it never tries.
//
// WHY SECONDARY (the incident that motivated this validator): in
// `flow-step-summaries`, the design claimed `context[step.id].outcome` is
// "populated by every pause-emitting executor"
// (docs/archive/2026-07-24-flow-step-summaries/design.md:92, originating at
// that change's proposal.md:21). It is false — only invoke.js writes .outcome;
// human-gate.js writes .choice, human-handoff.js writes .response. The claim
// carried NO anchor, and the implementer re-verified every OTHER anchor in that
// design at setup with no correction needed
// (…/flow-step-summaries/evidence.md:8-18). THIS VALIDATOR WOULD HAVE RETURNED
// PASS at the exact moment the bug was written. The gate that catches that class
// is the semantic step 14 of skills/readiness/SKILL.md — re-derive the claim,
// enumerate what a generalization quantifies over. Do not re-invent "just grep
// the anchors" as if it sufficed.
//
// Pure Node, zero-dep. Contract: exit 0 pass · 1 findings · 2 usage/error.
```
Test §C19 (5 assertions, green): the first 40 lines contain, case-insensitively, `not a truth-checker`, `citation-staleness`, `design.md:92`, `proposal.md:21`, `evidence.md:8-18`. `design.md` §"The incident, stated plainly" carries the same three anchors, re-confirmed at implementation time (unchanged from setup).

## Validation Outputs

- `node governance/__tests__/check-design-claims.test.mjs` → `76 passed, 0 failed`, exit 0.
- `node governance/__tests__/agent-validator-paths.test.mjs` → `33 passed, 0 failed`, exit 0.
- Full suite: `for t in governance/__tests__/*.test.mjs; do node "$t" || echo "FAIL $t"; done` → **22 files** on disk (confirmed via `ls governance/__tests__/*.test.mjs | wc -l`). Per-file counts:

  | file | result |
  |---|---|
  | agent-validator-paths.test.mjs | 33 passed, 0 failed |
  | brainstorm-schema.test.mjs | 34 passed, 0 failed |
  | candidates.test.mjs | 8 passed, 0 failed |
  | check-acceptance.test.mjs | 31 passed, 0 failed |
  | check-adr-format.test.mjs | 8 passed, 0 failed |
  | check-bench.test.mjs | 20 passed, 0 failed |
  | check-design-claims.test.mjs | 76 passed, 0 failed |
  | check-docs.test.mjs | 8 passed, 0 failed |
  | check-links.test.mjs | 7 passed, 0 failed |
  | **context-pack.test.mjs** | **129 passed, 12 failed (exit 1) — pre-existing, see §Unresolved Deviations** |
  | dna-freshness.test.mjs | 7 passed, 0 failed |
  | dna-write.test.mjs | 14 passed, 0 failed |
  | engine.test.mjs | 264 passed, 0 failed |
  | ledger.test.mjs | 8 passed, 0 failed |
  | plugin-version.test.mjs | 12 passed, 0 failed |
  | pr-automation.test.mjs | 161 passed, 0 failed |
  | prelude.test.mjs | 13 passed, 0 failed |
  | progress-table.test.mjs | 30 passed, 0 failed |
  | retry-memory.test.mjs | 87 passed, 0 failed |
  | roadmap.test.mjs | 28 passed, 0 failed |
  | step-summaries.test.mjs | 95 passed, 0 failed |
  | yaml-min.test.mjs | 17 passed, 0 failed |

  Every file this change touches or created is green. `context-pack.test.mjs`'s 12 failures are a pre-existing defect (a `check-doc-manifest`/`check-links`-style dogfood-regression fixture drifted from the live `agents/`/`skills/` file set) — see §Unresolved Deviations for the `git stash` proof that it is identical on the pre-change tree.

- Dogfood: `node governance/validators/check-design-claims.js docs/features/plan-gate-executor-internals-check` → `{"validator":"aidakit.check-design-claims","ok":true,"files_checked":2,"citations_checked":85,"waived_new_files":0,"skipped":[12 citation-unresolvable entries],"errors":[]}`, exit 0.
- Negative dogfood: appended a citation to a scratch copy `docs/features/plan-gate-executor-internals-check/design.scratch-negative-dogfood.md` (same directory, so every real citation still resolved relative to the real repo). The appended line is quoted below inside a fence — deliberately not rendered as a live markdown link anywhere in this prose, since a real link to this on-purpose-nonexistent path would itself be a broken internal link and trip `check-links.js`:
  ```
  Scratch rotten anchor for negative dogfood: [governance/this-file-does-not-exist-anywhere.js:5](../../../governance/this-file-does-not-exist-anywhere.js)
  ```
  →
  ```
  {"validator":"aidakit.check-design-claims","ok":false,"files_checked":1,"citations_checked":65,"waived_new_files":0,"skipped":[...],
   "errors":[{"file":".../design.scratch-negative-dogfood.md","line":266,"citation":"governance/this-file-does-not-exist-anywhere.js:5",
   "rule":"citation-file-missing","path":"governance/this-file-does-not-exist-anywhere.js","message":"cited file does not exist: governance/this-file-does-not-exist-anywhere.js"}]}
  ```
  exit 1, exactly one error, rule `citation-file-missing`. The scratch file was then deleted (`rm docs/features/plan-gate-executor-internals-check/design.scratch-negative-dogfood.md`); confirmed absent from `git status --short`.
- `check-links.js` over the change's touched-file set:
  ```
  $ node governance/validators/check-links.js docs/features/plan-gate-executor-internals-check docs/decisions/ADR-015-readiness-owns-internals-claims-gate.md docs/decisions/README.md skills/readiness/SKILL.md governance/__tests__/agent-validator-paths.test.mjs docs/roadmap/epics/EPIC-kit-discipline-hardening.md docs/OVERVIEW.md PROCESS.md docs/guides/existing-repo-flow.md docs/guides/change-flow.md docs/reference/skills.md skills/catalog/INDEX.md
  {"validator":"aidakit.check-links","ok":true,"files_checked":15,"errors":[]}
  ```
  exit 0. (Repo-wide `check-links.js .` is NOT the bar — 13 pre-existing broken links in 8 unrelated files, out of scope, per [proposal.md](proposal.md) §Exit criteria.)
- `node governance/validators/check-plugin-version.js` → `{"validator":"aidakit.check-plugin-version","ok":true,"manifest":"0.9.0","highest":"0.8","behind":[],"scanned":299}`, exit 0.
- `node governance/validators/check-adr-format.js docs/decisions` → `{"validator":"aidakit.check-adr-format","ok":true,"adrs_checked":14,"errors":[]}`, exit 0. **Count as of that round.** It became 15 after `origin/main` landed its own ADR-014 (`archive-aware-link-resolution`) and this change renumbered to ADR-015.
- `git diff --stat governance/flows/full.yaml governance/flows/fast.yaml` → empty output.
- `grep -rn "skills/planner/SKILL.md" docs/roadmap skills governance agents commands` → no hits (exit 1). `grep -rnE "\]\([^)]*skills/planner/SKILL\.md" . --exclude-dir=node_modules --exclude-dir=.git` → no hits (exit 1).

## Files Touched

Matches [tasks.md](tasks.md) §9's expected diff surface exactly (`git status --short` at implementation end):

**Created:**

- `governance/validators/check-design-claims.js` — 257 lines, the secondary anchor-staleness validator.
- `governance/__tests__/check-design-claims.test.mjs` — table test, 76 assertions (§C1-§C22).
- `docs/decisions/ADR-015-readiness-owns-internals-claims-gate.md` — done at plan time (authored in this package per the ADR-008 precedent); `check-adr-format` → `{"ok":true,"adrs_checked":1}`, exit 0; `check-links` → `{"ok":true,"files_checked":1,"errors":[]}`, exit 0. Re-confirmed unchanged at implementation time.

**Edited:**

- `docs/decisions/README.md` — done at plan time: ADR-015 row in the index table and the `Planning gates & review discipline` thematic bullet. Confirmed unchanged, `check-links` clean.
- `skills/readiness/SKILL.md` — Process `### 14. Verify claims about internals against live code` inserted (line 312), plus one cross-reference bullet in `### 4. Review the design`. Output template (lines 363→384+, unrenumbered) and verbatim-verdict lines unchanged.
- `governance/__tests__/agent-validator-paths.test.mjs` — `skills/readiness/SKILL.md` added to `SOURCE_FILES`.
- `docs/roadmap/epics/EPIC-kit-discipline-hardening.md` — line 13's ghost path corrected.
- `docs/OVERVIEW.md` — `check-design-claims` row added to the §5 validator table, after `check-links`.
- `PROCESS.md`, `docs/guides/existing-repo-flow.md`, `docs/guides/change-flow.md`, `docs/reference/skills.md`, `skills/catalog/INDEX.md` — the `13` → `14` sweep, 8 sites total (`PROCESS.md` ×3, the two guides ×1 each, `skills.md` ×2, `catalog/INDEX.md` ×1).

No file outside this list was touched. `docs/features/plan-gate-executor-internals-check/.context-pack.md` is a pre-existing untracked artifact from the flow's `context_pack` phase, not authored in this implementation session.

## Round 2 — adversarial bench fixes (post-delivery)

The round-1 delivery was rejected by the review bench: `quality` and `tests` both failed; `adr`, `specs`, `security`, `architecture` approved. Both blocking findings and both minors are fixed below, each with RED→GREEN evidence. TDD held throughout — every behavioral fix got a failing test first.

### BLOCKING 1 — external URLs resolved as filesystem paths (`quality`)

**Root cause:** `citationsIn()` never excluded `https?:`/`mailto:` hrefs (the linked form) or masked raw URLs before the bare-citation regex ran (the prose form) — unlike `check-links.js:69`, which this validator was modeled on but dropped the guard for.

**RED** — added §C24 (linked form, external href) and §C25 (bare URL in prose), both against the pre-fix validator:
```
$ node governance/__tests__/check-design-claims.test.mjs
FAIL C24: an external-URL linked citation never fails the run (got exit 1)
FAIL C24: the external URL is not counted as a checked citation (got 1)
FAIL C24: errors === [] (got [{"...":"...","citation":"the external doc.js:12","rule":"citation-file-missing","path":"c24/https:/example.com/some/page",...}])
FAIL C25: a bare URL never fails the run (got exit 1)
FAIL C25: the URL tail is not counted as a checked citation (got 1)
FAIL C25: errors === [] (got [{"...":"citation":"example.com/docs/file.md:12","rule":"citation-file-missing",...}])

78 passed, 6 failed
```

**Fix** (`governance/validators/check-design-claims.js`): added `isExternalHref(href)` — `/^(https?:|mailto:)/`, mirroring `check-links.js:69` — gating the linked form; added `URL_RE` (`/\b(?:https?:\/\/|mailto:)\S+/g`) masking raw URLs out of the line before the bare-citation regex runs, alongside the existing real-link masking.

**GREEN:**
```
$ node governance/__tests__/check-design-claims.test.mjs
99 passed, 0 failed
```

**Exact repro from the finding, re-run against the fix:**
```
$ node governance/validators/check-design-claims.js <fixture-dir>   # design.md: the two lines from the finding
{"validator":"aidakit.check-design-claims","ok":true,"files_checked":1,"citations_checked":0,"waived_new_files":0,"skipped":[],"errors":[]}
exit=0
```

### BLOCKING 2 — the `docs/archive` carve-out was not locked (`tests`)

Two surviving mutations, both now locked with a dedicated test, each confirmed to actually kill the mutation (not just added and assumed).

**Mutation A — `isArchived` widened to `parts.includes("archive")`.** Added §C15b: a `vendor/archive/design.md` fixture with a rotten citation must still be scanned (exit 1), proving the `docs/` prefix is load-bearing, not just any `archive` segment.

Mutation applied to `check-design-claims.js` (`isArchived` body → `return parts.includes("archive");`):
```
$ node governance/__tests__/check-design-claims.test.mjs
FAIL C15b: a design.md under vendor/archive/ (no docs/ prefix) IS scanned, exits 1 (got 0)
FAIL C15b: rule is citation-file-missing
FAIL C15b: no archived-source skip — the carve-out did not fire

96 passed, 3 failed
```
File restored from a pre-mutation backup and confirmed byte-identical (`diff` exit 0) before re-running the full suite green.

**Mutation B — the target loop narrowed to `resolvedTargets.slice(0, 1)`.** Added §C23: two directory targets in one invocation, rotten citation only in the second — asserts `code===1`, `files_checked===2`, the error's `file` is under the second target.

Mutation applied (`for (const { changeDir, sources } of resolvedTargets)` → `... of resolvedTargets.slice(0, 1))`):
```
$ node governance/__tests__/check-design-claims.test.mjs
FAIL C23: a rotten citation in the SECOND target still fails the run (got exit 0)
FAIL C23: files_checked reflects both targets' design.md (got 1)
FAIL C23: exactly one error, from the second target (got 0)
FAIL C23: the error's file is under the second (multiB) target

95 passed, 4 failed
```
File restored and confirmed byte-identical (`diff` exit 0) before re-running the full suite green.

**Also added (tester severity 4 and 3):**
- §C17b — `--json` on a **failing** run: `stderr === ""`, `code === 1`, envelope well-formed (`ok:false`, one `citation-file-missing` error). §C17 previously only covered the passing branch.
- §C14b — a directory target with a rotten citation in **both** `design.md` and `proposal.md`: `errors.length === 2` with two distinct `file` values, proving errors accumulate across sources rather than the second overwriting the first.

**Suite after all round-2 additions:**
```
$ node governance/__tests__/check-design-claims.test.mjs
99 passed, 0 failed
```
(76 round-1 + 2×4 for §C24/§C25 + 3 for §C15b + 4 for §C23 + 6 for §C17b + 3 for §C14b = 99.)

### MINOR 1 — bypassing the owned `resolveProjectRoot` abstraction (`adr`)

Replaced the hand-rolled `AIDAKIT_PROJECT_ROOT ? resolve(...) : findProjectRoot(...)` in `main()` with `resolveProjectRoot(undefined, dirname(resolve(targets[0])))`, importing `resolveProjectRoot` instead of `findProjectRoot` from `governance/engine/project-root.js` — the single owner of that exact composition (`project-root.js:39-56`). Behaviorally identical; confirmed by the unchanged suite result before/after:
```
$ node governance/__tests__/check-design-claims.test.mjs
76 passed, 0 failed        # before the swap (round-1 baseline)
76 passed, 0 failed        # after the swap, before round-2 test additions
```

### MINOR 2 — "Optional" contradicted ADR-015 (`adr`)

`skills/readiness/SKILL.md`'s Process §14 pre-pass heading retitled from *"Optional mechanical pre-pass — **defence-in-depth, never a substitute**"* to *"Mechanical pre-pass — run it whenever `Bash` is available; defence-in-depth, never a substitute for the semantic pass above"*, per the adr-reviewer's exact wording. Confirmed test §C20 does not assert on the word "Optional" (it checks `MANDATORY`, `generaliz`, `Critical`, `Mandatory before implementation`, `Read`/`Grep`, the call-site string, and placement) — no test update needed, and the suite stayed green through the edit.

### Round 2 — final validation

```
$ node governance/__tests__/check-design-claims.test.mjs
99 passed, 0 failed

$ node governance/__tests__/agent-validator-paths.test.mjs
33 passed, 0 failed

$ for t in governance/__tests__/*.test.mjs; do node "$t" || echo "FAIL $t"; done
FAIL governance/__tests__/context-pack.test.mjs   # pre-existing, see §Unresolved Deviations — unchanged 129/12
# every other of the 22 files green, including check-design-claims.test.mjs at 99/0

$ node governance/validators/check-design-claims.js docs/features/plan-gate-executor-internals-check
{"validator":"aidakit.check-design-claims","ok":true,"files_checked":2,"citations_checked":85,"waived_new_files":0,"skipped":[...12 citation-unresolvable entries, unchanged...],"errors":[]}
exit=0

$ node governance/validators/check-links.js docs/features/plan-gate-executor-internals-check docs/decisions/ADR-015-readiness-owns-internals-claims-gate.md docs/decisions/README.md skills/readiness/SKILL.md governance/__tests__/agent-validator-paths.test.mjs docs/roadmap/epics/EPIC-kit-discipline-hardening.md docs/OVERVIEW.md PROCESS.md docs/guides/existing-repo-flow.md docs/guides/change-flow.md docs/reference/skills.md skills/catalog/INDEX.md
{"validator":"aidakit.check-links","ok":true,"files_checked":15,"errors":[]}
exit=0
```

Files touched in round 2 (beyond round 1's set — no new files, no scope expansion): `governance/validators/check-design-claims.js` (URL guard + `resolveProjectRoot` swap), `governance/__tests__/check-design-claims.test.mjs` (+23 assertions: §C15b, §C17b, §C14b, §C23, §C24, §C25), `skills/readiness/SKILL.md` (one heading re-wording).

## Round 3 — adversarial bench fixes, second pass (post-delivery)

Round 2's delivery was rejected again: `adr` approved, `security` approved, `quality` rejected, `tests` FAIL, `specs` NEEDS-REVISION. Consensus `fail`. The round-2 URL fix traded a false positive for a **false negative** (an unbounded `\S+` mask could swallow a real rotten citation glued to a URL) — the exact failure mode this validator exists to prevent, reopened by its own fix. Fixed properly this round by rethinking the extraction contract rather than patching the next reported string, per the coordinator's explicit direction.

### BLOCKING 1 — `URL_RE`'s `\S+` swallowed a real rotten citation (`specs`, the worst finding)

**Root cause:** `URL_RE = /\b(?:https?:\/\/|mailto:)\S+/g` is unbounded — a URL glued to a following citation with no whitespace (`(see https://x/r.pdf)governance/README.md:99999`) had the entire citation consumed into the URL match and masked away, silently.

**RED** — no test existed for this shape; §C26 (glued + ordinarily-spaced variants) added against the pre-fix validator:
```
$ node governance/__tests__/check-design-claims.test.mjs
FAIL C26a (glued): a rotten citation immediately after a URL is still caught (got exit 0)
FAIL C26a (glued): the glued citation IS counted as checked (got 0)
FAIL C26a (glued): rule is citation-file-missing on the glued citation
99 passed, 3 failed   # (spaced variant §C26b already passed — it was never affected)
```

**Fix:** bounded `URL_RE`'s character class to exclude whitespace and common URL-terminating punctuation (`)]>"'` and backtick) instead of matching `\S+` unboundedly — the mask now stops at a sentence/markup boundary, so a glued citation is never consumed. Also made it case-insensitive and widened the scheme set to `https?://`, `mailto:`, `file://`, and a bare `www.` host (see BLOCKING 2 / IMPORTANT below).

**GREEN:**
```
$ node governance/__tests__/check-design-claims.test.mjs
129 passed, 0 failed
```

**Exact reproductions from the finding, re-run against the fix (both directions hold):**
```
$ node governance/validators/check-design-claims.js <fixture: "(see https://example.com/r.pdf)governance/README.md:99999 needs a look.">
{"ok":false,"citations_checked":1,"errors":[{"rule":"citation-file-missing","citation":"governance/README.md:99999",...}]}   # caught, not silent
exit=1

$ node governance/validators/check-design-claims.js <fixture: "See https://example.com/r.pdf and also governance/README.md:99999 here.">
{"ok":false,"errors":[{"rule":"citation-file-missing",...}]}   # still caught
exit=1
```

### BLOCKING 2 — `isExternalHref` dropped the `#` branch and was case-sensitive (`quality` blocking, `adr` finding 1)

**Root cause:** `isExternalHref` was `/^(https?:|mailto:)/` — missing the `#` branch `check-links.js:69` has (`/^(https?:|mailto:|#)/`), and case-sensitive (missed `HTTPS:`). A pure same-document TOC link with a citation-shaped label (`[doc.js:12](#some-section)`) false-failed as `citation-file-missing`. Separately, a leading-whitespace href (`[doc.js:12]( https://x)`) collapses to an empty string via the existing `hrefRaw.split(/\s+/)[0]` title-split and was then resolved against the change dir, producing an empty-path finding.

**RED** — §C27 (`#`), §C28 (empty href), §C30 (mixed-case) added against the pre-fix validator:
```
$ node governance/__tests__/check-design-claims.test.mjs
FAIL C27: a pure #anchor href never fails the run (got exit 1)
FAIL C28: a whitespace-collapsed empty href never fails the run (got exit 1)
FAIL C30a (linked, uppercase scheme): never fails the run (got exit 1)
FAIL C30b (bare, uppercase scheme): never fails the run (got exit 1)
```

**Fix:** `isExternalHref` rewritten to `/^(https?:|mailto:|file:|#)/i` (adds `#`, `file:`, case-insensitivity) with an explicit `h === ""` check treating an empty/whitespace-only href as "not a repo anchor" before the regex test at all.

**GREEN (exact reproductions from the finding, re-run):**
```
$ node governance/validators/check-design-claims.js <fixture: "[doc.js:12](#some-section)">
{"ok":true,"citations_checked":0,"skipped":[{"rule":"external-reference","citation":"doc.js:12"}],"errors":[]}
exit=0

$ node governance/validators/check-design-claims.js <fixture: "[doc.js:12]( https://x)">
{"ok":true,"citations_checked":0,"skipped":[{"rule":"external-reference","citation":"doc.js:12"}],"errors":[]}
exit=0
```

### IMPORTANT — under-reach the other way (`quality`)

Widened where cheap and safe, documented where not, per the coordinator's explicit either/or:

- `file:` scheme added to both `isExternalHref` (linked form — closes a `file:///etc/passwd` href, §C31) and `URL_RE` (bare form).
- A bare `www.`-prefixed host added to `URL_RE` (closes a `www.`-prefixed citation-shaped token in prose, §C32).
- **Documented, not silently left implicit:** a scheme-less bare host with **no** `www.` prefix (e.g. `example.com/docs/file.md:NN`) and a protocol-relative `//host/path` (explicitly told NOT to fix — mirrors `check-links.js`'s own blind spot) remain unguarded. Recorded in [design.md](design.md) §External-reference exclusion (addendum) as a named, accepted residual, and in [ADR-015](../../decisions/ADR-015-readiness-owns-internals-claims-gate.md) §Consequences.

### Test gaps that let round 2 through (`tests` FAIL, 0 blocking + 4 important) — all closed

- **[6] `mailto:` drop stays green** → §C29 added (dedicated lock). Mutation: `isExternalHref` regex with `mailto:` removed → **RED, 3 failures** (`FAIL C29` ×3) → restored, `diff` confirmed byte-identical → suite green again.
- **[6] `resolveProjectRoot` climb branch untested** (all round-2 assertions pinned `AIDAKIT_PROJECT_ROOT`) → §C35 added: a DIRECTORY target with `.aidakit/` markers at two levels (INNER inside the target, OUTER at its parent), `AIDAKIT_PROJECT_ROOT` **destructured out** of the spawn env (not merely unset), asserting the OUTER marker wins (matching the correct `dirname(resolve(targets[0]))` starting point). Analysis note: a FILE-target version of this mutation is a true equivalent mutant — `findProjectRoot`'s climb self-corrects after one extra no-op iteration when given a file path instead of its dirname, because the very first climb step from a file path always lands on that file's real parent directory. Only a DIRECTORY target makes the mutation observable, which is why §C35 uses one. Mutation: `dirname(resolve(targets[0]))` → `resolve(targets[0])` → **RED, 2 failures** → restored, `diff` confirmed byte-identical → suite green again.
- **[5] `URL_RE` `g`-flag removal / greedy `.+` variant both stay green** → §C33 added: two URLs on one line (each with a citation-shaped tail) plus one real, legitimate bare citation. Mutation A (drop `g` flag): **RED, 3 failures** (second URL's tail leaks through as a false `citation-file-missing`). Mutation B (greedy `.+`): **RED, 6 failures**, including §C26a/§C26b regressing to the original BLOCKING-1 shape (the mask swallows the real citation entirely). Both restored, `diff` confirmed byte-identical → suite green again.
- **[5] Linked-href normalization untested** (fragment/query stripping, markdown-title split) → §C34 added: three hrefs — `#L3` fragment, `?plain=1` query, `"some title"` — all resolving to the same real target. Mutation A (drop `#`/`?` stripping): **RED, 2 failures**. Mutation B (drop title-split): **RED, 2 failures**. Both restored, `diff` confirmed byte-identical → suite green again.

**Suite after all round-3 additions:** `129 passed, 0 failed` (99 round-2 baseline + 4×C26 + 3×C27 + 2×C28 + 2×C29 + 4×C30 + 2×C31 + 3×C32 + 3×C33 + 3×C34 + 2×C35 = 129; §C24 gained 2 assertions replacing its round-2 shape, net accounted for in the totals above).

### Mutation-kill summary (all 5 named by the tester, all confirmed RED then restored)

| # | Mutation | Result before fix / with mutation re-applied | Restored & verified `diff` clean |
|---|---|---|---|
| 1 | Drop `mailto:` from `isExternalHref` | RED — 3 failures (§C29) | yes |
| 2 | `dirname(resolve(targets[0]))` → `resolve(targets[0])` | RED — 2 failures (§C35) | yes |
| 3 | Drop `g` flag from `URL_RE` | RED — 3 failures (§C33) | yes |
| 4 | `URL_RE` tail `[^\s)\]>"'\`]+` → greedy `.+` | RED — 6 failures (§C26a/§C26b/§C33 — reproduces the original defect) | yes |
| 5a | Drop `#`/`?` stripping on the linked href | RED — 2 failures (§C34) | yes |
| 5b | Drop the markdown-title split on the linked href | RED — 2 failures (§C34) | yes |

Every mutation backup was written to the session scratchpad directory (outside the repo), never as an in-repo `.bak` file — `find . -name "*.bak"` confirmed empty before reporting back.

### MINOR — ADR-015 prose drift (`adr`, fixed while status is `proposed`)

- §Decision-2 qualified: "extracts every `<file>.<ext>:<NN>` citation" → "extracts every **repo-anchored** … citation", with the exclusion predicate and its `check-links.js:69` parity spelled out precisely (case-insensitive, `file:` added) instead of the prior unverified claim of exact parity.
- **Implemented, not just "considered":** excluded linked-form hrefs now emit a `skipped[]` entry (`rule: "external-reference"`) — §Decision-2's own promise ("every excluded class visible in `skipped[]`") is now true, closing the second unchecked class the round-2 ADR text didn't acknowledge.
- New §Consequences bullet: root resolution needs `.aidakit/` or `AIDAKIT_PROJECT_ROOT`; without either and outside a marked tree, a bare root-relative citation mis-resolves. Mitigated — every kit flow's working tree carries `.aidakit/` by construction.
- New §Consequences bullet: the residual under-reach (scheme-less bare host, protocol-relative `//host/path`) named explicitly, not linked to the ephemeral `docs/features/<change-id>/design.md` path (WORM discipline — an ADR should not point at a WORKING-life artifact that gets archived and renamed).

```
$ node governance/validators/check-adr-format.js docs/decisions/ADR-015-readiness-owns-internals-claims-gate.md
{"validator":"aidakit.check-adr-format","ok":true,"adrs_checked":1,"errors":[]}
$ node governance/validators/check-links.js docs/decisions/ADR-015-readiness-owns-internals-claims-gate.md
{"validator":"aidakit.check-links","ok":true,"files_checked":1,"errors":[]}
```

### Housekeeping — the stray `.bak` file

The coordinator reported an untracked `governance/validators/check-design-claims.js.bak` seen mid-review from a prior mutation-testing pass, since removed. All round-3 mutation backups were written to the session's scratchpad directory (outside the git worktree entirely), never to an in-repo path. `find . -name "*.bak" -not -path "./node_modules/*"` confirmed empty before this report.

### Round 3 — final validation

```
$ node governance/__tests__/check-design-claims.test.mjs
129 passed, 0 failed

$ node governance/__tests__/agent-validator-paths.test.mjs
33 passed, 0 failed

$ for t in governance/__tests__/*.test.mjs; do node "$t" || echo "FAIL $t"; done
FAIL governance/__tests__/context-pack.test.mjs   # pre-existing, unchanged 129/12, see §Unresolved Deviations
# every other of the 22 files green, including check-design-claims.test.mjs at 129/0

$ node governance/validators/check-design-claims.js docs/features/plan-gate-executor-internals-check
{"validator":"aidakit.check-design-claims","ok":true,"files_checked":2,"citations_checked":86,"waived_new_files":0,"skipped":[...12 entries, unchanged in kind...],"errors":[]}
exit=0

$ node governance/validators/check-links.js docs/features/plan-gate-executor-internals-check docs/decisions/ADR-015-readiness-owns-internals-claims-gate.md docs/decisions/README.md skills/readiness/SKILL.md governance/__tests__/agent-validator-paths.test.mjs docs/roadmap/epics/EPIC-kit-discipline-hardening.md docs/OVERVIEW.md PROCESS.md docs/guides/existing-repo-flow.md docs/guides/change-flow.md docs/reference/skills.md skills/catalog/INDEX.md
{"validator":"aidakit.check-links","ok":true,"files_checked":15,"errors":[]}
exit=0
```

**Deviation from round 1/2's stated touched-file set:** `docs/features/plan-gate-executor-internals-check/design.md` is now also edited (new §External-reference exclusion subsection documenting the round-2/3 extraction-contract additions and the accepted residual limitation). Not in `tasks.md` §9's original enumerated diff surface, added deliberately in response to the coordinator's explicit "do not leave it undocumented" instruction — a design decision, not scope creep, since the validator's actual contract changed and the design package is the correct place of record for it. `docs/features/plan-gate-executor-internals-check/retry-history.json` also shows as modified in `git status` — flow-managed bookkeeping (round-tracking), not authored by the implementer.

Files touched in round 3 (beyond round 1+2's set): `governance/validators/check-design-claims.js` (bounded `URL_RE`, widened + corrected `isExternalHref`, `external-reference` skip visibility), `governance/__tests__/check-design-claims.test.mjs` (+30 assertions: §C24 updated, §C26-§C35 added), `docs/decisions/ADR-015-readiness-owns-internals-claims-gate.md` (§Decision-2 qualified, two new §Consequences bullets), `docs/features/plan-gate-executor-internals-check/design.md` (new §External-reference exclusion subsection).

## Round 4 — owner ruling, design change (post-delivery)

Round 3's delivery was rejected again: `adr` approved, `tests` PASS, `quality` rejected, `specs` NEEDS-REVISION. Consensus `fail`. But the owner did not ask for round 3's two findings to be patched — the **design changed**: bare-citation extraction (form 2) is narrowed to inline-code spans only; the entire `URL_RE` masking mechanism is deleted; a citation-shaped token in raw prose is now reported in `skipped[]` (rule `citation-not-in-code-span`) instead of being masked, checked, or silently dropped. Rationale (owner, 2026-07-25): three rounds of patching a raw-prose terminator-character set is an open-ended enumeration that can't be won; a corpus measurement across all 17 archived change packages found 55 real citations inside backticks, 39 inside links, and **0** in raw prose — so raw-prose scanning was pure liability with zero real-world payoff.

### Housekeeping (done first, per the owner's instruction)

`governance/validators/check-design-claims.js.orig` was untracked in the repo at round-4 start — a stray mutation backup missed by round 3's `*.bak`-only glob (the file used the `.orig` extension, not `.bak`). Deleted:
```
$ find . -name "*.orig" -o -name "*.bak" -o -name "*.tmp" | grep -v node_modules
governance/validators/check-design-claims.js.orig
$ rm governance/validators/check-design-claims.js.orig
$ find . -name "*.orig" -o -name "*.bak" -o -name "*.tmp" | grep -v node_modules
(empty)
```
Round 3's evidence claim of "no in-repo backups, verified with a `*.bak` glob" was technically true but missed the actual file — corrected here rather than left standing. All round-4 mutation backups were kept in the session scratchpad directory exclusively.

### 1. `design.md` §Citation extraction narrowed (item 1)

Form 2 changed from "in prose or inline code" to **inline code only**. New `### Owner ruling, 2026-07-25` subsection records the three-round history, the exact corpus measurement (55/39/0 across 17 packages), the decision, and the explicit reading of the (unchanged) acceptance criterion text. `### External-reference exclusion` trimmed to the linked-form-only mechanism that still exists (`isExternalHref`); the round-3 "Known limitation" paragraph about scheme-less bare hosts and protocol-relative URLs — which described a blind spot in the now-deleted masking mechanism — is **removed entirely**, not reworded, per the owner's explicit instruction not to leave stale documentation of a deleted mechanism.

### 2/3. `URL_RE` and the masking mechanism deleted; classification replaces it (items 2-3)

`governance/validators/check-design-claims.js`:
- `URL_RE` and its masking `.replace()` pass: **deleted**.
- `isExternalHref` **kept**, used only for the linked form (unchanged from round 3: `/^(https?:|mailto:|file:|#)/i`, empty-href guard).
- `citationsIn()` rewritten: after masking real link markup out of the line (unchanged), inline-code spans (`` `[^`]*` `` pairs) are located in the remaining text; every `BARE_CITE_RE` match is classified by whether its position falls inside a code span. Inside → checkable (`bare-root`/`bare-basename`, same as before). Outside → new form `"prose"`, pushed with no target to check.
- `main()`: new branch routes `c.form === "prose"` to `skipped.push({ rule: "citation-not-in-code-span", ... })`, alongside the existing `citation-unresolvable` (basename) and `external-reference` (excluded href) branches. **Nothing citation-shaped is ever silently dropped** — every excluded token has a named `skipped[]` rule now.

### 4. Tests — RED→GREEN, retroactively verified

Deleted (pinned a deleted mechanism, would be dead weight asserting removed behavior):
- **§C26** (original, "glued-citation" — pinned the bounded `URL_RE`'s specific character-exclusion set) — **replaced** with a redesigned §C26 (below), not simply removed, since the underlying scenarios (comma/semicolon/colon glue, quoted-URL false positive) are exactly the round-3 repros and still deserve a regression pin under the new semantics.
- **§C32** (bare `www.` host masking) — deleted; folded into the general "raw prose is always skipped" behavior §C25/§C26 now covers uniformly, since there is nothing `www.`-specific left once ALL raw prose (URL-shaped or not) is treated identically.
- **§C33** (`URL_RE` g-flag/greedy mutation lock) — deleted; the regex it pinned no longer exists.
- **§C30b** (bare-form uppercase-scheme masking) — deleted from §C30, which now covers only the still-relevant linked-form case (§C30a); case no longer matters for bare citations since ALL raw prose is uniformly skipped regardless of case or shape.

Updated (same test id, new assertions reflecting the new mechanism):
- **§C25** — now asserts the `citation-not-in-code-span` skip entry explicitly (previously just asserted the absence of an error).

Added:
- **§C26** (redesigned) — the exact round-3 repro shapes: paren-glue, comma-glue, semicolon-glue, colon-glue, and the quoted-URL-query fragment. All assert: exit 0, no errors, and the citation **visible** in `skipped[]` with `citation-not-in-code-span` — proving the fix closes both the round-3 silent-miss direction and the false-positive direction at once, uniformly.
- **§C36** — a prose citation sitting in the *gap* between two real, separate `` `code spans` `` on one line must still be classified as prose, not swallowed into one merged span by a greedy `CODE_SPAN_RE` mutation. (Found live during this round's own mutation testing — see below.)

RED, retroactively confirmed by running the new/updated test file against the round-3 baseline validator (restored from the scratchpad backup):
```
$ node governance/__tests__/check-design-claims.test.mjs   # round-3 validator, round-4 tests
FAIL C25: visible in skipped[] with rule citation-not-in-code-span (got [])
FAIL C25: the skip entry carries the citation text
FAIL C26a (paren-glued): never fails the run (got exit 1)
FAIL C26a: errors === []
FAIL C26a: the glued citation is VISIBLE in skipped[], not silently dropped
FAIL C26b: visible in skipped[]
FAIL C26c: visible in skipped[]
FAIL C26d: visible in skipped[]
FAIL C26e (quoted URL fragment): never fails the run (got exit 1)
FAIL C26e: errors === [] — no false positive from the quoted fragment either
FAIL C26e: visible in skipped[]

119 passed, 11 failed
```
(Note: §C26b/c/d — comma/semicolon/colon glue — already exited 0 under round-3 code, since the old bound already happened to exclude those specific characters in its own way; the failure there is purely the missing `skipped[]` visibility, which is exactly the round-3 `adr` finding. §C26a/e — paren-glue and quoted-URL — actually exited 1 under round-3 code, i.e. were treated as findings; under round 4 they are deliberately reclassified as unchecked prose, never a finding, which is the intended behavior change.)

GREEN, round-4 validator, restored from scratchpad and confirmed byte-identical to the working copy before this run:
```
$ node governance/__tests__/check-design-claims.test.mjs
134 passed, 0 failed
```

**Exact bench round-3 repro commands, re-run against the round-4 validator (all four originally-problematic shapes, both directions correct now):**
```
$ node governance/validators/check-design-claims.js <fixture: "https://example.com/r.pdf,governance/ghost.js:99999">
{"ok":true,"skipped":[{"rule":"citation-not-in-code-span","citation":"governance/ghost.js:99999"}],"errors":[]}
exit=0   # visible, not silently dropped (was: ok:true, citations_checked:0, invisible)

$ node governance/validators/check-design-claims.js <fixture: "https://example.com/s?q='governance/ghost.js:12'">
{"ok":true,"skipped":[{"rule":"citation-not-in-code-span","citation":"governance/ghost.js:12"}],"errors":[]}
exit=0   # no false positive from the quoted fragment (was: ok:false, citation-file-missing)
```

### Mutation-kill summary, round 4 (all confirmed RED then restored, `diff` byte-identical each time)

| # | Mutation | Result | Restored & verified |
|---|---|---|---|
| 1 | `inCodeSpan` → always `true` (everything checkable) | RED — 17 failures (§C25, §C26a-e) | yes |
| 2 | `inCodeSpan` → always `false` (nothing checkable) | RED — 5 failures (§C7, §C8 — pre-existing tests, still doing their job) | yes |
| 3 | `CODE_SPAN_RE` → greedy `` /`.*`/g `` (spans multiple backtick pairs) | RED — 4 failures (§C36, added specifically because this mutation survived the first pass with no dedicated test) | yes |
| 4 | Drop `mailto:` from `isExternalHref` (carried from round 3) | RED — 3 failures (§C29) | yes |
| 5 | `dirname(resolve(targets[0]))` → `resolve(targets[0])` (carried from round 3) | RED — 2 failures (§C35) | yes |
| 6 | Drop `#`/`?` stripping on linked href (carried from round 3) | RED — 2 failures (§C34) | yes |
| 7 | `isArchived` → `parts.includes("archive")` (carried from round 2) | RED — 3 failures (§C15b) | yes |
| 8 | `resolvedTargets.slice(0, 1)` (carried from round 2) | RED — 4 failures (§C23) | yes |

Mutation 3 is the one genuinely new finding of this round's own mutation testing (not named by the coordinator) — `CODE_SPAN_RE` without a dedicated bound-check survived silently until §C36 was added specifically to close it, then confirmed to kill it.

### 5. ADR-015 updates

- §Decision-2's extraction description updated: "extracts every repo-anchored citation — in a markdown link, or inside an inline-code span". New sub-paragraph records the narrowing, the corpus measurement, and the criterion-reading statement (constraint honored: no criterion id or text touched in `proposal.md`/`classification.json`/`brainstorm.json`).
- Round-3 `adr` finding 1 (the prose-URL mask's `skipped[]` visibility promise being false) — closed structurally: raw prose is no longer masked at all, it is classified and reported (`citation-not-in-code-span`), so the promise is literally true for every exclusion path now.
- Round-3 `adr` finding 3 (header comment pointing at a WORKING-life `design.md` path without a link) — moot: the sentence it was about (the "Known limitation" residual) is deleted outright, per the constraint that a disappearing residual must be removed, not reworded.
- Round-3 `adr` finding 4 (`agent-validator-paths.test.mjs:90-99` should be `:91-100`) — fixed in both `ADR-015` and `design.md` (2 occurrences); confirmed against the live file (`// ── 3. Grep discipline` at line 91, closing `}` at line 100).
- §Consequences: the stale round-3 residual bullet (scheme-less bare host, protocol-relative URL) **removed** and replaced with the much narrower actual residual (a rotten citation in raw prose text is never mechanically caught — accepted, by the corpus measurement, since Process §14 still covers it regardless of formatting).

```
$ node governance/validators/check-adr-format.js docs/decisions/ADR-015-readiness-owns-internals-claims-gate.md
{"validator":"aidakit.check-adr-format","ok":true,"adrs_checked":1,"errors":[]}
$ node governance/validators/check-links.js docs/decisions/ADR-015-readiness-owns-internals-claims-gate.md
{"validator":"aidakit.check-links","ok":true,"files_checked":1,"errors":[]}
```

### Net line delta on `check-design-claims.js` (owner expected a shrink)

```
$ wc -l governance/validators/check-design-claims.js                  # round 4 (final)
293 governance/validators/check-design-claims.js
$ wc -l <round-3 baseline, saved before this round's edits>
295 <round-3 baseline>
```
**293 vs 295 — net shrink of 2 lines**, despite adding the `codeSpans`/`inCodeSpan` classification machinery and a new `"prose"` form/skip branch, because deleting `URL_RE` (an 11-line regex + comment block) and its masking `.replace()` pass removed more than the replacement added. (`diff` line-count: 33 lines added, 35 removed.)

### Round 4 — final validation

```
$ node governance/__tests__/check-design-claims.test.mjs
134 passed, 0 failed

$ node governance/__tests__/agent-validator-paths.test.mjs
33 passed, 0 failed

$ for t in governance/__tests__/*.test.mjs; do node "$t" || echo "FAIL $t"; done
FAIL governance/__tests__/context-pack.test.mjs   # pre-existing, unchanged 129/12, see §Unresolved Deviations
# every other of the 22 files green, including check-design-claims.test.mjs at 134/0

$ node governance/validators/check-design-claims.js docs/features/plan-gate-executor-internals-check
{"validator":"aidakit.check-design-claims","ok":true,"files_checked":2,"citations_checked":86,"waived_new_files":0,"skipped":[...12 citation-unresolvable entries, unchanged in kind, none new from the design.md rewrite...],"errors":[]}
exit=0

$ node governance/validators/check-links.js docs/features/plan-gate-executor-internals-check docs/decisions/ADR-015-readiness-owns-internals-claims-gate.md docs/decisions/README.md skills/readiness/SKILL.md governance/__tests__/agent-validator-paths.test.mjs docs/roadmap/epics/EPIC-kit-discipline-hardening.md docs/OVERVIEW.md PROCESS.md docs/guides/existing-repo-flow.md docs/guides/change-flow.md docs/reference/skills.md skills/catalog/INDEX.md
{"validator":"aidakit.check-links","ok":true,"files_checked":15,"errors":[]}
exit=0

$ find . -name "*.orig" -o -name "*.bak" -o -name "*.tmp" | grep -v node_modules
(empty)
```

Files touched in round 4 (beyond round 1+2+3's set — no new files): `governance/validators/check-design-claims.js` (deleted `URL_RE`/masking, added code-span classification, net -2 lines), `governance/__tests__/check-design-claims.test.mjs` (§C26 replaced, §C32/§C33/§C30b deleted, §C25 updated, §C36 added — net +5 assertions, 129→134), `docs/decisions/ADR-015-readiness-owns-internals-claims-gate.md` (§Decision-2 rewritten with the narrowing sub-paragraph, stale residual bullet replaced, two `:90-99`→`:91-100` span corrections), `docs/features/plan-gate-executor-internals-check/design.md` (§Citation extraction narrowed, new §Owner ruling subsection, §External-reference exclusion trimmed to the linked-form-only mechanism, one span correction).

## Round 5 — owner ruling: the change is SPLIT (final state)

Bench round 4 rejected 4/4 — the first unanimous rejection. Root cause, independently reproduced: the markdown-linked form whose *label* is itself wrapped in backticks — a link whose visible text is inline code, pointing at some target path — was dropped **entirely** by `citationsIn()`: not checked, not errored, not visible in `skipped[]`. `label.trim()` kept the backticks, so the citation-suffix regex's `$` anchor never matched the label; the link markup was then masked out unconditionally, so the bare-citation scan never saw the text either. It occurs **17 times** across this repo's own archived designs — copying an affected archived `design.md` out of `docs/archive/` and running the validator against it returned total silence (`ok:true`, zero citations checked, zero skipped, zero errors) on a design whose citations were *all* that form. This defect predates round 4 and survived three prior review rounds plus heavy mutation testing; the round-4 corpus measurement that justified the inline-code-span narrowing (55/39/0 across 17 packages) was itself measured through this same blind extractor and undercounted by exactly those 17 hits.

**Owner's call: ship what works, split out what does not.** Process §14 — the semantic gate — passed every bench round since round 1. `governance/validators/check-design-claims.js` and its test are removed from this change entirely; the mechanical check moves to a future, separate change.

### 1. File surface removed

```
$ rm governance/validators/check-design-claims.js governance/__tests__/check-design-claims.test.mjs
```
`docs/OVERVIEW.md`'s validator-table row reverted (`git checkout -- docs/OVERVIEW.md`, confirmed `git diff` empty afterward). `governance/__tests__/agent-validator-paths.test.mjs`'s `SOURCE_FILES` entry for `skills/readiness/SKILL.md` reverted — confirmed no `$AIDAKIT_GOVERNANCE` occurrence remains anywhere in `skills/readiness/SKILL.md` (`grep -n "AIDAKIT_GOVERNANCE" skills/readiness/SKILL.md` → no output) before removing the entry, so there was genuinely nothing left to pin:
```
$ git diff governance/__tests__/agent-validator-paths.test.mjs
(empty — byte-identical to the tracked original)
$ node governance/__tests__/agent-validator-paths.test.mjs
31 passed, 0 failed
```

### 2. `skills/readiness/SKILL.md` Process §14 narrowed to the semantic gate only

The mechanical pre-pass paragraph, its guarded `Bash` invocation block, and the `skipped[]`-interpretation sentence at the old line 333 are removed. Process §14 now needs only `Read`/`Grep` — confirmed no `AIDAKIT_GOVERNANCE` or `check-design-claims` string remains in the file. The `### 14` heading, its placement between `### 13.` and `### Severity classification`, the three claim shapes, and the `Critical`/`Mandatory before implementation` rule for generalizations are unchanged from earlier rounds.

### 3. Plan artifacts narrowed

- `proposal.md` — `governance/validators/check-design-claims.js` and its test dropped from §Scope; validator-specific exit criteria and the `docs/OVERVIEW.md` edit dropped; acceptance criteria `mechanical-validator-scoped-as-secondary` and `new-file-citations-excluded` removed. The remaining 4 stayed byte-identical, ids untouched — verified:
  ```
  brainstorm ids (4): [readiness-owns-the-gate, not-flow-wired-by-default, planner-naming-corrected, precedent-incident-documented]
  proposal ids (4):   [readiness-owns-the-gate, not-flow-wired-by-default, planner-naming-corrected, precedent-incident-documented]
  MATCH: exactly 4 ids, byte-identical bodies
  ```
- `.aidakit/tasks/plan-gate-executor-internals-check/brainstorm.json` — same two entries removed from `acceptance_criteria[]`; a dated `decision.split_2026_07_25` note added recording the owner ruling, the root cause, the 17-hit count, and that the mechanical check moves to a future change.
- `not-flow-wired-by-default` — the **id** was kept frozen (it is the `parse-criteria.js`/`check-acceptance.js` correlation key), but its **body** was false as first split: it still asserted `check-design-claims.js` is invoked by `aidakit:readiness` via `Bash`, a validator that no longer exists. Caught by the planner's own sweep on the next pass and rewritten in both `proposal.md` and `brainstorm.json` to promise only the flow-wiring half — "no new `runs:` step" — with no reference to the removed validator. Both sources verified byte-identical (sha-compared) after the rewrite. `git diff --stat governance/flows/full.yaml governance/flows/fast.yaml` → empty, confirmed below.
- `precedent-incident-documented` — its text allows the incident to be documented in `design.md` **or** the validator header; the validator is gone, so `design.md` carries it (§The incident, stated plainly — unchanged content, still present).
- `design.md` — §Surface 2, §Citation extraction, §Failure rules, §New-file exclusion, §Output contract, §Header comment, §External-reference exclusion, and §Owner ruling (the round-4 one, about the validator's own extraction contract) are all removed. §The incident, §Why `readiness` owns it, §Surface 1, and §Grounding (trimmed to Surface-1-relevant items) are kept. The `Bash`-availability "Open point" section is cut — moot with no `Bash` call remaining. A new `## Mechanical check: split out (owner ruling, 2026-07-25)` section records the four-round history, the exact blocking defect, the 17-hit corpus count, and that the successor change's id was not yet assigned at authoring time.
- `tasks.md` — rewritten: validator tasks and test sections removed; kept the SKILL.md work, the docs section (epic fix, `13`→`14` ripple, ADR-015 verification), and a narrowed §4 Validation / §5 Cleanup.
- `ADR-015` — status `proposed`, so a free edit. §Decision 2 rewritten to record the split (four-round history, the blocking defect, why deferring beats a fifth patch); §Decision 3 (the call-site/env-contract paragraph) removed — no call site ships. §Consequences narrowed to match. Title initially **left untouched** in this same round, on the reasoning that `docs/decisions/README.md` quoted the exact same pre-split wording and changing one without the other would create an inconsistency — **corrected in a later round, under an explicit ruling**: the title and both `docs/decisions/README.md` registrations (index row + thematic grouping) were updated *together*, in the same edit, to "…the mechanical anchor check is deferred to a separate change" — precisely because leaving them mismatched, or changing only one, would have been the inconsistency. Verified afterward: the pre-split wording occurs nowhere in `docs/decisions/` outside `docs/archive/`.

### 4. Validation (all real output)

```
$ node governance/__tests__/agent-validator-paths.test.mjs
31 passed, 0 failed

$ for t in governance/__tests__/*.test.mjs; do node "$t" || echo "FAIL $t"; done
FAIL governance/__tests__/context-pack.test.mjs   # pre-existing, unrelated, see §Unresolved Deviations
# 21 files total (was 22 — check-design-claims.test.mjs is gone), every other file green

$ node governance/validators/check-adr-format.js docs/decisions
{"validator":"aidakit.check-adr-format","ok":true,"adrs_checked":14,"errors":[]}

$ node governance/validators/check-links.js docs/features/plan-gate-executor-internals-check docs/decisions/ADR-015-readiness-owns-internals-claims-gate.md docs/decisions/README.md skills/readiness/SKILL.md docs/roadmap/epics/EPIC-kit-discipline-hardening.md PROCESS.md docs/guides/existing-repo-flow.md docs/guides/change-flow.md docs/reference/skills.md skills/catalog/INDEX.md
{"validator":"aidakit.check-links","ok":true,"files_checked":14,"errors":[]}

$ node governance/validators/check-plugin-version.js
{"validator":"aidakit.check-plugin-version","ok":true,"manifest":"0.9.0","highest":"0.8","behind":[],"scanned":299}

$ git diff --stat governance/flows/full.yaml governance/flows/fast.yaml
(empty output)

$ grep -rn "skills/planner/SKILL.md" docs/roadmap skills governance agents commands
(no output, exit 1 = no match)
$ grep -rnE "\]\([^)]*skills/planner/SKILL\.md" . --exclude-dir=node_modules --exclude-dir=.git
(no output, exit 1 = no match)

$ find . -name "*.orig" -o -name "*.bak" -o -name "*.tmp" | grep -v node_modules
(empty)

$ git status --porcelain | grep -i check-design-claims
(no output)
```

**A self-inflicted false positive found and fixed during this round's own writing:** an early draft of `design.md` and `proposal.md` illustrated the round-4 defect shape with a literal markdown-link example whose href was the placeholder word `href` — that literal example was itself a real markdown link with an unresolvable target, and `check-links.js` correctly flagged it (self-dogfooding the exact lesson this whole change is about). Fixed by moving the illustrative example into a fenced code block in `design.md` and by describing the shape in prose everywhere else, with no literal bracket-paren syntax outside a fence. Re-confirmed `check-links` clean on `design.md`, `proposal.md`, and this file afterward.

### Files touched, final state (this round's net changes on top of rounds 1-4)

**Removed:** `governance/validators/check-design-claims.js`, `governance/__tests__/check-design-claims.test.mjs`.
**Reverted to original (no diff):** `docs/OVERVIEW.md`, `governance/__tests__/agent-validator-paths.test.mjs`.
**Rewritten (narrowed):** `skills/readiness/SKILL.md` (Process §14, semantic-only), `docs/features/plan-gate-executor-internals-check/proposal.md`, `docs/features/plan-gate-executor-internals-check/design.md`, `docs/features/plan-gate-executor-internals-check/tasks.md`, `docs/decisions/ADR-015-readiness-owns-internals-claims-gate.md`, `.aidakit/tasks/plan-gate-executor-internals-check/brainstorm.json` (gitignored, not in `git status`).
**Untouched, per the coordinator's explicit instruction:** the epic ghost-path fix, the `13`→`14` ripple across `PROCESS.md`/`docs/guides/existing-repo-flow.md`/`docs/guides/change-flow.md`/`docs/reference/skills.md`/`skills/catalog/INDEX.md`, `docs/decisions/README.md`'s ADR-015 registration.

## Unresolved Deviations

- **`context-pack.test.mjs` fails independent of this change.** Confirmed via `git stash` (stashing all of this session's edits, at the time rounds 1-4's diff was in place) that the identical 12 failures (`§dogfood-regression-code-map-pointers` × 10, `§dogfood-regression-adrs` × 2) reproduce on the pre-change tree. Not a regression introduced by this change; out of scope to fix here. Flagging for a separate debit.
- No divergence was found in [design.md](design.md) §Grounding at setup time (see §Setup above) — nothing to reconcile.
- **Superseded note:** the `Bash`-availability "Open point" this file previously tracked no longer applies — that whole section was cut from `design.md` in round 5, since Process §14 as shipped needs only `Read`/`Grep` and never invokes `Bash` at all.
- No task in the final [tasks.md](tasks.md) was left incomplete.

## Round 8 — merge with `origin/main` + ADR renumber (post-merge state)

`origin/main` advanced 9 commits while this change ran and landed its **own** `ADR-014`
(`archive-aware-link-resolution`, PR #46). ADR numbering is global and never recycled, so
this change's ADR renumbered **014 → 015** and `origin/main` was merged into the branch.
Conflicts resolved in `docs/decisions/README.md`, `docs/roadmap/ROADMAP.md` and the epic.

Every count recorded in Rounds 1-5 above was accurate when captured and is superseded here.
Notably main's archive-aware `check-links` resolved the 13 pre-existing broken links, and
main also fixed `context-pack.test.mjs` — both of which this change had carried as known,
out-of-scope debits.

```
$ node governance/validators/check-adr-format.js docs/decisions
{"validator":"aidakit.check-adr-format","ok":true,"adrs_checked":15,"errors":[]}

$ node governance/validators/check-links.js .        # repo-wide, previously 13 broken
{"validator":"aidakit.check-links","ok":true,"files_checked":247,"errors":[]}

$ for t in governance/__tests__/*.test.mjs; do node "$t"; done   # full suite
22 files, 0 with failures  # context-pack.test.mjs now green (fixed on main)

```

> The context pack is rebuilt **after** this file is finalized (`build.js rebuild`) and then
> verified — pasting a `verify` capture inside the very file the pack hashes is circular.
