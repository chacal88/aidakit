---
name: plan
description: Generates the self-contained prompt for authoring a new change in plan-only mode. The aidakit:planner agent (invoked in a fresh session) produces proposal.md, design.md, tasks.md, evidence.md, and optional spec deltas — as an OpenSpec change when the target repo uses OpenSpec, or under docs/features/ otherwise. It also optionally covers the concrete implementation plan inside design.md — surface-by-surface file structure, 3-point estimate, and risk matrix. No product code in this phase. Use when the user asks to plan a change, author a proposal, draft a change or feature spec, plan a feature or hardening item, break the implementation down by surface, estimate a change's effort/risk, kick off a new plan-only change, or invoke /aidakit:plan.
---

# aidakit:plan — plan a new change (plan-only)

> Packages the self-contained prompt a fresh session uses to invoke `aidakit:planner` and author the four mandatory planning artifacts (plus the change metadata) of a new change — the actual planning happens in the spawned session; this skill only builds the prompt.
>
> The `design.md` the planner authors optionally covers the change's **concrete implementation plan**: surface-by-surface file structure, 3-point estimate, and risk matrix. When the change is non-trivial, the generated prompt instructs the planner to fill in those sections; when it's a trivial bugfix or a single-file change, they are waived.

## When to use (and when not)

- **Use** when the user asks to plan a change, author a proposal, draft a change or feature spec, plan a feature or hardening item, break the implementation down by surface, estimate a change's effort/risk, or kick off a new plan-only change.
- **Use** via direct invocation:

  ```
  /aidakit:plan <change-id-or-description>
  ```

  Examples:

  - `/aidakit:plan orders-retry-safety`
  - `/aidakit:plan "add admin bulk-cancel for stuck records"`

- **Concrete implementation plan:** the change's `design.md` carries the implementation plan (surface-by-surface structure, estimate, risks). There is no separate downstream step for it — it's absorbed here.
- **Do not use** expecting the planning to happen in this session — the generated prompt is for the user to paste into a fresh execution session.

## Prerequisites

- **Mandatory input:** a change-id (kebab-case) or a short description of the feature/hardening item to plan. If the input comes in empty, ask the user (via `AskUserQuestion`) which feature or hardening item to plan.
- **Target repo layout detection** — detect which layout the repo uses before building the prompt (per DOCS.md §1):
  - **OpenSpec mode** — the repo has an `openspec/` directory (or the `openspec` CLI installed): change artifacts live in `openspec/changes/<change-id>/`, capability specs in `openspec/specs/<capability>/spec.md`.
  - **Kit mode** — otherwise: change artifacts live in `docs/features/<change-id>/` (change specs), canonical specs in `docs/specs/`, and architecture-level deliverables in `docs/design/`.

## Process

0. **Read `input.retry_history_path` when this skill is dispatched with one** (the `full` flow's `specify` step injects it — see [retry-memory/design.md](../../docs/archive/2026-07-24-retry-memory/design.md#read-side-injection--how-aidakitimplement-and-plan-learn-see-the-history)). It may be absent or empty — that's round-1 semantics, never a bug. When it resolves to a real file, read it and filter records where `step_id === "specify"`; if any remain, embed a preamble bullet in the generated prompt (step 1 below) with the prior rounds' `cause` list, e.g. `[{"round": 1, "step_id": "specify", "cause": "critic-reject"}]` → "Round 1 was rejected by the critic (`critic-reject`). Steer explicitly away from repeating that in this round's spec." — so the fresh session's `aidakit:planner` dispatch actually sees it, not just this session.

1. Invoke the `aidakit:orchestrator` agent with this prompt:

   > Build the self-contained prompt the user pastes into a fresh execution session to author the change `<change-id-or-description>`. The prompt MUST embed:
   >
   > - The prior rounds' `retry_history_path` preamble from step 0 above, when non-empty — so `aidakit:planner` steers away from the causes that already got this spec rejected
   > - The current commit hash on the default branch (`git log -1 --format=%H <default-branch>`)
   > - The list of already-completed changes (OpenSpec mode: `ls -t openspec/changes/archive/ | head -20`; kit mode: existing entries under `docs/features/` and archives under `docs/archive/`)
   > - The requested change-id or description, verbatim
   > - The current phase or milestone of the project, if the repo records that in a briefing/roadmap
   > - Reading list: the repo's recorded decisions (`docs/decisions/` — the `README.md` index and, where present, `DECISION_INDEX.md`) — the index plus every ADR relevant to the change; the tech specs paired to those decisions, wherever the target repo keeps them (discover from the repo — don't assume paths); existing capability specs (`openspec/specs/<capability>/spec.md` in OpenSpec mode; `docs/specs/` in kit mode); and the repo's architecture document (`docs/architecture/ARCHITECTURE.md`, if present) and the open decisions log, if any
   > - Explicit instruction to invoke `aidakit:planner` (`subagent_type: "aidakit:planner"`) to author the artifacts at the detected location (`openspec/changes/<change-id>/` or `docs/features/<change-id>/`):
   >   - `proposal.md` — MUST carry a `## Acceptance criteria` section (Markdown bullet list, `- \`criterion-id\` — prose` or plain `- prose`): the observable-effect promises the goal-leash (`aidakit:acceptance-planner` + `check-acceptance.js`) maps to evidence in the `fast` flow, where there is no brainstorm step. Distinct from the existing `## Exit criteria` section (validator commands / green-suite gates) — the two do not merge; `## Acceptance criteria` is new and mandatory from this change onward, `## Exit criteria` is unchanged. [governance/acceptance/parse-criteria.js](../../governance/acceptance/parse-criteria.js) reads `## Acceptance criteria` (never `## Exit criteria`) when `brainstorm.json` is absent.
   >   - `design.md` — architecture decisions and, when the change is non-trivial, the **concrete implementation plan** (see "Implementation plan in design.md" below): surface-by-surface file structure, 3-point estimate, and risk matrix. A trivial bugfix or single-file change waives those sections.
   >   - `tasks.md`
   >   - `evidence.md` (stub)
   >   - OpenSpec mode only: `.openspec.yaml` following the `schema` convention of the repo's existing changes
   >   - `specs/<capability>/spec.md` only when a capability is created or modified (spec delta — only merges into the canonical specs at the human promotion gate, DOCS.md §4)
   > - Explicit instruction to run `/aidakit:review <change-id>` once `aidakit:planner` finishes — all reviewers (including `aidakit:adr-reviewer` and `aidakit:spec-reviewer`) must pass before any code is written
   > - Explicit instruction to open the plan-only PR via the `commit-commands` plugin (`/commit-push-pr`) once the plan is reviewed (a plan-only PR adds the change to the default branch; the implementation happens in a subsequent change)
   > - **Content language:** read the `language` field from `aidakit.config.yaml` at the target project root (default when absent or the file is missing: `en`) and instruct `aidakit:planner` to write the readable PROSE of the artifacts — the `proposal.md`, `design.md` and `tasks.md` body text, and any spec-delta narrative — in that language. What stays FIXED regardless of `language`: identifiers (`aidakit:*`, file names, field/key names), machine-parseable verdicts (e.g. `Status: APPROVED | NEEDS-REVISION | BLOCKED`, read by the review validator), the structural headers of ADR/spec in OpenSpec mode (`## Context`, `### Requirement:`, `#### Scenario:` — structural validation reads these), and the classification enums (`bug`, `feature`, `contract`, `ui`, …). See the [config reference](../../docs/reference/config.md) and [DOCS.md §5](../../DOCS.md).
   > - Escalation triggers: no product code yet (plan-only); do not supersede the repo's recorded ADRs; do not step outside the current phase's scope; do not merge the PR (GOVERNANCE.md §1); every task path must fall under the repo's real surfaces/workspaces — discover them from the repo structure and its recorded decisions, don't assume a fixed list
   >
   > Return only the prompt — the user copies it into a fresh execution session. Do not author the change yourself in this session.

2. Display the prompt verbatim.

## Implementation plan in design.md

Beyond the architecture decisions, a **non-trivial** change's `design.md` carries the concrete implementation plan. Instruct `aidakit:planner` to fill it in when the change is a new feature, cross-surface (touches 2+ surfaces), a complex multi-module bug, or a hardening item. **Waive** it for a trivial bugfix (<30 min), a single-file typo/style fix, or an ultra-simple improvement.

The plan derives from the very spec being authored (proposal + deltas), not from an external spec. Discover the target repo's **surfaces** from its structure (workspaces in `package.json`/`pnpm-workspace.yaml`/`turbo.json`/`nx.json`, top-level directories, `docker-compose` services, `CLAUDE.md`) — never assume a fixed list or framework. Plan in dependency order: data/schema → services → endpoints → frontend → integrations/workers.

### Surface-by-surface structure

Cover **every discovered surface that changes**, in the stack the repo actually uses (read it from `CLAUDE.md`, manifests, or existing modules):

- **Backend/API** — modules to create/modify; services and responsibilities; input validation (DTOs or equivalent); endpoints/handlers; schema changes and migrations; queue publishing (if the repo uses one).
- **Frontend** — pages/components (respecting the repo's server/client conventions); forms and validation (with the repo's libs); data-fetching strategy; UI/UX considerations.
- **Worker/integration** — adapter changes for external systems; queue consumption; async patterns; error handling and retries; external API calls.

Close with the explicit **file structure** — what to **create**, **modify**, and **delete**, with real paths from the target repo (never generic).

### 3-point estimate

```
Optimistic: 2 hours (happy path only)
Likely: 4 hours (expected complexity)
Pessimistic: 6 hours (unknowns, edge cases)

Recommendation: start from "Likely"; adjust if a blocker comes up.
```

### Effort breakdown and risk matrix

One row per discrete deliverable. `Type` ∈ {Core, Testing, Integration, Documentation, Migration}. `Hours` is a single committed number (if you can only give a range, list the assumption that would shrink it). Real repo paths.

| Component | Hours | Type | Risk |
|-----------|-------|------|------|
| `RulesEngine` class (`<backend-surface>/src/modules/pricing/rules-engine.service.ts`) | 4 | Core | LOW |
| Unit tests (`rules-engine.service.spec.ts`) | 2 | Testing | LOW |
| Integration tests against the real database | 1 | Testing | MEDIUM (local container setup) |
| Wire into `PricingService.suggestPrice` | 1 | Integration | LOW |
| Update the affected section of the change spec | 0.5 | Documentation | LOW |
| **Total** | **8.5** | | |

**Risks & mitigations** — Probability × Impact, both `LOW`/`MEDIUM`/`HIGH`. A risk row without a mitigation is incomplete — complete or remove it.

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Rule complexity overruns the JSON DSL | MEDIUM | HIGH | Fall back to a scripted DSL in a future change; the current scope only ships the rule types listed in the relevant recorded decision |
| Production edge cases (NULL prices) | MEDIUM | MEDIUM | Unit tests cover NULL/zero/negative; integration test guarantees rejection with a validation error |
| Performance at production volume | LOW | MEDIUM | Benchmark in the integration tests; if p99 overruns the latency budget, add caching (separate change) |

**Assumptions** — each one is a point where the plan breaks if reality differs; verify before coding. Cite the ADR/recorded decision when the assumption comes from there. The executor re-inspects the repo's real state before coding; a changed assumption → stop and report (GOVERNANCE.md §8).

**Dependencies** — cite the spec, the recorded decision, or the change-id that delivered each one.

## Outputs

- **From this session:** only the self-contained prompt, displayed verbatim — no file is created or modified here. The prompt is self-contained with fresh facts from the repo (commit hash, completed changes, gates and escalations embedded), per GOVERNANCE.md §6.
- **From the execution session (when the user pastes the prompt):** the change artifacts at the location dictated by DOCS.md — `openspec/changes/<change-id>/` (OpenSpec mode) or `docs/features/<change-id>/` (kit mode): `proposal.md`, `design.md` (with the concrete implementation plan embedded when the change is non-trivial), `tasks.md`, `evidence.md` (stub), `.openspec.yaml` (OpenSpec only), and spec deltas when applicable — plus the plan-only PR. The change-id follows the single key end-to-end: change-id = branch = PR title suffix (DOCS.md §2, rule 7).

## Gates and guardrails

- **Refuse to plan a change whose change-id already exists** in the detected changes location (`openspec/changes/` or `docs/features/`) — the orchestrator checks; ask the user to extend the existing change or pick another name.
- **Do not run `aidakit:planner` in this session** — the prompt is for a fresh session.
- **Do not modify the change artifacts in this session.**
- **Do not approve, review, or ship** — review is `/aidakit:review`, ship is the `commit-commands` plugin (`/commit-push-pr`). Author ≠ reviewer ≠ shipper (GOVERNANCE.md §3).
- **Mandatory escalations** (GOVERNANCE.md §1): a PR merge is never the agent's; supersede or contradict an ADR → propose and wait for the human; step outside the approved scope → stop and report.
- **Never assume a framework or stack in the implementation plan** — read it from the target repo's `CLAUDE.md`, manifests, and existing modules; the paths must match real surfaces.
- **A plan that proposes or contradicts a recorded decision** → escalate to the human: propose a new draft ADR with the conflict named; never route around an ADR silently (GOVERNANCE.md §1).
- **A risk row without a mitigation is incomplete** — complete or remove it; and no vague estimate (a committed number, not "it depends").

## Related

- `aidakit:review` — the mandatory review gate after planning
- `aidakit:planner` — the agent that authors the artifacts (in the execution session)
- `aidakit:orchestrator` — the agent that builds the self-contained prompt
- `/aidakit:flow-build` — downstream: builds the change from the plan (from plan to PR, over the flow engine)
- `aidakit:adr-reviewer`, `aidakit:spec-reviewer` — the reviewers that must pass before code
- `aidakit:docs` — deploys and audits the doc structure this skill presupposes
- Official `commit-commands` plugin (`/commit-push-pr`) — ships the plan-only PR

<!-- aidakit v0.3 — generalized from the mx package (representante-digital) on 2026-07-17 — translated to EN -->
