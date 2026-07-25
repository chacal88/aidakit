# Proposal — plan-gate-executor-internals-check

**Change ID:** `plan-gate-executor-internals-check`
**Date:** `2026-07-25`
**Owner:** `@chacal88`
**Phase / Package:** `skills/readiness — the plan gate verifies internals claims against live code`
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

**Ship the semantic gate now; split the mechanical check out (owner ruling, 2026-07-25, after bench round 4).**

1. **PRIMARY — a semantic, mandatory step in [`skills/readiness/SKILL.md`](../../../skills/readiness/SKILL.md).** A new numbered step (`### 14`) requires the reviewer to re-derive from live code, with `Read`/`Grep`, every claim the package makes about an engine/executor/persistence/validator internal contract — explicitly including **prose generalizations that sum several individually-cited facts**, and explicitly including **unanchored** claims. A generalization that does not hold for every case it quantifies over is `Critical` / `Mandatory before implementation`. `readiness` owns it because it is the mandatory `invoke` gate in both flows ([full.yaml:166-180](../../../governance/flows/full.yaml), [fast.yaml:100-111](../../../governance/flows/fast.yaml)) with a mechanically parsed verdict — and because in this very incident the author's own self-check is what failed. This is the load-bearing half: it passed every bench round since round 1.

2. **SECONDARY — deferred, not shipped in this change.** A mechanical `governance/validators/check-design-claims.js` was built and iterated across four bench rounds, but round 4 found a blocking defect in its citation extractor — a markdown link whose *label* was itself wrapped in backticks (inline code) was dropped entirely: not checked, not errored, not visible in `skipped[]`. It occurs 17 times across this repo's own archived designs, and survived three prior review rounds plus heavy mutation testing. The owner split the change rather than iterate a fifth time on an already-four-times-patched extractor: ship what works (the semantic gate), defer the mechanical check to a new, separate change that starts from a correctly-derived corpus count and a link-aware extractor from the outset. That successor is registered as `design-claims-anchor-validator` in [EPIC-kit-discipline-hardening](../../roadmap/epics/EPIC-kit-discipline-hardening.md).

3. **Ghost-path correction.** `skills/planner/SKILL.md` — the path the roadmap's acceptance line names — does not exist. The feature's acceptance sub-bullet in [EPIC-kit-discipline-hardening](../../roadmap/epics/EPIC-kit-discipline-hardening.md) is corrected in this change to cite `skills/readiness/SKILL.md`, the skill that actually owns the gate.

4. **The decision is recorded: [ADR-015](../../decisions/ADR-015-readiness-owns-internals-claims-gate.md).** `readiness` owning the primary semantic gate is a boundary/responsibility decision between doctrine surfaces, and [agents/doc-planner.md:47](../../../agents/doc-planner.md) makes an ADR **mandatory** for a change carrying the `architecture` flag (this one carries `architecture` + `contract`, see [classification.json](classification.json)); [agents/doc-planner.md:95](../../../agents/doc-planner.md) turns that into a manifest verification item and [:120](../../../agents/doc-planner.md) forbids waiving it silently, so the doc-leash ([check-doc-manifest.js](../../../governance/validators/check-doc-manifest.js), flow-wired at [full.yaml:396](../../../governance/flows/full.yaml) / [fast.yaml:213](../../../governance/flows/fast.yaml)) would have demanded it regardless. The ADR now **records the split**: gate ownership ships in this change; the mechanical check's standalone-wiring decision is deferred to the successor change. Authored inside this plan package — the precedent is explicit: `docs/archive/2026-07-24-configurable-pr-automation/tasks.md:73` marks ADR-008 as *"já autorado neste pacote de plano (deliverable obrigatório)"* — and registered in [docs/decisions/README.md](../../decisions/README.md).

## Scope

- Edit `skills/readiness/SKILL.md`: new mandatory `### 14` (the semantic re-derivation step only — no mechanical pre-pass, no `Bash` invocation), and a cross-reference bullet in `### 4. Review the design`.
- Edit `docs/roadmap/epics/EPIC-kit-discipline-hardening.md`: the ghost-path fix, plus registering the successor feature (`design-claims-anchor-validator`) that the split creates.
- Regenerate `docs/roadmap/ROADMAP.md` (machine-derived, `aidakit:roadmap` — never hand-edited, ADR-002) to reflect the epic edit and the successor's registration.
- New file `docs/decisions/ADR-015-readiness-owns-internals-claims-gate.md` — **already authored in this package** — plus its two registrations in `docs/decisions/README.md` (index row + thematic grouping). Rewritten in this revision to record the split: gate ownership ships now, the mechanical check is deferred.
- Edit the docs that count the readiness steps (`13` → `14`): **8 edit sites across 5 files**, enumerated with line numbers in [tasks.md](tasks.md) §7. (The grep returns 9 hits in 6 files; the 9th is [ADR-015](../../decisions/ADR-015-readiness-owns-internals-claims-gate.md) §Consequences stating the ripple in the past tense — a record, not a target.)
- **Spec delta: `n/a`.** [agents/doc-planner.md:46](../../../agents/doc-planner.md) makes a change spec-delta mandatory for the `contrato` flag, at `docs/features/<change-id>/specs/<capability>/spec.md` in kit mode — and "`docs/specs/` does not exist" is **not** a valid waiver, since that path is a WORKING artifact inside the change dir and only its promotion is a later human gate. **Reading for this narrowed scope:** the change introduces no CLI, envelope, or exit-code surface at all — it edits a review skill's prose and records a decision. There is no contract left to spec. `aidakit:doc-planner` owns the final call; this line exists so the `document` gate inherits the reasoning instead of improvising it.

## Non-goals

- **No new `runs:` step, in any flow.** Flow-wiring with `on_failure` routing would need a new ADR in the [ADR-010](../../decisions/ADR-010-acceptance-leash.md)/[ADR-011](../../decisions/ADR-011-runs-infra-error-routing.md) mould and would breach the epic's *"cirurgia mínima, não reforma"* Não-goal. It stands on its own now that no validator ships at all: this change adds no flow step of any kind.
- **No mechanical validator in this change.** `governance/validators/check-design-claims.js` and its test are removed entirely — see §Solution point 2. The successor change `design-claims-anchor-validator` ([EPIC-kit-discipline-hardening](../../roadmap/epics/EPIC-kit-discipline-hardening.md)) picks this back up.
- **No redesign of `skills/readiness/SKILL.md`.** One appended numbered step, one cross-reference bullet; the 15-section output template is untouched and not renumbered.
- **Not bundled with the 3 sibling changes** of the epic (`review-usage-bench-manifest`, `step-summaries-type-gate-tests`, `brainstorm-schema-path-literal-lock`).
- **No DNA crystallization.** `deriveCandidates(threshold: 3)` returned empty for this lesson; the epic's Não-goal stands.

## Acceptance criteria

- `readiness-owns-the-gate` — `skills/readiness/SKILL.md` gains an explicit, numbered, mandatory step requiring that for every claim in `design.md`/`proposal.md` about an engine/executor/persistence/validator internal contract — INCLUDING prose generalizations that sum several individually-cited facts, not only individually line-anchored statements — the reviewer re-derives the claim from live code (Read/Grep) before approving; a generalization that does not hold for every case it covers is a Critical / Mandatory-before-implementation finding.
- `not-flow-wired-by-default` — This change adds NO new `runs:` step to `governance/flows/full.yaml` or `governance/flows/fast.yaml`; `git diff --stat governance/flows/full.yaml governance/flows/fast.yaml` produces empty output.
- `planner-naming-corrected` — No artifact of this change references the non-existent `skills/planner/SKILL.md`; the feature's acceptance sub-bullet in `docs/roadmap/epics/EPIC-kit-discipline-hardening.md` is updated to cite `skills/readiness/SKILL.md`.
- `precedent-incident-documented` — The change's `design.md` cites the real incident — `flow-step-summaries` `proposal.md:21`, `design.md:92`, `evidence.md:8-18` — as the reason the mechanical check is secondary, so nobody re-invents 'just grep the anchors' as if it sufficed.

## Exit criteria

- Full governance suite (`for t in governance/__tests__/*.test.mjs; do node "$t" || echo "FAIL $t"; done`) → 21 files, no `FAIL` line, no regression.
- `node governance/__tests__/agent-validator-paths.test.mjs` → exit 0, unchanged from its pre-change state (no call site remains in `skills/readiness/SKILL.md` to pin — the `SOURCE_FILES` entry added and then removed across this change's revisions leaves the file byte-identical to what it was before).
- `node governance/validators/check-links.js` over **this change's own touched-file set** → exit 0 for every target: `docs/features/plan-gate-executor-internals-check` · `docs/decisions/ADR-015-readiness-owns-internals-claims-gate.md` · `docs/decisions/README.md` · `skills/readiness/SKILL.md` · `docs/roadmap/epics/EPIC-kit-discipline-hardening.md` · `PROCESS.md` · `docs/guides/existing-repo-flow.md` · `docs/guides/change-flow.md` · `docs/reference/skills.md` · `skills/catalog/INDEX.md`.
  - **Known, pre-existing, out of scope — do NOT chase these.** A repo-wide `node governance/validators/check-links.js .` exits **1** with **13 broken links across 8 files**, none of them in this change's surface: `docs/decisions/ADR-008-opt-in-autonomous-pr-merge.md:43`; `docs/decisions/ADR-010-acceptance-leash.md:23, :25, :33, :35, :39`; `docs/decisions/ADR-011-runs-infra-error-routing.md:13` (×2); `docs/roadmap/epics/EPIC-flow-engine-leashes.md:14`; `skills/context-pack/SKILL.md:26`; `skills/implement/SKILL.md:40`; `skills/learn/SKILL.md:23`; `skills/plan/SKILL.md:38`. Most are ADRs and skills linking into `docs/features/<change-id>/` for changes that have since moved to `docs/archive/` — a real debit (an ADR is WORM, so its links must point at durable paths), but repairing those 8 unrelated documents would breach the epic's *"cirurgia mínima, não reforma"* Não-goal. **Separate debit; this change must not widen to cover it, and must not be judged against a repo-wide green.**
- `node governance/validators/check-plugin-version.js` → exit 0 (no footer declares more than `plugin.json` 0.9.0).
- `git diff --stat governance/flows/full.yaml governance/flows/fast.yaml` → empty output. (This is the whole of `not-flow-wired-by-default`. The criterion id is the correlation key for [parse-criteria.js](../../../governance/acceptance/parse-criteria.js)/[check-acceptance.js](../../../governance/validators/check-acceptance.js) and is unchanged; its body was rewritten in this revision to drop the validator clause, since no validator ships.)
- `node governance/validators/check-adr-format.js docs/decisions` → exit 0 with `adrs_checked: 15` (ADR-015 present and well-formed), and `docs/decisions/README.md` lists ADR-015 in both the index table and the thematic grouping.
- `grep -rn "skills/planner/SKILL.md" docs/roadmap skills governance agents commands` → no hits (the epic line is fixed; no kit surface names the ghost).
- `grep -rn "](.*skills/planner/SKILL\.md" .` → no hits (no artifact links to the ghost path as if it resolved), and `node governance/validators/check-links.js docs/roadmap/epics/EPIC-kit-discipline-hardening.md` → exit 0 after the fix. That second command is a **scoped** check on the one file this criterion edits — it is deliberately not a repo-wide `check-links` promise, which is unsatisfiable today (see the 13 pre-existing breakages above). **Scoping note:** the change package's own prose *does* name the string, exclusively to state that it does not exist and to record the correction (`design.md` §Why `readiness` owns it, the `planner-naming-corrected` criterion text, and the flow-authored `classification.json`, which quotes the original roadmap line verbatim and is not rewritten). Naming a path to declare it absent is the opposite of referencing it as real; the mechanical form of the criterion is "no link target, no invocation path, and zero occurrences on any kit surface".

## References

- [EPIC-kit-discipline-hardening](../../roadmap/epics/EPIC-kit-discipline-hardening.md) — the parent epic and its three Não-goals (minimal surgery, no DNA, no bundling).
- `.aidakit/tasks/plan-gate-executor-internals-check/brainstorm.json` (gitignored runtime artifact, not a tracked path) — the locked assumptions, the owner's decisions of 2026-07-25, and the 2026-07-25 split ruling recorded in `decision.split_2026_07_25`.
- [classification.json](classification.json) — domain `product`, type `feature`, flags `architecture` + `contract` (flow-authored before the brainstorm/split, not rewritten).
- [flow-step-summaries](../../archive/2026-07-24-flow-step-summaries/design.md) — the incident: the false generalization at `design.md:92`, its origin at `proposal.md:21`, the anchor re-check that passed at `evidence.md:8-18`.
- [ADR-015](../../decisions/ADR-015-readiness-owns-internals-claims-gate.md) — this change's own decision record: gate ownership ships now; the mechanical check's standalone wiring is deferred to the successor change, per the 2026-07-25 split.
