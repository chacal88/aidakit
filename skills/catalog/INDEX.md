# INDEX — Tool catalog

> Curated on 2026-07-17 over 1,498 inventoried assets (skills, agents, commands, hooks, docs) across the whole machine.
> **How to use each layer:**
> - **In the kit** → a skill installed with this plugin; invoke by the qualified name `aidakit:<name>` (auto-fires from the description).
> - **Kit — doctrine** → a file at the plugin root (`DOCS.md`, `GOVERNANCE.md`, `PROCESS.md`); read it when a skill or agent cites it.
> - **Official plugin / Global** → already available in any project; invoke by name.
> - **On-demand corpus** → NOT loaded automatically. Read the `SKILL.md` at the indicated path and follow its instructions. Check that the path exists before using it.

---

## 1. Process and orchestration (the spine of the kit)

> The two **flow orchestrators** below (`aidakit:flow-design`, `aidakit:flow-build`) are the `flow` group — grouped under the `flow-` prefix in `/aidakit:` autocomplete, stateful and resumable (they drive the engine in `governance/`). Every other tool in this catalog is a **single-shot utility** (invokes a skill or reads a file, and returns) — the absence of the `flow-` prefix is itself the utility signal.

| Tool | Where | What it does |
|---|---|---|
| `DOCS.md` (plugin root) | kit — doctrine | The law of documents: canonical structure of `docs/`, 7 inviolable rules (indexes, WORM ADR, dated archive), placement tree, WORKING → DURABLE cycle |
| `GOVERNANCE.md` (plugin root) | kit — doctrine | The law of execution: 3 escalations to the human, everything via PR, separated roles (author ≠ reviewer ≠ shipper), git/ship guardrails, anti-drift |
| `PROCESS.md` (plugin root) | kit — doctrine | Reference for the per-change execution cycle (aidakit pipeline) |
| [`governance/README.md`](../../governance/README.md) | kit — doctrine | Source of truth for the **executable governance layer** (the flow engine + ledgers that make `PROCESS.md`/`GOVERNANCE.md` executable) — see [section 2](#2-executable-governance-layer-governance) |
| `aidakit:flow-design` (+ `/aidakit:flow-design`) | kit — **flow orchestrator** | The conductor of project planning: 4 phases with gates (Business → DDD Modeling → Architecture → Implementation), state in `docs/design/STATE.md` |
| `aidakit:flow-build` (+ `/aidakit:flow-build`) | kit — **flow orchestrator** | Human interface to build **one change** from plan to PR on top of the flow engine (`governance/`); the flow's 1st step picks the next ready change (via `aidakit:orchestrator`) — see [section 2](#2-executable-governance-layer-governance) |
| `aidakit:catalog` (+ `/aidakit:catalog`) | kit | This index — "do I have a tool for X?" |
| `aidakit:plan` (+ `/aidakit:plan`) | kit | Plan-only change authoring (proposal/design/tasks) via the `aidakit:planner` agent: breakdown, estimation, risk matrix, with a review gate before coding |
| `aidakit:spec` | kit | Reads specs + a proposal template with a quality checklist (testable criteria, committed effort) |
| `aidakit:readiness` | kit | The strongest gate: 13 planning-readiness steps, failure simulation, APPROVED/BLOCKED verdict |
| `aidakit:review` (+ `/aidakit:review`) | kit | Pre-ship gate: structural validation + an adversarial bench of agents dispatched in parallel (role×flag matrix), verdicts aggregated by consensus. Report, don't fix |
| `aidakit:docs` (+ `/aidakit:docs`) | kit | Deploys, audits, and maintains the document architecture of `DOCS.md` in the project (structure, indexes, archive) |
| `aidakit:governance` (+ `/aidakit:governance`) | kit | Applies and verifies the execution doctrine of `GOVERNANCE.md` in the project (authority, PR, roles, guardrails) |
| Agents `aidakit:orchestrator`, `aidakit:planner`, `aidakit:adr-reviewer`, `aidakit:spec-reviewer`, `aidakit:research` | kit | The specialists that the skills above invoke — see the [agents table](#14-isolated-context-agents-agents) for all 11 |
| `hooks/pre-bash.js` | kit — active hook | Mechanical enforcement of the git/ship guardrails (GOVERNANCE.md §4): blocks force-push, `--no-verify`, blind staging, PR merge; conscious bypass via `AIDAKIT_BYPASS=1`, logged |
| `feature-dev` | official plugin | Guided feature development with codebase exploration — a lightweight alternative when you do not want the full pipeline |
| `ralph-loop` | official plugin | Continuous loop of autonomous execution |

**Process corpus/reference (on demand):**
- **recruit's custom openspec ecosystem** — the `rc:change` contract (3 human gates + bounded loops), lifecycle agents with `allowed_writes` (author/reviewer/executor/auditor), a YAML flow engine: `~/Documents/recruit/.claude/` (agents/, commands/rc/, skills/). A direct architectural reference for aida; requires recruit's `.governance/` to execute.
- **recruit's TS hooks** (the leash with teeth): `pre-bash.ts` (blocks destructive git), `pre-edit.ts` (only edits a path covered by an APPROVED change), `prompt-submit.ts` (injects governance context) + `shared/` — `~/Documents/recruit/.claude/hooks/`. Opt-in: copy into the project you want enforcement in; the prompt-submit triggers are in English.
- **margi package** (reference format): `~/.claude/skills/margi-plan/` (a plan template with effort/risks) and `margi-code/` (a RED-GREEN-REFACTOR example + quality bars). Superseded by the aidakit pipeline; keep as a format reference.
- `openspec-explore` — an explore-without-implementing posture + an "insight → where to capture" table: `~/Documents/recruit/.claude/skills/openspec-explore/SKILL.md`

## 2. Executable governance layer (`governance/`)

> The process doctrine (`PROCESS.md`) and the execution doctrine (`GOVERNANCE.md`) described in prose become **executable code** here: a declarative flow engine + local ledgers. Source of truth: [governance/README.md](../../governance/README.md) and the code itself; a narrative usage guide in [docs/guides/flows.md](../../docs/guides/flows.md). This catalog only points.

| Tool | Where | What it does |
|---|---|---|
| Flow engine (`governance/engine/` + [`cli.js`](../../governance/cli.js)); `/aidakit:flow-build` command | kit — engine | Runs a YAML flow step by step (7 step types), with gates, resumable state, and **inversion of control** — the engine is the deterministic spine, Claude dispatches the subagents. CLI: `node governance/cli.js <start\|resume\|status\|abort\|list>`; the human interface is `/aidakit:flow-build <start\|resume\|status\|abort\|list>` |
| Default flow [`fast.yaml`](../../governance/flows/fast.yaml) | kit — flow | A fast Margi-style flow: from change to PR with minimal ceremony (pick change → readiness → TDD → review → PR → human merge gate). Small, reversible work |
| Default flow [`full.yaml`](../../governance/flows/full.yaml) | kit — flow | A full codeflow/psim-style flow: adversarial brainstorm → spec with a critic → pre-apply gate → implementation → review bench (rounds with a ceiling) → hardening → learn → PR → human gate. Broad, architectural, or irreversible work |
| Local ledgers ([`governance/ledgers/ledger.js`](../../governance/ledgers/ledger.js)) | kit — engine | Append-only NDJSON per change in `.aidakit/tasks/<change-id>/`: `token.ndjson` (cost attributed to the phase×role×round structure) and `error.ndjson` (error/rework with dedup). Feeds `aidakit:learn` to propose process improvements |

A project can have its own flows in `.aidakit/flows/`. The execution state lives in `.aidakit/flows/{state,logs}/` (ephemeral). The doctrine the engine makes executable: [GOVERNANCE.md](../../GOVERNANCE.md) and [PROCESS.md](../../PROCESS.md).

## 3. Phase 1 — Business

| Tool | Where |
|---|---|
| `aidakit:identify-domain` (classifies domain × type × flags — the 1st step of a change; selects the brainstorm's ammunition and the review matrix) | kit |
| `aidakit:brainstorm` (adversarial brainstorm, default-on — grills the owner BEFORE spending spec/implementation tokens; it is a gate) | kit |
| `aidakit:flow-design` phase 1 (interview on goals/processes/rules/experts/ubiquitous language) | kit |
| `product-management:brainstorm` / `product-management:product-brainstorming` | official plugin |
| `product-management:write-spec` (formal PRD) | official plugin |
| `deep-research` (market/regulatory research with sources) | built-in |

## 4. Phase 2 — DDD Modeling

| Tool | Where | What it does |
|---|---|---|
| `aidakit:flow-design` phase 2 | kit | Interview: entities, VOs, aggregates, bounded contexts + light event storming |
| `aidakit:ddd-strategic-design` | kit | A disciplined strategic checklist: subdomains, a context catalog, a glossary with anti-terms, a table template |

**On-demand corpus:** the complete DDD family (a router + 9 companions: tactical, context mapping, etc.): `~/.claude/skills/skills/domain-driven-design/SKILL.md` — load the router and follow its map when you need the detailed tactical part.

## 5. Phase 3 — Architecture

| Tool | Where | What it does |
|---|---|---|
| `aidakit:flow-design` phase 3 (+ architecture and ADR templates) | kit | APIs, events, integrations, data; one ADR per decision in `docs/decisions/` |
| `aidakit:saas-multi-tenant` | kit | Shared-schema multi-tenancy in Postgres: RLS, ORM scoping, cross-tenant leakage gotchas (caution: the Prisma example uses the deprecated `$use` → use `$extends`) |
| `aidakit:security-threat-model` | kit | Threat modeling anchored in the repo: trust boundaries, a TM-nnn table, likelihood×impact |
| `engineering:system-design` | official plugin | Exploration of design alternatives |
| `nestjs-best-practices` | global | 40 NestJS rules with incorrect/correct examples (the DB uses TypeORM → adapt to Prisma) |

**On-demand corpus:**
- `workflow-orchestration-patterns` — Temporal doctrine (workflow vs activity, saga, idempotency); load when designing the aida engine: `~/.claude/skills/skills/workflow-orchestration-patterns/SKILL.md`
- `architecture-decision-records` — 5 ADR templates (MADR, Y-statement, supersede): `~/.claude/skills/skills/architecture-decision-records/SKILL.md`
- `api-patterns` — REST/GraphQL/tRPC decision trees, pagination, versioning: `~/.claude/skills/skills/api-patterns/SKILL.md`
- `openapi-spec-generation` — a design-first OpenAPI skeleton + Spectral lint: `~/.claude/skills/skills/openapi-spec-generation/SKILL.md`
- `c4-architecture-c4-architecture` / `c4-container` — C4 docs format (process ok, installation broken — use as a template): `~/.claude/skills/skills/c4-architecture-c4-architecture/SKILL.md`

## 6. Phase 4 — Implementation

| Tool | Where | What it does |
|---|---|---|
| `aidakit:flow-design` phase 4 → the change build cycle (see `PROCESS.md`) | kit | Vertical changes → spec → plan → TDD → gates |
| `aidakit:implement` | kit | The implementation step of the flow: orchestrates the kit's TDD discipline (and `systematic-debugging` when a bug shows up) and returns the outcome (`success`/`failure`) to the flow. Thin by design — the intelligence lives in the skills it invokes |
| `aidakit:ship` | kit | The mechanical delivery step up to the **PR URL**: staging by name + conventional commit + push + PR via `commit-commands`, with the ship guardrails of `GOVERNANCE.md` §4. **Stops at the PR** — the merge is always the human's |
| `aidakit:merge` | kit | **OPT-IN** autonomous PR merge (ADR-008), dispatched only by the flow's `auto_merge` step past the `merge_route` gate. Checks host mergeability, merges via `gh pr merge` with no privileged bypass; any doubt/failure falls back to the `merge` human gate |
| `aidakit:test-driven-development` | kit | The behavioral leash of TDD: a mandatory "watch it fail", a rationalizations table, mock anti-patterns |
| `aidakit:react-best-practices` | kit | 45 React/Next performance rules (Vercel), with an impact rating |
| `nestjs-best-practices` | global | NestJS doctrine (see phase 3) |
| `feature-dev` | official plugin | Guided implementation |
| `code-simplifier` | official plugin | Post-implementation simplification |

**On-demand corpus:**
- `typescript-expert` — TS compiler performance diagnostics (`--extendedDiagnostics`, `--generateTrace`): `~/.claude/skills/skills/typescript-expert/SKILL.md`
- `react-component-performance` — disciplined re-render diagnostics (measure → isolate → re-measure): `~/.claude/skills/skills/react-component-performance/SKILL.md`
- `tanstack-query-expert` — React Query: optimistic update with rollback, SSR hydration (half of the Next.js part does not apply to the Vite Console): `~/.claude/skills/skills/tanstack-query-expert/SKILL.md`

## 7. Quality — tests, review, debug

| Tool | Where | What it does |
|---|---|---|
| `aidakit:test` | kit | A fast gate: tests per surface + coverage tiers (critical ≥85%) + a block-vs-warn policy |
| `aidakit:coverage` | kit | Deep coverage-gap analysis with top-5 prioritization and suggested tests |
| `aidakit:review` | kit | Conformance with specs/ADRs (complementary to code-review, which hunts bugs) |
| `aidakit:vitest` | kit | Official Vitest 3.x reference with 16 on-demand files (mocking, fixtures, coverage) |
| `aidakit:systematic-debugging` | kit | Debug in 4 phases: no fix before the root cause; 3 failed fixes = question the architecture |
| `code-review` (+ `/code-review ultra`) | official plugin | Bug hunting on the diff/PR |
| `pr-review-toolkit` | official plugin | Specialized PR reviewers (tests, comments, silent failures, types) |
| `verify` | built-in | End-to-end verification that the change actually works |
| `engineering:testing-strategy` / `engineering:debug` | official plugin | Testing strategy / guided debug |

## 8. Learning — closing the cycle error → learns → informs the next

| Tool | Where | What it does |
|---|---|---|
| `aidakit:reflect` | kit | A light post-phase reflection: the 3 questions (what went wrong / how to do better / what to remember) that emit learnings served back into the next phase. Feeds `aidakit:learn` with correction events |
| `aidakit:learn` | kit | A learning loop at the checkpoint: reads the diff, the correction events, and the ledgers, classifies each learning, and **proposes** doc/rule updates (never writes blindly). Records scoped memory served back into the next work |

These two close the cycle that the [governance ledgers](#2-executable-governance-layer-governance) open: the `error.ndjson`/`token.ndjson` accumulated per change is the raw material that `aidakit:learn` turns into a process-improvement proposal.

## 9. Security

| Tool | Where | What it does |
|---|---|---|
| `jwt-security` | global | Classic JWT attacks with the exact defense code (algorithm confusion, rotation, JWKS) |
| `aidakit:security-threat-model` | kit | See phase 3 |
| `aidakit:skill-scanner` | kit | Third-party skill auditing (injection, malicious code) — use before promoting anything from the mega-package |
| `security-review` | built-in | Security review of the diff |
| `two-factor-authentication-best-practices` | global | Full 2FA, but 100% Better Auth — only if the project adopts Better Auth |

**On-demand corpus:** `auth-implementation-patterns` — a TS playbook for JWT+refresh rotation+RBAC (Express flavor): `~/.claude/skills/skills/auth-implementation-patterns/SKILL.md`

## 10. Data and database

| Tool | Where | What it does |
|---|---|---|
| `aidakit:postgresql` | kit | A dense schema-design checklist: gotchas (FK without an index, UNIQUE+NULLs), forbidden types, JSONB, partitioning |
| `aidakit:postgres-best-practices` | kit | 33 Supabase rules with incorrect/correct SQL + EXPLAIN (indexes, pooling, RLS, locking, N+1) |
| `aidakit:neon-postgres` | kit | Neon+Prisma: pooled vs DIRECT_URL, cold start retry, branching in CI (prune the Drizzle/Vercel sections) |
| `mongodb` | global | Complete Mongo+Mongoose reference for the legacy projects (supersedes `mongoose-mongodb` — ignore that one) |
| `data:*` (write-query, explore-data, validate-data…) | official plugin | Data analysis |

**On-demand corpus:**
- `prisma-expert` — Prisma playbooks (dev vs deploy migration, N+1, pooling): `~/.claude/skills/skills/prisma-expert/SKILL.md`
- `hybrid-search-implementation` — RRF vector+keyword in a single Postgres query (pgvector+tsvector) for aida's retrieval: `~/.claude/skills/skills/hybrid-search-implementation/SKILL.md`
- `vector-index-tuning` — a mental model of HNSW/quantization (the code is hnswlib/Qdrant, not pgvector — only the concept transfers): `~/.claude/skills/skills/vector-index-tuning/SKILL.md`
- `database-migrations-sql-migrations` — a zero-downtime checklist (expand-contract; there is a bug in the backfill example): `~/.claude/skills/skills/database-migrations-sql-migrations/SKILL.md`
- `using-neon` — fetch of the official Neon docs via llms.txt (incomplete installation, only the fetch mechanism is worth it): `~/.claude/skills/skills/using-neon/SKILL.md`

## 11. AI and agents (building aida)

| Tool | Where | What it does |
|---|---|---|
| `aidakit:multi-agent-patterns` | kit | Supervisor/swarm/hierarchical with trade-offs, context isolation, telephone game, 4 failure modes |
| `aidakit:tool-design` | kit | Tool design for agents: consolidation, description engineering, actionable errors |
| `aidakit:context-compression` | kit | Context compression: tokens-per-task, anchored summarization, probe-based evaluation |
| `aidakit:advanced-evaluation` | kit | LLM-as-judge: biases + mitigation protocols (position swap, justification before the score) |
| `aidakit:ai-native-cli` | kit | 98 rules for agent-operated CLIs — apply to the `aida` CLI |
| `agent-sdk-dev` | official plugin | Creating/verifying apps with the Claude Agent SDK |
| `claude-api` | built-in | Anthropic API reference (models, pricing, caching) |
| `mcp-builder` | built-in | Building MCP servers |

**On-demand corpus:**
- `ai-agents-architect` — a "Sharp Edges" checklist (8 agent failure modes): `~/.claude/skills/skills/ai-agents-architect/SKILL.md`
- `context-optimization` / `context-degradation` — context engineering (good framing; numbers with no source — do not trust the data): `~/.claude/skills/skills/context-optimization/SKILL.md`
- `memory-systems` — agent memory layers + the DMR benchmark (informed N3 of the graph): `~/.claude/skills/skills/memory-systems/SKILL.md`
- `evaluation` / `agent-evaluation` / `llm-evaluation` — agent-evaluation dimensions (conceptual): `~/.claude/skills/skills/evaluation/SKILL.md`
- `protect-mcp-governance` — a gate on MCP tool calls with Cedar + signed receipts (inspiration for the leash): `~/.claude/skills/skills/protect-mcp-governance/SKILL.md`
- **recruit's flow engine** — YAML flows + gates + pause/resume (a case study for aida's model): `~/Documents/recruit/.claude/agents/flow/orchestrator.md`

## 12. DevOps and ship

| Tool | Where | What it does |
|---|---|---|
| `commit-commands` (`/commit`, `/commit-push-pr`) | official plugin | Conventional commit, push, PR |
| `github` | official plugin | GitHub operations |
| `engineering:deploy-checklist` / `engineering:incident-response` | official plugin | Deploy and incidents |
| `playwright` | official plugin | Browser automation for E2E |

**On-demand corpus:** ship guardrails from `mx-commit-and-pr` (refuses secrets, never amends after the hook, stops at the PR URL): `~/Documents/representante-digital/.claude/agents/mx-commit-and-pr.md`

## 13. Meta — discovery and maintenance

| Tool | Where | What it does |
|---|---|---|
| `aidakit:catalog` | kit | This index |
| `aidakit:skill-scanner` | kit | Audit a third-party skill before adopting it |
| `skill-creator` | built-in | Create a new skill when nothing covers the need |
| `claude-code-setup` | official plugin | Recommend automations for a repo |
| `claude-md-management` | official plugin | Maintain CLAUDE.md |
| `find-skills` | corpus (`~/.agents/skills/find-skills/SKILL.md`) | Discover skills in the skills.sh ecosystem — not loaded globally; read the SKILL.md to use it (caution: unaudited code — run it through `aidakit:skill-scanner`) |

## 14. Isolated-context agents (`agents/`)

> Subagents that receive a task, work in their own context (without bloating the main one), and come back with a structured verdict/result — the command/skill/agent distinction is in [PROCESS.md §1](../../PROCESS.md#command-skill-agent--the-distinction-dont-blur-it). The thin skills of the cycle (`brainstorm`, `plan`, `implement`, `review`) carry the HOW and **dispatch** the agent that does the work. They only point to the source files; the role's yardstick is the frontmatter of each `agents/<name>.md`.

| Agent | Role |
|---|---|
| [`aidakit:orchestrator`](../../agents/orchestrator.md) | Picks the next ready change and generates the self-contained execution prompt (dispatched in the 1st step of the `aidakit:flow-build` flows) |
| [`aidakit:planner`](../../agents/planner.md) | Authors the plan-only change (proposal/design/tasks/evidence), with no product code (dispatched by `aidakit:plan`) |
| [`aidakit:research`](../../agents/research.md) | Research/exploration in an isolated context, returning synthesized findings |
| [`aidakit:brainstorm`](../../agents/brainstorm.md) | Conducts the adversarial brainstorm (grills the owner on the 4 axes of attack) BEFORE the spec and returns assumptions + acceptance criteria (dispatched by `aidakit:brainstorm`) |
| [`aidakit:implementer`](../../agents/implementer.md) | Implements an approved change task by task with TDD and the kit's quality bars; returns diff + outcome, without committing or opening a PR (dispatched by `aidakit:implement`) |
| [`aidakit:adr-reviewer`](../../agents/adr-reviewer.md) | Review bench: enforces the diff's conformance to the locked ADRs |
| [`aidakit:spec-reviewer`](../../agents/spec-reviewer.md) | Review bench: enforces the spec's coverage by the diff |
| [`aidakit:reviewer-quality`](../../agents/reviewer-quality.md) | Review bench: reviews the code quality of the diff in 4 phases; a verdict with severity-tagged findings (blocking/important/nit/praise) |
| [`aidakit:reviewer-security`](../../agents/reviewer-security.md) | Review bench: audits the diff across the 6 vulnerability categories, with a false-positive filter; verdict `approved`/`vetoed` |
| [`aidakit:reviewer-architecture`](../../agents/reviewer-architecture.md) | Review bench: reviews the DESIGN of the diff (owners, layer boundaries, contracts, deletion test); verdict `approved`/`rejected` |
| [`aidakit:tester`](../../agents/tester.md) | Review bench: analyzes the diff's test coverage through the behavioral lens, prioritizes gaps, and flags fragile tests |

**The adversarial review bench** — the three `aidakit:reviewer-*` (quality, security, architecture) plus `aidakit:tester`, along with the base `aidakit:adr-reviewer` and `aidakit:spec-reviewer` — is **dispatched by the [`aidakit:review`](#1-process-and-orchestration-the-spine-of-the-kit) skill in parallel** (convened by a role×flag matrix from the classification): each agent judges in isolation and emits one verdict per round, and the skill only aggregates the consensus. Report, don't fix.

---

## Note on the mega-package (`~/.claude/skills/skills/`)

1,387 community skills at a folder level that Claude Code **does not load** — and that is good: it would be context noise. The curation vetted 84 candidates in depth: 17 became part of the kit, 23 are cataloged above as on-demand corpus, 44 were discarded (generic text, prompt-marketing, broken references, or off-stack). The rest (~1,300) did not make it past the name+description triage. Before promoting any other: run `aidakit:skill-scanner`.

<!-- aidakit v0.2 — catalog migrated from mx kit-index to the aidakit namespace -->
<!-- aidakit v0.3 — executable governance layer + brainstorm/identify-domain/implement/ship/learn/reflect skills cataloged 2026-07-17 -->
<!-- aidakit v0.3 — agents reorg 5→11 (§14: brainstorm/implementer/tester/reviewer-quality/reviewer-security/reviewer-architecture) + flow/plan/review/next/docs/governance commands marked 2026-07-17 -->
<!-- aidakit v0.3 — rename: roteiro→design (plan the project) and flow→build (build one change); next and old-design absorbed (next → 1st step of build; old-design → plan); change→change vocabulary; 7 current commands (build/catalogo/design/docs/governance/plan/review) 2026-07-17 -->
<!-- aidakit v0.3 — translated to EN -->
<!-- aidakit v0.8 — aidakit:merge cataloged (opt-in autonomous PR merge, ADR-008), configurable-pr-automation, 2026-07-24 -->
