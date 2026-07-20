<!-- check-links: ignore -->
<!--
  Filled-in example of the aidakit:design template (skills/design-business/templates/STATE.md),
  depicting the razor project MID-PHASE 3. In the real project this file lives at
  docs/design/STATE.md — the relative links below reflect the razor repo's layout
  and do not resolve from aidakit's docs/exemplos/ (hence the check-links: ignore above).
  Guide that uses this example: docs/guides/new-project-flow.md.
-->

# Design State — razor

> A scheduling SaaS for barbershops: an agenda per professional with no overlap, registration of barbershops/professionals/clients, and automatic reminders. Billing out of the MVP.
> Design started on: 2026-07-01

## Current phase

**Phase 3 — Architecture** · situation: deliverable draft

Exact stopping point: axes 1 (APIs) and 2 (events) covered; ADR-003 and ADR-004 written and registered in the index `docs/decisions/README.md`; axis 3 (integrations) started — the reminders integration and all of axis 4 (data) and 5 (cross-cutting) remain to be closed.

Next pending questions:
1. WhatsApp reminder (parked since Phase 1): what API contract, what real reliability, does it need an anticorruption layer?
2. Honest volume: how many barbershops, professionals, and appointments/day in the first year?
3. Auth: the front desk schedules on behalf of the professional — who can do what, in which context?

## Progress

| Phase | Deliverable | Situation | Approved on |
|---|---|---|---|
| 1 Business | [1-business-vision.md](1-business-vision.md) | approved | 2026-07-03 |
| 2 DDD Modeling | [2-domain-model.md](2-domain-model.md) | approved | 2026-07-08 |
| 3 Architecture | [3-architecture.md](3-architecture.md) + [ADRs](../decisions/) | draft in progress | — |
| 4 Implementation | [4-implementation-plan.md](4-implementation-plan.md) | — | — |

## Key decisions (executive summary)

> Authoritative decisions index: [../decisions/README.md](../decisions/README.md). If this list diverges from there, the index wins and this list is corrected.

- Modular monolith: one NestJS module per bounded context (Appointment, Registration, Notification) — [ADR-001](../decisions/ADR-001-modular-monolith.md)
- PostgreSQL (Neon) with Prisma, one schema per context — [ADR-002](../decisions/ADR-002-postgres-neon-prisma.md)
- Appointment is the transactional aggregate; the R1 invariant guaranteed by an exclusion constraint in the database — [ADR-003](../decisions/ADR-003-appointment-as-aggregate.md)
- Notification consumes events via outbox + polling; a broker only with a measurable trigger — [ADR-004](../decisions/ADR-004-notification-async-outbox.md)

## Parking lot

Matters raised outside the phase in which they came up — resume them in the right phase:

- WhatsApp reminder (came up in Phase 1, when talking about no-shows) → handle in Phase 3, the Integrations axis — pending
- Charging the cancellation penalty via a payment gateway (came up in Phase 1) → Billing is out of the MVP; reassess after the first delivery

## Execution (after Phase 4)

| Change | Situation | Notes |
|---|---|---|
| — | — | — |
