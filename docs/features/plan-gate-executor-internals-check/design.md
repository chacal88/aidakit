# Design — plan-gate-executor-internals-check

**Change ID:** `plan-gate-executor-internals-check`
**Date:** `2026-07-25`
**Owner:** `@chacal88`
**Phase / Package:** `skills/readiness — the plan gate verifies internals claims against live code`
**PRD:** `n/a`
**Tech Spec:** `n/a`

## The incident, stated plainly (why the semantic gate is PRIMARY)

The false claim that motivated this change was **unanchored prose**, not a stale anchor.

- **The claim.** *"the renderer resolves `{outcome}` from `context[step.id].outcome` (populated by every pause-emitting executor)"* — [flow-step-summaries/design.md:92](../../archive/2026-07-24-flow-step-summaries/design.md). It originates one artifact earlier, in the `## What Changes` bullet at [flow-step-summaries/proposal.md:21](../../archive/2026-07-24-flow-step-summaries/proposal.md) (*"populated by the step executor: `context[step.id].outcome`, … `context[step.id].choice` on a `human_gate`"*).
- **Why it is false.** Only [invoke.js:154-155](../../../governance/engine/steps/invoke.js) writes `bag.outcome`. [human-gate.js](../../../governance/engine/steps/human-gate.js) writes `.choice`; [human-handoff.js](../../../governance/engine/steps/human-handoff.js) writes `.response`. The set the sentence quantified over has three members and the property holds for one.
- **Why an anchor-grep would not have caught it.** The sentence carries **no anchor at all**. Worse: the same `design.md` carries ~15 well-formed anchors, and the implementer re-verified **every one of them at setup**, reporting *"No correction needed at setup time"* — [flow-step-summaries/evidence.md:8-18](../../archive/2026-07-24-flow-step-summaries/evidence.md). **A grep of the anchors returned PASS at the exact moment the bug was written**, and the bug surfaced later, mid-Task-4 GREEN.
- **The shape of the error.** A **generalization built on correct citations**. Each cited fact — invoke writes `.outcome`, human-gate writes `.choice`, human-handoff writes `.response` — was individually true and individually anchored, at [flow-step-summaries/design.md:18-27](../../archive/2026-07-24-flow-step-summaries/design.md). The summing sentence was not.

Consequences for this design, in order:

1. The gate must be semantic and must explicitly cover unanchored claims and generalizations. Only a reader who enumerates the quantified set catches this class. That is `skills/readiness/SKILL.md` **Process §14** — the surface this change ships.
2. A mechanical anchor-grep guards a real but *different* risk — **anchor rot**: code moving between plan authoring and review/implementation, turning a once-correct `file.js:NN` into a pointer at unrelated lines or a deleted file. Real, cheap to check, and provably not the risk that bit us. It was built and iterated across four review rounds in this same change package; a blocking extraction defect found in the fourth round — see §Mechanical check: split out below — moved it to a separate change rather than delaying the semantic gate any further.

## Why `readiness` owns it (not `plan`, and not `planner`)

- `skills/planner/SKILL.md` **does not exist**. `skills/` has `plan/` and `readiness/`; the plan-authoring surfaces are [skills/plan/SKILL.md](../../../skills/plan/SKILL.md) (assembles a prompt and dispatches; it cannot gate anything mechanically from inside the flow) and [agents/planner.md](../../../agents/planner.md) (the agent that actually writes `design.md`). Every artifact of this change resolves "the planner skill" to a real path; the roadmap line that names the ghost is corrected here (criterion `planner-naming-corrected`). **Scoping note for that criterion:** this bullet, the criterion text in [proposal.md](proposal.md), and the flow-authored [classification.json](classification.json) (which quotes the original roadmap line verbatim and is not rewritten) do spell the string — exclusively to declare it absent. The mechanical form of "no artifact references the ghost path" is therefore: **no markdown link targets it, no command invokes it, and it occurs zero times on any kit surface (`skills/`, `governance/`, `agents/`, `commands/`, `docs/roadmap/`)** — see [proposal.md](proposal.md) §Exit criteria.
- `aidakit:readiness` is a **mandatory `invoke` gate in both flows** — [full.yaml:166-180](../../../governance/flows/full.yaml) and [fast.yaml:100-111](../../../governance/flows/fast.yaml) — with a machine-parsed verdict (`Status:` / `Ready to implement:`, [skills/readiness/SKILL.md:416](../../../skills/readiness/SKILL.md)). Blocking is already its job.
- The incident is itself the argument: the author's own setup self-check ran and passed. The gate belongs to the **independent reviewer**, not to the author who wrote the sentence.

## Surface 1 — the new mandatory step in `skills/readiness/SKILL.md`

### Placement

Appended as `### 14`, **after** [§13 "Answer the mandatory review questions" (line 296)](../../../skills/readiness/SKILL.md) and **before** [`### Severity classification` (line 311)](../../../skills/readiness/SKILL.md). Rationale: appending avoids renumbering §5-§13 and avoids touching the 15-section output template at [lines 363-414](../../../skills/readiness/SKILL.md), which is the doc's machine-facing contract. Findings from Process §14 are reported inside the **existing** output sections `## 4. Design review` and `## 11. Mandatory fixes before implementation` — no new output section, no template renumbering. One cross-reference bullet is added to the checklist of [§4 "Review the design" (line 165)](../../../skills/readiness/SKILL.md) so a reviewer working top-down meets the rule where design claims are read.

The step count in the prose that advertises this skill ("13-step") becomes 14 at **8 edit sites across 5 files**, enumerated with line numbers in [tasks.md](tasks.md) §7 (the grep returns 9 hits in 6 files; the 9th is ADR-015's own past-tense mention, not a target — see §Grounding) — leaving them stale would itself be an unverified claim about internals, which is precisely what this change exists to stop.

**Naming discipline for the cross-references.** `skills/readiness/SKILL.md` already contains `## 14. Mandatory review questions` at line 407 — a section of the **output template**, fed by *Process* step `### 13.` at line 296. A bare "§14" is therefore ambiguous inside that one file. Every cross-reference this change writes — in the inserted text, in the §4 bullet, and in [tasks.md](tasks.md) — says **"Process §14"**.

### Exact text to insert

````md
### 14. Verify claims about internals against live code

MANDATORY. Do not emit a verdict before this step is done. (This is **Process** step 14; the `## 14. Mandatory review questions` heading further down belongs to the output template and is a different thing.)

For every claim in `<change-root>/design.md` and `<change-root>/proposal.md` about an internal contract of the repo's own machinery — an executor's write-set, a persistence function's shape, a validator's return value or exit codes, a state field, a parser rule, a schema key, a CLI argv contract — re-derive the claim from the **live code** with `Read`/`Grep` before approving it. Reading the plan is not verification: open the file.

Three shapes qualify, not one:

1. **Line-anchored claims** (`path/file.ext:NN`) — open the file at that line and confirm the code says what the plan says. A resolvable anchor pointing at code that does something else is a finding.
2. **Unanchored claims** — prose that asserts an internal behavior with no citation. Locate the code yourself. A claim you cannot ground is a finding, never a free pass.
3. **Prose generalizations that sum several individually-cited facts** — sentences of the form "every X does Y", "always populated", "all executors write Z", built on citations that are each individually correct. **Enumerate the full set the sentence quantifies over and verify every member.** A generalization that does not hold for every case it covers is `Critical` / `Mandatory before implementation`, even when each underlying citation checks out.

Why shape 3 is called out separately: in `flow-step-summaries` the design claimed `context[step.id].outcome` was "populated by every pause-emitting executor" (`docs/archive/2026-07-24-flow-step-summaries/design.md:92`). Only `invoke.js` writes `.outcome`; `human-gate.js` writes `.choice` and `human-handoff.js` writes `.response`. Every individual anchor in that design was re-verified and passed (`evidence.md:8-18`) — the summing sentence was still false, and it reached implementation.

Report every failed re-derivation in `## 4. Design review` with severity + fix classification per the evidence standard, and mirror the `Critical` ones into `## 11. Mandatory fixes before implementation`.
````

This step needs only `Read`/`Grep` — no `Bash`, no shell invocation, no environment contract. It is self-contained inside the reviewer's own tool set.

## Mechanical check: split out (owner ruling, 2026-07-25)

This change originally shipped **both** a semantic gate (Process §14, above) and a mechanical secondary validator, `governance/validators/check-design-claims.js` — a pure-Node grep-based leash intended to catch anchor rot (a citation whose line number drifts as code moves). The validator went through four adversarial bench rounds inside this same change package. Rounds 1-3 each found and fixed a real defect in its citation extractor (URLs resolved as file paths; a bounded fix that silently swallowed a real rotten citation glued to a URL; a still-live silent-miss/false-positive pair on comma/semicolon/colon glue and a quoted URL fragment) — each round's fix reopened, or left open, a new failure mode in the same extractor.

**Round 4 found a blocking defect that ended the iteration:** the markdown-linked form was dropped **entirely** when its label was itself wrapped in backticks — a link whose visible text reads `` `governance/foo.js:12` `` (inline code) instead of plain `governance/foo.js:12`, pointing at some target path. Rendered as a fenced example rather than a live link, to avoid this document itself becoming a false positive:

```md
[`governance/foo.js:12`](../../../governance/foo.js)
```

Not checked, not errored, not reported in `skipped[]` — total silence. `label.trim()` kept the backticks, so the citation-suffix regex's `$` anchor never matched the label; the link markup was then masked out of the line unconditionally, so the bare-citation scan never saw the text either. It occurs **17 times** across this repo's own archived change designs — copying an affected archived `design.md` out of `docs/archive/` and running the validator against it returned total silence (`ok:true`, zero citations checked, zero skipped, zero errors) on a design whose citations were *all* that form. The defect predates round 4 and survived three review rounds plus heavy mutation testing; the round-4 corpus measurement that justified narrowing bare-citation extraction to inline-code spans (55 backticked / 39 linked / 0 raw-prose, across 17 archived packages) was itself measured through this same blind extractor and undercounted by exactly those 17 hits.

Four bench rounds, four rounds with a blocking defect in the mechanical surface — while Process §14, the semantic gate this change's own incident says is the load-bearing half, passed every round since round 1. **Owner's call: ship what works, split out what does not.** `governance/validators/check-design-claims.js` and its test are removed from this change entirely. The successor change `design-claims-anchor-validator` — registered in [EPIC-kit-discipline-hardening](../../roadmap/epics/EPIC-kit-discipline-hardening.md) and in [ROADMAP.md](../../roadmap/ROADMAP.md) — picks the mechanical check back up, starting from a correctly-derived corpus count and a link-aware citation extractor from the outset.

## Grounding (verified against the code)

Every internals claim above was re-derived by opening the file at the cited line during this authoring session. This section is the audit trail; `skills/readiness/SKILL.md` Process §14 is the rule that will be applied to it.

- **`aidakit:readiness` is a mandatory `invoke` gate in both flows** — [full.yaml:166-180](../../../governance/flows/full.yaml) (`expects: approved|needs-revision|blocked`, `outputs: {needs-revision: [cause]}`, `on_result.approved: context_pack`, `blocked: aborted`) and [fast.yaml:100-111](../../../governance/flows/fast.yaml) (same outcomes, `needs-revision: plan`).
- **The readiness skill's structure** — numbered `### 1`-`### 13` under `## Process` starting at [line 113](../../../skills/readiness/SKILL.md); `### 4. Review the design` at [line 165](../../../skills/readiness/SKILL.md); `### 13. Answer the mandatory review questions` at [line 296](../../../skills/readiness/SKILL.md); `### Severity classification` at [line 311](../../../skills/readiness/SKILL.md) (`Critical`/`High`/`Medium`/`Low`); `### Fix classification` at [line 320](../../../skills/readiness/SKILL.md) (`Mandatory before implementation` / `Fix during implementation` / `Nice-to-have` / `Out of scope`); the 15-section output template at [lines 363-414](../../../skills/readiness/SKILL.md); the verbatim-verdict rule at [line 416](../../../skills/readiness/SKILL.md).
- **Frontmatter** — [skills/readiness/SKILL.md:1-4](../../../skills/readiness/SKILL.md) declares `name` + `description` only; no `allowed-tools`. There is no `agents/readiness.md`; this is moot for this revision since Process §14 needs only `Read`/`Grep`, both universally available tools.
- **The `§14` collision** — `skills/readiness/SKILL.md` carries `## 14. Mandatory review questions` at [line 407](../../../skills/readiness/SKILL.md) (output template) while the Process list currently ends at `### 13.` ([line 296](../../../skills/readiness/SKILL.md)). Hence the "Process §14" qualifier everywhere.
- **The ADR is mandatory, not optional** — [agents/doc-planner.md:47](../../../agents/doc-planner.md): "**the `arquitetura` flag REQUIRES an ADR** (changing structure/responsibility/boundary = a recordable decision)"; [:95](../../../agents/doc-planner.md) makes it a manifest verification item ("A change with the `arquitetura` flag has at least one `kind: adr` item with `status: pendente` (not `n/a`)"); [:120](../../../agents/doc-planner.md) forbids waiving an inviolable doc in silence. [classification.json](classification.json) carries `flags: ["architecture", "contract"]`. The doc-leash that enforces it is `check-doc-manifest.js`, flow-wired at [full.yaml:396](../../../governance/flows/full.yaml) / [fast.yaml:213](../../../governance/flows/fast.yaml). [ADR-015](../../decisions/ADR-015-readiness-owns-internals-claims-gate.md) exists and `check-adr-format.js` returns `{"ok":true,"adrs_checked":1}` on it.
- **The step-count ripple, enumerated** — `grep -rn "13-step\|13 steps\|13 planning" --include="*.md" .`, excluding `docs/archive/` (WORM) and this change package, returns **9 hits in 6 files**. **8 of them, in 5 files, are the edit targets**: [PROCESS.md:73](../../../PROCESS.md), [:100](../../../PROCESS.md), [:182](../../../PROCESS.md), [docs/guides/existing-repo-flow.md:119](../../guides/existing-repo-flow.md), [docs/guides/change-flow.md:112](../../guides/change-flow.md), [docs/reference/skills.md:16](../../reference/skills.md), [:60](../../reference/skills.md), [skills/catalog/INDEX.md:27](../../../skills/catalog/INDEX.md). The **9th is not an edit target**: [ADR-015 §Consequences](../../decisions/ADR-015-readiness-owns-internals-claims-gate.md) states the ripple in the past tense as part of the decision record.
- **Acceptance-criteria plumbing** — ids reach the leash through [parse-criteria.js:117-129](../../../governance/acceptance/parse-criteria.js), which prefers `.aidakit/tasks/<change-id>/brainstorm.json` and falls back to `proposal.md`'s `## Acceptance criteria` bullets parsed by `EXPLICIT_BULLET_RE = /^-\s+\`([a-z0-9-]+)\`\s+—\s+(.+)$/` at [:19](../../../governance/acceptance/parse-criteria.js). This package's `## Acceptance criteria` bullets use that exact form with the 4 remaining brainstorm ids verbatim, so both sources agree.
- **Test idiom + runner** — no framework, `let pass = 0, fail = 0; function ok(c, n) {…}`, real CLI driven through `spawnSync`, JSON parsed off stdout's last line, `process.exit(fail ? 1 : 0)` — [check-adr-format.test.mjs:1-45](../../../governance/__tests__/check-adr-format.test.mjs). Single file runs as `node governance/__tests__/<file>.test.mjs` ([governance/README.md:12](../../../governance/README.md)).
- **Proposal template obligation** — `## Acceptance criteria` **and** `## Exit criteria` are both required for new proposals, per [docs/features/README.md:12](../README.md).
- **Plugin version** — `plugin.json` is at `0.9.0` and the readiness footer declares `v0.2`; `check-plugin-version` fails only when a footer declares **more** than `plugin.json`, so no footer bump is needed or wanted.

## New files (created by this change)

- `docs/decisions/ADR-015-readiness-owns-internals-claims-gate.md` — the decision record; **already authored in this plan package** and passing `check-adr-format` (so it is not, in fact, a pending citation — it is listed here for completeness of the created-file set).

## Alternatives considered

Each row below is carried into [ADR-015 §Alternatives considered](../../decisions/ADR-015-readiness-owns-internals-claims-gate.md), which is the durable record; this table is the working restatement.

| Option | Why rejected / status |
|---|---|
| **Semantic checklist only, with no mechanical check at all** | Originally rejected as leaving anchor rot unguarded, a real, cheap-to-check failure mode. **This is what actually ships** as of the 2026-07-25 split — not because the reasoning against it changed, but because the mechanical check's own extractor was not reliable enough to ship after four bench rounds. The gap is accepted for now; see §Mechanical check: split out. |
| **Own the gate in `skills/plan/SKILL.md` or `agents/planner.md`** | `plan` only assembles a prompt and dispatches — it cannot gate from inside the flow; and the incident is precisely a case where the **author's** self-check passed. The independent reviewer must own it. |
| **Insert the new step as `§5` (next to the design review) and renumber §5-§13** | Renumbering ripples into the output template and into every doc that references the numbered steps, for zero semantic gain. Appended as Process §14 + one cross-reference bullet in Process §4. |

## Consequences

- **Positive:** the class of error that shipped in `flow-step-summaries` now has an explicit, numbered owner with a written severity; the roadmap stops naming a ghost path; the gate ships without waiting on a mechanical surface that was not yet reliable.
- **Negative — "the semantic gate is the real gate" is a statement about *authority*, not about *enforcement*.** Nothing mechanically observes whether a reviewer actually re-derived anything for Process §14. The flow consumes the **aggregate** readiness verdict ([full.yaml:166-180](../../../governance/flows/full.yaml), [fast.yaml:100-111](../../../governance/flows/fast.yaml)) — `approved` / `needs-revision` / `blocked` — exactly as it already does for Process §1-§13; there is no per-step signal to gate on, for §14 or for any other step of any review skill in the kit. **Accepted** ([ADR-015](../../decisions/ADR-015-readiness-owns-internals-claims-gate.md) records it): the mitigation is textual precision — the three named shapes, the trigger phrasings ("every X does Y", "always populated"), and a pre-assigned severity — not machinery. Read this change as *raising the odds* the class gets caught, not as *guaranteeing* it.
- **Negative — anchor rot is unguarded until the split-out change ships.** **Accepted, deliberately**: shipping a mechanical check with a known blocking blind spot (17 silent misses in this repo's own corpus) would have been worse than shipping no mechanical check at all — see §Mechanical check: split out.
- **Negative — "13-step" prose becomes "14-step" at 8 edit sites across 5 files** (9 grep hits in 6 files; the 9th is ADR-015's own record of the ripple). **Accepted**: a one-token edit per site, enumerated with line numbers in [tasks.md](tasks.md) §7, and leaving it stale would be exactly the unverified-claim failure this change exists to prevent.

## Rollback notes

Fully additive and self-contained. Revert = drop Process `### 14` and the §4 cross-reference bullet from `skills/readiness/SKILL.md`; revert `14` → `13` at the 8 sites in 5 docs; revert the epic line. No state, no migration, no flow YAML touched, no validator or test file to remove (none ship in this revision).

**The ADR is the one thing that does not roll back.** [ADR-015](../../decisions/ADR-015-readiness-owns-internals-claims-gate.md) is WORM ([DOCS.md](../../../DOCS.md) §2): if the decision is reversed later, that is a **new** superseding ADR plus an index update — never a deletion of ADR-015 and never an edit to its body. A revert of the *code* leaves ADR-015 standing as the record of what was decided and why it was undone.
