<!-- File: docs/decisions/ADR-001-executable-dna-crystallization.md — global sequential numbering, never recycled. Registered in the index docs/decisions/README.md. -->
<!-- An ADR is WORM: never edit a past decision. Changed your mind → a new ADR that supersedes or amends this one. -->

# ADR-001: Crystallize recurring learnings into executable DNA, promoted via a dedicated PR

- **Status:** accepted
- **Date:** 2026-07-20

## Context

The kit already lives one half of the "executable-vs-text" distinction that the GENESI concept names: its validators (`check-doc-manifest`, `check-adr-format`, `check-links`) and the `pre-bash` hook are deterministic code that **runs on its own** — no tokens, no model re-interpretation, the truth is the disk. But its learning loop lives on the other half. When [aidakit:learn](../../skills/learn/SKILL.md) consolidates what a change taught, it records the lesson as **text** — a line in `.aidakit/memory/learnings.md` and diffs in `proposed-updates.md` — that the next session has to **re-read and re-interpret**, and remember to act on. A recurring bug therefore keeps costing model effort every time it is re-encountered, even after it was already understood and mitigated once.

Two forces shaped the decision:

1. **The lesson should execute, not be remembered.** A learning strong enough to matter is stronger as a regression test or a deterministic rule that runs by itself than as prose the model must recall.
2. **Evolving the process must not contaminate shipping the product.** If a crystallized test/rule were committed inside the feature's PR, that PR would mix "what this change delivers" with "how we develop" — two different natures of change that reviewers must weigh separately.

The open questions were: *what* qualifies a learning for crystallization (so it is not a hunch), *where* the artifact lives before it takes effect (without breaking the "learn proposes, never applies" principle), and *how* it reaches the codebase (without ever blocking or polluting the feature).

## Decision

A learning is crystallized into an **executable DNA artifact** — a regression test or a rule — when, and only when, an objective trigger fires: the error class recurred **≥3×** (`deriveCandidates(change-id, { threshold: 3 })` over the error-ledger, grouped by `errorType`+`key`) and the learning's `action` is `regression-gate` or a deterministically-checkable `rule`.

The artifact is written by `writeDna(...)` into **staging** (`.aidakit/dna/<change-id>/`), carrying a mandatory provenance header (`@dna-origin-change`, `@dna-origin-premise`, `@dna-type`, `@dna-created-at`, `@dna-trigger`). Writing to staging is **not** applying — the DNA takes effect only when promoted through its **own dedicated PR** on branch `aidakit/dna/<change-id>`, separate from the feature's PR, reviewed in isolation and merged by a human. In the `full` flow this is the `dna_gate → dna_freshness → dna_pr` branch after `learn`, which reconverges into `document` and **never blocks the feature**.

The provenance is load-bearing: `check-dna-freshness` reads `@dna-origin-premise` and marks a DNA **stale** when its origin ADR becomes superseded/deprecated, connecting each DNA to the supersede graph the kit already maintains. A gate that can never expire would eventually become the bug it once caught.

## Consequences

- Positive: a recurring, already-understood error stops costing model effort — it becomes a gate that runs on its own; the objective `≥3×` trigger replaces a subjective "is it worth freezing?"; process-evolution and product-delivery stay in separate PRs; the freshness gate gives crystallized DNA a lifecycle (born → valid → stale → revalidated) instead of accreting forever.
- Negative:
  - The crystallization branch adds four steps to the `full` flow — **Accepted** (they are a side branch that no-ops when there is no DNA; the feature path is untouched).
  - A DNA can go stale silently if no one runs `check-dna-freshness` — **Mitigated** (it is a gate in the flow and a standalone validator; a stale DNA fails loudly with an exit code, like the other validators).
  - Provenance discipline is now mandatory on every DNA (`origin-premise` required) — **Accepted** (`writeDna` throws without it, so a DNA cannot be created unaccountable in the first place).

### Review trigger

Crystallized DNA that a human routinely rejects at the dedicated PR (the trigger fires but the artifact is not worth keeping), or a recurrence threshold that proves mis-tuned in practice (too much noise at 3, or lessons missed because 3 is too high).

## Alternatives considered

| Option | Pros | Cons | Cost to undo |
|---|---|---|---|
| Keep learnings as text only (status quo) | Simplest; nothing new to maintain | The lesson is re-read and re-interpreted every time; recurring errors keep costing tokens | low |
| Crystallize into the feature's own PR | One PR, less ceremony | Mixes process-evolution with product-delivery; reviewers can't weigh them separately; pollutes the feature diff | medium |
| Apply the DNA automatically (write straight into `governance/validators/` or the test tree) | Fully autonomous, closest to "runs on its own" | Breaks the inviolable "learn proposes, never applies"; an auto-applied bad gate blocks everything with no human in the loop | high |
| Crystallize on a subjective "worth it?" judgment instead of the ledger trigger | Flexible | Non-reproducible; the same situation crystallizes or not depending on the model's mood; no audit trail | medium |
