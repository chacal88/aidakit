# GOVERNANCE — Execution of agents, scripts and changes

> aidakit doctrine for HOW agents work. Every skill and agent in the kit cites and obeys this file. The `hooks/pre-bash.js` hook (active with the plugin) mechanically enforces the part that can be enforced; the rest is a contract the agents follow and the PR captures.
> Origin: Margi's authority model (ADR-038), ship guardrails from the mx package, and the validators/allowed_writes contract from recruit.

## 1. Authority model: permissive by design, 3 escalations

The agent decides on its own everything not listed below. **Exactly three actions escalate to the human — always:**

1. **Merging a PR.** Never the agent's. The agent delivers the PR URL and stops. The human is the final gate ("trust but verify via PR").
2. **Superseding or contradicting an ADR.** The agent proposes (a new ADR in draft, with the conflict named); the human decides. An agent never bypasses a recorded decision in silence.
3. **Leaving the approved scope** (of the change plan, the design phase, or the roadmap). The agent stops, presents the dependency/discovery, and waits.

Anti-pattern rejected on purpose: a preventive matrix of prohibitions. Friction kills the flow; the PR is the safety net.

## 2. Everything via PR

No agent commits directly to the main branch — **not even bookkeeping** (status flips in the backlog, archive, reports). Substantive work goes through a short branch + PR. Direct-to-main does not exist for agents.

## 3. Separated roles (author ≠ reviewer ≠ shipper)

- **Author** (`aidakit:planner`, executors): produces artifacts and code. Forbidden from approving its own work.
- **Reviewers** (`aidakit:adr-reviewer`, `aidakit:spec-reviewer`): **report, don't fix.** Forbidden from editing, approving or merging. Each one writes ONLY its own verdict file (single-writer). A verdict ends in machine-parseable lines inside the markdown: `Status: APPROVED | NEEDS-REVISION | BLOCKED` and `Ready to implement: yes|no`. `APPROVED` is forbidden with an open blocker or an empty/trivially broad scope (`["**"]`).
- **Mechanical validation before judgment:** structure, links resolving, checklists 100%, tests green — the machine filters first; the human and the content reviewers only see what has already passed.
- **Shipper**: mechanical. Verifies pre-conditions (branch ≠ main, worktree matching what is expected), explicit staging, conventional commit, push, PR, **stops at the URL**.

## 4. Git and ship guardrails (enforced by the hook where possible)

Never, without exception:
- `git push --force`/`-f` (with `--force-with-lease` allowed outside main), push/commit directly to main
- `git commit --no-verify` / `-n`; after a hook failure: **a new commit**, never `--amend`
- `git add -A`/`--all`/`git add .` — staging is always by name
- `git reset --hard`, `git clean -fdx`, `git branch -D`, `git checkout -- .` without an explicit request from the human
- `gh pr merge` — see rule 1 of the authority model
- Staging a file that looks like a secret (`.env*`, `*credentials*`, `*.pem`, `*secret*`, inline keys)

A conscious bypass exists: `AIDAKIT_BYPASS=1` on the command — **logged** in `.claude/.cache/aidakit-bypass.log` with date and command, for retroactive review. Hook philosophy: when in doubt, allow (a false positive costs more than the residual risk).

## 5. Execution of scripts and dependencies

- Run only scripts versioned in the repo (`scripts/`, `tools/`) or standard commands of the stack. A new script enters via PR like any code.
- Never `curl | bash` nor execute an unversioned download.
- A new dependency requires registration: a mention in the PR body and, if structural, an ADR.
- Secrets come from the environment/manager — never hardcoded, never logged, never in an agent prompt.

## 6. Multi-session coordination only through versioned artifacts

Chat memory is not authoritative. Sessions coordinate through: `docs/design/STATE.md`, the versioned backlog, specs, ADRs and PR bodies. A prompt for a new session is **self-contained with fresh facts from the repo** (commit hash, the backlog line verbatim, gates and escalations embedded) — never a pre-rendered prompt that ages. A contract not pinned in a spec between two parallel sessions → the conflict escalates to the human (rule 3).

## 7. Mandatory anatomy of a kit agent

Every agent declares in its body, in this order: **Role** (one sentence) · **Protocol** · **What you decide on your own** · **Escalation triggers** · **What you do NOT do** · **Output format**. Minimal tools for the role; the model sized to the cost (mechanical is cheap, judgment is expensive).

## 8. Executor anti-drift

Before coding, re-inspect the real state of the repo (git log, key files). Any assumption in the plan changed → **STOP** and report (rule 3). Introspection ≠ invocation: what the plan promises works, prove it by invoking against the running system, not just by reading the schema.

<!-- aidakit v0.3 — doctrine distilled from Margi (ADR-038), mx and recruit on 2026-07-17 — translated to EN -->
