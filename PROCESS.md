---
name: PROCESS
description: Process reference for the aidakit execution flow — how aidakit:design defines the plan (4 gated phases, deliverables in docs/design/) and how the suite executes change by change (aidakit:build → aidakit:plan → aidakit:readiness → implementation with TDD → aidakit:test/aidakit:coverage → aidakit:review → commit/PR → aidakit:docs after the merge). Consult when the user asks "how does the kit's process work", "what's the workflow", "which aidakit skill do I use now", when onboarding a new repo into the kit, or when deciding the next step of a change in progress.
---

# aidakit — Process reference

This is the process reference document for the execution of the **aidakit** plugin. It is not a skill: it describes how the kit's pieces fit together in any target repository.

---

## Doctrine

Two laws govern everything the kit does — every skill and agent cites and obeys them:

- **[DOCS.md](DOCS.md)** — standardized document architecture. Any creation, movement, or archiving of a document follows the placement tree, the seven inviolable rules, and the WORKING → DURABLE cycle from there. The `aidakit:docs` skill deploys, audits, and maintains this structure.
- **[GOVERNANCE.md](GOVERNANCE.md)** — how agents execute: authority model (the 3 escalations), everything via PR, separated roles (author ≠ reviewer ≠ shipper), git and ship guardrails. The `aidakit:governance` skill consults and applies this doctrine.
- **`hooks/pre-bash.js` hook (active with the plugin)** — mechanically enforces the git guardrails of GOVERNANCE.md §4 (no force-push, no `--no-verify`, nominal staging, no PR merge by the agent). A conscious bypass exists via `AIDAKIT_BYPASS=1`, always logged to `.claude/.cache/aidakit-bypass.log`.

If this document diverges from DOCS.md or GOVERNANCE.md, the doctrine wins and this file is corrected.

---

## 1. Overview — design defines, the suite executes

> **Names updated in v0.3:** `roteiro` → `design`, `flow` → `build`, `next` absorbed by `build`.

The kit splits the work into two layers:

- **Definition — `/aidakit:design` (skill `aidakit:design`).** A guided architecture design across **4 sequential gated phases**: (1) Business, (2) DDD Modeling, (3) Architecture, (4) Implementation. Each phase is an interview, produces an approved document in **`docs/design/`**, and only advances with explicit human approval. Phase 4 breaks the system into **vertical changes** and hands off to the execution layer.
- **Execution — the aidakit suite.** Skills and agents that carry one change at a time through a canonical pipeline: pick the next ready change, author the plan, pass the readiness gate, implement with TDD, validate tests and coverage, pass the gate against the diff, and ship via commit/PR. The human does the merge; the kit never does.

Commands use the **`/aidakit:*`** prefix. Skills are the human interface; they delegate to specialized **agents** (`agents/*.md` in the plugin) via the `Agent` tool. Parallel orchestration, validation, and prompt generation happen through the agents.

### Change tracking: OpenSpec is optional

Before running any cycle skill, detect the target repo's change-tracking mode:

- **OpenSpec mode** — the repo has an `openspec/` directory (or the `openspec` CLI installed). Changes live in `openspec/changes/<change-id>/` (`proposal.md`, `design.md`, `tasks.md`, `evidence.md`); shipped changes are archived in `openspec/changes/archive/`; capability specs live in `openspec/specs/`.
- **Kit mode (fallback)** — no OpenSpec. Use the canonical DOCS.md structure: **`docs/design/`** for the design deliverables, **`docs/features/<change-id>/`** for each change's artifacts (proposal/design/tasks/evidence, one directory per change), **`docs/specs/`** for the canonical specs, and **`docs/decisions/`** for the ADRs.

The pipeline is identical in both modes; only the paths and the mechanical validation commands change.

### Decisions (ADRs)

Reviews anchor on the repo's **recorded decisions**. They live in **`docs/decisions/ADR-NNN-slug.md`**, with an authoritative index in `docs/decisions/README.md` (and a `DECISION_INDEX.md` for discovery when ≥15 ADRs) — per DOCS.md. If a legacy repo has ADRs elsewhere, `aidakit:docs` audits and migrates them to the canonical structure. Every plan must cite the decisions it touches; the `aidakit:adr-reviewer` agent enforces the conformance.

### Command, skill, agent — the distinction (don't blur it)

The kit has three types of piece, and each exists for a reason. When creating something new, use the yardstick:

| Piece | What it is | Quick test | Examples |
|---|---|---|---|
| **Command** (`/aidakit:x`) | A shortcut the **human types** to start something. A thin file in `commands/` that invokes a skill or the engine. | "Does the human trigger this on purpose?" | `/aidakit:design`, `/aidakit:build`, `/aidakit:review` |
| **Skill** | Doctrine/procedure that Claude applies **in the current context** (does not isolate context). Lives in `skills/`. | "Is it a rule Claude follows while working?" | `test-driven-development`, `docs`, `governance`, `postgres-best-practices` |
| **Agent** | An **isolated-context** subagent that receives a task, works alone, and comes back with a verdict/result. Lives in `agents/`. | "Does it need its own context and come back with a result?" | the review bench reviewers, `planner`, `orchestrator`, `implementer` |

The rule that prevents the imbalance: **isolable work that comes back with a verdict is an agent**, not a skill. The review bench are parallel agents precisely so that each one judges independently, without bloating the main context. The cycle skills (`plan`, `review`, `implement`, `brainstorm`) are **thin**: they carry the doctrine (the HOW) and **dispatch the agent** that does the work. Not every command becomes its own skill, and not every skill becomes a command — only what the human starts on purpose gets a command (which is why the kit doesn't have an explosion of commands per step).

---

## 2. The per-change cycle

Every non-trivial change goes through this pipeline:

```
Next change from the design (or a new idea)
        ↓
  aidakit:build (picks the change and drives)  ←─ aidakit:orchestrator picks the next change
        ↓                  ready and generates a self-contained prompt for a new session
  aidakit:plan          ←─ aidakit:planner authors the plan-only change
        ↓                  (proposal / design / tasks / evidence — no product code)
  aidakit:readiness     ←─ GATE 1: 13-step readiness review of the plan package.
        ↓                  Verdict: Status: APPROVED | NEEDS-REVISION | BLOCKED
        ↓                  + Ready to implement: yes | no
  implementation        ←─ TDD (skill test-driven-development): RED → GREEN → REFACTOR
        ↓
  aidakit:test          ←─ focused tests per surface + coverage report
  aidakit:coverage      ←─ deep gap analysis when coverage falls below target
        ↓
  aidakit:review --diff ←─ GATE 2: bench of reviewer agents in parallel (adr + spec always;
        ↓                  quality/security/architecture/tester by role×flag matrix)
        ↓                  + structural validation, against the implemented diff
  commit / PR           ←─ commit-commands plugin (/commit or /commit-push-pr).
        ↓                  Stops at the PR URL — never merges.
  human does the merge on the Git host
        ↓
  aidakit:docs          ←─ AFTER the merge: dated archive of the change + spec promotion
        ↓                  (DOCS.md §4, WORKING → DURABLE)
  report done           ←─ tell aidakit:orchestrator "<change-id> done, PR #N merged";
                           it updates the state and returns the next prompt
```

### Step by step

1. **`/aidakit:build`** — entry point. The first step of the build picks the change and drives: the `aidakit:orchestrator` agent inspects the repo's real artifacts (active changes, `git log`, archive, open decisions), verifies that the dependencies have already been shipped, and returns a self-contained prompt to paste into a new session. The prompt embeds the current commit hash, the artifact paths, the cited decisions, and the escalation triggers of GOVERNANCE.md §1 (never merge, never supersede an ADR without human approval, stay within the approved scope).

2. **`/aidakit:plan <change-id-or-description>`** — when the change doesn't have a spec yet. The `aidakit:planner` agent (in the new session) authors the plan-only artifacts: `proposal.md` + `design.md` + `tasks.md` + a stub of `evidence.md`, plus the change metadata — as an OpenSpec change or in `docs/features/<change-id>/` in kit mode. The implementation plan (effort, risks, file structure per surface) is part of what `plan` produces. The planner reads the repo's recorded decisions, the list of open decisions if one exists, and the specs the change extends. Cross-checks: every cited decision exists; every `design.md` deliverable has a bullet in `tasks.md`; every path in `tasks.md` matches the repo's real layout. **Plan-only — never writes product code.** If the change-id already exists, the planner refuses and asks whether to extend or rename.

3. **`/aidakit:readiness` — GATE 1.** The kit's strongest readiness review: 13 steps over the complete plan package before any implementation. Machine-parseable verdict (verbatim, in English): `Status: APPROVED | NEEDS-REVISION | BLOCKED` and `Ready to implement: yes | no`. Implementation happens only with `Status: APPROVED` and `Ready to implement: yes`; `NEEDS-REVISION` goes back to the author to fix. GOVERNANCE.md §3 doctrine holds: the reviewer reports, doesn't fix; an approved verdict with an open blocker is forbidden.

4. **Implementation with TDD.** The executing session (or the implementation agents available in the environment — see `/aidakit:catalog`) implements the tasks following the **`test-driven-development`** skill: write the failing test first (RED), make it pass (GREEN), then refactor (REFACTOR). Non-negotiable quality bars: no untyped escapes (`any` and equivalents), no forgotten debug prints, typed exceptions, mandatory edge cases. When a bug or unexpected behavior shows up mid-implementation, apply the **`systematic-debugging`** skill before proposing fixes. Before coding, re-inspect the repo's real state — a plan premise changed → STOP and report (GOVERNANCE.md §8).

5. **`/aidakit:test` and `/aidakit:coverage`.** `/aidakit:test <surface>` runs a surface's focused test suite with a coverage report — **discover the target repo's surfaces** (the packages/apps/services layout and their test commands); don't assume a fixed list. Default thresholds (repo config wins when it diverges): **critical paths ≥85%** (services, schemas, controllers, adapters), **overall ≥80%**. Block-vs-warn policy: a test failure, type error, or lint error **blocks** the commit; coverage between 80–85% on a critical path **warns** but does not block. `/aidakit:coverage` does the deep cross-surface gap analysis and suggests concrete tests when a threshold isn't met. Run the full set of surfaces before the final gate — running a single surface can hide cross-surface regressions.

6. **`/aidakit:review --diff` — GATE 2.** Runs the reviewers **in parallel, in the same message**, now against the implemented diff:
   - `aidakit:adr-reviewer` — conformance with the repo's recorded decisions; reports violations with file:line + decision reference; flags REQUIRES SUPERSEDER when the change inherently contradicts a locked decision. Reports only — never fixes.
   - `aidakit:spec-reviewer` — conformance with the canonical requirement specs; reports **scope creep** (an item not derivable from any requirement) and **gaps** (a requirement the change should deliver but doesn't).
   - A **structural validation** pass — in `--diff` mode, it skips validating the change's artifacts and checks the structure of the diff itself. (Invoked without `--diff`, against the change's artifacts — useful as a complementary check to readiness — it runs `openspec validate <change-id> --type change --strict` in OpenSpec mode; in kit mode, mechanical checks: internal markdown links resolve, every requirement has at least one scenario, headers align across proposal/design/tasks, paths match the repo layout.)

   The findings are aggregated under a per-reviewer subheading with a **PASS/FAIL verdict** at the top of each one. The gate must PASS before the commit. Each branch passes this gate independently — parallel work does not relax it.

7. **Commit / PR — `commit-commands` plugin.** Use `/commit` (commit only) or `/commit-push-pr` (commit, push, open the PR). Doctrine that holds regardless of tooling (GOVERNANCE.md §4, enforced by the hook where possible):
   - Explicit, nominal staging — never `git add -A`/`git add .`; always check what's staged.
   - **Never stage secrets**: `.env`, `*credentials*`, `*secret*`, `*.pem`, `*.key`.
   - Conventional commits: `type(scope): description`, the body explains the *why* and lists the change's artifacts.
   - Never `--no-verify`. On a pre-commit hook failure: stop, show the error, fix, re-stage, and create a **new commit** — never `--amend` after a hook failure.
   - Never push or force-push to the main branch; work on a feature branch.
   - **Stop at the PR URL. The kit never merges — the human does.**

8. **`/aidakit:docs` — after the merge.** The human promotion gate of DOCS.md §4 (WORKING → DURABLE): the spec deltas merge into the canonical specs (`docs/specs/` or `openspec/specs/`), learnings become guides or ADRs, and the change directory goes to the dated archive — `docs/archive/YYYY-MM-DD-<change-id>/` in kit mode (with a legacy banner and an anti-rotten-link stub), or `openspec archive <change-id> --yes` in OpenSpec mode. This bookkeeping also goes via a short branch + PR — straight-to-main does not exist for agents (GOVERNANCE.md §2).

9. **Report done.** After the archive, tell the orchestrator: `<change-id> done, PR #N merged`. The `aidakit:orchestrator` verifies the merge, updates the design state (`docs/design/STATE.md`), and returns the next ready prompt — closing the loop back to step 1.

### Serial vs parallel implementation

The `aidakit:orchestrator` decides the mode by reading the plan:

| Signal in the plan | Mode | What happens |
|---|---|---|
| 1 surface touched | **Serial** | Sequential prompt, one implementation step after another |
| 2+ surfaces touched | **Parallel** | One git worktree per surface (`git worktree add ../wt-<change-id>-<surface> -b feat/<change-id>-<surface>`), implementation agents fired concurrently in a single message |
| Header `**Orchestration:** serial` | **Forced serial** | Even with 2+ surfaces |
| Header `**Orchestration:** parallel` | **Forced parallel** | Even with 1 surface |

Surfaces are whatever the target repo's layout defines (apps, packages, services) — discover them; never assume a fixed list.

**When NOT to parallelize (even with 2+ surfaces):** tightly coupled work (surfaces co-develop a shared contract), estimated scope below ~2h (setting up a worktree costs more than it saves), or `feat/<change-id>-*` branches already active.

**Gate in both modes:** each branch passes `/aidakit:review --diff` independently before the merge. **Merge order:** the one declared in the plan; when the plan is silent, merge the surface that owns the shared contracts first, then the consumers. After the merges, remove the worktrees.

### Bug fixes and hotfixes

- **Bug fix:** reproduce first (use `systematic-debugging`), estimate; below ~2h skip the planning step and go straight to fix + regression test → `/aidakit:test` → `/aidakit:review --diff` → `/commit`. Above ~2h, run the full cycle.
- **Hotfix (production blocked):** skip planning, fix with a comprehensive regression test, review aggressively (`/aidakit:review --diff` plus manual verification), ship immediately. The never-merge and never-stage-secrets guards still hold (GOVERNANCE.md §§1, 4).

### Running the cycle as an executable flow

Everything above describes the cycle in prose: you (or an executing session) call the skills in order, by hand. The same cycle can now **also be EXECUTED** by the flow engine in [governance/](governance/README.md) — the deterministic spine that carries the order, the gates, and the resumable state, letting Claude dispatch each skill via inversion of control. The engine never runs the skill by itself: each `invoke` step (the field is `invoke_target:` — the step dispatches a SKILL **or** an agent; the legacy type/field `agent`/`agent:` is still accepted as a backward-compatible synonym) pauses, Claude executes the skill and resumes the flow with the outcome (see [governance/README.md](governance/README.md), the source of truth of the engine).

Two default flows cover the two weights of work:

- **[`fast`](governance/flows/fast.yaml)** — light, small, reversible work: from change to PR with minimal ceremony (it's the canonical cycle of section 2).
- **[`full`](governance/flows/full.yaml)** — broad, architectural, or irreversible work: adds adversarial brainstorm, independent spec critic, pre-apply gate, bench review, and a learning step before the PR.

The step-by-step usage lives in the [docs/guides/flows.md](docs/guides/flows.md) guide; here is only the mapping of each cycle step to the skill the flow invokes:

| Cycle step | Skill the flow invokes |
|---|---|
| pick the change (1st step) | `aidakit:orchestrator` picks the next ready change (in the `fast` flow, that 1st step already fires `aidakit:plan`) |
| plan | `aidakit:plan` |
| readiness | `aidakit:readiness` |
| implement | `aidakit:implement` |
| test | `aidakit:test` |
| review | `aidakit:review` |
| ship | `aidakit:ship` |

**The flow is OPTIONAL.** The skill-guided cycle as today — you calling `/aidakit:build`, `/aidakit:plan`, … in order — remains fully valid and is the default path. The flow does not replace anything: it only adds **deterministic order + resumable state** (close the session, resume days later from where you stopped) for those who want that spine on top of the cycle. The doctrine does not change — the human gates, the never-merge, and the GOVERNANCE.md guardrails hold the same inside or outside the flow.

---

## 3. Kit inventory — skills and agents, and when to use each

### Authoring skills

| Skill | When to use |
|---|---|
| `aidakit:design` | Start or resume the guided architecture design (4 gated phases). New projects, or resuming from `docs/design/STATE.md`. Command: `/aidakit:design`. |
| `aidakit:build` | Build a change from plan to PR. Execution entry point: the 1st step picks the next ready change and generates the execution prompt; it also drives the cycle through the executable flow engine (start/resume/status/abort/list — see §2 "Running the cycle as an executable flow"). Command: `/aidakit:build`. |
| `aidakit:plan` | You have an idea/change still without a spec. Generates the prompt for `aidakit:planner` to author the plan-only artifacts (includes the implementation plan: effort, risks, file structure). |
| `aidakit:spec` | Read/show a spec, discover related specs and decisions, or validate work against a spec. Documents the proposal template with quality checks. |
| `aidakit:readiness` | The strongest gate: 13-step readiness review of the plan package before implementation (GATE 1). Verdict `Status: APPROVED \| NEEDS-REVISION \| BLOCKED` + `Ready to implement: yes \| no`. |
| `aidakit:test` | Run a surface's focused test suite with a coverage report; before every commit. |
| `aidakit:coverage` | Coverage came in below target, or before the PR: cross-surface gap analysis with concrete test suggestions. |
| `aidakit:review` | The post-implementation gate (GATE 2, `--diff`): the two reviewers in parallel + structural validation, PASS/FAIL verdict. Also runs against the change's artifacts (without `--diff`) as a complementary check to readiness. |
| `aidakit:catalog` | You don't know which tool applies, or want to check "do I have something ready for X?" before writing from scratch. Searchable catalog of skills, commands, agents, and plugins. Command: `/aidakit:catalog`. |
| `aidakit:docs` | Deploy, audit, and maintain the DOCS.md document structure in a repo. In the cycle: after the merge, it promotes specs and archives the change (DOCS.md §4). |
| `aidakit:governance` | Consult and apply the GOVERNANCE.md execution doctrine: authority model, git/ship guardrails, roles, the pre-bash hook, and logged bypass. |

### Supporting skills in the cycle

| Skill | When to use |
|---|---|
| `test-driven-development` | Any feature or bugfix implementation — load before writing implementation code. RED → GREEN → REFACTOR. |
| `systematic-debugging` | Any bug, test failure, or unexpected behavior — before proposing fixes. |

### Navigation

| Item | When to use |
|---|---|
| `PROCESS.md` (this document) | Reference for how the whole process fits together. |

### Curated technical skills

Loaded on demand when the change touches their domain (full catalog with sources in `skills/catalog/INDEX.md`):

| Skill | When to use |
|---|---|
| `ddd-strategic-design` | Modeling subdomains, bounded contexts, ubiquitous language (support for phase 2 of the design). |
| `postgresql` / `postgres-best-practices` / `neon-postgres` | Schema design, query/index optimization, serverless Postgres patterns. |
| `saas-multi-tenant` | Multi-tenant architecture: RLS, tenant-scoped queries, shared-schema isolation. |
| `react-best-practices` | React/Next.js components, data fetching, performance review. |
| `vitest` | Test writing, mocking, coverage configuration with Vitest. |
| `security-threat-model` | An explicit request for a threat model of a codebase (trust boundaries, abuse paths, mitigations). |
| `skill-scanner` | Vetting third-party skills before adopting them into the kit. |
| `multi-agent-patterns` | Designing multi-agent systems: supervisor, swarm, context isolation, handoffs. |
| `tool-design` | Building or fixing tools that agents consume. |
| `ai-native-cli` | Designing CLIs that AI agents use safely. |
| `advanced-evaluation` | LLM-as-judge, output comparison, evaluation rubrics, and bias mitigation. |
| `context-compression` | Long agent sessions where history compression becomes necessary. |

### Agents (`agents/` in the plugin)

Invoked via the `Agent` tool — normally by the skills above, rarely directly. All follow the mandatory anatomy of GOVERNANCE.md §7:

| Agent | Model | Role | Invoked by |
|---|---|---|---|
| `aidakit:orchestrator` | opus | Coordinates the pipeline: picks the next ready change, generates self-contained prompts (serial or parallel with worktrees), updates the state on "done" reports. **Never merges a PR.** | `aidakit:build` (1st step), `aidakit:plan`, done reports |
| `aidakit:planner` | opus | Authors the plan-only artifacts (proposal/design/tasks/evidence + spec deltas). Reads decisions and specs; cross-checks citations and paths. **Never writes product code.** | `aidakit:plan` |
| `aidakit:brainstorm` | sonnet | Grills the owner on the 4 attack axes (scope, end effect, edges, confrontation with the law) via `AskUserQuestion`, one line of reasoning at a time. Only extracts requirements — never implements nor writes a spec. Returns premises, acceptance criteria, questions asked, and a trail event. | `aidakit:brainstorm`, 1st step of the `full` flow |
| `aidakit:implementer` | sonnet | Implements a change task by task with TDD (RED → GREEN → REFACTOR) in isolated context, applying the kit's quality bars and re-inspecting the repo before coding. Returns the diff, marked tasks, outcome success\|failure, and correction events. | `aidakit:implement`, the build's `implement` step |
| `aidakit:tester` | sonnet | Analyzes coverage through the **behavioral** lens (not % of lines): maps each new/changed behavior to a test, prioritizes gaps (score 1-10 + where to write it), and points out fragile tests. Returns a structured coverage verdict. | `aidakit:review --diff`, `aidakit:test`/`aidakit:coverage` |
| `aidakit:reviewer-quality` | sonnet | Reviews the diff's **code quality** in 4 phases (context → architecture → line-by-line → summary). Severity-tagged findings (blocking/important/nit/praise) with file:line. Report, don't fix. Returns ONE verdict approved\|rejected. | `aidakit:review` (bench) |
| `aidakit:reviewer-security` | sonnet | Audits the diff across the six vulnerability categories (injection, authn/authz/IDOR, data exposure, weak crypto, hardcoded secret, insecure config), with a mandatory false-positive filter; the scope is the diff (removed lines count). With no security surface, it declines. Returns ONE verdict approved\|vetoed. | `aidakit:review` (bench) |
| `aidakit:reviewer-architecture` | sonnet | Reviews the diff's **design** (Explore → Report → Grill): applies the deletion test to each new module and the anchor checklist (single owner, cut-not-copy, layer boundaries, contract → consumers). Complements `aidakit:adr-reviewer`. Returns ONE verdict approved\|rejected. | `aidakit:review` (bench) |
| `aidakit:adr-reviewer` | (default) | Reviews plan or diff against the repo's recorded decisions. Critical/Minor findings with file:line + decision reference; flags REQUIRES SUPERSEDER. Report, don't fix. | `aidakit:review` |
| `aidakit:spec-reviewer` | sonnet | Reviews plan or diff against the canonical requirement specs. Two failure modes: scope creep and gaps. Report, don't fix. | `aidakit:review` |
| `aidakit:research` | sonnet | Read-only investigator. Glob/Grep/Read + read-only git and spec commands. Answers with inline citations (file:line, decision, spec requirement, commit hash). Never edits. | Any skill/agent that needs facts before deciding; direct questions ("where is X defined?") |

### External dependency

| Plugin | Role in the cycle |
|---|---|
| `commit-commands` | `/commit` and `/commit-push-pr` close the cycle (stage → conventional commit → push → PR). The kit assumes it's installed; the doctrine guards of section 2, step 7, hold on top of it. |

---

## 4. Where the state lives

**`docs/design/STATE.md`** is the single source of truth for the process state in the target repo. It records:

- the current design phase and which phase documents are approved (the gates);
- the change backlog produced by phase 4 and the status of each change (ready / in progress / shipped);
- pointers to the artifacts of the in-flight change (branch, PR, change directory).

Everything else lives in the repo's own artifacts — no hidden state (GOVERNANCE.md §6: multi-session coordination only through versioned artifacts):

| State | Where |
|---|---|
| Process/design state | `docs/design/STATE.md` |
| Design deliverables | `docs/design/` |
| ADRs | `docs/decisions/` (authoritative index in `docs/decisions/README.md`) |
| Active changes | `openspec/changes/` (OpenSpec mode) or `docs/features/<change-id>/` (kit mode) |
| Canonical specs | `openspec/specs/` (OpenSpec mode) or `docs/specs/` (kit mode) |
| Shipped changes | `openspec/changes/archive/` (OpenSpec mode) or `docs/archive/YYYY-MM-DD-<change-id>/` + change marked as shipped in `STATE.md` (kit mode) |
| In-flight work | git: feature branches, worktrees, PRs |

The `aidakit:orchestrator` reads this state to pick the next change and updates it when a change is shipped. Sessions are disposable; the state is not — you can close a session and resume weeks later from `STATE.md`.

<!-- aidakit v0.3 — reorg 11 agentes + 8 comandos; skills brainstorm/implement/review finas; renome roteiro→design, flow→build, next absorvido pelo build, 2026-07-17 — translated to EN -->
