# aidakit docs/ — master index

> **Scope:** this directory documents the USE of the aidakit plugin — narrative guides, skill/agent references, and example artifacts. **Anti-scope:** doctrine does not live here (the law lives at the plugin root: [DOCS.md](../DOCS.md), [GOVERNANCE.md](../GOVERNANCE.md), [PROCESS.md](../PROCESS.md)) nor does skill behavior (the source of truth of each is its own `SKILL.md`). This `docs/` is also **not** an example of the canonical target-project structure from [DOCS.md §1](../DOCS.md) — it is the kit's documentation, not a project run by the kit.
>
> **Precedence:** this index sequences and points, never duplicates ([DOCS.md §2](../DOCS.md), rule 1). If it diverges from any linked doc, skill, or doctrine, the other wins and this file is corrected.

## Reading order for newcomers

0. **[Overview / field guide](OVERVIEW.md)** — the whole kit on one page: the 4 layers, the canonical cycle, skills, agents, the engine, and how to use it. A visual version renders at [`overview.html`](overview.html). Start here for the map, then read the guides for depth.
0.5. **[Anatomy](anatomy.html)** — the illustrated paper on how the machine works: the deterministic/intelligent cut, the YAML flow engine and its inversion of control, resumable state, the validator leashes, the learning loop, and the stated limits. Bilingual (EN/PT switch at the top). Read it after the overview when you want the mechanism, not the map.
1. **[Getting started](guides/getting-started.md)** — 5-minute guide: install the plugin, what comes into effect (skills, commands, active `pre-bash` hook), and how to confirm it worked.
2. **[New project flow](guides/new-project-flow.md)** — from zero to the first change: the 4-phase architecture design with gates, narrated with the razor example project.
3. **[Per-change flow](guides/change-flow.md)** — the canonical execution cycle end-to-end: plan → readiness (GATE 1) → TDD → test/coverage → review `--diff` (GATE 2) → PR → human merge → archive.
4. **[Existing-repository flow](guides/existing-repo-flow.md)** — adopt the kit in a repo with legacy code and docs: `docs init`/`audit`, governance onboarding, and the gradual-adoption ladder.
5. **[Governance in practice](guides/governance-in-practice.md)** — the doctrine lived: the 3 escalations live, the hook and the logged bypass, separated roles, and FAQ.
6. **References** — point lookups, not sequential reading:
   - [Skills and commands reference](reference/skills.md) — the authored skills one by one: purpose, invocation, example, and gates.
   - [Agents reference](reference/agents.md) — who calls whom, role, and limits of each agent.
   - [Config reference](reference/config.md) — the per-project `aidakit.config.yaml` field by field (optional).
   - [razor examples](examples/README.md) — filled-in fictional artifacts (ADR, STATE, proposal) used by the guides.

## What's in each folder

| Folder | Content |
|---|---|
| [guides/](guides/README.md) | Narrative usage guides (items 1–5 above) — the HOW; the what/why lives in the linked doctrine |
| [reference/](reference/README.md) | Lookup references: skills/commands and agents |
| [examples/](examples/README.md) | Example artifacts of the fictional razor project, derived from the kit's real templates |
| [decisions/](decisions/README.md) | ADRs of the **aidakit itself** (the kit is software and makes architectural decisions). Follows the canonical target-project structure, because it records the kit's own decisions — not example, not usage guide. |
| [features/](features/README.md) | Change packages of the **aidakit itself** (proposal/design/tasks/evidence per change-id), dogfooding the kit's own flow. Like `decisions/`, follows the canonical target-project structure. |

## Where to look for what

| If you want to... | Read |
|---|---|
| Install and take the first step | [Getting started](guides/getting-started.md) |
| Start a project from scratch (architecture design) | [New project flow](guides/new-project-flow.md) |
| Execute a change from the backlog through to the PR | [Per-change flow](guides/change-flow.md) |
| Adopt the kit in a repo that already exists | [Existing-repository flow](guides/existing-repo-flow.md) |
| Understand a hook block, a bypass, or an escalation | [Governance in practice](guides/governance-in-practice.md) |
| Browse all the usage guides (the HOW) | [guides/ index](guides/README.md) |
| Know what a skill does and when it triggers | [Skills reference](reference/skills.md) |
| Know what an agent decides on its own and what it doesn't do | [Agents reference](reference/agents.md) |
| Set the content language, declare domains, or customize the review matrix | [Config reference](reference/config.md) |
| Browse all the lookup references | [reference/ index](reference/README.md) |
| See a filled-in ADR / STATE / proposal | [razor examples](examples/README.md) |
| Understand a decision the kit itself made (and why) | [decisions/ index](decisions/README.md) |
| Understand how a recurring lesson becomes an executable test/rule | [Executable DNA](guides/executable-dna.md) |
| Track the project, plan epics, or organize shared knowledge (no Jira) | [Roadmap and knowledge](guides/roadmap-and-knowledge.md) |
| Understand the machinery end to end (engine, gates, leashes, limits) | [Anatomy](anatomy.html) (EN/PT) |
| The canonical reference of the whole process | [PROCESS.md](../PROCESS.md) |
| Find out whether "I have something ready for X" | [Catalog](../skills/catalog/INDEX.md) via `/aidakit:catalog` |

## The laws (plugin root)

Everything in this `docs/` cites and obeys — never replaces — the root documents:

- **[README.md](../README.md)** — 1-page vision of the plugin: the 4 layers, authored and curated skills, relationship with aida.
- **[PROCESS.md](../PROCESS.md)** — canonical process reference: the design defines, the suite executes; the per-change cycle; skills/agents inventory; where the state lives.
- **[DOCS.md](../DOCS.md)** — document doctrine: canonical `docs/` structure in target projects, seven inviolable rules, placement tree, WORKING → DURABLE.
- **[GOVERNANCE.md](../GOVERNANCE.md)** — execution doctrine: 3 escalations, everything via PR, separated roles, git guardrails enforced by the `pre-bash` hook.
- **[skills/catalog/INDEX.md](../skills/catalog/INDEX.md)** — searchable catalog of all the kit's tools (authored, curated, agents, hooks, plugins).

<!-- aidakit v0.3 — master index of the plugin's docs/, created on 2026-07-17 — translated to EN -->
