# Tasks — brainstorm-schema-path-literal-lock

**Change ID:** `brainstorm-schema-path-literal-lock`
**Date:** `2026-07-24`
**Owner:** `@chacal88`
**Phase / Package:** `n/a (skills/brainstorm + agents/brainstorm — doctrine-only surgery, no mechanical surface)`
**PRD:** `n/a`
**Tech Spec:** `n/a`

> Doctrine-only change. **Write no code**: no validator, no test file, no engine/YAML/schema edit ([proposal.md](proposal.md) non-goals 1 and 3). If any task below seems to require one, STOP and escalate (GOVERNANCE.md §1, escalation 3) — do not widen the scope in silence.
> Section 1 is order-dependent: assumption 2 of [design.md](design.md) is falsifiable and must be checked BEFORE the edits, because the prose-marker decision depends on it.

## 1. Setup — re-inspect before editing (GOVERNANCE.md §8)

- [x] Confirm the worktree is clean and on branch `claude/brainstorm-schema-path-literal-0122ef`; capture `git rev-parse HEAD` and `git log --oneline -1 origin/main` into [evidence.md](evidence.md) as the baseline.
- [x] Baseline the suite BEFORE touching anything: `for f in governance/__tests__/*.test.mjs; do echo "== $f"; node "$f" 2>&1 | tail -1; done` → record the per-file tail in [evidence.md](evidence.md). A file already red at baseline is a pre-existing condition to name, not to fix here.
- [x] **Validate [design.md](design.md) assumption 2** — `grep -rn "assumptions" governance/ | grep -v __tests__` and `grep -rn "assumptions" governance/__tests__/`. Expected: no consumer reads `brainstorm.json`'s `assumptions[]` (every hit is about `acceptance_criteria` or unrelated prose). Record the exact output. **If a real consumer exists, STOP and escalate** — the "marker lives in the prose" decision is void and the plan must be re-authored.
- [x] Re-read the live line numbers named in [design.md](design.md) §File structure (`skills/brainstorm/SKILL.md` 48/50/73/79/108, `agents/brainstorm.md` 85-95/118) — they were captured at plan time and may drift. Anchor the edits on the surrounding text, not on the numbers.

## 2. Surface Work — skills/brainstorm/SKILL.md

- [x] **Hunk (a) — the doctrine block.** Insert **Literal form for schema/path claims** into `## The doctrine the skill loads`, between the *"Classification of each doubt"* paragraph and *"Event trail whenever it decides"*. Use the normative shape in [design.md](design.md) §"The exact shape of the rule"; all four load-bearing parts must survive: the enumerated trigger list, branch 1 (rewrite literally), branch 2 (mark the ambiguity, with the `AMBIGUOUS:` marker token) + the anti-hedge clause, and the before/after example. Match the section's existing voice (bold lead-in, terse prose, no new `##` heading).
- [x] **The example is not optional.** It must show what the phrasing WAS (`outputs.summary` on `flow-step-summaries`) and what it BECAME (a top-level `summary:` field on the step, sibling to `outputs:`), and name why the ambiguity was real (the `outputs:` map is keyed by outcome names — [ADR-006](../../decisions/ADR-006-flow-values-as-data.md)). Link the ADR with its id visible in the link text (DOCS.md §2, rule 4) and with a path relative to `skills/brainstorm/` — `../../docs/decisions/ADR-006-flow-values-as-data.md`, NOT the `../../decisions/...` form used in this change directory.
- [x] **Hunk (b) — the dispatch envelope.** Append one sentence to the `> **Doctrine (the law you obey):**` blockquote paragraph of `### 3. Dispatch the aidakit:brainstorm agent`, so the rule travels into the isolated context. One sentence, in the paragraph's existing run-on register (it is a dense doctrine digest, not a bullet list) — restate the two branches and the marker token, not the trigger table.
- [x] **Hunk (c) — the carry-forward clause.** Append to the `**Passes the assumptions + acceptance criteria**` bullet of `### 4. Integrate the verdict back`: an assumption carrying the `AMBIGUOUS:` marker is persisted verbatim into `.aidakit/tasks/<change-id>/brainstorm.json`'s `assumptions[]` and reaches `aidakit:plan` as input, where the planner MUST resolve it in `design.md` and name what settled it. State explicitly that this adds **no new field** to `brainstorm.json`.
- [x] **Do NOT** add a bullet to `## Gates and guardrails` ([proposal.md](proposal.md) non-goal 5), do NOT touch `## Outputs`, `## Related`, `### 1`, `### 2`, `### 5`, or the front-matter `description:`.
- [x] Append the provenance footer line at the tail, below the existing `v0.3` line (append, never rewrite — precedent `GOVERNANCE.md:58-59`): `<!-- aidakit v0.4 — literal-form lock on schema/path assumptions (two-branch rule + AMBIGUOUS marker + before/after example), brainstorm-schema-path-literal-lock, 2026-07-24 -->`.

## 3. Surface Work — agents/brainstorm.md

- [x] **The mirror, one paragraph.** In `## Output format`, directly under the explanation that follows the `**Assumptions (correct me if I'm wrong):**` block (symmetric with the existing "stable kebab-slug id" note under the criteria block): state that before emitting `assumptions[]`, each assumption naming a code path / YAML field / function / file is either rewritten in unambiguous literal form or marked `— AMBIGUOUS: (a) … | (b) …; planner resolves at authoring`, and point at [`skills/brainstorm/SKILL.md`](../../../skills/brainstorm/SKILL.md) (relative form from `agents/`: `../skills/brainstorm/SKILL.md`) as the source of truth.
- [x] **Respect the minimality constraints** of [design.md](design.md) §"Does the agent need the mirror?": do NOT duplicate the trigger table, do NOT duplicate the example, do NOT add a `## Protocol` step, do NOT touch the front-matter (`description`, `tools`, `model`), do NOT alter the fenced verdict templates or the `brainstorm-event:` line.
- [x] Append the provenance footer line at the tail, below the existing `v0.3` line: `<!-- aidakit v0.4 — mirrors the skill's literal-form rule at the assumptions[] emission point, brainstorm-schema-path-literal-lock, 2026-07-24 -->`.

## 4. Validation

- [x] **`literal-form-rule-in-doctrine` + `rule-is-two-branch-with-trigger-list` + `before-after-example-present`** — paste the new doctrine block VERBATIM into [evidence.md](evidence.md) §Validation Outputs, and annotate which lines carry: the trigger list, branch 1, branch 2, the anti-hedge clause, the BEFORE phrasing, the AFTER phrasing. A reviewer must verify the three criteria without reading the diff.
- [x] **`dispatch-envelope-carries-the-rule`** — paste the amended §3 doctrine blockquote verbatim into [evidence.md](evidence.md).
- [x] **`flag-reaches-the-planner`** — paste the amended §4 assumptions bullet verbatim into [evidence.md](evidence.md).
- [x] **`agent-emission-point-mirrors-the-rule`** — paste the new `agents/brainstorm.md` paragraph verbatim into [evidence.md](evidence.md).
- [x] **`full-flow-unregressed`** (pin, half 1) — `git diff --exit-code $(git merge-base HEAD origin/main) -- governance/` → exit 0 (the merge-base form is canonical; `origin/main` is a moving ref — see [proposal.md](proposal.md) §Exit criteria and [evidence.md](evidence.md) §Unresolved Deviations #1). Also record `grep -n -A6 "id: brainstorm" governance/flows/full.yaml` showing `expects: [done, skipped]` and `on_result` routing to `specify`, unchanged.
- [x] **`full-flow-unregressed`** (pin, half 2) — `node governance/__tests__/engine.test.mjs` → `0 failed`, and the full suite `for f in governance/__tests__/*.test.mjs; do echo "== $f"; node "$f" 2>&1 | tail -1; done` → every file `0 failed`, identical to the §1 baseline. Call out `brainstorm-schema.test.mjs` explicitly (it is the one that would notice a `brainstorm.json`-shape regression).
- [x] **`no-mechanical-surface-added`** — `git diff --stat` → exactly `skills/brainstorm/SKILL.md`, `agents/brainstorm.md`, `docs/roadmap/epics/EPIC-kit-discipline-hardening.md`, plus this change directory. No `.js`, no `.mjs`, no `.yaml`, no new file outside `docs/features/brainstorm-schema-path-literal-lock/`. Record the output.
- [x] **Links** — `node governance/validators/check-links.js docs/features/brainstorm-schema-path-literal-lock skills/brainstorm/SKILL.md agents/brainstorm.md docs/roadmap/epics/EPIC-kit-discipline-hardening.md` → exit 0. (This is the check for [design.md](design.md) assumption 5 — the new ADR link's depth from `skills/brainstorm/` differs from this directory's.)

## 5. Documentation

- [x] Annotate Feature 4's Aceite line in [`docs/roadmap/epics/EPIC-kit-discipline-hardening.md`](../../roadmap/epics/EPIC-kit-discipline-hardening.md) as delivered, following the convention already used by sibling epics (inspect one first — the pattern is an annotation appended to the Aceite line, keeping the `changes:` tag intact). Bookkeeping only; status stays derived from disk ([ADR-002](../../decisions/ADR-002-roadmap-status-derived-from-disk.md)/[ADR-007](../../decisions/ADR-007-roadmap-status-from-shared-git.md)) — do not hand-write a status anywhere. The epic file is written in Portuguese: match the surrounding file's language for that one line, per the file's own convention.
- [x] `## Files Touched` filled in [evidence.md](evidence.md).
- [x] No other doc changes. `docs/guides/`, `docs/INDEX.md`, `docs/decisions/README.md`, `README.md` — none of them describe the brainstorm's assumption wording, so none needs an update. If the implementer finds one that does, add it and say so in [evidence.md](evidence.md) §Unresolved Deviations.

## 6. Cleanup

- [x] `## Unresolved Deviations` in [evidence.md](evidence.md) filled (or explicitly "None").
- [x] No stray files outside the declared scope; no `.aidakit/` artifact committed (gitignored).
- [x] Do NOT bump `.claude-plugin/plugin.json` (release-commit convention). Do NOT author an ADR — this change introduces none and supersedes none ([proposal.md](proposal.md) §Recorded decisions). Do NOT add a validator or a test, even if it "would only take a minute" — that is [proposal.md](proposal.md) non-goal 1 and an escalation if genuinely needed.
- [x] Do NOT commit here — the flow's `commit_plan` / ship steps own that; the PR merge is the human's (GOVERNANCE.md §1).
