---
name: governance
description: Guardian of the aidakit execution doctrine (GOVERNANCE.md). Use when the topic is governance, execution rules, "can I run this command?", "why was it blocked" (pre-bash hook), how to use AIDAKIT_BYPASS=1, reviewing logged bypasses, auditing project conformance (reviewer verdicts, commits on main, versioned scripts), or preparing/onboarding a repo for the kit's governance. Explains and points to the exact section of the doctrine — never disables a rule nor grants an exception.
---

# aidakit:governance — Guardian of the execution doctrine

> Explains, audits, and deploys the governance of GOVERNANCE.md — citing the exact section instead of duplicating it, and without ever granting an exception (an exception is a recorded human decision).

## When to use (and when not)

**Use when:**
- Someone asks about the execution rules: "can I run this command?", "can I merge?", "can I commit straight to main?".
- A command was **blocked by the hook** `hooks/pre-bash.js` and you need to understand why and what to do.
- You need to **review bypasses** (`AIDAKIT_BYPASS=1`) that were logged, or **audit** the project's **conformance** with the doctrine.
- You are preparing a new repo to work under the kit's governance (**onboarding**).

**Do not use when:**
- The question is about where to create/move **documents** — that is the doctrine of `DOCS.md`, deployed by `aidakit:docs`.
- You want to **disable a rule or obtain an exception** — this skill does not do that, in any mode. An exception is a human decision, recorded (a logged bypass or an ADR).

## Prerequisites

- `GOVERNANCE.md` at the root of the aidakit plugin — **read it before answering any question**; this skill cites and points, it does not replace it.
- For the audit mode: access to the repo (git) and, if it exists, the `.claude/.cache/aidakit-bypass.log` log.
- For the onboarding mode: `node` available in the environment (the `pre-bash.js` hook is a Node script).

## Process

Identify the mode from the intent of the request and follow the corresponding script. In every mode, every statement about a rule comes with the section citation (`GOVERNANCE.md §N`).

### Mode 1 — explain (questions about the rules)

1. Read `GOVERNANCE.md` in full and locate the section(s) that answer the question. A quick map of where what lives (it points, does not duplicate):
   - **§1** — authority model: permissive by design; the **3 escalations** that are mandatory (merging a PR; superseding/contradicting an ADR; leaving the approved scope).
   - **§2** — everything via PR; direct-to-main does not exist for agents, not even bookkeeping.
   - **§3** — separated roles (author ≠ reviewer ≠ shipper); reviewers "report, don't fix", single-writer, machine-parseable verdict.
   - **§4** — git/ship guardrails enforced by the hook; conscious and logged bypass.
   - **§5** — execution of scripts and dependencies (only versioned; never `curl | bash`; secrets via the environment).
   - **§6** — multi-session coordination only through versioned artifacts.
   - **§7** — mandatory anatomy of a kit agent.
   - **§8** — executor anti-drift (re-inspect the repo before coding; invoke, don't just read the schema).
2. Answer by citing the exact section and, when useful, the short literal excerpt. If the doctrine does not cover the case, say so explicitly — the model's default is permissive (§1): what is not listed, the agent decides on its own.
3. **Command blocked by the hook** (`[aidakit governance] BLOCKED: ...`): explain that `hooks/pre-bash.js` mechanically enforces the guardrails of §4 (PreToolUse/Bash; exit 2 = block, fail-open if the hook breaks). The message on stderr names the violated rule. Guide:
   - There is almost always a conformant alternative — e.g.: staging by name instead of `git add -A`; a new commit instead of `--no-verify`/`--amend` after a failure; `--force-with-lease` outside main instead of `--force`; `git branch -d` instead of `-D`; delivering the PR URL instead of `gh pr merge`.
   - **Bypass**: prefix the command with `AIDAKIT_BYPASS=1` — **only with the human's explicit request in this conversation**. The bypass is logged in `.claude/.cache/aidakit-bypass.log` (ISO date + command) for retroactive review. The `rm -rf` rule at the root/home **has no bypass**.
   - Hook philosophy (§4): when in doubt, allow — a false positive costs more than the residual risk. If the block is a recurring false positive, that is a proposed change to the doctrine/hook via PR, not a bypass in series.

### Mode 2 — audit (retroactive conformance)

An audit is reading and reporting — **report, don't fix** (the same spirit as §3). Check, in order:

1. **Bypasses** — read `.claude/.cache/aidakit-bypass.log` (one line per bypass: `ISO-date<TAB>command`). For each entry, judge its legitimacy: is there a traceable explicit request from the human (a message, PR body, task)? Does the command match the request? Suspicious signals: bypasses in series within a short interval, a bypass of `git push --force`/`reset --hard` with no trace of a request, a bypass used to work around the same rule repeatedly. Report the suspicious ones one by one, with date and command.
2. **Reviewer verdicts** — locate the reviewers' verdict files (`aidakit:adr-reviewer`, `aidakit:spec-reviewer`) and check the contract of §3: each reviewer wrote ONLY its own file (single-writer — check authorship in the file's `git log`); the verdict ends in the machine-parseable lines `Status: APPROVED | NEEDS-REVISION | BLOCKED` and `Ready to implement: yes|no`; there is no `APPROVED` with an open blocker nor with an empty/trivially broad scope (`["**"]`).
3. **Direct commits on main** — run `git log --first-parent main --no-merges` (adjust the main branch name if needed) and identify commits that did not arrive via PR. Flag those authored by an agent (`Co-Authored-By: Claude ...` trailers or bot authors) — §2 forbids it without exception, bookkeeping included.
4. **Versioned scripts** — for scripts executed in the recent history (PR bodies, tasks, logs), confirm that they live in `scripts/`/`tools/` and are tracked (`git ls-files`). Executing an unversioned download or `curl | bash` is a violation of §5. A new dependency with no mention in the PR body (and an ADR, if structural) is also a finding.
5. Deliver the report **in the conversation**: findings by category, each with evidence (a log line, a commit hash, a file path) and the violated section. If the human wants to persist it, the destination follows `DOCS.md` (the change's evidence in `docs/features/<change-id>/`; a resulting decision becomes an ADR in `docs/decisions/`) — and it enters via PR, like everything else (§2).

### Mode 3 — onboarding (preparing a repo for the governance)

1. **A working hook**: confirm `node` is available (`node --version`) — `pre-bash.js` is Node and fail-open: if it breaks, it does not block work, but it also does not protect. Confirm the aidakit plugin is active in the project (the hook registered via `hooks/hooks.json`).
2. **Explain the 3 escalations to the team** (§1), in the terms of the doctrine: merging a PR is never the agent's; superseding/contradicting an ADR is a proposal + a human decision; leaving the approved scope is stop and report. Make the design clear: permissive by design, with no preventive matrix of prohibitions — the PR is the safety net.
3. **Suggest branch protection on main** (require a PR, block force-push and direct commits) — the configuration is the human's on the git host; the agent suggests and explains, it does not change repository configuration.
4. **Record the adoption in a short ADR** in `docs/decisions/ADR-NNN-slug.md` via `aidakit:docs` (sequential numbering and the 5-section format per `DOCS.md`): context (why adopt), decision (aidakit governance in effect, hook active, main protection), consequences, alternatives. The ADR enters via a branch + PR (§2).

## Outputs

- **explain**: an answer in the conversation with a section citation (`GOVERNANCE.md §N`) — no artifact.
- **audit**: a conformance report in the conversation (findings + evidence + violated section). Optional persistence follows `DOCS.md`: evidence in `docs/features/<change-id>/` or an ADR in `docs/decisions/`.
- **onboarding**: an adoption ADR in `docs/decisions/ADR-NNN-slug.md` (via `aidakit:docs`, by PR) + a readiness checklist (node ok, hook active, escalations communicated, branch protection suggested) in the conversation.

## Gates and guardrails

- **This skill never disables a rule nor grants an exception.** An exception is a recorded human decision: either an explicit logged bypass (`AIDAKIT_BYPASS=1`, GOVERNANCE.md §4), or a change to the doctrine by PR. A request to "just this once" with no human in the loop → refuse and cite the section.
- **A bypass without the human's explicit request is a violation, not a convenience** — and the rule with no bypass (`rm -rf` at the root/home) has no exception whatsoever.
- **An audit does not fix** — it reports. Fixing a finding is an author's work, via a branch + PR (GOVERNANCE.md §2 and §3).
- **The 3 escalations of §1 apply within the skill itself**: if explaining/auditing reveals the need to contradict an ADR or leave the approved scope, stop and escalate to the human.
- An audit finding involving an exposed secret (a file that looks like a secret staged, an inline key — GOVERNANCE.md §4 and §5) → escalate to the human immediately; do not reproduce the secret in the report.

## Related

- `aidakit:docs` — deploys the sister doctrine (`DOCS.md`); used in onboarding for the adoption ADR.
- `aidakit:adr-reviewer` and `aidakit:spec-reviewer` — reviewers whose verdict contract (single-writer, machine-parseable) this skill audits.
- `aidakit:review` — code review operating under these rules (report, don't fix).
- `aidakit:catalog` — locate the kit's other tools.
- Official `code-review` plugin — a PR review that complements the human merge gate.

<!-- aidakit v0.2 — new skill of v0.2, guardian of GOVERNANCE.md (distilled from Margi's authority model ADR-038, mx and recruit) — translated to EN -->
