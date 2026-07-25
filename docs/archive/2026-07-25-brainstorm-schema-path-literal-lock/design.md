# Design — brainstorm-schema-path-literal-lock

**Change ID:** `brainstorm-schema-path-literal-lock`
**Date:** `2026-07-24`
**Owner:** `@chacal88`
**Phase / Package:** `n/a (skills/brainstorm + agents/brainstorm — doctrine-only surgery, no mechanical surface)`
**PRD:** `n/a`
**Tech Spec:** `n/a`

> **Estimation, risk matrix and surface-by-surface breakdown are waived** — this is a single-surface, doc-only change (two markdown files, four hunks, two footer lines), with no code, no schema and no flow edit. What is NOT waived and is below: the placement decision, the exact shape of the rule, the trigger definition, the carry-forward path, the agent-mirror decision, assumptions, dependencies, the file structure and rollback.

## Where the rule lands (and why not elsewhere)

**Decision: `skills/brainstorm/SKILL.md` §"The doctrine the skill loads", as a new block immediately AFTER *"Classification of each doubt"* (line 48) and BEFORE *"Event trail whenever it decides"* (line 50).**

Reasoning, in the file's own terms ([`skills/brainstorm/SKILL.md:12-19`](../../../skills/brainstorm/SKILL.md) — *"The doctrine belongs to the skill (loads and enforces it); the work of grilling belongs to the agent (executes in isolation)"*):

- *"Classification of each doubt"* is the paragraph that **manufactures assumptions** (small/reversible doubt → recorded assumption). The literal-form rule is a constraint on the artifact that paragraph produces, so it belongs adjacent to it and after it — the reader learns what an assumption is, then how it must be worded before it closes.
- Placing it before *"Event trail"* keeps the section's existing arc intact: default-on → calibration → the 4 axes → what a doubt becomes → **how it is written down** → what is emitted. Nothing above it moves; the diff is a pure insertion.

Rejected placements:

| Placement | Why rejected |
|---|---|
| `## Process` §4 (*"Integrate the verdict back"*) | Too late. §4 runs in the **skill's** context, after the agent has already returned. The rule says *"before closing `assumptions[]`"* — that instant lives inside the agent's isolated session. A rule stated only in §4 could at best trigger a re-open round, which is the very cost this change removes. §4 gets the *carry-forward* clause (below), not the rule. |
| `## Process` §3 only (dispatch envelope) | The envelope is the **transport**, not the law. The skill's own architecture puts the law in "The doctrine the skill loads" and echoes it into the envelope. Envelope-only would leave the doctrine section silent on a rule the skill enforces — and the roadmap acceptance asks for the rule in the SKILL.md, not in a prompt fragment. It gets a one-sentence echo (below), which is exactly how every other doctrine item is already carried. |
| `## Gates and guardrails` | That list restates the gates that **block a flow transition** (trail → phase gate; escalation → human). The literal-form rule blocks nothing; it shapes wording. Listing it there would misclassify it as a gate and invite an implementer to look for the missing enforcement. Recorded as [proposal.md](proposal.md) non-goal 5. |
| A new top-level `##` section | Bulk for a three-sentence rule; breaks the file's *"the skill is the doctrine + the dispatch"* two-part shape. |
| `agents/brainstorm.md` only | Inverts the architecture: the doctrine belongs to the skill. The agent gets a mirror pointing back, not the definition (see §"Does the agent need the mirror?"). |

## The exact shape of the rule

**Two branches, not a single mandate.** A single "always rewrite literally" mandate is unenforceable at brainstorm time: the brainstorm frequently *cannot* know which shape is right (the owner's answer may not settle it, and the resolution may legitimately belong to the design). Forcing a rewrite there would manufacture a confident-but-invented literal — strictly worse than the informal phrasing, because the planner would then trust it. So: rewrite when you can, flag when you cannot, and **never leave it dotted-and-silent** — the silence is the defect, not the shorthand.

Normative shape of the block the implementer inserts (wording may be tightened to match the file's voice; the four load-bearing parts — trigger list, branch 1, branch 2 + anti-hedge, before/after example — must all survive):

> **Literal form for schema/path claims.** Before closing `assumptions[]`, re-read every assumption that **names a code path, a YAML/JSON field, a function or method, a file, a CLI flag or a state key**. For each one, do exactly one of two things:
>
> 1. **Rewrite it in unambiguous literal form** — the form the implementer would type. A file → its path from the repo root. A field → its full nesting with the parent named and the sibling relationship stated. A function → `file.js#name`. A dotted shorthand is never the literal form: `a.b` reads as *nested `b` under `a`* AND as *a top-level key literally named `a.b`* AND as *the `b` the `a` map happens to carry*.
> 2. **Or mark the ambiguity explicitly**, in the assumption's own prose, when the owner's answers genuinely do not settle which reading is right: `— AMBIGUOUS: (a) <reading> | (b) <reading>; planner resolves at authoring`. The planner then MUST resolve it in `design.md` and name what settled it.
>
> The flag is **not a default escape hatch**: a shorthand you can disambiguate yourself gets rewritten, not flagged. Flag only what an extra question would not answer.
>
> *What this costs when skipped* — on `flow-step-summaries` the assumption closed as *"the summary template is declared under `outputs.summary` on the step"*. That reads as a `summary` key **nested inside** the step's `outputs:` map, and equally as a **top-level `summary:` field on the step, sibling to `outputs:`**. Nothing flagged it; the planner picked one, and the collision surfaced only at implementation-time anti-drift. The literal form it should have carried: *"a top-level `summary:` field on the step, sibling to `outputs:` — NOT a key inside the `outputs:` map, whose keys are outcome names ([ADR-006](../../decisions/ADR-006-flow-values-as-data.md))."*

### What counts as a trigger

Deliberately enumerated, not "anything technical" — an open-ended trigger makes the pass unbounded and the brainstorm re-reads everything. The list is closed and short:

| Trigger | Literal form means |
|---|---|
| **Code path / file** | path from the repo root (`governance/engine/steps/runs.js`), not "the runs step file" |
| **YAML / JSON field** | the full nesting, the parent named, and the sibling relationship stated (`a top-level X: on the step, sibling to outputs:`) |
| **Function / method** | `file.js#functionName`, or `path:line` when the line is the point |
| **CLI flag / subcommand** | the verbatim token as typed (`resume <flow_id> <outcome> key=value`) |
| **State key** | the full access path from the state root (`state.summaries[]`, not "the summaries") |

Everything else — behaviour, ordering, cost, scope — is out of the pass. Those are the 4 attack axes' business, unchanged.

### How the flag reaches the planner

**No new field, no new file.** The marker lives **inside the assumption's own prose**, so it rides the channel that already exists and that nothing else has to learn:

```
agent emits assumptions[] (agents/brainstorm.md §Output format)
  → verdict block returned to the skill
  → skill §4 persists verbatim into .aidakit/tasks/<change-id>/brainstorm.json → assumptions[]
  → skill §4 passes assumptions + criteria into aidakit:plan as input
  → planner resolves the marker in design.md and names what settled it
```

Consequences of choosing prose over a schema field, and why they are accepted:

- **Nothing mechanical reads it** — accepted, and deliberate ([proposal.md](proposal.md) non-goal 1/3). A sibling key like `assumptions_ambiguous[]` would touch [`governance/acceptance/parse-criteria.js`](../../../governance/acceptance/parse-criteria.js), `check-acceptance.js` and `governance/__tests__/brainstorm-schema.test.mjs` — all three read only `acceptance_criteria`, and all three stay untouched here. `brainstorm.json`'s shape is therefore unchanged; the suite cannot regress on it.
- **The marker is greppable anyway** (`AMBIGUOUS:` is a distinctive literal token), so a future mechanical successor — if [ADR-001](../../decisions/ADR-001-executable-dna-crystallization.md)'s `≥3×` trigger ever fires — has something to grep for without a schema migration. The prose choice does not paint the future gate into a corner.
- **A flagged assumption is by construction a small/reversible doubt**, so it does not become an acceptance criterion and does not enter the [ADR-010](../../decisions/ADR-010-acceptance-leash.md) leash. The existing classification rule is untouched.

The `skills/brainstorm/SKILL.md` §4 clause exists to make that chain explicit at the hand-off point — today §4 (line 79) spells out the criteria→`acceptance_criteria`→leash chain in detail and says nothing about what an assumption is allowed to carry.

## Does the agent need the mirror?

**Yes — one paragraph, in `## Output format` only.** Justification, since [proposal.md](proposal.md) commits to a surgical change:

1. **The emission point is in the agent, not the skill.** `assumptions[]` is produced by [`agents/brainstorm.md`](../../../agents/brainstorm.md) §Output format (lines 85-88). The incident happened at emission. A rule that never reaches the emitting surface is a rule the incident would have survived.
2. **`invoke_target` resolution is genuinely two-valued.** [`docs/guides/flows.md:13`](../../../docs/guides/flows.md) — *"the `invoke` step names a skill/subagent in `invoke_target:`"* — and [`governance/engine/steps/invoke.js:167`](../../../governance/engine/steps/invoke.js) renders the pause prompt as `Dispatch skill/agent: ${step.invoke_target}`. `full.yaml`'s `brainstorm` step declares `invoke_target: aidakit:brainstorm`, a name owned by **both** a skill and an agent. A driver that enters through the agent never sees the skill's §3 envelope. (The irony is on the nose: the change closing a name-ambiguity window is itself scoped by one.)
3. **Cost is one paragraph.** No frontmatter change, no new tool, no new protocol step, no change to the fenced output template — so the `## Output format` block that `parse-criteria.js` and `brainstorm-schema.test.mjs` care about (`acceptance_criteria`) is byte-untouched.

**Minimality constraints on the mirror (binding on the implementer):**

- It goes in `## Output format`, directly under the `**Assumptions (correct me if I'm wrong):**` explanation — the same slot where the criteria block already carries its own "each item carries a stable kebab-slug id" note (line 95). Symmetric with an existing precedent, not a new pattern.
- It **points at the skill as the source of truth** and restates only the two branches + the marker token. It does NOT re-state the trigger table, does NOT re-state the example — duplicating the full rule in two files creates the drift the kit's precedence rule ([`agents/brainstorm.md:12`](../../../agents/brainstorm.md)) exists to prevent.
- No new `## Protocol` step. Step 5 (*classify each doubt*) and step 6 (*converged? stop and return*) stay as-is; the rule is a wording constraint applied at return time, which is what `## Output format` governs.

## Assumptions

1. **The `full` flow's `brainstorm` step contract is untouched by construction.** `expects: [done, skipped]` → `on_result: {done: specify, skipped: specify}` ([`governance/flows/full.yaml:55-67`](../../../governance/flows/full.yaml)) references the invoke target by name only; changing the target's prose cannot alter the step's outcome vocabulary. Verified by the pin in [tasks.md](tasks.md) §4 (`git diff --exit-code` on `governance/`), not assumed silently.
2. **`brainstorm.json`'s `assumptions[]` is free prose with no consumer schema.** Grep of `governance/` shows every reader (`parse-criteria.js:118`, `check-acceptance.js`, `brainstorm-schema.test.mjs`) touching `acceptance_criteria` only. If the implementer's re-inspection finds any reader of `assumptions[]`, **STOP and escalate** — the prose-marker decision above depends on this.
3. **The skill (not the agent) writes `brainstorm.json`.** [`skills/brainstorm/SKILL.md:79`](../../../skills/brainstorm/SKILL.md) states the persistence; the agent is `Write`-less by [ADR-010](../../decisions/ADR-010-acceptance-leash.md) §Decision 1. The carry-forward clause is therefore correctly placed in the skill's §4, not in the agent.
4. **Footer convention is append, not rewrite.** Precedent: [`GOVERNANCE.md:58-59`](../../../GOVERNANCE.md) (two stacked provenance lines) and [`docs/features/README.md:18`](../README.md). The existing `<!-- aidakit v0.3 … -->` lines at [`skills/brainstorm/SKILL.md:108`](../../../skills/brainstorm/SKILL.md) and [`agents/brainstorm.md:118`](../../../agents/brainstorm.md) stay; a `v0.4` line is appended below each.
5. **`check-links.js` accepts the new inline links.** The rule's example cites [ADR-006](../../decisions/ADR-006-flow-values-as-data.md); from `skills/brainstorm/` that resolves as `../../docs/decisions/ADR-006-flow-values-as-data.md`. The implementer verifies with the validator rather than by eye ([tasks.md](tasks.md) §4), since the skill's existing links use a different depth (`../../DOCS.md`).

## Dependencies

- **Upstream:** none. No change is required to land first; nothing in the diff is read by the engine, a validator or a test.
- **Downstream:** none blocking. The three sibling debits of [EPIC-kit-discipline-hardening](../../roadmap/epics/EPIC-kit-discipline-hardening.md) are orthogonal by the epic's own non-goal 3 and must not be bundled.
- **Doctrine outranking this change:** [DOCS.md](../../../DOCS.md) (§2 rule 4 — links resolve with the ADR id visible in the link text; §5 — content language `en`, since `aidakit.config.yaml` declares no `language` field) and [GOVERNANCE.md](../../../GOVERNANCE.md) (§1 escalations; §8 anti-drift, the re-inspection that caught the original incident). If the new prose ever diverges from either, the doctrine wins and the skill is corrected — the precedence line already at [`skills/brainstorm/SKILL.md:10`](../../../skills/brainstorm/SKILL.md).

## File structure

| Path | Action | Detail |
|---|---|---|
| [`skills/brainstorm/SKILL.md`](../../../skills/brainstorm/SKILL.md) | **modify** | 3 hunks: (a) new **Literal form for schema/path claims** doctrine block between lines 48 and 50, including the before/after example; (b) one sentence appended to the `> **Doctrine (the law you obey):**` paragraph of §3 (line 73); (c) one clause appended to the assumptions bullet of §4 (line 79) naming the carry-forward path. + appended footer line at the tail (line 108). |
| [`agents/brainstorm.md`](../../../agents/brainstorm.md) | **modify** | 1 hunk: one paragraph in `## Output format`, under the assumptions block explanation, per §"Does the agent need the mirror?" minimality constraints. + appended footer line at the tail (line 118). |
| [`docs/roadmap/epics/EPIC-kit-discipline-hardening.md`](../../roadmap/epics/EPIC-kit-discipline-hardening.md) | **modify** | Feature 4's Aceite line (18-19) annotated as delivered, matching the sibling-epic convention. Bookkeeping only — status stays derived from disk ([ADR-002](../../decisions/ADR-002-roadmap-status-derived-from-disk.md)/[ADR-007](../../decisions/ADR-007-roadmap-status-from-shared-git.md)). |
| `docs/features/brainstorm-schema-path-literal-lock/{proposal,design,tasks,evidence}.md` | **create** | this change directory (evidence filled during execution). |
| `governance/**` | **untouched** | pinned by `git diff --exit-code origin/main -- governance/` in [tasks.md](tasks.md) §4. |
| `docs/decisions/**` | **untouched** | no ADR introduced, none superseded. |

**Evidence location is frozen at [`docs/features/brainstorm-schema-path-literal-lock/evidence.md`](evidence.md)** — every command output, the verbatim new doctrine block, and the before/after example land there and nowhere else.

## Alternatives considered

| Option | Pros | Cons | Cost to undo |
|---|---|---|---|
| **Mechanical guard now** — a `check-brainstorm-assumptions.js` grepping `assumptions[]` for dotted tokens without a literal restatement | Enforced, not remembered | Contradicts [ADR-001](../../decisions/ADR-001-executable-dna-crystallization.md): the class recurred **once**, not `≥3×`; a regex over free prose would fire on legitimate dotted text (`ADR-006`, `file.js`, `a.b` inside a quoted literal) and train people to phrase around the validator. Also outside the owner's declared surgical scope | medium |
| **New schema field** `assumptions: [{text, ambiguous}]` in `brainstorm.json` | Machine-readable flag | Touches `parse-criteria.js`, `check-acceptance.js` and `brainstorm-schema.test.mjs` for a marker nothing reads yet; the prose marker is greppable and costs zero mechanical surface | medium |
| **Single mandate** ("always rewrite literally") | One rule, no branch to judge | Unenforceable where the brainstorm genuinely cannot know; produces confident invented literals the planner then trusts — strictly worse than the shorthand it replaced | low |
| **Agent-only edit** (skip `skills/brainstorm/SKILL.md`) | Smallest possible diff; hits the emission point | Inverts the kit's architecture (doctrine belongs to the skill) and fails the roadmap acceptance verbatim, which names `skills/brainstorm/SKILL.md` | low |
| **Skill-only edit** (skip `agents/brainstorm.md`) | Truly one file | A direct `subagent_type: "aidakit:brainstorm"` dispatch — a legal resolution of `full.yaml`'s `invoke_target` — never sees the rule; the acceptance would hold on paper while the incident's exact path stays open | low |
| **Extend the rule to `acceptance_criteria[]` too** | Symmetric | Criteria are observable-effect promises already mapped to evidence paths by [ADR-010](../../decisions/ADR-010-acceptance-leash.md); a literal-path pass there duplicates the leash's job and widens a change the owner scoped as surgical | low |

## Rollback

`git revert` of the single commit. No state, no schema, no migration, no consumer contract: nothing in the diff is read by the engine, a validator or a test, and `brainstorm.json` files written under the rule are byte-shape-identical to those written before it (the marker is prose inside an existing string). A revert restores the pre-change doctrine with zero residue. An already-flagged assumption sitting in a `.aidakit/tasks/*/brainstorm.json` after a revert reads as ordinary prose — degraded, never broken.
