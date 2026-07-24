# Decisions (ADRs) — authoritative index

> **Scope:** the architectural decisions of the **aidakit itself** (the plugin) — the what and the why, with rejected alternatives. **Anti-scope:** the HOW (that lives in [guides](../guides/)), and decisions of projects that *use* the kit (those live in each project's own `docs/decisions/`).
>
> **Precedence:** this index sequences and points; it does not duplicate. If it diverges from an ADR file, the ADR wins and this index is corrected.

## Format rules (from [DOCS.md](../../DOCS.md) §2)

- **WORM:** an ADR is never edited after acceptance. Changed your mind → a **new** ADR that *supersedes* (`Accepted (§X superseded by ADR-NNN)`) or *amends* it (the amended one gains an `## Amendments` section pointing back — bidirectional link).
- **Five sections:** Status+Date · Context · Decision · Consequences (each negative marked *Accepted*/*Mitigated*) · Alternatives considered.
- **Naming:** `ADR-NNN-slug.md`, global sequential numbering, never recycled.
- Validated by `check-adr-format` (`governance/validators/check-adr-format.js`).

## Index

| ID | Title | Status | Date |
|---|---|---|---|
| [ADR-001](ADR-001-executable-dna-crystallization.md) | Crystallize recurring learnings into executable DNA, promoted via a dedicated PR | accepted | 2026-07-20 |
| [ADR-002](ADR-002-roadmap-status-derived-from-disk.md) | The in-repo roadmap derives every status from the disk, with no external tool | accepted | 2026-07-20 |
| [ADR-003](ADR-003-shared-knowledge-in-docs.md) | Durable shared knowledge lives in docs/knowledge/, promoted from the operational memory by PR | accepted | 2026-07-20 |
| [ADR-004](ADR-004-aidakit-governance-env-contract.md) | `AIDAKIT_GOVERNANCE` — the env var flows use to call kit validators independent of cwd | accepted | 2026-07-23 |
| [ADR-005](ADR-005-command-namespacing.md) | Command namespacing — the `flow` group prefix, locked syntax, and the mechanical grouping rule | accepted | 2026-07-24 |
| [ADR-006](ADR-006-flow-values-as-data.md) | Flow values are data — env-passed `runs` interpolation and structured invoke outputs | accepted | 2026-07-24 |

## Thematic grouping

- **Learning & memory:** [ADR-001](ADR-001-executable-dna-crystallization.md) — executable DNA crystallization; [ADR-003](ADR-003-shared-knowledge-in-docs.md) — durable knowledge in docs/knowledge/.
- **Planning & tracking:** [ADR-002](ADR-002-roadmap-status-derived-from-disk.md) — roadmap with status derived from disk.
- **Flow engine:** [ADR-004](ADR-004-aidakit-governance-env-contract.md) — `AIDAKIT_GOVERNANCE` env contract for validator resolution independent of cwd; [ADR-006](ADR-006-flow-values-as-data.md) — flow values are data (env-passed `runs` interpolation + structured invoke outputs).
- **Command surface:** [ADR-005](ADR-005-command-namespacing.md) — `flow` group prefix, mechanical grouping rule, and the locked `flow-<name>` naming syntax.

<!-- The DISCOVERY index (DECISION_INDEX.md, with decision trees and tours by role) is created once this repo reaches ≥15 ADRs (DOCS.md §1). -->
