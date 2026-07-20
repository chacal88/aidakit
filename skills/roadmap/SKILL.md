---
name: roadmap
description: The project roadmap kept IN the repo, no external tool (no Jira/Confluence). You DESCRIBE a feature or project, the kit INTERVIEWS you to resolve the doubts, and it GENERATES the epic → features → changes for you (the `from` mode) — you don't hand-write it. Epics → features → changes are versioned markdown where each item's STATUS is DERIVED from the disk (never hand-written): a change in docs/features/ is in-progress, an open PR is in-review, the archive is done. Use when the user wants to create an epic/feature/roadmap from a description, plan new work, see the project status ("what's in progress?", "what's the roadmap?", "backlog?"), or asks about epics, features, or the backlog. The status is reality on disk, not a card someone forgot to move.
---

# aidakit:roadmap — the roadmap that never lies

> The project's planning kept in the repo: **epics group features, features point to changes** (by the single key `change-id`, §2.7). The status of every item is **derived from the disk** by `derive-roadmap-status.js` — it is not a field anyone edits, so it cannot drift from reality the way a Jira board does.

Precedence: if it diverges from [DOCS.md](../../DOCS.md) / [PROCESS.md](../../PROCESS.md), the doctrine wins.

## When to use (and when not)

- **Use** `from` to **create an epic from a description** — the main path: describe a feature or project, get interviewed, get the epic → features → changes generated. This is the answer to "how do I create an epic/tasks?".
- **Use** `status` to see the project state ("what's in progress?", "what's the roadmap?", "backlog?"), or `regen` to rewrite the `ROADMAP.md` view.
- **Don't use** it to change a status by hand — there is no hand-written status. To move an item, do the real work (author the change, open the PR, archive it); the status follows.
- **Don't use** it to author a change's plan/tasks — that is `aidakit:plan`, run per change when you execute it. The roadmap declares *what and in what order*; plan produces the *how*.
- **Don't use** it to author a change's plan — that is `aidakit:plan`. The roadmap only groups and points; the change artifacts live in `docs/features/<change-id>/`.

## The model (versioned files, single key)

```
docs/roadmap/
├── README.md              # index: lists the epics, declares scope/precedence
├── ROADMAP.md             # the Now/Next/Later view — GENERATED, never hand-edited
└── epics/
    └── EPIC-<slug>.md      # one epic: goal + the features that compose it
```

An **epic** declares its **features**; each feature lists the **changes** that deliver it, by `change-id`:

```markdown
# Payments system

Goal: let customers pay online.

- **Feature:** Checkout — changes: feature-cart, feature-checkout-ui
- **Feature:** Refunds — changes: feature-refund
```

The `change-id` is the single key (§2.7): the same id names the branch, the PR suffix, the `docs/features/<id>/` dir, and the archive dir. The roadmap **reuses** it — it never invents parallel IDs.

## How status is derived (never written)

`derive-roadmap-status.js` reads the disk for each `change-id`, strongest evidence first:

| Evidence on disk | Derived status |
|---|---|
| In `docs/archive/<date>-<id>/` (or `openspec/changes/archive/<id>/`) | **done** |
| An open PR whose branch carries the id (via `gh`, best-effort) | **in-review** |
| `docs/features/<id>/` (or `openspec/changes/<id>/`) exists | **in-progress** |
| A branch carries the id but no artifacts yet | **planned** |
| Declared but nothing on disk | **backlog** |

Epics and features **aggregate** their children: all changes done → done; any blocked → blocked; any in-progress/in-review → in-progress; else the strongest present. Git is only a heuristic for PR/branch — with no git, the tool degrades to disk-only (features/ vs archive/) and never errors.

## Process (modes)

Identify the mode from the request:

### `status` mode (default) — show the derived roadmap
Run the deriver and present the Now/Next/Later view:
```
node governance/validators/derive-roadmap-status.js --root <project-root>
```
- stdout is the JSON (`epics[]` with derived statuses, `orphans[]`); stderr is the human view.
- Present: **Now** (in-progress/in-review), **Next** (planned), **Later** (backlog), **Done** (done). Flag `orphans` — declared change-ids with nothing on disk yet (pure intent).

### `from` mode — describe it, get the epic generated (the main path)

**This is how you create an epic.** You do not hand-write the file — you **describe** a feature or a project, the kit **interviews** you to resolve the doubts, and it **generates** the epic → features → changes for you. Hand-authoring (below) is the low-level escape hatch, not the normal path.

Given a free-form description (`aidakit:roadmap from "online payments: checkout, refunds, subscriptions"` — or a whole project):

1. **Classify** — dispatch [aidakit:identify-domain](../identify-domain/SKILL.md) on the description to get domain × type × flags. This selects the interview's ammunition and calibrates its depth.
2. **Interview to resolve the doubts** — dispatch [aidakit:brainstorm](../brainstorm/SKILL.md) (the adversarial grill, in isolated context). It attacks the 4 axes against the project's law: *scope* (what's in/out?), *end effect* (observable "done"), *edges* (empty/error/concurrency/volume), *collision with the law* (an ADR or inviolable rule this touches?). **Calibrate by size**: a single feature → a few sharp questions; a whole project → deeper, and expect **multiple epics**. The owner can opt out ("skip the brainstorm") — then generate from the description as given, marking the open assumptions.
3. **Decompose into vertical changes** — reuse the Phase-4 decomposition (see [aidakit:design-implementation](../design-implementation/SKILL.md)): break the feature into **vertical changes** ordered by risk + value, each cutting UI → API → domain → data end-to-end, each with an observable acceptance criterion. Group the changes under features; group features under the epic. Mint a `change-id` per change (kebab-case, the single key §2.7 — it will name the branch/PR/dir later).
4. **Propose, then write** — show the owner the proposed epic (title, features, the ordered changes with their change-ids and one-line acceptance criteria) as a **short summary**, not the whole file. On approval, write `docs/roadmap/epics/EPIC-<slug>.md` (H1 = goal, `## Features` with the `- **Feature:** <name> — changes: <ids>` lines) and register it in `docs/roadmap/README.md`. A whole-project run writes **one file per epic**.

The generated changes are **declared, not started** — they show as `backlog` on the roadmap until you run `/aidakit:plan <change-id>` to author each one (which flips it to in-progress). The epic captures the *what and the order*; `aidakit:plan` captures the *how* of each change, when you get to it.

Relationship with `/aidakit:design`: for a **brand-new project**, the 4-phase `aidakit:design` is the deeper front door — its Phase 4 already interviews and produces the ordered backlog. When design runs, it emits that backlog **as epics into `docs/roadmap/`** (same generator as this mode). Use `from` directly for a **new feature on an existing project**, where the full 4-phase design would be overkill.

### `add-epic` / `add-feature` modes — hand-authoring (escape hatch)
For when you already know the exact breakdown and just want to write it: create `docs/roadmap/epics/EPIC-<slug>.md` by hand (H1 title, one-line goal, and the `- **Feature:** <name> — changes: <ids>` lines), or add a single feature line to an existing epic. Register a new epic in `docs/roadmap/README.md`. Prefer `from` — it resolves the doubts you didn't know you had. This mode skips the interview.

### `regen` mode — rewrite ROADMAP.md
Run the deriver and write its view into `docs/roadmap/ROADMAP.md`, with a header: `> Generated by aidakit:roadmap — do not edit by hand; re-run to refresh.` It is a snapshot of a live source (DOCS.md §5: manual snapshots die — this one is regenerated, not maintained).

## Integration with the cycle

- **Priority input for the orchestrator.** `aidakit:orchestrator` picks the next ready change; the roadmap gives it the intended ORDER — the next `backlog`/`planned` change under the highest-priority epic whose dependencies are shipped. The roadmap becomes an input to prioritization, not just a report.
- **The change-id ties it together.** When `aidakit:plan` creates `docs/features/<change-id>/`, that change automatically flips from `backlog` to `in-progress` on the roadmap — no one updates a status.

## Outputs

- `docs/roadmap/epics/EPIC-<slug>.md` — the declared intent (epics/features/change-ids).
- `docs/roadmap/ROADMAP.md` — the generated Now/Next/Later view.
- The derived status JSON (for the orchestrator or a CI check).

## Gates and guardrails

- **Status is derived, never written** — the inviolable principle. If it's wrong, the disk is wrong (a missing archive, an unlinked PR), not a field.
- **Propose before creating** an epic/feature — planning intent is a human decision.
- **Single key only** — reuse `change-id`; never mint a parallel roadmap ID.
- **ROADMAP.md is generated** — never hand-edit it; re-run `regen`.

## Related

- [aidakit:identify-domain](../identify-domain/SKILL.md) — classifies the description in `from` mode (selects the interview ammunition).
- [aidakit:brainstorm](../brainstorm/SKILL.md) — the adversarial interview `from` dispatches to resolve the doubts before generating.
- [aidakit:design-implementation](../design-implementation/SKILL.md) — Phase 4's vertical-change decomposition, reused by `from`; the 4-phase design emits its backlog as epics here.
- [aidakit:plan](../plan/SKILL.md) — authors the change a roadmap feature points to (flips it to in-progress).
- [aidakit:orchestrator](../../agents/orchestrator.md) — reads the roadmap for priority order.
- [aidakit:docs](../docs/SKILL.md) — archives a completed change (flips it to done).
- [derive-roadmap-status.js](../../governance/validators/derive-roadmap-status.js) — the deriver; [roadmap.js](../../governance/roadmap/roadmap.js) — parse + derivation.

<!-- aidakit v0.4 — roadmap in-repo (epics→features→changes) with status derived from disk, no external tool on 2026-07-20 -->
<!-- aidakit v0.4 — `from` mode: describe → interview (identify-domain + brainstorm) → decompose → generate the epic; hand-authoring demoted to escape hatch on 2026-07-20 -->
