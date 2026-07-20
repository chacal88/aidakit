<!--
  Filled-in example of the aidakit:design template (skills/design/templates/adr.md)
  for the razor project. In the real project this file lives at
  docs/decisions/ADR-003-appointment-as-aggregate.md and is registered in the index
  docs/decisions/README.md. Guide that uses this example: docs/guides/new-project-flow.md.
-->
<!-- File: docs/decisions/ADR-003-appointment-as-aggregate.md — global sequential numbering, never recycled. Register it in the index docs/decisions/README.md. -->
<!-- An ADR is WORM: never edit a past decision. Changed your mind → a new ADR that supersedes or amends this one. -->

# ADR-003: Appointment as a transactional consistency aggregate

- **Status:** accepted
- **Date:** 2026-07-10
- **Design phase:** 3-Architecture

## Context

The **R1** invariant from the business vision — "a professional never has two overlapping appointments" — must be true IMMEDIATELY: the Phase 2 model defined the **Appointment** aggregate (root: Appointment; members: the Period VO and the references to Professional and Client) precisely to protect that rule, and the boundary test concluded that it cannot become true "shortly after". In the architecture, what remains is to decide WHERE the invariant is guaranteed when two requests contend for the same professional's slot: only in the application, in the database, or between services.

## Decision

The Appointment aggregate is the transactional unit of the Appointment context: confirming, rescheduling, and cancelling execute in a single PostgreSQL transaction, and R1 is guaranteed in the database by an exclusion constraint (`EXCLUDE USING gist`) over the period (`tstzrange`) per professional.

## Consequences

- Positive: R1 impossible to violate even under concurrent requests; the transactional boundary maps 1:1 to the Phase 2 aggregate boundary; no distributed coordination.
- Negative:
  - Concurrent writes to the same professional's agenda serialize on the constraint — **Accepted** (the estimated volume is dozens of appointments/day per barbershop; see the review trigger).
  - The final guarantee of the invariant is coupled to a specific PostgreSQL feature — **Mitigated** (the rule is also validated in the domain, with the database as the last line of defense; switching databases would already require superseding ADR-002).

### Review trigger

A conflict-failure rate on confirmation above 1% of transactions in a month, or the entry of batch/recurring scheduling on the roadmap.

## Alternatives considered

| Option | Pros | Cons | Cost to undo |
|---|---|---|---|
| Validate the overlap only in the application (query before writing) | Simple and portable | A race condition between read and write violates R1 under concurrency | low |
| A "ProfessionalAgenda" aggregate encompassing all of the professional's appointments | The invariant inside a single aggregate by construction | A giant aggregate: loading and contention grow with the whole agenda | high |
| Eventual consistency + compensation (cancel the second appointment afterward) | Scales writes | The client would see a confirmed slot and then have it undone — unacceptable for the business | medium |
