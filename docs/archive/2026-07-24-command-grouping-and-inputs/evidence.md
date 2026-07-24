# Evidence — command-grouping-and-inputs

**Change ID:** `command-grouping-and-inputs`
**Date:** `2026-07-24`
**Owner:** `@chacal88`
**Phase / Package:** `n/a (command-surface refactor; classification: domain=product, type=feature, flags=[architecture, contract])`
**PRD:** `n/a`
**Tech Spec:** `n/a`

> Pre-execution stub. The implement/ship steps record here: the spike outcome, exact commands, outputs, files, PR URL, and any unresolved deviations. The acceptance-criterion map below states **what evidence will prove each criterion** — filled during execution.

## Spike outcome (Task 1)

- [x] Method used: **documentation lookup**, not a scratch probe copy — the official Claude Code Agent SDK doc for slash commands settles the question directly, so no live scratch install was needed to falsify the primary branch (no product code shipped from the spike either way).
- [x] Source: [code.claude.com/docs/en/agent-sdk/slash-commands.md](https://code.claude.com/docs/en/agent-sdk/slash-commands.md), section "Organization with Namespacing". Verbatim citation: *"The subdirectory appears in the command description but doesn't affect the command name itself."* This applies uniformly to plugin, project, and personal commands — a subdirectory under `commands/` is **flattened** into the description, not rendered as an extra `:`-segment in the invocable name.
- [x] Rendered name implied for the primary branch: `commands/flow/build.md` would render as `/aidakit:build` (the subdirectory `flow/` shows only in the description) — **identical to the pre-change name**, which is worse than useless for grouping (it wouldn't even visually separate the two orchestrators from the utilities).
- [x] **Locked syntax: the fallback.** Flat two-token prefix, no subdirectory — `commands/flow-build.md` → `/aidakit:flow-build`, `commands/flow-design.md` → `/aidakit:flow-design`. The 3-segment primary (`/aidakit:flow:build`) is **not achievable** via a `commands/flow/` subdirectory per the doc above, so it is rejected outright rather than left "pending".
- [x] Confirmation the locked syntax satisfies acceptance criterion 1: `flow-build` and `flow-design` sort adjacently (alphabetically, both under the literal `flow-` prefix) in the `/aidakit:` autocomplete list, visibly apart from the five flat utility names (`catalog`, `docs`, `governance`, `plan`, `review`) which carry no such prefix.

## Validation Outputs

**Baseline (first action, before Task 0 and Task 1):**
```
node governance/validators/check-links.js .
{"validator":"aidakit.check-links","ok":true,"files_checked":216,"errors":[]}
# check-links

OK — 216 file(s), no broken links.
EXIT: 0
```

Command: `node governance/validators/check-links.js .` (re-run after all edits, then again after the round-1 review fixes)
```
{"validator":"aidakit.check-links","ok":true,"files_checked":218,"errors":[]}
# check-links

OK — 218 file(s), no broken links.
EXIT: 0
```
(216 → 218: the +2 new files this change adds, `ADR-005-command-namespacing.md` and `EPIC-flow-cli-ux.md`. No NEW breaks vs. the baseline. Re-run again after the round-1 fixes to `governance/cli.js`/`governance/flows/design.yaml`/`commands/catalog.md`/prose — identical 218/0, unchanged since none of those fixes touch links.)

Command: `node governance/validators/check-adr-format.js docs/decisions/ADR-005-command-namespacing.md` (re-run after round-1 fixes)
```
{"validator":"aidakit.check-adr-format","ok":true,"adrs_checked":1,"errors":[]}
# check-adr-format

OK — 1 ADR(s), valid format.
EXIT: 0
```

Command: `node governance/validators/check-plugin-version.js .` (re-run after round-1 fixes)
```
{"validator":"aidakit.check-plugin-version","ok":true,"manifest":"0.6.0","highest":"0.5","behind":[],"scanned":230}
# check-plugin-version

OK — manifest 0.6.0 covers the highest footer (v0.5), 230 file(s).
EXIT: 0
```

Command (slash-form leash): `grep -rEn "/aidakit:(build|design)\b" --include="*.md" . | grep -vE "\.claude/|docs/archive|docs/examples|docs/features/(loop-var-resume|command-grouping-and-inputs)"`
```
docs/decisions/ADR-005-command-namespacing.md:21: ... (describes the pre-rename `/aidakit:build`/`/aidakit:flow:build` primary syntax that was rejected)
docs/decisions/ADR-005-command-namespacing.md:33: ... (Consequences: "psim-kernel's existing `/aidakit:build` and `/aidakit:design` invocations" — describes the OLD names the direct break stops resolving)
docs/reference/agents.md:260: ... (v0.3 doctrine-footer changelog entry, historical, predates this change)
commands/flow-design.md:38: ... (v0.3 doctrine-footer changelog entry: "aidakit:design becomes the LEASH", historical)
commands/flow-design.md:39: ... (v0.5 footer THIS CHANGE ADDS: "renamed /aidakit:design → /aidakit:flow-design" — necessarily names the old token)
commands/flow-build.md:45: ... (v0.3 doctrine-footer changelog entry, historical)
commands/flow-build.md:47: ... (v0.5 footer THIS CHANGE ADDS: "renamed /aidakit:build → /aidakit:flow-build" — necessarily names the old token)
```
**All 7 remaining hits are intentional historical/changelog references, not un-migrated stale cross-references** — see "Residual leash hits" note below.

Command (bare-token leash, authoritative): `grep -rnE "\baidakit:(build|design)\b" --include="*.md" . | grep -vE "\.claude/|docs/archive|docs/examples|docs/features/(loop-var-resume|command-grouping-and-inputs)" | grep -vE "aidakit:design-(business|modeling|architecture|implementation)"`
```
docs/decisions/ADR-005-command-namespacing.md:21
docs/decisions/ADR-005-command-namespacing.md:33
docs/reference/agents.md:260
commands/flow-design.md:18   (prose: "the `aidakit:design` skill, now retired" — historical, pre-existing, unrelated to the command rename)
commands/flow-design.md:38
commands/flow-design.md:39
docs/reference/skills.md:36  ("(Previously called `aidakit:design`.)" — accurate historical clarifier now that the heading above it reads `aidakit:flow-design`)
commands/flow-build.md:45
commands/flow-build.md:47
```
Same 9 hits, same reasoning — see "Residual leash hits" note below. Every other bare-token mention in the repo (root docs, guides, reference, skills/*, the roadmap epic) was migrated.

**Leash extension — non-`.md` surfaces (added in the round-1 review correction):** the two greps above are `--include="*.md"`-only and missed three real stale hits in `governance/flows/design.yaml` (lines 7, 127, 140) and one in `governance/cli.js` (line 21, the shared `fail()` error prefix) — all fixed in this round (see "Round-1 review corrections" below). Re-run over the non-`.md` engine surface:

Command (slash-form, extended): `grep -rEn "/aidakit:(build|design)\b" --include="*.js" --include="*.yaml" governance/ | grep -vE "\.claude/"`
```
(no output — empty)
```

Command (bare-token, extended): `grep -rnE "\baidakit:(build|design)\b" --include="*.js" --include="*.yaml" governance/ | grep -vE "\.claude/" | grep -vE "aidakit:design-(business|modeling|architecture|implementation)"`
```
(no output — empty)
```
Both empty after the fix. The only remaining `aidakit:design-*` mentions in `governance/flows/design.yaml` are `invoke_target` references to the four design-phase skills (`aidakit:design-business`, `-modeling`, `-architecture`, `-implementation`) — correctly excluded, not renamed.

**Residual leash hits — accepted, not a migration gap.** Both leashes above return a small, fixed set of hits, all falling into one of two legitimate classes that a mechanical grep cannot distinguish from a real stale reference:
1. **Doctrine-footer changelog lines** (`<!-- aidakit vX.Y — ... -->`) that describe, in the past tense, what changed *at that version* — including the two new v0.5 footer lines this change itself adds to `commands/flow-build.md`/`commands/flow-design.md`, which necessarily name the pre-rename token to say what it was renamed *from*. Footers are WORM changelog entries (never rewritten), same convention as every other command file in this repo.
2. **ADR-005's own Context/Consequences prose**, which must describe the pre-rename state (`/aidakit:build`, `/aidakit:design`, psim-kernel's old invocations) to justify the decision — an ADR describing its own "before" is not a stale reference.
3. **One retired-skill mention** (`commands/flow-design.md:18`, "the `aidakit:design` skill, now retired") and **one now-accurate historical clarifier** (`docs/reference/skills.md:36`, "(Previously called `aidakit:design`.)") — both pre-existing/expected prose, not un-migrated invocation guidance.

No hit instructs a reader to actually *invoke* `/aidakit:build` or `/aidakit:design` going forward; every live invocation site in the repo was migrated to `/aidakit:flow-build` / `/aidakit:flow-design`.

Command (negative leash — collateral mis-rename): `grep -rnE "flow:design-|flow-design-|flow:build-|flow-build-" --include="*.md" . | grep -vE "docs/features/command-grouping-and-inputs"` (re-run after round-1 fixes)
```
(no output — empty)
```
Empty, as expected — no design-phase skill token (`aidakit:design-business` etc.) was corrupted into a `flow-*` form.

Command (Usage-block leash): `find commands -name "*.md" -print0 | xargs -0 grep -L "## Usage"` (re-run after round-1 fixes)
```
(no output — empty)
```
Empty — all 7 command files (`catalog.md`, `docs.md`, `flow-build.md`, `flow-design.md`, `governance.md`, `plan.md`, `review.md`) carry a `## Usage` section.

Autocomplete listing after reload (manual):
```
PENDING HUMAN VERIFICATION POST PLUGIN-RELOAD. This implementer session cannot reload the
Claude Code plugin cache / re-render the `/aidakit:` autocomplete UI — that requires a live
`claude plugin update` (or a fresh install) and a new session. Not fabricated. Once reloaded,
expect the autocomplete list to show `flow-build` and `flow-design` sorting adjacently
(both under the literal `flow-` prefix) and the five utilities (`catalog`, `docs`,
`governance`, `plan`, `review`) with no such prefix, matching the description-frontmatter
classification recorded in each command file.
```

Empty-argument reply sample — orchestrator (`/aidakit:flow-build` with empty `$ARGUMENTS`, transcribed verbatim from `commands/flow-build.md`'s guard + `## Usage` block — this is the deterministic text the command instructs itself to print, not a live-session transcript):
```
## Usage
**This is a flow orchestrator command.** It drives the `fast`/`full` flow via the engine (`node governance/cli.js`).

**Expected inputs:** `start <flow> [key=value ...]` · `resume <flow_id> <outcome>` · `status <flow_id>` · `abort <flow_id>` · `list` · `register "<free-form request>"`

**Examples (copy-paste):**
- `/aidakit:flow-build start fast request="add rate limiting to the webhook endpoint"`
- `/aidakit:flow-build status <flow_id>`
```

Empty-argument reply sample — utility (`/aidakit:plan` with empty `$ARGUMENTS`, transcribed verbatim from `commands/plan.md`'s guard + `## Usage` block):
```
## Usage
**This is a single-shot utility command.** It invokes the `aidakit:plan` skill.

**Expected inputs:** a change-id already on the roadmap, or a free-form description of the change to plan

**Examples (copy-paste):**
- `/aidakit:plan webhook-retry-safety`
- `/aidakit:plan add rate limiting to the webhook endpoint`
```

Empty-argument reply sample — utility, empty-args-is-legitimate case (`/aidakit:catalog` with empty `$ARGUMENTS`, post round-1-fix behavior; transcribed verbatim from `commands/catalog.md`'s guard + body — `catalog` treats empty as a legitimate mode, not malformed, but ADR-005 still requires the Usage block to print, so the fix makes it print **both**, Usage first):
```
## Usage
**This is a single-shot utility command.** It reads `skills/catalog/INDEX.md` and answers which skill/command/agent to use.

**Expected inputs:** a free-form "which tool for X?" question (optional — empty prints this Usage block followed by the grouped index summary, grouped by the `flow` group vs the flat utilities)

**Examples (copy-paste):**
- `/aidakit:catalog do I have something for threat modeling?`
- `/aidakit:catalog` (empty — prints the Usage block, then the grouped index summary)

[... then, immediately after, the grouped index summary: one line per category from skills/catalog/INDEX.md, 2-3 most useful tools of each, per the command's pre-existing "no specific question" behavior.]
```

## Acceptance-criterion evidence map

| Acceptance criterion | Evidence that proves it |
|---|---|
| Autocomplete makes orchestrators vs utilities clear without opening files | The pasted `/aidakit:` listing + the classification-led `description:` frontmatter of each command |
| Empty/malformed `$ARGUMENTS` → expected inputs + copy-paste example | The three empty-argument reply samples above (one orchestrator, two utilities incl. catalog's Usage-then-summary shape) + the Usage-block leash returning empty |
| Command/skill/agent distinction visible at the command / `aidakit:catalog` | The Usage classification line in each command + the grouped `skills/catalog/INDEX.md` |
| Naming syntax verified, not assumed | The Spike outcome section + ADR-005 recording the locked syntax |
| ADR-005 authored and well-formed | `docs/decisions/ADR-005-command-namespacing.md` exists + its row in `docs/decisions/README.md` + `check-adr-format.js docs/decisions/ADR-005-command-namespacing.md` exit 0 |
| All cross-references updated; check-links clean | `check-links.js` exit 0 (or no NEW breaks vs. baseline) + **both** stale-reference leashes (slash-form and bare-token) empty + negative leash empty |
| Version bump reaches installed users; check-plugin-version passes | `plugin.json` version strictly above the manifest at implementation start + `check-plugin-version.js` exit 0 |
| Engine/flows/skills not renamed | `git diff --stat` shows no file renamed/moved under `governance/` and no `design-*` skill renamed (two governance files carry round-1 string-only fixes, disclosed under "Round-1 review corrections"); the `design` flow name intact |
| No progress table / step summary added (themes 2/3 out) | Diff review note confirming no such content |

## Files Touched

(final, after the round-1 review corrections)

```
 .claude-plugin/plugin.json                     |  2 +-
 DOCS.md                                        |  4 ++--
 PROCESS.md                                     | 18 +++++++++---------
 README.md                                      |  8 ++++----
 commands/catalog.md                            | 19 +++++++++++++++++--
 commands/docs.md                               | 16 +++++++++++++++-
 commands/flow-build.md                         | 18 ++++++++++++++++--    (was commands/build.md, git mv)
 commands/flow-design.md                        | 18 ++++++++++++++++--    (was commands/design.md, git mv)
 commands/governance.md                         | 16 +++++++++++++++-
 commands/plan.md                               | 15 ++++++++++++++-
 commands/review.md                             | 15 ++++++++++++++-
 docs/OVERVIEW.md                               |  8 ++++----
 docs/decisions/README.md                       |  2 ++
 docs/examples/README.md                        |  4 ++--
 docs/guides/README.md                          |  2 +-
 docs/guides/change-flow.md                     | 12 ++++++------
 docs/guides/existing-repo-flow.md              |  2 +-
 docs/guides/flows.md                           |  2 +-
 docs/guides/getting-started.md                 | 18 +++++++++---------
 docs/guides/new-project-flow.md                |  8 ++++----
 docs/guides/roadmap-and-knowledge.md           |  2 +-
 docs/reference/agents.md                       |  6 +++---
 docs/reference/skills.md                       | 16 ++++++++--------
 docs/roadmap/README.md                         |  1 +
 docs/roadmap/ROADMAP.md                        |  9 +++++++++
 docs/roadmap/epics/EPIC-flow-engine-leashes.md |  2 +-
 governance/cli.js                              |  2 +-    (round-1: fail() error prefix, "aidakit:build" → "aidakit")
 governance/flows/design.yaml                   |  6 +++---  (round-1: 3 stale "/aidakit:build" strings → "/aidakit:flow-build")
 skills/catalog/INDEX.md                        | 18 ++++++++++--------
 skills/catalog/SKILL.md                        |  4 ++--
 skills/design-architecture/SKILL.md            |  2 +-
 skills/design-business/SKILL.md                |  2 +-
 skills/design-implementation/SKILL.md          | 16 ++++++++--------
 skills/docs/SKILL.md                           |  4 ++--
 skills/learn/SKILL.md                          |  4 ++--
 skills/plan/SKILL.md                           |  2 +-
 skills/review/SKILL.md                         |  2 +-
 skills/roadmap/SKILL.md                        |  8 ++++----
 skills/spec/SKILL.md                           |  4 ++--
 39 files changed, 214 insertions(+), 103 deletions(-)

New (untracked, not yet staged):
 docs/decisions/ADR-005-command-namespacing.md
 docs/roadmap/epics/EPIC-flow-cli-ux.md
 docs/features/command-grouping-and-inputs/{proposal.md,design.md,tasks.md,evidence.md}  (this change's own artifacts)
```

`git status --short` (final):
```
 M .claude-plugin/plugin.json
 M DOCS.md
 M PROCESS.md
 M README.md
 M commands/catalog.md
 M commands/docs.md
RM commands/build.md -> commands/flow-build.md
RM commands/design.md -> commands/flow-design.md
 M commands/governance.md
 M commands/plan.md
 M commands/review.md
 M docs/OVERVIEW.md
 M docs/decisions/README.md
 M docs/examples/README.md
 M docs/guides/README.md
 M docs/guides/change-flow.md
 M docs/guides/existing-repo-flow.md
 M docs/guides/flows.md
 M docs/guides/getting-started.md
 M docs/guides/new-project-flow.md
 M docs/guides/roadmap-and-knowledge.md
 M docs/reference/agents.md
 M docs/reference/skills.md
 M docs/roadmap/README.md
 M docs/roadmap/ROADMAP.md
 M docs/roadmap/epics/EPIC-flow-engine-leashes.md
 M governance/cli.js
 M governance/flows/design.yaml
 M skills/catalog/INDEX.md
 M skills/catalog/SKILL.md
 M skills/design-architecture/SKILL.md
 M skills/design-business/SKILL.md
 M skills/design-implementation/SKILL.md
 M skills/docs/SKILL.md
 M skills/learn/SKILL.md
 M skills/plan/SKILL.md
 M skills/review/SKILL.md
 M skills/roadmap/SKILL.md
 M skills/spec/SKILL.md
?? docs/decisions/ADR-005-command-namespacing.md
?? docs/features/command-grouping-and-inputs/
?? docs/roadmap/epics/EPIC-flow-cli-ux.md
```
Matches the declared scope, plus the two `governance/` files touched in the round-1 correction (string-only edits, per finding 1 — the engine mechanism/paths are untouched, ADR-004 not in tension): 2 renamed command files, 5 utility command files edited (Usage block + classification), prose cross-references, `ADR-005` + its `decisions/README.md` row, `plugin.json`, the Task 0 roadmap files (`docs/roadmap/README.md`, `docs/roadmap/ROADMAP.md`, `docs/roadmap/epics/EPIC-flow-cli-ux.md`, plus the pre-existing `EPIC-flow-engine-leashes.md` cross-ref update), and this change's own directory. No file under `governance/` was **renamed** and no `design-*` skill file was renamed (only 2 of the design-phase skill files got a single `/aidakit:build` → `/aidakit:flow-build` token edit each; their own names/headers are untouched).

## Round-1 review corrections

The review bench (round 1) returned FAIL from 3 of 4 roles (specs approved). All 7 findings were addressed in this repo before re-review:

1. **BLOCKING (architecture + adr):** `governance/flows/design.yaml` lines 7, 127, 140 — three strings said `/aidakit:build`. Fixed to `/aidakit:flow-build` (string-only; the flow mechanism/paths/`invoke_target`s are untouched — ADR-004 not in tension). ✅ Fixed, re-verified via the leash extension (empty).
2. **BLOCKING (architecture + adr):** `governance/cli.js` line 21 — the shared `fail()` error prefix hardcoded `"aidakit:build — error:"`. Changed to the command-neutral `"aidakit — error:"` (architecture reviewer's direction), since `fail()` is shared by every flow, not just `build`. ✅ Fixed, no test asserted the old string (checked before editing).
3. **IMPORTANT (quality):** `docs/examples/README.md` lines 13-14 — the two link anchor texts said `aidakit:design` while the hrefs already pointed at `commands/flow-design.md`. Anchor text changed to `aidakit:flow-design` in both rows (hrefs unchanged). ✅ Fixed.
4. **MINOR (adr finding 3):** `PROCESS.md:30` and `178-179`, `docs/guides/getting-started.md:18`, `docs/reference/skills.md:11` and `34-40` — these lines labeled the renamed commands "skill(s)". Reworded (only these already-touched lines, no repo-wide relabeling pass): `PROCESS.md:30` now reads "`/aidakit:flow-design` command (drives the `design` flow via the engine)"; `PROCESS.md:178-179` now lead with `` `/aidakit:flow-design` (command, not a skill) ``/`` `/aidakit:flow-build` (command, not a skill) ``; `getting-started.md:18` pulls `aidakit:flow-design` out of the "authored skills" list with a "command, not a skill" aside; `skills.md:11` and the `### aidakit:flow-design` section (34-40) are now headed/labeled "(command, not a skill)", and the mismatched `[skills/design/SKILL.md]` source-of-truth link text was corrected to `[commands/flow-design.md]`. ✅ Fixed.
5. **MINOR (adr finding 4):** `commands/catalog.md` — on empty `$ARGUMENTS` it printed only the grouped index summary, never the `## Usage` block — a literal divergence from ADR-005. Reworded the guard and the "no specific question" instruction so the `## Usage` block prints **first**, then the grouped summary right after it, on empty `$ARGUMENTS` (both, never just one). ✅ Fixed — see the new third empty-argument reply sample below.
6. **LEASH EXTENSION (architecture direction):** the misses in 1-2 happened because both stale-reference leashes were `*.md`-only. `tasks.md` Task 7 now records a second, permanent leash pass over `governance/**/*.js` and `governance/flows/*.yaml` (same token patterns, same exclusion discipline) — both empty after the fix (full outputs above). All leashes and validators were re-run after every fix in this round; outputs above are the real re-run outputs, not the pre-fix ones.
7. **EVIDENCE (quality nit):** a third empty-argument reply sample added below (`/aidakit:catalog`, post-fix behavior — Usage block then the grouped summary).

**Note on repo state during implementation:** at session start, the working tree carried unrelated, already-uncommitted local edits (a `README.md` wording fix, an `ADR-004` archive-path fix, `check-links.js` walk exclusions, a `skills/roadmap/SKILL.md` link fix, and a `plugin.json` bump to `0.5.1`) — all pre-existing and unrelated to this change. Partway through implementation, `main` advanced with new merged commits (`053bd4b chore(release): bump plugin to 0.5.1`, `6ee8649 Merge PR #16 chore/fix-broken-links`) that absorbed exactly those same edits upstream, so the working tree's diff against `HEAD` is now clean of that unrelated content — confirmed via `git diff <file>` returning empty for each of those files before this change's own edits were applied. No action was needed from this implementer; noted here for transparency only.

## Unresolved Deviations

None outstanding. All 10 task groups (0–9) completed per `tasks.md`, using the pre-resolved spike outcome (locked fallback `flow-build`/`flow-design`, documentation-lookup method instead of a scratch probe copy — see Spike outcome above) and the pre-resolved version bump (`0.6.0`, re-read `plugin.json` at `0.5.1` at implementation start). The only two items not independently verified by this implementer are:
- **The `/aidakit:` autocomplete listing after a plugin reload** — requires a live Claude Code session reload, outside this implementer's reach; recorded above as "pending human verification post plugin-reload".
- **The residual historical/changelog hits in the two stale-reference leashes** (9 lines total, itemized above) — reasoned through and accepted as legitimate WORM changelog / ADR "before"-state prose rather than un-migrated references, since a mechanical grep cannot distinguish "cite the old name as history" from "still tells the reader to invoke the old name". No live invocation guidance anywhere in the repo still points at `/aidakit:build` or `/aidakit:design`.

### Resolved deviations (round-1 review correction)

The round-1 review bench found the `.md`-only leashes had missed real stale references outside `commands/*.md` and `docs/**`: three strings in `governance/flows/design.yaml` and one in `governance/cli.js`. This was a genuine gap in the original leash scope (Task 7 as originally written), not a disagreement about intent — the acceptance criterion ("all cross-references to the two renamed commands are updated") always covered the whole repo, the leash just didn't check the whole repo. Resolved by: fixing the four strings (finding 1-2), extending the leash to `governance/**/*.js` + `governance/flows/*.yaml` permanently in `tasks.md` (finding 6), and re-running every leash/validator (all still green — see "Round-1 review corrections" above for the full per-finding trail). No scope was added beyond what ADR-005/design.md already covered; this was closing a verification gap, not changing the plan.
