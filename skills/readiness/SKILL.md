---
name: readiness
description: Reviews a change package (OpenSpec change or a change under docs/features/) for implementation readiness before execution begins. Use when validating whether a planned change is ready to implement, when checking consistency across proposal/design/specs/tasks, when reviewing a package before breaking it into issues or branches, to prevent ambiguous implementation, or when the user says "is it ready to implement?", "review the plan", "readiness review", "can we start coding?", or invokes /aidakit:readiness.
---

# aidakit:readiness — planning readiness review

> Reviews the change package (proposal, design, specs, tasks) against the canonical flow and emits a readiness verdict, barring ambiguous work before implementation begins.

## When to use (and when not)

Use this skill **after** the planning artifacts exist and **before** implementation begins:

- validate whether a change package is ready for implementation
- check consistency across `proposal.md`, `design.md`, `specs/**/*.md`, `tasks.md`, and supporting documents
- review a roadmap package before breaking it into implementation issues or branches
- prevent obscure task execution, poor issue creation, weak acceptance criteria, or hidden architecture decisions

**Do not use to:**

- review the entire repository
- propose architectural refactors outside the current change package
- expand scope beyond the current change package
- require a PRD or Tech Spec when the package does not reference them
- rewrite the change package from scratch, unless explicitly asked

In the kit flow, this review runs after `aidakit:planner` authors the package and before implementation. It complements the gates of `aidakit:adr-reviewer` (conformance with the repo's recorded decisions) and `aidakit:spec-reviewer` (spec format and testability); it can run directly in the current session or be delegated by `aidakit:orchestrator`.

## Prerequisites

### Detect the target repo's layout

Before reviewing, detect which layout the repo uses:

- **OpenSpec mode** — the repo has an `openspec/` directory (or the `openspec` CLI installed): the change package lives in `openspec/changes/<change-id>/` and the capability specs in `openspec/specs/<capability>/spec.md`.
- **Standard mode** — otherwise, DOCS.md's canonical structure applies: the change package lives in `docs/features/<change-id>/`, the canonical specs in `docs/specs/`, and the architecture-level deliverables in `docs/design/`.

In this skill, `<change-root>` is the detected package directory (`openspec/changes/<change-id>/` or `docs/features/<change-id>/`).

The canonical planning flow is **change-package-first**. It does **not** require PRD or Tech Spec artifacts for implementation readiness, unless a specific package explicitly references them.

```text
Change package (<change-root>)
  ├─ proposal.md
  ├─ design.md
  ├─ specs/**/*.md
  ├─ tasks.md
  └─ optional support/*.md
  ↓
Readiness review (aidakit:readiness)
  ↓
Execution by issue / branch
```

Use this skill to review the package against that flow and stop ambiguous work before implementation begins.

### Target repo's governance decisions

The target repo may record governance decisions about how implementation planning must happen — look for them in the repo's recorded decisions (`docs/decisions/`, with the authoritative index at `docs/decisions/README.md` and, where present, `DECISION_INDEX.md`). When those decisions exist, enforce them during the review.

Typical governance rules to enforce when the repo records them:

- non-trivial implementation work goes through a change package
- the change type is clear per the repo's taxonomy
- the change metadata exists and is consistent
- roadmap and current-state checks exist
- the change-organization conventions (e.g., flat change directories, taxonomy indexes) are respected

A package is **not ready** for implementation if it violates the repo's recorded governance decisions.

### Mandatory artifact loading

You MUST load the artifacts that exist for the package under review.

Minimum executable set of the package:

- `<change-root>/proposal.md`
- `<change-root>/design.md`
- `<change-root>/tasks.md`
- the change metadata file, in the convention the repo's existing changes use (`metadata.md`, `.openspec.yaml`, or similar), when the repo requires it
- `<change-root>/roadmap.md` when present
- `<change-root>/current-state.md` when present
- `<change-root>/specs/**/*.md`

Load these when they exist, because they can materially constrain the package:

- `<change-root>/support/*.md`
- `<change-root>/planning-review.md`, if you're reviewing a package that was reviewed before
- the existing capability specs of each modified capability listed in the proposal (OpenSpec mode: `openspec/specs/<capability>/spec.md`; standard mode: `docs/specs/`)
- the repo's master documentation index (`docs/INDEX.md` or equivalent) when present
- relevant architecture and system documentation when the change touches that system — in standard mode, `docs/architecture/ARCHITECTURE.md` and the deliverables in `docs/design/`; discover where the target repo keeps it rather than assuming fixed paths
- relevant operational docs or runbooks when the change affects operation, deploy, debugging, or local development — in standard mode, `docs/guides/`; discover in the repo
- the repo's recorded decisions (`docs/decisions/`), especially the governance decisions about change planning and organization
- relevant change indexes, when the repo maintains them
- any PRD or Tech Spec only if the package explicitly references it as an input or approval source

### Structural validation

In OpenSpec mode, before reviewing implementation readiness, validate the package:

```bash
openspec validate <change-id> --type change --strict --no-interactive
```

If the local CLI doesn't support `--type change` or `--no-interactive`, run the strictest available equivalent:

```bash
openspec validate <change-id> --strict
```

In standard mode there is no validation CLI: do the process's structural checks below manually.

## Process

Core rules that hold throughout the process:

- Do not expand scope.
- Do not suggest whole-project changes, unless the package explicitly changes a shared pattern.
- Do not assume behavior that isn't written in the package artifacts or the loaded supporting references.
- Every conclusion points to evidence in an artifact or is explicitly labeled a hypothesis.
- Generic feedback is invalid.
- Prefer the repository's constraints and the package's specs over personal preference.
- Treat supporting documents as planning evidence, but require that specs/tasks contain or reference any behavior needed for implementation.
- Do not invent missing details. If something isn't defined in the artifacts, call it missing.

### 1. Resolve the package

Identify:

- the change-id
- the paths of `proposal.md`, `design.md`, `tasks.md`, and `specs/**/*.md`
- the supporting documents
- the existing specs being modified
- the referenced docs/ADRs/runbooks
- the workflow stage the package has reached: planning, ready-to-break, ready-to-implement, in-execution, or needs-rework

If the package can't be resolved with confidence from the user's context or the artifacts, stop and ask for the change-id or path.

### 2. Validate the scope

Check:

- what problem is being solved
- whether the scope is explicit
- whether out-of-scope is explicit
- whether specs add behavior not justified by the proposal
- whether the design adds implementation commitments not represented in specs/tasks
- whether supporting docs introduce scope not reflected in specs/tasks
- whether open decisions still leave scope, sequencing, or responsibility ambiguous

Classify the scope as one of: `correct` · `incomplete` · `inflated` · `ambiguous`

### 3. Review the proposal

Check:

- clarity of the problem
- clarity of the business/platform objective
- explicit affected capabilities
- new vs modified capabilities correctly identified
- explicit impact on systems, data, operation, testing, and rollout
- non-goals or exclusions clear enough to prevent scope creep
- risks and constraints visible in the proposal, design, or supporting docs

### 4. Review the design

Check:

- the design matches the proposal's scope
- constraints inherited from system docs, recorded decisions, and existing specs are respected
- data model and contracts defined at the right level
- input and output behavior defined
- validation and error handling defined
- rollout, migration, monitoring, and rollback defined
- privacy, auth, permissions, and operational constraints addressed when relevant
- alternatives and trade-offs documented for the big architecture choices
- open questions don't block the next implementation phase, or are explicitly assigned to discovery tasks

### 5. Review the change metadata

When the repo defines a change-metadata convention, verify that the file exists and matches the repo's recorded decisions about change taxonomy and organization:

- the change type is valid per the repo's taxonomy
- the scope matches the files/systems implied by proposal/design/tasks/specs
- systems and feature/initiative are explicit
- dependencies and blockers are documented
- change indexes updated — or the missing update flagged — when the repo maintains them

If the repo defines no metadata convention, record that and move on — don't block on it.

### 6. Review roadmap and current state

When the repo's recorded decisions require roadmap and current-state checks, or when the package includes them, verify:

- the roadmap exists as `roadmap.md` or as an explicit `## Roadmap` section in `design.md`
- the current-state checks exist as `current-state.md` or as an explicit `## Current-State Checks` section in `design.md`
- the roadmap has phases/changes, deliverables, acceptance criteria, validation, and out-of-scope notes
- the current-state checks list the files/docs/specs/contracts inspected and separate Confirmed, Inferred, Unknown, and Change-needed
- the Unknowns become discovery tasks or blockers

### 7. Review the specs

Check each `specs/**/*.md` file:

- requirements use normative language (`SHALL`/`MUST`) where appropriate
- each requirement has testable scenarios with clear WHEN/THEN behavior (the OpenSpec format uses `#### Scenario:` headers; follow the repo's spec format)
- modified capabilities include complete requirement deltas, not vague references
- requirements cover edge cases, failure behavior, idempotency, rollout, and compatibility when relevant
- specs aligned with proposal and design
- supporting docs don't contain requirements missing from the specs

### 8. Review the tasks

Check `tasks.md`:

- tasks executable and sequenced by dependency
- tasks in `- [ ]` checkbox format
- tasks small enough to map to issues or implementation work packages
- dependencies between tasks explicit or obvious from the order
- acceptance criteria specific and testable in the tasks or in the referenced specs/supporting docs
- tasks don't hide missing design decisions in vague phrases like "define", "handle", or "support" without an expected output
- tasks suitable for issue creation, if the package is heading to execution
- every task path falls under the repo's real surfaces/workspaces — discover them from the repo structure and recorded decisions, don't assume a fixed list

Issue-tracker sync rule, when the repo's workflow manages issue references in `tasks.md` (e.g., an `**Issue:**` line):

- treat that line as workflow-managed metadata when present
- before task sync, placeholder values like `_(filled automatically after sync)_` are valid and must not, on their own, be treated as a readiness failure
- issue numbers are assigned by the repo's workflow when the tasks are synced with the board/issue tracker
- only treat a missing issue number as a problem when the package claims the sync already happened, or when execution has already begun in a way dependent on branches tied to an issue number

### 9. Detect omissions

Explicitly check for missing definitions in:

- validation
- error handling
- retries
- permissions and authorization
- side effects
- observability
- rollback
- data consistency
- idempotency
- acceptance criteria
- data migration/backfill
- feature flags and rollout gating when the behavior changes are incremental
- compatibility with legacy records/contracts
- test strategy and evidence expectations when validation proof is required

### 10. Execution-readiness test

Answer concretely:

Can a developer implement the next intended phase without asking clarifying questions that change behavior or scope?

List:

- missing decisions
- undefined behaviors
- vague terms
- obscure dependencies
- hidden implementation choices that would vary between developers
- open questions that block the next phase versus open questions safely assigned to discovery tasks

If more than 3 serious doubts remain for the next intended implementation phase, the package is **not ready** (`Ready to implement: no`).

### 11. Simulate the implementation

Simulate execution in the repo's real workflow:

1. what a developer does first
2. which artifact they consult next
3. where interpretation could diverge
4. where the implementation could fail in production

Then list the 5 most likely production failures, each with:

- cause
- impact
- prevention

Prefer failures grounded in the real package, not generic software risks.

### 12. Check for false completeness

Look for artifacts that seem complete but are operationally weak:

- sections that name decisions without defining them
- tasks that seem actionable but hide missing contracts
- acceptance criteria that sound complete but aren't testable
- rollout or rollback sections that exist only as placeholders
- detailed supporting docs disconnected from specs/tasks
- referenced constraints that are listed but not applied

### 13. Answer the mandatory review questions

Answer all of them explicitly:

1. Is the problem objectively defined?
2. Is the outcome measurable?
3. Are the error behaviors defined?
4. Are the edge cases covered?
5. Are the dependencies clear?
6. Are the contracts defined?
7. Can two developers interpret this differently?
8. Is any decision implicit rather than written?
9. Do the tasks deliver the intended outcome in full?
10. What will be discovered too late if implementation starts now?

### Severity classification

Use only these levels:

- `Critical` → blocks implementation or is likely to cause a production failure
- `High` → high chance of wrong implementation
- `Medium` → weakens the definition and increases rework risk
- `Low` → minor clarity issue

### Fix classification

Every finding is labeled one of:

- `Mandatory before implementation`
- `Fix during implementation`
- `Nice-to-have`
- `Out of scope`

### Evidence standard

Every finding includes:

- severity
- fix classification
- exact artifact reference
- why it matters operationally
- the smallest fix that resolves it without expanding scope

Bad:

- "could be improved"
- "consider clarifying"
- "in general"

Good:

- "Critical — Mandatory before implementation — `<change-root>/tasks.md`: task 3.2 says `define idempotency keys`, but no artifact states whether the provider's webhook replay is keyed by provider event ID, provider message ID, or a generated correlation ID. Two developers may implement incompatible dedup and the parity reports will be unreliable. Smallest fix: add the canonical dedup-key hierarchy to `design.md` and the relevant spec scenario."

Example with an issue number:

- "Don't block just because `**Issue:**` still shows `_(filled automatically after sync)_`; when the repo's workflow fills those numbers in at task sync, placeholders are valid before the sync."

## Outputs

By default, return the review **in chat only**. Only persist a file when the user explicitly asks. If persistence is requested and the package exists, write to:

- `<change-root>/planning-review.md` — a WORKING-life artifact of the change, per DOCS.md

**Never** write a planning-review result to `evidence.md`: that file is reserved for execution proof and handoff evidence.

Use exactly this structure:

```md
# Readiness review result

## 1. Decision
- Status: APPROVED | NEEDS-REVISION | BLOCKED
- Confidence: low | medium | high
- Ready to implement: yes | no

## 2. Scope validation
...

## 3. Proposal review
...

## 4. Design review
...

## 5. Change metadata review
...

## 6. Roadmap and current-state review
...

## 7. Specs review
...

## 8. Tasks review
...

## 9. Omission detection
...

## 10. Execution risks (top 5 failures)
...

## 11. Mandatory fixes before implementation
- [ ]

## 12. Optional improvements (within scope)
- [ ]

## 13. Explicitly out of scope
- [ ]

## 14. Mandatory review questions
...

## 15. Final conclusion
- Can we start?
- What must be fixed?
- Main risk if ignored?
```

The `Status:` and `Ready to implement:` lines are the machine-parseable verdict required by GOVERNANCE.md (§3) — keep them verbatim, in English.

If no change package exists yet, keep `## 7. Specs review` and state that the executable package is missing. Also mark `## 5. Change metadata review` as missing when the repo requires metadata.

## Gates and guardrails

### Missing-artifact rules

- Change package missing → `BLOCKED`.
- `proposal.md` missing → `BLOCKED`.
- The repo requires change metadata and it's missing or lacks a valid type per the repo's taxonomy → `BLOCKED`.
- The repo's recorded decisions require roadmap or current-state checks and they're missing or too vague to guide implementation → `BLOCKED`.
- `design.md` missing on a cross-cutting, architectural, data-model, migration, or multi-service change → `BLOCKED`.
- `tasks.md` missing → `BLOCKED`.
- No `specs/**/*.md` exists for the listed capabilities → `BLOCKED`.
- The proposal lists modified capabilities but the corresponding spec delta is missing → `BLOCKED`.
- The package explicitly references a PRD, Tech Spec, ADR, workflow doc, or supporting document as an input and the referenced artifact is missing → `BLOCKED`.
- Do **not** mark the package blocked merely because no PRD or Tech Spec exists when the package doesn't reference them.

### Decision gate

Apply these rules strictly. The verdict vocabulary follows GOVERNANCE.md §3 (`APPROVED | NEEDS-REVISION | BLOCKED`).

Mark `BLOCKED` if:

- a mandatory package artifact is missing
- the package fails validation (OpenSpec mode: `openspec validate` fails)
- the behavior is ambiguous in a way that changes the implementation
- a high-risk execution gap is unaddressed
- the tasks are incomplete, vague, or not executable for the next intended phase
- the change package doesn't yet exist in a review whose goal is implementation readiness

Mark `NEEDS-REVISION` if:

- the package is mostly coherent
- the remaining issues are narrow and explicitly fixable
- the execution path stays clear after those fixes
- the fixes fit before or during the first implementation phase without changing scope

Mark `APPROVED` only if:

- there's no material ambiguity
- there's no critical execution risk
- the implementation path is clear for the next intended phase
- the change package is valid and executable when implementation readiness is being reviewed

Per GOVERNANCE.md §3: `APPROVED` is forbidden with an open blocker or an empty/trivially broad scope. If any `Mandatory before implementation` fix remains, the verdict is at most `NEEDS-REVISION`.

### Role and escalation guardrails (GOVERNANCE.md)

- **Report, don't fix** (§3): this review flags and classifies; it does not edit the package, does not approve its own work, and does not fix artifacts — the one who fixes is the author (`aidakit:planner` or executor).
- **Single-writer** (§3): when persisting, write only `<change-root>/planning-review.md` — no other file.
- **Contradicted ADR** (§1, rule 2): if the package contradicts a recorded decision, the review names the conflict and escalates to the human; it never approves a silent route-around.
- **Scope** (§1, rule 3): if the review discovers that the package steps outside the approved scope (the change plan, the design phase, or the roadmap), record it and escalate — don't redesign the package.
- Package not resolvable with confidence → stop and ask for the change-id/path; don't guess.

## Related

- `aidakit:planner` — the agent that authors the package this review evaluates
- `aidakit:adr-reviewer` — complementary gate: conformance with the repo's recorded decisions
- `aidakit:spec-reviewer` — complementary gate: spec format and testability
- `aidakit:orchestrator` — can delegate this review as a phase of the flow
- `aidakit:plan` — produces the implementation plan that feeds the package
- `aidakit:docs` — deploys and audits the document structure (placement per DOCS.md)
- `aidakit:governance` — execution doctrine, roles, and verdicts (GOVERNANCE.md)

<!-- aidakit v0.2 — generalized from the mx package (representante-digital) on 2026-07-17; paths and verdict vocabulary aligned to DOCS.md and GOVERNANCE.md — translated to EN -->
