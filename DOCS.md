# DOCS — Standardized document architecture

> aidakit doctrine for ALL document generation in projects. Any kit skill or agent that creates, moves, or archives a document follows this file. The `aidakit:docs` skill deploys, audits, and maintains this structure.
> Origin: distilled from the documentary governance of the Margi project (docs/ + 44 ADRs + dated archive), from the ORGANIZATION_RULES of the digital-representative, and from the recruit validators system.

## 1. The canonical structure

```
<project>/
├── README.md                  # 1-page overview: what it is, status, "if you want X → read Y" table
├── CLAUDE.md                  # working contract for AI: points to ADRs, NEVER duplicates them
└── docs/
    ├── INDEX.md               # master index: numbered reading order + description of each folder + "where to look for what"
    ├── design/                # deliverables of the 4 phases of aidakit:design + STATE.md
    ├── decisions/             # ADRs — the only place for decisions
    │   ├── README.md          # AUTHORITATIVE index: ID/title/status table, thematic grouping, format rules
    │   ├── DECISION_INDEX.md  # DISCOVERY index (create when ≥15 ADRs): decision trees, tours by role, search tips
    │   └── ADR-NNN-slug.md    # global sequential numbering, never recycled
    ├── architecture/
    │   └── ARCHITECTURE.md    # 1 page: diagram + stack→ADR table + "what is intentionally NOT here"
    ├── features/<change-id>/  # per-change work artifacts (proposal, design, tasks, evidence) — WORKING life
    ├── specs/                 # canonical specs per capability — DURABLE life (absorb deltas at archive time)
    ├── guides/                # practical companions to ADRs: the HOW lives here, the what/why in the ADR
    ├── knowledge/             # durable shared knowledge that is neither a decision nor a how-to: conventions, glossary, gotchas, business context
    ├── roadmap/               # epics → features → changes; item status is DERIVED from disk, never hand-written
    ├── business/              # (optional) strategic docs with a Date/Version/Status header
    └── archive/YYYY-MM-DD-<reason>/   # superseded, dated by the archiving event
```

Projects using OpenSpec: `openspec/changes/` replaces `docs/features/` and `openspec/specs/` replaces `docs/specs/`; the rest is identical.

## 2. The seven inviolable rules

1. **Every docs directory has an index, and an index does not duplicate — it sequences and points.** Each index declares its own scope and anti-scope at the top. Content lives in one place only; the index links.
2. **An ADR is WORM.** Never edit a past decision. Changed your mind → a new ADR that **supersedes** (fully or partially: "Accepted (§ X superseded by ADR-NNN)") or **amends** ("amends ADR-NNN"; the amended one gains an `## Amendments` section pointing back — bidirectional link).
3. **Fixed ADR format, 5 sections:** Status+Date · Context (the problem that motivated it) · Decision (concrete enough to act on) · Consequences (positive AND negative, each negative marked "Accepted"/"Mitigated") · Alternatives considered. Doesn't fit in 2 pages → it's 2 ADRs.
4. **Relative links with the ID visible in the text** (`[ADR-016](ADR-016-slug.md)`) — they survive grep and offline reading. "All internal links resolve" is a formal readiness criterion for any change that touches docs.
5. **A precedence rule written into each doc that can conflict.** ARCHITECTURE.md, guides, and indexes each declare individually: "if this diverges from the linked ADR/artifact, the other one wins and this file is corrected." The truth hierarchy is self-described, not tribal.
6. **Dated archive with a legacy banner.** Archiving = moving to `archive/YYYY-MM-DD-<reason>/` and opening the doc with `> **Status**: legacy — do not use as a reference` + links to the replacements + the date/change that archived it. A moved doc leaves a stub with the new link (anti-link-rot).
7. **Single key end-to-end:** change-id = branch = PR title suffix = archive directory. Execution↔documentation traceability by naming convention, without tooling.

## 3. Placement decision tree

When creating ANY new file, walk it in order — the first "yes" answer decides:

1. Is it a decision (the what/why) with rejected alternatives? → `docs/decisions/ADR-NNN-slug.md`
2. Is it a design-phase deliverable? → `docs/design/`
3. Is it an artifact of ONE in-flight change (proposal/design/tasks/evidence)? → `docs/features/<change-id>/`
4. Is it the canonical description of a system capability? → `docs/specs/`
5. Is it a practical HOW (setup, procedure, troubleshooting)? → `docs/guides/`
6. Is it a structural view of the system? → `docs/architecture/`
7. Is it durable shared knowledge that is neither a decision (ADR) nor a how-to (guide) — a convention, glossary term, gotcha, or business context a new dev needs? → `docs/knowledge/`
8. Is it planning intent — an epic grouping features and changes? → `docs/roadmap/epics/EPIC-<slug>.md` (never a status field — status is derived from disk)
9. Is it strategy/market/finance? → `docs/business/`
10. None of the above? → **it probably does not belong in the repo.** Ask before creating.

## 4. The two lives of documents (WORKING → DURABLE)

Change artifacts (`docs/features/<change-id>/`) are WORKING: draftable, editable, disposable. On change completion (PR merged), the human gate promotes: spec deltas merge into the canonical specs (`docs/specs/`), learnings become guides or ADRs, and the change directory goes to `archive/YYYY-MM-DD-<change-id>/`. **The plan only becomes history when the implementation has validated it.** The archived corpus is jurisprudence: new changes cite precedents by archive-id.

## 5. Hygiene

- **Maximum size per doc: ~2 pages (indexes) / ~4 pages (content).** Overflowed → split and link (overflow rule).
- **Names:** descriptive kebab-case, no numbering except ADRs. Never `final`, `v2`, `new` in a file name.
- **Language:** the language of GENERATED content (documents, interview questions, operator prompts) comes from the `language` field in the project's `aidakit.config.yaml` (default when absent: `en`). The kit itself is English; only human-readable prose follows `language` — identifiers, machine-parseable verdicts and structural headers stay fixed. See [config reference](docs/reference/config.md). A project may still record the choice in an ADR for the record.
- **Manual snapshots die:** project status is not a hand-edited doc — it is a pointer to live sources (the design's STATE.md, the active backlog). If a snapshot exists and rots, convert it into a redirect with a post-mortem.

## 6. Documentation leash (the manifest)

### (a) The idea — mandatory documentation becomes a verifiable LIST, not a remembered action

Documentation that depends on the model "remembering to write" gets lost: it vanishes at the end of a long session, it is cut when tokens get tight, or the model itself declares "documented" without the file existing. The leash — the deterministic enforcement the engine imposes, not the model's goodwill — inverts this. A change's mandatory documentation stops being an **action the AI has to remember** and becomes a **declared list that a deterministic validator checks item by item** — the manifest. An agent assembles the list; the `check-doc-manifest.js` validator (pure Node, zero-dep, already existing and tested) walks each item and checks the **disk**: does the file exist? If it is an ADR, does it pass the format check? The flow **only advances when the list is 100%**. The truth is not the `status` field the AI wrote — it is the file on disk. The model cannot "think" it documented; either the file is there, or the gate stays blocked.

### (b) The two manifest levels

The manifest exists at two levels, distinguished by the `level` field:

- **Project** — `.aidakit/doc-manifest-project.json` (`level: "project"`, `change_id: "PROJECT"`). Lists the durable design deliverables: the documents a project **must have** to exist with governance (INDEX.md, ARCHITECTURE.md, the decisions README, the `aidakit:design` phase deliverables). It is the leash of the structural corpus — the spine of DOCS.md §1 becomes a checkable list.
- **Change** — `.aidakit/tasks/<change-id>/doc-manifest.json` (`level: "change"`, `change_id: "<change-id>"`). Lists the mandatory WORKING artifacts of that change: `proposal`, `tasks`, and the `spec-delta` (when the change touches a capability). It is the per-change leash — no change closes the documentation gate without the artifacts the reviewers need to read.

Both use the **same format** and the **same validator**; what changes is the scope of the list and where the file lives. The single key from §2.7 (change-id = branch = PR suffix = archive directory) extends to the manifest: `<change-id>` in the manifest path is the same one as the change directory.

### (c) The manifest JSON format

This is the real schema that `check-doc-manifest.js` reads (source: `governance/validators/check-doc-manifest.js`):

```json
{
  "change_id": "feature-x",
  "level": "change",
  "required": [
    {
      "doc": "proposal",
      "path": "docs/features/feature-x/proposal.md",
      "status": "resolved",
      "condition": "always",
      "kind": "doc",
      "owner": "@handle"
    },
    {
      "doc": "spec-delta",
      "path": "docs/features/feature-x/specs/appointment/spec.md",
      "status": "pending",
      "condition": "only if the change touches a capability",
      "kind": "doc"
    },
    {
      "doc": "ADR-020",
      "path": "docs/decisions/ADR-020-retry-idempotent.md",
      "status": "n/a",
      "condition": "only if the change locks a new decision",
      "kind": "adr"
    }
  ]
}
```

Fields:

| Field | Where | Meaning |
|---|---|---|
| `change_id` | top | Manifest identity: `"<change-id>"` (change level) or `"PROJECT"` (project level). Echoed in the output JSON. |
| `level` | top | `"change"` or `"project"`. Echoed in the output JSON; does not alter the check itself. |
| `required[]` | top | THE LIST. The validator iterates here. Without this list → exit 2 (usage error). |
| `doc` | item | Human label of the document (`"proposal"`, `"tasks"`, `"ADR-020"`). Appears in the error message. |
| `path` | item | File path, **relative to the project root** (the validator finds the root by walking up until it finds `.aidakit/`, or reads `AIDAKIT_PROJECT_ROOT`). It is what the validator checks on disk. |
| `status` | item | `"pending"` \| `"resolved"` \| `"n/a"`. **`n/a` is skipped** (does not apply to this change). `pending`/`resolved` **require the file to EXIST** — the declared status is not enough, the validator checks the disk (the truth is the file, not the field). |
| `condition` | item | Optional text that explains WHEN the item applies. Purely documentary; it goes into the error message in brackets to give context to whoever resolves it. |
| `kind` | item | `"adr"` \| `"doc"` \| `"index"`. If `kind: "adr"`, the file (besides existing) goes through `check-adr-format` — a mandatory ADR that exists but is malformed **fails the gate**. |
| `owner` | item | Optional owner annotation (who is accountable for the document). The validator does **not** read this field — it is metadata for humans and for the `aidakit:doc-planner`; the check remains just existence on disk (+ ADR format). |

The validator emits JSON on stdout: `{ validator, ok, change_id, level, required, resolved, errors[] }`, where `required` counts the non-`n/a` items and `resolved` counts the ones that passed. Output contract: **exit 0** (100% resolved — gate released), **exit 1** (incomplete — lists what is missing and does not advance), **exit 2** (usage/error: manifest absent, invalid JSON, no `required`).

### (d) The three validators and what each one blocks

All are pure Node, zero-dep, with the same contract (exit 0/1/2, JSON on stdout, markdown report on stderr). Each one blocks a class of failure:

| Validator | Source | What it blocks |
|---|---|---|
| `check-links` | `governance/validators/check-links.js` | **Broken internal link.** Walks the given `.md` files/under the directory and fails if any internal markdown link does not resolve on disk. Fulfills rule §2.4 ("all internal links resolve" is a formal readiness criterion). Ignores externals (`http(s):`, `mailto:`), pure anchors (`#...`), fenced code blocks, and template placeholders (`{{slug}}`, `<change-id>`, `ADR-NNN`, `-slug`). A file can exempt itself with `<!-- check-links: ignore -->`. |
| `check-adr-format` | `governance/validators/check-adr-format.js` | **ADR out of format.** Fails if an ADR does not have the 5 mandatory sections (§2.3: Status+Date · Context · Decision · Consequences · Alternatives considered), if the file name deviates from `ADR-NNN-slug.md`, or if the status falls outside the controlled vocabulary (§2.2: aceita/accepted/proposta/superseded/amends/emenda/deprecated…). Exemption via `<!-- check-adr: ignore -->`. |
| `check-doc-manifest` | `governance/validators/check-doc-manifest.js` | **Mandatory document absent.** It is the leash. Reads the manifest and fails if any non-`n/a` `required` item does not exist on disk; for `kind:"adr"`, it reuses `check-adr-format` on the file. It is the step that **blocks the flow gate** — the engine does not advance until `resolved == required`. |

The three compose: `check-doc-manifest` calls `check-adr-format` internally for ADR items, and `check-links` runs over the change's set of `.md` files to ensure that the documents the manifest requires also have no rotten links.

### (e) Who assembles and who blocks in the flow

- **Assembling the list** is an agent's job (it requires intelligence): the `aidakit:doc-planner` agent reads the diff, the specs, the touched ADRs, and the project's `config.docs`, and **assembles the manifest** — it decides which documents are mandatory for this change, with what `condition` and `kind`, and writes `.aidakit/tasks/<change-id>/doc-manifest.json`. It decides the list; that does not count as "documented" (the truth remains the disk).
- **Blocking the gate** is a command's job (deterministic): the `documentar → check-docs` step in the flow runs `check-doc-manifest.js` over the manifest. Because it is deterministic and routes by exit code, it is a `runs` step (the "command" half of the command-vs-agent separation), not an `invoke`. If the validator exits with exit 0, the gate releases and the flow proceeds; if it exits with exit 1, the flow **does not advance** — it goes back to requiring the missing documents.

The skeleton of the step, in the engine's real grammar (`type: runs`, routing by exit code — 0 → `success`, ≠0 → `failure`):

```yaml
  - id: documentar
    type: invoke
    description: aidakit:doc-planner — assembles/updates the change's doc-manifest (the required list).
    invoca: aidakit:doc-planner
    input:
      request: "${inputs.request}"
    expects:
      - success
      - failure
    on_success: check_docs
    on_failure: abortou

  - id: check_docs
    type: runs
    description: leash GATE — check-doc-manifest blocks the flow until the list is 100%.
    command: node governance/validators/check-doc-manifest.js .aidakit/tasks/${inputs.change_id}/doc-manifest.json
    on_success: <next-step>
    on_failure: documentar
```

The engine has no way to "decide" that the docs are ready — the gate is the exit code of the deterministic validator. It is the same inversion as the command-vs-agent separation: the intelligence assembles the list (`invoke` → `aidakit:doc-planner`), the cheap command checks it (`runs` → `check-docs`), and the flow only passes when the disk confirms. The docs are not lost because there is no path in the flow graph that skips the blocked gate.

<!-- aidakit v0.3 — documentation leash (manifest + 3 validators + check-docs gate) on 2026-07-17 — translated to EN -->
