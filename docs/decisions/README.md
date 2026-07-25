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
| [ADR-007](ADR-007-roadmap-status-from-shared-git.md) | The roadmap derives status from the shared git state, so it is single-valued across worktrees (amends ADR-002) | accepted | 2026-07-24 |
| [ADR-008](ADR-008-opt-in-autonomous-pr-merge.md) | Autonomous PR merge, opt-in per project — scoped supersession of GOVERNANCE.md §1 rule 1 | accepted | 2026-07-24 |
| [ADR-009](ADR-009-flow-commits-plan-early.md) | The full flow commits the plan when it is authored, so in-progress derives from shared git (completes ADR-007) | accepted | 2026-07-24 |
| [ADR-010](ADR-010-acceptance-leash.md) | The acceptance-leash mirrors the doc-leash — separate agent, weak-bar validator, both flows, max_visits from day one | accepted | 2026-07-24 |
| [ADR-011](ADR-011-runs-infra-error-routing.md) | The `runs` step separates infra errors from validator verdicts, and infra always bypasses `on_failure` | accepted | 2026-07-24 |
| [ADR-012](ADR-012-aidakit-governance-session-wide.md) | `AIDAKIT_GOVERNANCE` becomes session-wide via a `SessionStart` hook (amends ADR-004) | accepted | 2026-07-24 |
| [ADR-013](ADR-013-context-pack-per-change.md) | The context pack is a first-class per-change artifact — deterministic, hash-invalidated, injected as a stable prefix | proposed | 2026-07-24 |
| [ADR-014](ADR-014-archive-aware-link-resolution.md) | `check-links` resolves archived change packages via the single key, instead of rewriting the documents that cite them | accepted | 2026-07-24 |

## Thematic grouping

- **Learning & memory:** [ADR-001](ADR-001-executable-dna-crystallization.md) — executable DNA crystallization; [ADR-003](ADR-003-shared-knowledge-in-docs.md) — durable knowledge in docs/knowledge/.
- **Planning & tracking:** [ADR-002](ADR-002-roadmap-status-derived-from-disk.md) — roadmap with status derived from disk; [ADR-007](ADR-007-roadmap-status-from-shared-git.md) — amends it to derive from the shared git state (single-valued across worktrees); [ADR-009](ADR-009-flow-commits-plan-early.md) — completes it by committing the plan early so the shared signal is populated.
- **Flow engine:** [ADR-004](ADR-004-aidakit-governance-env-contract.md) — `AIDAKIT_GOVERNANCE` env contract for validator resolution independent of cwd; [ADR-006](ADR-006-flow-values-as-data.md) — flow values are data (env-passed `runs` interpolation + structured invoke outputs); [ADR-009](ADR-009-flow-commits-plan-early.md) — the `full` flow's `commit_plan` step commits the authored plan; [ADR-010](ADR-010-acceptance-leash.md) — the acceptance-leash mirrors the doc-leash (separate agent + weak-bar validator + both flows + `max_visits` from day one); [ADR-011](ADR-011-runs-infra-error-routing.md) — infra errors on a `runs` step are a first-class outcome kind that always bypasses `on_failure`; [ADR-012](ADR-012-aidakit-governance-session-wide.md) — amends ADR-004 to broaden `AIDAKIT_GOVERNANCE` from `runs`-child-only to session-wide via a `SessionStart` hook, closing the direct-invocation vector (agents/skills/commands).
- **Command surface:** [ADR-005](ADR-005-command-namespacing.md) — `flow` group prefix, mechanical grouping rule, and the locked `flow-<name>` naming syntax.
- **Delivery & shipping governance:** [ADR-008](ADR-008-opt-in-autonomous-pr-merge.md) — autonomous PR merge, opt-in per project, as a scoped supersession of GOVERNANCE.md §1 rule 1.
- **Documentation mechanics:** [ADR-014](ADR-014-archive-aware-link-resolution.md) — `check-links` resolves a citation of `docs/features/<change-id>/` against the dated archive via the DOCS.md §2 rule 7 single key, so the §4 promotion of a shipped change stops rotting inbound links in documents that rule §2 rule 2 forbids editing (WORM); the fallback is strict (exact date-prefix match, ambiguity reported, target must exist) so a real typo still fails, and `docs/decisions/` is deliberately NOT blanket-skipped.
- **Context caching:** [ADR-013](ADR-013-context-pack-per-change.md) — the context pack as a first-class per-change artifact (L1 of the caching epic), byte-stable and source-scoped invalidated, injected as a stable prefix at every dispatcher/reviewer, with a freshness validator kept separate from the doc-manifest.

<!-- The DISCOVERY index (DECISION_INDEX.md, with decision trees and tours by role) is created once this repo reaches ≥15 ADRs (DOCS.md §1). -->
