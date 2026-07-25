# Existing-repository flow — adopting aidakit without steamrolling

> **Precedence:** if this guide diverges from the linked skill or doctrine — [DOCS.md](../../DOCS.md), [GOVERNANCE.md](../../GOVERNANCE.md), [PROCESS.md](../../PROCESS.md), or a plugin `SKILL.md` —, the other wins and this file is corrected.
>
> This is the most common case: the repo already has code, scattered docs, and maybe ADRs in a layout of its own. The order here is different from a new project ([5-minute guide](getting-started.md)): first map and deploy the document doctrine ([aidakit:docs](../../skills/docs/SKILL.md)), then agree on the governance with the team ([aidakit:governance](../../skills/governance/SKILL.md)), and only then grow the pipeline — by steps, not all at once. The examples use the **razor** project (a scheduling SaaS for barbershops — NestJS + React + PostgreSQL on Neon + Prisma).

## 1. Install

Same as a new project — full installation and verification in [Getting started §1 and §3](getting-started.md):

```
/plugin marketplace add ~/Documents/winker/aidakit
/plugin install aidakit@aidakit
```

Two immediate effects that matter in an existing repo:

- **The [`pre-bash.js`](../../hooks/pre-bash.js) hook is active from the first command** — before any docs migration, the agent already can't `git add -A`, `--no-verify`, force-push, or `gh pr merge` ([GOVERNANCE.md §4](../../GOVERNANCE.md)). It's the first thing the team notices.
- **Nothing else changes on its own.** Installing moves no document, creates no folder, rewrites nothing. Every change to the repo from here on is proposed and goes out via a short branch + PR ([GOVERNANCE.md §2](../../GOVERNANCE.md)).

Install the `commit-commands` plugin too (`/commit`, `/commit-push-pr`) — the cycle closes commit/PR with it ([PROCESS.md §3](../../PROCESS.md)).

## 2. `aidakit:docs init` — deploy the structure, never impose it

The `init` mode of the [aidakit:docs](../../skills/docs/SKILL.md) skill deploys the canonical structure from [DOCS.md §1](../../DOCS.md). In an existing repo, what matters is what it does when `docs/` **already exists in a divergent layout**:

1. **Inventories** what's in `docs/` and compares it to the canonical structure.
2. **Diagnoses the divergence** — and if the divergent layout is consolidated (ADRs outside `decisions/`, loose docs at the root, a custom tree with history), it **does not impose the structure on top**: it presents a **migration proposal** — a from-to map, the moves required, the links that would break, and how to preserve them via stubs — and **waits for the human's decision**.
3. Once the proposal is approved (or if there is no divergence), it **creates only what's missing, without overwriting anything**: `docs/INDEX.md`, `docs/decisions/README.md` (the authoritative index of the ADRs), and the `design/`, `architecture/`, `features/`, `specs/`, `guides/`, `archive/` folders — an empty folder gets a `.gitkeep` or a one-sentence README. It does **not** create `DECISION_INDEX.md` before 15 ADRs; `docs/business/` only if the project already has (or asked for) strategic docs.
4. **Reports in two lists**: created vs. already existed (untouched).

Example — razor's `docs/` before adoption:

```
docs/
├── adr/                     # ADR-001 through ADR-004, custom layout, no index
├── notes/                   # cancellation-policy.md, mvp-ideas.md
├── setup-notification.md    # how to run the notification worker
└── domain-model.md          # entities, VOs, and the Appointment aggregate
```

The migration proposal the `init` presents (and waits for approval on):

| From | To | Rule ([DOCS.md §3](../../DOCS.md)) |
|---|---|---|
| `docs/adr/ADR-00N-*.md` | `docs/decisions/` (numbering preserved; stub in `docs/adr/`) | decisions live in `decisions/` |
| `docs/setup-notification.md` | `docs/guides/` | practical HOW → guides |
| `docs/domain-model.md` | `docs/architecture/` | structural view of the system |
| `docs/notes/*.md` | **no place in the tree → the skill asks** | §3.8: "probably does not belong in the repo" |

For the notes, the owner decides: `mvp-ideas.md` goes to `docs/archive/` (superseded, with a legacy banner) and `cancellation-policy.md` becomes input for the first change's plan (section 7). The whole migration goes out in one PR — the merge is the human's.

## 3. `aidakit:docs audit` — the X-ray of the seven rules

After the structural migration, the `audit` mode checks each rule of [DOCS.md §2](../../DOCS.md) (plus the hygiene of §5) against what's on disk: internal links, placement, ADR format, archive banners, indexes, sizes, and index↔reality drift. Each finding comes out with a **severity (`blocking` / `high` / `hygiene`), file, violated rule, and proposed fix**. A typical report on razor:

```
Docs audit — razor (3 findings)

1. [blocking] docs/guides/setup-notification.md
   Rule: DOCS.md §2.4 — all internal links resolve.
   Finding: links ../notification-outbox.md, deleted in a refactor months ago.
   Proposed fix: point to [ADR-004](../decisions/ADR-004-notification-async-outbox.md),
   which records the outbox decision. Mechanical (unambiguous target) — applicable
   with your approval, via PR.

2. [high] docs/decisions/ADR-004-notification-async-outbox.md
   Rule: DOCS.md §2.3 — fixed 5-section format.
   Finding: the "Alternatives considered" section is missing; negative consequences
   without an "Accepted"/"Mitigated" mark.
   Proposed fix: none automatic — an ADR is WORM (§2.2), the agent does not
   edit a past decision. Completing the format is the human author's decision.

3. [hygiene] docs/guides/ + docs/INDEX.md
   Rule: DOCS.md §2.1 — every directory has an index; index↔reality drift.
   Finding: docs/guides/ has no index of its own; docs/INDEX.md does not list
   setup-notification.md (moved after the index was created).
   Proposed fix: run the index mode — which validates the drift before
   regenerating, never blindly.
```

**Mechanical** fixes (a missing stub, an index entry, a link with an unambiguous target) can be applied — only with the human's approval, and via PR. ADR content is never "fixed": a real conflict with a recorded decision becomes a proposal for a new ADR and escalates ([GOVERNANCE.md §1](../../GOVERNANCE.md), escalation 2).

## 4. `aidakit:governance onboarding` — agree on the rules with the team

The `onboarding` mode of the [aidakit:governance](../../skills/governance/SKILL.md) skill prepares the repo (and the people) for the execution doctrine. Four steps:

1. **Functional hook** — confirms `node` is available and the plugin is active. The hook is fail-open: if it breaks, it doesn't block work, but it also doesn't protect.
2. **The 3 escalations, explained to the team** ([GOVERNANCE.md §1](../../GOVERNANCE.md)). The model is permissive by design — no preventive matrix of prohibitions; the agent decides on its own everything not listed, and the PR is the net. **Exactly three** situations always go to the human:

   | Escalation | In razor's day-to-day |
   |---|---|
   | **Merging a PR** is never the agent's | The agent delivers the PR URL and stops; the one who clicks merge is you |
   | **Superseding/contradicting an ADR** is a proposal + a human decision | A design that violates ADR-003 (appointment as aggregate) is not worked around in silence: it becomes a draft of a new ADR and you decide |
   | **Leaving the approved scope** is stopping and reporting | A discovery mid-change → the agent presents it and waits |

   Full scenes of each one in [Governance in practice §1](governance-in-practice.md).
3. **Branch protection on main** — the agent suggests it (require PR, block force-push and direct commits) and explains; the configuration on the git host is the human's. The agent does not alter repository configuration.
4. **A short adoption ADR** — the decision to adopt the governance is recorded in `docs/decisions/`, via [aidakit:docs](../../skills/docs/SKILL.md), in the 5-section format, via a branch + PR. In razor (which over these six months has already accumulated ADR-001 to 011 in the legacy `docs/adr/` layout), `ADR-013-adopt-aidakit-governance.md` is born:
   - **Status + Date**: accepted · 2027-01-12
   - **Context**: six months of repo with no process; docs degrading, inconsistent review
   - **Decision**: aidakit governance in effect (GOVERNANCE.md), `pre-bash` hook active, main protection on
   - **Consequences**: traceability and gates (+); PR friction even for bookkeeping (− Accepted)
   - **Alternatives considered**: keep going with no process; write a doctrine of our own from scratch

Mode output: the adoption ADR (via PR) + a readiness checklist in the conversation (node ok, hook active, escalations communicated, branch protection suggested).

## 5. Gradual pipeline adoption — start with the gates, grow into the cycle

Don't adopt the [full cycle](../../PROCESS.md) on day 1. The ladder that works:

**Step 1 — just the exit gates, on every commit.** Two skills enter the team's habit without changing how anyone works:

- **[aidakit:review](../../skills/review/SKILL.md) on the diff** — `/aidakit:review --diff` runs `git diff` + `git diff --cached`, validates the structure of the changed markdown files (links resolve, format), and, with the structural PASS, fires the two reviewers **in parallel**: `aidakit:adr-reviewer` (conformance with `docs/decisions/` — and it reads legacy layouts like `docs/adr/` while the migration hasn't happened) and `aidakit:spec-reviewer` (requirement coverage and scope creep against `docs/specs/`). PASS/FAIL verdict per section and final: "Ready to ship" or "fix and run again". Report, don't fix — the one who corrects is you. With few ADRs and still no canonical specs, the reviewers have less anchor; the gate gains strength as `decisions/` and `specs/` fatten.
- **[aidakit:test](../../skills/test/SKILL.md) before the commit** — `/aidakit:test <surface>` discovers the surfaces in the repo itself (in razor: `api`, the NestJS one with `npm run test:cov`, and `web`, the React one with Vitest), runs the suite with coverage, and reports PASS/WARN/FAIL. Overall threshold ≥80%, critical paths ≥85% (services, schemas, controllers, adapters); a failing test, type error, or lint error **blocks**; coverage 80–85% on a critical path **warns**. `/aidakit:test all` runs every surface before the PR.

The hook is already the passive layer under both — step 1 = leash + two gates, zero planning ceremony.

**Step 2 — non-trivial changes get a plan and an entry gate.** A change that isn't a <2h bugfix starts being born through [aidakit:plan](../../skills/plan/SKILL.md) (plan-only artifacts in `docs/features/<change-id>/`: proposal, design, tasks, evidence) and through GATE 1, [aidakit:readiness](../../skills/readiness/SKILL.md) (14 steps, verdict APPROVED / NEEDS-REVISION / BLOCKED). You only implement with APPROVED.

**Step 3 — the full cycle of [PROCESS.md §2](../../PROCESS.md).** `/aidakit:flow-build` picks the next ready change in the 1st step of the flow and generates the self-contained prompt (logic previously exposed as a separate command, now absorbed); implementation with TDD; [aidakit:coverage](../../skills/coverage/SKILL.md) when coverage falls below target; `/aidakit:review --diff` as GATE 2; commit/PR; **you merge**; and `aidakit:docs` does the dated archive post-merge with WORKING → DURABLE promotion ([DOCS.md §4](../../DOCS.md)). The cycle does not require having run the design: `aidakit:plan` accepts a change or idea still without a spec, and the `aidakit:orchestrator` inspects the repo's real artifacts instead of assuming state.

## 6. Coexisting with the existing process

**OpenSpec is detected automatically.** If the repo has an `openspec/` directory (or the `openspec` CLI installed), every cycle skill operates in OpenSpec mode — the pipeline is identical, only the paths and mechanical validation change ([PROCESS.md §1](../../PROCESS.md)):

| Kit mode | OpenSpec mode |
|---|---|
| `docs/features/<change-id>/` | `openspec/changes/<change-id>/` |
| `docs/specs/` | `openspec/specs/` |
| archive in `docs/archive/YYYY-MM-DD-<change-id>/` | `openspec archive <change-id> --yes` |
| the kit's mechanical checks | `openspec validate <change-id> --type change --strict` |

The rest (`docs/design/`, `docs/decisions/`, `docs/guides/`...) is the same in both modes. You don't abandon OpenSpec to adopt the kit — the kit fits into it.

**Other legacy layouts.** While the section-2 migration isn't approved, the kit coexists: the `init` proposes instead of imposing, and the `aidakit:adr-reviewer` looks for decisions in non-standard layouts too (`docs/adr/`, `ADR_INDEX.md`). The migration is an invitation with anti-link-rot stubs, not a prerequisite for using the step-1 gates.

## 7. Scenario: razor, six months later

In the [quick-start guide](getting-started.md), razor is born with the kit. Suppose the alternate history: it was born without it, and reaches January 2027 with six months in production and the messy `docs/` from section 2 — ADRs in `docs/adr/`, loose notes, no index, a broken link in the worker guide. The adoption week:

- **Day 1 — install + `init`.** The plugin comes in; an agent's first `git add -A` is blocked by the hook (the team notices). `/aidakit:docs` in init mode inventories, presents the section-2 migration proposal; the owner approves; the migration goes out in a single PR with stubs in `docs/adr/`.
- **Day 2 — `audit`.** The section-3 report appears: the broken link and the index are fixed in a PR of approved mechanical corrections; the out-of-format ADR-004 is recorded — completing it is the human author's decision (WORM).
- **Day 3 — `onboarding`.** The 3 escalations communicated to the team, main protection turned on by the owner on the git host, and `ADR-013-adopt-aidakit-governance.md` (section 4) merged via PR.
- **Weeks 1–2 — step 1.** Every commit starts going with `/aidakit:test api` or `/aidakit:test web` + `/aidakit:review --diff`. No new ceremony beyond that.
- **Week 3 — first change with the full cycle.** The rescued note `cancellation-policy.md` becomes the change **`feature-appointment-cancellation`** — "cancel an appointment with a policy: up to 2h beforehand, no penalty". `aidakit:plan` authors the artifacts in `docs/features/feature-appointment-cancellation/` citing ADR-003 (the policy lives inside the `Appointment` aggregate, which remains the owner of the R1 invariant); `aidakit:readiness` gives APPROVED; TDD covers the 2h window and emits `AppointmentCancelled`; `/aidakit:test all` green; GATE 2 PASS; PR #42 opened on the `feature-appointment-cancellation` branch — **the owner merges**. Post-merge, `aidakit:docs` promotes the delta to `docs/specs/` and archives the change in `docs/archive/2027-02-06-feature-appointment-cancellation/` — the same key in the branch, the PR, and the archive ([DOCS.md §2.7](../../DOCS.md)).

Six months of mess, one week of adoption, and the first change already comes out traceable end-to-end.

<!-- aidakit v0.3 — existing-repository adoption guide, written on 2026-07-17 — translated to EN -->
