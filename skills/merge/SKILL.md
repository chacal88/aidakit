---
name: merge
description: Autonomous PR merge — OPT-IN per project, gated by ADR-008. Checks mergeability on the host (mergeable state, review decision, status checks) and merges via the host's normal mechanism (gh pr merge), never a privileged bypass (no --admin/--no-verify/AIDAKIT_BYPASS). Any doubt or failure reports the reason and falls back explicitly — never a silent merge. Use only when the `auto_merge` step of a flow dispatches it (reached only when a project's BASE branch already declares pr.auto_merge:true in aidakit.config.yaml); never on demand for the kit's own repo or for a project without that opt-in.
---

# aidakit:merge — opt-in autonomous PR merge

> Merges a PR pre-approved by the flow's own gates (review bench + hardening + doc-gate), only for projects that explicitly opted in. It does not re-run review, does not relax GOVERNANCE.md §4, and never uses a privileged bypass. Any doubt reports why and falls back to the human.

Precedence: if it diverges from [GOVERNANCE.md](../../GOVERNANCE.md), [PROCESS.md](../../PROCESS.md), or [ADR-008](../../docs/decisions/ADR-008-opt-in-autonomous-pr-merge.md), the doctrine/ADR wins.

## When to use (and when not)

- **Use** only when the `auto_merge` step of the [fast](../../governance/flows/fast.yaml)/[full](../../governance/flows/full.yaml) flow dispatches it — reachable only after `merge_route` (a deterministic `runs` gate) confirms the target project's TRUSTED BASE BRANCH declares `pr.auto_merge: true` in its `aidakit.config.yaml` (ADR-008; read from the base, never from this very PR's own diff — a PR cannot grant itself the opt-in).
- **Do not use** on demand, outside a flow dispatch — this is not a general-purpose "merge this PR for me" tool. The gate that authorizes it is the flow's own `merge_route`, never an ad hoc decision.
- **Do not use** for the kit's own repository (aidakit) or any project without the opt-in — the [`merge`](../../governance/flows/full.yaml) `human_gate` is the fallback that governs there, unchanged (GOVERNANCE.md §1).
- **Do not use** to re-run review or relax any gate — by the time `auto_merge` is reached, the review bench, hardening, and the doc-leash have already passed (position in the flow guarantees this; see [ADR-008](../../docs/decisions/ADR-008-opt-in-autonomous-pr-merge.md) §Decision 2).

## Prerequisites

- Dispatched with `change_id` and `request` (the flow step's declared input).
- The PR for this change's branch already open (the `pr` step, `aidakit:ship`, opened it and stopped at the URL — never this skill's job).
- `gh` (GitHub CLI) configured with a token that has merge permission on the repo. Its absence is a fallback condition, not a kit failure.

## Process

1. **Locate the PR.** Resolve the open PR for the change's branch (`gh pr view` against the current branch, or the branch matching `change_id`). If none is found, or `gh` is not configured/authenticated, outcome **`failure`** — report why.

2. **Check mergeability, read-only.**
   ```
   gh pr view --json mergeable,mergeStateStatus,reviewDecision,statusCheckRollup
   ```
   Mergeable ⟺ **all** of:
   - `mergeable == "MERGEABLE"` (no conflicts);
   - no required check in `statusCheckRollup` is failing or pending;
   - `reviewDecision` is not `CHANGES_REQUESTED`;
   - `mergeStateStatus` does not signal a branch-protection block (e.g. `BLOCKED`, `BEHIND` when a linear-history/up-to-date rule applies).
   Any of these unmet → outcome **`blocked`** — report exactly which condition failed (do not guess or retry with a stronger flag).

3. **Merge via the host's normal mechanism.** If mergeable:
   ```
   gh pr merge <number-or-branch> --merge   # or --squash/--rebase per the repo's configured default
   ```
   **Never** `--admin` (bypasses branch protection), **never** `--no-verify` — neither of the flags GOVERNANCE.md §4 (and the `pre-bash` hook's carve-out) forbid even with `pr.auto_merge: true`. **Never** `AIDAKIT_BYPASS` — this skill's authority comes from the project's declared opt-in, not from the human-override path. (`gh pr merge` has no `--force` flag.)
   - Merge succeeds → outcome **`merged`**.
   - The host rejects it (a race — protection state changed since step 2, a transient API error) → outcome **`failure`**, report the host's error verbatim.

4. **Never merge silently.** Every branch above ends in one of exactly three outcomes, each with a one-line reason for the flow/human to read at the fallback gate. There is no fourth path that merges without one of them being reported.

## Outputs

- **Outcome to the flow:** `merged` | `blocked` | `failure` — the [`auto_merge`](../../governance/flows/full.yaml) step's `on_result` routes `merged → done`, and **both** `blocked` and `failure` → the `merge` `human_gate`, which is the **universal fallback**: reported reason included so the human isn't left guessing.
- No PR is opened or edited by this skill — that's `aidakit:ship`'s job, already done before this step is reached.

## Gates and guardrails

- **Opt-in only, per project** — this skill exists in the graph only via the `auto_merge` step, itself reachable only when `merge_route` confirms `pr.auto_merge: true` (ADR-008). It is never invoked directly by a human request or another skill.
- **No privileged bypass, ever** — no `--admin`, `--no-verify`, `AIDAKIT_BYPASS`. This skill's own discipline (only ever a plain `gh pr merge`, optionally a safe merge-method flag) is the **primary** control (ADR-008 §Consequences, round-3 owner-accepted posture); the `pre-bash` hook's carve-out is defense-in-depth on top of it, not the security boundary.
- **Passes the same GOVERNANCE.md §4 guardrails a human merge would** — this skill does not get a looser bar than a human clicking "Merge" on the host.
- **Any doubt → `blocked`/`failure`, never a guess.** Ambiguous mergeability signals, an unreachable `gh`, or a host error are always reported explicitly and routed to the human gate — never silently retried with a stronger permission.
- **Does not re-run or relax review/hardening/doc-gate** — those already passed by construction of the flow's position.

## Related

- [ADR-008](../../docs/decisions/ADR-008-opt-in-autonomous-pr-merge.md) — the scoped supersession of GOVERNANCE.md §1 rule 1 that authorizes this skill to exist, and its guardrails.
- [aidakit:ship](../ship/SKILL.md) — opens the PR and stops at the URL; **never merges** — unchanged by this change.
- `governance/pr/pr-config.js` + `governance/validators/check-pr-automation.js` — the single-source reader the `merge_route` gate uses to decide whether this skill is dispatched at all.
- `hooks/pre-bash.js` — the mechanical carve-out on the `gh pr merge` guardrail, gated by the same config this skill's dispatch already implies is `true`.
- Invoked at the `auto_merge` step of the [fast](../../governance/flows/fast.yaml) and [full](../../governance/flows/full.yaml) flows, only past `merge_route`.

<!-- aidakit v0.8 — new skill: opt-in autonomous PR merge (pr.auto_merge, ADR-008), configurable-pr-automation, 2026-07-24 -->
