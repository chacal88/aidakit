---
name: learn
description: Learning loop — consolidates what the change taught (reads the diff, the correction events, and the ledgers), classifies each learning and PROPOSES doc/rule updates (never writes blindly). Closes the error→learn→inform-the-next cycle. Use at the end of a change, in the checkpoint phase, or when the user asks "what did we learn", "consolidate learnings", "retro". Records scoped memory served back into the next work.
---

# aidakit:learn — consolidate learning

> At the end of a change, turns what went wrong (and was corrected along the way) into classified learning and into IMPROVEMENT PROPOSALS — never applied blindly. It is what makes one change's error inform the next.

Precedence: if it diverges from [DOCS.md](../../DOCS.md) / [GOVERNANCE.md](../../GOVERNANCE.md), the doctrine wins.

## When to use (and when not)

- **Use** it at the end of a change (checkpoint/learn phase), after the review and before or together with the PR.
- **Use** it when the user asks for a retro, "what did we learn", consolidate learnings.
- **Don't use** it to APPLY changes — this skill PROPOSES; applying is a human decision (or a change of its own).

## Prerequisites

- The change's diff (`git diff` against the base).
- The change's correction events, if any (see [aidakit:reflect](../reflect/SKILL.md) and the ledgers).
- The change's ledgers, if they exist (`.aidakit/tasks/<change-id>/`).

## Process

### 1. Gather the sources
Read the diff, the **correction events** (`{ kind: "correction", ... }` in `.aidakit/tasks/<change-id>/events.ndjson` — what went wrong and got resolved along the way), and the **ledgers** (token/error, see below). The single guiding question: *"would someone on the next change who landed here know what to do from the current docs alone?"* If **not** → it's a learning candidate.

### 2. Classify each learning (3 orthogonal axes)
- **kind:** `bug-class` · `doc-gap` · `project-rule` · `process-friction` · `tooling` · `environment`.
- **action:** `followup` (becomes a task) · `doc-update` (update a doc) · `rule` (becomes an inviolable rule) · `regression-gate` (becomes a permanent test requirement) · `memory-only`.
- **scope:** `project` (holds for this repo — lives in `.aidakit/memory/`, committable) · `user` (holds for you in any project — goes to the auto-memory). When in doubt, the **narrowest** — don't generalize a project learning to all.

### 3. PROPOSE, don't write
Every learning with `action: doc-update`/`rule` becomes a **proposed literal diff** in `.aidakit/tasks/<change-id>/proposed-updates.md`: target (file), category, summary, and the before/after. **Never** edit the doc/rule directly — the human reviews and applies (or it becomes a change of its own). This is the skill's inviolable principle.

### 4. Record the scoped memory (served back)
- `scope: project` → one line in `.aidakit/memory/learnings.md` (committable): the `remember` (1 line) + the kind. It is read at the start of the next `/aidakit:flow-build`/change start of this repo.
- `scope: user` → propose an item for the user's auto-memory (the same memory mechanism you already use) — the `remember` + why.
- **Never** record a secret, credential, sensitive path, or code snippet in the `remember`/`class` — only the class (1 line). The rich detail stays in the `proposed-updates.md`.

### 4.5 Context-pack telemetry rollup

Before the worktree is cleaned, distill `.aidakit/tasks/<change-id>/.telemetry.jsonl` (the per-dispatch log `governance/engine/steps/invoke.js`'s resume handler writes — see [ADR-012](../../docs/decisions/ADR-012-context-pack-per-change.md) §Decision-7/8) into a durable `## Context-pack telemetry rollup` section in `evidence.md`: total dispatches, mean `pack_size`, sum of `cache_read`/`cache_creation`, count of `pack_rebuilt=true`, and a per-subagent breakdown. Run it with:

```
node governance/telemetry/rollup.js --change-id <change-id>
```

The write is **idempotent** — rerunning replaces the existing section instead of duplicating it, so `learn` can run more than once on the same change without leaving stale copies behind. When `.telemetry.jsonl` is absent or has zero lines (no dispatch opted into telemetry this run), the section is still written, with the exact text `No telemetry captured for this run.` instead of crashing on a missing file or a zero-division on empty aggregates. The JSONL itself stays ephemeral (gitignored, per-change) — the rollup in `evidence.md` is the durable record.

### 5. Evals that grow
A recurring `bug-class` → `action: regression-gate` → becomes a permanent test requirement on the next change that touches the area. A recurrence of an already-mitigated bug (it shows up again after the mitigation) is an **error-2** — it mandates a deeper review, not just a new fix.

### 6. Crystallize high-confidence learnings into DNA (executable, not text)

Some learnings are strong enough that leaving them as **text to be re-read** (the memory of §4) wastes the lesson: the next session has to re-interpret the note and remember to act on it. For those, **crystallize** the learning into an **executable artifact** — a regression test or a rule — that runs on its own. This is the kit's "executable DNA": the learning stops being *memory the AI re-reads* and becomes *code the organism runs*.

**What qualifies (the objective trigger, not a vibe).** Run the ledger trigger — `deriveCandidates(change-id, { threshold: 3 })` from [ledger.js](../../governance/ledgers/ledger.js) — to get the error classes that **recurred ≥3×** (grouped by `errorType`+`key`). A recurring error that survived a mitigation is exactly what deserves to be frozen into a gate. A one-off does not. Combine with the learning's `action`:
- `action: regression-gate` on a recurring class → crystallize a **regression test**.
- `action: rule` that is deterministically checkable → crystallize a **rule** (a validator in the `governance/validators/` shape, or a `pre-bash` rule).

**How to write it — never by hand into the live tree.** Call `writeDna(...)` from [dna.js](../../governance/dna/dna.js). It writes to **staging** (`.aidakit/dna/<change-id>/`) with the mandatory provenance header (`@dna-origin-change`, `@dna-origin-premise`, `@dna-type`, `@dna-created-at`, `@dna-trigger`). The provenance is not optional: it is what lets [check-dna-freshness](../../governance/validators/check-dna-freshness.js) later mark the DNA **stale** when its origin ADR is superseded — a gate that never expires becomes the bug it once caught. Set `originPremise` to the ADR the lesson depends on (`ADR-020`) when there is one, or `environment:<x>` / `version:<x>` otherwise. Inject `createdAt` yourself (the module does not read the clock).

**Where it does NOT go.** The crystallized DNA stays in `.aidakit/dna/` staging — it is **not** committed into the feature's PR and **not** dropped into `governance/validators/` or the feature's test files. Mixing "evolving the process" with "shipping the product" pollutes both. The DNA is promoted only through its **own dedicated PR** (branch `aidakit/dna/<change-id>`), reviewed in isolation, merged by a human. In the [full](../../governance/flows/full.yaml) flow that is the `dna_gate` → `dna_freshness` → `dna_pr` branch, which runs beside the feature's own PR without blocking it.

**Still proposes, never applies.** Writing to `.aidakit/dna/` staging is not "applying" — the DNA takes effect only when the human merges its PR. This preserves the inviolable principle: the DNA PR *is* the proposal.

### 7. Promote durable knowledge into docs/knowledge/ (shared, human-readable)

`.aidakit/memory/learnings.md` is the kit's **operational** funnel — one line per learning, read at the start of the next change. But some `scope: project` learnings are **durable knowledge a human needs**, not just a machine hint: a naming convention the team settled on, a recurring gotcha ("careful with X because Y"), a glossary term, a piece of business context. Those belong in `docs/knowledge/` — committed, indexed, reviewed in a PR, readable by every developer — not buried in an operational log.

When a learning is durable knowledge (not a decision → that's an ADR; not a how-to → that's a guide), **propose** promoting it:
- Add a proposed diff to `.aidakit/tasks/<change-id>/proposed-updates.md` targeting the right `docs/knowledge/` file: convention → `conventions.md`, term → `glossary.md`, trap → `gotchas.md`, business/domain context → `context.md`.
- The human reviews and applies it (or it becomes a change of its own). **Never** write into `docs/knowledge/` directly — the PR is the proposal, same inviolable principle as everywhere else.

This is the WORKING → DURABLE cycle (DOCS.md §4) applied to knowledge: the operational learning is WORKING (`.aidakit/memory/`), the promoted knowledge is DURABLE (`docs/knowledge/`). The funnel keeps the operational log small and the shared knowledge curated.

## Outputs

- `.aidakit/tasks/<change-id>/proposed-updates.md` — the proposed diffs (not applied).
- `.aidakit/dna/<change-id>/*.test.mjs` / `*.js` — crystallized DNA in staging (when a recurring learning qualified), each with its provenance header. Promoted only via the dedicated DNA PR.
- Lines in `.aidakit/memory/learnings.md` (scope project) and/or proposals for the auto-memory (scope user).
- Proposed diffs into `docs/knowledge/*.md` (in `proposed-updates.md`) when a learning is durable shared knowledge — promoted only via PR.
- A summary in the conversation: how many learnings, by kind, what was proposed, what was crystallized, and what was proposed for promotion to `docs/knowledge/`.

## Gates and guardrails

- **PROPOSES, doesn't write** — the inviolable principle. Applying a change is a human decision. Crystallized DNA lands in `.aidakit/dna/` staging and takes effect only through its own merged PR — the PR *is* the proposal.
- **Doesn't block the ship** — the learning is evidence, not a gate (in the flow, the `learn` step doesn't block the feature PR). The DNA PR is separate and also never blocks the feature.
- **Crystallize only on the objective trigger** — DNA comes from a `≥3×` recurring error (`deriveCandidates`), not from a hunch. A one-off learning stays as memory/proposal.
- **DNA carries provenance** — never crystallize without `origin-premise`; without it the freshness gate has nothing to invalidate against, and the DNA becomes an eternal, unaccountable gate.
- **Class, not raw content** in the memory — no secret/credential/code.
- **Narrowest scope when in doubt** — don't inflate a local learning.

## Related

- [aidakit:reflect](../reflect/SKILL.md) — lightweight per-phase reflection that feeds this consolidation.
- [/aidakit:flow-build](../../commands/flow-build.md) — serves the memory back at the start of the next change (the `aidakit:orchestrator` on the 1st step, logic once exposed as `aidakit:orchestrator` (1st step of `/aidakit:flow-build`)).
- Invoked at the `learn` step of the [full](../../governance/flows/full.yaml) flow.

<!-- aidakit v0.3 — ported from learner/post-task-learning (codeflow/psim), no cloud: local memory + auto-memory — translated to EN -->
<!-- aidakit v0.4 — executable DNA: §6 crystallizes recurring learnings into regression tests / rules in .aidakit/dna/ staging, promoted via a dedicated DNA PR (conceito GENESI) on 2026-07-20 -->
<!-- aidakit v0.4 — §7 promotes durable learnings from .aidakit/memory to docs/knowledge/ via PR (WORKING→DURABLE for knowledge) on 2026-07-20 -->
