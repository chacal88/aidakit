# features/ — index of the aidakit's own change packages

> **Scope:** the WORKING area of the **aidakit itself** — one directory per in-flight change (`<change-id>/` with proposal/design/tasks/evidence), dogfooding the kit's own flow ([DOCS.md §4](../../DOCS.md)). **Anti-scope:** completed changes do not live here — on PR merge the change directory moves to [`../archive/`](../archive) as `YYYY-MM-DD-<change-id>/` (date = UTC merge date of the delivering PR); canonical decisions live in [decisions/](../decisions/README.md).
>
> **Precedence:** this index sequences and points, never duplicates ([DOCS.md §2](../../DOCS.md), rule 1). If it diverges from any change artifact or doctrine, the other wins and this file is corrected.

## How to read this directory

- Each subdirectory is one change package, named by its `change-id` — the single key of [DOCS.md §2](../../DOCS.md), rule 7 (change-id = branch = PR title suffix = archive directory).
- Presence here **is** status: `derive-roadmap-status.js` derives `in-progress` from a directory existing under `docs/features/` and `done` from its dated twin under `docs/archive/`. Nothing is hand-written.
- **Empty is the healthy resting state** — it means no change is in flight. This index stays behind so the directory exists in git even then (a `git mv` to the archive removes the last tracked file, and an empty directory vanishes from fresh checkouts, rotting inbound links).
- **New proposals MUST carry a `## Acceptance criteria` section** (observable-effect promises, `- \`criterion-id\` — prose` or plain `- prose`) in addition to the existing `## Exit criteria` section (validator commands / green-suite gates) — the closest to a proposal template the kit has today. `## Acceptance criteria` is what the goal-leash (`aidakit:acceptance-planner` + `check-acceptance.js`) maps to evidence in the `fast` flow (see [ADR-010](../decisions/ADR-010-acceptance-leash.md)). Existing archived/in-flight proposals predate this and are grandfathered — no retrofit required.

## In flight now

Derived from disk — list the subdirectories, or run `node governance/validators/derive-roadmap-status.js --root .` for the full Now/Next/Later view (rendered in [../roadmap/ROADMAP.md](../roadmap/ROADMAP.md)).

<!-- aidakit v0.6 — index of the kit's own WORKING area, created on 2026-07-24 -->
