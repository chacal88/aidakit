---
name: spec
description: Reads and presents specifications inline with related-spec discovery, ADR linkage, and validation commands. Works in any repo — if an openspec/ directory exists (or the openspec CLI), it reads from openspec/specs/ and openspec/changes/; otherwise it reads canonical specs from docs/specs/, change artifacts from docs/features/<change-id>/, and architecture deliverables from docs/design/. It also documents the proposal.md template the aidakit:planner agent uses to author new changes. Use when the user asks to read or show a spec, cites a spec by name, asks "what does the spec say", wants requirements, scenarios, or validation commands, needs to find related specs by keyword, or is about to plan, implement, review, or validate work against a spec.
---

# aidakit:spec — Specification reading

> Reads and presents specs inline with full context — related specs, linked ADRs, and validation commands — without switching files or opening tabs.

**Command:** `/aidakit:spec <spec-name>` · **Scope:** any spec-oriented repo (OpenSpec optional) · **Speed:** ~2–5 s per spec.

## When to use (and when not)

**Use when:**

- The user asks to read or show a spec, or references a spec by name ("what does the X spec say?").
- You need requirements, scenarios, or validation commands before planning, implementing, reviewing, or validating work against a spec.
- You want to discover specs by topic or keyword (`--list`).
- You're authoring a `proposal.md` for a new change — this skill documents the template the `aidakit:planner` agent uses (see Process).

**Do not use when:**

- The question is about a DECISION (the what/why, with rejected alternatives) — read the ADR directly in `docs/decisions/` (authoritative index: `docs/decisions/README.md`), per DOCS.md.
- You're deploying, auditing, or reorganizing the project's document structure — that's the `aidakit:docs` skill's job.
- You're judging spec or ADR conformance — delegate to the `aidakit:spec-reviewer` and `aidakit:adr-reviewer` agents (reviewers report, they don't fix — GOVERNANCE.md §3).

## Prerequisites

- A repo with specs in one of the two layouts (the skill detects it itself — step 1 of the Process):
  - **OpenSpec:** `openspec/` directory present (or the `openspec` CLI installed and configured for the repo).
  - **Kit standard (DOCS.md):** `docs/specs/` (canonical specs per capability), `docs/features/<change-id>/` (change artifacts), `docs/design/` (architecture deliverables), `docs/decisions/` (ADRs).
- Optional, but used when present: the repo's `CLAUDE.md` (code style and workflow), `.claude/launch.json` (dev-server presets), and `.claude/memory/` (continuity across sessions).

## Process

### 1. Detect the spec root

Before anything else, detect the target repo's spec layout:

1. **OpenSpec repo** — if the repo has an `openspec/` directory (or the `openspec` CLI is installed and configured for it), the specs live in `openspec/specs/` and the archived changes in `openspec/changes/archive/`:

   ```
   openspec/specs/
     ├─ <spec-a>/
     │   └─ spec.md
     ├─ <spec-b>/
     │   └─ spec.md
     └─ ...
   ```

2. **Kit standard (DOCS.md)** — otherwise, use the kit's canonical structure: canonical specs per capability in `docs/specs/` (DURABLE life), the in-flight change's spec deltas in `docs/features/<change-id>/` (WORKING life), and architecture deliverables in `docs/design/`:

   ```
   docs/
     ├─ design/                 # aidakit:flow-design phase deliverables + STATE.md
     ├─ decisions/              # ADRs (ADR-NNN-slug.md) + README.md (authoritative index)
     ├─ specs/                  # canonical specs per capability — DURABLE life
     └─ features/<change-id>/   # change artifacts (proposal, design, tasks, evidence) — WORKING life
   ```

The detected root is `{spec-root}` in everything below. The search is case-insensitive and hyphen-tolerant (spaces become hyphens).

### 2. Locate the requested spec

On receiving `/aidakit:spec <name>`:

1. Normalize the input: spaces → hyphens, lowercase.
2. Look for `{spec-root}/{normalized-name}/spec.md` (in kit standard, look in `docs/specs/` first; if not found, look for the change's spec delta in `docs/features/<change-id>/`).
3. If not found, search by substring (e.g., "adapter" finds every `*-adapter` spec).
4. Return the found specs ranked by exactness.

### 3. Read and format

Present the complete spec inline, with the headers preserved:

- Purpose statement
- All requirements (with scenarios)
- Documentation targets
- Architecture inputs
- Recorded decisions (ADRs) and open decisions
- Validation commands
- Evidence locations
- Implementation guidance

Example output:

```
# <spec-name> Specification

## Purpose
[Why this spec exists, what phase it's in]

## Requirements

### Requirement: <Title>
[Full requirement text...]

[All requirements with scenarios]
```

Every spec follows the same structure (defined by the repo's OpenSpec schema in `openspec/schemas/` when present; kit-standard repos follow the same format). The structural headers stay in English for compatibility with OpenSpec validation; the content follows the repo's declared language (DOCS.md §5):

```markdown
# {name} Specification

## Purpose
[Why this spec exists, what phase it's in]

## Requirements
### Requirement: [Title]
[Full requirement text]

**Documentation Targets:** ...
**Architecture Inputs:** ...
**Relevant Decisions / Open Decisions:** ...
**Verification:** ...
**Validation Commands:** ...
**Evidence File:** ...
**Implementation Evidence:** ...

#### Scenario: [Title]
- **WHEN** ...
- **THEN** ...
```

### 4. Detect related context

Identify related specs by four signals:

1. **Shared decisions** — specs that reference the same ADRs are related.
2. **Shared documentation targets** — specs that update the same files.
3. **Keyword** — a word in the name finds every spec that contains it.
4. **Architecture overlap** — specs that share inputs from the same subsystem.

And present them together:

- **Adjacent specs** — same subsystem, same recovery/security concern, etc.
- **Architecture references** — the repo's architecture deliverables (`docs/design/` in kit standard; `docs/architecture/ARCHITECTURE.md` when present) and the change's own docs in `docs/features/<change-id>/`.
- **Mentioned decisions** — the ADRs referenced by the spec, in `docs/decisions/` (index: `docs/decisions/README.md`; `DECISION_INDEX.md` for discovery when the repo has ≥15 ADRs).
- **Validation commands** — ready to run, exactly as the spec names them:

  ```bash
  <the spec's validation command 1>
  <the spec's validation command 2>
  ```

### 5. Suggest next steps by phase

Depending on the spec's phase, suggest:

- **Planning:** "Read spec → draft plan (delegate to `aidakit:planner`) → share design"
- **Implementation:** "Code the module → add tests → validate against the scenarios"
- **Review:** "Check evidence files → verify the validation commands pass → run `aidakit:spec-reviewer` for spec conformance and `aidakit:adr-reviewer` for decision conformance → update documentation"
- **Archiving:** "Confirm evidence → add to the archive summary → retire the spec"

If the spec has open questions that require investigation, delegate the research to `aidakit:research`.

### 6. Record learning in memory

After reading a spec, update `.claude/memory/`:

```
spec_state.md
├─ "Just read <spec-name>"
├─ "Key learning: <what the spec taught about the flow>"
├─ "Scenario: <notable acceptance scenario>"
└─ "Related: <related-spec-a>, <related-spec-b>"
```

After 3–4 specs on the same topic, memory captures patterns:

```
Example memory entry:
"<subsystem> specs always validate with <test runner> + integration tests.
Evidence files go in <evidence location named by the specs>.
Relevant decisions: <the ADRs those specs reference>."
```

Future sessions reference this without re-reading every spec. **Note:** memory is a convenience, not an authority — cross-session coordination happens only through versioned artifacts (specs, ADRs, `STATE.md`), per GOVERNANCE.md §6.

### Discovery mode

Find active specs by topic:

```
/aidakit:spec --list                  # all active specs
/aidakit:spec --list <keyword>        # specs matching the keyword
```

Claude lists each matching spec and suggests a reading order based on dependencies.

### Use with context

If you're working on a feature, reference the spec when asking for help:

```
/aidakit:spec <spec-name> — implement <task>
```

Claude then: reads the spec inline → extracts the relevant requirements and scenarios → plans the implementation against the spec's validation criteria → writes code with the evidence artifacts already in mind.

### Principles

- **No spec silos.** Do not read specs in isolation — show the ecosystem: upstream specs (what this depends on), downstream (what depends on this), parallel (what runs alongside), and archived precedent (what came before).
- **Evidence first.** Specs define validation commands and evidence locations. When implementing, those commands and locations ARE the acceptance criteria — the skill surfaces them immediately.
- **Minimal friction.** One command. No navigation, no clicks. Inline content ready to paste into plans, PRs, or notes.

### Integration points

- **With the repo's `CLAUDE.md`:** the `CLAUDE.md` defines code style and workflow; the spec defines WHAT to build. Together: "build a module in the repo's style that passes the spec's validation commands".
- **With `.claude/launch.json`:** if the repo has dev-server presets, use them when implementing a spec (bring up all the services for integration testing, or targeted presets, as the repo defines). Specs often name validation commands (test runner, typecheck); the launch configs execute them.
- **With the memory system:** `.claude/memory/` learns automatically from the specs read (see step 6).

### Author a new proposal (integration with aidakit:planner)

When drafting a `proposal.md` for a new change (rather than reading an existing capability spec), use this template. The `aidakit:planner` agent (invoked by `aidakit:orchestrator` during planning) depends on it. In OpenSpec repos the proposal lives in the change folder at `openspec/changes/<change-id>/`; in kit standard it lives with the change in `docs/features/<change-id>/` (WORKING life — DOCS.md §4). Remember the single key end-to-end: change-id = branch = PR title suffix = archive directory (DOCS.md, rule 7).

Template headers in English for compatibility with OpenSpec validation; the text follows the repo's declared language (DOCS.md §5):

```markdown
# Proposal: <Feature Name>

**Change ID:** `<change-id>`
**Date:** `<YYYY-MM-DD>`
**Owner:** `@<github-handle>`
**Phase / Package:** `<phase>` (or `n/a (<context>)`)
**PRD:** `<path>` or `n/a`
**Tech Spec:** `<path>` or `n/a`

---

## Why

One paragraph explaining what gap exists, for whom, and what happens if we don't
solve it. Cite the specific file:line, the client flow, or the external
constraint that motivates the change. No vague problem statement.

**Context:** who has this problem? When do they hit it?
**Impact:** what happens if we don't solve it? (data loss, client
churn, SLA breach, etc.)

## What Changes

A bullet list of the concrete deltas, each citing a file path in the target
repo. Discover the repo's surfaces from its real layout (apps, packages,
services — whatever the repo contains); if the repo has an ADR about the layout,
follow it. High-level architecture; not detailed implementation (that's `design.md`).

## Goals / Non-Goals

**Goals:** what this change needs to deliver.
**Non-Goals:** what is explicitly out of scope — protects against scope
creep during implementation.

## Alternatives Considered

- **Alternative 1:** <description> — rejected because <reason citing an ADR or constraint>
- **Alternative 2:** <description> — rejected because <reason>

## Success Criteria

Measurable, testable. Each one becomes a validation task in `tasks.md`.

- [ ] Criterion 1 (e.g., "p99 of `<endpoint>` < 200ms under the expected load")
- [ ] Criterion 2 (e.g., "100% of recovery attempts successful within N retries, per the relevant ADR")
- [ ] Criterion 3

## Open Questions

- [ ] Question 1 — must be resolved before implementation, OR explicitly deferred with a reason
- [ ] Question 2

## Dependencies

- Cite the repo's ADRs (`docs/decisions/`, index in `docs/decisions/README.md`)
- Cite the repo's open-decisions log, if it maintains one
- Cite prior archived changes this one builds on (`openspec/changes/archive/` in OpenSpec repos; `docs/archive/YYYY-MM-DD-<change-id>/` in kit standard)
- Cite Tech Specs the change inherits constraints from

## Effort Estimate

| Phase | Hours | Notes |
|-------|-------|-------|
| Design / planning | X | (this proposal + design.md) |
| Implementation | Y | code + unit tests on the repo's surfaces |
| Integration tests | Z | against the repo's real integration targets (database, emulators, browser automation — whatever the stack uses) |
| Documentation | W | spec deltas + Tech Spec updates |
| **Total** | **X+Y+Z+W** | |
```

### Examples

**Scenario 1 — start a feature from a spec.** User: `/aidakit:spec <spec-name>`. Claude responds with the complete spec, identifies requirements + scenarios, lists the validation commands. User then: "help me plan the implementation of Requirement 1". Claude: cites the requirement and the scenarios → checks the repo's `CLAUDE.md` for stack patterns → sketches the function or module with documentation → names the evidence-artifact location → suggests the test structure the repo uses.

**Scenario 2 — validate work against the spec.** User: "I wrote the feature. How does it compare to the spec?". Claude: re-reads the relevant spec requirement → checks the code against the scenarios → runs the validation commands named by the spec → points out the evidence needed (sanitized logs, screenshots, command outputs).

**Scenario 3 — find related specs.** User: `/aidakit:spec --list <keyword>`. Claude lists each matching spec and suggests a reading order by dependencies.

**Scenario 4 — cross-session continuity.** Session 1: user reads 3 specs from the same subsystem; Claude records learnings in memory. Session 2: user asks about the subsystem again; Claude recalls the specs already read, suggests "you read <spec-name> recently — want to review or move forward?" and shows the summary of learned patterns.

### Troubleshooting

**Spec not found.**

```
❌ /aidakit:spec name-with-typo
→ "Spec 'name-with-typo' not found in {spec-root}"
```

Try `/aidakit:spec --list` to see all available specs, or search by keyword: `/aidakit:spec --list <keyword>`.

**Output too long.** If the spec is very long (150+ lines), Claude can: (1) summarize the Purpose + Requirements headers; (2) offer to go deep on specific sections ("Requirement 3 in detail?"); (3) deliver the validation commands ready to paste. This keeps the reading focused and actionable.

**Outdated spec.** In OpenSpec repos, if the Purpose says "TBD - created by archiving...", the spec was retired — check `/aidakit:spec --list archive` to find the change that retired it, or ask for the replacement spec. In kit standard, a superseded spec lives in `docs/archive/YYYY-MM-DD-<reason>/` with a legacy banner and links to the replacements (DOCS.md, rule 6).

## Outputs

- **Spec content inline** — the reading writes nothing to the repo; the result is the formatted spec + related context + validation commands ready to paste.
- **A dated entry in `.claude/memory/spec_state.md`** — learnings, notable scenarios, and related specs (step 6).
- **When authoring:** `proposal.md` in `openspec/changes/<change-id>/` (OpenSpec repos) or `docs/features/<change-id>/` (DOCS.md standard) — WORKING life; the promotion to DURABLE (merging deltas into `docs/specs/`, dated archive) happens only at the human gate on change completion (DOCS.md §4).

## Gates and guardrails

**Proposal quality checklist — don't save without 100%:**

- ✅ **The Why is concrete** — cites a real file:line or a client flow
- ✅ **What Changes lists file paths** — each bullet names a file on the target repo's real surfaces
- ✅ **Success Criteria are testable** — each verifiable with code or a validation command
- ✅ **Effort is committed** — a single number per row, not a range; if uncertain, record the assumption that shrinks it
- ✅ **Dependencies listed** — ADRs, open decisions, prior changes, Tech Specs
- ✅ **Open Questions resolved or deferred** — never swept under the rug silently
- ✅ **Language follows the project's `language` field** — the readable prose is in the language from `aidakit.config.yaml` (default when absent: `en`); structural headers, identifiers and machine-parseable verdicts stay fixed (DOCS.md §5, [config reference](../../docs/reference/config.md)). A project may also record the choice in an ADR, which must agree with the field.

**Doctrine guardrails:**

- **Reading does not edit.** This skill never alters a spec or ADR. An ADR is WORM (DOCS.md, rule 2); if the work calls for superseding or contradicting an ADR, escalate to the human (GOVERNANCE.md §1, escalation 2).
- **Discovery outside the approved scope** — if reading the spec reveals a dependency or gap outside the change plan, stop, present the finding, and wait (GOVERNANCE.md §1, escalation 3).
- **Introspection ≠ invocation.** The spec's validation commands must be truly executed against the running system, not merely read (GOVERNANCE.md §8).
- **Reviewers only report.** `aidakit:spec-reviewer` and `aidakit:adr-reviewer` do not fix or approve their own work (GOVERNANCE.md §3).
- **Relative links with a visible ID** when citing ADRs (`[ADR-016](../decisions/ADR-016-slug.md)`) — a formal definition-of-done criterion for any change that touches docs (DOCS.md, rule 4).

**Best practices:**

1. **Start with the Purpose** — read it first to understand scope and phase.
2. **Note the validation commands** — copy them to the terminal immediately; they are your acceptance criteria.
3. **Check the evidence locations** — specs name where the evidence must live; plan to capture it early.
4. **Follow the decision links** — if the spec references an ADR, read it in `docs/decisions/` to understand the architecture decision.
5. **Look for the scenarios** — the "Scenario:" subsections are the true acceptance criteria; code until the scenarios pass.
6. **Update the memory notes** — after working on a spec, ask to record the learnings for the next session.

**Limitations:**

- Specs must live under the detected root (`openspec/specs/` in OpenSpec repos; `docs/specs/` in kit standard, with change deltas in `docs/features/<change-id>/`).
- Spec files must be named `spec.md` (standard format).
- Related-spec discovery is by keyword + shared decision (not a full dependency mapping).
- Memory updates are automatic learning; if something is wrong, ask to correct the memory file directly.

## Related

- **DOCS.md** (kit root) — document placement, the two lives WORKING → DURABLE, dated archive; every doc creation obeys it.
- **GOVERNANCE.md** (kit root) — authority model, escalations, roles author ≠ reviewer ≠ shipper.
- **Skills:** `aidakit:plan` (plan the implementation from the spec), `aidakit:review` (review code against the spec), `aidakit:docs` (deploy/audit the doc structure), `aidakit:flow-design` (architecture deliverables in `docs/design/`), `aidakit:catalog` (kit index).
- **Agents:** `aidakit:planner` (authors the proposal with this skill's template), `aidakit:orchestrator` (invokes the planner in planning), `aidakit:spec-reviewer` and `aidakit:adr-reviewer` (conformance), `aidakit:research` (investigates open questions).
- The target repo's `CLAUDE.md` — the project's code style and architecture; `openspec/` — the OpenSpec config and schema, when the repo uses it.

<!-- aidakit v0.2 — rewritten from mx-spec-read (mx package, generalized from representante-digital) on 2026-07-17 — translated to EN -->
