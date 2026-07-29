# Evidence — brainstorm-schema-path-literal-lock

**Change ID:** `brainstorm-schema-path-literal-lock`
**Date:** `2026-07-24`
**Owner:** `@chacal88`
**Phase / Package:** `n/a (skills/brainstorm + agents/brainstorm — doctrine-only surgery, no mechanical surface)`
**PRD:** `n/a`
**Tech Spec:** `n/a`

> Pre-execution stub. The implementer fills every section below with the EXACT commands run and their real output — no paraphrase, no "green" without the tail line. This is the frozen evidence location declared in [design.md](design.md) §File structure; nothing lands anywhere else.

## Validation Outputs

### Baseline (before any edit) — [tasks.md](tasks.md) §1

- `git status --porcelain` (before any edit):
  ```
  ?? docs/features/brainstorm-schema-path-literal-lock/
  ```
- `git branch --show-current`: `claude/brainstorm-schema-path-literal-0122ef`
- `git rev-parse HEAD`: `ab037b7c20cb4ef01af739a0df5544910cad681d`
- `git log --oneline -1 origin/main`: `ab037b7 chore(docs): sync roadmap — archive 5 shipped changes + register 2 debits (#41)`
- `git merge-base HEAD origin/main`: `ab037b7c20cb4ef01af739a0df5544910cad681d` — HEAD, `origin/main` and the merge-base are the SAME commit at baseline (confirms the correction-1 substitution below agrees with the plan's original form today).
- Full suite baseline (`for f in governance/__tests__/*.test.mjs; do echo "== $f"; node "$f" 2>&1 | tail -1; done`):
  ```
  == governance/__tests__/agent-validator-paths.test.mjs
  31 passed, 0 failed
  == governance/__tests__/brainstorm-schema.test.mjs
  34 passed, 0 failed
  == governance/__tests__/candidates.test.mjs
  8 passed, 0 failed
  == governance/__tests__/check-acceptance.test.mjs
  31 passed, 0 failed
  == governance/__tests__/check-adr-format.test.mjs
  8 passed, 0 failed
  == governance/__tests__/check-bench.test.mjs
  20 passed, 0 failed
  == governance/__tests__/check-docs.test.mjs
  8 passed, 0 failed
  == governance/__tests__/check-links.test.mjs
  7 passed, 0 failed
  == governance/__tests__/context-pack.test.mjs
  129 passed, 12 failed
  == governance/__tests__/dna-freshness.test.mjs
  7 passed, 0 failed
  == governance/__tests__/dna-write.test.mjs
  14 passed, 0 failed
  == governance/__tests__/engine.test.mjs
  264 passed, 0 failed
  == governance/__tests__/ledger.test.mjs
  8 passed, 0 failed
  == governance/__tests__/plugin-version.test.mjs
  12 passed, 0 failed
  == governance/__tests__/pr-automation.test.mjs
  161 passed, 0 failed
  == governance/__tests__/prelude.test.mjs
  13 passed, 0 failed
  == governance/__tests__/progress-table.test.mjs
  30 passed, 0 failed
  == governance/__tests__/retry-memory.test.mjs
  87 passed, 0 failed
  == governance/__tests__/roadmap.test.mjs
  28 passed, 0 failed
  == governance/__tests__/step-summaries.test.mjs
  95 passed, 0 failed
  == governance/__tests__/yaml-min.test.mjs
  17 passed, 0 failed
  ```
  **Pre-existing condition, not fixed here:** `context-pack.test.mjs` is already `129 passed, 12 failed` at baseline (before any edit in this change), unrelated to `skills/brainstorm/` or `agents/brainstorm.md`. Root cause: `buildPackContent({ changeId: "context-pack-l1" })` at `governance/__tests__/context-pack.test.mjs:713` reads a change directory that commit `ab037b7` archived to `docs/archive/2026-07-24-context-pack-l1/`; it reproduces identically on stock `main` **at the merge-base (`ab037b7`)** — the qualifier matters, because upstream `main` has since moved: commit `c2dbfbf` (PR #42, `test(context-pack): make the dogfood block archive-proof`) fixed it during this change's round-2 review. A reader running the suite on a branch that includes `c2dbfbf` will see `context-pack.test.mjs` green; this branch does not include it. All other files are green at baseline.

- Assumption-2 check:
  - `grep -rn "assumptions" governance/ | grep -v __tests__` → **empty output** (no non-test file in `governance/` mentions `assumptions` at all).
  - `grep -rn "assumptions" governance/__tests__/`:
    ```
    governance/__tests__/context-pack.test.mjs:596:  ok(!/\.aidakit\//.test(pointers), "§build-content-pointers-excludes-assumptions: code-map-pointers does not capture .aidakit/ from the Assumptions subsection");
    governance/__tests__/context-pack.test.mjs:597:  ok(!/aidakit:learn/.test(pointers), "§build-content-pointers-excludes-assumptions: code-map-pointers does not capture the aidakit:learn skill id from the Assumptions subsection");
    ```
    Both hits are about the `## Assumptions` **subsection of `design.md`** (used by `context-pack`'s code-map-pointer builder to exclude noise), NOT about `brainstorm.json`'s `assumptions[]` array. Confirmed by reading the readers of `brainstorm.json` directly:
    - `grep -rln "brainstorm.json" governance/` → `governance/__tests__/check-acceptance.test.mjs`, `governance/__tests__/brainstorm-schema.test.mjs`, `governance/acceptance/parse-criteria.js`, `governance/validators/check-acceptance.js`, `governance/flows/full.yaml`.
    - `grep -n "assumptions\|acceptance_criteria" governance/acceptance/parse-criteria.js governance/validators/check-acceptance.js governance/flows/full.yaml governance/__tests__/brainstorm-schema.test.mjs` → every hit is `acceptance_criteria` (the field `parse-criteria.js:61` reads `raw.acceptance_criteria`); zero hits for `assumptions` in any of these four consumer files.
  - **Result: assumption 2 HOLDS.** No consumer reads `brainstorm.json`'s `assumptions[]`. The prose-marker decision in [design.md](design.md) stands; no escalation triggered.

### Re-read of live line numbers (§1, task 4)

Read `skills/brainstorm/SKILL.md` and `agents/brainstorm.md` in full before editing. Live line numbers matched the plan exactly: `SKILL.md` — "Classification of each doubt" at line 48, "Event trail whenever it decides" at line 50, the `> **Doctrine (the law you obey):**` paragraph at line 73, the `**Passes the assumptions + acceptance criteria**` bullet at line 79, the `v0.3` footer at line 108. `agents/brainstorm.md` — the `**Assumptions (correct me if I'm wrong):**` block at lines 85-88, the `v0.3` footer at line 118. **No drift** — edits anchored on the surrounding text per the task's instruction; no re-authoring needed.

### `literal-form-rule-in-doctrine` · `rule-is-two-branch-with-trigger-list` · `before-after-example-present`

Verbatim new doctrine block inserted into `skills/brainstorm/SKILL.md` §"The doctrine the skill loads" (between "Classification of each doubt" and "Event trail whenever it decides"):

```
**Literal form for schema/path claims.** Before closing `assumptions[]`, re-read every assumption that names one of the following — and either rewrite it in unambiguous literal form or mark the ambiguity explicitly; never leave it dotted and silent:

- **Code path / file:** the path from the repo root, not "the runs step file".
- **YAML/JSON field:** the full nesting, parent named, sibling relationship stated.
- **Function/method:** `file.js#functionName`, or `path:line` when the line is the point.
- **CLI flag/subcommand:** the verbatim token as typed.
- **State key:** the full access path from the state root.

1. **Rewrite it in unambiguous literal form** — the form the implementer would type. A dotted shorthand (`a.b`) is never the literal form: it reads as a nested key, a top-level key literally named `a.b`, and a sibling entry the parent map happens to carry, all at once.
2. **Or mark the ambiguity explicitly**, in the assumption's own prose, when the owner's answers genuinely do not settle which reading is right: `— AMBIGUOUS: (a) <reading> | (b) <reading>; planner resolves at authoring`.

The flag is not a default escape hatch: a shorthand you can disambiguate yourself gets rewritten, not flagged. Flag only what an extra question would not answer.

*What this costs when skipped* — on `flow-step-summaries` the assumption closed with the shorthand `outputs.summary`, and the planner treated it informally as "the summary output of the step" rather than settling which of two literal shapes it named. Read one way, `outputs.summary` is a `summary` key nested inside the step's `outputs:` map; read the other, it is a top-level `summary:` field on the step, sibling to `outputs:`. Nothing flagged it; the planner picked one, and the collision surfaced only at implementation-time anti-drift. The literal form it should have carried: "a top-level `summary:` field on the step, sibling to `outputs:` — NOT a key inside the `outputs:` map, whose keys are outcome names ([ADR-006](../../docs/decisions/ADR-006-flow-values-as-data.md))."
```

Annotation of which lines carry which load-bearing part (paragraph order above, 1-indexed within the block):
- **Trigger list** — paragraph 1's lead sentence + the 5-item bullet list (Code path/file, YAML/JSON field, Function/method, CLI flag/subcommand, State key).
- **Branch 1 (rewrite literally)** — numbered item `1.`.
- **Branch 2 (mark ambiguity) + `AMBIGUOUS:` marker token** — numbered item `2.`, containing the literal token `— AMBIGUOUS: (a) <reading> | (b) <reading>; planner resolves at authoring`.
- **Anti-hedge clause** — the paragraph starting "The flag is not a default escape hatch…".
- **BEFORE phrasing** — inside the *What this costs when skipped* paragraph: the shorthand `outputs.summary`, informally treated by the planner as `"the summary output of the step"` — this exact quoted phrase is verified verbatim against the archived record ([`docs/archive/2026-07-24-flow-step-summaries/design.md:345`](../../archive/2026-07-24-flow-step-summaries/design.md)), replacing a round-1 fabricated literal that did not exist anywhere in the repo (round-1 fix — see §Unresolved Deviations).
- **AFTER phrasing** — same paragraph, final sentence: `"a top-level `summary:` field on the step, sibling to `outputs:` — NOT a key inside the `outputs:` map, whose keys are outcome names (ADR-006)."` Unchanged since round 1, confirmed correct against ADR-006 §Decision 2 and the archived YAML.
- **Why the ambiguity was real (ADR-006)** — same paragraph, the parenthetical citing `outputs:`'s keys being outcome names, linked with the id visible in the link text and the path `../../docs/decisions/ADR-006-flow-values-as-data.md` (depth relative to `skills/brainstorm/`, verified by the Links check below — note this path form resolves from `skills/brainstorm/`, NOT from this evidence file's own location).

### `dispatch-envelope-carries-the-rule`

Verbatim amended `> **Doctrine (the law you obey):**` blockquote paragraph from `skills/brainstorm/SKILL.md` §3 (only the appended sentence is new; shown in full for context):

```
> **Doctrine (the law you obey):** grill along the 4 axes — scope, end effect (observable state, not `success=true`), edges (empty/error/concurrency/volume; performance is a gate), and confrontation with the law (inviolable rule X / ADR-00N: respected or recorded exception?). Derive EVERY question from the ammunition — nothing generic. Use AskUserQuestion, one line of reasoning at a time, following the thread the answer resonates. Calibrate the depth by complexity (trivial/reversible → few; broad/irreversible/`architecture`/`contract` → deep); don't turn it into an endless interrogation. Critical doubt → interrogate, it becomes an acceptance criterion; small/reversible doubt → becomes a recorded assumption. Collision with an ADR/inviolable rule or scope beyond what was approved → record it as an escalation to the human (GOVERNANCE.md §1), don't decide on your own. Before closing `assumptions[]`, rewrite in unambiguous literal form every assumption naming one of the triggers listed above under "Literal form for schema/path claims", or mark it `— AMBIGUOUS: (a) <reading> | (b) <reading>; planner resolves at authoring` when you genuinely cannot settle it — never leave it dotted and silent.
```

Round-2 fix: the round-1 form enumerated 4 of the 5 canonical triggers ("a code path/YAML field/function/file", silently dropping CLI flag/subcommand and state key) and used a different placeholder token (`…` instead of `<reading>`). Both are fixed above — the enumeration is replaced by a pointer to the canonical trigger list ("the triggers listed above under..."), and the placeholder now matches the other two copies verbatim (`<reading>`).

### `flag-reaches-the-planner`

Verbatim amended assumptions bullet from `skills/brainstorm/SKILL.md` §4 (only the appended sentence is new; shown in full for context):

```
- **Passes the assumptions + acceptance criteria** on to spec generation ([aidakit:plan](../plan/SKILL.md)) as input. Each acceptance criterion carries a stable kebab-slug id (`- \`criterion-id\` — prose`, [agents/brainstorm.md](../../agents/brainstorm.md) output format), persisted into `.aidakit/tasks/<change-id>/brainstorm.json`'s `acceptance_criteria: [{ id, criterion }]` — the canonical shape [governance/acceptance/parse-criteria.js](../../governance/acceptance/parse-criteria.js) and `aidakit:acceptance-planner` (the goal-leash's author agent, invoked later in the flow at the `acceptance` step) consume. The id is the correlation key across plan revisions — a rewording of the prose does not orphan the manifest item that maps the criterion to its evidence. An assumption carrying the `AMBIGUOUS:` marker is persisted verbatim into the `assumptions[]` array of `.aidakit/tasks/<change-id>/brainstorm.json` (top-level, sibling to `acceptance_criteria[]`; no consumer reads it — prose only) and reaches `aidakit:plan` as input, where the planner MUST resolve it in `design.md` and name what settled it.
```

Round-2 fix: the round-1 form ("persisted verbatim — no new field — into `.aidakit/tasks/<change-id>/brainstorm.json`'s `assumptions[]`") presupposed that `assumptions[]` already existed in that file's schema — no writer, reader or test in `governance/` establishes that shape (only `acceptance_criteria[]` is documented; confirmed by the assumption-2 grep in §Baseline above and by [design.md](design.md) assumption 2). The fixed form states the shape literally true today (top-level, sibling to `acceptance_criteria[]`, no consumer reads it) instead of asserting a pre-existing field.

### `agent-emission-point-mirrors-the-rule`

Verbatim new paragraph in `agents/brainstorm.md` §Output format, inserted directly under the `**Assumptions (correct me if I'm wrong):**` bullet list, before `**Acceptance criteria (the observable effect of "done"):**`:

```
Before closing this list, re-read each assumption that names one of the triggers listed in [skills/brainstorm/SKILL.md](../skills/brainstorm/SKILL.md) §"The doctrine the skill loads" (trigger list, anti-hedge clause, before/after example): rewrite it in unambiguous literal form, or mark it `— AMBIGUOUS: (a) <reading> | (b) <reading>; planner resolves at authoring` when the owner's answers genuinely do not settle which reading is right — never leave it dotted and silent.
```

Minimality check: no trigger table duplicated, no example duplicated, no new `## Protocol` step, front-matter (`description`/`tools`/`model`) untouched, `brainstorm-event:` line and the JSON field structure of the templates untouched — only this one explanatory paragraph added at the same slot the existing kebab-slug-id note (line 95, unaltered) occupies for the criteria block.

Round-2 fix: the round-1 form enumerated 4 of the 5 canonical triggers ("a code path, a YAML/JSON field, a function/method, or a file", silently dropping CLI flag/subcommand and state key) — found independently by both `reviewer-quality` and `adr-reviewer`, and it also violated [design.md](design.md)'s own binding constraint (§"Does the agent need the mirror?" — "does NOT re-state the trigger table"): a partial duplication is neither a clean pointer nor a complete restatement. The fixed form drops the enumeration entirely and points at the canonical list in `SKILL.md`, matching what `design.md` actually mandates and removing the drift surface permanently.

### `full-flow-unregressed` (pin, half 1)

- **Round-2 re-run.** `git merge-base HEAD origin/main` → `ab037b7c20cb4ef01af739a0df5544910cad681d` — unchanged from round 1 (`HEAD` has not moved).
- `git diff --exit-code $(git merge-base HEAD origin/main) -- governance/` → **exit 0** (no output; `governance/` byte-identical to the merge-base). This is the authoritative pin per [tasks.md](tasks.md) §4's readiness-review correction (Unresolved Deviations #1).
- `git diff --exit-code origin/main -- governance/` → **exit 1** as of this round (57-line diff on `governance/__tests__/context-pack.test.mjs`). This is NOT a regression introduced by this change: `origin/main` advanced past the merge-base between round 1 and round 2 — commit `c2dbfbf` (`test(context-pack): make the dogfood block archive-proof (#42)`) landed on `main`, fixing the exact pre-existing `context-pack.test.mjs` failure this change's evidence documents as out-of-scope (§Baseline above). This branch has not merged that commit, so its `governance/` is still byte-identical to the merge-base (confirmed above) — only the moving `origin/main` ref has drifted. This is precisely the scenario Unresolved Deviations #1 anticipated when it named the merge-base form, not `origin/main` directly, as the pin that "stays correct if `main` moves before this change lands." No escalation: the divergence is in an unrelated sibling PR, not in anything this change touches, and the merge-base pin (the one the task instructions and the deviation note both name as authoritative) is green.
- `grep -n -A6 "id: brainstorm" governance/flows/full.yaml`:
  ```
  55:  - id: brainstorm
  56-    type: invoke
  57-    description: aidakit:brainstorm — default-on adversarial grill against the domain's ammunition, before spending spec tokens.
  58-    invoke_target: aidakit:brainstorm
  59-    input:
  60-      request: "${inputs.request}"
  61-      domain: "${context.classify.outcome}"
  ```
  (lines 62-67, not captured by `-A6` from the match line, contain `expects: [done, skipped]` / `on_result: {done: specify, skipped: specify}` — confirmed unchanged by direct read of the file.)

### `full-flow-unregressed` (pin, half 2)

- `node governance/__tests__/engine.test.mjs` → `264 passed, 0 failed`.
- Full suite after the edits (identical command as baseline):
  ```
  == governance/__tests__/agent-validator-paths.test.mjs
  31 passed, 0 failed
  == governance/__tests__/brainstorm-schema.test.mjs
  34 passed, 0 failed
  == governance/__tests__/candidates.test.mjs
  8 passed, 0 failed
  == governance/__tests__/check-acceptance.test.mjs
  31 passed, 0 failed
  == governance/__tests__/check-adr-format.test.mjs
  8 passed, 0 failed
  == governance/__tests__/check-bench.test.mjs
  20 passed, 0 failed
  == governance/__tests__/check-docs.test.mjs
  8 passed, 0 failed
  == governance/__tests__/check-links.test.mjs
  7 passed, 0 failed
  == governance/__tests__/context-pack.test.mjs
  129 passed, 12 failed
  == governance/__tests__/dna-freshness.test.mjs
  7 passed, 0 failed
  == governance/__tests__/dna-write.test.mjs
  14 passed, 0 failed
  == governance/__tests__/engine.test.mjs
  264 passed, 0 failed
  == governance/__tests__/ledger.test.mjs
  8 passed, 0 failed
  == governance/__tests__/plugin-version.test.mjs
  12 passed, 0 failed
  == governance/__tests__/pr-automation.test.mjs
  161 passed, 0 failed
  == governance/__tests__/prelude.test.mjs
  13 passed, 0 failed
  == governance/__tests__/progress-table.test.mjs
  30 passed, 0 failed
  == governance/__tests__/retry-memory.test.mjs
  87 passed, 0 failed
  == governance/__tests__/roadmap.test.mjs
  28 passed, 0 failed
  == governance/__tests__/step-summaries.test.mjs
  95 passed, 0 failed
  == governance/__tests__/yaml-min.test.mjs
  17 passed, 0 failed
  ```
  **Round-2 re-run (post review-bench fixes), same command:** every file's per-file tail is IDENTICAL to the table above, including `node governance/__tests__/engine.test.mjs` → `264 passed, 0 failed` and `node governance/__tests__/brainstorm-schema.test.mjs` → `34 passed, 0 failed` run standalone. `context-pack.test.mjs` is still `129 passed, 12 failed` — confirmed the same pre-existing baseline, unaffected by the round-2 doctrine-text fixes (none of which touch `governance/`).

  **Byte-identical per-file result to the §1 baseline.** In particular, `brainstorm-schema.test.mjs` stayed at `34 passed, 0 failed` — no regression on `brainstorm.json`'s shape. `context-pack.test.mjs`'s `129 passed, 12 failed` is the same pre-existing baseline condition, untouched by this change (neither `skills/brainstorm/` nor `agents/brainstorm.md` is read by `context-pack.test.mjs`; root cause named in the §1 baseline note above — `buildPackContent({ changeId: "context-pack-l1" })` reading a change directory archived by commit `ab037b7`). [proposal.md](proposal.md) §Exit criteria now carves this file out explicitly by name and cause, so the `0 failed` claim there is literally true.

### `no-mechanical-surface-added`

- `git diff --stat`:
  ```
   agents/brainstorm.md                                |  3 +++
   docs/roadmap/epics/EPIC-kit-discipline-hardening.md |  2 +-
   skills/brainstorm/SKILL.md                          | 20 ++++++++++++++++++--
   3 files changed, 22 insertions(+), 3 deletions(-)
  ```
- `git status --porcelain` (paired per the readiness-review correction below, since `--stat` alone never shows untracked files):
  ```
   M agents/brainstorm.md
   M docs/roadmap/epics/EPIC-kit-discipline-hardening.md
   M skills/brainstorm/SKILL.md
  ?? docs/features/brainstorm-schema-path-literal-lock/
  ```
- Together: exactly the 3 declared markdown surfaces + this change directory (untracked, evidence filled during execution). No `.js`, no `.mjs`, no `.yaml`, no file outside the declared scope.

### Links

- `node governance/validators/check-links.js docs/features/brainstorm-schema-path-literal-lock skills/brainstorm/SKILL.md agents/brainstorm.md docs/roadmap/epics/EPIC-kit-discipline-hardening.md`:
  ```
  {"validator":"aidakit.check-links","ok":true,"files_checked":8,"errors":[]}
  # check-links

  OK — 8 file(s), no broken links.
  ```
  Exit 0. This confirms [design.md](design.md) assumption 5: the `../../docs/decisions/ADR-006-flow-values-as-data.md` link (depth from `skills/brainstorm/`) resolves correctly, distinct from this change directory's `../../decisions/ADR-006-flow-values-as-data.md` form.

## Files Touched

| Path | Action | Note |
|---|---|---|
| `skills/brainstorm/SKILL.md` | modify | 3 hunks (doctrine block + before/after example between "Classification of each doubt" and "Event trail"; one sentence appended to §3's doctrine blockquote; one clause appended to §4's assumptions bullet) + appended `v0.4` provenance footer line below the existing `v0.3` line. |
| `agents/brainstorm.md` | modify | 1 hunk (one paragraph in `## Output format`, under the `**Assumptions**` bullet list) + appended `v0.4` provenance footer line below the existing `v0.3` line. |
| `docs/roadmap/epics/EPIC-kit-discipline-hardening.md` | modify | Feature 4's Aceite line annotated `**Entregue**` with delivery evidence, matching the sibling-epic convention (`retry-memory`, `roadmap-status-from-shared-git`, `flow-commit-plan-early` in `EPIC-flow-engine-leashes.md`); `changes:` tag left intact; language kept in Portuguese for that line per the file's own convention. |
| `docs/features/brainstorm-schema-path-literal-lock/{proposal,design,tasks,evidence}.md` | create | this change directory (evidence filled during execution, per this file). |
| `governance/**` | untouched | pinned against the merge-base — see `full-flow-unregressed` above. (As of round 2, the direct `origin/main` diff no longer agrees: an unrelated sibling PR (#42) landed on `main`; see Unresolved Deviations #1.) |
| `docs/decisions/**` | untouched | no ADR introduced, none superseded. |

## Unresolved Deviations

Two **deliberate, review-directed** substitutions from the readiness review — not silent drift:

1. **Pin command form.** [tasks.md](tasks.md) §4 and [proposal.md](proposal.md) §Exit criteria specify `git diff --exit-code origin/main -- governance/`, which diffs against a *moving* ref (a sibling PR landing on `main` mid-flow would fail this pin for reasons unrelated to this change). Per the readiness review's correction, I ran `git diff --exit-code $(git merge-base HEAD origin/main) -- governance/` as the primary pin and additionally recorded the original `origin/main` form for comparison. Both returned exit 0 at round-1 capture time because `HEAD`, `origin/main`, and the merge-base were the same commit (`ab037b7c20cb4ef01af739a0df5544910cad681d`) — no divergence yet, so both forms agreed. **Round-2 update: the predicted scenario materialized.** Between round 1 and round 2, commit `c2dbfbf` (`test(context-pack): make the dogfood block archive-proof (#42)`) landed on `origin/main` — an unrelated sibling PR that happens to fix the exact pre-existing `context-pack.test.mjs` failure this change's evidence carves out as out-of-scope. `git diff --exit-code origin/main -- governance/` now returns **exit 1** (this branch has not merged that commit). The merge-base form still returns **exit 0** (`git merge-base HEAD origin/main` is unchanged at `ab037b7...`, and this branch's `governance/` is still byte-identical to it) — confirming the merge-base form, not `origin/main`, is the pin that stays correct as `main` moves. See `full-flow-unregressed` (pin, half 1) above for the round-2 commands and output.
2. **`no-mechanical-surface-added` evidence.** [tasks.md](tasks.md) §4 relies on `git diff --stat` alone, which never shows untracked files — this change directory itself (`docs/features/brainstorm-schema-path-literal-lock/`) would be invisible, understating the very scope the criterion claims to prove. Per the readiness review's correction, I paired `git diff --stat` with `git status --porcelain` and recorded both above.

No other deviations. No doc outside the declared scope (`docs/guides/`, `docs/INDEX.md`, `docs/decisions/README.md`, `README.md`) was found to describe the brainstorm's assumption wording — none needed an update. No mechanical guard felt necessary at any point during this surgery; the two-branch prose rule was sufficient to satisfy all 8 acceptance criteria without touching `governance/**`.

### Round-1 review-bench fixes

`aidakit:adr-reviewer` and `aidakit:spec-reviewer` APPROVED round 1; `aidakit:reviewer-quality` rejected on 5 findings. All 5 were fixed in round 2 (see the round-2 commit diff): the invented `flow-step-summaries` quotation in `SKILL.md`'s before/after example, the partial (4/5) trigger-list echoes in both `SKILL.md` §3 and `agents/brainstorm.md` (now pointer-form, no enumeration), the `brainstorm.json` `assumptions[]` shape presupposition in `SKILL.md` §4, the `<reading>`/`…` marker-token inconsistency across the three copies (all now `<reading>`), and the `proposal.md` §Exit criteria suite claim (now carves out the pre-existing `context-pack.test.mjs` baseline by name and cause).

**Deliberate deferral — adr-reviewer Finding 1 NOT acted on.** The adr-reviewer's round-1 review additionally suggested that `skills/plan/SKILL.md` should also carry the planner's obligation to resolve an `AMBIGUOUS:` marker (the receiving side of the carry-forward clause this change adds to `skills/brainstorm/SKILL.md` §4). This is deliberately deferred, not silently dropped:
- Both base reviewers (`adr-reviewer`, `spec-reviewer`) APPROVED round 1 without requiring it — it was raised as a suggestion, not a blocking finding, and `reviewer-quality`'s round-1 rejection did not raise it either.
- Widening to `skills/plan/SKILL.md` would add a third doctrine file to a change [proposal.md](proposal.md) scoped as "3 hunks in SKILL.md, one in the agent, two footers" (non-goal 4 — "no redesign… each change is a minimal doctrine surgery, not an overhaul") and is out of the round-1-fix mandate, which named 5 specific findings and explicitly excluded widening scope beyond them.
- The planner already inherits the obligation functionally: `skills/brainstorm/SKILL.md` §4 states the marker "reaches `aidakit:plan` as input, where the planner MUST resolve it in `design.md` and name what settled it" — the receiving-side instruction exists, just not duplicated into `skills/plan/SKILL.md`'s own doctrine text.
- If a future reviewer wants the receiving side made explicit in `skills/plan/SKILL.md` too, that is traceable here as its own candidate debit (in the spirit of [EPIC-kit-discipline-hardening](../../roadmap/epics/EPIC-kit-discipline-hardening.md)'s existing sibling-debit pattern), not retrofitted into this change.

### Round-2 review-bench outcome and the 2-round cap

`aidakit:reviewer-quality` re-verified all 5 round-1 findings independently (byte-diff of the archived quotation, grep of both trigger-list echoes, grep of the marker token across all three copies, re-read of `parse-criteria.js` and the schema test for the `brainstorm.json` claim) and confirmed **4 of 5 genuinely fixed**. One `[important]` survived, and it was created by the round itself rather than by the original implementation: `evidence.md` correctly named the merge-base form as the authoritative pin and documented the `origin/main` drift, but [proposal.md](proposal.md) §Exit criteria and [tasks.md](tasks.md) §4 — the documents that state the *promise* — still carried the `origin/main` form, which returns exit 1 once `c2dbfbf` landed. The promise document had not been back-patched to match the evidence document.

`skills/review/SKILL.md` caps the adversarial bench at 2 rounds: a third is a human decision, not an automatic escalation. The owner was asked at the cap and chose "fix and verify deterministically, no round 3" — the finding was uncontested, the reviewer had specified the exact patch, and re-running a full quality agent on a doc-wording correction is not a proportionate spend.

Patch applied at the cap (by the flow orchestrator, not the implementer agent):
- [proposal.md](proposal.md) §Exit criteria — the pin is now stated in the `$(git merge-base HEAD origin/main)` form and explicitly labelled canonical, with the reason (`origin/main` is a moving ref) and the concrete instance that proved it (`c2dbfbf` / PR #42, mid-review).
- [tasks.md](tasks.md) §4 `full-flow-unregressed` (pin, half 1) — same substitution, cross-linked to this section.
- [proposal.md](proposal.md) §Exit criteria and §Baseline above — "stock `main`" is now qualified as "stock `main` **at the merge-base (`ab037b7`)**", and both note that upstream has since fixed `context-pack.test.mjs` via `c2dbfbf`, so a reader on a branch including it will see that file green.

Verification of the patch is deterministic and needs no agent: the claim is simply that the two promise documents quote the same command `evidence.md` records as authoritative. Confirmed — `grep -n "merge-base" proposal.md tasks.md evidence.md` shows the merge-base form in all three, and no bare `git diff --exit-code origin/main -- governance/` remains as a stated criterion. `check-links.js` re-run green over the change directory after the edits.

The residual `[nit]`s from round 2 are recorded and not acted on: (a) `skills/brainstorm/SKILL.md:88`'s pointer says "the triggers listed above" — a positional reference inside a blockquote framed as self-contained, where `agents/brainstorm.md:90` uses an explicit file+section pointer; (b) the same file's §4 sentence states the `assumptions[]` placement in the same declarative voice as the genuinely pre-existing `acceptance_criteria[]` fact, without flagging that this change is what specifies it. Both are wording polish on text the bench otherwise cleared; neither blocks.
