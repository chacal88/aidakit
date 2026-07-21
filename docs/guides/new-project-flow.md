# New project flow — from zero to the first change

> **Precedence:** this guide narrates the process; the law is in the skill and the doctrine. If this guide diverges from [aidakit:design](../../commands/design.md), [DOCS.md](../../DOCS.md), [GOVERNANCE.md](../../GOVERNANCE.md), or [PROCESS.md](../../PROCESS.md), the other wins and this file is corrected.

This guide follows the birth of **razor** — a scheduling SaaS for barbershops (NestJS + React + PostgreSQL/Neon + Prisma) — through the kit's architecture design: `/aidakit:design`, 4 sequential phases with gates, one interview per phase, one approved document per phase. Golden rule: **the domain drives the decisions; technology materializes them**. The guide ends where the [change execution flow](change-flow.md) begins.

## Before Phase 1 — the `docs/` structure is born first

On the first run in a project, the design requires the standard document structure before any deliverable ([aidakit:design › Prerequisites](../../commands/design.md)). It runs [aidakit:docs](../../skills/docs/SKILL.md) in **init** mode, which creates only what's missing, without overwriting anything (canonical structure: [DOCS.md §1](../../DOCS.md)):

```
razor/
└── docs/
    ├── INDEX.md               # master index
    ├── design/                # deliverables of the 4 phases + STATE.md
    ├── decisions/README.md    # AUTHORITATIVE index of the ADRs
    ├── architecture/
    ├── features/              # per-change WORKING artifacts (Phase 4 onward)
    ├── specs/
    ├── guides/
    └── archive/
```

The design then creates `docs/design/STATE.md` by copying the [real template](../../skills/design-business/templates/STATE.md), asks for the name and one sentence about the project, fills in the header, and starts Phase 1. `STATE.md` is the single source of the process state ([PROCESS.md §4](../../PROCESS.md)): at each gate it records the approved phase, and at the end of a session, the exact stopping point — you can close the conversation mid-phase and resume weeks later.

## Phase 1 — Business

*Phase file: [1-negocio.md](../../skills/design-business/SKILL.md). No technology here.*

An interview, one question at a time:

> **aidakit:** What problem does razor solve, and for whom?
> **owner:** A small barbershop books appointments over WhatsApp and a paper notebook. It keeps double-booking, and clients vanish without notice. The ones who suffer are the owner and the professionals.
>
> **aidakit:** How will we know it worked? A metric or observable event — not "success".
> **owner:** Zero overlapping appointments and no-shows dropping with an automatic reminder. By the way, can we send the reminder over WhatsApp? There's an API…
>
> **aidakit:** Technology is for Phase 3 — I noted it in the `STATE.md` Parking Lot. Back to it: what rule can never be violated, no exceptions?
> **owner:** A professional can never have two appointments at the same time. Never.

The last answer becomes the **R1** invariant in the rules table. The glossary fixes the canonical terms (Barbershop, Professional, Client, Appointment, service window…) and notes for Phase 2 the ambiguity of "agenda" between the front desk and the reminder. The MVP scope comes out with an explicit cut: **Billing stays out**.

- **Deliverable:** `docs/design/1-business-vision.md` (template: [business-vision.md](../../skills/design-business/templates/business-vision.md)).
- **Gate:** the phase checklist satisfied (a goal with an observable criterion, an end-to-end process, invariants separated from rules-with-exceptions, named specialists, a glossary with the central terms) + the owner's explicit approval of a **summary** of the deliverable — not the whole document. Upon approval, `STATE.md` marks Phase 1 as approved, with a date and a link, and announces Phase 2.

## Phase 2 — DDD Modeling

*Phase file: [2-modelagem.md](../../skills/design-modeling/SKILL.md). Still no tables, APIs, or frameworks. A disputed boundary? The support skill is `aidakit:ddd-strategic-design`.*

> **aidakit:** In Phase 1 we noted that "agenda" has two meanings. For the front desk and for whoever sends the reminder, is it the same thing?
> **owner:** No. For the front desk, the agenda is the professional's grid of time slots. For the reminder, what matters is the client's appointment — time and phone number.
>
> **aidakit:** So they're distinct contexts. And the Appointment: if the client reschedules, is it another appointment or the same one?
> **owner:** The same one, rescheduled. We even say "I moved so-and-so's appointment".
>
> **aidakit:** Boundary test: does R1 need to be true IMMEDIATELY, or can it become true shortly after, corrected later?
> **owner:** Immediately. Not even for a second can there be an overlap.

The model emerges: three bounded contexts — **Appointment** (core), **Registration** (barbershops/professionals/clients), and **Notification** — with Billing out of the MVP. Entities: Barbershop, Professional, Client, Appointment. Value objects with intrinsic validation: ServiceWindow, Period, Phone (an invalid Phone cannot exist). The main aggregate is **Appointment** (root: Appointment), protecting R1 with immediate consistency inside the boundary. Domain events, verb in the past tense: **AppointmentConfirmed**, **AppointmentCancelled**, **ReminderSent**.

- **Deliverable:** `docs/design/2-domain-model.md` (template: [domain-model.md](../../skills/design-business/templates/domain-model.md)), with a context map, aggregates traceable to R#, and no term outside the glossary.
- **Gate:** checklist + explicit approval; `STATE.md` updated (Phase 2 approved, date, link).

## Phase 3 — Architecture

*Phase file: [3-architecture.md](../../skills/design-architecture/SKILL.md). Here technology enters — each decision points back to the model.*

> **aidakit:** The AppointmentCancelled event crosses the boundary to Notification. Can it be lost? Can it be duplicated?
> **owner:** Lost, no — a client without notice is an empty chair. Duplicated, sure: two reminders is annoying, but nobody dies.
>
> **aidakit:** With dozens of appointments per day per barbershop, do you need real messaging, or does an outbox + polling on Postgres itself cover it?
> **owner:** The outbox covers it and then some. A broker is for when razor gets big.
>
> **aidakit:** And when two requests contend for the same professional's slot, WHERE is R1 guaranteed — only in the application, or also in the database?
> **owner:** Wherever it's impossible to break.

Each structural choice becomes an **ADR** — the phase rule: "no ADR, you didn't decide — you opined" — in the 5-section format from [DOCS.md §2](../../DOCS.md) (template: [adr.md](../../skills/design-business/templates/adr.md)), saved in `docs/decisions/ADR-NNN-slug.md` and recorded in the `docs/decisions/README.md` index. In razor:

| ADR | Decision |
|---|---|
| ADR-001 | Modular monolith: one NestJS module per bounded context |
| ADR-002 | PostgreSQL (Neon) + Prisma, one schema per context |
| **ADR-003** | **Appointment as a transactional consistency aggregate; R1 guaranteed by an exclusion constraint in the database** |
| ADR-004 | Asynchronous notification via outbox + polling; a broker only with a measurable trigger |
| ADR-005 | Authentication with roles per barbershop (owner, front desk, professional) |

See the [filled-in ADR-003](../examples/ADR-003-appointment-as-aggregate.md): the Context points to R1 and to the Phase 2 aggregate (if you can't point to it, the decision is premature), the negative consequences come marked **Accepted**/**Mitigated**, the review trigger is observable, and the rejected alternatives stay on the table.

Midway through the phase the session ends — and the design updates `STATE.md` with the exact stopping point and the next pending questions. See [STATE-razor.md](../examples/STATE-razor.md): it is razor's `STATE.md` at exactly that moment — phases 1–2 approved with a date, Phase 3 in draft, ADR-003/004 already in the index, WhatsApp still in the Parking Lot.

- **Deliverable:** `docs/design/3-architecture.md` (template: [arquitetura.md](../../skills/design-business/templates/architecture.md)) + the ADRs.
- **Gate:** checklist (contexts → modules, APIs in the ubiquitous language, events with guarantees, a schema per context derived from the aggregates, the minimum set of ADRs — style, database, communication, auth — and cross-cutting ones) + explicit approval. From then on, **an ADR is WORM**: changed your mind, it's a new ADR that supersedes — and superseding escalates to the human ([GOVERNANCE.md §1](../../GOVERNANCE.md), escalation 2).

## Phase 4 — Implementation

*Phase file: [4-implementacao.md](../../skills/design-implementation/SKILL.md). The bridge: the design delivers the plan and hands off the baton.*

> **aidakit:** Monorepo or separate repos?
> **owner:** Monorepo — there are two of us.
>
> **aidakit:** Where does the first version run?
> **owner:** The simplest thing that works. A managed service; Kubernetes is out of the question.
>
> **aidakit:** Which change goes through UI → API → domain → database first and proves the architecture?
> **owner:** Confirming a real appointment, with the event leaving through the outbox.

The `docs/design/4-implementation-plan.md` deliverable closes it: a scaffold mirroring the context map (`appointment/`, `registration/`, `notification/` modules in the NestJS API; a React app), the stack confirmed with each piece traceable to an ADR, a minimal pipeline (build/test/deploy from the first change), and the **vertical change backlog** ordered by risk + value, each with an observable acceptance criterion:

| # | Change (change-id) | Delivers | Acceptance criterion |
|---|---|---|---|
| 1 | `feature-appointment-confirmation` | confirm an appointment end-to-end | an overlap is rejected; `AppointmentConfirmed` in the outbox |
| 2 | `feature-appointment-cancellation` | cancel an appointment with a policy: up to 2h beforehand, no penalty | a cancellation under 2h is refused (the penalty belongs to Billing, out of the MVP); `AppointmentCancelled` in the outbox |
| 3 | `feature-notification-reminder` | automatic reminder from the outbox | `ReminderSent` recorded for the next day's appointment |

The change-id is the single end-to-end key ([DOCS.md §2](../../DOCS.md), rule 7): `feature-appointment-cancellation` names the `docs/features/feature-appointment-cancellation/` directory, the branch, the PR title suffix, and, in the end, the archive directory.

- **Gate:** checklist + explicit approval — "the definition design is complete; execution begins". `STATE.md` gains the **Execution** table filled in with the backlog, and the first change ends up specified and ready for the cycle.

## The handoff

From here, each change follows the kit's execution cycle ([PROCESS.md §2](../../PROCESS.md)); [GOVERNANCE.md](../../GOVERNANCE.md) applies in full — everything via a short branch + PR, and **the merge is always the human's**. The entry point is `/aidakit:build`: the 1st step of the flow runs the `aidakit:orchestrator`, which picks the next ready change (dependencies shipped) and returns a self-contained prompt for a new session (logic previously exposed as a separate command, now absorbed into build). When `feature-appointment-cancellation` is next in line, it is the one the sibling guide follows from the prompt to the PR URL and the archive: **[change-flow.md](change-flow.md)**.

The design remains the owner of the state: at the end of each change, `STATE.md` records the completed change and the next one.

## This guide's example artifacts

- [STATE-razor.md](../examples/STATE-razor.md) — razor's `STATE.md` mid-Phase 3, in the real template.
- [ADR-003-appointment-as-aggregate.md](../examples/ADR-003-appointment-as-aggregate.md) — a Phase 3 ADR in the doctrine's 5 sections.

<!-- aidakit v0.3 — narrative guide of the new-project flow (razor example project), created on 2026-07-17 — translated to EN -->
