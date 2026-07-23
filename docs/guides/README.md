# guides/ — index of the aidakit usage guides

> **Scope:** narrative guides on HOW to use the kit — install, run the architecture design, execute a change, adopt it in a legacy repo, and live the governance. All use the fictional **razor** project to tell a single story. **Anti-scope:** the law does not live here — the what/why lives in the root doctrine ([PROCESS.md](../../PROCESS.md), [DOCS.md](../../DOCS.md), [GOVERNANCE.md](../../GOVERNANCE.md)) and the behavior of each skill in its source of truth (`SKILL.md`). Point reference for lookups lives in [reference/](../reference/README.md); filled-in artifacts, in [examples/](../examples/README.md).
>
> **Precedence:** this index sequences and points, never duplicates ([DOCS.md §2](../../DOCS.md), rule 1). If it diverges from any linked guide, skill, or doctrine, the other wins and this file is corrected.

## What's in each file

| File | What it is | When to read |
|---|---|---|
| [getting-started.md](getting-started.md) | 5-minute guide: install the plugin, what comes into effect (skills, commands, `pre-bash` hook), and how to confirm it's on | First contact with the kit, in any project |
| [new-project-flow.md](new-project-flow.md) | From zero to the first change: the 4-phase architecture design with gates (Business → DDD → Architecture → Implementation) | Starting a new project with `/aidakit:design` |
| [change-flow.md](change-flow.md) | The canonical execution cycle end-to-end: plan → readiness (GATE 1) → TDD → test/coverage → review `--diff` (GATE 2) → PR → human merge → archive | Executing a change from the backlog through to the PR |
| [existing-repo-flow.md](existing-repo-flow.md) | Adopt the kit in a repo with legacy code and docs: `docs init`/`audit`, governance onboarding, and the gradual-adoption ladder | Bringing the kit into a repository that already exists |
| [governance-in-practice.md](governance-in-practice.md) | The doctrine lived: the 3 escalations live, the hook and the logged bypass, separated roles (author ≠ reviewer ≠ shipper), and FAQ | Understanding a hook block, a bypass, or an escalation |
| [flows.md](flows.md) | The HOW of the executable flows layer: the model, the 7 step types, the two expression grammars, inversion of control, and the CLI commands | Running or creating a flow that orchestrates the process step by step |
| [executable-dna.md](executable-dna.md) | The HOW of executable DNA: how a recurring lesson is crystallized into a regression test/rule, promoted via a dedicated PR, and invalidated when its origin ADR is superseded | Understanding what the `learn` step crystallizes and why the DNA PR is separate |
| [roadmap-and-knowledge.md](roadmap-and-knowledge.md) | The HOW of in-repo tracking: the roadmap (epics → features → changes, status derived from disk) and shared knowledge (`docs/knowledge/`, promoted from the learn memory) — no Jira/Confluence | Tracking the project, planning epics, or organizing shared knowledge without an external tool |

The 1→5 order above is also the recommended reading order for newcomers. `flows.md`, `executable-dna.md`, and `roadmap-and-knowledge.md` are deep dives outside that sequence — read them when you're going to automate the process with the flows layer, to understand the crystallization of learnings, or to track the project in-repo. The lookup references ([skills](../reference/README.md) and agents) are also not sequential reading.

Back to the [master index](../INDEX.md).

<!-- aidakit v0.4 — reading-order sentence names all 3 deep dives (flows, executable-dna, roadmap-and-knowledge), 2026-07-23 -->
