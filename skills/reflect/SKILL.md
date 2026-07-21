---
name: reflect
description: Lightweight post-phase reflection — the 3 questions (what went wrong / how to do it better / what to remember) that emit learnings served back in the next phase. Use after a phase of work marked with reflection, or when the user wants a quick retro of a step. Feeds aidakit:learn with correction events.
---

# aidakit:reflect — per-phase reflection

> The lightweight reflection that runs AFTER a phase: three questions whose "what to remember" becomes memory served back in the next one. One phase's error informs the following one, without waiting for the end of the whole change.

Precedence: if it diverges from [DOCS.md](../../DOCS.md) / [GOVERNANCE.md](../../GOVERNANCE.md), the doctrine wins.

## When to use (and when not)

- **Use** it after a phase marked with reflection (`reflect: true` in the flow's block), or for a quick retro of a specific step.
- **Don't use** it as the end-of-change consolidation — that is [aidakit:learn](../learn/SKILL.md), which aggregates what this skill emitted along the way.

## Prerequisites

- A just-completed phase (implementation, review, etc.) with something worth reflecting on.

## Process

The **3 questions** (answer short, honest):

1. **What went wrong?** → maps to a `kind` (bug-class, process-friction, doc-gap…).
2. **How to do it better next time?** → maps to an `action` (followup, doc-update, regression-gate…).
3. **What to remember in the next phase?** → the `remember` (1 line) + the `scope` (project/user).

Record the result as an append-only event in `.aidakit/tasks/<change-id>/events.ndjson`:
- If something was corrected along the way: `{ "kind": "correction", "what": "...", "fix": "..." }`.
- The reflection itself: `{ "kind": "reflection", "wrong": "...", "better": "...", "remember": "...", "scope": "..." }`.

These events are exactly what [aidakit:learn](../learn/SKILL.md) reads when consolidating at the end of the change.

## Outputs

- `correction`/`reflection` events in `.aidakit/tasks/<change-id>/events.ndjson`.
- The most relevant `remember` served back at the start of the next phase (the flow injects the recent `remember`s into the next step's context).

## Gates and guardrails

- **Lightweight** — 3 questions, not a heavy retro. If it becomes ceremony, it lost the point.
- **Doesn't block** — reflection is never a gate.
- **Class, not raw content** — the `remember` is 1 line with no secret/code.

## Related

- [aidakit:learn](../learn/SKILL.md) — consolidates the events this skill emits.
- Triggered by phases with `reflect: true` in the [full](../../governance/flows/full.yaml) flow.

<!-- aidakit v0.3 — ported from reflect (codeflow/psim), no cloud — translated to EN -->
