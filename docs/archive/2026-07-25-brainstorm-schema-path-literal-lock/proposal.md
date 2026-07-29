# Proposal — brainstorm-schema-path-literal-lock

**Change ID:** `brainstorm-schema-path-literal-lock`
**Date:** `2026-07-24`
**Owner:** `@chacal88`
**Phase / Package:** `n/a (skills/brainstorm + agents/brainstorm — doctrine-only surgery, no mechanical surface)`
**PRD:** `n/a`
**Tech Spec:** `n/a`

## Why

`aidakit:brainstorm` produces two artifacts that the whole downstream chain trusts: `acceptance_criteria[]` (leashed mechanically by [ADR-010](../../decisions/ADR-010-acceptance-leash.md)) and `assumptions[]` (leashed by nothing). An assumption is prose the planner reads at authoring time and turns into a schema, a path, a field name. When that prose is **informally dotted**, it carries two readings and nothing forces the brainstorm to notice.

That is exactly what happened on `flow-step-summaries`. The brainstorm closed with an assumption phrased `outputs.summary`. Read one way it is a `summary` key **nested inside** the step's `outputs:` map; read the other it is a **top-level `summary:` field** on the step, sibling to `outputs:`. Both readings are structurally plausible — `outputs:` is a real YAML field whose keys are outcome names ([ADR-006](../../decisions/ADR-006-flow-values-as-data.md) §Decision 2), so `outputs.summary` reads as legitimate dotted access. The ambiguity was never flagged, the planner authored one shape, and the collision only surfaced during the [GOVERNANCE.md §8](../../../GOVERNANCE.md) anti-drift re-inspection at implementation time. The resolution is recorded post-hoc in [`docs/archive/2026-07-24-flow-step-summaries/design.md`](../../archive/2026-07-24-flow-step-summaries/design.md) §Alternatives considered — *"The brainstorm's shorthand phrasing `outputs.summary` was treated as informal ('the summary output of the step'), confirmed with the owner before this revision."* That confirmation round is the cost this change buys down: a schema question re-opened after the plan was written, in the most expensive phase to re-open it.

The debit is registered as Feature 4 of [EPIC-kit-discipline-hardening](../../roadmap/epics/EPIC-kit-discipline-hardening.md) (the `flow-step-summaries` post-mortem parking lot). It did **not** meet the `deriveCandidates(threshold: 3)` bar for crystallization into executable DNA ([ADR-001](../../decisions/ADR-001-executable-dna-crystallization.md)) — the class recurred once, not three times — so the correct treatment today is a doctrine edit shipped as a normal change, not a validator. If the class recurs, ADR-001's trigger fires and it becomes a gate then.

## What Changes

- **[`skills/brainstorm/SKILL.md`](../../../skills/brainstorm/SKILL.md) §"The doctrine the skill loads"** — a new doctrine block, **Literal form for schema/path claims**, placed immediately after *"Classification of each doubt"* (the paragraph that manufactures assumptions) and before *"Event trail whenever it decides"*. It states the two-branch rule: before `assumptions[]` closes, every assumption naming a code path, a YAML/JSON field, a function or a file is either **rewritten in unambiguous literal form** or **explicitly marked ambiguous** for the planner to resolve at authoring. It carries the enumerated trigger list, the anti-hedge clause (the flag is not a default escape hatch), and one **before/after example** taken verbatim from the `flow-step-summaries` incident.
- **[`skills/brainstorm/SKILL.md`](../../../skills/brainstorm/SKILL.md) §3 (dispatch envelope)** — one sentence added to the `> **Doctrine (the law you obey):**` block, so the rule travels into the agent's isolated context on dispatch. The doctrine block IS the channel; a rule that exists only in the skill's prose never reaches the executor.
- **[`skills/brainstorm/SKILL.md`](../../../skills/brainstorm/SKILL.md) §4 (integrate the verdict back)** — the assumptions bullet gains a clause naming how a surviving ambiguity marker is carried: verbatim in the assumption's own prose → the verdict block → `.aidakit/tasks/<change-id>/brainstorm.json`'s `assumptions[]` → the `aidakit:plan` input, where the planner MUST resolve it in `design.md` and name what settled it.
- **[`agents/brainstorm.md`](../../../agents/brainstorm.md) §Output format** — a minimal mirror (one short paragraph under the assumptions block, where `assumptions[]` is actually emitted) pointing at the skill's rule as the source of truth. In scope because `invoke_target: aidakit:brainstorm` resolves to *"skill/agent"* ambiguously at dispatch ([`governance/engine/steps/invoke.js:167`](../../../governance/engine/steps/invoke.js), [`docs/guides/flows.md:13`](../../../docs/guides/flows.md)) — a direct `subagent_type: "aidakit:brainstorm"` dispatch never sees the skill's envelope, and the emission point is precisely where the incident happened. See [design.md](design.md) §"Does the agent need the mirror?".
- **Provenance footers** — one appended `<!-- aidakit vX.Y — … -->` line at the tail of each of the two edited files, following the repo convention (append, never rewrite the existing line; precedent [`GOVERNANCE.md:58-59`](../../../GOVERNANCE.md)).

## Non-goals (explicit)

1. **No mechanical guard.** No validator, no regression test, no engine or YAML change. The ADR-001 threshold (`≥3×`) has not fired for this class; a gate authored on a single occurrence is the subjective-judgment crystallization ADR-001 explicitly rejects. If a reviewer believes a guard is required for the acceptance to hold, that is an escalation to the human, not a scope widening.
2. **No change to `acceptance_criteria[]`.** The rule binds `assumptions[]` only. Acceptance criteria are observable-effect promises already leashed to evidence paths by [ADR-010](../../decisions/ADR-010-acceptance-leash.md); extending the literal-form pass to them is a separate question with a separate cost/benefit.
3. **No new field in `brainstorm.json`.** The ambiguity marker lives **inside the assumption's prose**, not in a sibling key. A schema field would touch [`governance/acceptance/parse-criteria.js`](../../../governance/acceptance/parse-criteria.js), `check-acceptance.js` and `brainstorm-schema.test.mjs` — mechanical surface this change refuses on purpose (non-goal 1).
4. **No redesign of the brainstorm skill or agent.** Per the epic's own non-goal — *"cada change é uma cirurgia mínima na doutrina, não uma reforma"*. Three hunks in SKILL.md, one in the agent, two footers.
5. **No new `## Gates and guardrails` bullet in SKILL.md.** That list restates the gates that **block a flow transition** (default-on, dispatch-not-grill, trail, ammunition, don't-implement, escalation). The literal-form rule blocks nothing — it shapes the wording of an artifact — so adding it there would misclassify it as a gate. Justified in [design.md](design.md) §"Where the rule lands".
6. **No retrofit of past changes.** Archived assumptions stay as written (WORM jurisprudence); the rule binds brainstorms from this PR onward.

## Affected capabilities

- Brainstorm doctrine (`skills/brainstorm/` + `agents/brainstorm.md`). No canonical capability spec exists in this repo (`docs/specs/` absent — same finding as [`runs-error-routing` §Affected capabilities](../../archive/2026-07-24-runs-error-routing/proposal.md)). **No spec delta.**

## Impact per surface

| Surface | Impact |
|---|---|
| `skills/` | 1 file: `brainstorm/SKILL.md` — 3 hunks (doctrine block + example; envelope sentence in §3; carry-forward clause in §4) + footer line |
| `agents/` | 1 file: `brainstorm.md` — 1 hunk (Output format mirror) + footer line |
| `governance/flows/` | **none** — `full.yaml` and `fast.yaml` untouched; the `brainstorm` step contract (`expects: [done, skipped]` → `specify`) is unchanged |
| `governance/engine/`, `governance/validators/`, `governance/acceptance/`, `governance/__tests__/` | **none** — no mechanical surface (non-goal 1) |
| `docs/decisions/` | **none** — no new ADR, no supersession (see §Recorded decisions) |
| `docs/roadmap/epics/EPIC-kit-discipline-hardening.md` | Aceite line 18-19 annotated as delivered, matching the convention used by sibling epics (bookkeeping only; status stays derived from disk per [ADR-002](../../decisions/ADR-002-roadmap-status-derived-from-disk.md)/[ADR-007](../../decisions/ADR-007-roadmap-status-from-shared-git.md)) |
| `docs/features/brainstorm-schema-path-literal-lock/` | this change directory |
| `commands/`, `hooks/`, `.claude-plugin/` | none |

## Dependencies

- None, structurally. The change is additive prose on two markdown surfaces; nothing it touches is read by a validator or the engine.
- Sibling debits from the same epic (`review-usage-bench-manifest`, `plan-gate-executor-internals-check`, `step-summaries-type-gate-tests`) are **orthogonal** and deliberately not bundled (epic non-goal 3) — no ordering constraint in either direction.

## Acceptance criteria

- `literal-form-rule-in-doctrine` — `skills/brainstorm/SKILL.md`'s "The doctrine the skill loads" section carries a named rule requiring that, before `assumptions[]` is closed, every assumption naming a code path, YAML/JSON field, function or file is either rewritten in unambiguous literal form or explicitly marked ambiguous for the planner.
- `rule-is-two-branch-with-trigger-list` — the rule reads as **two branches** (rewrite-literally OR flag-the-ambiguity), enumerates what counts as a trigger, and carries the anti-hedge clause stating the flag is not a default escape hatch for a shorthand the brainstorm could disambiguate itself.
- `before-after-example-present` — the doctrine carries at least one concrete before/after example drawn from the `flow-step-summaries` incident: the informal `outputs.summary` phrasing as it WAS, and the literal rewrite it BECAME (top-level `summary:` field on the step, sibling to `outputs:`).
- `flag-reaches-the-planner` — the doctrine states where a surviving ambiguity marker travels (the assumption's own prose → verdict block → `brainstorm.json` `assumptions[]` → `aidakit:plan` input) and that the planner resolves it at authoring in `design.md`; `skills/brainstorm/SKILL.md` §4 names that carry-forward path.
- `dispatch-envelope-carries-the-rule` — `skills/brainstorm/SKILL.md` §3's `**Doctrine (the law you obey):**` block — the text actually handed to the agent on dispatch — carries the rule, so it reaches the isolated context that emits the assumptions.
- `agent-emission-point-mirrors-the-rule` — `agents/brainstorm.md`'s `## Output format` section, where `assumptions[]` is emitted, carries the mirrored instruction pointing at the skill as the source of truth, so a direct `subagent_type: "aidakit:brainstorm"` dispatch inherits the rule without the skill's envelope.
- `full-flow-unregressed` — `governance/flows/full.yaml` is byte-identical to `main` and its `brainstorm` step still declares `expects: [done, skipped]` routing to `specify`; the full governance suite runs green with no step regressed.
- `no-mechanical-surface-added` — the change adds no validator, no test file, no engine/YAML/schema field: the diff touches only `skills/brainstorm/SKILL.md`, `agents/brainstorm.md`, the roadmap epic bookkeeping line, and this change directory.

## Exit criteria

- `node governance/validators/check-links.js docs/features/brainstorm-schema-path-literal-lock skills/brainstorm/SKILL.md agents/brainstorm.md docs/roadmap/epics/EPIC-kit-discipline-hardening.md` → exit 0.
- Full governance suite: `for f in governance/__tests__/*.test.mjs; do echo "== $f"; node "$f" 2>&1 | tail -1; done` → every file `0 failed` **except** the pre-existing `governance/__tests__/context-pack.test.mjs` baseline (`129 passed, 12 failed`), which is NOT a regression from this change — it reproduces identically on stock `main` **at the merge-base (`ab037b7`)**, caused by `buildPackContent({ changeId: "context-pack-l1" })` at `governance/__tests__/context-pack.test.mjs:713` reading a change directory that commit `ab037b7` archived to `docs/archive/2026-07-24-context-pack-l1/`. (Upstream has since fixed it: commit `c2dbfbf` / PR #42 landed on `main` during this change's review, so a reader running the suite on a branch that includes it will see `context-pack.test.mjs` green. This branch does not include it, and does not need to — the failure was never this change's.) Every other file, in particular `engine.test.mjs` and `brainstorm-schema.test.mjs` (the two that would notice a step-contract or `brainstorm.json`-shape regression), must be `0 failed`.
- `git diff --exit-code $(git merge-base HEAD origin/main) -- governance/` → exit 0 (no mechanical surface touched at all: flows, engine, validators, acceptance, tests). **The merge-base form is the canonical one** — `origin/main` is a moving ref, so a sibling PR landing on `main` mid-flow fails that form for reasons unrelated to this change. That is not hypothetical: it happened during this change's own review (commit `c2dbfbf`, PR #42), and `git diff --exit-code origin/main -- governance/` returns exit 1 from that point on while the merge-base form stays green. See [evidence.md](evidence.md) §Unresolved Deviations #1.
- `git diff --stat` matches the scope declared in §Impact per surface — 2 markdown surfaces + 1 roadmap bookkeeping line + this change directory, no stray edits.
- Evidence recorded in [evidence.md](evidence.md), including the verbatim quote of the new doctrine block and the before/after example (so a reviewer verifies the promise without re-reading the diff).

## Unblocks

- The next brainstorm on any schema-shaped change (`full` flow) closes its `assumptions[]` with either a literal shape or an explicit flag — the planner stops inheriting a coin-flip and the anti-drift re-inspection stops being the first place a schema disagreement surfaces.
- Recurrence becomes countable: an assumption that WAS flagged and still cost a round is a clean ledger entry. If the class recurs to `≥3×`, [ADR-001](../../decisions/ADR-001-executable-dna-crystallization.md)'s objective trigger fires and this doctrine has a ready-made mechanical successor (non-goal 1 becomes the next change, on evidence rather than on hunch).
- Closes Feature 4 of [EPIC-kit-discipline-hardening](../../roadmap/epics/EPIC-kit-discipline-hardening.md); three sibling debits remain.

## Recorded decisions and inherited open decisions

- Read the [decisions index](../../decisions/README.md).
  - [ADR-001](../../decisions/ADR-001-executable-dna-crystallization.md) — crystallization into executable DNA fires on the objective `≥3×` trigger, never on a subjective "worth it?". **Directly constrains this change:** the class recurred once, so the treatment is doctrine text now, gate later. Non-goal 1 is this ADR applied, not a shortcut around it.
  - [ADR-006](../../decisions/ADR-006-flow-values-as-data.md) — flow values are data; `outputs:` is an outcome-keyed map on the step. This is *why* the incident's phrasing was genuinely two-valued (a `summary` key under `outputs:` would have collided with the outcome-name namespace) and it is the source the literal rewrite in the example cites.
  - [ADR-010](../../decisions/ADR-010-acceptance-leash.md) — the acceptance-leash covers `acceptance_criteria[]` and deliberately left `assumptions[]` unleashed; it also keeps `aidakit:brainstorm` `Write`-less (§Decision 1). This change respects both boundaries: it adds no leash to assumptions and no tool to the agent — only wording discipline at the emission point. Non-goal 2 is scoped by this ADR.
  - [ADR-002](../../decisions/ADR-002-roadmap-status-derived-from-disk.md) / [ADR-007](../../decisions/ADR-007-roadmap-status-from-shared-git.md) — the roadmap epic edit is an Aceite annotation only; status stays derived, never hand-written.
- This change **introduces no ADR** and **supersedes none**. The doctrine edit is downstream of decisions already recorded ([DOCS.md](../../../DOCS.md) §2 — the skill is corrected by the doctrine, never the reverse; `skills/brainstorm/SKILL.md:10` states this precedence explicitly).
- No open-decisions log exists in this repo; nothing inherited.
