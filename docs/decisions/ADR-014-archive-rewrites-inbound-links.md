<!-- File: docs/decisions/ADR-014-archive-rewrites-inbound-links.md — global sequential numbering, never recycled. Registered in the index docs/decisions/README.md. -->
<!-- An ADR is WORM: never edit a past decision. Changed your mind → a new ADR that supersedes or amends this one. -->

# ADR-014: Archiving a change rewrites its inbound links instead of leaving a stub

- **Status:** accepted
- **Date:** 2026-07-24

## Context

[DOCS.md](../../DOCS.md) §2 rule 6 discharges anti-link-rot with one mechanism: "a moved doc leaves a stub with the new link". For a standalone doc that works. For a **change directory** it cannot, and the repo proved it: of the 17 changes archived under `docs/archive/`, **not one** left a stub at `docs/features/<change-id>/`, and `check-links` reported **12 broken internal links** pointing at those vanished directories — from [ADR-008](ADR-008-opt-in-autonomous-pr-merge.md), [ADR-010](ADR-010-acceptance-leash.md), [ADR-011](ADR-011-runs-infra-error-routing.md), `EPIC-flow-engine-leashes.md`, and the `implement`/`plan`/`learn` SKILL.md files.

The stubs were not skipped out of sloppiness — the rule is unusable there. `docs/features/<id>/` **existing** is exactly the evidence `derive-roadmap-status.js` reads as `in-progress` ([ADR-002](ADR-002-roadmap-status-derived-from-disk.md), amended by [ADR-007](ADR-007-roadmap-status-from-shared-git.md) to read the shared git state). A stub directory left behind for link hygiene would pin every archived change as in-flight on the roadmap **forever**, and because ADR-007 derives from committed dirs on any branch, one stub would lie in every worktree at once. Rule 6 and ADR-002 are in direct conflict for change dirs, and ADR-002 is the one the kit cannot bend: "status is a function of reality" is the whole reason the roadmap exists.

So the rot recurs on **every** archive, and repointing the links by hand is exactly what already failed — the correct relative prefix differs per referring file (`../features/…` from an ADR, `../../docs/features/…` from a skill, `../../features/…` from an epic), so hand-editing is a per-file arithmetic problem nobody re-derives reliably.

One property makes the mechanical fix cheap: the move **preserves depth** (`docs/features/<id>/` and `docs/archive/<date>-<id>/` are both three levels below the root), so a change's own outbound links survive archiving untouched, and only *inbound* links need repointing.

## Decision

For a **change directory**, archiving discharges anti-link-rot by **rewriting the inbound links**, not by leaving a stub. The old location stays genuinely empty so the derived status keeps telling the truth. Standalone docs are unaffected and keep the rule-6 stub.

The rewrite is **mechanical**, never by hand: `governance/archive/rewrite-links.js --change <id> [--apply]` walks the living tree and repoints every link resolving into `docs/features/<id>/…` (or `openspec/changes/<id>/…`) to the real archive destination read off disk. It is **dry-run by default**, **idempotent** (a rewritten link no longer matches the source prefix), preserves `#anchor`/`?query` **verbatim**, skips fenced code blocks (a link in a fence illustrates a format, it is not an address), and never touches `docs/archive/` — the archive is WORM, and an archived doc's links reflect the tree at archive time. It **refuses to guess**: an unarchived change or two dated dirs for one id exits 2 for a human, rather than silently pointing every inbound link at the wrong history.

The `archive` mode of `aidakit:docs` runs it after the move and then `check-links` as the evidence: the rewrite is the repair, the validator is the proof. DOCS.md §2 rule 6 carries the carve-out explicitly.

Repointing a rotted link inside an ADR is **not** a rule-2 (WORM) violation: the decision text is untouched, and only the address of an unchanged document moves. The mechanical-fix carve-out of the `audit` mode ("a broken link with an unambiguous destination") already covers it; an archive destination read off disk is unambiguous by construction.

## Consequences

- Positive: the rot stops recurring — the next archive repoints its own inbound links as a step, not as a thing someone remembers; `docs/features/` keeps meaning "in flight", so the roadmap's derived status stays honest; the relative-path arithmetic that defeated hand-editing is done by a tool that cannot miscount; anchors survive, so deep links into a design doc keep landing on their section.
- Negative:
  - The tool duplicates ~20 lines of markdown walk/link-extraction with `check-links.js` instead of sharing a module — **Accepted** (a shared extraction is the right end state, but `check-links.js` has an in-flight change against it; coupling now would collide, and the duplicated part is a stable, well-tested 20 lines).
  - An inbound link written **after** the archive still rots until someone runs `check-links` — **Mitigated** (`check-links` already fails on it, and it is a formal readiness criterion for any change touching docs, §2.4).
  - Rewriting links inside WORM ADRs edits accepted files — **Mitigated** (only the address changes, never the decision; recorded explicitly in rule 6 and in the `audit` mode so a future reviewer does not read it as a violation).
  - The archive keeps its own rotted cross-change links (`../<other-id>/…` between two archived changes) — **Accepted** (deliberate: the archive is excluded from the walk as WORM jurisprudence; rewriting it would rewrite history).

### Review trigger

`check-links` starting to report archive-rot again despite the step existing (the step is being skipped, so it should become a `runs` gate in a flow rather than doctrine in a skill); or the shared markdown-link extraction landing in `check-links.js`, at which point this tool should consume it instead of duplicating it.

## Alternatives considered

| Option | Pros | Cons | Cost to undo |
|---|---|---|---|
| Repoint the 12 links by hand, no rule | Smallest diff; nothing new to maintain | Rot returns on the very next archive; the per-file relative arithmetic is what failed the first time | low |
| Leave a stub at `docs/features/<id>/` as rule 6 literally says | No new tool; one uniform mechanism for docs and changes | Breaks ADR-002 — the stub reads as `in-progress`, pinning every archived change as in-flight in every worktree (ADR-007) | high |
| A stub carrying a marker file that the roadmap deriver learns to ignore | Keeps one uniform mechanism | Adds a second source of truth to the status derivation and a new way for it to lie; anchors still break (a stub has no headings) | medium |
| Doctrine only — tell `aidakit:docs` to repoint links by hand at archive time | No new file | Prose where the epic's own goal is "mechanical, never doctrine in prose"; this is precisely the class of instruction that was already skipped 17 times | low |
| Make `check-links` auto-suggest the archive destination on a rot finding | Repair lives with detection | A validator that proposes edits stops being a pure gate; and it fires after the fact rather than as part of archiving | medium |
