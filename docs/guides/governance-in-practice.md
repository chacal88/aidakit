# Governance in practice — the doctrine lived day to day

> **Precedence**: if this guide diverges from the linked doctrine or skill — [GOVERNANCE.md](../../GOVERNANCE.md), [aidakit:governance](../../skills/governance/SKILL.md), [hooks/pre-bash.js](../../hooks/pre-bash.js) — the other wins and this file is corrected.
>
> This guide is the HOW. The what/why lives in [GOVERNANCE.md](../../GOVERNANCE.md); a rule question is for the [aidakit:governance](../../skills/governance/SKILL.md) skill. The examples use the **razor** project (a scheduling SaaS for barbershops — NestJS + React + PostgreSQL/Neon + Prisma).

## 1. The three escalations, live

The model is permissive by design ([GOVERNANCE.md §1](../../GOVERNANCE.md)): the agent decides on its own everything not listed. **Exactly three** situations escalate to the human — always. Here is what they look like day to day:

### 1a. Merging a PR — deliver the URL and stop

The change `feature-appointment-cancellation` passed gate 2 (`aidakit:review --diff` returned PASS) and the shipper opened the PR:

> **Agent:** Gate 2 PASS. Commit `feat(appointment): cancel appointment with a 2h policy, no penalty` on the `feature-appointment-cancellation` branch, push done, PR opened: `https://github.com/acme/razor/pull/42`. **I stop here — the merge is yours.**
>
> **Human:** I already reviewed it, it's great. Go ahead and merge it.
>
> **Agent:** Merging a PR is never the agent's, not even with approval in chat ([GOVERNANCE.md §1](../../GOVERNANCE.md), escalation 1) — and the hook blocks `gh pr merge` either way. Do the merge on the git host; then let me know ("feature-appointment-cancellation done, PR #42 merged") and I'll proceed with the post-merge archive via `aidakit:docs`.

### 1b. Conflict with an ADR — propose superseding, don't work around

During the plan for that same change, the `aidakit:planner` notices that the cancellation-policy validation ("up to 2h beforehand, no penalty") was designed in a service that changes the `Appointment` state outside the aggregate:

> **Agent:** I found a conflict with a recorded decision. razor's `docs/decisions/ADR-003-appointment-as-aggregate.md` decided that `Appointment` is the aggregate that guards its own invariants (including R1: a professional never has two overlapping appointments). The design I was about to propose validates the penalty policy in a service that mutates the appointment directly — that **contradicts ADR-003**. I will not work around it in silence. Two ways out:
> 1. I adjust the design so the policy lives inside the aggregate (per ADR-003) — no escalation;
> 2. If you really want the external validation, I **draft a new ADR** that partially supersedes ADR-003, with the conflict named, and **you decide**.
>
> **Human:** Adjust the design; the aggregate stays the owner of the invariants.
>
> **Agent:** Done — design adjusted, ADR-003 stays with status `accepted`, nothing to supersede.

If the human had chosen option 2, the agent would write the new ADR in draft (format from [DOCS.md](../../DOCS.md), rules 2 and 3 — an ADR is WORM, supersede instead of editing) and **stop**: accepting the ADR is a human decision. At gate 2, the `aidakit:adr-reviewer` flags these cases as REQUIRES SUPERSEDER ([PROCESS.md](../../PROCESS.md), step 6).

### 1c. Out-of-scope dependency — stop and present

Implementing the cancellation, the executor re-inspects the repo (anti-drift, [GOVERNANCE.md §8](../../GOVERNANCE.md)) and discovers a hole:

> **Agent:** I STOPPED ([GOVERNANCE.md §1](../../GOVERNANCE.md), escalation 3). The change plan instructs emitting the `AppointmentCancelled` event via the outbox (razor's `docs/decisions/ADR-004-notification-async-outbox.md`), but the outbox table and the relay **do not exist in the repo** — they belong to a Notification-context change that hasn't been shipped yet. Building them is outside this change's approved scope. Options:
> 1. You expand this change's scope to include the minimal outbox infrastructure;
> 2. We prioritize the Notification change first and this one waits;
> 3. I deliver the cancellation emitting the event in memory, with the outbox integration as an explicit pending task in the plan.
>
> Awaiting your decision.

The pattern common to the three dialogues: the agent **names the rule, presents the real state, and waits**. It never improvises an exception.

<a id="the-hook-in-practice"></a>

## 2. The hook in practice

> **Canonical reference** of the hook's rules table and of the verbatim block messages. The source of truth is [GOVERNANCE.md §4](../../GOVERNANCE.md) (the doctrine) and [hooks/pre-bash.js](../../hooks/pre-bash.js) (the implementation); this section reflects both. The [getting-started guide](getting-started.md) carries only the quick test and points here.

The [pre-bash.js](../../hooks/pre-bash.js) runs before every Bash command (PreToolUse). Contract: exit 0 allows, exit 2 blocks with a message on stderr. **Fail-open**: a broken hook does not block work (it also doesn't protect). Philosophy ([GOVERNANCE.md §4](../../GOVERNANCE.md)): when in doubt, allow — a false positive costs more than the residual risk.

What the hook's RULES block today:

| Blocked command | Why / conforming alternative | Bypass? |
|---|---|---|
| `git push --force` / `-f` | Use `--force-with-lease` outside main, or ask the human | Yes (logged) |
| `git push --force-with-lease` on `main`/`master` | Force-push on main is forbidden even with lease | Yes (logged) |
| `git commit --no-verify` / `-n` | Hook failed? Fix it and make a **new commit** (never `--amend` after a failure) | Yes (logged) |
| `git add -A` / `--all` / `git add .` | Staging is always nominal, file by file | Yes (logged) |
| `git reset --hard` | Discards work; only with an explicit request from the human | Yes (logged) |
| `git clean -f` (any combination with `f`) | Deletes untracked files; only with an explicit request | Yes (logged) |
| `git branch -D` | Use `-d`; `-D` forces deletion of an unmerged branch | Yes (logged) |
| `git checkout -- .` | Discards all local changes; only with an explicit request | Yes (logged) |
| `gh pr merge` | Merging is never the agent's — deliver the URL and stop | Mechanically yes, but escalation 1 of §1 has no exception: even with a logged bypass, merging remains a doctrine violation |
| `rm -rf` on `/`, `~`, or `$HOME` | No alternative — you don't do it | **NO** (`noBypass` rule) |

When a command hits a rule, the real output on stderr is exactly this (example: `git add -A`):

```
[aidakit governance] BLOCKED: git add -A/--all/. is forbidden — staging is always nominal, file by file.
Conscious bypass (will be logged): prefix with AIDAKIT_BYPASS=1 — only with the human's explicit request.
Reference: GOVERNANCE.md of the aidakit plugin, section 4.
```

On the single rule with no bypass, the second line changes:

```
[aidakit governance] BLOCKED: rm -rf on a root/home path is forbidden, no bypass.
This rule has no bypass.
Reference: GOVERNANCE.md of the aidakit plugin, section 4.
```

Blocked and don't know what to do? There's almost always a conforming alternative (the middle column of the table). To understand the rule behind it, consult [aidakit:governance](../../skills/governance/SKILL.md) (explain mode).

## 3. Conscious bypass

The bypass exists because the hook is a safety net, not a cage — but it is a **recorded exception**, never a convenience.

**When it's legitimate:** only with an **explicit request from the human in this conversation** and for an action the doctrine allows under a human request — the typical cases are those on the "without an explicit request from the human" list of [GOVERNANCE.md §4](../../GOVERNANCE.md): `git reset --hard`, `git clean -f`, `git branch -D`, `git checkout -- .`. A bypass without a traceable request from the human is a violation, not a shortcut ([aidakit:governance](../../skills/governance/SKILL.md), "Gates and guardrails").

**How to use it:** prefix the command with `AIDAKIT_BYPASS=1`:

```
AIDAKIT_BYPASS=1 git reset --hard origin/feature-appointment-cancellation
```

**Where the log lives:** every bypass is written to the project's `.claude/.cache/aidakit-bypass.log`, one line per bypass in the format `ISO-date<TAB>command`. The log is best-effort (a write failure does not block the command), and the `rm -rf` on root/home rule does not pass even with a bypass.

**How to review it:** ask the skill for the audit — `aidakit:governance` in **audit** mode ([SKILL.md, Mode 2](../../skills/governance/SKILL.md)). It reads the log and judges each entry: is there a traceable explicit request from the human (a message, PR body, task)? Does the command match the request? Suspicious signals it reports one by one, with date and command: bypasses in a series within a short interval, a `push --force`/`reset --hard` bypass with no trace of a request, the same rule worked around repeatedly.

**A recurring false positive** is not solved with a series of bypasses: it becomes a proposed change to the doctrine/hook, via PR — like any change.

## 4. Roles: author ≠ reviewer ≠ shipper

[GOVERNANCE.md §3](../../GOVERNANCE.md) separates the roles so that no one approves their own work:

| Role | Who | What it does | What it does NOT do |
|---|---|---|---|
| **Author** | `aidakit:planner`, executors | Produces artifacts and code | Approve its own work |
| **Reviewer** | `aidakit:adr-reviewer`, `aidakit:spec-reviewer` | **Report, don't fix**; each writes ONLY its own verdict file (single-writer) | Edit, approve, or merge |
| **Shipper** | mechanical | Verifies pre-conditions (branch ≠ main, worktree matching what's expected), explicit staging, conventional commit, push, PR — **and stops at the URL** | Merge |

Every reviewer verdict ends in machine-parseable lines inside the markdown:

```
Status: APPROVED | NEEDS-REVISION | BLOCKED
Ready to implement: yes|no
```

Two prohibitions the `aidakit:governance` audit checks: `APPROVED` with an open blocker and `APPROVED` with an empty or trivially broad scope (`["**"]`). And before any human or reviewer judgment comes the **mechanical validation** — structure, links resolving, checklists 100%, tests green — the machine filters first. Where each role enters the change cycle is in [PROCESS.md](../../PROCESS.md), section 2.

## 5. FAQ

**Why was my `git add -A` blocked?**
Staging is always nominal, file by file ([GOVERNANCE.md §4](../../GOVERNANCE.md)). `git add -A` is the fastest way to accidentally stage a `.env` or a build artifact — and a staged secret is an incident, not an inconvenience. List the files: `git add src/appointment/cancel.service.ts src/appointment/cancel.service.spec.ts`.

**Can I turn the hook off?**
The honest answer: the two legitimate ways out are to **uninstall the plugin** (the hook comes with it) or a **one-off logged bypass** with an explicit request from the human. A permanent exception is a recorded human decision — a change to the doctrine/hook via PR, with an ADR if it's structural. No kit skill disables a rule or grants an exception, in any mode ([aidakit:governance](../../skills/governance/SKILL.md)).

**The hook broke (a Node error, invalid JSON). Am I stuck?**
No — the hook is fail-open: if it breaks, the command passes. You lose the protection, not the flow. Report the defect so it can be fixed via PR.

**The human approved in chat; can I merge the PR?**
No. Merging a PR is escalation 1 of [GOVERNANCE.md §1](../../GOVERNANCE.md) and has no exception — the chat approval is the signal for the **human** to merge on the git host. The agent delivers the URL and stops (see dialogue 1a above).

**The block was a false positive. Now what?**
Once: a logged bypass with the human's request. Recurring: a proposed adjustment to the hook/doctrine rule, via PR. A series of bypasses for the same rule is exactly the pattern the audit flags.

<!-- aidakit v0.3 — practical guide to GOVERNANCE.md, examples in the canonical razor project — translated to EN -->
