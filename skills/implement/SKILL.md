---
name: implement
description: Dispatches the implementation of a change to the aidakit:implementer agent (isolated context) and hands the flow back the outcome it expects (success/failure). The skill carries the doctrine — approved-plan precondition, TDD (RED→GREEN→REFACTOR), the kit's quality bars, GOVERNANCE.md §8 anti-drift re-inspection — as the law; the work runs in the agent, without polluting the main context. Use when a flow reaches the implementation step, or when the user asks to implement a change already planned and with an approved plan (Status: APPROVED from aidakit:readiness).
---

# aidakit:implement — implement the change (TDD, via isolated agent)

> The implementation step of the cycle. It does not implement in the main context: it carries the doctrine (the HOW) and **dispatches the `aidakit:implementer` agent** — which runs in its own context and returns the outcome (`success`/`failure`) the flow reads to route. Skill = doctrine + dispatch; agent = executor (PROCESS.md §1: isolable work that comes back with a verdict is an agent, not a skill).

Precedence: if it diverges from [PROCESS.md](../../PROCESS.md) / [GOVERNANCE.md](../../GOVERNANCE.md), the doctrine wins.

## When to use (and when not)

- **Use** when the change already has an approved plan (passed [aidakit:readiness](../readiness/SKILL.md)) and it's time to write the code — or when a flow reaches the `implement` step.
- **Do not use** before the readiness gate: implementing without an approved plan violates the authority model ([GOVERNANCE.md](../../GOVERNANCE.md) §1, scope escalation).
- **Do not implement in the main context** — the work goes to the `aidakit:implementer` agent. This skill only carries the doctrine and dispatches; it does not write code or run tests on its own.

## Prerequisites

- An approved plan for the change (`docs/features/<change-id>/tasks.md` or the OpenSpec change at `openspec/changes/<change-id>/tasks.md`), with `Status: APPROVED` from [aidakit:readiness](../readiness/SKILL.md).
- The `aidakit:implementer` agent available.
- The change's branch/worktree already created (never `main`).

## Doctrine (the law the dispatch carries)

These rules are **non-negotiable** and travel in the dispatch prompt — the agent obeys them, and its verdict is `success` only if all were met:

1. **An approved plan is a precondition** — without `Status: APPROVED` from readiness, you don't implement ([GOVERNANCE.md](../../GOVERNANCE.md) §1).
2. **Anti-drift before coding** ([GOVERNANCE.md](../../GOVERNANCE.md) §8) — re-inspect the repo's real state (`git log`, `git status`, the key files the plan touches). Any plan premise changed → **STOP and report** (`outcome: failure` with the escalation reason); the flow treats this as an escalation, not a code `failure`. Do not implement over stale reality, and do not fix the plan on your own.
3. **TDD is not optional** — for each behavior: RED (write the test that truly fails and watch it fail) → GREEN (minimal code to pass) → REFACTOR (clean up with green locked in). Mark each task in `tasks.md` done only when the acceptance criterion is genuinely met and the cycle closed green.
4. **Non-negotiable quality bars** — no untyped escapes (`any` and equivalents), no forgotten debug prints, typed exceptions, mandatory edge cases (the edges [aidakit:brainstorm](../brainstorm/SKILL.md) raised have a test and handling).
5. **Bug along the way → root-cause before fix** — apply [systematic-debugging](../systematic-debugging/SKILL.md); record each correction as an event (`{ kind: "correction", ... }`) for [aidakit:learn](../learn/SKILL.md) to consolidate later.
6. **Does not commit, does not open a PR, does not approve its own work** — ship is [aidakit:ship](../ship/SKILL.md); the gates run afterward. Author ≠ shipper ≠ reviewer ([GOVERNANCE.md](../../GOVERNANCE.md) §3).

## Process (dispatch)

1. **Detect the target repo's tracking mode** (the agent also detects it, but cite the right path in the prompt): **OpenSpec mode** if `openspec/` exists (or the `openspec` CLI) — tasks in `openspec/changes/<change-id>/tasks.md`; **kit mode** otherwise — tasks in `docs/features/<change-id>/tasks.md` (DOCS.md).

2. **Dispatch the `aidakit:implementer` agent** (one call of the `Agent` tool, `subagent_type: "aidakit:implementer"`) with the prompt:

   > Implement the change `<change-id>` from the approved tasks in `<openspec/changes/<change-id>/tasks.md | docs/features/<change-id>/tasks.md>`, on the change's branch/worktree `<change branch>` (never `main`). Confirm first that the plan has `Status: APPROVED` from `aidakit:readiness`; without that gate, stop with `outcome: failure`.
   >
   > The doctrine that governs this step (obey it; your `success` is only valid if all are met):
   > - **Anti-drift first** (GOVERNANCE.md §8): re-inspect the repo (`git log`, `git status`, the key files the plan touches) before writing any code. A plan premise changed → STOP and return `outcome: failure` with the reason; do not implement over stale reality, and do not fix the plan yourself.
   > - **TDD with no exception**: for each task, RED (test that truly fails, watch it fail) → GREEN (minimal code) → REFACTOR. No product code without a failing test first. Mark the task only when the acceptance criterion is genuinely met and the cycle closed green.
   > - **Quality bars**: no untyped escapes (`any` and equivalents), no forgotten debug prints, typed exceptions, mandatory edge cases (the ones the plan named) with a test and handling.
   > - **Bug along the way**: apply systematic-debugging — root-cause before fix, a regression test that reproduces the bug. Record each correction as an event `{ kind: "correction", task, root_cause, fix }` in your output package.
   > - **Run the surface's suite** with the repo's canonical commands (discover them in `CLAUDE.md`, `package.json` scripts, `Makefile`, or CI config — never invent a command) before returning; only `success` with the suite green.
   >
   > Escalations (GOVERNANCE.md §1) — all produce `outcome: failure` with the reason, for the caller to route (never force it): stepping outside the approved scope, contradicting an ADR, or reality diverging from the plan premise. You do **not** commit, do **not** open a PR, and do **not** approve your own work — deliver the diff and stop.
   >
   > Return the machine-parseable verdict in your output format, with the line `Outcome: success | failure` last.

3. **Hand the outcome back to the flow.** The agent returns the verdict; the last `Outcome:` line is the signal the flow consumes. Do not re-narrate the process or re-implement anything — the caller reads the agent's diff and verdict.

### Multi-surface change (parallel)

When the plan touches 2+ surfaces and the orchestrator routed in parallel mode (PROCESS.md §2, one worktree per surface), dispatch **one `aidakit:implementer` agent per surface, in the same message** (one `Agent` call per worktree in the same turn — never sequential), each pointed to its `feat/<change-id>-<surface>` branch. Aggregate the outcomes: any `failure` fails the step. Merge order and worktree removal follow the plan — but that's ship, outside this skill.

## Outputs

- **From this skill:** the dispatch prompt and the relay of the agent's outcome to the flow — no code is written in the main context.
- **From the `aidakit:implementer` agent (isolated context):** code + tests on the change's branch/worktree; `tasks.md` marked; correction events; and the verdict with the final line `Outcome: success | failure`.
  - `success` — all approved tasks marked, TDD cycle closed green on each, surface suite green, quality bars met.
  - `failure` — didn't converge (test won't go green, bar not met) **or** an escalation fired (premise changed, scope overran, ADR in conflict). The flow routes back to the plan or the human.

## Gates and guardrails

- **An approved plan is a precondition** — do not dispatch without the readiness gate.
- **The work runs in the agent** — this skill does not implement in the main context; it carries the doctrine and dispatches.
- **TDD is not optional** at this step — test first, always; the doctrine travels in the prompt and the agent's `success` depends on it.
- **Does not commit or open a PR** — that's [aidakit:ship](../ship/SKILL.md). Author ≠ shipper ([GOVERNANCE.md](../../GOVERNANCE.md) §3).
- **A premise changed → STOP** ([GOVERNANCE.md](../../GOVERNANCE.md) §8), don't force it — the agent returns `failure` and the flow routes.
- **Do not approve your own work** — the gates ([aidakit:review](../review/SKILL.md)) run afterward, invoked by the caller ([GOVERNANCE.md](../../GOVERNANCE.md) §3).

## Related

- [aidakit:implementer](../../agents/implementer.md) — the executor agent this skill dispatches (isolated context; TDD + quality bars + anti-drift).
- [test-driven-development](../test-driven-development/SKILL.md) and [systematic-debugging](../systematic-debugging/SKILL.md) — the discipline the agent follows.
- [aidakit:readiness](../readiness/SKILL.md) — GATE 1: the `Status: APPROVED` verdict that is a precondition of this step.
- [aidakit:test](../test/SKILL.md) / [aidakit:coverage](../coverage/SKILL.md) — validation after implementing.
- [aidakit:review](../review/SKILL.md) — GATE 2, against the implemented diff.
- [aidakit:ship](../ship/SKILL.md) — the next step (commit/PR).
- Invoked at the `implement` step of the [fast](../../governance/flows/fast.yaml) and [full](../../governance/flows/full.yaml) flows.

<!-- aidakit v0.3 — thin envelope that dispatches the aidakit:implementer agent (doctrine + dispatch, isolated executor), 2026-07-17 — translated to EN -->
