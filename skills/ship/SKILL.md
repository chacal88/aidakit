---
name: ship
description: Ships the change up to the PR URL — nominal staging, conventional commit, push, and PR via commit-commands — and stops (the merge is always the human's). Enforces the governance ship guardrails. Emits the outcome the flow expects (success/failure). Use when a flow reaches the ship step, or when the user asks to commit and open the PR of an already-reviewed change.
---

# aidakit:ship — ship up to the PR

> The mechanical delivery step. It does not reinvent: it uses the `commit-commands` plugin with the guardrails of [GOVERNANCE.md](../../GOVERNANCE.md) §4, and **stops at the PR URL** — the merge is never the kit's.

Precedence: if it diverges from [GOVERNANCE.md](../../GOVERNANCE.md) / [PROCESS.md](../../PROCESS.md), the doctrine wins.

## When to use (and when not)

- **Use** when the change has passed review ([aidakit:review](../review/SKILL.md) with consensus/PASS) and is ready to become a PR — or when a flow reaches the `pr`/`ship` step.
- **Do not use** to merge — the PR merge is always the human's (GOVERNANCE.md §1, escalation 1).
- **Do not use** before review: shipping unreviewed work requires the human's acknowledgment.

## Prerequisites

- The change implemented and reviewed (recent PASS/consensus verdict).
- The official `commit-commands` plugin installed (`/commit-push-pr`).
- A change branch/worktree with the work (never the main branch).
- **Context pack, read-if-present.** When `docs/features/<change-id>/.context-pack.md` exists, inject it into the dispatcher's prompt as the stable prefix of durable context (identity, decisions, ADRs, specs, code-map-pointers, DoD) — see [ADR-012](../../docs/decisions/ADR-012-context-pack-per-change.md). Freshness is guaranteed upstream by the flow's `context_pack` phase; this skill never runs the pack's freshness validator itself. **If the pack is absent**, fall back to the raw `proposal.md`/`design.md`/`tasks.md`/cited ADRs, exactly as before — a missing pack never fails the dispatch.

## Process

1. **Check the review precondition.** If [aidakit:review](../review/SKILL.md) hasn't run since the last edit, **ask the human** (AskUserQuestion) before shipping unreviewed work — don't force it.

2. **Verify the state** (guardrails of GOVERNANCE.md §4, also enforced by the `pre-bash` hook):
   - branch ≠ main (`main`/`master`);
   - the worktree has exactly what's expected;
   - **nominal staging** — never `git add -A`/`.` (the hook blocks it); add file by file;
   - **refuse a file that looks like a secret** (`.env*`, `*credentials*`, `*.pem`, inline key).

3. **Commit + push + PR via `commit-commands`** (`/commit-push-pr`): conventional commit (`type(scope): description` ≤70 chars), push to the change branch, PR opened. If a commit hook fails, **fix it and make a NEW COMMIT** — never `--amend` after a failure (GOVERNANCE.md §4).

4. **STOP at the PR URL.** Hand over the link and return control. Approving/merging the PR is the human's.

## Outputs

- An open PR with the change's work; the URL handed to the human.
- **Outcome to the flow:** `success` (PR opened) or `failure` (couldn't open — report the reason).

## Gates and guardrails

- **Never merges** (GOVERNANCE.md §1). Never `--no-verify`, never `git add -A`, never `--amend` post-hook, never a push to main (GOVERNANCE.md §4 — the `pre-bash` hook also bars it).
- **Stops at the PR URL** — does not continue to the merge or to "done".
- **Unreviewed work requires human acknowledgment** before the ship.
- **Refuses secrets in staging.**

## DNA mode (`mode: "dna"`)

When invoked with `mode: "dna"` (the `dna_pr` step of the [full](../../governance/flows/full.yaml) flow), this skill ships the **crystallized DNA**, not the feature — a **separate PR** so that evolving-the-process never mixes with shipping-the-product:

- **Branch:** the `branch` input (`aidakit/dna/<change-id>`), created off the base — **not** the feature branch.
- **Scope:** stage **only** the artifacts under `.aidakit/dna/<change-id>/` (nominal, file by file — the `pre-bash` hook still bars `git add -A`). Nothing from the feature's diff.
- **Commit:** `chore(dna): crystallize learnings from <change-id>` (conventional, ≤70 chars).
- **PR body:** list each DNA with its `@dna-type` and `@dna-origin-premise`, and note it must pass `check-dna-freshness` before merge. Link back to the feature PR for context.
- **Stops at the PR URL**, same as always — the DNA PR is reviewed and merged by a human, in isolation. It never blocks the feature PR.

If there is no DNA in staging, this step is not reached (the flow's `dna_gate` routes straight to `document`).

## Related

- The official `commit-commands` plugin (`/commit-push-pr`) — the commit/PR mechanism this skill invokes.
- [aidakit:review](../review/SKILL.md) — the gate that precedes the ship.
- [aidakit:docs](../docs/SKILL.md) — archives the change after the merge (WORKING→DURABLE).
- Invoked at the `pr` step of the [fast](../../governance/flows/fast.yaml) and [full](../../governance/flows/full.yaml) flows.

<!-- aidakit v0.3 — thin ship envelope over commit-commands + GOVERNANCE §4 guardrails, 2026-07-17 — translated to EN -->
<!-- aidakit v0.4 — DNA mode: ships crystallized DNA on a dedicated branch/PR, separate from the feature (conceito GENESI) on 2026-07-20 -->
