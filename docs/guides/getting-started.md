# Getting started with aidakit — 5-minute guide

> **Precedence:** this guide is an entry map, not the law. If it diverges from any linked skill or doctrine — [PROCESS.md](../../PROCESS.md), [DOCS.md](../../DOCS.md), [GOVERNANCE.md](../../GOVERNANCE.md), or a plugin `SKILL.md` —, the other wins and this file is corrected.

aidakit is a Claude Code plugin that brings the complete development process to any project: guided architecture design, a spec-driven execution pipeline, document doctrine and governance with an active hook. Overview in [README.md](../../README.md). This guide covers only the essentials: install, take the first step, and confirm everything is wired up.

## 1. Installation

In any project, inside Claude Code:

```
/plugin marketplace add ~/Documents/winker/aidakit
/plugin install aidakit@aidakit
```

There is no configuration step. At install time, three things come into effect:

**The skills.** The authored skills (`aidakit:plan`, `aidakit:spec`, `aidakit:readiness`, `aidakit:review`, `aidakit:test`, `aidakit:coverage`, `aidakit:docs`, `aidakit:governance`, `aidakit:catalog`, plus the execution-pipeline ones — `/aidakit:flow-design` is a flow orchestrator **command**, not a skill, see "The commands" below) and the 16 curated third-party technical skills — these keep their original name and English content, invocable as `aidakit:<original-name>` (e.g., `aidakit:test-driven-development`, `aidakit:postgres-best-practices`). They load on demand; installing does not weigh down the context. Full inventory with when-to-use-each in [PROCESS.md §3](../../PROCESS.md), in the [skills reference](../reference/skills.md), and in the [catalog](../../skills/catalog/INDEX.md). The skills delegate to the agents (`aidakit:orchestrator`, `aidakit:planner`, `aidakit:adr-reviewer`, `aidakit:spec-reviewer`, `aidakit:research`, and the review bench), also installed with the plugin.

**The commands.** The plugin installs a handful of dedicated slash commands — one file per command in `commands/`: `/aidakit:flow-design` (starts or resumes the architecture design — `flow-design.md`), `/aidakit:flow-fast` / `/aidakit:flow-full` (build a change from plan to PR through the flow engine, minimal ceremony / maximum rigor — `flow-fast.md` / `flow-full.md`), `/aidakit:flow-sync` (regenerates project-local flow commands — `flow-sync.md`), `/aidakit:plan` (`plan.md`), `/aidakit:review` (`review.md`), `/aidakit:docs` (`docs.md`), `/aidakit:governance` (`governance.md`), and `/aidakit:catalog` (queries the tool index: "do I have something for X?" — `catalogo.md`).

**Command vs. skill — don't blur it.** Several of the kit's triggers have a dedicated slash command (above) AND are also **skills** (files in `skills/`) that Claude invokes on its own. Others — like `aidakit:test`, `aidakit:coverage`, `aidakit:spec`, `aidakit:readiness` — are **skill-only**, with no slash command of their own. The practical difference is how you trigger them:

- **Command** (`/aidakit:flow-design`, `/aidakit:flow-fast`, `/aidakit:catalog`, ...): you type the slash `/` and the command explicitly. It is a direct, deterministic trigger.
- **Skill** (`aidakit:test`, `aidakit:coverage`, ...): Claude invokes it on its own, by name and description, at the right moment in the flow — for example, `/aidakit:flow-fast` picks the next change in the 1st step of the flow (logic previously exposed as a separate command, now absorbed), or the PR gate triggers `aidakit:review`. You can also ask for a skill by talking in natural language, without a slash: *"run `aidakit:review` on the diff"* or *"now plan this change"*. For a skill without its own command, typing `/aidakit:coverage` does **not** work — name the skill in text and Claude loads it.

**The `pre-bash` hook — ACTIVE from the first command.** Registered as a `PreToolUse` hook for Bash, [hooks/pre-bash.js](../../hooks/pre-bash.js) runs before **every** Bash command the agent executes in the session (it does not intercept your personal terminal — only Claude Code's Bash tool). It mechanically enforces [GOVERNANCE.md §4](../../GOVERNANCE.md), blocking destructive git/shell commands (`git push --force`, `git add -A`, `git reset --hard`, `gh pr merge`, `rm -rf` at root/home, etc.) with a **fail-open** philosophy and a logged conscious bypass. The full table of the 10 rules, the conforming-alternative column, the bypass policy, and the verbatim block messages are the canonical reference in [governance-in-practice.md §2](governance-in-practice.md#the-hook-in-practice) — this guide covers only the quick test that the hook is active (below, in section 3).

External dependency: the execution cycle closes commit/PR with the `commit-commands` plugin (`/commit`, `/commit-push-pr`) — install it too if you don't have it yet ([PROCESS.md §3](../../PROCESS.md)).

## 2. First use

### New project → `/aidakit:flow-design`

The entry point for a new project is the architecture design ([aidakit:flow-design](../../commands/flow-design.md)): 4 sequential phases with gates — **1 Business → 2 DDD Modeling → 3 Architecture → 4 Implementation**. Each phase is an interview (one question at a time, a skeptical architect interviewing the product owner), produces a document in `docs/design/`, and only advances with your explicit approval. On the first run, the skill ensures the standard `docs/` structure from [DOCS.md](../../DOCS.md) (via `aidakit:docs` in init mode) before any deliverable.

Example — you just created the repo for **razor**, a scheduling SaaS for barbershops, and you run `/aidakit:flow-design`:

- **Phase 1 (Business)** interviews you about goals, processes, and ubiquitous language → approves `docs/design/1-business-vision.md` (Billing stays out of the MVP).
- **Phase 2 (DDD Modeling)** maps the bounded contexts (Appointment as core, Registration, Notification), the entities (Barbershop, Professional, Client, Appointment), value objects (ServiceWindow, Period, Phone), and the Appointment aggregate with its R1 invariant — "a professional never has two overlapping appointments" → `docs/design/2-domain-model.md`.
- **Phase 3 (Architecture)** materializes into decisions: ADRs like `ADR-003-appointment-as-aggregate.md` and `ADR-004-notification-async-outbox.md` are born in `docs/decisions/` → `docs/design/3-architecture.md`.
- **Phase 4 (Implementation)** defines the stack (NestJS + React + PostgreSQL on Neon + Prisma) and breaks the system into vertical changes → `docs/design/4-implementation-plan.md`, and hands off the baton to the execution cycle (`/aidakit:flow-fast`/`/aidakit:flow-full` → `aidakit:plan` → ... — full reference in [PROCESS.md §2](../../PROCESS.md)).

State lives in `docs/design/STATE.md`: you can close the session mid-phase 2 and resume weeks later with the same `/aidakit:flow-design`.

### Existing project

A repo that already has code, docs, and maybe scattered ADRs does not start with the design — it starts by deploying the doctrine and mapping what exists. Follow the [existing-repository flow](existing-repo-flow.md).

## 3. Confirm it worked

Two 30-second tests:

1. **Does the catalog respond?** Run the command `/aidakit:catalog` with no arguments — a summary of the index grouped by category should come back. If it does, commands and skills are installed (the catalog lists every skill, including those without a slash command of their own).

2. **Is the hook on the leash?** In any git repo, ask the agent to run `git add -A`. The command should be blocked before it executes, with exactly this message:

   ```
   [aidakit governance] BLOCKED: git add -A/--all/. is forbidden — staging is always nominal, file by file.
   Conscious bypass (will be logged): prefix with AIDAKIT_BYPASS=1 — only with the human's explicit request.
   Reference: GOVERNANCE.md of the aidakit plugin, section 4.
   ```

   If the command goes through without that message, the hook is not active — check the plugin installation (`/plugin`) and restart the session.

## 4. Where to go now

If your repo already exists, the next step is the [existing-repository flow](existing-repo-flow.md); to understand the whole process — how the design defines and the suite executes change by change, with the two gates (`aidakit:readiness` and `aidakit:review --diff`) and the per-change cycle end-to-end — read [PROCESS.md](../../PROCESS.md), which is the canonical reference; the two laws that govern everything are [DOCS.md](../../DOCS.md) (where each document lives, the seven inviolable rules, WORKING → DURABLE) and [GOVERNANCE.md](../../GOVERNANCE.md) (the 3 escalations to the human, everything via PR, separated roles, the guardrails the hook enforces); and when you don't know which tool to use for a task, ask the [catalog](../../skills/catalog/INDEX.md) via `/aidakit:catalog` before improvising.

<!-- aidakit v0.3 — quick-start guide, written on 2026-07-17 — translated to EN -->
