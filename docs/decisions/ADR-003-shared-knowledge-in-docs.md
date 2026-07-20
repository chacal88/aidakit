<!-- File: docs/decisions/ADR-003-shared-knowledge-in-docs.md — global sequential numbering, never recycled. Registered in the index docs/decisions/README.md. -->
<!-- An ADR is WORM: never edit a past decision. Changed your mind → a new ADR that supersedes or amends this one. -->

# ADR-003: Durable shared knowledge lives in docs/knowledge/, promoted from the operational memory by PR

- **Status:** accepted
- **Date:** 2026-07-20

## Context

The team wants a shared memory across developers — conventions, the ubiquitous glossary, known gotchas, business context — kept in the repo and reviewed like code. The kit already has a memory mechanism: `aidakit:learn` records `scope: project` learnings in `.aidakit/memory/learnings.md`. But that file is the wrong home for shared *knowledge*: it is an **operational** log (one terse line per learning, read by the next `build`), not a human-facing document, and `.aidakit/` is the kit's machine-state area, not `docs/`. Putting shared knowledge there buries it where a developer would never browse and mixes two distinct things — the kit's between-run scratch state and the project's durable knowledge.

The distinguishing test is: *does a human need to read this to work on the project?* If yes, it is documentation and belongs in `docs/`, under the seven inviolable rules (indexed, precedence-declared, reviewed). If it is only the kit feeding itself between runs, it stays in `.aidakit/`. "Shared between developers" and "reviewed in a PR" are the signature of the former.

## Decision

Durable shared knowledge lives in **`docs/knowledge/`** — a new folder in the canonical structure (DOCS.md §1), with an index and the four theme files `conventions.md`, `glossary.md`, `gotchas.md`, `context.md`. Its boundary is explicit in the §3 placement tree: a **decision with alternatives → ADR**, a **how-to → guide**, and only what is *neither* (conventions, glossary, gotchas, context) goes to `knowledge/`.

`.aidakit/memory/learnings.md` remains the **operational funnel**. When `aidakit:learn` finds a learning that is durable knowledge, it **proposes** promoting it into the right `docs/knowledge/` file (a diff in `proposed-updates.md`); the human reviews and applies it via PR. Nothing is written into `docs/knowledge/` directly — the PR is the proposal, the same inviolable principle as everywhere in the kit. This is the WORKING → DURABLE cycle (DOCS.md §4) applied to knowledge: operational learning is WORKING, promoted knowledge is DURABLE.

## Consequences

- Positive: shared knowledge is where developers already look (`docs/`), versioned and PR-reviewed; the operational log stays small and machine-focused; the ADR/guide/knowledge boundary keeps each kind of content in exactly one home; promotion reuses the existing "propose, never write" discipline instead of inventing a mechanism.
- Negative:
  - One more folder in the canonical structure to deploy and index — **Accepted** (`aidakit:docs init` creates it; the index cost is one README, same as every folder).
  - A learning could sit un-promoted in the operational log — **Mitigated** (promotion is a proposed diff surfaced at each `learn`; the human decides, and the log staying the source means nothing is lost).
  - Risk of overlap confusion (is this a gotcha or an ADR?) — **Mitigated** (the §3 decision tree resolves it: alternatives → ADR, procedure → guide, else knowledge).

### Review trigger

`docs/knowledge/` files routinely holding content that should have been an ADR or a guide (the boundary isn't landing), or the promotion proposals being ignored often enough that shared knowledge still accretes only in the operational log.

## Alternatives considered

| Option | Pros | Cons | Cost to undo |
|---|---|---|---|
| Keep shared knowledge in `.aidakit/memory/` | No new folder | Buried in machine-state, not browsed by devs, not under the docs rules; conflates kit scratch state with project knowledge | low |
| Feed it into the target project's `CLAUDE.md` | The AI already reads it; one file | `CLAUDE.md` is a working contract for the AI, not a browsable knowledge base; grows unbounded; no per-theme structure | medium |
| Force everything into ADRs and guides (no knowledge/) | Reuses existing homes | Conventions/glossary/gotchas are neither decisions nor how-tos; jamming them into ADRs dilutes the decision record | medium |
| Auto-promote durable learnings straight into `docs/knowledge/` | Fully automatic | Breaks "propose, never write"; floods docs with unreviewed noise | high |
