# Proposal — plan-gate-executor-internals-check

**Change ID:** `plan-gate-executor-internals-check`
**Date:** `2026-07-25`
**Owner:** `@chacal88`
**Phase / Package:** `skills/readiness + governance/validators — the plan gate verifies internals claims against live code`
**PRD:** `n/a`
**Tech Spec:** `n/a`

## Problem

A change plan authored by `aidakit:planner` routinely asserts things about the kit's own machinery: which executor writes which key into `context[step.id]`, what a persistence function returns, what a validator's exit codes mean. Nothing in the pipeline forces anyone to open the code and check.

It already cost us. In `flow-step-summaries`, the plan claimed `context[step.id].outcome` is "populated by every pause-emitting executor" ([design.md:92](../../archive/2026-07-24-flow-step-summaries/design.md), originating at [proposal.md:21](../../archive/2026-07-24-flow-step-summaries/proposal.md)). It is false: only `invoke.js` writes `.outcome`; `human-gate.js` writes `.choice` and `human-handoff.js` writes `.response`. The implementer discovered it mid-Task-4, root-caused it and fixed it — recorded in [evidence.md:8-18](../../archive/2026-07-24-flow-step-summaries/evidence.md).

The decisive detail — the one that shapes this whole change — is **what the false claim looked like**:

- It was **unanchored prose**, not a rotten `file.js:NN` anchor.
- The same `design.md` carries ~15 well-formed anchors, and the implementer **re-verified every one of them at setup**, reporting *"No correction needed at setup time"* ([evidence.md:8-18](../../archive/2026-07-24-flow-step-summaries/evidence.md)) — and still shipped the false sentence into GREEN.
- It was a **generalization** ("every pause-emitting executor") sitting on top of citations that were each individually correct.

Therefore the obvious pin — *"a validator that greps every `file.js:NN` in `design.md` and fails when the anchor is gone"* — **would have returned PASS at the exact moment the bug was written**. It guards a real but different risk (anchor rot, i.e. code moving after the plan is authored). It cannot be the primary gate; treating it as one would ship a gate that provably does not catch the incident that motivated it.

## Solution

Ship **both** surfaces, with the weight inverted relative to the roadmap line's framing (owner decision, 2026-07-25):

1. **PRIMARY — a semantic, mandatory step in [`skills/readiness/SKILL.md`](../../../skills/readiness/SKILL.md).** A new numbered step (`### 14`) requires the reviewer to re-derive from live code, with `Read`/`Grep`, every claim the package makes about an engine/executor/persistence/validator internal contract — explicitly including **prose generalizations that sum several individually-cited facts**, and explicitly including **unanchored** claims. A generalization that does not hold for every case it quantifies over is `Critical` / `Mandatory before implementation`. `readiness` owns it because it is the mandatory `invoke` gate in both flows ([full.yaml:166-180](../../../governance/flows/full.yaml), [fast.yaml:100-111](../../../governance/flows/fast.yaml)) with a mechanically parsed verdict — and because in this very incident the author's own self-check is what failed.

2. **SECONDARY — `governance/validators/check-design-claims.js`,** a new pure-Node zero-dep validator following the `check-acceptance.js` contract shape (JSON envelope on stdout, markdown report on stderr, exit `0`/`1`/`2`). It extracts every `<file>.<ext>:<NN>` / `:<NN>-<NN>` citation from the change's `design.md`/`proposal.md` and fails **only** when the anchor no longer resolves — file gone, or cited line past the file's current line count. Its header comment states in the first paragraph that it guards citation staleness, is **not** a truth-checker, and cites the `flow-step-summaries` incident so nobody re-invents "just grep the anchors" as if it sufficed.

3. **Wiring: standalone.** The validator is invoked with `Bash` from inside `aidakit:readiness`, under the `AIDAKIT_GOVERNANCE` contract of [ADR-004](../../decisions/ADR-004-aidakit-governance-env-contract.md) as broadened by [ADR-012](../../decisions/ADR-012-aidakit-governance-session-wide.md), with the same fail-closed guard idiom every other direct call site uses. **No new `runs:` step** in `full.yaml`/`fast.yaml` — precedent: `check-adr-format.js` is in no `runs:` block of any shipped flow today.

4. **Ghost-path correction.** `skills/planner/SKILL.md` — the path the roadmap's acceptance line names — does not exist. The feature's acceptance sub-bullet in [EPIC-kit-discipline-hardening](../../roadmap/epics/EPIC-kit-discipline-hardening.md) is corrected in this change to cite `skills/readiness/SKILL.md`, the skill that actually owns the gate.

5. **The decision is recorded: [ADR-014](../../decisions/ADR-014-readiness-owns-internals-claims-gate.md).** Both locked choices — `readiness` owns the primary semantic gate, and the mechanical check stays standalone — are boundary/responsibility decisions between doctrine surfaces, and [agents/doc-planner.md:47](../../../agents/doc-planner.md) makes an ADR **mandatory** for a change carrying the `architecture` flag (this one carries `architecture` + `contract`, see [classification.json](classification.json)); [agents/doc-planner.md:95](../../../agents/doc-planner.md) turns that into a manifest verification item and [:120](../../../agents/doc-planner.md) forbids waiving it silently, so the doc-leash ([check-doc-manifest.js](../../../governance/validators/check-doc-manifest.js), flow-wired at [full.yaml:396](../../../governance/flows/full.yaml) / [fast.yaml:213](../../../governance/flows/fast.yaml)) would have demanded it regardless. The ADR **records** the standalone wiring; it does not reverse it. Authored inside this plan package — the precedent is explicit: `docs/archive/2026-07-24-configurable-pr-automation/tasks.md:73` marks ADR-008 as *"já autorado neste pacote de plano (deliverable obrigatório)"* — and registered in [docs/decisions/README.md](../../decisions/README.md).

## Scope

- New file `governance/validators/check-design-claims.js` (validator, contract per [design.md](design.md) §The validator).
- New file `governance/__tests__/check-design-claims.test.mjs` (pure-Node table test, house idiom).
- Edit `skills/readiness/SKILL.md`: new mandatory `### 14`, a cross-reference bullet in `### 4. Review the design`, and the guarded `Bash` invocation of the validator.
- Edit `governance/__tests__/agent-validator-paths.test.mjs`: add `skills/readiness/SKILL.md` to `SOURCE_FILES` so the new call site's fail-closed guard is asserted byte-identical to the canonical literal.
- Edit `docs/roadmap/epics/EPIC-kit-discipline-hardening.md`: the ghost-path fix.
- New file `docs/decisions/ADR-014-readiness-owns-internals-claims-gate.md` — **already authored in this package** — plus its two registrations in `docs/decisions/README.md` (index row + thematic grouping).
- Edit the docs that count the readiness steps (`13` → `14`): **8 edit sites across 5 files**, enumerated with line numbers in [tasks.md](tasks.md) §7. (The grep returns 9 hits in 6 files; the 9th is [ADR-014](../../decisions/ADR-014-readiness-owns-internals-claims-gate.md) §Consequences stating the ripple in the past tense — a record, not a target.)
- **Spec delta: `n/a`, with condition.** [agents/doc-planner.md:46](../../../agents/doc-planner.md) makes a change spec-delta mandatory for the `contrato` flag, at `docs/features/<change-id>/specs/<capability>/spec.md` in kit mode — and "`docs/specs/` does not exist" is **not** a valid waiver, since that path is a WORKING artifact inside the change dir and only its promotion is a later human gate. **Condition for the `n/a`:** this change adds no capability spec because no kit validator has ever been spec'd (no change package, archived or in flight, carries a `specs/` directory), and the one new contract it introduces — the `check-design-claims.js` CLI / envelope / exit-code surface — is fully specified in [design.md](design.md) §Surface 2 and pinned mechanically by tests §C1-§C19 (argv, both failure rules, the waiver, the archive carve-out) plus §C17 (the exact envelope keys). A prose spec would restate the design with no added enforcement. `aidakit:doc-planner` owns the final call; this line exists so the `document` gate inherits the reasoning instead of improvising it.
- Edit the validator table in `docs/OVERVIEW.md` (§5, after the `check-links` row at line 123) — a separate edit; that table carries no step count.

## Non-goals

- **No new `runs:` step, in any flow.** Flow-wiring with `on_failure` routing would need a new ADR in the [ADR-010](../../decisions/ADR-010-acceptance-leash.md)/[ADR-011](../../decisions/ADR-011-runs-infra-error-routing.md) mould and would breach the epic's *"cirurgia mínima, não reforma"* Não-goal. If anchor rot ever bites in practice, flow-wiring is a separate debit.
- **No new mechanism.** [ADR-014](../../decisions/ADR-014-readiness-owns-internals-claims-gate.md) records *which surface owns the gate* and *that the validator stays standalone*; it invents no env contract, no flow-schema field and no new call-site idiom — it reuses ADR-004/ADR-012 verbatim as a new consumer.
- **No truth-checking in the validator.** It never decides whether a sentence about internals is *true* — that is semantic judgement and belongs to the `readiness` reviewer. The grep is structural and subject-blind.
- **No new citation format mandated on plan authors.** The validator checks the anchors that exist; it does not fail a design for citing without a line number, and it does not fail on a `basename.ext:NN` it cannot locate (reported as skipped, never as an error).
- **No redesign of `skills/readiness/SKILL.md`.** One appended numbered step, one cross-reference bullet; the 15-section output template is untouched and not renumbered.
- **Not bundled with the 3 sibling changes** of the epic (`review-usage-bench-manifest`, `step-summaries-type-gate-tests`, `brainstorm-schema-path-literal-lock`).
- **No DNA crystallization.** `deriveCandidates(threshold: 3)` returned empty for this lesson; the epic's Não-goal stands.

## Acceptance criteria

- `readiness-owns-the-gate` — `skills/readiness/SKILL.md` gains an explicit, numbered, mandatory step requiring that for every claim in `design.md`/`proposal.md` about an engine/executor/persistence/validator internal contract — INCLUDING prose generalizations that sum several individually-cited facts, not only individually line-anchored statements — the reviewer re-derives the claim from live code (Read/Grep) before approving; a generalization that does not hold for every case it covers is a Critical / Mandatory-before-implementation finding.
- `mechanical-validator-scoped-as-secondary` — `governance/validators/check-design-claims.js` exists, greps every `<file>.<ext>:<NN>` and `:<NN>-<NN>` citation in the change's `design.md`/`proposal.md`, and fails ONLY when the anchor no longer resolves (file gone, or cited line beyond the file's current line count) — following the `check-acceptance.js` contract shape (pure Node, zero-dep, JSON envelope `{validator, ok, errors[]}`, exit 0/1/2). Its header comment states explicitly that it guards citation staleness and is NOT a truth-checker.
- `not-flow-wired-by-default` — `check-design-claims.js` is invoked by `aidakit:readiness` via `Bash`; `git diff` shows NO new `runs:` step added to `governance/flows/full.yaml` or `governance/flows/fast.yaml`.
- `planner-naming-corrected` — No artifact of this change references the non-existent `skills/planner/SKILL.md`; the feature's acceptance sub-bullet in `docs/roadmap/epics/EPIC-kit-discipline-hardening.md` is updated to cite `skills/readiness/SKILL.md`.
- `new-file-citations-excluded` — The validator does not fail on a citation to a file the change itself is creating — proven by a test in which a `design.md` cites a path absent from disk but declared as to-be-created, and the validator exits 0.
- `precedent-incident-documented` — The change's `design.md` (or the header of `check-design-claims.js`, in the style of the CROSS-VALIDATION comment at `governance/validators/check-acceptance.js:28-34`) cites the real incident — `flow-step-summaries` `proposal.md:21`, `design.md:92`, `evidence.md:8-18` — as the reason the mechanical check is secondary, so nobody re-invents 'just grep the anchors' as if it sufficed.

## Exit criteria

- `node governance/__tests__/check-design-claims.test.mjs` → exit 0, every case green.
- `node governance/__tests__/agent-validator-paths.test.mjs` → exit 0 (grep sweep §3 stays empty ⇒ the new readiness call site uses `$AIDAKIT_GOVERNANCE`, never a relative `node governance/…`; §0 asserts the guard literal byte-identical).
- Full governance suite (`for t in governance/__tests__/*.test.mjs; do node "$t" || echo "FAIL $t"; done`) → 22 files, no `FAIL` line, no regression.
- `node governance/validators/check-design-claims.js docs/features/plan-gate-executor-internals-check` → exit 0 (dogfood: this package's own citations resolve).
- `node governance/validators/check-links.js` over **this change's own touched-file set** → exit 0 for every target: `docs/features/plan-gate-executor-internals-check` · `docs/decisions/ADR-014-readiness-owns-internals-claims-gate.md` · `docs/decisions/README.md` · `skills/readiness/SKILL.md` · `governance/__tests__/agent-validator-paths.test.mjs` · `docs/roadmap/epics/EPIC-kit-discipline-hardening.md` · `docs/OVERVIEW.md` · `PROCESS.md` · `docs/guides/existing-repo-flow.md` · `docs/guides/change-flow.md` · `docs/reference/skills.md` · `skills/catalog/INDEX.md`.
  - **Known, pre-existing, out of scope — do NOT chase these.** A repo-wide `node governance/validators/check-links.js .` exits **1** with **13 broken links across 8 files**, none of them in this change's surface: `docs/decisions/ADR-008-opt-in-autonomous-pr-merge.md:43`; `docs/decisions/ADR-010-acceptance-leash.md:23, :25, :33, :35, :39`; `docs/decisions/ADR-011-runs-infra-error-routing.md:13` (×2); `docs/roadmap/epics/EPIC-flow-engine-leashes.md:14`; `skills/context-pack/SKILL.md:26`; `skills/implement/SKILL.md:40`; `skills/learn/SKILL.md:23`; `skills/plan/SKILL.md:38`. Most are ADRs and skills linking into `docs/features/<change-id>/` for changes that have since moved to `docs/archive/` — a real debit (an ADR is WORM, so its links must point at durable paths), but repairing those 8 unrelated documents would breach the epic's *"cirurgia mínima, não reforma"* Não-goal. **Separate debit; this change must not widen to cover it, and must not be judged against a repo-wide green.**
- `node governance/validators/check-plugin-version.js` → exit 0 (no footer declares more than `plugin.json` 0.9.0).
- `git diff --stat governance/flows/full.yaml governance/flows/fast.yaml` → empty output. (This is the whole of `not-flow-wired-by-default`; the "no new ADR" half was removed after the owner ruled on 2026-07-25 that the decision must be recorded — one acceptance id carries one promise, so the leash's criterion→evidence map stays representable.)
- `node governance/validators/check-adr-format.js docs/decisions` → exit 0 with `adrs_checked: 14` (ADR-014 present and well-formed), and `docs/decisions/README.md` lists ADR-014 in both the index table and the thematic grouping.
- `grep -rn "skills/planner/SKILL.md" docs/roadmap skills governance agents commands` → no hits (the epic line is fixed; no kit surface names the ghost).
- `grep -rn "](.*skills/planner/SKILL\.md" .` → no hits (no artifact links to the ghost path as if it resolved), and `node governance/validators/check-links.js docs/roadmap/epics/EPIC-kit-discipline-hardening.md` → exit 0 after the fix. That second command is a **scoped** check on the one file this criterion edits — it is deliberately not a repo-wide `check-links` promise, which is unsatisfiable today (see the 13 pre-existing breakages above). **Scoping note:** the change package's own prose *does* name the string, exclusively to state that it does not exist and to record the correction (`design.md` §Why `readiness` owns it, the `planner-naming-corrected` criterion text, and the flow-authored `classification.json`, which quotes the original roadmap line verbatim and is not rewritten). Naming a path to declare it absent is the opposite of referencing it as real; the mechanical form of the criterion is "no link target, no invocation path, and zero occurrences on any kit surface".

## References

- [EPIC-kit-discipline-hardening](../../roadmap/epics/EPIC-kit-discipline-hardening.md) — the parent epic and its three Não-goals (minimal surgery, no DNA, no bundling).
- [`.aidakit/tasks/plan-gate-executor-internals-check/brainstorm.json`](../../../.aidakit/tasks/plan-gate-executor-internals-check/brainstorm.json) — the locked assumptions and the owner's three decisions of 2026-07-25.
- [classification.json](classification.json) — domain `product`, type `feature`, flags `architecture` + `contract`.
- [flow-step-summaries](../../archive/2026-07-24-flow-step-summaries/design.md) — the incident: the false generalization at `design.md:92`, its origin at `proposal.md:21`, the anchor re-check that passed at `evidence.md:8-18`.
- [ADR-004](../../decisions/ADR-004-aidakit-governance-env-contract.md) + [ADR-012](../../decisions/ADR-012-aidakit-governance-session-wide.md) — the `AIDAKIT_GOVERNANCE` call-site contract the new `Bash` invocation must honor (guard idiom, `$`-no-braces, double quotes).
- [ADR-010](../../decisions/ADR-010-acceptance-leash.md) — the weak-bar/leash doctrine whose validator contract shape (`check-acceptance.js`) this validator mirrors.
- [ADR-011](../../decisions/ADR-011-runs-infra-error-routing.md) — why flow-wiring a validator is an ADR-grade act, hence avoided here.
- [ADR-013](../../decisions/ADR-013-context-pack-per-change.md) — **conflicting record, named deliberately.** Its §Decision-6 (`:28`) and §Consequences (`:46`) assert that `$AIDAKIT_GOVERNANCE` reaches `runs`-step children only, never agent/skill Bash sessions, and that the `agent-validator-paths` gap "remains OPEN". That restates ADR-004's pre-amendment consequence and is stale — ADR-012 (accepted) broadened it session-wide and the work is archived at `docs/archive/2026-07-24-agent-validator-paths/`. This change rests on ADR-012; see [design.md](design.md) §Call-site contract.
- [ADR-014](../../decisions/ADR-014-readiness-owns-internals-claims-gate.md) — this change's own decision record: gate ownership + the deliberate standalone wiring.
