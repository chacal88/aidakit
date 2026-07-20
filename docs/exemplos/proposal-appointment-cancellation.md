# Filled-in proposal example — change `feature-appointment-cancellation` (razor)

> Example `proposal.md` for the **razor** example project, authored by the `aidakit:planner` agent following the template documented in [aidakit:spec](../../skills/spec/SKILL.md). In the real repo it would live at `docs/features/feature-appointment-cancellation/proposal.md` (WORKING life — [DOCS.md](../../DOCS.md) §4); the ADR paths below appear as text because they point to the razor repo, not this one — in the real repo they would be relative links with the ID visible (DOCS.md §2, rule 4). This change's full cycle is narrated in [change-flow.md](../guides/change-flow.md). **If this example diverges from the [aidakit:spec](../../skills/spec/SKILL.md) template, the template wins and this file is corrected.**

---

# Proposal: Appointment cancellation with a 2h policy

**Change ID:** `feature-appointment-cancellation`
**Date:** `2026-07-16`
**Owner:** `@kauemsc`
**Phase / Package:** `Phase 4 of the design — change backlog (change 2)`
**PRD:** `n/a`
**Tech Spec:** `n/a`

---

## Why

Today the Appointment aggregate only knows the PENDING → CONFIRMED transitions (`apps/api/src/appointment/appointment.aggregate.ts:41`) — there is no exit path. When a client backs out, the receptionist has no way to cancel through the system: the slot stays occupied and the R1 invariant ("a professional never has two overlapping appointments") blocks any new appointment in that slot. The current workaround is to delete the row in the database by hand, outside the aggregate.

**Context:** a client who can't make it notifies the barbershop (phone/WhatsApp); the receptionist needs to free the professional's slot.
**Impact:** without cancellation, the slot stays blocked by R1 until the time passes — the professional loses the chance to rebook and the barbershop loses the slot's revenue; the manual database workaround breaks the audit trail and bypasses the aggregate.

## What Changes

- `apps/api/src/appointment/appointment.aggregate.ts` — a `cancel()` method on the Appointment aggregate: allowed up to 2h before the start of the ServiceWindow; below that it throws the domain error `CancellationOutsideWindow`; the CONFIRMED → CANCELLED transition records the `AppointmentCancelled` event.
- `apps/api/src/appointment/appointment.service.ts` — the cancellation use case: loads the aggregate, executes `cancel()`, persists, and writes `AppointmentCancelled` to the outbox **in the same transaction** (ADR-004).
- `apps/api/src/appointment/appointment.controller.ts` — the `POST /appointments/:id/cancellation` endpoint; the domain error becomes HTTP 422.
- `apps/api/prisma/schema.prisma` + migration — the `CANCELLED` status in the enum and a `cancelledAt` field.

## Goals / Non-Goals

**Goals:**
- A client cancels a confirmed appointment up to 2h in advance, with no penalty.
- The cancellation frees the professional's window: the slot accepts an appointment again (R1).
- The Notification context learns of it via the `AppointmentCancelled` event through the outbox — no synchronous call between contexts.

**Non-Goals:**
- **Late-cancellation penalty** — depends on the Billing context, out of the MVP; in this change, a cancellation under 2h is simply refused.
- **Cancellation UI on the web** (`apps/web`) — a following change in the backlog; this change delivers only the API.
- **Cancellation by the professional or the barbershop** — only the client-initiated flow in this change.
- **Notification content/sending** — the responsibility of the Notification context; this change stops at the outbox.

## Alternatives Considered

- **Soft delete of the appointment (a `deleted` flag):** rejected because it loses the transition history (who cancelled, when) and bypasses the aggregate — it contradicts ADR-003 (every state transition of the Appointment goes through the aggregate, which is what protects R1).
- **Notify the professional with a synchronous call in the cancellation request:** rejected by ADR-004 — notification is asynchronous via the outbox; a notification-provider failure cannot take down the cancellation.

## Success Criteria

- [ ] A cancellation ≥2h in advance changes the status to CANCELLED and frees the window: a new appointment at the same time for the same professional starts being accepted (R1 integration test).
- [ ] A cancellation under 2h is refused with `CancellationOutsideWindow` (HTTP 422 on the endpoint) and the appointment stays CONFIRMED.
- [ ] `AppointmentCancelled` is written to the outbox in the same transaction as the cancellation; if the write fails, the whole transaction rolls back (Postgres integration test).
- [ ] Coverage of the `apps/api/src/appointment/` module ≥85% (critical path, aidakit:test tiers).

## Open Questions

- [ ] Is the 2h window configurable per barbershop? — **Deferred with reason:** the MVP uses a fixed 2h for all; per-barbershop configuration enters a future change of the Registration context. It does not block this implementation.

## Dependencies

- `docs/decisions/ADR-003-appointment-as-aggregate.md` — every state transition goes through the Appointment aggregate; it is the one that protects R1.
- `docs/decisions/ADR-004-notification-async-outbox.md` — events for the Notification context leave through the outbox, in the use case's transaction.
- `docs/archive/2026-07-15-feature-appointment-confirmation/` — the archived change that created the aggregate, the status enum, and the `AppointmentConfirmed` event, on which this change relies.
- `docs/specs/appointment/spec.md` — the canonical spec of the Appointment capability that this change modifies (this change's delta lives in `specs/appointment/spec.md` and only merges into the canonical one at the human promotion gate — DOCS.md §4).

## Effort Estimate

| Phase | Hours | Notes |
|------|-------|-------|
| Design / planning | 2 | this proposal + design.md |
| Implementation | 5 | aggregate, service, endpoint, migration + unit tests (TDD) |
| Integration tests | 2 | local Postgres (Prisma): R1 on the freed slot and outbox atomicity |
| Documentation | 1 | spec delta of the appointment capability |
| **Total** | **10** | |

<!-- aidakit v0.3 — canonical proposal example (razor project), created on 2026-07-17 — translated to EN -->
