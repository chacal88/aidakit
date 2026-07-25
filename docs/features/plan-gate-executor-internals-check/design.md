# Design — plan-gate-executor-internals-check

**Change ID:** `plan-gate-executor-internals-check`
**Date:** `2026-07-25`
**Owner:** `@chacal88`
**Phase / Package:** `skills/readiness + governance/validators — the plan gate verifies internals claims against live code`
**PRD:** `n/a`
**Tech Spec:** `n/a`

## The incident, stated plainly (why the mechanical check is SECONDARY)

The false claim that motivated this change was **unanchored prose**, not a stale anchor.

- **The claim.** *"the renderer resolves `{outcome}` from `context[step.id].outcome` (populated by every pause-emitting executor)"* — [flow-step-summaries/design.md:92](../../archive/2026-07-24-flow-step-summaries/design.md). It originates one artifact earlier, in the `## What Changes` bullet at [flow-step-summaries/proposal.md:21](../../archive/2026-07-24-flow-step-summaries/proposal.md) (*"populated by the step executor: `context[step.id].outcome`, … `context[step.id].choice` on a `human_gate`"*).
- **Why it is false.** Only [invoke.js:154-155](../../../governance/engine/steps/invoke.js) writes `bag.outcome`. [human-gate.js](../../../governance/engine/steps/human-gate.js) writes `.choice`; [human-handoff.js](../../../governance/engine/steps/human-handoff.js) writes `.response`. The set the sentence quantified over has three members and the property holds for one.
- **Why an anchor-grep would not have caught it.** The sentence carries **no anchor at all**. Worse: the same `design.md` carries ~15 well-formed anchors, and the implementer re-verified **every one of them at setup**, reporting *"No correction needed at setup time"* — [flow-step-summaries/evidence.md:8-18](../../archive/2026-07-24-flow-step-summaries/evidence.md). That setup pass is functionally identical to what `check-design-claims.js` automates. **A grep of the anchors returned PASS at the exact moment the bug was written**, and the bug surfaced later, mid-Task-4 GREEN.
- **The shape of the error.** A **generalization built on correct citations**. Each cited fact — invoke writes `.outcome`, human-gate writes `.choice`, human-handoff writes `.response` — was individually true and individually anchored, at [flow-step-summaries/design.md:18-27](../../archive/2026-07-24-flow-step-summaries/design.md). The summing sentence was not.

Consequences for this design, in order:

1. The **primary** gate must be semantic and must explicitly cover unanchored claims and generalizations. Only a reader who enumerates the quantified set catches this class. That is `skills/readiness/SKILL.md` **Process §14**.
2. The **secondary** gate is the anchor grep. It guards a real but *different* risk — **anchor rot**: code moving between plan authoring and review/implementation, turning a once-correct `file.js:NN` into a pointer at unrelated lines or a deleted file. Real, cheap to check, and provably not the risk that bit us.
3. The validator's header comment must say this, so the next person does not re-invent "just grep the anchors" as a sufficient gate. Same slot the `CROSS-VALIDATION` note occupies at [check-acceptance.js:28-34](../../../governance/validators/check-acceptance.js).

## Why `readiness` owns it (not `plan`, and not `planner`)

- `skills/planner/SKILL.md` **does not exist**. `skills/` has `plan/` and `readiness/`; the plan-authoring surfaces are [skills/plan/SKILL.md](../../../skills/plan/SKILL.md) (assembles a prompt and dispatches; it cannot gate anything mechanically from inside the flow) and [agents/planner.md](../../../agents/planner.md) (the agent that actually writes `design.md`). Every artifact of this change resolves "the planner skill" to a real path; the roadmap line that names the ghost is corrected here (criterion `planner-naming-corrected`). **Scoping note for that criterion:** this bullet, the criterion text in [proposal.md](proposal.md), and the flow-authored [classification.json](classification.json) (which quotes the original roadmap line verbatim and is not rewritten) do spell the string — exclusively to declare it absent. The mechanical form of "no artifact references the ghost path" is therefore: **no markdown link targets it, no command invokes it, and it occurs zero times on any kit surface (`skills/`, `governance/`, `agents/`, `commands/`, `docs/roadmap/`)** — see [proposal.md](proposal.md) §Exit criteria.
- `aidakit:readiness` is a **mandatory `invoke` gate in both flows** — [full.yaml:166-180](../../../governance/flows/full.yaml) and [fast.yaml:100-111](../../../governance/flows/fast.yaml) — with a machine-parsed verdict (`Status:` / `Ready to implement:`, [skills/readiness/SKILL.md:416](../../../skills/readiness/SKILL.md)). Blocking is already its job.
- The incident is itself the argument: the author's own setup self-check ran and passed. The gate belongs to the **independent reviewer**, not to the author who wrote the sentence.

## Surface 1 (PRIMARY) — the new mandatory step in `skills/readiness/SKILL.md`

### Placement

Appended as `### 14`, **after** [§13 "Answer the mandatory review questions" (line 296)](../../../skills/readiness/SKILL.md) and **before** [`### Severity classification` (line 311)](../../../skills/readiness/SKILL.md). Rationale: appending avoids renumbering §5-§13 and avoids touching the 15-section output template at [lines 363-414](../../../skills/readiness/SKILL.md), which is the doc's machine-facing contract. Findings from Process §14 are reported inside the **existing** output sections `## 4. Design review` and `## 11. Mandatory fixes before implementation` — no new output section, no template renumbering. One cross-reference bullet is added to the checklist of [§4 "Review the design" (line 165)](../../../skills/readiness/SKILL.md) so a reviewer working top-down meets the rule where design claims are read.

The step count in the prose that advertises this skill ("13-step") becomes 14 at **8 edit sites across 5 files**, enumerated with line numbers in [tasks.md](tasks.md) §7 (the grep returns 9 hits in 6 files; the 9th is ADR-014's own past-tense mention, not a target — see §Grounding) — leaving them stale would itself be an unverified claim about internals, which is precisely what this change exists to stop. (`docs/OVERVIEW.md` is edited too, but for the validator table only: it carries no step count.)

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

Optional mechanical pre-pass — **defence-in-depth, never a substitute**:

```bash
: "${AIDAKIT_GOVERNANCE?agent-validator-paths: AIDAKIT_GOVERNANCE not set — SessionStart hook missing (see docs/guides/flows.md §6)}"
node "$AIDAKIT_GOVERNANCE/validators/check-design-claims.js" <change-root>
```

Exit 0 means no cited anchor has rotted (file present, cited line within the file). It does **not** mean any claim is true: shapes 2 and 3 are invisible to it, and the incident above passed an identical anchor re-check. Exit 1 lists the rotten anchors — each is at least `Medium` / `Fix during implementation`, and `High` when the design's conclusion depends on the rotten anchor. `skipped[]` entries (citations the validator cannot locate mechanically, e.g. a bare `cli.js:121`) are yours to resolve by hand. If `Bash` is unavailable in the session running this skill, do the anchor spot-check with `Read`/`Grep` and say so in the review — the semantic pass above is the gate and needs only `Read`/`Grep`.

Report every failed re-derivation in `## 4. Design review` with severity + fix classification per the evidence standard, and mirror the `Critical` ones into `## 11. Mandatory fixes before implementation`.
````

### Call-site contract (binding)

The `bash` block above is **not** free-form. [ADR-004](../../decisions/ADR-004-aidakit-governance-env-contract.md), as broadened by [ADR-012](../../decisions/ADR-012-aidakit-governance-session-wide.md), locks the shape of every direct-invocation call site in `agents/`, `skills/`, `commands/`:

- `node "$AIDAKIT_GOVERNANCE/validators/…"` — bare `$` (the engine's `interpolateString` only substitutes `${…}`), double-quoted (the plugin cache path may contain spaces). A relative `node governance/validators/…` is **forbidden** and mechanically caught: the filtered sweep at [agent-validator-paths.test.mjs:90-99](../../../governance/__tests__/agent-validator-paths.test.mjs) fails on any such hit under `agents/|skills/|commands/`, with only `skills/catalog/INDEX.md` and `skills/review/SKILL.md` excluded.
- The fail-closed guard one-liner must be **byte-identical** to the canonical literal, live at [skills/roadmap/SKILL.md:64](../../../skills/roadmap/SKILL.md). This change adds `skills/readiness/SKILL.md` to `SOURCE_FILES` at [agent-validator-paths.test.mjs:47-64](../../../governance/__tests__/agent-validator-paths.test.mjs), so the byte-identity assertion covers the new call site instead of trusting the author's transcription.

**A conflicting record, named rather than reasoned past.** [ADR-013:28](../../decisions/ADR-013-context-pack-per-change.md) (§Decision 6) says the upstream `context_pack` `runs` phase "is the only place where `$AIDAKIT_GOVERNANCE` per ADR-004 is available", and [ADR-013:46](../../decisions/ADR-013-context-pack-per-change.md) (§Consequences) states outright that `$AIDAKIT_GOVERNANCE` "reaches `runs`-step children only, never agent/skill Bash sessions" and that "the `agent-validator-paths` gap … remains OPEN". Taken at face value that is the **opposite** premise to this design's call site. It is stale, and verifiably so:

- ADR-013 is quoting ADR-004's §Consequences bullet as written **before** its amendment; that bullet was explicitly `Mitigated`, not closed, and [ADR-004 §Amendments](../../decisions/ADR-004-aidakit-governance-env-contract.md) now records that [ADR-012](../../decisions/ADR-012-aidakit-governance-session-wide.md) "closes the `Mitigated` bullet".
- ADR-012 is **accepted**; ADR-013 is **proposed** ([docs/decisions/README.md](../../decisions/README.md) index).
- The debit ADR-013 calls OPEN has shipped: `hooks/session-start.js` exists on disk and the change is archived at [2026-07-24-agent-validator-paths](../../archive/2026-07-24-agent-validator-paths/proposal.md).

So the newer accepted decision governs for direct-invocation call sites, and this design rests on ADR-012. Correcting ADR-013's sentence is **out of scope** (WORM — it needs its own amendment); it is named here, and in [ADR-014 §Decision 3](../../decisions/ADR-014-readiness-owns-internals-claims-gate.md), so the next reader does not have to rediscover the contradiction. In a change whose thesis is "re-derive before asserting", silently relying on the winning record would have been the wrong kind of confidence.

### Open point — is `Bash` actually available where `aidakit:readiness` runs?

**Resolved as far as the code can resolve it, with one residual named honestly.**

- `aidakit:readiness` is a **skill**, not an agent: there is no `agents/readiness.md` (the 13 files in `agents/` are acceptance-planner, adr-reviewer, brainstorm, doc-planner, implementer, orchestrator, planner, research, reviewer-architecture, reviewer-quality, reviewer-security, spec-reviewer, tester). Only agent files carry a `tools:` frontmatter whitelist; [skills/readiness/SKILL.md:1-4](../../../skills/readiness/SKILL.md) declares only `name` and `description` — no `allowed-tools`, so the skill inherits the tool set of whatever session loads it.
- The flow does not dispatch it either: `invoke` is **inversion of control** — the engine "has NO way to dispatch a skill/subagent", so it records the request and **pauses**, asking the operator Claude to run it and resume ([invoke.js:1-7](../../../governance/engine/steps/invoke.js), corroborated at [governance/README.md:20](../../../governance/README.md), which names `invoke_target: aidakit:readiness` as a skill). The session that resolves the pause is the same one running `node governance/cli.js resume` — a Bash tool call by construction.
- The skill **already prescribes a shell command today**: the `openspec validate …` block at [skills/readiness/SKILL.md:99-109](../../../skills/readiness/SKILL.md). Adding a second one introduces no new capability assumption.

**Residual (accepted, not assumed away):** nothing *pins* the execution surface. A caller may choose to dispatch `aidakit:readiness` inside a `Task` subagent (e.g. `general-purpose`), and then the tool set is that agent's, not the skill's. Mitigation is in the step's own text: the mechanical pre-pass is explicitly **optional**, with a written `Read`/`Grep` fallback, and the primary semantic gate needs only `Read`/`Grep`. A missing `Bash` therefore degrades the secondary check, never the gate. The alternative — pinning readiness to a new `agents/readiness.md` with `tools: Read, Grep, Glob, Bash` — is rejected below.

## Surface 2 (SECONDARY) — `governance/validators/check-design-claims.js`

### CLI / argv contract

Modeled on the target-list validators ([check-adr-format.js:75-92](../../../governance/validators/check-adr-format.js), [check-links.js:81-98](../../../governance/validators/check-links.js)) rather than on the single-manifest form of [check-acceptance.js:49-53](../../../governance/validators/check-acceptance.js), because the natural argument here is a change directory:

```
node check-design-claims.js <change-dir-or-md-file> [...] [--json]
```

- `process.argv.slice(2)`; `--json` is the only flag; every non-`--` token is a target. Zero targets → `usage: check-design-claims <change-dir-or-md-file> [...]` on stderr, **exit 2** (same shape as `check-adr-format.js:79`).
- **Directory target** → scans exactly `design.md` and `proposal.md` inside it (no recursion, no `specs/`, no `tasks.md`). The **change dir** is the directory itself.
- **File target** → scanned as given; the **change dir** is its `dirname`.
- A target that does not exist → **exit 2** (usage/error), not a finding: an unresolvable target is operator error, not plan rot.
- Files under `docs/archive/` are **not scanned** and are listed in `skipped[]` with rule `archived-source` — WORM jurisprudence, the same carve-out and rationale as [check-links.js:15-18](../../../governance/validators/check-links.js). Citations *pointing into* `docs/archive/**` are checked normally (archived files are frozen, so they are the most stable anchors there are — this change's own design.md relies on that).
- Project root for root-relative resolution: `AIDAKIT_PROJECT_ROOT` when set, else `findProjectRoot(dirname(resolve(target)))` — the exact climb of [check-acceptance.js:90-93](../../../governance/validators/check-acceptance.js), importing the same `../engine/project-root.js`.

### Citation extraction

Per file, line by line, **skipping fenced code blocks** by toggling on a line whose trim starts with ```` ``` ```` — the loop shape of [check-links.js:55-79](../../../governance/validators/check-links.js). Code fences hold examples, not claims.

Three forms, in this precedence:

1. **Linked** (the repo's dominant form, e.g. `[governance/engine/engine.js:196-207](../../../governance/engine/engine.js)` and `[invoke.js:79-87](../../../governance/engine/steps/invoke.js)`): a markdown link — matched with the same `LINK_RE` as [check-links.js:23](../../../governance/validators/check-links.js) — whose **label** ends with `<something>.<ext>:<NN>` or `:<NN>-<MM>`. The **path is the link target**, resolved relative to `dirname(file)` exactly as [check-links.js:93](../../../governance/validators/check-links.js) does; the **lines come from the label**. This form is what makes basename-only labels checkable, because the target carries the real path.
2. **Bare, root-relative** (e.g. `` `governance/validators/check-acceptance.js:28-34` `` in prose or inline code): a token matching `(?:[A-Za-z0-9._@-]+\/)+[A-Za-z0-9._-]+\.[A-Za-z0-9]+:\d+(?:-\d+)?`. At least one `/` is **required** — that is what makes the path resolvable from the project root.
3. **Bare, basename-only** (e.g. `` `cli.js:121-131` ``, not inside a link): mechanically unlocatable — a repo can hold many `cli.js`. Recorded in `skipped[]` with rule `citation-unresolvable`. **Never an error**, because the criterion scopes failure to "the anchor no longer resolves", and "the validator cannot tell which file you meant" is a different statement. This is an acknowledged hole in the secondary check, closed by the primary semantic gate, not by guessing.

Same target cited twice → checked twice, reported once per occurrence (line number differs, so the reviewer can find each).

### Failure rules — exactly two

| rule | fires when |
|---|---|
| `citation-file-missing` | the resolved path does not exist on disk (and no new-file waiver applies) |
| `citation-line-out-of-range` | the file exists but `NN` — or the range end `MM` — is greater than the file's current line count |

Nothing else fails. No format policing, no "you cited without a line", no truth-checking. Line counting: `content.split(/\r?\n/)`, drop a single trailing empty element (a file ending in `\n` must not report a phantom last line), `lineCount = lines.length`. A citation of `:0` is out of range by the same rule (`NN < 1`).

### New-file exclusion (criterion `new-file-citations-excluded`)

A plan legitimately cites files it is about to create. Without a waiver, every non-trivial change false-positives on its own deliverables.

Waiver source, machine-readable and human-readable at once: the change's `design.md` may carry a section

```md
## New files (created by this change)

- `path/to/created-file.js` — one line on what it is.
- `path/to/created-file.test.mjs` — …
```

The validator collects the **first inline-code span of each bullet** under that heading (heading match: `/^#+\s*New files\b/i`; stop at the next heading) as the waived set, normalized to project-root-relative.

**The waiver scan skips fenced code blocks, exactly like the citation scan.** Without that rule an *illustrative* `## New files` block inside a ```` ```md ```` fence — like the one directly above, which lives in this very design — would be read as a real declaration, and a design could hand itself waivers it never declared. The heading and its bullets count only when they appear as live markdown, outside any fence.

**Corroboration, per the brainstorm's assumption on exclusions:** the waiver applies only if the same literal path string also appears somewhere in the change dir's `tasks.md`. No `tasks.md`, or path absent from it → **the waiver is withheld** and the citation is judged by the normal rules (so a "new file" nobody planned still fails as `citation-file-missing`). This gives the cross-check teeth **without adding a third failure rule**, keeping "fails ONLY when the anchor no longer resolves" literally true.

Waived citations are counted in `waived_new_files` and listed in `skipped[]` with rule `new-file-waived`. If a waived path **does** exist on disk, the waiver is not used — the anchor is checked normally (the file is real now; its line count is checkable).

### Output contract

Always JSON on stdout, one line; markdown report on stderr unless `--json` (the shape of `check-adr-format.js:83-91` / `check-links.js:99-110`):

```json
{
  "validator": "aidakit.check-design-claims",
  "ok": true,
  "files_checked": 2,
  "citations_checked": 14,
  "waived_new_files": 2,
  "skipped": [{ "rule": "citation-unresolvable", "file": "…/design.md", "line": 92, "citation": "cli.js:121-131" }],
  "errors": []
}
```

`errors[]` items: `{ rule, file, line, citation, path, message }` — `file`/`line` locate the *claim*, `path` the *cited target*.

Exit codes, matching the contract line every validator in this repo declares ([check-acceptance.js:8](../../../governance/validators/check-acceptance.js), [check-adr-format.js:7](../../../governance/validators/check-adr-format.js)): **0** pass · **1** findings · **2** usage/error.

### Header comment (criterion `precedent-incident-documented`)

First block of the file, in the register of [check-acceptance.js:28-34](../../../governance/validators/check-acceptance.js):

```js
// check-design-claims — CITATION-STALENESS check for a change package. SECONDARY
// by decision: it greps every `<file>.<ext>:<NN>` / `:<NN>-<NN>` citation in the
// change's design.md/proposal.md and fails only when the anchor no longer
// resolves (file gone, or cited line past the file's current line count).
//
// IT IS NOT A TRUTH-CHECKER. It cannot tell whether a sentence about engine
// internals is correct, and it never tries.
//
// WHY SECONDARY (the incident that motivated this validator): in
// `flow-step-summaries`, the design claimed `context[step.id].outcome` is
// "populated by every pause-emitting executor"
// (docs/archive/2026-07-24-flow-step-summaries/design.md:92, originating at
// that change's proposal.md:21). It is false — only invoke.js writes .outcome;
// human-gate.js writes .choice, human-handoff.js writes .response. The claim
// carried NO anchor, and the implementer re-verified every OTHER anchor in that
// design at setup with no correction needed
// (…/flow-step-summaries/evidence.md:8-18). THIS VALIDATOR WOULD HAVE RETURNED
// PASS at the exact moment the bug was written. The gate that catches that class
// is the semantic step 14 of skills/readiness/SKILL.md — re-derive the claim,
// enumerate what a generalization quantifies over. Do not re-invent "just grep
// the anchors" as if it sufficed.
//
// Pure Node, zero-dep. Contract: exit 0 pass · 1 findings · 2 usage/error.
```

## Grounding (verified against the code)

Every internals claim above was re-derived by opening the file at the cited line during this authoring session. This section is the audit trail; `skills/readiness/SKILL.md` Process §14 is the rule that will be applied to it.

- **Validator contract shape (argv / envelope / exit codes)** — [check-acceptance.js:8](../../../governance/validators/check-acceptance.js) declares `Contract: exit 0 pass · 1 incomplete · 2 usage/error`; argv parsing at [:49-53](../../../governance/validators/check-acceptance.js) (`process.argv.slice(2)`, `--json` flag, first non-`--` token as the path); the success envelope `{validator, ok, …, errors[]}` written to stdout at [:142-151](../../../governance/validators/check-acceptance.js); stderr markdown report gated on `!jsonOnly` and the final `process.exit(errors.length === 0 ? 0 : 1)` at [:152-162](../../../governance/validators/check-acceptance.js). Note the **asymmetric exit-2 paths** documented in-file: the bad-JSON path emits stderr only ([:56-63](../../../governance/validators/check-acceptance.js)) while the invalid-`required` path emits a full envelope ([:74-88](../../../governance/validators/check-acceptance.js)). This design takes the *envelope-emitting* branch as the model, but for the no-targets case emits the stderr-only usage line, matching [check-adr-format.js:79](../../../governance/validators/check-adr-format.js) — the closer sibling by argv shape.
- **Target-list validators** — collection + per-target loop + `{validator, ok, <count>, errors}` envelope at [check-adr-format.js:75-92](../../../governance/validators/check-adr-format.js); the same at [check-links.js:81-112](../../../governance/validators/check-links.js).
- **Markdown link extraction and resolution** — `LINK_RE = /\[[^\]]*\]\(([^)]+)\)/g` at [check-links.js:23](../../../governance/validators/check-links.js); fenced-block skipping and per-line scan at [:55-79](../../../governance/validators/check-links.js); `resolve(dirname(file), path)` + `existsSync` at [:93-97](../../../governance/validators/check-links.js).
- **Archive carve-out rationale** — [check-links.js:15-18](../../../governance/validators/check-links.js): `docs/archive/` skipped on the walk because "an archived doc's links reflect the tree at archive time, not today's". Same reason applies to archived citations.
- **Project-root climb** — `AIDAKIT_PROJECT_ROOT` else `findProjectRoot(dirname(resolve(...)))` at [check-acceptance.js:90-93](../../../governance/validators/check-acceptance.js).
- **The standalone precedent, with its exception named.** `check-adr-format.js` appears in **no** `runs:` command of any shipped flow — `grep -n "validators/" governance/flows/*.yaml` returns 21 hits across `docs-onboarding.yaml`, `fast.yaml` and `full.yaml`, and none of them is `check-adr-format.js`. **Exception (the generalization "it is never run by the engine" would be false):** it *is* executed as a child process by `check-doc-manifest.js`, which resolves it at [check-doc-manifest.js:53](../../../governance/validators/check-doc-manifest.js) (`new URL("./check-adr-format.js", import.meta.url)`) and `execFileSync`s it for every `kind: "adr"` item at [:66-73](../../../governance/validators/check-doc-manifest.js); `check-doc-manifest.js` **is** flow-wired, at [full.yaml:396](../../../governance/flows/full.yaml) and [fast.yaml:213](../../../governance/flows/fast.yaml). So the precedent supports "a validator may live outside any `runs:` step", **not** "a validator outside `runs:` still reaches the flow somehow". `check-design-claims.js` has no doc-manifest equivalent: the only thing that runs it is the instruction in `skills/readiness/SKILL.md`. That is a weaker enforcement position than `check-adr-format.js` enjoys, and it is accepted deliberately (see §Consequences).
- **`aidakit:readiness` is a mandatory `invoke` gate in both flows** — [full.yaml:166-180](../../../governance/flows/full.yaml) (`expects: approved|needs-revision|blocked`, `outputs: {needs-revision: [cause]}`, `on_result.approved: context_pack`, `blocked: aborted`) and [fast.yaml:100-111](../../../governance/flows/fast.yaml) (same outcomes, `needs-revision: plan`).
- **`invoke` is inversion of control** — [invoke.js:1-7](../../../governance/engine/steps/invoke.js): "the engine has NO way to dispatch a skill/subagent … an `invoke` step records the request in the flow state and PAUSES". First entry builds the prompt and returns `{kind: "pause"}` at [:161-194](../../../governance/engine/steps/invoke.js); the resume branch persists `bag.outcome` / `bag.invoke_target` into `context[step.id]` at [:146-158](../../../governance/engine/steps/invoke.js). Corroborated in prose at [governance/README.md:20](../../../governance/README.md).
- **The readiness skill's structure** — numbered `### 1`-`### 13` under `## Process` starting at [line 113](../../../skills/readiness/SKILL.md); `### 4. Review the design` at [line 165](../../../skills/readiness/SKILL.md); `### 13. Answer the mandatory review questions` at [line 296](../../../skills/readiness/SKILL.md); `### Severity classification` at [line 311](../../../skills/readiness/SKILL.md) (`Critical`/`High`/`Medium`/`Low`); `### Fix classification` at [line 320](../../../skills/readiness/SKILL.md) (`Mandatory before implementation` / `Fix during implementation` / `Nice-to-have` / `Out of scope`); the 15-section output template at [lines 363-414](../../../skills/readiness/SKILL.md); the verbatim-verdict rule at [line 416](../../../skills/readiness/SKILL.md). An existing `bash` block already lives at [lines 99-109](../../../skills/readiness/SKILL.md).
- **Frontmatter** — [skills/readiness/SKILL.md:1-4](../../../skills/readiness/SKILL.md) declares `name` + `description` only; no `allowed-tools`. Agent files are where tool whitelists live (e.g. `tools: Read, Bash, Edit, Write, Glob, Grep` in [agents/planner.md:4](../../../agents/planner.md)). There is no `agents/readiness.md`.
- **The call-site contract** — the fail-closed guard literal, live, at [skills/roadmap/SKILL.md:64](../../../skills/roadmap/SKILL.md); the byte-identity assertion over `SOURCE_FILES` at [agent-validator-paths.test.mjs:47-64](../../../governance/__tests__/agent-validator-paths.test.mjs); the relative-path sweep that must stay empty at [:90-99](../../../governance/__tests__/agent-validator-paths.test.mjs) (only `skills/catalog/INDEX.md` and `skills/review/SKILL.md` excluded). Decision text at [ADR-012 §Decision](../../decisions/ADR-012-aidakit-governance-session-wide.md) ("18 in-scope hits … guards with the POSIX `?word` parameter-expansion idiom"), value semantics at [ADR-004 §Decision](../../decisions/ADR-004-aidakit-governance-env-contract.md).
- **Acceptance-criteria plumbing** — ids reach the leash through [parse-criteria.js:117-129](../../../governance/acceptance/parse-criteria.js), which prefers `.aidakit/tasks/<change-id>/brainstorm.json` and falls back to `proposal.md`'s `## Acceptance criteria` bullets parsed by `EXPLICIT_BULLET_RE = /^-\s+\`([a-z0-9-]+)\`\s+—\s+(.+)$/` at [:19](../../../governance/acceptance/parse-criteria.js). This package's `## Acceptance criteria` bullets use that exact form with the 6 brainstorm ids verbatim, so both sources agree. `check-acceptance.js` cross-validates the two at [check-acceptance.js:125-140](../../../governance/validators/check-acceptance.js) (`criterion-orphan`).
- **Test idiom + runner** — no framework, `let pass = 0, fail = 0; function ok(c, n) {…}`, real CLI driven through `spawnSync`, JSON parsed off stdout's last line, `process.exit(fail ? 1 : 0)` — [check-adr-format.test.mjs:1-45](../../../governance/__tests__/check-adr-format.test.mjs). Single file runs as `node governance/__tests__/<file>.test.mjs` ([governance/README.md:12](../../../governance/README.md)).
- **Proposal template obligation** — `## Acceptance criteria` **and** `## Exit criteria` are both required for new proposals, per [docs/features/README.md:12](../README.md).
- **Plugin version** — `plugin.json` is at `0.9.0` and the readiness footer declares `v0.2`; `check-plugin-version` fails only when a footer declares **more** than `plugin.json`, so no footer bump is needed or wanted.
- **The ADR is mandatory, not optional** — [agents/doc-planner.md:47](../../../agents/doc-planner.md): "**the `arquitetura` flag REQUIRES an ADR** (changing structure/responsibility/boundary = a recordable decision)"; [:95](../../../agents/doc-planner.md) makes it a manifest verification item ("A change with the `arquitetura` flag has at least one `kind: adr` item with `status: pendente` (not `n/a`)"); [:120](../../../agents/doc-planner.md) forbids waiving an inviolable doc in silence. [classification.json](classification.json) carries `flags: ["architecture", "contract"]`. The doc-leash that enforces it is `check-doc-manifest.js`, flow-wired at [full.yaml:396](../../../governance/flows/full.yaml) / [fast.yaml:213](../../../governance/flows/fast.yaml) — so the first plan's "no new ADR" promise was **mechanically unsatisfiable**, not merely undesirable. Corrected in this revision: [ADR-014](../../decisions/ADR-014-readiness-owns-internals-claims-gate.md) exists and `check-adr-format.js` returns `{"ok":true,"adrs_checked":1}` on it.
- **The `§14` collision** — `skills/readiness/SKILL.md` carries `## 14. Mandatory review questions` at [line 407](../../../skills/readiness/SKILL.md) (output template) while the Process list currently ends at `### 13.` ([line 296](../../../skills/readiness/SKILL.md)). Hence the "Process §14" qualifier everywhere.
- **`docs/OVERVIEW.md` validator table** — the `check-links` row is at [line 123](../../../docs/OVERVIEW.md) (the table's `check-doc-manifest`/`check-adr-format` rows are 121/122); the new row goes after 123. That table lists validators only — it carries no readiness step count.
- **The step-count ripple, enumerated** — `grep -rn "13-step\|13 steps\|13 planning" --include="*.md" .`, excluding `docs/archive/` (WORM) and this change package, returns **9 hits in 6 files**. **8 of them, in 5 files, are the edit targets**: [PROCESS.md:73](../../../PROCESS.md), [:100](../../../PROCESS.md), [:182](../../../PROCESS.md), [docs/guides/existing-repo-flow.md:119](../../guides/existing-repo-flow.md), [docs/guides/change-flow.md:112](../../guides/change-flow.md), [docs/reference/skills.md:16](../../reference/skills.md), [:60](../../reference/skills.md), [skills/catalog/INDEX.md:27](../../../skills/catalog/INDEX.md). The **9th is not an edit target**: [ADR-014 §Consequences](../../decisions/ADR-014-readiness-owns-internals-claims-gate.md) states the ripple in the past tense as part of the decision record. Stating "8 across 5" without naming the exclusion — as the previous revision of this bullet did — was itself a miscount under its own stated methodology, since `docs/decisions/` was never excluded. Recorded rather than quietly corrected: it is the same defect class as the incident in §The incident, committed in the artifact meant to prevent it.
- **ADR-013's stale premise** — [ADR-013:28](../../decisions/ADR-013-context-pack-per-change.md) and [:46](../../decisions/ADR-013-context-pack-per-change.md), against `hooks/session-start.js` on disk and the archived [2026-07-24-agent-validator-paths](../../archive/2026-07-24-agent-validator-paths/proposal.md). See §Call-site contract.
- **A live specimen of what the mechanical check cannot see.** The first revision of [proposal.md](proposal.md) cited `fast.yaml:100-110` for the readiness step; the step's last line (`blocked: aborted`) is **111**. `fast.yaml` has 330 lines, so `110` is comfortably **in range** — `check-design-claims.js` would have returned `ok: true` on that citation. Only a human opening the file at that range catches it, and both critics did. It is corrected in `proposal.md`, and kept documented here because it is exactly the failure mode Process §14 exists for and the anchor grep provably cannot cover: **an anchor that resolves is not an anchor that is right.**

## New files (created by this change)

- `governance/validators/check-design-claims.js` — the secondary anchor-staleness validator.
- `governance/__tests__/check-design-claims.test.mjs` — its table test, including the new-file-waiver case.
- `docs/decisions/ADR-014-readiness-owns-internals-claims-gate.md` — the decision record; **already authored in this plan package** and passing `check-adr-format` (so it is not, in fact, a pending citation — it is listed here for completeness of the created-file set).

## Alternatives considered

Each row below is carried into [ADR-014 §Alternatives considered](../../decisions/ADR-014-readiness-owns-internals-claims-gate.md), which is the durable record; this table is the working restatement.

| Option | Why rejected |
|---|---|
| **Mechanical validator only** (the roadmap line's preferred "pino") | Provably would have returned PASS on the incident that motivated the feature ([evidence.md:8-18](../../archive/2026-07-24-flow-step-summaries/evidence.md)). Shipping it alone would have created the illusion of a gate. |
| **Semantic checklist only** | Leaves anchor rot unguarded — a real, cheap-to-check failure mode once a plan sits for a few days. Owner chose (c) both. |
| **Wire the validator as a `runs:` step with `on_failure` routing** | Adds step semantics + failure routing in the [ADR-010](../../decisions/ADR-010-acceptance-leash.md)/[ADR-011](../../decisions/ADR-011-runs-infra-error-routing.md) mould, makes the *weaker* gate the blocking one, and breaches the epic's *"cirurgia mínima, não reforma"* Não-goal. Deferred as a separate debit if anchor rot ever bites — and it would amend [ADR-014](../../decisions/ADR-014-readiness-owns-internals-claims-gate.md), not slip in as a silent flow edit. |
| **Own the gate in `skills/plan/SKILL.md` or `agents/planner.md`** | `plan` only assembles a prompt and dispatches — it cannot gate from inside the flow; and the incident is precisely a case where the **author's** self-check passed. The independent reviewer must own it. |
| **Pin readiness with a new `agents/readiness.md` (`tools: Read, Grep, Glob, Bash`)** | Converts a skill into an agent — a responsibility/boundary change, i.e. ADR-grade, and a much larger diff than the epic allows. The graceful `Read`/`Grep` fallback in Process §14 covers the residual at zero cost. |
| **Fail on basename-only citations (`cli.js:121`)** | Would fail plans for a formatting habit the repo itself uses in archived designs, and contradicts the criterion's "fails ONLY when the anchor no longer resolves". Reported in `skipped[]` instead. |
| **Infer to-be-created files by parsing `tasks.md` prose** | "Create X" prose is unbounded; a parser would be guesswork. An explicit `## New files` declaration, corroborated by a literal path match in `tasks.md`, is unambiguous and reviewable. |
| **Insert the new step as `§5` (next to the design review) and renumber §5-§13** | Renumbering ripples into the output template and into every doc that references the numbered steps, for zero semantic gain. Appended as Process §14 + one cross-reference bullet in Process §4. |

## Consequences

- **Positive:** the class of error that shipped in `flow-step-summaries` now has an explicit, numbered owner with a written severity; anchor rot gains a cheap mechanical check; the roadmap stops naming a ghost path; the new call site is covered by the existing `agent-validator-paths` byte-identity + sweep assertions.
- **Negative — the secondary check has no mechanical trigger** (unlike `check-adr-format.js`, which `check-doc-manifest.js` invokes from a flow-wired `runs:` step). If a reviewer skips the `Bash` block, nothing notices. **Accepted** by the owner's standalone decision — the semantic gate is the real gate; if this proves insufficient, flow-wiring is a separate, ADR-bearing debit.
- **Negative — "the semantic gate is the real gate" is a statement about *authority*, not about *enforcement*.** Process §14 is pinned only for textual presence and wording (test §C20); nothing observes whether a reviewer actually re-derived anything. The flow consumes the **aggregate** readiness verdict ([full.yaml:166-180](../../../governance/flows/full.yaml), [fast.yaml:100-111](../../../governance/flows/fast.yaml)) — `approved` / `needs-revision` / `blocked` — exactly as it already does for Process §1-§13; there is no per-step signal to gate on, for §14 or for any other step of any review skill in the kit. **Accepted** ([ADR-014](../../decisions/ADR-014-readiness-owns-internals-claims-gate.md) §Decision 4 records it): the mitigation is textual precision — the three named shapes, the trigger phrasings ("every X does Y", "always populated"), and a pre-assigned severity — not machinery. Read this change as *raising the odds* the class gets caught, not as *guaranteeing* it.
- **Negative — basename-only citations stay unchecked.** **Accepted, visible**: they surface in `skipped[]` and in the stderr report rather than being silently ignored.
- **Negative — the `## New files` waiver is a convention plan authors must remember.** **Mitigated**: forgetting it produces a legible `citation-file-missing` naming the exact path, not a mystery failure; and the waiver is withheld unless `tasks.md` corroborates, so it cannot be used to hide unplanned work.
- **Negative — "13-step" prose becomes "14-step" at 8 edit sites across 5 files** (9 grep hits in 6 files; the 9th is ADR-014's own record of the ripple). **Accepted**: a one-token edit per site, enumerated with line numbers in [tasks.md](tasks.md) §7, and leaving it stale would be exactly the unverified-claim failure this change exists to prevent.

## Rollback notes

Fully additive and self-contained. Revert = delete `governance/validators/check-design-claims.js` and `governance/__tests__/check-design-claims.test.mjs`; drop Process `### 14` and the §4 cross-reference bullet from `skills/readiness/SKILL.md`; remove `skills/readiness/SKILL.md` from `SOURCE_FILES` in `agent-validator-paths.test.mjs`; revert `14` → `13` at the 8 sites in 5 docs; drop the `docs/OVERVIEW.md` table row; revert the epic line. No state, no migration, no flow YAML touched.

**The ADR is the one thing that does not roll back.** [ADR-014](../../decisions/ADR-014-readiness-owns-internals-claims-gate.md) is WORM ([DOCS.md](../../../DOCS.md) §2): if the decision is reversed later, that is a **new** superseding ADR plus an index update — never a deletion of ADR-014 and never an edit to its body. A revert of the *code* leaves ADR-014 standing as the record of what was decided and why it was undone.
