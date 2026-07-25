# Design — workflow-script-optimization

**Change ID:** `workflow-script-optimization`
**Date:** `2026-07-25`
**Owner:** `@chacal88`
**Phase / Package:** `n/a (audit-only, docs surface: docs/features/ + docs/roadmap/)`
**PRD:** `n/a`
**Tech Spec:** `n/a`

> Scope: the executable package of an **audit**. Everything below is either a file to author, a command to run, or a rule that constrains what may be written. No product code.

## 1. Where the audit artifacts live

The inventory is **one artifact in two files**, both under this change's directory:

| File | Content | Criterion it answers |
|---|---|---|
| `docs/features/workflow-script-optimization/inventory.md` | §1 method + reproduction commands · §2 four per-flow step tables · §3 dispatcher register (role + judgment shape) · §4 findings · §5 candidate register (admitted + rejected, with the roadmap Feature each admitted one became) | `inventory-artifact-exists`, `leash-pattern-preserved`, `escalation-gates-untouched` |
| `docs/features/workflow-script-optimization/dispatch-cost.md` | measured body size per `agents/*.md` × declared dispatch frequency, ranked; plus the skill-body sizes for the skill-only dispatchers | `agent-prompt-cost-measured` |

`inventory.md` is the entry point: it opens with its own scope/anti-scope and a link to `dispatch-cost.md`, and `dispatch-cost.md` links back — an index that sequences and points, per [DOCS.md](../../../DOCS.md) §2 rule 1. The split exists only because the content overflows §5's ~4-page ceiling (78 step rows across the four flows + ~25 dispatcher rows + 13 cost rows + findings); it is **not** a thematic split, and neither file is complete without the other. State that relationship in both headers so a reviewer does not read the split as a dodge of criterion 3's word "includes".

**Placement decision: the change directory, not `docs/knowledge/`.** Walking [DOCS.md](../../../DOCS.md) §3's tree in order, the first "yes" is step 3 — an artifact of ONE in-flight change. Three reasons this is the right stop, and not step 7:

1. **It is a dated measurement of a moving substrate.** [DOCS.md](../../../DOCS.md) §5's hygiene rule — "manual snapshots die: project status is not a hand-edited doc" — is written against exactly this shape. A flows×steps×agents table is true at a commit; six merged changes later it lies, and nothing invalidates it. Under `docs/knowledge/` it would be a permanent rot surface; under `docs/features/` it is dated by construction and archived with its own change.
2. **[ADR-003](../../decisions/ADR-003-shared-knowledge-in-docs.md)'s boundary excludes it.** The folder's declared scope is conventions, glossary, gotchas and business context — "a decision with alternatives → ADR, a how-to → guide, and only what is *neither*". A measurement is a fourth thing. ADR-003's own review trigger names the failure being avoided: knowledge files "routinely holding content that should have been an ADR or a guide (the boundary isn't landing)". `docs/knowledge/` also does not exist in this repo yet, so choosing it would additionally mean deploying and indexing a folder for one snapshot.
3. **[ADR-014](../../decisions/ADR-014-archive-aware-link-resolution.md) removes the only real cost of the change dir.** The objection to the WORKING location is inbound-link rot after the [DOCS.md](../../../DOCS.md) §4 promotion. ADR-014 resolves a citation of `docs/features/<id>/…` against `docs/archive/<date>-<id>/` via the §2 rule 7 single key, so the roadmap Features registered by this change keep pointing at the inventory forever without anyone editing them.

The audit's **durable** residue is therefore not the snapshot — it is the roadmap Feature set (§7), which lives in the epics and outlives the archive move.

## 2. The step inventory — schema and derivation

One table per flow, four tables, ordered by **step count descending** — `full` (36), `fast` (23), `design` (10), `docs-onboarding` (9), measured by `grep -cE '^\s+- id:' governance/flows/<f>.yaml`. The order is a mechanical property of the files and **encodes no priority**: the owner's `all-4-equal-priority` decision (`brainstorm.json`, axis `scope-flows`) is honoured by giving every flow the identical column set, the identical judgment pass and the identical candidate treatment. Any ordering is arbitrary against that decision; this one is at least reproducible from a command. Nothing in the audit may describe a flow as mattering more, or be shortened for one flow and not another — `design.yaml` (5 `invoke`, 0 `runs`, 4 `human_gate`) gets the same depth as `full.yaml` despite being the smallest table.

| Column | Derivation |
|---|---|
| `#` | position in the YAML's `steps:` list |
| `id` | `- id:` value |
| `type` | the step's `type:` — one of the 7 in [governance/README.md](../../../governance/README.md) §"How a flow works" |
| `invoke_target` | `invoke_target:` value, or `—` for non-`invoke` steps |
| `dispatch tier` | `agent` / `skill` / `both` — resolved by file existence, not by guessing (see below) |
| `command` | for `runs`: the validator or shell command, abbreviated to its executable + script |
| `routing` | `on_success`/`on_failure`/`on_result` targets; a **back-edge** (target earlier in the list) marked as such, with `max_visits`/`on_max_visits` when declared |
| `judgment` | `load-bearing` / `checklist-shaped` / `n/a (deterministic)` — the §3 test |
| `candidate` | the candidate id from §5, or `—` |

Reproduction commands, to be pasted into `inventory.md` §1 and re-run at authoring time (all four verified against this tree at plan time):

```bash
# step count per flow
for f in full fast design docs-onboarding; do printf '%s: ' "$f"; grep -cE '^\s+- id:' governance/flows/$f.yaml; done
# → full: 36 · fast: 23 · design: 10 · docs-onboarding: 9

# type histogram per flow — the leading `/^  - id:/` guard is load-bearing:
# a bare `grep 'type:'` also catches the flow's `inputs:` block (`type: string`,
# `type: enum`) and inflates the count.
for f in full fast design docs-onboarding; do printf '%s: ' "$f"; \
  awk '/^  - id:/{f=1} f&&/^    type:/{print $2; f=0}' governance/flows/$f.yaml | sort | uniq -c | tr '\n' ' '; echo; done
# → full: 4 human_gate 15 invoke 15 runs 2 terminal
#   fast: 3 human_gate 9 invoke 9 runs 2 terminal
#   design: 4 human_gate 5 invoke 1 terminal
#   docs-onboarding: 1 human_gate 4 invoke 2 runs 2 terminal

# id/type/target/cap skeleton, in declaration order
grep -nE '^\s+- id:|^\s+type:|^\s+invoke_target:|^\s+max_visits:|^\s+on_max_visits:' governance/flows/full.yaml

# dispatch tier: agent, skill, or both (a target can be both — `brainstorm` is)
for t in <target-basename …>; do a=""; s=""; [ -f agents/$t.md ] && a=agent; [ -f skills/$t/SKILL.md ] && s=skill; \
  printf '%-22s %s %s\n' "$t" "$a" "$s"; done
```

Each table's header line states the flow file and the commit the table was measured at (`git rev-parse --short HEAD`), because that is what makes a stale table detectable later.

## 3. The dispatcher register and the judgment test

### 3a. Two-tier dispatch discovery (the naive count is wrong)

`grep invoke_target governance/flows/*.yaml` finds **first-order** dispatch only. Measured on this tree, the four flows name 19 distinct targets, and only 5 of the 13 `agents/*.md` are among them: `aidakit:orchestrator`, `aidakit:brainstorm`, `aidakit:spec-reviewer`, `aidakit:doc-planner`, `aidakit:acceptance-planner`. The remaining 8 — `adr-reviewer`, `planner`, `implementer`, `research`, `reviewer-architecture`, `reviewer-quality`, `reviewer-security`, `tester` — never appear in a flow YAML. They reach the wire as **second-order** dispatches, fired from inside a skill: the review bench ([skills/review/SKILL.md](../../../skills/review/SKILL.md) step 5's role×flag matrix, six roles, all in one message) and the `implement` per-surface fan-out ([governance/README.md](../../../governance/README.md) §"Real parallelism").

The register therefore has two sections, and the second-order one derives its frequency from the **declared role set**, not from a grep:

- Authoritative source for the review bench's roles: the step-5 matrix plus `governance/validators/check-bench.js`'s `__manifest__` contract (the manifest is the round's declared role list, and `role-missing`/`consensus-mismatch` are what make it honest).
- **Forbidden derivation:** counting grep hits for `aidakit:<agent>` over the prose surfaces. Those hits are mentions, not dispatches — `grep -roE 'aidakit:planner' skills/ commands/ | wc -l` → **25** occurrences, against **0** dispatches by any shipped flow. Any frequency number in `dispatch-cost.md` that came from a mention count is a fabricated number under criterion `no-fabricated-token-numbers`.
- **Quote the counting mode with the number, always.** The same agent scores 25, 24 or 23 depending on the flags, and none of them is "wrong" — they answer different questions: `-roE … | wc -l` counts *occurrences* (25 over `skills/ commands/`, 24 over `skills/` alone), while `grep -rc` counts *lines containing a match* per file (23 summed over `skills/`). Round 1 of this plan printed `25` next to a stated command (`grep -c` over `skills/`) that returns 23 — a number and a command that disagree is the defect, independently of which one is right. Every table cell in `inventory.md` and `dispatch-cost.md` therefore carries the exact command **including its flags and its path arguments**.
- Skill-only dispatchers (`identify-domain`, `plan`, `readiness`, `implement`, `review`, `test`, `learn`, `ship`, `merge`, `docs`, `design-business`, `design-modeling`, `design-architecture`, `design-implementation`) are inventoried in the same table with tier `skill`, per brainstorm assumption 5 — the audit covers every LLM dispatch a flow triggers, not only `agents/*.md`.

### 3b. The judgment test — four questions, all four must be YES for `checklist-shaped`

A dispatcher (or a single step) is **checklist-shaped** only if:

1. **Is the verdict a predicate over the disk or over a declared list?** File/section exists, format matches, count equals N, path resolves, id is declared. If deciding needs the *content's meaning* — is this design coherent, is this risk real, is this test brittle — it is load-bearing.
2. **Can the predicate be stated without an example set?** A rule that can only be conveyed by showing three good and three bad cases is a judgment, not a check.
3. **Is the failure message actionable without a diagnosis?** A leash says "item 4 of the list is missing"; a reviewer says "this is the wrong owner for this behavior". If the useful output is a diagnosis, the LLM is buying the diagnosis.
4. **Would a deterministic implementation be a weak bar in [ADR-010](../../decisions/ADR-010-acceptance-leash.md) §Decision-2's sense** — existence/format/count, *not* re-execution and not re-derivation of meaning? A "script" that would have to re-run the suite or re-read the diff semantically is not a conversion; it is a rewrite of the judgment.

Anything failing a question is `load-bearing` and out of bounds for a conversion candidate. The five dispatchers the kit deliberately keeps as judgment (brainstorm, `critic`/`spec-reviewer`, the review bench, `implement`, `learn` — brainstorm assumption 4) are expected to fail question 1 outright; the register records *which* question each one fails, because that is the reusable part.

### 3c. Candidate admission — five slots, all filled or it is rejected

Every entry in `inventory.md` §5 fills all five, in this order:

1. **Locus** — flow file + step id, or the dispatcher name.
2. **Predicate** — the deterministic check, stated as something a validator could implement (name the disk artifact and the property).
3. **Judgment lost** — what the LLM currently produces that the predicate does not. Empty is not an allowed answer; if truly nothing is lost, say so explicitly and say why the step existed.
4. **Precedent mirrored** — doc-leash ([DOCS.md](../../../DOCS.md) §6), acceptance-leash ([ADR-010](../../decisions/ADR-010-acceptance-leash.md)), or the bench leash (`check-bench.js`). A candidate that mirrors none of the three is rejected: the kit has exactly three proven leash shapes and inventing a fourth is a decision, not an audit finding.
5. **ADR the follow-up needs** — the decision the conversion locks (criterion `flow-shape-change-gets-adr`). "None" is not admissible for a flow-shape change.

A candidate missing a slot is written into the **rejected** table with the slot that failed. The rejected table is a deliverable, not a scrap: it is the evidence that `leash-pattern-preserved` was applied rather than asserted.

**Hard bound, checked per candidate:** no candidate may touch `merge_route`/`auto_merge`/`merge`, `specify_escalation`, `acceptance_escalation`, `pre_apply`, `parked`, `gate_migration`, `gate1`–`gate4`, or any `max_visits`/`on_max_visits` wiring — the human escalations of [GOVERNANCE.md](../../../GOVERNANCE.md) §1 and the caps [ADR-010](../../decisions/ADR-010-acceptance-leash.md) §Decision-4 requires from day one (criterion `escalation-gates-untouched`). `inventory.md` §5 states this bound above the tables and each candidate row carries a `touches escalation: no` column, so the check is visible per row rather than promised once.

## 4. The cost table — metric, tiers, and what the ranking does not claim

`dispatch-cost.md` ranks by **`body_bytes × happy_path_dispatches`**, and says so in its header, because a ranking whose metric is implicit is an intuition with a table around it.

**Body size** — `wc -c -w agents/*.md`, pasted verbatim (13 files; 139797 bytes / 20800 words in total at plan time). Bytes and words are both recorded; neither is converted to tokens. A bytes→tokens conversion factor would be an estimate, and criterion `no-fabricated-token-numbers` forbids shipping it as a claim. The relationship between prompt bytes and billed tokens is instead read off the telemetry (§5), where it is measured.

**Frequency — three declared tiers, each with its own column. Every tier states its per-flow scope**, because criterion `agent-prompt-cost-measured` asks for "dispatch frequency per flow" and a single unqualified number silently averages four different graphs:

| Tier | Definition | Per-flow scope | Derivation |
|---|---|---|---|
| `static` | number of steps in the flow naming the target | **4 columns, one per flow** — the command is run once per YAML | `grep -oE 'invoke_target: [a-z:-]+' governance/flows/<f>.yaml \| sort \| uniq -c` (e.g. `aidakit:ship` = 2 in `full` — `dna_pr` and `pr` — and 1 in `fast`) |
| `happy-path` | dispatches on one clean traversal, no back-edge taken | **4 separate graph walks, one per flow, reported in 4 columns** — never one blended figure; a target absent from a flow is `0`, not blank | walk the `on_success`/`on_result` chain from the first step to `done` in each of `full.yaml`, `fast.yaml`, `design.yaml`, `docs-onboarding.yaml`; second-order roles counted from the bench's declared role set |
| `observed` | dispatches actually recorded for this run | **`full` only.** This run (`full-260725-642b02`) is a `full` traversal, so `fast`, `design` and `docs-onboarding` have **no observed data at all** — those cells read `n/a (not exercised by this run)`, never `0` and never an inferred value | one line per dispatch in `.aidakit/tasks/workflow-script-optimization/.telemetry.jsonl`, grouped by `subagent` (what `rollup.js`'s per-subagent table already computes) |

The `observed` hole is recorded, not filled: three of the four flows are unmeasured, and the honest consequence is that the ranking is empirically grounded for `full` and structurally grounded (`static`/`happy-path`) for the other three. Say that in the file's header rather than letting a reader infer that the four columns are comparable. This is the same standard §5 applies to a missing telemetry line — a hole is a finding, and interpolating across it would manufacture exactly the number criterion `no-fabricated-token-numbers` forbids. Measuring the other three flows would mean running three more real flows, which is a separate change, not a paragraph.

The ranking column is a **lower bound**, stated as such: back-edges multiply real dispatches (`critic: revise → specify`, `readiness: needs-revision → specify`, `check_*` → `implement`, `check_acceptance` → `acceptance`, each capped at 3 where [ADR-010](../../decisions/ADR-010-acceptance-leash.md) §Decision-4 and `engine-max-visits` put a cap), and a single `review_bench` visit fires up to six agents at once. Where `observed` exceeds `happy-path`, the table records the ratio rather than smoothing it — that gap is one of the audit's more interesting outputs.

**Skill bodies are measured too** (`wc -c -w skills/<name>/SKILL.md` for the 14 skill-only dispatchers) and reported in a second table. They are *not* merged into the agent ranking: a skill's body is loaded into the caller's own context, whereas an agent's body starts a fresh isolated context, and averaging the two would produce a number that means nothing. State that distinction in the file.

## 5. Telemetry — where it lives, what the rollup drops, how it lands

**Persistence path, verified end to end on this tree:**

1. `governance/cli.js resume <flow_id> <outcome> [--tokens-cache-read=N --tokens-cache-creation=N --tokens-output=N --duration-ms=N --pack-rebuilt=bool]` — the kwargs are optional and additive ([ADR-013](../../decisions/ADR-013-context-pack-per-change.md) §Consequences, last bullet).
2. `governance/engine/steps/invoke.js`'s resume handler forwards them to `appendTelemetry` in [governance/telemetry/append.js](../../../governance/telemetry/append.js), which appends **one JSON line** per dispatch to `.aidakit/tasks/<change_id>/.telemetry.jsonl` — record shape `{ts, subagent, cache_creation, cache_read, output_tokens, pack_size, duration_ms, pack_rebuilt}`. `change_id` passes `assertValidChangeId` before any `join()`.
3. `governance/telemetry/rollup.js --change-id <id>` parses the JSONL, computes the rollup, and **idempotently** rewrites the `## Context-pack telemetry rollup` section of `docs/features/<id>/evidence.md` — from its heading to the next `## ` heading, appending the section at EOF when absent.
4. The JSONL is gitignored (`.aidakit/` is ignored wholesale), so the rollup section is the only durable record. [ADR-013](../../decisions/ADR-013-context-pack-per-change.md) §Decision-7 assigns the roll-up to `aidakit:learn`, which the `full` flow reaches at the `learn` step — after `hardening`, before `document`.

**The gap this design must work around.** `renderRollupSection` emits `Total dispatches`, `Mean pack_size`, `Sum cache_read`, `Sum cache_creation`, `Pack rebuilds` and a per-subagent table of `dispatches / mean cache_read / mean pack_size`. It never reads `output_tokens` or `duration_ms`, and `computeRollup` never aggregates them — the writer persists two fields the reader discards. Since the JSONL is ephemeral, running only `rollup.js` would land a rollup that cannot show the output-token split or the wall-clock, which is precisely the pair that makes this run's `brainstorm` line interesting (1377529 `cache_read` against 44539 `output` — a 31× ratio; 331959 ms).

**Capture protocol, therefore:**

- `evidence.md` carries a `## Raw dispatch telemetry (verbatim JSONL)` section — **its own `## ` heading, deliberately not nested under the rollup heading**, because `writeRollupIntoEvidence` overwrites everything between its heading and the next `## `. Anything placed inside that span is destroyed on the next rollup.
- The paste is captured with `cat .aidakit/tasks/workflow-script-optimization/.telemetry.jsonl`, one line per dispatch, unedited, with the command and the capture time above it.
- The paste is labelled **a prefix of the run, not a total** — dispatches continue after it (document, acceptance, pr…), so a "final" total is unobtainable by construction. Honest framing beats a number that is wrong by the time it is read; this is the same staleness class `check-evidence-stat.js` gates for the `git diff --stat` block, and the JSONL paste has no validator, so the discipline has to be in the wording.
- **Holes are recorded, not interpolated.** A dispatch resumed without the kwargs writes no line at all; a dispatch that wrote a zero line (this run's `classify`: `cache_read: 0`, `duration_ms: 0`) means the step consumed no new LLM tokens because the verdict was reused from the change package. Both are findings, and neither may be filled in with an estimate.

## 6. The findings contract

`inventory.md` §4, one entry per finding, fixed shape: **what · mechanical evidence (`path:line` or a command + its output) · leash family · routed to**. Three findings are already established and go in verbatim; the rest come from the pass itself.

**F1 — `classify` feeds its outcome where a domain belongs.** `governance/flows/full.yaml:61` declares `domain: "${context.classify.outcome}"` (`grep -n 'domain:' governance/flows/full.yaml` → `61`) while the `classify` step (lines 43-53, bounded by `grep -n '  - id: classify' / '  - id: brainstorm'` → 43 / 55) declares no `outputs:`, so `context.classify` holds only `{outcome, invoke_target}`. This run's own state file records the result: `.aidakit/flows/state/full-260725-642b02.json`, `step_history[4].output.input.domain: "success"`. Family: [ADR-006](../../decisions/ADR-006-flow-values-as-data.md) §Decision-2, the same gap `flow-request-vs-change-id` closed for `select`/`change_id`. Routed to `EPIC-flow-engine-leashes`. **Not fixed here** — a flow YAML edit is exactly what `audit-only-no-flow-edits` forbids, and the fail-closed resume semantics it needs are a contract decision.

**F2 — the telemetry rollup discards two persisted fields.** `output_tokens` and `duration_ms` are written by `append.js` and never read by `computeRollup`/`renderRollupSection` in `rollup.js`. Family: kit hygiene (same shape as the `context-pack-heading-*` entries — a reader that ignores what the writer emits). Routed to `EPIC-kit-discipline-hardening` — where F4 records that the two `context-pack-heading-*` Features already sitting there are both pre-existing **and** already shipped; do not join them with a third and do not touch them.

**F3 — package-carried state makes some `invoke` steps free on re-entry.** `classify` and `brainstorm` cost 0 new LLM tokens on this run: the classification and the brainstorm verdict were reused from the change package (`.aidakit/tasks/workflow-script-optimization/brainstorm.json`), and `classify`'s telemetry line is all zeros. Family: observation, not defect — but it is the strongest empirical argument in the audit that step *count* is the wrong optimization target, and it constrains the ranking in §4 (a step that is free on re-entry cannot be ranked by its static frequency). Routed to the cost table's method section rather than to a Feature.

**F4 — half of the roadmap's declared backlog describes work already shipped.** `derive-roadmap-status.js --root .` reports 6 orphans (declared change-id, no artifact dir on disk); **3 of the 6 are stale declarations of merged work**, verified against the live tree, not against the roadmap's prose:

- `context-pack-heading-alignment` **and** `context-pack-heading-drift` — two Features on `EPIC-kit-discipline-hardening` describing the *same* defect, both already fixed: `governance/context-pack/build.js` derives the summary from `## Why` with `## Problem` as the legacy fallback (`build.js:191-192`) and the DoD from `## Acceptance criteria` as the ADR-010 §Decision-3 primary source with `## Success criteria` as fallback (`build.js:196-219`). Shipped by `43201d5` ("fix(context-pack): derive summary/DoD from the headings the kit mandates (#47)"; `git log --oneline -3 -- governance/context-pack/build.js`).
- `check-links-code-span-skip` — already fixed: `governance/validators/check-links.js` blanks out inline code spans under CommonMark's run-of-N-backticks rule (`check-links.js:15,107-116`). Shipped by `ec2ce7e` ("fix(check-links): don't read a link illustrated in a code span as an address (#45)"; `git log --oneline -3 -- governance/validators/check-links.js`).

The other 3 orphans (`post-merge-sweep`, `engine-parallel-fate`, `review-bench-manifest-mechanical-writer`) were **not audited** — no claim is made about them either way. Family: roadmap hygiene ([ADR-002](../../decisions/ADR-002-roadmap-status-derived-from-disk.md)'s own review trigger names it: "the orphan rate staying high because epics are declared far ahead of any change" — here the cause is the inverse, a declaration that outlived its delivery). **Recorded, not fixed:** closing or de-duplicating those entries is roadmap surgery on lines this change did not author, and the audit's own bound (§8) allows edits under `docs/roadmap/**` only for the *additions* it registers. Routed to `EPIC-kit-discipline-hardening` as its own Feature.

Two operational consequences the implementer inherits: (a) never gloss the orphan count as "legitimate", "open" or "pending" — round 1 of this plan did, in 7 places, and 3 of the 6 falsified it; the deriver's word is "orphan" and it means declared-and-not-on-disk, nothing more; (b) when registering F2 on `EPIC-kit-discipline-hardening`, the two `context-pack-heading-*` entries sit right there — do not add a third, and do not "fix" them in passing.

## 7. Roadmap routing

**No new epic.** Three existing epics already declare goals that cover the three candidate families, and a sixth epic would fragment the very planning surface the audit is trying to make legible.

| Family | Epic | Why that epic's Goal already owns it |
|---|---|---|
| `invoke`→`runs` leash conversions; structured-outputs/contract gaps (F1) | [EPIC-flow-engine-leashes](../../roadmap/epics/EPIC-flow-engine-leashes.md) | Goal: close the points where the flow's leash depends on model behavior instead of verifiable mechanics. `flow-request-vs-change-id` — F1's sibling — already lives here. |
| agent/skill prompt trims; dispatch-cost reductions; **this change itself** | [EPIC-context-caching](../../roadmap/epics/EPIC-context-caching.md) | Goal: cut the token spend of re-read durable context per dispatch; [ADR-013](../../decisions/ADR-013-context-pack-per-change.md) names prefix-size reduction as the engineerable lever, and the epic gates L2 on data this audit is the first to produce. |
| kit-hygiene defects (F2) | [EPIC-kit-discipline-hardening](../../roadmap/epics/EPIC-kit-discipline-hardening.md) | Goal: mechanical hardening of the kit's own surfaces from post-mortem learnings; the `context-pack-heading-*` entries are the same reader-ignores-writer shape. |

**Feature-line grammar** — copy the shape the epics already use, in English:

```md
- **Feature:** <one-line intent> — changes: <kebab-case-change-id>
  - Acceptance: <the observable bar, naming the file(s) and the mechanical check>
```

Existing lines use the Portuguese label `Aceite:`; new lines use `Acceptance:` (no `language` field in `aidakit.config.yaml` → default `en`, [DOCS.md](../../../DOCS.md) §5). `governance/roadmap/roadmap.js` parses the `- **Feature:** … — changes: <id>` line for the change-id; the sub-bullet is free prose. **Never** a status field ([ADR-002](../../decisions/ADR-002-roadmap-status-derived-from-disk.md)). Do not reword or reformat any existing line — a byte-identical diff on the legacy entries is part of the delivery.

**Non-collision, checked before writing each id** — for every candidate change-id: absent from `docs/features/`, absent from `docs/archive/` (any date prefix), and absent from every `epics/EPIC-*.md`. Precedent: [review-usage-bench-manifest](../review-usage-bench-manifest/proposal.md) verified the same three at plan time.

**The `--strict` trap.** `derive-roadmap-status.js` pushes an orphan for every declared change-id whose derived status is `backlog`, and `--strict` turns orphans into exit 1. A freshly registered candidate is *by definition* declared-and-not-on-disk. The validation task runs the deriver **without** `--strict`; the baseline on this tree is already `ok=true`, exit 0, **6 orphans per the deriver** (of which 3 are stale declarations of shipped work — F4 — and 3 were not audited here; "orphan" is the deriver's word for declared-and-not-on-disk, and carries no verdict about whether the work is open). Asserting `--strict` here would manufacture a failure and invite someone to "fix" it by not registering the candidates — the opposite of criterion `audit-only-no-flow-edits`.

**`ROADMAP.md`** is **generated, never hand-edited** ([ADR-002](../../decisions/ADR-002-roadmap-status-derived-from-disk.md): "a **generated** Now/Next/Later snapshot … regenerated by `aidakit:roadmap`, never edited"). The writer is the skill's `regen` mode ([skills/roadmap/SKILL.md](../../../skills/roadmap/SKILL.md) §`regen`: "Run the deriver and write its view into `docs/roadmap/ROADMAP.md`"); `derive-roadmap-status.js` itself only reports, which is why "run the validator" is not the same instruction as "regenerate the view".

Two constraints on doing it, both learned the hard way — [review-usage-bench-manifest/evidence.md](../review-usage-bench-manifest/evidence.md) §Files Touched records both failures: (1) **rebase onto the current base first** — a regen from a stale base *demoted* two in-progress sibling changes back to backlog on merge; (2) **regenerate against the tree that ships**, never by copying another branch's file — that imported an entry whose epic declaration did not exist locally, making the artifact unreproducible from its own source. Then verify: every `` `id` → status `` line in the file appears in the deriver's output and every change the deriver returns appears in the file (0 missing), with no orphan beyond the 6 the deriver already reports on this tree plus the candidates this change registers. `git diff -- docs/roadmap/ROADMAP.md` should show only the expected additions; a deletion or a status downgrade on a line this change did not touch means the base was stale.

## 8. The audit-only invariant, proven mechanically

The invariant is not "the author remembered". It is a command in the validation section:

```bash
git diff HEAD --stat -- governance/ agents/ skills/ commands/ hooks/    # must print nothing
```

Run it before `pr`, and paste the empty output into `evidence.md` next to the full `git diff HEAD --stat`. `check-evidence-stat.js` independently gates the full stat block against the live diff, so a stale paste of either is caught for the first time by a validator rather than by a reviewer's fourth round.

Allowed paths for this change's entire diff: `docs/features/workflow-script-optimization/**` and `docs/roadmap/**`. Anything else is a scope escalation under [GOVERNANCE.md](../../../GOVERNANCE.md) §1 rule 3 — stop and report, do not widen.

## 9. Delivery constraints

- **Link hygiene under `check-links`.** `inventory.md` and `dispatch-cost.md` do not exist while the plan is being reviewed, so the plan artifacts reference them as **bare paths inside code spans**, never as `[text](path)` links — a markdown link to a not-yet-authored sibling fails `check-links.js .` on the plan-only diff. Keep them as code spans permanently and let the two new files carry the real links (to each other, and back to `proposal.md`/`design.md`). Same rule for anything under `.aidakit/`, which is gitignored and can never be a resolvable link target.
- **No doctrine footers on the audit artifacts.** Change-package artifacts and epic files do not carry `<!-- aidakit vX.Y … -->` footers (none of the existing ones do), and adding one would drag `check-plugin-version.js` into demanding a manifest bump for a docs-only change. Baseline: manifest `0.9.1`, highest footer `v0.9`, exit 0.
- **Evidence location is frozen** at `docs/features/workflow-script-optimization/evidence.md` — the path `rollup.js` computes from `--change-id` (`resolve(root, "docs", "features", changeId, "evidence.md")`) and the path `check-evidence-stat.js` reads. Neither is configurable; a different location silently breaks both.
- **Naming conventions.** Audit files: descriptive kebab-case, no version suffixes ([DOCS.md](../../../DOCS.md) §5). Candidate change-ids: kebab-case, verb-first where it reads naturally, matching the granularity of the existing epic entries (`context-pack-heading-drift`, `check-links-code-span-skip`) — one defect or one conversion per id, never a bundle.
- **Artifact accounting at commit time.** `.context-pack.md` (built by the `context_pack` flow phase) and `retry-history.json` (written by `append-retry-history.js` on any back-edge) are **not** gitignored and belong to the change package; leaving them untracked keeps them out of the [DOCS.md](../../../DOCS.md) §4 archive move. Both were caught untracked in [review-usage-bench-manifest/evidence.md](../review-usage-bench-manifest/evidence.md) §Files Touched. Stage by name ([GOVERNANCE.md](../../../GOVERNANCE.md) §4 — never `git add -A`).
- **Language.** Prose in English; identifiers, step ids, criterion ids, field names and validator names verbatim as they appear in the code.

## 10. Alternatives considered

| Option | Pros | Cons | Cost to undo |
|---|---|---|---|
| **Audit-only, inventory in the change dir, candidates as roadmap Features (chosen)** | Measurement precedes proposal; each conversion gets its own review round and ADR; the diff is provably inert | Two-step latency before any token is saved; the snapshot dates | low |
| Convert the top-N steps in this same change | Immediate saving | Contradicts the owner's `measure-first` and `audit-only` decisions; each conversion is a flow-shape change needing its own ADR (criterion `flow-shape-change-gets-adr`), so one PR would bundle N decisions into one review | high |
| Inventory in `docs/knowledge/flow-dispatch-inventory.md` | A durable home a future change finds by browsing | A dated snapshot in the DURABLE tier rots silently against [DOCS.md](../../../DOCS.md) §5; outside [ADR-003](../../decisions/ADR-003-shared-knowledge-in-docs.md)'s declared boundary; needs the folder deployed and indexed for one file; [ADR-014](../../decisions/ADR-014-archive-aware-link-resolution.md) already removes the link-rot argument for the change dir | medium |
| One single `inventory.md` with everything | Criterion 3's word "includes" is trivially satisfied | Overflows [DOCS.md](../../../DOCS.md) §5's ~4-page ceiling by a wide margin; the cost table is a different *kind* of content (measured numbers with a stated metric) from the step tables | low |
| A new versioned script (`governance/audit/*.js`) to produce the tables | Repeatable, testable measurement | It is code — it breaks `audit-only-no-flow-edits`'s spirit, needs tests and a review round of its own, and would be dead weight after one use. Shell one-liners pasted with their output are equally reproducible. If repeatable measurement proves worth having, that is a roadmap Feature | medium |
| A new epic for the audit's candidates | One place to read the whole cost programme | Three existing epics already declare these goals; a sixth fragments the roadmap the audit is trying to make legible | low |
| Estimate tokens from bytes with a conversion factor | A single comparable number per agent | Manufactures the exact class of number criterion `no-fabricated-token-numbers` forbids; the real relationship is measured in the telemetry | low |
| Skip the raw-JSONL paste and ship only `rollup.js`'s section | Fully mechanical, zero prose | Loses `output_tokens` and `duration_ms` (F2) permanently, since the JSONL is gitignored — and those two are what make this run's numbers legible | low |

## 11. Rollback

Docs-only. `git revert` of the single commit restores the tree exactly: the two audit files disappear, the epic files return to their prior bytes, `ROADMAP.md` returns to its committed copy. No migration, no state, no installed surface. The only durable side effect worth naming is that the reverted roadmap Features stop being declared, which `derive-roadmap-status.js` reports as fewer orphans — not as an error.

## 12. Estimate, effort and risk

```
Optimistic: 3 hours (the tables come out of the one-liners cleanly; few findings)
Likely: 5 hours (expected: the judgment column and the rejected-candidate table are the slow part)
Pessimistic: 8 hours (second-order frequency accounting and the roadmap/ROADMAP.md derivation fight back)

Recommendation: start from "Likely".
```

| Component | Hours | Type | Risk |
|---|---|---|---|
| `docs/features/workflow-script-optimization/inventory.md` §1-§2 — method + 4 step tables | 1.5 | Documentation | LOW (mechanical from the one-liners) |
| `inventory.md` §3 — dispatcher register + judgment column | 1.0 | Documentation | MEDIUM (the judgment call per dispatcher is the audit's substance) |
| `inventory.md` §4-§5 — findings + candidate/rejected registers | 1.0 | Documentation | MEDIUM (five-slot discipline; scope pressure to admit weak candidates) |
| `docs/features/workflow-script-optimization/dispatch-cost.md` — measured tables + ranking | 0.75 | Documentation | LOW (numbers are commands; the metric is frozen in §4) |
| `evidence.md` — rollup + verbatim JSONL + baselines | 0.5 | Documentation | MEDIUM (rollup section boundary; stat-block fixpoint) |
| `docs/roadmap/epics/*.md` + `ROADMAP.md` — registration | 0.75 | Documentation | MEDIUM (derivation must be verified on the shipping tree; two recorded prior failures) |
| Validation pass (7 commands + suite) | 0.5 | Testing | LOW |
| **Total** | **6.0** | | |

**Risks and mitigations**

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| A candidate that is really a judgment call gets admitted, and a later change scripts away a real review | MEDIUM | HIGH | The four-question test (§3b) plus the five-slot admission (§3c) with a **rejected** table; criterion `flow-shape-change-gets-adr` puts a second gate (an ADR) in front of any actual conversion |
| A number ships that no command reproduces | MEDIUM | HIGH | Every table states its command; the validation pass re-runs them against the shipped tree; bytes are never converted to tokens |
| `ROADMAP.md` is assembled from a stale base and demotes an in-progress change on merge | MEDIUM | MEDIUM | Rebase first, assemble from the tree's own committed copy, verify 0 orphans / 0 missing against the deriver on *that* tree ([review-usage-bench-manifest/evidence.md](../review-usage-bench-manifest/evidence.md) §Files Touched records both failure modes) |
| The telemetry paste is stale or presented as a total | MEDIUM | MEDIUM | Capture last, label it a prefix with the capture command and time, keep it outside the rollup heading's span |
| Scope creep into fixing F1 (a two-line YAML change, very tempting) | MEDIUM | HIGH | `git diff HEAD --stat -- governance/ agents/ skills/ commands/ hooks/` must print nothing, run as a validation task and pasted into evidence |
| The dispatcher register's second-order frequencies are derived from grep mention counts | LOW | HIGH | Explicitly forbidden in §3a with the counter-example (`grep -roE 'aidakit:planner' skills/ commands/ \| wc -l` → 25 occurrences, 0 dispatches) and the quote-the-counting-mode rule |
| A third duplicate of the `context-pack-heading-*` Feature is added, or the stale ones are "tidied" in passing | LOW | MEDIUM | Named in the proposal's Dependencies, in its Non-goals, and in F4 — those two lines are shipped work this change may not edit; it appends only |
| A number ships next to a command that does not produce it (round-1 defect: `full.yaml:63` for a line at `61`; `25` next to a `grep -c` that returns `23`) | MEDIUM | HIGH | Every citation is re-located by re-running its grep at authoring time, never copied from this plan; every count quotes its flags and path arguments (§3a) |

**Assumptions** — each one breaks the plan if reality differs; re-inspect before authoring ([GOVERNANCE.md](../../../GOVERNANCE.md) §8):

- The four flow files, 13 `agents/*.md` and 7 step types are as measured at plan time. Re-run the §2 commands; a changed count is a changed plan, not a rounding difference.
- `governance/telemetry/rollup.js` still owns the `## Context-pack telemetry rollup` heading and still drops `output_tokens`/`duration_ms`. If a sibling worktree fixed F2 before this lands, drop F2 and say so in `evidence.md` — do not keep a finding that reality closed.
- The three telemetry rows on disk survive to implementation time. They are under `.aidakit/` (gitignored, worktree-local); a worktree reset loses them, and the honest response is to record fewer dispatches, never to reconstruct them.
- `derive-roadmap-status.js`'s orphan semantics (backlog ⇒ orphan) are unchanged, so the validation task must stay non-`--strict`.
- No sibling worktree is editing the same three epic files. There are concurrent worktrees on this repo; check `git branch` and `docs/archive/` for jurisprudence before assembling `ROADMAP.md`.

**Dependencies** — `governance/telemetry/rollup.js` + `append.js` and the `resume` kwargs contract, all delivered by `context-pack-l1` ([ADR-013](../../decisions/ADR-013-context-pack-per-change.md), archived at `docs/archive/2026-07-24-context-pack-l1/`); `check-evidence-stat.js`, delivered by `review-usage-bench-manifest`; `derive-roadmap-status.js`, delivered by `roadmap-status-from-shared-git` ([ADR-007](../../decisions/ADR-007-roadmap-status-from-shared-git.md)).
