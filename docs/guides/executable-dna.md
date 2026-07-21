# Executable DNA — turning a recurring lesson into code that runs on its own

> Narrative guide to the kit's **executable DNA** layer: how a learning that keeps coming back stops being *text the AI re-reads* and becomes a *regression test or rule that runs by itself*, promoted through its own dedicated PR. This guide **narrates and exemplifies** — the decision is fixed in [ADR-001](../decisions/ADR-001-executable-dna-crystallization.md), and the behavior lives in [aidakit:learn](../../skills/learn/SKILL.md) and the [full](../../governance/flows/full.yaml) flow. **If this guide diverges from the linked ADR/skill/flow, the other wins and this file is corrected.**

## The idea in one line

The kit already runs half of this: its validators and the `pre-bash` hook are code that executes on its own — no tokens, no re-interpretation, the truth is the disk. The learning loop was the other half: `aidakit:learn` recorded lessons as **text** the next session had to re-read and remember to apply. **Executable DNA closes the gap** — a high-confidence, recurring lesson is *crystallized* into an executable artifact so the organism runs it instead of the AI re-reading it.

## When a lesson becomes DNA (the objective trigger)

Not every learning qualifies — a one-off does not. The trigger is **objective, measured from the error-ledger**, not a hunch:

- An error class **recurred ≥3×** in the change (`deriveCandidates(change-id, { threshold: 3 })` over `error.ndjson`, grouped by `errorType`+`key`), **and**
- the learning's `action` is `regression-gate` (→ a regression test) or a deterministically-checkable `rule` (→ a rule/validator).

A bug that came back *after* a mitigation is exactly what deserves to be frozen into a gate. A lesson that happened once stays as memory/proposal, as before.

## What gets written, and where

`aidakit:learn` calls `writeDna(...)`, which writes to **staging** — `.aidakit/dna/<change-id>/` — never into the live tree. Each artifact carries a mandatory **provenance header**:

```js
// @dna-origin-change: feature-appointment-cancellation
// @dna-origin-premise: ADR-003
// @dna-type: regression-gate
// @dna-created-at: 2026-07-20
// @dna-trigger: ledger:errorType=agent-rework recurred 3x
```

The provenance is **not optional**. `origin-premise` names the ADR (or `environment:`/`version:`) the lesson depends on — it is what lets the freshness gate later know when the DNA went obsolete. `writeDna` refuses to create a DNA without it: a gate that can never expire eventually becomes the bug it once caught.

- A `regression-gate` → `.aidakit/dna/<change-id>/regression-<slug>.test.mjs`
- A `rule` → `.aidakit/dna/<change-id>/rule-<slug>.js` (validator shape: exit 0/1/2)

## How it reaches the codebase — a dedicated PR, never the feature's

This is the rule that keeps the mechanism honest: **crystallized DNA is promoted through its own PR, on branch `aidakit/dna/<change-id>`, separate from the feature's PR.** Evolving *how we develop* must not be smuggled into *what this change delivers* — reviewers weigh them separately.

In the `full` flow, after `learn`, a side branch runs and **never blocks the feature**:

| Step | Type | What it does |
|---|---|---|
| `dna_gate` | runs | Is there any DNA in `.aidakit/dna/<change-id>/`? No → skip straight to `document`; yes → continue. |
| `dna_freshness` | runs | `check-dna-freshness` — no DNA is born stale (origin ADR already superseded) or malformed. Fails → back to `learn` to regenerate. |
| `dna_pr` | invoke | `aidakit:ship` in **DNA mode** — commits only the staged DNA on the dedicated branch and opens its own PR. Stops at the URL. |

The feature's own `pr` → `merge` path is untouched. If nothing crystallized, the side branch is a no-op.

## The lifecycle — DNA can go stale, and the kit knows

A crystallized test/rule is frozen from a moment in time. When its origin ADR is later **superseded** or **deprecated** (a status the kit already tracks, with bidirectional supersede links), the DNA may no longer be valid. [check-dna-freshness](../../governance/validators/check-dna-freshness.js) reads each DNA's `@dna-origin-premise`, cross-checks the ADR index, and marks as **stale** any DNA whose premise died — exit 1, listing what to revalidate. This connects every DNA to the supersede graph the kit already maintains, so the corpus has a lifecycle (born → valid → **stale** → revalidated) instead of accreting forever.

## Guarantees (what this never does)

- **Proposes, never applies.** Writing to `.aidakit/dna/` staging is not applying; the DNA takes effect only when the human merges its PR. The PR *is* the proposal — the kit's inviolable principle holds.
- **Never blocks the feature.** The DNA branch runs beside the feature PR; a missing or failing DNA never stops the change from shipping.
- **Never crystallizes on a hunch.** Only the `≥3×` ledger trigger promotes a lesson to DNA.
- **Never crystallizes without provenance.** No `origin-premise`, no DNA — the freshness gate must always have something to invalidate against.

## Related

- [ADR-001](../decisions/ADR-001-executable-dna-crystallization.md) — the decision this guide narrates (context, alternatives, consequences).
- [aidakit:learn](../../skills/learn/SKILL.md) §6 — the crystallization step.
- [aidakit:ship](../../skills/ship/SKILL.md) — DNA mode (dedicated branch/PR).
- [full flow](../../governance/flows/full.yaml) — the `dna_gate → dna_freshness → dna_pr` branch.
- [flows.md](flows.md) — how the executable-flows layer works in general.

<!-- aidakit v0.4 — executable DNA guide (GENESI concept: crystallize recurring learnings into tests/rules via a dedicated PR) on 2026-07-20 -->
