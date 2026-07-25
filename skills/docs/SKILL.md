---
name: docs
description: Executor of the DOCS.md doctrine — deploys, audits, and maintains a project's standardized document architecture. Four modes: init (creates the canonical structure), audit (checks the seven inviolable rules), index (syncs indexes with the reality on disk), and archive (archives a doc or completed change with a legacy banner and stub). Use when the user asks to organize docs, create a documentation structure, audit docs, archive a document, update an index, or asks "where do I save this document".
---

# aidakit:docs — deploy, audit, and maintain the document architecture

> Executes the DOCS.md doctrine on a concrete project — deploys the canonical structure, audits conformance, syncs indexes, and archives what has been superseded; this skill implements DOCS.md, it does not repeat it: it cites and points.

## When to use (and when not)

- **Use** when the user asks to: organize a project's docs; create or deploy the documentation structure; audit/verify docs conformance; archive a document or a completed change; update, rebuild, or sync the index.
- **Use** for the quick question "where do I save this document?" — walk the placement decision tree (DOCS.md §3) in order and answer with the path; the first "yes" decides. No mode needs to be invoked for this.
- **Do not use** to write document content: proposal/design/tasks is `aidakit:plan`, phase deliverables are `aidakit:flow-design`, review is `aidakit:review`. This skill handles structure, placement, and lifecycle — not content.
- **Do not use** for execution rules, git, and agent roles — that is GOVERNANCE.md.

## Prerequisites

- **The kit's DOCS.md read in full** — it is the law this skill executes; in any conflict between the state of the repo and the doctrine, DOCS.md wins.
- **The target project root identified** (where README.md, CLAUDE.md, and `docs/` live).
- **Layout detection** (DOCS.md §1): a repo with an `openspec/` directory → OpenSpec mode — `openspec/changes/` replaces `docs/features/` and `openspec/specs/` replaces `docs/specs/`; the rest is identical.
- **Content language** (DOCS.md §5): read the `language` field from `aidakit.config.yaml` at the target project root (default when absent or the file is missing: `en`). Write the readable PROSE this skill generates in that language — index bodies ("where to look for what", folder descriptions), the READMEs of empty folders, ADR narrative, legacy banners, stub text, and findings phrasing. What stays FIXED regardless of `language`: file/directory names and identifiers (`aidakit:*`, `README.md`, `INDEX.md`, `DECISION_INDEX.md`, `ADR-NNN-slug.md`), the ADR **structural headers** and 5-section format (§2.2–2.3) and any OpenSpec structural headers (`## Context`, `#### Scenario:`), the machine-parseable status vocabulary, and the classification enums. See the [config reference](../../docs/reference/config.md).
- **ADR count** in `docs/decisions/` — decides the existence of `DECISION_INDEX.md` (threshold: 15).
- **Every write to a versioned file goes out via a short branch + PR** — bookkeeping included (GOVERNANCE.md §2).

## Process

Identify the mode from the user's request; when torn between two modes, ask before acting.

### `init` mode — deploy the canonical structure

1. **Inventory what already exists**: list the project's `docs/` (or equivalent) and compare it against the canonical structure of DOCS.md §1.
2. **Divergence diagnosis**: if the project already has a consolidated docs layout that diverges from the canonical one (e.g., ADRs outside `decisions/`, loose docs at the root, its own tree with history), **do not impose the structure on top of it** — present a migration proposal (a from-to map, the moves required, which links would break and how to preserve them via stubs) and wait for the human's decision.
3. **Create only what is missing, without overwriting anything that exists** (full structure in DOCS.md §1):
   - `docs/INDEX.md` — master index: numbered reading order, description of each folder, "where to look for what"; scope and anti-scope declared at the top (DOCS.md §2.1).
   - `docs/decisions/README.md` — AUTHORITATIVE index of the ADRs: ID/title/status table, thematic grouping, format rules (the 5 sections and the WORM of DOCS.md §2.2–2.3).
   - `docs/design/`, `docs/architecture/`, `docs/features/` and `docs/specs/` (or `openspec/changes/` and `openspec/specs/` in OpenSpec mode), `docs/guides/`, `docs/archive/` — an empty folder gets a `.gitkeep` or a minimal one-sentence README declaring the folder's scope.
   - `docs/knowledge/README.md` — index of durable shared knowledge (conventions, glossary, gotchas, context); declares its scope/anti-scope (neither decision nor how-to) per the example artifact. The four theme files (`conventions.md`, `glossary.md`, `gotchas.md`, `context.md`) start as one-line stubs and fill up by promotion from `aidakit:learn`.
   - `docs/roadmap/README.md` + `docs/roadmap/epics/` — the in-repo roadmap. `ROADMAP.md` is generated (by `aidakit:roadmap`), not created empty. Epics are declared as `EPIC-<slug>.md`; item status is derived from disk, never a hand-written field.
4. **Do NOT create `DECISION_INDEX.md` before 15 ADRs** (DOCS.md §1) — it is a DISCOVERY index and only comes into being with critical mass; before that, the `README.md` is enough.
5. `docs/business/` is optional — create it only if the project already has (or asked for) strategic docs.
6. Report the result as two lists: **created** vs. **already existed (untouched)**.

### `audit` mode — check the seven rules

Check each rule of DOCS.md §2, plus the hygiene of §5, against the reality on disk:

1. **Internal links** (§2.4): every relative link resolves; ADRs linked with the ID visible in the text (`[ADR-016](ADR-016-slug.md)`). A broken link is a blocking finding — "all internal links resolve" is a formal readiness criterion.
2. **Placement** (§3): each file under `docs/` passes through the decision tree; a file in the wrong folder is a finding, with a proposed destination.
3. **ADRs** (§2.2–2.3): fixed 5-section format (Status+Date · Context · Decision · Consequences with "Accepted"/"Mitigated" · Alternatives considered); a valid status, including partial supersede and `amends` with a bidirectional link (`## Amendments` in the amended one); global sequential numbering, never recycled.
4. **Archive** (§2.6): every doc under `docs/archive/YYYY-MM-DD-*/` opens with a legacy banner (`> **Status**: legacy — do not use as a reference` + replacements + date/change); a standalone doc's old location keeps a stub, while an archived **change dir** keeps none — its old location must be empty (a stub there would read as `in-progress`, ADR-002) and its inbound links must already point at the archive. A `../features/<id>/` link to an archived change is this rule's failure mode: fix it with the rewriter (archive mode step 4), not by hand.
5. **Indexes** (§2.1): they do not duplicate content — they sequence and point; scope/anti-scope at the top; a precedence rule declared where conflict can arise (§2.5).
6. **Sizes** (§5): ~2 pages for indexes, ~4 for content; overflowed → a finding with a proposed split (the overflow rule).
7. **Index↔reality drift**: a file on disk with no entry in the index; an index entry pointing to a nonexistent file.

**Report**: each finding with a severity (`blocking` / `high` / `hygiene`), file, violated rule, and proposed fix. **Mechanical** fixes (a missing stub, an index entry, a broken link with an unambiguous destination) may be applied — only with the human's approval, and via PR. Never "fix" the content of an ADR: an ADR is WORM (§2.2); a real conflict with a recorded decision → propose a new ADR and escalate (GOVERNANCE.md §1).

### `index` mode — sync indexes with the disk

1. **Validate before regenerating**: run the drift check (step 7 of the audit) first. **Never regenerate blindly** — a divergence may be an orphan doc that should be archived or relocated, not indexed as is.
2. Rebuild `docs/INDEX.md` from the reality on disk: numbered reading order, description of each folder, "where to look for what" — pointing, never duplicating content (§2.1).
3. Rebuild `docs/decisions/README.md`: an ID/title/status table derived from the real ADRs on disk, thematic grouping, format rules preserved.
4. **≥15 ADRs and no `DECISION_INDEX.md`** → create it (decision trees, tours by role, search tips — DOCS.md §1); below that, do not.
5. A divergence that is not mechanical (a doc with no clear place in the §3 tree, an ambiguous entry) → escalate to the human; do not invent an entry nor delete the existing one.

### `archive` mode — archive a doc or completed change

1. **Confirm with the human BEFORE moving anything** (gate below) — present what will be moved, where to, what stays as a stub, and (for a change dir) the inbound links that will be rewritten; the rewriter's dry-run output is that list.
2. **Destination**: `docs/archive/YYYY-MM-DD-<reason>/`, dated by the archiving event (§2.6). For a completed change, `<reason>` = change-id — the single key end-to-end (§2.7: change-id = branch = PR suffix = archive directory).
3. **Legacy banner** at the top of each moved doc: legacy status, links to the replacements, the date and change that archived it (§2.6).
4. **Anti-link-rot — which of the two mechanisms applies (§2.6)**:
   - **A standalone doc** leaves a **stub** at the old location pointing at the new destination.
   - **A change directory** leaves **no stub** — a stub at `docs/features/<change-id>/` is what `derive-roadmap-status.js` reads as `in-progress`, so it would pin the archived change as in-flight forever ([ADR-002](../../docs/decisions/ADR-002-roadmap-status-derived-from-disk.md)). Instead **rewrite the inbound links**, mechanically — never by hand, because the relative depth differs per referring file and that is exactly how 12 links rotted before this step existed:
     ```
     node "$AIDAKIT_GOVERNANCE/archive/rewrite-links.js" --change <change-id> --root <project-root>          # dry-run: review the list
     node "$AIDAKIT_GOVERNANCE/archive/rewrite-links.js" --change <change-id> --root <project-root> --apply  # write
     ```
     Run it **after** the move (it reads the real archive dir off disk and refuses to guess a date). Anchors (`#section`) are preserved verbatim; the archive itself is never touched (WORM). Repointing a link inside an ADR is **not** a rule-2 violation — the decision text is untouched, only the address of an unchanged document moves.
5. **Prove it** — `node "$AIDAKIT_GOVERNANCE/validators/check-links.js" <project-root>` must exit 0 before the PR. The rewrite is the repair; this validator is the evidence.
6. **Completed change (PR merged) — promotion WORKING → DURABLE** (§4): spec deltas merge into the canonical specs (`docs/specs/` or `openspec/specs/`); learnings become guides or new ADRs. **The promotion is a human gate**: present the proposed merge diff and wait for approval before merging — the plan only becomes history once the implementation has validated it.
7. **Update the affected indexes** (apply the `index` mode to the touched indexes).
8. **Deliver via branch + PR** — archiving is bookkeeping and bookkeeping also goes via PR (GOVERNANCE.md §2); the merge is the human's.

## Outputs

- **init**: the canonical structure of DOCS.md §1 created/completed in the project + a created-vs-existed report; or, in a consolidated divergent layout, a migration proposal awaiting a decision.
- **audit**: a conformance report (finding × severity × proposed fix); mechanical fixes applied only as approved, via PR.
- **index**: `docs/INDEX.md` and `docs/decisions/README.md` synced with the disk; `DECISION_INDEX.md` created when ≥15 ADRs.
- **archive**: a dated folder in `docs/archive/`, legacy banners, anti-link-rot discharged per §2.6 (a stub for a standalone doc; rewritten inbound links for a change dir) with `check-links` exiting 0 as the evidence, updated indexes and — after the human gate — canonical specs with the deltas merged. All delivered via PR.

## Gates and guardrails

- **Moving or deleting an existing doc: always confirm with the human first.** No exception — even when the archiving seems obvious.
- **Promotion WORKING → DURABLE is a human gate** (DOCS.md §4; GOVERNANCE.md §1): the skill proposes the merge of the deltas, the human approves.
- **An ADR is WORM** (DOCS.md §2.2): no mode edits a past decision; superseding or contradicting an ADR → propose a new ADR in draft and escalate (GOVERNANCE.md §1).
- **A consolidated divergent layout in init** → propose a migration, never impose the structure on top of it.
- **index never regenerates blindly** → validate drift first, regenerate after.
- **Nothing straight to main** — every write goes out via a short branch + PR, bookkeeping included; the merge is always the human's (GOVERNANCE.md §1–2).
- **A file with no place in the §3 tree** → do not create nor index it; ask — "it probably does not belong in the repo" (DOCS.md §3.8).

## Related

- `aidakit:governance` — the sister doctrine: HOW agents execute (git, PR, roles, escalations)
- `aidakit:flow-design` — produces the deliverables that live in `docs/design/`
- `aidakit:plan` — creates the WORKING artifacts in `docs/features/<change-id>/` (or `openspec/changes/`)
- `aidakit:review` — the review gate that precedes the promotion of a change
- `aidakit:catalog` — index of the kit's pieces (`/aidakit:catalog`)
- Official `commit-commands` plugin (`/commit-push-pr`) — ships the bookkeeping PRs of this skill

<!-- aidakit v0.2 — new skill, executor of the DOCS.md doctrine, created on 2026-07-17 — translated to EN -->
