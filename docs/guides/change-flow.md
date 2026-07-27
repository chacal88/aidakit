# Per-change flow — from backlog to archive, end-to-end

> Narrative guide of the canonical aidakit cycle using a real change from the **razor** example project. This guide **narrates and exemplifies** — the law lives in [PROCESS.md](../../PROCESS.md), [DOCS.md](../../DOCS.md), [GOVERNANCE.md](../../GOVERNANCE.md), and in the linked skills. **If this guide diverges from the linked skill/doctrine, the other wins and this file is corrected.**

## The scenario

**razor** is a scheduling SaaS for barbershops (NestJS + React + PostgreSQL with Neon and Prisma). Bounded contexts: **Appointment** (core), **Registration**, and **Notification**; Billing is out of the MVP. The main aggregate is **Appointment**, with the R1 invariant: *"a professional never has two overlapping appointments"* — a decision recorded in `docs/decisions/ADR-003-appointment-as-aggregate.md`. Domain events leave through the outbox (`ADR-004-notification-async-outbox.md`).

This guide's change came from phase 4 of [aidakit:flow-design](../../commands/flow-design.md):

> **`feature-appointment-cancellation`** — cancel an appointment with a policy: up to 2h beforehand, no penalty.

razor does not use OpenSpec, so **kit mode** applies ([PROCESS.md](../../PROCESS.md) §1): change artifacts in `docs/features/feature-appointment-cancellation/`, canonical specs in `docs/specs/`, ADRs in `docs/decisions/`. The single end-to-end key ([DOCS.md](../../DOCS.md) §2, rule 7): **change-id = branch = PR title suffix = archive directory**.

| # | Step | You invoke | Gate |
|---|-------|-------------|------|
| 1 | Next unit of work (entry point) | `/aidakit:flow-fast` (1st step picks the change) | — |
| 2 | Plan (plan-only), in the new session | [aidakit:plan](../../skills/plan/SKILL.md) | `/aidakit:review` without `--diff` + plan-only PR |
| 3 | Readiness | [aidakit:readiness](../../skills/readiness/SKILL.md) | **GATE 1** — `Status: APPROVED` + `Ready to implement: yes` |
| 4 | Implement | skill [test-driven-development](../../skills/test-driven-development/SKILL.md) | RED → GREEN → REFACTOR |
| 5 | Tests and coverage | [aidakit:test](../../skills/test/SKILL.md) / [aidakit:coverage](../../skills/coverage/SKILL.md) | critical ≥85%, overall ≥80% |
| 6 | Diff review | [aidakit:review](../../skills/review/SKILL.md) `--diff` | **GATE 2** — PASS |
| 7 | Ship | `/commit-push-pr` (`commit-commands` plugin) | stops at the **PR URL** |
| 8 | Merge | **the human**, on the Git host | final gate |
| 9 | Post-merge | [aidakit:docs](../../skills/docs/SKILL.md) archive | WORKING → DURABLE promotion |
| 10 | Close the loop | report done to `aidakit:orchestrator` | next prompt |

## Step 1 — ask for the next change (`/aidakit:flow-fast`)

The **entry point** of the cycle is always `/aidakit:flow-fast` (or `/aidakit:flow-full` for architectural changes) ([PROCESS.md](../../PROCESS.md) §2): the **1st step of the flow** picks the next ready change and generates the self-contained prompt (logic previously exposed as a separate command, now absorbed into the flow). You don't decide the change by hand — `aidakit:orchestrator` does it from the repo's real artifacts:

```
/aidakit:flow-fast
```

The flow does not execute the implementation in this session: at startup, it asks the `aidakit:orchestrator` agent for a **self-contained prompt** with fresh facts from the repo ([GOVERNANCE.md](../../GOVERNANCE.md) §6) and displays it verbatim. The orchestrator inspects the active changes, the `git log`, the archive, and the open decisions, picks the first ready change whose dependencies have already been shipped, and assembles the prompt for the new session.

In this round, the picked change — `feature-appointment-cancellation` — **does not have a spec yet**, so the prompt the orchestrator returns instructs the authoring of the plan-only artifacts. Condensed example of what comes out:

```text
You are in a new execution session of the razor repo (kit mode, no OpenSpec).

Fresh facts from the repo:
- Current commit (main): 3f2a9c1
- Completed changes: docs/archive/2026-07-15-feature-appointment-confirmation/
- Current phase: Phase 4 of the design — change backlog (docs/design/STATE.md)

Change to author: feature-appointment-cancellation — "cancel an appointment
with a policy: up to 2h beforehand, no penalty".

Required reading: docs/decisions/README.md; ADR-003-appointment-as-aggregate.md;
ADR-004-notification-async-outbox.md; docs/specs/appointment/spec.md;
docs/architecture/ARCHITECTURE.md.

Since the change has no spec yet, run /aidakit:plan
feature-appointment-cancellation to author, in
docs/features/feature-appointment-cancellation/: proposal.md, design.md,
tasks.md, evidence.md (stub) and specs/appointment/spec.md (capability delta).

Then run /aidakit:review feature-appointment-cancellation — every
reviewer passes before any code — and open the plan-only PR via
/commit-push-pr.

Escalations (GOVERNANCE.md §1): no product code (plan-only); do not
supersede ADRs; do not leave the Phase 4 scope; do not merge the PR. Task
paths land on the repo's real surfaces (apps/api, apps/web).
```

You paste that prompt into a **new session** and proceed with Step 2. The prompt is displayed verbatim — never modify it ([GOVERNANCE.md](../../GOVERNANCE.md) §6).

## Step 2 — plan the change in the new session (`/aidakit:plan`)

In the new session, since the change still has no spec, you invoke [aidakit:plan](../../skills/plan/SKILL.md) exactly as the Step 1 prompt instructed:

```
/aidakit:plan feature-appointment-cancellation
```

The `aidakit:planner` agent authors the four plan-only artifacts in `docs/features/feature-appointment-cancellation/` — proposal, design, tasks, evidence (stub) — plus the spec delta (`specs/appointment/spec.md`). It is **plan-only, never product code**: the planner reads the recorded decisions and the specs the change extends, and cross-checks that every cited decision exists, that every `design.md` deliverable has a bullet in `tasks.md`, and that every path matches the repo's real layout. The `proposal.md` follows the template documented in [aidakit:spec](../../skills/spec/SKILL.md); see the filled-in example for this change: **[proposal-appointment-cancellation.md](../examples/proposal-appointment-cancellation.md)**.

The planning round closes with `/aidakit:review feature-appointment-cancellation` (without `--diff`: structural validation of the artifacts + the two reviewers) and a **plan-only PR** via `/commit-push-pr`, which the human merges. With the plan on main, the `aidakit:orchestrator` can already return, on a next `/aidakit:flow-fast`, the change's **execution** prompt — displayed verbatim, to paste into a new session:

```text
You are in a new execution session of the razor repo (branch main,
commit 8c41d7b). Kit mode, no OpenSpec.

Ready change: feature-appointment-cancellation
Directory: docs/features/feature-appointment-cancellation/
Artifacts: proposal.md · design.md · tasks.md · evidence.md (stub) ·
specs/appointment/spec.md (delta)

Cited decisions and specs:
- docs/decisions/ADR-003-appointment-as-aggregate.md
- docs/decisions/ADR-004-notification-async-outbox.md
- docs/specs/appointment/spec.md

Touched surface: apps/api (NestJS). Serial mode.

Execute the tasks in tasks.md with TDD (skill test-driven-development).
After each milestone, run /aidakit:review feature-appointment-cancellation
(post-implementation: --diff). With the validation green, commit and open the PR
via /commit-push-pr — stop at the PR URL; the merge is the human's.

Escalations (GOVERNANCE.md §1): do not merge; do not supersede an ADR; do not
leave the change's approved scope.
```

The change touches **1 surface** (`apps/api`), so the mode is **serial** ([PROCESS.md](../../PROCESS.md) §2); with 2+ surfaces the orchestrator would set up parallel worktrees. If the `design.md` were shallow, [aidakit:plan](../../skills/plan/SKILL.md) itself would deepen the implementation plan (a 3-point estimate, risk matrix, file structure) — here we skip it, the design.md is enough.

## Step 3 — GATE 1: readiness (`/aidakit:readiness`)

Before any code, the 14-step readiness review ([aidakit:readiness](../../skills/readiness/SKILL.md)) sweeps the whole package — scope, proposal, design, specs, tasks, omissions, implementation simulation. The output comes in the chat, in the skill's fixed 15-section structure (condensed below), with the **machine-parseable** verdict required by [GOVERNANCE.md](../../GOVERNANCE.md) §3. The verdict is exactly two lines, verbatim and in English: `Status: APPROVED | NEEDS-REVISION | BLOCKED` and `Ready to implement: yes | no` — there is no "APPROVED WITH FIXES" value:

```md
# Readiness review result

## 1. Decision
- Status: APPROVED
- Confidence: high
- Ready to implement: yes

## 2. Scope validation
Scope: correct. Explicit non-goals (the penalty depends on Billing, out of the
MVP; the web UI stays in the next change) protect against scope creep.
...
## 10. Execution risks (top 5 failures)
1. Race between cancellation and a new appointment in the same slot — prevention:
   R1 integration test under a transaction (task 4.2).
...
## 15. Final conclusion
- Can it start? Yes.
- What needs fixing? Nothing mandatory before implementation.
- Main risk if ignored? Race on the freed slot (covered by task 4.2).
```

You only implement with `Status: APPROVED` **and** `Ready to implement: yes`; `NEEDS-REVISION` requires fixing the mandatory findings and running the review again, and `BLOCKED` means an incomplete package (the verdict vocabulary from [GOVERNANCE.md](../../GOVERNANCE.md) §3, enforced verbatim by the skill). The reviewer **reports, doesn't fix** — the author is the one who corrects.

## Step 4 — implementation with TDD

In the executing session, each task follows [test-driven-development](../../skills/test-driven-development/SKILL.md): no product code without a failing test first.

**RED** — the 2h-policy test, written first:

```typescript
// apps/api/src/appointment/appointment.aggregate.spec.ts
it('refuses cancellation less than 2h in advance', () => {
  const appointment = confirmedAppointmentIn(90, 'minutes');
  expect(() => appointment.cancel(now())).toThrow(CancellationOutsideWindow);
});
```

Running it and **seeing it fail** (`cancel is not a function`) is mandatory — a test that is born passing proves nothing. **GREEN**: the minimum that passes — the `cancel()` method on the aggregate checks the 2h window, changes the status to `CANCELLED`, and records `AppointmentCancelled` for the outbox (ADR-004). **REFACTOR** with the tests green. The cycle repeats for the remaining behaviors: a valid cancellation frees the professional's window (R1), the event recorded in the same transaction. A bug midway → skill `systematic-debugging` before proposing a fix.

## Step 5 — tests and coverage (`/aidakit:test`, `/aidakit:coverage`)

Before the final gate, [aidakit:test](../../skills/test/SKILL.md) runs the surface's suite with coverage:

```
/aidakit:test api
```

```
⚠️ api tests: WARN
   Coverage: 78% (below the 80% target)
   Tests: 41 passed, 0 failed, 0 skipped

   Coverage gaps (top 2):
   1. OutboxRepository.saveEvent() — error path — 40% coverage
   2. AppointmentController POST /:id/cancellation — 422 response — 60%

   Recommendation: run /aidakit:coverage for a detailed analysis
```

`/aidakit:coverage api` ([aidakit:coverage](../../skills/coverage/SKILL.md)) details the gaps and suggests concrete tests in the style of the repo's existing tests — here, the outbox error path (a classic case: a persistence failure must take down the whole transaction). Tests added, new round:

```
✅ api tests: PASS
   Coverage: 88% (lines), 85% (branches)
   Tests: 46 passed, 0 failed, 0 skipped
   Duration: 11.4s
```

Ruler ([PROCESS.md](../../PROCESS.md) §2, step 5): critical paths ≥85%, overall ≥80%; a failing test, type error, or lint error **blocks**; coverage 80–85% on a critical path **warns**.

## Step 6 — GATE 2: diff review (`/aidakit:review --diff`)

The canonical pre-ship gate ([aidakit:review](../../skills/review/SKILL.md)): structural validation first (mechanics before judgment) and, with it green, the two reviewers **in parallel in the same message**, now against the implemented diff:

```
/aidakit:review --diff
```

```md
## Structural — PASS
Markdown links in the changed files resolve; paths match apps/api.

## ADRs — PASS (aidakit:adr-reviewer)
ADR-003 (appointment as aggregate): the cancellation transition goes through the
aggregate, not a direct update — conforms.
ADR-004 (asynchronous notification via outbox): AppointmentCancelled recorded in
the outbox in the same transaction — conforms.
Status: APPROVED

## Specs — PASS (aidakit:spec-reviewer)
Delta requirements covered (3/3); no diff item without a source requirement
(no scope creep); no gap.
Status: APPROVED

Final verdict: PASS — Ready to ship.
```

`APPROVED` maps to PASS; `NEEDS-REVISION`/`BLOCKED` map to FAIL — and any FAIL means fixing and running `/aidakit:review` again. The reviewers only report; they never fix nor merge.

## Steps 7–8 — ship up to the PR URL; the merge is the human's

With the gate green, the `commit-commands` plugin closes the cycle. Branch = change-id (DOCS.md rule 7), **nominal** staging (never `git add -A` — the `pre-bash` hook blocks it), conventional commit:

```
/commit-push-pr
```

```
Commit: feat(appointment): cancel appointment with a 2h policy
Branch: feature-appointment-cancellation
PR opened: https://github.com/acme/razor/pull/42
  "feat(appointment): cancellation with a 2h policy — feature-appointment-cancellation"

I stop here — the merge is the human's (GOVERNANCE.md §1).
```

**The kit stops at the PR URL.** Merging a PR is escalation #1 of [GOVERNANCE.md](../../GOVERNANCE.md): always the human's. You review PR #42 on the Git host and merge.

## Step 9 — post-merge: promotion and archive (`/aidakit:docs` archive)

With the PR merged, the `archive` mode of [aidakit:docs](../../skills/docs/SKILL.md) executes the WORKING → DURABLE promotion gate ([DOCS.md](../../DOCS.md) §4):

1. **Confirms with the human** what will be moved and shows the **merge diff** of the spec delta — the merge only happens with approval.
2. The `docs/features/feature-appointment-cancellation/specs/appointment/spec.md` delta merges into the canonical spec `docs/specs/appointment/spec.md` (the Appointment capability now includes cancellation).
3. The change directory goes to `docs/archive/2026-07-17-feature-appointment-cancellation/`, with a legacy banner on each doc and a stub in the old location (anti-link-rot).
4. Affected indexes synchronized; everything delivered via a **short branch + bookkeeping PR** — straight-to-main does not exist for agents ([GOVERNANCE.md](../../GOVERNANCE.md) §2).

The plan only becomes history when the implementation has validated it; the dated archive is jurisprudence that future changes cite by archive-id.

## Step 10 — close the loop

After the archive, report to the orchestrator:

```
feature-appointment-cancellation done, PR #42 merged
```

The `aidakit:orchestrator` verifies the merge, marks the change as shipped in `docs/design/STATE.md`, and returns the next ready prompt — back to the top of the table, for the next change in the backlog.

## Variations

- **Bug fix** (< ~2h): skips the planning — reproduction with `systematic-debugging`, fix + regression test, `/aidakit:test`, `/aidakit:review --diff`, `/commit`. **Hotfix**: same, with aggressive review; the never-merge and never-stage-secrets guards still hold. Details in [PROCESS.md](../../PROCESS.md) §2.
- **Change with 2+ surfaces**: the orchestrator sets up one worktree per surface and fires implementation in parallel; each branch passes GATE 2 independently. Rules and exceptions in [PROCESS.md](../../PROCESS.md) §2, "Serial vs parallel implementation".

<!-- aidakit v0.3 — narrative guide of the per-change cycle (razor example project), created on 2026-07-17 — translated to EN -->
