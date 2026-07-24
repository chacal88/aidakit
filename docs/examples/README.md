# Examples — artifacts of the fictional razor project

> **Scope:** filled-in artifacts of the **razor** example project (a scheduling SaaS for barbershops — NestJS + React + PostgreSQL/Neon + Prisma), used by the [docs/guides/](../guides/getting-started.md) guides. **Anti-scope:** nothing here is a template — the real templates live in the skills linked below, and they are the source of truth.
>
> **Precedence:** if an example diverges from the template/skill it derives from, the other wins and the example is corrected.

**Everything here is fictional.** razor does not exist: it is the kit's canonical example project, so that all the guides tell a single story. The examples' internal paths (`docs/decisions/...`, `docs/design/...`, `apps/api/...`) reflect the razor repo's layout, not this plugin's — which is why some appear as text, not as links.

## The artifacts

| Artifact | What it depicts | Derives from | Used by |
|---|---|---|---|
| [ADR-003-appointment-as-aggregate.md](ADR-003-appointment-as-aggregate.md) | A Phase 3 design ADR: Appointment as a transactional aggregate, with R1 guaranteed by an exclusion constraint in the database — 5 sections, negatives marked Accepted/Mitigated, a review trigger | The [adr.md](../../skills/design-business/templates/adr.md) template of the [aidakit:flow-design](../../commands/flow-design.md) command; format fixed in [DOCS.md §2](../../DOCS.md), rule 3 | [New project flow](../guides/new-project-flow.md) |
| [STATE-razor.md](STATE-razor.md) | razor's `docs/design/STATE.md` frozen MID-Phase 3: phases 1–2 approved with a date, a draft in progress, pending questions, and the Parking Lot | The [STATE.md](../../skills/design-business/templates/STATE.md) template of the [aidakit:flow-design](../../commands/flow-design.md) command | [New project flow](../guides/new-project-flow.md) |
| [proposal-appointment-cancellation.md](proposal-appointment-cancellation.md) | The plan-only `proposal.md` of the change `feature-appointment-cancellation` ("cancel an appointment with a policy: up to 2h beforehand, no penalty"), as the `aidakit:planner` agent would author it | The proposal template documented in [aidakit:spec](../../skills/spec/SKILL.md) | [Per-change flow](../guides/change-flow.md) |

Back to the [master index](../INDEX.md).

<!-- aidakit v0.3 — index of razor's example artifacts, created on 2026-07-17 — translated to EN -->
