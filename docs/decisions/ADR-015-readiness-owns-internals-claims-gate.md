<!-- File: docs/decisions/ADR-015-readiness-owns-internals-claims-gate.md — global sequential numbering, never recycled. Registered in the index docs/decisions/README.md. -->
<!-- An ADR is WORM: never edit a past decision. Changed your mind → a new ADR that supersedes or amends this one. -->

# ADR-015: `aidakit:readiness` owns the internals-claims gate; the mechanical anchor check is deferred to a separate change

- **Status:** proposed (moves to accepted when this change's PR merges)
- **Date:** 2026-07-25

## Context

A change plan routinely asserts things about the kit's own machinery — which executor writes which key into `context[step.id]`, what a persistence function returns, what a validator's exit codes mean. Nothing in the pipeline forced anyone to open the code and confirm it.

It shipped a defect. In `flow-step-summaries` the design claimed `context[step.id].outcome` is *"populated by every pause-emitting executor"* ([design.md:92](../archive/2026-07-24-flow-step-summaries/design.md), originating one artifact earlier at [proposal.md:21](../archive/2026-07-24-flow-step-summaries/proposal.md)). It is false: only [invoke.js:154-155](../../governance/engine/steps/invoke.js) writes `bag.outcome`; [human-gate.js](../../governance/engine/steps/human-gate.js) writes `.choice` and [human-handoff.js](../../governance/engine/steps/human-handoff.js) writes `.response`. The implementer caught it mid-implementation, root-caused it and fixed it — but only after it had passed the plan gate.

Three properties of that defect drive this decision:

1. **It was unanchored prose**, not a rotten `file.js:NN` anchor.
2. **It was a generalization built on correct citations** — each underlying fact was individually true and individually anchored.
3. **The obvious pin would have missed it.** The same `design.md` carries ~15 well-formed anchors and the implementer re-verified *every one of them at setup*, reporting "No correction needed at setup time" ([evidence.md:8-18](../archive/2026-07-24-flow-step-summaries/evidence.md)). A validator that greps anchors and fails when one no longer resolves would have returned **PASS at the exact moment the bug was written**.

The roadmap parked the lesson as a feature of [EPIC-kit-discipline-hardening](../roadmap/epics/EPIC-kit-discipline-hardening.md), whose acceptance line named `skills/planner/SKILL.md` — a path that does not exist (`skills/` has `plan/` and `readiness/`) — and preferred a mechanical validator as the pin. Deciding **which surface owns the gate** is a responsibility/boundary decision between two doctrine surfaces (author vs. reviewer), and deciding **whether the mechanical check becomes a flow step** touches the flow schema and its failure routing. Both are recordable decisions per [DOCS.md](../../DOCS.md) §2 placement tree item 1; the change carries the `architecture` flag, which [agents/doc-planner.md:47](../../agents/doc-planner.md) makes an ADR a hard requirement for on its own ("the `arquitetura` flag REQUIRES an ADR" — a `contrato` flag only "usually requires" one, and is not the basis for this requirement, since the contract-flagged surface it originally referred to no longer ships in this change). The epic's own Não-goal — *"cada change é uma cirurgia mínima na doutrina, não uma reforma"* — bounds how much surface the answer may take.

**Post-context, 2026-07-25 (the split).** A mechanical secondary validator, `governance/validators/check-design-claims.js`, was built inside this same change package and iterated across four adversarial bench rounds. Rounds 1-3 each found and fixed a real defect in its citation extractor. Round 4 found a **blocking** one: the markdown-linked form whose *label* is itself backticked (e.g. a link whose visible text is inline code reading `governance/foo.js:12`, pointing at some target) was dropped **entirely** — not checked, not errored, not visible in `skipped[]`. It occurs 17 times across this repo's own archived change designs; copying an affected archived design out of the archive and running the validator against it returned total silence. The defect predates round 4 and survived three review rounds plus heavy mutation testing — and the round-4 corpus measurement that justified an unrelated narrowing (bare-citation extraction confined to inline-code spans) was itself measured through this same blind extractor, undercounting by exactly those 17 hits. See §Decision 2.

## Decision

**1. The PRIMARY gate is semantic and belongs to `aidakit:readiness`. This ships in this change.**

[skills/readiness/SKILL.md](../../skills/readiness/SKILL.md) gains a mandatory numbered Process step (**Process §14**, appended after Process §13 and before `### Severity classification`): for every claim in `design.md`/`proposal.md` about an internal contract of the repo's own machinery, the reviewer re-derives the claim from live code with `Read`/`Grep` before approving. It covers three shapes, not one — (i) line-anchored claims, (ii) **unanchored** claims, (iii) **prose generalizations that sum several individually-cited facts**. For shape (iii) the reviewer must enumerate the full set the sentence quantifies over and verify every member; a generalization that does not hold for every case it covers is `Critical` / `Mandatory before implementation`, even when each underlying citation checks out. The step needs only `Read`/`Grep` — no shell invocation, no environment contract.

`readiness` owns it, not `plan`/`planner`, because:

- it is the mandatory `invoke` gate in **both** flows ([full.yaml:166-180](../../governance/flows/full.yaml), [fast.yaml:100-111](../../governance/flows/fast.yaml)) with a machine-parsed verdict, whereas `skills/plan/SKILL.md` only assembles a prompt and dispatches — it cannot gate anything from inside the flow;
- in the motivating incident the **author's own** setup self-check ran and passed. The gate must sit with the independent reviewer.

The `skills/planner/SKILL.md` path named in the roadmap line is a ghost and is corrected to `skills/readiness/SKILL.md` in the same change.

**2. The mechanical check is SPLIT OUT into a separate change, `design-claims-anchor-validator` ([EPIC-kit-discipline-hardening](../roadmap/epics/EPIC-kit-discipline-hardening.md), [ROADMAP.md](../roadmap/ROADMAP.md)). It does NOT ship here.**

`governance/validators/check-design-claims.js` and its test are removed from this change entirely, after four bench rounds — see §Context "the split". This is a decision about *sequencing and reliability*, not about the concept: a mechanical anchor-rot leash for `design.md`/`proposal.md` citations is still believed to be worth building. It is deferred because:

- **Iterating a fifth time on an already-four-times-patched extractor, inside the change whose own thesis is "verify claims about internals," would itself have been an unverified claim about internals** — shipping a mechanical check with a known, repo-corpus-confirmed 17-hit blind spot to preserve a plan's timeline is the exact failure mode this ADR exists to prevent.
- **The semantic gate (point 1) is the load-bearing half and has already passed every bench round since round 1.** It does not need the mechanical check to be useful; the original incident (§Context) was caught by neither a mechanical check nor existing process, and would have been caught by point 1 alone.
- **A rewrite, not a patch, is warranted.** Three consecutive rounds of "widen the terminator/exclusion set by one more character class" produced three consecutive new defects. `design-claims-anchor-validator` should start from a correctly-derived corpus count (the 55/39/0 measurement was itself wrong, undercounted by the round-4 blind spot) and a citation extractor that treats markdown-link parsing and inline-code-span detection as one unified pass from the outset, not composed incrementally under review pressure.

No `runs:` step is added to `governance/flows/full.yaml` or `governance/flows/fast.yaml` by this change — trivially true with no validator shipping at all.

**3. Enforcement is by verdict, not per-step — stated, not implied.**

Process §14 is enforced exactly as Process §1-§13 are: through the aggregate readiness verdict the flow consumes (`Status:` / `Ready to implement:`), not by any mechanism that observes whether the reviewer actually performed the step. This decision does not claim a stronger guarantee than the kit's per-step enforcement model provides for any other review step.

## Consequences

- **Positive:** the error class that shipped in `flow-step-summaries` now has an explicit owner, an explicit severity and an explicit trigger phrase ("every X does Y") that a reviewer can pattern-match; the roadmap stops naming a non-existent path; the gate ships without waiting on a mechanical surface that repeatedly proved unreliable under review.
- **Negative — Process §14 itself is unenforceable per-step** (point 3). **Accepted** — identical to every other step of every review skill in the kit; the mitigation is textual clarity (the three shapes, the trigger phrases, the severity), not machinery.
- **Negative — anchor rot has no mechanical check until `design-claims-anchor-validator` ships.** A once-correct `file.js:NN` citation whose target moves after the plan is authored will not be caught mechanically. **Accepted, deliberately** — a mechanical check that silently misses 17 real citations in this repo's own corpus is a worse position than no mechanical check plus an honest gap, and Process §14's re-derivation step (point 1) still catches a wrong citation whenever the reviewer actually opens the file, independent of anchor freshness.
- **Negative — adding Process §14 makes the advertised "13-step" readiness review a 14-step one.** `grep -rn "13-step\|13 steps\|13 planning"` over the repo, excluding `docs/archive/` (WORM) and the change package, returns **9 hits in 6 files**; **8 of them, in 5 files, are kit-facing edit targets** (`PROCESS.md` ×3, `docs/guides/existing-repo-flow.md`, `docs/guides/change-flow.md`, `docs/reference/skills.md` ×2, `skills/catalog/INDEX.md`). The 9th hit is this very bullet — named once here for completeness, in the past tense, and **not** an edit target. **Accepted** — a one-token edit per site, carried in the same change; leaving them stale would itself be the unverified-claim failure this decision exists to prevent.

### Review trigger

When `design-claims-anchor-validator` ships the mechanical check, it references this ADR by number rather than re-litigating point 1; if it changes *where* the gate lives or *whether* it is flow-wired, that is a new decision surface and needs its own ADR (or an amendment to this one, if the ownership question itself is what's being revisited). If a future change makes the mechanical check a `runs:` step, that ADR needs an amendment, not a silent flow edit.

## Alternatives considered

| Option | Pros | Cons | Cost to undo |
|---|---|---|---|
| **Ship both surfaces together, as originally planned** | One review cycle, one decision record | The mechanical check's extractor failed a blocking-severity bench finding on its fourth review round in a row, with a corpus-confirmed 17-hit blind spot — shipping it anyway to avoid a second change would have been exactly the un-re-derived-claim failure this ADR exists to prevent | high (a shipped defect is far more expensive to undo than a deferred feature) |
| **Semantic checklist only, permanently — never build the mechanical check** | Zero new executable surface, zero maintenance | Leaves anchor rot unguarded permanently, a real and cheap-to-check failure mode once a plan sits for days while code moves. Rejected: the concept is still worth building, just not in this change | low |
| **Fix the round-4 defect with a fifth patch and ship anyway** | Keeps the original one-change plan | The pattern across rounds 1-4 was "patch the reported string, discover the next one" — no evidence a fifth patch would be the last one, and the corpus-measurement basis for round 4's own redesign was itself wrong | medium |
| **Flow-wire the validator as a `runs:` step with `on_failure` routing** | Cannot be skipped | Moot until the validator ships at all; would in any case add step semantics + failure routing = the "reforma" the epic excludes, and make a not-yet-reliable check the blocking one | medium |
| **Give the gate to `skills/plan/SKILL.md` or `agents/planner.md`** (the author) | Catches the error earlier, at authoring | `plan` only assembles a prompt — it cannot gate from inside the flow; and the incident is precisely a case where the author's own check passed | medium |
| **Insert the new step next to the design review as Process §5 and renumber §5-§13** | Sits where design claims are actually read | Renumbering ripples into the 15-section output template and into every doc that references the numbered steps, for zero semantic gain. Appended as Process §14 plus one cross-reference bullet in Process §4 | low |
