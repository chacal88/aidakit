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

1. **PRIMARY — a semantic, mandatory step in [`skills/readiness/SKILL.md`](../../../skills/readiness/SKILL.md).** A new numbered step (`### 14`) requires the reviewer to re-derive from live code, with `Read`/`Grep`, every claim the package makes about an engine/executor/persistence/validator internal contract — explicitly including **prose generalizations that sum several individually-cited facts**, and explicitly including **unanchored** claims. A generalization that does not hold for every case it quantifies over is `Critical` / `Mandatory before implementation`. `readiness` owns it because it is the mandatory `invoke` gate in both flows ([full.yaml:166-180](../../../governance/flows/full.yaml), [fast.yaml:100-110](../../../governance/flows/fast.yaml)) with a mechanically parsed verdict — and because in this very incident the author's own self-check is what failed.

2. **SECONDARY — `governance/validators/check-design-claims.js`,** a new pure-Node zero-dep validator following the `check-acceptance.js` contract shape (JSON envelope on stdout, markdown report on stderr, exit `0`/`1`/`2`). It extracts every `<file>.<ext>:<NN>` / `:<NN>-<NN>` citation from the change's `design.md`/`proposal.md` and fails **only** when the anchor no longer resolves — file gone, or cited line past the file's current line count. Its header comment states in the first paragraph that it guards citation staleness, is **not** a truth-checker, and cites the `flow-step-summaries` incident so nobody re-invents "just grep the anchors" as if it sufficed.

3. **Wiring: standalone.** The validator is invoked with `Bash` from inside `aidakit:readiness`, under the `AIDAKIT_GOVERNANCE` contract of [ADR-004](../../decisions/ADR-004-aidakit-governance-env-contract.md) as broadened by [ADR-012](../../decisions/ADR-012-aidakit-governance-session-wide.md), with the same fail-closed guard idiom every other direct call site uses. **No new `runs:` step** in `full.yaml`/`fast.yaml`, **no new ADR** — precedent: `check-adr-format.js` is in no `runs:` block of any shipped flow today.

4. **Ghost-path correction.** `skills/planner/SKILL.md` — the path the roadmap's acceptance line names — does not exist. The feature's acceptance sub-bullet in [EPIC-kit-discipline-hardening](../../roadmap/epics/EPIC-kit-discipline-hardening.md) is corrected in this change to cite `skills/readiness/SKILL.md`, the skill that actually owns the gate.

## Scope

- New file `governance/validators/check-design-claims.js` (validator, contract per [design.md](design.md) §The validator).
- New file `governance/__tests__/check-design-claims.test.mjs` (pure-Node table test, house idiom).
- Edit `skills/readiness/SKILL.md`: new mandatory `### 14`, a cross-reference bullet in `### 4. Review the design`, and the guarded `Bash` invocation of the validator.
- Edit `governance/__tests__/agent-validator-paths.test.mjs`: add `skills/readiness/SKILL.md` to `SOURCE_FILES` so the new call site's fail-closed guard is asserted byte-identical to the canonical literal.
- Edit `docs/roadmap/epics/EPIC-kit-discipline-hardening.md`: the ghost-path fix.
- Edit the docs that count the readiness steps (`13` → `14`) and the validator table in `docs/OVERVIEW.md` — enumerated in [tasks.md](tasks.md) §6.

## Non-goals

- **No new `runs:` step, in any flow.** Flow-wiring with `on_failure` routing would need a new ADR in the [ADR-010](../../decisions/ADR-010-acceptance-leash.md)/[ADR-011](../../decisions/ADR-011-runs-infra-error-routing.md) mould and would breach the epic's *"cirurgia mínima, não reforma"* Não-goal. If anchor rot ever bites in practice, flow-wiring is a separate debit.
- **No new ADR.** The change adds no locked decision: it reuses the ADR-004/ADR-012 call-site contract verbatim and adds no flow-schema surface.
- **No truth-checking in the validator.** It never decides whether a sentence about internals is *true* — that is semantic judgement and belongs to the `readiness` reviewer. The grep is structural and subject-blind.
- **No new citation format mandated on plan authors.** The validator checks the anchors that exist; it does not fail a design for citing without a line number, and it does not fail on a `basename.ext:NN` it cannot locate (reported as skipped, never as an error).
- **No redesign of `skills/readiness/SKILL.md`.** One appended numbered step, one cross-reference bullet; the 15-section output template is untouched and not renumbered.
- **Not bundled with the 3 sibling changes** of the epic (`review-usage-bench-manifest`, `step-summaries-type-gate-tests`, `brainstorm-schema-path-literal-lock`).
- **No DNA crystallization.** `deriveCandidates(threshold: 3)` returned empty for this lesson; the epic's Não-goal stands.

## Acceptance criteria

- `readiness-owns-the-gate` — `skills/readiness/SKILL.md` gains an explicit, numbered, mandatory step requiring that for every claim in `design.md`/`proposal.md` about an engine/executor/persistence/validator internal contract — INCLUDING prose generalizations that sum several individually-cited facts, not only individually line-anchored statements — the reviewer re-derives the claim from live code (Read/Grep) before approving; a generalization that does not hold for every case it covers is a Critical / Mandatory-before-implementation finding.
- `mechanical-validator-scoped-as-secondary` — `governance/validators/check-design-claims.js` exists, greps every `<file>.<ext>:<NN>` and `:<NN>-<NN>` citation in the change's `design.md`/`proposal.md`, and fails ONLY when the anchor no longer resolves (file gone, or cited line beyond the file's current line count) — following the `check-acceptance.js` contract shape (pure Node, zero-dep, JSON envelope `{validator, ok, errors[]}`, exit 0/1/2). Its header comment states explicitly that it guards citation staleness and is NOT a truth-checker.
- `not-flow-wired-by-default` — `check-design-claims.js` is invoked by `aidakit:readiness` via `Bash`; `git diff` shows NO new `runs:` step added to `governance/flows/full.yaml` or `governance/flows/fast.yaml`, and no new ADR is created for this change.
- `planner-naming-corrected` — No artifact of this change references the non-existent `skills/planner/SKILL.md`; the feature's acceptance sub-bullet in `docs/roadmap/epics/EPIC-kit-discipline-hardening.md` is updated to cite `skills/readiness/SKILL.md`.
- `new-file-citations-excluded` — The validator does not fail on a citation to a file the change itself is creating — proven by a test in which a `design.md` cites a path absent from disk but declared as to-be-created, and the validator exits 0.
- `precedent-incident-documented` — The change's `design.md` (or the header of `check-design-claims.js`, in the style of the CROSS-VALIDATION comment at `governance/validators/check-acceptance.js:28-34`) cites the real incident — `flow-step-summaries` `proposal.md:21`, `design.md:92`, `evidence.md:8-18` — as the reason the mechanical check is secondary, so nobody re-invents "just grep the anchors" as if it sufficed.

## Exit criteria

- `node governance/__tests__/check-design-claims.test.mjs` → exit 0, every case green.
- `node governance/__tests__/agent-validator-paths.test.mjs` → exit 0 (grep sweep §3 stays empty ⇒ the new readiness call site uses `$AIDAKIT_GOVERNANCE`, never a relative `node governance/…`; §0 asserts the guard literal byte-identical).
- Full governance suite (`for t in governance/__tests__/*.test.mjs; do node "$t" || echo "FAIL $t"; done`) → 22 files, no `FAIL` line, no regression.
- `node governance/validators/check-design-claims.js docs/features/plan-gate-executor-internals-check` → exit 0 (dogfood: this package's own citations resolve).
- `node governance/validators/check-links.js .` → exit 0.
- `node governance/validators/check-plugin-version.js` → exit 0 (no footer declares more than `plugin.json` 0.9.0).
- `git diff --stat governance/flows/full.yaml governance/flows/fast.yaml` → empty output, and `git status --porcelain docs/decisions/` → empty (no new ADR).
- `grep -rn "skills/planner/SKILL.md" docs/roadmap skills governance agents commands` → no hits (the epic line is fixed; no kit surface names the ghost).
- `grep -rn "](.*skills/planner/SKILL\.md" .` → no hits, and `check-links` stays green: no artifact links to the ghost path as if it resolved. **Scoping note:** the change package's own prose *does* name the string, exclusively to state that it does not exist and to record the correction (`design.md` §Why `readiness` owns it, the `planner-naming-corrected` criterion text, and the flow-authored `classification.json`, which quotes the original roadmap line verbatim and is not rewritten). Naming a path to declare it absent is the opposite of referencing it as real; the mechanical form of the criterion is "no link target, no invocation path, and zero occurrences on any kit surface".

## References

- [EPIC-kit-discipline-hardening](../../roadmap/epics/EPIC-kit-discipline-hardening.md) — the parent epic and its three Não-goals (minimal surgery, no DNA, no bundling).
- [`.aidakit/tasks/plan-gate-executor-internals-check/brainstorm.json`](../../../.aidakit/tasks/plan-gate-executor-internals-check/brainstorm.json) — the locked assumptions and the owner's three decisions of 2026-07-25.
- [classification.json](classification.json) — domain `product`, type `feature`, flags `architecture` + `contract`.
- [flow-step-summaries](../../archive/2026-07-24-flow-step-summaries/design.md) — the incident: the false generalization at `design.md:92`, its origin at `proposal.md:21`, the anchor re-check that passed at `evidence.md:8-18`.
- [ADR-004](../../decisions/ADR-004-aidakit-governance-env-contract.md) + [ADR-012](../../decisions/ADR-012-aidakit-governance-session-wide.md) — the `AIDAKIT_GOVERNANCE` call-site contract the new `Bash` invocation must honor (guard idiom, `$`-no-braces, double quotes).
- [ADR-010](../../decisions/ADR-010-acceptance-leash.md) — the weak-bar/leash doctrine whose validator contract shape (`check-acceptance.js`) this validator mirrors.
- [ADR-011](../../decisions/ADR-011-runs-infra-error-routing.md) — why flow-wiring a validator is an ADR-grade act, hence avoided here.
