# reference/ — index of the aidakit references

> **Scope:** references for point lookups — what each skill/command and each agent of the kit does, when to read it, and where they enter the process. They are not sequential reading: you consult an entry when a question comes up. **Anti-scope:** neither the law nor the canonical behavior lives here — the source of truth of each skill is its own `SKILL.md` and of each agent the `.md` in [agents/](../../agents/); the doctrine both obey lives at the root ([PROCESS.md](../../PROCESS.md), [DOCS.md](../../DOCS.md), [GOVERNANCE.md](../../GOVERNANCE.md)). The narrated step-by-step of usage is in [guides/](../guides/README.md).
>
> **Precedence:** this index summarizes and points, never duplicates ([DOCS.md §2](../../DOCS.md), rule 1). If it diverges from any linked skill, agent, or doctrine, the other wins and this file is corrected.

## What's in each file

| File | What it is | When to read |
|---|---|---|
| [skills.md](skills.md) | The 16 authored skills one by one (purpose, invocation, example, and gates) plus the slash commands and the 16 curated third-party skills | "What does this skill do and when does it trigger?"; picking the right skill for a step |
| [agents.md](agents.md) | The 11 agents (orchestrator, planner, brainstorm, implementer, the review bench, and research): who calls whom, role, what each decides on its own, and what it does NOT do | "What does this agent resolve on its own and where does it escalate?"; understanding the skill → agent delegation |
| [config.md](config.md) | The per-project `aidakit.config.yaml` field by field (`language`, `domains`, `review.matrix`); optional, with the defaults the kit uses without it | "How do I set the content language / declare domains / customize the review matrix?"; before copying the example config |

To see the whole process in prose, use the [guides/](../guides/README.md); for the searchable list of every tool ("do I have something for X?"), the [catalog](../../skills/catalog/INDEX.md) via `/aidakit:catalog`.

Back to the [master index](../INDEX.md).

<!-- aidakit v0.3 — index of the reference/ subfolder, created on 2026-07-17 — translated to EN -->
