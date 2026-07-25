# Reference — aidakit skills and commands

> **Precedence:** this guide summarizes and points. If it diverges from the linked skill or doctrine ([DOCS.md](../../DOCS.md), [GOVERNANCE.md](../../GOVERNANCE.md), [PROCESS.md](../../PROCESS.md), or each skill's `SKILL.md`), **the other wins and this file is corrected**.
>
> Examples use the canonical **razor** project (a scheduling SaaS for barbershops; NestJS + React + PostgreSQL/Neon + Prisma). How the skills fit into the full cycle is in [PROCESS.md](../../PROCESS.md).

## Summary table

| Skill | What it does | When it triggers |
|---|---|---|
| [`/aidakit:flow-design`](../../commands/flow-design.md) (command, not a skill) | Plans the project — architecture design in 4 phases with gates (Business → DDD → Architecture → Implementation) | New project, or resuming via `docs/design/STATE.md` |
| [aidakit:identify-domain](../../skills/identify-domain/SKILL.md) | Classifies the change into domain × type × flags (fail-closed) to select ammunition and the review matrix | Step 1 of any new change, before the brainstorm |
| [aidakit:brainstorm](../../skills/brainstorm/SKILL.md) | Default-on adversarial brainstorm that grills the owner with the project's ammunition before the spec | Start of a new change, idea exploration, 1st step of the flow |
| [aidakit:plan](../../skills/plan/SKILL.md) | Generates the prompt for `aidakit:planner` to author a plan-only change (including the implementation plan from an existing spec) | Change/idea still without a spec, or the implementation plan before coding |
| [aidakit:spec](../../skills/spec/SKILL.md) | Reads specs inline with related specs, ADRs, and validation commands | "What does the spec for X say?", keyword discovery |
| [aidakit:readiness](../../skills/readiness/SKILL.md) | GATE 1 — 14-step readiness review of the plan package | "Can we start coding?", complete plan package |
| [aidakit:implement](../../skills/implement/SKILL.md) | Thin implementation envelope with TDD (RED→GREEN→REFACTOR) that emits an outcome to the flow | Approved plan, the flow's `implement` step |
| [aidakit:test](../../skills/test/SKILL.md) | Surface-focused tests with a coverage report | Post-implementation, before every commit |
| [aidakit:coverage](../../skills/coverage/SKILL.md) | Deep coverage-gap analysis with suggested tests | Coverage below target, or before the PR |
| [aidakit:review](../../skills/review/SKILL.md) | GATE 2 — structural validation + 2 reviewers in parallel, PASS/FAIL verdict | Post-plan and post-implementation, before the ship |
| [aidakit:ship](../../skills/ship/SKILL.md) | Delivers up to the PR URL (nominal staging, commit, push, PR) and stops; the merge is the human's | Reviewed change, the flow's `pr`/`ship` step |
| [aidakit:reflect](../../skills/reflect/SKILL.md) | Lightweight post-phase reflection (3 questions) that emits events to learn | Phase with `reflect: true`, quick retro of a step |
| [aidakit:learn](../../skills/learn/SKILL.md) | Consolidates the change's learning and PROPOSES doc/rule updates (never writes blindly) | End of change, "what did we learn", "consolidate", "retro" |
| [aidakit:docs](../../skills/docs/SKILL.md) | Deploys, audits, and maintains the DOCS.md document architecture | Project init, audit, post-merge archive |
| [aidakit:governance](../../skills/governance/SKILL.md) | Explains, audits, and deploys the GOVERNANCE.md doctrine | Command blocked by the hook, audit, onboarding |
| [aidakit:catalog](../../skills/catalog/SKILL.md) | Searchable index of all the tools | "Do I have something for X?", before improvising |

---

## The 16 authored skills

The six **execution-cycle** skills (classify → grill → implement → deliver → reflect → consolidate) are grouped in the [Execution pipeline](#execution-pipeline) section; the others follow in order of use.

### aidakit:flow-design (command, not a skill)

**Purpose:** plans the project via the `/aidakit:flow-design` **command** — leads from understanding the business to the implementation plan across 4 sequential phases, each in interview mode (one question at a time), producing an approved document in `docs/design/`. (Previously called `aidakit:design`.)
**Invocation:** `/aidakit:flow-design` (starts or resumes from `docs/design/STATE.md`).
**Example (razor):** Phase 2 records `Appointment` as an aggregate with the R1 invariant ("a professional never has two overlapping appointments") in `2-domain-model.md`; Phase 3 generates `ADR-003-appointment-as-aggregate.md` in `docs/decisions/`.
**Gates:** a phase only closes with a written deliverable + a satisfied checklist + explicit approval; the order never reverses (an off-schedule topic goes to the `STATE.md` Parking Lot); an ADR is WORM; requires `aidakit:docs` init on the first run.
**Source of truth:** [commands/flow-design.md](../../commands/flow-design.md).

### aidakit:plan

**Purpose:** packages the self-contained prompt that a new session uses to invoke the `aidakit:planner` agent, which authors the change's plan-only artifacts: `proposal.md`, `design.md`, `tasks.md`, `evidence.md` (stub), and spec deltas when applicable — no product code. It also deepens the implementation plan from an **existing** spec (surface-by-surface coverage, file structure, estimate, risk matrix) — a role previously in a separate `design` skill, now absorbed here.
**Invocation:** `/aidakit:plan <change-id-or-description>` (empty input → the skill asks).
**Example (razor):** `/aidakit:plan feature-appointment-cancellation` → a prompt for a new session where the `aidakit:planner` authors the change "cancel an appointment with a policy: up to 2h beforehand, no penalty" in `docs/features/feature-appointment-cancellation/`, citing ADR-003 and ADR-004.
**Gates:** refuses a change-id that already exists; the planning never happens in this session; after the plan, `/aidakit:review` is mandatory before any code; author ≠ reviewer ≠ shipper.
**Source of truth:** [skills/plan/SKILL.md](../../skills/plan/SKILL.md).

### aidakit:spec

**Purpose:** reads and presents specs inline with the ecosystem alongside — related specs (by shared ADR, keyword, and architecture), linked ADRs, and validation commands ready to paste. It also documents the `proposal.md` template that the `aidakit:planner` uses.
**Invocation:** `/aidakit:spec <name>` · `/aidakit:spec --list` · `/aidakit:spec --list <keyword>`.
**Example (razor):** `/aidakit:spec appointment` → the canonical spec from `docs/specs/` inline, with ADR-003 pointed to as a related decision and the spec's validation commands; `/aidakit:spec --list cancellation` finds the in-flight change.
**Gates:** reading edits nothing (an ADR is WORM); validation commands must be executed, not just read; conformance is the reviewers' role, not this skill's.
**Source of truth:** [skills/spec/SKILL.md](../../skills/spec/SKILL.md).

### aidakit:readiness

**Purpose:** GATE 1 of the cycle — the kit's strongest review: 14 steps over the plan package (scope, proposal, design, metadata, specs, tasks, omissions, implementation simulation, top-5 likely failures) before any code.
**Invocation:** `/aidakit:readiness` (resolves the package by context; without a reliable resolution, it asks the change-id).
**Example (razor):** reviewing `docs/features/feature-appointment-cancellation/` — if the "up to 2h beforehand, no penalty" policy has no testable WHEN/THEN scenario (what happens at 1h59?), it becomes a `Critical — Mandatory before implementation` finding and the verdict drops to `NEEDS-REVISION`.
**Gates:** machine-parseable verdict `Status: APPROVED | NEEDS-REVISION | BLOCKED` + `Ready to implement: yes|no` ([GOVERNANCE.md](../../GOVERNANCE.md) §3); a mandatory artifact absent → `BLOCKED`; >3 serious doubts → not ready; report, don't fix; only persists `planning-review.md` on request.
**Source of truth:** [skills/readiness/SKILL.md](../../skills/readiness/SKILL.md).

### aidakit:test

**Purpose:** runs a surface's focused test suite (discovered in the repo itself — a workspace/package with its own test config) with a coverage report, in PASS / WARN / FAIL format with prioritized gaps.
**Invocation:** `/aidakit:test <surface>` · `/aidakit:test all` · `--coverage=80` and `--verbose` flags.
**Example (razor):** `/aidakit:test api` → runs the NestJS surface's test script with coverage; the critical path (services, controllers) requires ≥85%, overall ≥80%.
**Gates:** a failing test, type error, or lint error **blocks** the commit; coverage 80–85% on a critical path **warns**; the merge is never the agent's.
**Source of truth:** [skills/test/SKILL.md](../../skills/test/SKILL.md).

### aidakit:coverage

**Purpose:** deep cross-surface coverage-gap analysis: discovers surfaces and runners, interprets the reports (JSON/LCOV/coverage.py), classifies files by architectural-role tier (critical 85–90%+, moderate 80%+, light 70%+), and suggests the top-5 concrete tests, mirroring the repo's test patterns.
**Invocation:** `/aidakit:coverage` (variations cited by `aidakit:test`: `<surface> --detailed`, `[file]`, `--profile`).
**Example (razor):** after a WARN in `/aidakit:test api`, `/aidakit:coverage api --detailed` points out the error path of a cancellation outside the 2h window with no test and suggests the case in the style of the existing `*.spec.ts`.
**Gates:** a target recorded in a repo ADR beats the 80% default; changing the target = superseding an ADR → the human decides; never assumes configured coverage; reports readiness, never merges.
**Source of truth:** [skills/coverage/SKILL.md](../../skills/coverage/SKILL.md).

### aidakit:review

**Purpose:** the canonical pre-ship gate (GATE 2 in `--diff` mode): mechanical structural validation first; if PASS, invokes **in parallel, in a single message**, the `aidakit:adr-reviewer` (conformance with ADRs) and `aidakit:spec-reviewer` (requirement coverage + scope creep) agents and aggregates a PASS/FAIL verdict per section.
**Invocation:** `/aidakit:review <change-id>` (against the plan's artifacts) · `/aidakit:review --diff` (against the implemented diff).
**Example (razor):** `/aidakit:review --diff` before the commit on the `feature-appointment-cancellation` branch — the `aidakit:adr-reviewer` checks the diff against ADR-003 and ADR-004 (e.g., a cancellation notifying synchronously would violate ADR-004's outbox); the `aidakit:spec-reviewer` hunts for scope creep and gaps.
**Gates:** a failed structural check blocks the reviewers; report, don't fix; forbidden to approve with an open blocker; reviewers always in parallel, never sequential; the merge is the human's.
**Source of truth:** [skills/review/SKILL.md](../../skills/review/SKILL.md).

### aidakit:docs

**Purpose:** the executor of the [DOCS.md](../../DOCS.md) doctrine in 4 modes — `init` (creates the canonical structure without overwriting anything), `audit` (checks the seven inviolable rules), `index` (syncs indexes with the disk), and `archive` (archives a doc/change with a legacy banner and a stub).
**Invocation:** by a natural-language request ("organize the docs", "where do I save this?", "archive the change"); the skill identifies the mode.
**Example (razor):** after the change's PR is merged, the `archive` mode proposes moving `docs/features/feature-appointment-cancellation/` to `docs/archive/YYYY-MM-DD-feature-appointment-cancellation/` (the single end-to-end key, [DOCS.md](../../DOCS.md) §2 rule 7) and merging the deltas into `docs/specs/` — only after human approval.
**Gates:** moving/deleting a doc → confirm first, always; WORKING → DURABLE promotion is a human gate; an ADR is WORM; every write goes out via a branch + PR, bookkeeping included.
**Source of truth:** [skills/docs/SKILL.md](../../skills/docs/SKILL.md).

### aidakit:governance

**Purpose:** the guardian of [GOVERNANCE.md](../../GOVERNANCE.md) in 3 modes — `explain` (answers rule questions citing the exact section; decodes `pre-bash.js` hook blocks), `audit` (logged bypasses, reviewer verdicts, direct commits to main, unversioned scripts), and `onboarding` (prepares a repo, with an adoption ADR via `aidakit:docs`).
**Invocation:** by request ("can I run this command?", "why was it blocked?", "audit the conformance").
**Example (razor):** the hook blocked `git add -A` on the cancellation change's branch → the explain mode cites GOVERNANCE.md §4 and directs nominal staging; a bypass only with an explicit request from the human, via `AIDAKIT_BYPASS=1`, always logged.
**Gates:** never disables a rule or grants an exception; the audit reports, doesn't fix; `rm -rf` on root/home has no bypass.
**Source of truth:** [skills/governance/SKILL.md](../../skills/governance/SKILL.md).

### aidakit:catalog

**Purpose:** answers "do I have a tool for X?" by consulting the [INDEX.md](../../skills/catalog/INDEX.md) — the kit's skills, doctrine, agents, hooks, official plugins, and the on-demand archive from the mega-pack — and answers with the name, where it is, and how to invoke it.
**Invocation:** `/aidakit:catalog` (or a direct question in the conversation).
**Example (razor):** "do I have something to model the Appointment/Registration/Notification bounded contexts?" → `aidakit:ddd-strategic-design` (in the kit), support for phase 2 of the design.
**Gates:** the on-demand archive is never treated as installed (always points to the `SKILL.md` path); a third-party skill only enters the kit after `aidakit:skill-scanner`; if nothing covers it, it declares the gap instead of improvising.
**Source of truth:** [skills/catalog/SKILL.md](../../skills/catalog/SKILL.md).

---

## Execution pipeline

The six skills that carry a change from start to finish, in flow order: **identify-domain → brainstorm → (plan/readiness) → implement → (review) → ship → reflect → learn**. They are thin on purpose — each orchestrates already-existing discipline and emits the event/outcome the flow expects. Full fit in [PROCESS.md](../../PROCESS.md); the flows in [governance/flows/](../../governance/flows/).

### aidakit:identify-domain

**Purpose:** classifies the change into `{ domain, type, flags[], classification }` — it is what selects the brainstorm's ammunition and the review's convening matrix. Fail-closed algorithm: on ambiguity, the strictest track, never the weakest.
**Invocation:** step 1 of any new change (or a flow's classification step); triggers on "let's build X", "new change", "I need a feature/bugfix".
**Example (razor):** the cancellation change touches `api/` and `web/` → domain by the `domain-by-path` of `aidakit.config.yaml`, type `feature`, flags `contract` (new `AppointmentCancelled` event) + `ui`; a mixed one resolves to the strictest domain touched.
**Gates:** classifies, does not implement or decide design; a doubt escalates the rigor and marks `classification: strict-assumed` (GOVERNANCE.md §1).
**Source of truth:** [skills/identify-domain/SKILL.md](../../skills/identify-domain/SKILL.md).

### aidakit:brainstorm

**Purpose:** the deepest gate 1 — a default-on adversarial brainstorm that grills the owner with **ammunition derived from the project's law** (ADRs, Definition of Done, inviolable rules) to extract the doubt they didn't know they had, BEFORE spending spec/implementation tokens. It attacks 4 axes: scope, observable end effect, edges, and confrontation with the law.
**Invocation:** the first phase of any broad/irreversible change (default-on, without asking permission); opt-out by natural language ("I don't want a brainstorm").
**Example (razor):** against ADR-003, it asks whether "cancelling frees the professional's window for a new booking" is really the end effect — and what happens at 1h59 of the 2h policy; the answers become premises and acceptance criteria of the spec.
**Gates:** records an event trail (`brainstorm` or `brainstorm-skipped`) that satisfies the flow's gate; does not implement; once it converges → hands off the baton to [aidakit:plan](../../skills/plan/SKILL.md).
**Source of truth:** [skills/brainstorm/SKILL.md](../../skills/brainstorm/SKILL.md).

### aidakit:implement

**Purpose:** the cycle's implementation step — a thin envelope that orchestrates the TDD discipline (RED→GREEN→REFACTOR from `test-driven-development`), applies the kit's non-negotiable quality bars, and returns the `success`/`failure` outcome to the flow. A bug along the way → `systematic-debugging` (root cause before a fix), recorded as a `correction` event.
**Invocation:** when the change has a plan approved by [aidakit:readiness](../../skills/readiness/SKILL.md) and it's time to code (or the flow's `implement` step).
**Example (razor):** implements the NestJS cancellation service by first writing the failing test for the edge "cancelling at 1h59 charges a penalty", only then the code; runs the surface's [aidakit:test](../../skills/test/SKILL.md) before returning the outcome.
**Gates:** an approved plan is a pre-condition; TDD is not optional; a premise changed → STOP and report (GOVERNANCE.md §8); does not commit or open a PR (author ≠ shipper, §3).
**Source of truth:** [skills/implement/SKILL.md](../../skills/implement/SKILL.md).

### aidakit:ship

**Purpose:** the mechanical delivery step — uses the official `commit-commands` plugin (`/commit-push-pr`) with the guardrails of [GOVERNANCE.md](../../GOVERNANCE.md) §4 and **stops at the PR URL**. Emits `success`/`failure` to the flow. The merge is never the kit's.
**Invocation:** a change reviewed with PASS/consensus, the flow's `pr`/`ship` step; asks the human before shipping unreviewed work.
**Example (razor):** commit `feat(appointment): cancellation with a 2h policy`, push on the `feature-appointment-cancellation` branch, PR opened, URL delivered — and it stops; approving/merging is the human's.
**Gates:** never merges (§1); nominal staging (never `git add -A`), never `--no-verify`/`--amend` after a hook/push on the main branch (§4, the `pre-bash` hook also blocks it); refuses secrets in staging.
**Source of truth:** [skills/ship/SKILL.md](../../skills/ship/SKILL.md).

### aidakit:reflect

**Purpose:** lightweight post-phase reflection — the 3 questions (what went wrong / how to do it better / what to remember) that emit events served back in the next phase, without waiting for the end of the change. Feeds [aidakit:learn](../../skills/learn/SKILL.md) with the `correction`/`reflection` events.
**Invocation:** after a phase marked with `reflect: true` in the flow, or for a quick retro of a step.
**Example (razor):** after the cancellation's implementation phase, records `remember: "the ADR-004 outbox requires an asynchronous-publish test"` (project scope) in `.aidakit/tasks/<change-id>/events.ndjson`.
**Gates:** lightweight (3 questions, not a heavy retro); never a gate; a class, not raw content — the `remember` is 1 line with no secret/code.
**Source of truth:** [skills/reflect/SKILL.md](../../skills/reflect/SKILL.md).

### aidakit:learn

**Purpose:** the end-of-change learning loop — reads the diff, the correction events, and the ledgers, classifies each learning on 3 axes (kind × action × scope), and **PROPOSES** doc/rule updates as a literal diff (never writes blindly). Closes the error → learn → inform-the-next cycle and records scoped memory served back.
**Invocation:** end of change (the checkpoint/learn phase, after review), or "what did we learn", "consolidate learnings", "retro".
**Example (razor):** if the cancellation recurred as an already-mitigated bug (error-2), it proposes a `regression-gate` in `proposed-updates.md` and records 1 line in `.aidakit/memory/learnings.md` (project scope), read at the next `/aidakit:flow-build` startup.
**Gates:** PROPOSES, does not write (an inviolable principle — applying is a human decision); does not block the ship; a class, not raw content in memory; the narrowest scope on doubt.
**Source of truth:** [skills/learn/SKILL.md](../../skills/learn/SKILL.md).

---

## Slash commands

| Command | What it does | Source |
|---|---|---|
| `/aidakit:flow-design` | Invokes the `aidakit:flow-design` skill following its protocol (locate `STATE.md`, load only the current phase, interview, gates), passing through the user's arguments | [commands/flow-design.md](../../commands/flow-design.md) |
| `/aidakit:flow-build` | Builds a change from plan to PR through the flow engine (`start`/`resume`/`status`/`abort`/`list`); the 1st step of the flow picks the ready change (logic previously exposed as a separate command, now absorbed) | [commands/flow-build.md](../../commands/flow-build.md) |
| `/aidakit:plan` | Starts the plan-only planning of a change — authors proposal/design/tasks with no product code | [commands/plan.md](../../commands/plan.md) |
| `/aidakit:review` | Runs the pre-ship review gate — an adversarial bench of agents in parallel, aggregates verdicts, decides consensus | [commands/review.md](../../commands/review.md) |
| `/aidakit:docs` | Deploys, audits, indexes, or archives the project's standardized document architecture (DOCS.md) | [commands/docs.md](../../commands/docs.md) |
| `/aidakit:governance` | Explains, audits, or onboards the execution governance (GOVERNANCE.md + hook) | [commands/governance.md](../../commands/governance.md) |
| `/aidakit:catalog` | Reads the `aidakit:catalog` skill's [INDEX.md](../../skills/catalog/INDEX.md) and answers which tool to use; with no specific question, summarizes the index by category | [commands/catalog.md](../../commands/catalog.md) |

## Curated third-party skills (16)

Embedded in the kit with their **original name and English content**, invocable as `aidakit:<original-name>`, loaded on demand when the change touches their domain. Origin, evaluation, and caveats of each: [skills/catalog/INDEX.md](../../skills/catalog/INDEX.md) — we don't duplicate them here.

| Skill | Topic | Language |
|---|---|---|
| `aidakit:test-driven-development` | TDD: RED → GREEN → REFACTOR, mock anti-patterns | EN |
| `aidakit:systematic-debugging` | Root-cause debugging in phases, before proposing a fix | EN |
| `aidakit:ddd-strategic-design` | Strategic DDD: subdomains, bounded contexts, glossary | EN |
| `aidakit:postgresql` | Postgres schema design: gotchas, types, JSONB, partitioning | EN |
| `aidakit:postgres-best-practices` | Postgres rules with incorrect/correct SQL (indexes, RLS, N+1) | EN |
| `aidakit:neon-postgres` | Neon + Prisma: pooling, cold start, branching in CI | EN |
| `aidakit:saas-multi-tenant` | Shared-schema multi-tenancy: RLS, scoping, isolation | EN |
| `aidakit:react-best-practices` | React/Next performance with an impact rating | EN |
| `aidakit:vitest` | Vitest 3.x reference: mocking, fixtures, coverage | EN |
| `aidakit:security-threat-model` | Threat modeling: trust boundaries, likelihood×impact | EN |
| `aidakit:skill-scanner` | Auditing third-party skills (injection, malicious code) | EN |
| `aidakit:multi-agent-patterns` | Multi-agent systems: supervisor, swarm, failure modes | EN |
| `aidakit:tool-design` | Designing tools that agents consume | EN |
| `aidakit:ai-native-cli` | CLIs safe for operation by AI agents | EN |
| `aidakit:advanced-evaluation` | LLM-as-judge: biases and mitigation protocols | EN |
| `aidakit:context-compression` | Context compression in long agent sessions | EN |

<!-- aidakit v0.2 — compact reference of skills/commands, written on 2026-07-17 -->
<!-- aidakit v0.3 — +6 execution-pipeline skills (identify-domain, brainstorm, implement, ship, reflect, learn) 2026-07-17 -->
<!-- aidakit v0.3 — renames: roteiro→design (plans the project), next and old-design absorbed (into build/plan), change→change vocabulary, slash commands updated 2026-07-17 — translated to EN -->
