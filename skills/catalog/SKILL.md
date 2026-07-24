---
name: catalog
description: Searchable index of all the user's tools — skills, commands, agents, hooks, doctrine, and plugins, grouped by category and design phase. Use when you do not know which skill or tool applies to a task, when the user asks "do I have something for X?", before writing from scratch something that probably already exists as a skill, or to locate an on-demand corpus skill from the mega-package.
---

# aidakit:catalog — Index of the kit

> Answers "do I have a tool for X?" by consulting the complete catalog of skills, agents, hooks, doctrine, and on-demand corpus.

## When to use (and when not)

**Use when:**
- You do not know which skill/tool applies to a task.
- The user asks "do I have something for X?" or asks for a tool recommendation.
- You are about to write from scratch something that probably already exists as a skill (search before improvising).
- You need to locate an on-demand corpus skill (mega-package) that is not loaded automatically.

**Do not use when:**
- You already know exactly which skill to invoke — invoke it directly.
- The question is about the execution process itself — that is `PROCESS.md`, `DOCS.md`, and `GOVERNANCE.md` at the plugin root.

## Prerequisites

- The `INDEX.md` file in this same directory (installed with the aidakit plugin). It catalogs, by category:
  1. **aidakit skills and doctrine** (installed with this plugin — invocable directly as `aidakit:<name>`; doctrine in `DOCS.md`, `GOVERNANCE.md`, and `PROCESS.md` at the plugin root)
  2. **Installed official plugins** (invocable directly, e.g.: `feature-dev`, `code-review`)
  3. **On-demand corpus** (vetted skills from the mega-package in `~/.claude/skills/skills/<name>/SKILL.md` — NOT loaded automatically; to use one, read its SKILL.md at the indicated path and follow the instructions)

## Process

1. Read the `INDEX.md` in this same directory.
2. Search the need by category/design phase (process, business, DDD, architecture, implementation, quality, security, data, AI, DevOps, meta).
3. Answer with **name, where it is, and how to invoke it** — kit skills always by the qualified name (`aidakit:<name>`; slash commands like `/aidakit:flow-design`, `/aidakit:catalog`).
4. Before recommending an item from the **on-demand corpus**, check that the path still exists; instruct to read the `SKILL.md` at the indicated path and follow its instructions.
5. If nothing in the index covers the need, say so **explicitly** and suggest creating a new skill (`skill-creator`) instead of improvising.

## Outputs

No artifact is created — the output is the answer in the chat (name, layer, how to invoke). This skill does not write documents; if the query evolves into creating docs, the placement follows `DOCS.md`.

## Gates and guardrails

- **The on-demand corpus is not auto-loaded** — never treat a corpus item as installed; always point to the path and the reading instruction.
- **A third-party skill does not enter the kit without an audit:** before promoting any skill from the mega-package, run `aidakit:skill-scanner` (injection, malicious code).
- **Do not improvise what already exists:** if the index covers the need, use the cataloged tool; if it does not, declare the gap instead of inventing a process.
- Any execution resulting from the recommendation obeys `GOVERNANCE.md` (authority, PR, git/ship guardrails).

## Related

- `aidakit:flow-design` — the conductor of the 4 phases; the catalog groups tools by its phase.
- `aidakit:docs` / `aidakit:governance` — deploy and verify the `DOCS.md` and `GOVERNANCE.md` doctrines.
- `aidakit:skill-scanner` — a mandatory audit before adopting a third-party skill.
- `skill-creator` (built-in) — create a new skill when nothing in the index covers the need.

<!-- aidakit v0.2 — rewrite of the mx kit-index skill for the aidakit namespace — translated to EN -->
