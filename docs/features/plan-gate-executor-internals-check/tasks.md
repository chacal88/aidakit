# Tasks — plan-gate-executor-internals-check

**Change ID:** `plan-gate-executor-internals-check`
**Date:** `2026-07-25`
**Owner:** `@chacal88`
**Phase / Package:** `skills/readiness + governance/validators — the plan gate verifies internals claims against live code`
**PRD:** `n/a`
**Tech Spec:** `n/a`

> **TDD, tests-first.** Every behavior gets a **failing** test (RED) before the code that satisfies it (GREEN), then a REFACTOR pass. Test idiom: pure Node `.mjs`, no framework — `let pass = 0, fail = 0`, `ok(cond, name)`, real CLI driven through `spawnSync`, JSON parsed off stdout's last line, `process.exit(fail ? 1 : 0)`; mirror [governance/__tests__/check-adr-format.test.mjs](../../../governance/__tests__/check-adr-format.test.mjs). Run one file with `node governance/__tests__/<file>.test.mjs` ([governance/README.md:12](../../../governance/README.md)).
> **Anti-drift ([GOVERNANCE.md](../../../GOVERNANCE.md) §8):** this change is *about* unverified internals claims — re-inspect before coding. Any shape in [design.md](design.md) §Grounding that differs from live code → STOP, correct the design, then proceed.
>
> **Files this change CREATES** (2) and **EDITS** (9) are listed per section below; the consolidated create-list is [design.md](design.md) §New files.

## 1. Setup

- [ ] Re-verify [design.md](design.md) §Grounding against live code before writing anything: the argv/envelope/exit shape at [check-acceptance.js:49-53, :142-162](../../../governance/validators/check-acceptance.js); the target-list shape at [check-adr-format.js:75-92](../../../governance/validators/check-adr-format.js); `LINK_RE` + fenced-skip at [check-links.js:23, :55-79](../../../governance/validators/check-links.js); the readiness section boundaries at [skills/readiness/SKILL.md:165, :296, :311](../../../skills/readiness/SKILL.md); the sweep and `SOURCE_FILES` at [agent-validator-paths.test.mjs:47-64, :90-99](../../../governance/__tests__/agent-validator-paths.test.mjs). Record any divergence in [evidence.md](evidence.md) §Setup before touching code.
- [ ] CREATE `governance/__tests__/check-design-claims.test.mjs` with the harness skeleton only (`pass`/`fail`, `ok`, `mkdtempSync` sandbox under `tmpdir()`, `run(...targets)` helper wrapping `spawnSync("node", [VALIDATOR, ...targets])` and parsing the last stdout line as JSON, `writeFixture(rel, content)`, final `process.exit(fail ? 1 : 0)`). Confirm it runs and reports `0 passed, 0 failed`.

## 2. Surface Work — validator RED (`governance/validators/check-design-claims.js` does not exist yet)

All tests in this section must FAIL before section 3. (AC: `mechanical-validator-scoped-as-secondary`, `new-file-citations-excluded`)

### 2a. CLI contract

- [ ] Test §C1: no arguments → exit **2**, stderr contains `usage: check-design-claims`.
- [ ] Test §C2: a target path that does not exist → exit **2** (operator error, not a finding).
- [ ] Test §C17: `--json` suppresses the stderr markdown report; stdout still carries one JSON line whose envelope has exactly the keys `validator` (`"aidakit.check-design-claims"`), `ok`, `files_checked`, `citations_checked`, `waived_new_files`, `skipped`, `errors`.

### 2b. Citation extraction and the two failure rules

- [ ] Test §C3: linked citation `[governance/x.js:3](<rel>/governance/x.js)` (a real markdown link in the fixture; `<rel>` stands for the sandbox-relative path) in a fixture `design.md`, target present with ≥3 lines → exit **0**, `citations_checked === 1`, `errors === []`.
- [ ] Test §C4: linked citation whose target file is absent → exit **1**, single error with `rule: "citation-file-missing"`, and the error carries `file`/`line` of the claim plus `path` of the target.
- [ ] Test §C5: linked citation `…:12` into a 5-line file → exit **1**, `rule: "citation-line-out-of-range"`.
- [ ] Test §C6: range citations — `:2-4` into a 5-line file → exit 0; `:2-9` into the same file → exit **1**, `citation-line-out-of-range`.
- [ ] Test §C18 (boundary): file with exactly N lines and a trailing newline — `:N` → exit 0 (no phantom last line from the split); `:N+1` → exit 1; `:0` → exit 1.
- [ ] Test §C7: bare root-relative citation in inline code (`` `governance/x.js:3` ``, at least one `/`) resolves against the project root (`AIDAKIT_PROJECT_ROOT` set to the sandbox) → checked; exit 0 when valid, exit 1 with `citation-file-missing` when the file is gone.
- [ ] Test §C8: bare basename-only citation (`` `cli.js:12` ``, no `/`, not inside a link) → exit **0**, `errors === []`, one `skipped[]` entry with `rule: "citation-unresolvable"` carrying the citation text and the claim's line.
- [ ] Test §C9: an anchor written inside a fenced code block is ignored entirely (neither checked nor skipped-reported as a citation).
- [ ] Test §C14: a **directory** target scans `design.md` + `proposal.md` only — a rotten anchor planted in `tasks.md` and in `specs/cap/spec.md` inside the same directory does NOT fail the run; `files_checked === 2`.
- [ ] Test §C15: a `design.md` whose path contains `docs/archive/` is not scanned — exit 0, one `skipped[]` entry `rule: "archived-source"`, `citations_checked === 0`.
- [ ] Test §C16: a citation *pointing into* `docs/archive/**` is checked like any other (present + in range → exit 0; line past the end → exit 1).

### 2c. New-file waiver (AC: `new-file-citations-excluded`)

- [ ] Test §C10 (the criterion's proof): fixture `design.md` cites `[governance/validators/new-thing.js:10](<rel>/governance/validators/new-thing.js)`, the path is **absent from disk**, `design.md` declares it under `## New files (created by this change)` as the first inline-code span of a bullet, and the sibling `tasks.md` contains the literal path string → exit **0**, `waived_new_files === 1`, `errors === []`, one `skipped[]` entry `rule: "new-file-waived"`.
- [ ] Test §C11: same fixture but the path appears nowhere in `tasks.md` → waiver withheld → exit **1**, `citation-file-missing`.
- [ ] Test §C12: same fixture with no `tasks.md` at all in the change dir → waiver withheld → exit **1**.
- [ ] Test §C10b (fenced declarations do not count): a fixture `design.md` whose ONLY `## New files` heading sits inside a fenced ```` ```md ```` block, plus a citation to an absent path listed in that fenced block → the waiver does **not** apply → exit **1**, `citation-file-missing`, `waived_new_files === 0`. (This design's own §New-file exclusion contains exactly such an illustrative fence — the rule exists so a design cannot hand itself waivers from an example.)
- [ ] Test §C13: a path declared under `## New files` that **does** exist on disk is checked normally — cited line past its end → exit **1**, `citation-line-out-of-range` (the waiver never masks a real file).

## 3. Surface Work — validator GREEN

- [ ] CREATE `governance/validators/check-design-claims.js`, pure Node, zero-dep, ESM, importing only `node:fs`, `node:path` and `../engine/project-root.js` — implementing exactly [design.md](design.md) §Surface 2: argv/`--json`/exit 0-1-2, directory-vs-file targets, fenced-block skip, the three citation forms, the two failure rules, the `## New files` waiver with its `tasks.md` corroboration, the `docs/archive/` carve-out, and the stdout envelope. Run §C1-§C18 → all green.
- [ ] EDIT the same file's header comment to the block in [design.md](design.md) §Header comment — verbatim intent: it guards citation staleness, it is **NOT a truth-checker**, and it names the incident (`flow-step-summaries` `design.md:92`, `proposal.md:21`, `evidence.md:8-18`) plus the reason the semantic step 14 is the real gate. (AC: `precedent-incident-documented`)
- [ ] Test §C19 (source-level pin, add and make green): read `governance/validators/check-design-claims.js` and assert its first 40 lines contain, case-insensitively, `not a truth-checker`, `citation-staleness` (or `CITATION-STALENESS`), and the three literal incident references `design.md:92`, `proposal.md:21`, `evidence.md:8-18`. (AC: `mechanical-validator-scoped-as-secondary`, `precedent-incident-documented`)

## 4. Surface Work — REFACTOR the validator

- [ ] Extract the citation scanner into one named function (`citationsIn(file)`) returning `{citation, path, startLine, endLine, claimLine, form}` so the three forms are one code path with one classification switch; keep the file under ~200 lines and side-effect-free outside `main()`.
- [ ] Confirm the error/skip message wording matches the house register of [check-links.js:95](../../../governance/validators/check-links.js) and [check-acceptance.js:111-119](../../../governance/validators/check-acceptance.js) (`rule` + human-readable `message` naming the offending path). Re-run §C1-§C19.

## 5. Surface Work — the PRIMARY gate in `skills/readiness/SKILL.md` (AC: `readiness-owns-the-gate`)

### 5a. RED

- [ ] Test §C20 (doctrine pin): read `skills/readiness/SKILL.md` and assert — (i) a heading matching `/^### 14\. /m` exists; (ii) the §14 body (from that heading to the next `### `) contains `MANDATORY`, the word stem `generaliz`, `Critical`, `Mandatory before implementation`, and `Read`/`Grep`; (iii) it contains the exact call-site string `node "$AIDAKIT_GOVERNANCE/validators/check-design-claims.js"`; (iv) it does NOT contain `node governance/validators/`; (v) §14 sits after the `### 13.` heading and before `### Severity classification`.

### 5b. GREEN

- [ ] EDIT `skills/readiness/SKILL.md`: insert `### 14. Verify claims about internals against live code` between the end of §13 and `### Severity classification` (currently line 311), with the text from [design.md](design.md) §Exact text to insert — including the fail-closed guard line copied **byte-identically** from [skills/roadmap/SKILL.md:64](../../../skills/roadmap/SKILL.md) and the `Read`/`Grep` fallback sentence for a session without `Bash`.
- [ ] EDIT `skills/readiness/SKILL.md` §4 "Review the design" (line 165 checklist): add one bullet — `- claims about the repo's own internals (executor write-sets, persistence shapes, validator contracts, state fields) are re-derived from live code per §14 — including unanchored prose and generalizations that sum several cited facts`.
- [ ] Verify the 15-section output template (lines 363-414) and the verbatim-verdict lines are **unchanged**; §14 findings are routed into the existing `## 4. Design review` / `## 11. Mandatory fixes before implementation`. Run §C20 → green.

## 6. Surface Work — call-site regression pin

- [ ] EDIT `governance/__tests__/agent-validator-paths.test.mjs`: add `"skills/readiness/SKILL.md"` to the `SOURCE_FILES` array (lines 47-53) so §0 asserts the new guard occurrence is byte-identical to the extracted canonical `GUARD`. Run `node governance/__tests__/agent-validator-paths.test.mjs` → exit 0, including the §3 sweep that must stay empty. (AC: `readiness-owns-the-gate`, ADR-004/ADR-012 conformance)

## 7. Documentation

- [ ] EDIT `docs/roadmap/epics/EPIC-kit-discipline-hardening.md` line 13: the feature's `Aceite:` sub-bullet stops naming `skills/planner/SKILL.md` and cites `skills/readiness/SKILL.md` as the owning skill (decided in this change). Keep the surrounding sentence in the file's existing language (PT) — minimal token-level edit, not a rewrite; the rest of the acceptance text (the `Pino:` and `Motivador:` sentences) stays. (AC: `planner-naming-corrected`)
- [ ] EDIT the readiness step count `13` → `14` at exactly these sites, verified by `grep -rn "13-step\|13 steps\|13 planning"`: `PROCESS.md:73`, `PROCESS.md:100`, `PROCESS.md:182`, `docs/guides/existing-repo-flow.md:119`, `docs/guides/change-flow.md:112`, `docs/reference/skills.md:16`, `docs/reference/skills.md:60`, `skills/catalog/INDEX.md:27`. Re-run the grep afterwards → zero remaining `13`-step claims.
- [ ] EDIT `docs/OVERVIEW.md` §5 validator table (after the `check-links` row at line 122): add `| **check-design-claims** | Anchor staleness in a change package: every cited \`file.ext:NN\` in design.md/proposal.md still resolves. Secondary to \`skills/readiness\` §14 — not a truth-checker. | \`validators/check-design-claims.js\` |`.
- [ ] Test §C21 (no-flow-wiring pin): assert neither `governance/flows/full.yaml` nor `governance/flows/fast.yaml` contains the string `check-design-claims`, and that `docs/decisions/` gained no new `ADR-*.md`. (AC: `not-flow-wired-by-default`)
- [ ] Test §C22 (ghost-path pin): assert the literal `skills/planner/SKILL.md` appears in **no** file under `docs/roadmap/`, `skills/`, `governance/`, `agents/` or `commands/`; assert no markdown link anywhere targets it (`/\]\([^)]*skills\/planner\/SKILL\.md/`); assert the epic's feature bullet contains `skills/readiness/SKILL.md`. The change package's own prose is **excluded** from the literal sweep — it names the string only to declare it non-existent, and `classification.json` (flow-authored, not rewritten) quotes the original roadmap line verbatim. (AC: `planner-naming-corrected`)
- [ ] Fill [evidence.md](evidence.md) per criterion as each section closes — exact commands and their real output, never paraphrase.

## 8. Validation

- [ ] `node governance/__tests__/check-design-claims.test.mjs` → exit 0, all cases green.
- [ ] `node governance/__tests__/agent-validator-paths.test.mjs` → exit 0.
- [ ] Full suite: `for t in governance/__tests__/*.test.mjs; do node "$t" || echo "FAIL $t"; done` → 22 files, no `FAIL` line printed. Record per-file counts in [evidence.md](evidence.md).
- [ ] Dogfood: `node governance/validators/check-design-claims.js docs/features/plan-gate-executor-internals-check` → exit 0 (every anchor in this package's own `design.md`/`proposal.md` resolves).
- [ ] Negative dogfood: temporarily append a citation to a deleted path in a scratch copy of `design.md` → exit 1 with `citation-file-missing`; discard the scratch file. Proves the validator is not vacuously passing.
- [ ] `node governance/validators/check-links.js .` → exit 0.
- [ ] `node governance/validators/check-plugin-version.js` → exit 0 (no footer bumped; `plugin.json` stays `0.9.0`).
- [ ] `node governance/validators/check-adr-format.js docs/decisions` → exit 0 (unchanged set; no ADR added).
- [ ] `git diff --stat governance/flows/full.yaml governance/flows/fast.yaml` → empty; `git status --porcelain docs/decisions/` → empty. (AC: `not-flow-wired-by-default`)
- [ ] `grep -rn "skills/planner/SKILL.md" docs/roadmap skills governance agents commands` → no hits, and `grep -rnE "\]\([^)]*skills/planner/SKILL\.md" . --exclude-dir=node_modules --exclude-dir=.git` → no hits. (AC: `planner-naming-corrected`)

## 9. Cleanup

- [ ] Remove every scratch fixture created outside `governance/__tests__/` (the test builds its own sandbox under `tmpdir()` and removes it).
- [ ] Confirm the final diff touches only: 2 created files, `skills/readiness/SKILL.md`, `governance/__tests__/agent-validator-paths.test.mjs`, `docs/roadmap/epics/EPIC-kit-discipline-hardening.md`, `docs/OVERVIEW.md`, `PROCESS.md`, `docs/guides/existing-repo-flow.md`, `docs/guides/change-flow.md`, `docs/reference/skills.md`, `skills/catalog/INDEX.md`, plus this change package. No flow YAML, no ADR, no `governance/engine/` file.
- [ ] Mark each `- [ ]` above as `- [x]` only when its command was actually run and its output is in [evidence.md](evidence.md).
