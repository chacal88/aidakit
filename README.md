# aidakit

Pre-aida development kit: while aida isn't ready, this plugin brings the full process to any project — guided architecture design, a spec-driven execution pipeline, document doctrine and governance with an active hook, and a searchable tool catalog.

> 📖 **New here? Read the [field guide / overview](docs/OVERVIEW.md)** — the whole kit on one page (a visual version is at [`docs/overview.html`](docs/overview.html)).

> **Names updated in v0.3:** `roteiro` → `design`, `flow` → `build`, `next` absorbed into `build`.

> **Precedence:** this README summarizes and points. If it diverges from the doctrine ([DOCS.md](DOCS.md), [GOVERNANCE.md](GOVERNANCE.md), [PROCESS.md](PROCESS.md)) or from a plugin `SKILL.md`, the other wins and this file gets corrected.

## Installation (in any project)

Clone this repo, then point the plugin marketplace at your local checkout:

```
git clone git@github.com:chacal88/aidakit.git
/plugin marketplace add /path/to/aidakit
/plugin install aidakit@aidakit
```

Replace `/path/to/aidakit` with wherever you cloned it.

## The 4 layers

### 1. Architecture design — `/aidakit:flow-design`

A sequential 4-phase process with gates, inspired by "the domain drives the decisions; technology materializes them": **1 Business** (goals, processes, rules, ubiquitous language) → **2 DDD Modeling** (entities, value objects, aggregates, bounded contexts) → **3 Architecture** (APIs, events, integrations, data; decisions become ADRs in `docs/decisions/`) → **4 Implementation** (structure, stack, vertical changes — hands off the baton to the pipeline). Each phase is an interview (one question at a time), produces a document in `docs/design/`, and only advances with explicit approval. State lives in `docs/design/STATE.md` — you can close the session and resume weeks later.

### 2. Execution pipeline — `aidakit:*` skills

Each change runs through the canonical cycle: `aidakit:flow-fast`/`aidakit:flow-full` (the 1st step picks the next ready change) → `aidakit:plan` (plan-only: proposal/design/tasks/evidence) → `aidakit:readiness` (gate 1) → implementation with TDD → `aidakit:test`/`aidakit:coverage` → `aidakit:review --diff` (gate 2) → commit/PR. **The kit stops at the PR URL; the human is the one who merges.** The skills delegate to 5 agents with separate roles (author ≠ reviewer ≠ shipper): `aidakit:orchestrator`, `aidakit:planner`, `aidakit:adr-reviewer`, `aidakit:spec-reviewer`, `aidakit:research`. Repos with OpenSpec use `openspec/changes/` and `openspec/specs/`; without OpenSpec, `docs/features/<change-id>/` and `docs/specs/`. Full cycle reference in [PROCESS.md](PROCESS.md).

### 3. Doctrine — [DOCS.md](DOCS.md) + [GOVERNANCE.md](GOVERNANCE.md)

- **[DOCS.md](DOCS.md)** — standardized document architecture: canonical structure of `docs/`, seven inviolable rules (ADR is WORM, every directory has an index, dated archive...), a placement decision tree, and the WORKING → DURABLE cycle. Every kit skill that creates a document obeys this file.
- **[GOVERNANCE.md](GOVERNANCE.md)** — how agents work: permissive by design with exactly 3 escalations to the human (PR merge, superseding an ADR, going out of scope), everything via PR, separate roles, git and ship guardrails.
- **ACTIVE `pre-bash` hook** — installed with the plugin, runs before every Bash command and mechanically blocks what GOVERNANCE.md §4 prohibits: `git push --force`, `--no-verify`, `git add -A/.`, `reset --hard`, `clean -f`, `branch -D`, `gh pr merge`, among others. Philosophy: when in doubt, allow (fail-open).
- **Conscious bypass** — prefix the command with `AIDAKIT_BYPASS=1` (only with an explicit request from the human); the bypass is **logged** in `.claude/.cache/aidakit-bypass.log` with date and command, for retroactive review. Exception with no bypass: `rm -rf` at root/home never passes.

### 4. Catalog and archive — `/aidakit:catalog`

A grouped index of everything you have: this plugin's skills, agents, hooks, doctrine, installed official plugins, and the verified archive from the community mega-pack (loaded on demand, without weighing down the context). Ask "do I have something for X?" and it points you to the tool. Full catalog in [skills/catalog/INDEX.md](skills/catalog/INDEX.md).

## Authored skills

| Skill | For what |
|---|---|
| `aidakit:flow-design` | Start or resume the architecture design (4 phases with gates) |
| `aidakit:flow-fast` / `aidakit:flow-full` | Build a change from plan to PR (minimal ceremony / maximum rigor); the 1st step picks the next ready change |
| `aidakit:flow-sync` | (Re)generate project-local `flow-<name>` commands from `.aidakit/flows/*.yaml` |
| `aidakit:plan` | Author a plan-only change via `aidakit:planner` (no product code); includes the implementation plan (architecture, risks, estimate) |
| `aidakit:spec` | Read specs with discovery of related ones, ADRs, and validation commands |
| `aidakit:readiness` | Readiness review of the planning package before coding |
| `aidakit:review` | Canonical gate: reviewers in parallel + structural validation, PASS/FAIL verdict |
| `aidakit:test` | Surface-focused tests with a coverage report |
| `aidakit:coverage` | Cross-surface coverage gap analysis with concrete suggestions |
| `aidakit:docs` | Deploy, audit, and maintain the document architecture from DOCS.md |
| `aidakit:governance` | Enforce and audit the execution doctrine from GOVERNANCE.md |
| `aidakit:catalog` | Searchable index of every tool ("do I have something for X?") |

## Curated third-party skills

The kit bundles 16 verified technical skills, loaded on demand when the change touches their domain. They keep their **original name and English content** (no renaming or translating; like every plugin skill, they're invocable by the qualified name `aidakit:<original-name>`): `advanced-evaluation`, `ai-native-cli`, `context-compression`, `ddd-strategic-design`, `multi-agent-patterns`, `neon-postgres`, `postgres-best-practices`, `postgresql`, `react-best-practices`, `saas-multi-tenant`, `security-threat-model`, `skill-scanner`, `systematic-debugging`, `test-driven-development`, `tool-design`, `vitest`. Origin and use of each in [skills/catalog/INDEX.md](skills/catalog/INDEX.md).

## Documentation

Master index in [docs/INDEX.md](docs/INDEX.md), with a reading order for newcomers. A summary:

- [Getting started](docs/guides/getting-started.md) — install, first step, and confirm the hook is active, in 5 minutes.
- [New project flow](docs/guides/new-project-flow.md) — from zero to the first change through the 4-phase design, narrated with the razor example project.
- [Per-change flow](docs/guides/change-flow.md) — the canonical cycle end-to-end: plan → gates → TDD → PR → human merge → archive.
- [Existing repository flow](docs/guides/existing-repo-flow.md) — adopt the kit in a legacy repo without steamrolling: init, audit, and adoption in steps.
- [Governance in practice](docs/guides/governance-in-practice.md) — the 3 escalations live, the hook, the logged bypass, and FAQ.
- [Skills reference](docs/reference/skills.md) — the 12 authored skills one by one: purpose, invocation, example, and gates.
- [Agents reference](docs/reference/agents.md) — the 5 agents: who calls whom, role, and limits.
- [razor examples](docs/examples/README.md) — a filled-in ADR, STATE, and proposal (fictional), derived from the real templates.

## Relationship with aida

This kit is the manual prototype of what aida automates: the design is a chained workflow with human gates; the deliverables are the WORKING → DURABLE documents; the skills and agents are the versioned assets; the hook is the leash in miniature — the leash being the deterministic enforcement the engine imposes, not the model's goodwill. Once aida exists, this process becomes the platform's default workflow.

<!-- aidakit v0.3 — rename roteiro→design, flow→build, next absorbed into build on 2026-07-17 — translated to EN -->
