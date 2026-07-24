# Roadmap and shared knowledge — tracking the project without Jira

> Narrative guide to the two in-repo layers that replace an external tracker and wiki: the **roadmap** (epics → features → changes, status derived from disk) and **shared knowledge** (`docs/knowledge/`, promoted from the learn memory). This guide **narrates and exemplifies** — the decisions are fixed in [ADR-002](../decisions/ADR-002-roadmap-status-derived-from-disk.md) and [ADR-003](../decisions/ADR-003-shared-knowledge-in-docs.md); the behavior lives in [aidakit:roadmap](../../skills/roadmap/SKILL.md) and [aidakit:learn](../../skills/learn/SKILL.md). **If this guide diverges from the linked ADR/skill, the other wins and this file is corrected.**

## Why in the repo

The premise: **no Jira, no Confluence** — the roadmap and the shared knowledge live in the repo, versioned and reviewed in PRs like the code. The risk with any board is drift (the card says "in progress" while the code shipped weeks ago). The kit sidesteps it the same way the doc leash does: **the truth is the disk**. Nobody writes a status; it is derived.

## Part 1 — The roadmap

### The shape

```
docs/roadmap/
├── README.md              # index
├── ROADMAP.md             # the Now/Next/Later view — GENERATED, never hand-edited
└── epics/
    └── EPIC-<slug>.md      # goal + the features that compose it
```

An epic declares its features; each feature points to the **changes** that deliver it, by `change-id` — the single key the kit already uses (branch = PR = `docs/features/<id>/` = archive dir). Example, in razor's `EPIC-payments.md`:

```markdown
# Payments system

Goal: let customers pay online.

- **Feature:** Checkout — changes: feature-cart, feature-checkout-ui
- **Feature:** Refunds — changes: feature-refund
```

### Status you never write

You don't set a status anywhere. `aidakit:roadmap` runs the deriver, which reads the disk for each change-id:

| What's on disk | Status |
|---|---|
| `docs/archive/<date>-<id>/` | **done** |
| an open PR for the id | **in-review** |
| `docs/features/<id>/` exists | **in-progress** |
| a branch, no artifacts yet | **planned** |
| declared, nothing on disk | **backlog** |

Epics and features aggregate their changes. So when `aidakit:plan` creates `docs/features/feature-cart/`, the roadmap flips `feature-cart` from backlog to in-progress on its own — nobody moves a card. When the change is archived, it flips to done. **The roadmap cannot lie**, because there is no field to forget.

### Creating an epic — you describe it, the kit generates it

You do **not** hand-write an epic. You describe a feature or a project; the kit interviews you to resolve the doubts and generates the whole thing:

```
aidakit:roadmap from "online payments: checkout, refunds, subscriptions"
```

What happens:
1. **Classify** — `aidakit:identify-domain` reads the description (domain × type × flags), which tunes the interview.
2. **Interview** — `aidakit:brainstorm` grills you on the four axes (scope / observable "done" / edges / collision with an ADR), calibrated to size: a feature gets a few sharp questions, a whole project goes deeper and yields **multiple epics**. It surfaces the doubt you didn't know you had. (Opt out with "skip the brainstorm" and it generates from the description as given.)
3. **Decompose** — it breaks the feature into **vertical changes** (each cutting UI → API → domain → data), ordered by risk + value, each with an acceptance criterion, grouped into features and the epic. Each change gets a `change-id`.
4. **Propose, then write** — it shows you the proposed epic (features + ordered changes + criteria) as a short summary; on your approval it writes `docs/roadmap/epics/EPIC-<slug>.md`.

The generated changes start as **backlog** — declared, not started. You run `/aidakit:plan <change-id>` to author each one when you get to it (which flips it to in-progress). For a **brand-new project**, `/aidakit:flow-design` is the deeper front door: its Phase 4 already interviews and emits the backlog as epics here — same generator.

### The other commands

- **`aidakit:roadmap`** (status) — shows the Now/Next/Later view derived from disk.
- **`aidakit:roadmap regen`** — rewrites `ROADMAP.md` from the current reality.
- **`add-epic` / `add-feature`** — the hand-authoring escape hatch, for when you already know the exact breakdown and want to skip the interview. Prefer `from`.
- The **`aidakit:orchestrator`** reads the roadmap to know the *order*: the next ready change under the highest-priority epic whose dependencies shipped. The roadmap orders the ready set; it never overrides the readiness checks.

## Part 2 — Shared knowledge (`docs/knowledge/`)

### The home, and the boundary

```
docs/knowledge/
├── README.md          # index: scope = knowledge that is neither decision nor how-to
├── conventions.md     # the "way we do it here"
├── glossary.md        # the ubiquitous language
├── gotchas.md         # known traps: "careful with X because Y"
└── context.md         # business/domain context a new dev needs
```

The boundary is explicit (DOCS.md §3): a **decision with alternatives → ADR**; a **how-to → guide**; only what is *neither* goes to knowledge/. This keeps each kind of content in exactly one place.

### How it fills — the funnel

`aidakit:learn` records operational learnings in `.aidakit/memory/learnings.md` (one line each, read by the next build). That's the kit feeding itself — not a document a human browses. When a learning is **durable knowledge** (a convention the team settled on, a recurring gotcha), learn **proposes** promoting it into the right `docs/knowledge/` file, as a diff in `proposed-updates.md`. The human reviews and applies it in a PR.

```
.aidakit/memory/learnings.md   →  (learn proposes)  →  docs/knowledge/*.md
   operational (WORKING)                                 durable, shared (DURABLE)
```

Nothing is written into `docs/knowledge/` directly — the PR is the proposal, the same principle as ADRs, DNA, and doc updates. The operational log stays small; the shared knowledge stays curated.

## How the two connect

The roadmap tracks *what is being built*; knowledge captures *what we learned building it*. They meet at the change: a change is planned under a roadmap feature, executed, and at the end `aidakit:learn` proposes both — a **regression-gate/DNA** for a recurring bug, and a **knowledge** entry for a durable convention. The change ships, the roadmap flips it to done, and the next developer inherits both the updated roadmap and the curated knowledge — with no external tool in the loop.

## Related

- [ADR-002](../decisions/ADR-002-roadmap-status-derived-from-disk.md) — roadmap status derived from disk.
- [ADR-003](../decisions/ADR-003-shared-knowledge-in-docs.md) — shared knowledge in docs/knowledge/.
- [aidakit:roadmap](../../skills/roadmap/SKILL.md) — the roadmap skill.
- [aidakit:learn](../../skills/learn/SKILL.md) §7 — the promotion to docs/knowledge/.
- [Executable DNA](executable-dna.md) — the other thing learn proposes at the end of a change.

<!-- aidakit v0.4 — roadmap + shared knowledge guide (in-repo tracking, no Jira/Confluence) on 2026-07-20 -->
