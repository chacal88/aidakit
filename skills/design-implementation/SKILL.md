---
name: design-implementation
description: Phase 4 of design — Implementation. Runs the interview that materializes the decisions into a build plan, produces docs/design/4-implementation-plan.md (scaffold, stack traced to ADRs, minimum pipeline, backlog of vertical changes) and returns the "ready" outcome to the flow when the exit checklist is satisfied. Dispatched by the design flow (governance/flows/design.yaml) as phase 4, with a forced human gate right after. Use when the flow reaches the Phase 4 step, or when the user asks to plan the implementation of a project whose Phases 1–3 are already approved.
---

# aidakit:design-implementation — Phase 4 of design (Implementation)

> Materializes the decisions: technology executes what the domain drove. This phase is a bridge — the design delivers the build plan and passes the baton to the aidakit execution cycle. Runs THIS phase's interview in interview mode (one question at a time), writes the deliverable in `docs/design/` and returns to the flow the `ready` outcome when the exit checklist is satisfied.

This skill is **phase 4** of the design flow ([governance/flows/design.yaml](../../governance/flows/design.yaml)), which dispatches the four DDD phases in sequence and forces a **human gate** between each one. The approval gate **does not live here** — it is a `human_gate` step of the flow itself, right after this skill. This skill only runs the phase and signals `ready`; who releases passage is the owner, at the flow's gate.

## When to use (and when not)

- **Use** when the design flow reaches the Phase 4 step, or when the user asks to plan the implementation of a project whose Phases 1–3 are already approved in `docs/design/`.
- **Do not use** to build an already-planned change — that is the execution cycle (`/aidakit:flow-fast`/`/aidakit:flow-full`; see "Passing the baton"). Do not use before the earlier phases are approved: the implementation plan materializes decisions that only exist if Business, Modeling and Architecture have closed.

## Prerequisites

- **Mandatory inputs:** all the earlier deliverables in `docs/design/` — `1-business-vision.md`, `2-domain-model.md` and, with extra attention, `3-architecture.md` (the context map and the ADRs). Reread them before working the phase; if an input contradicts what the user is saying now, point out the contradiction before continuing.
- `docs/design/STATE.md` present, with Phases 1–3 marked as approved.
- Access to the user in interview mode — the phase does not work without the product owner answering.
- **Content language.** Detect `language` in `aidakit.config.yaml` at the root of the target repo (default `en` if absent). Conduct the interview and write the deliverable IN THAT language — the questions to the owner and the prose of the documents follow `language`. The identifiers, the file names, and the STRUCTURE of the templates (headings, ADR sections) stay as the doctrine defines them; only the prose changes. See [config reference](../../docs/reference/config.md).

## Process

Run the phase in **interview mode: one question at a time**, starting from the axes below. Adapt to the previous answer; do not dump a questionnaire. When the options are enumerable, offer them as a choice. Record the answers in the draft of the deliverable as you go — do not leave it all to write at the end.

Tone: a senior architect interviewing the product owner — skeptical to the right degree, pragmatic, allergic to a vague answer. A generic answer ("I want it to be scalable") → ask for the concrete case that justifies it.

### Interview axes

**1. Structure — how will the system be structured?**
- Repository scaffold reflecting the context map modules (one directory per bounded context; domain isolated from infrastructure).
- Monorepo or separate repos? (default: monorepo until there is a reason)
- Conventions: lint, formatting, test structure, ubiquitous-language names in the code.

**2. Frameworks — which technologies will be used?**
- Confirm the stack materializing the Phase 3 ADRs (the user's default: NestJS + React + PostgreSQL/Prisma + Zod).
- For each new piece in the stack: is there an ADR in `docs/decisions/`? If not, the decision is premature — go back to Phase 3 and write it (the gate protects you from "I adopted without deciding").

**3. Execution infra — where and how does it run?**
- Where does the first version run? (default: the simplest thing that works — a managed service; Kubernetes only with an ADR that justifies it)
- Minimum pipeline: build, test, deploy — automated from the first change.
- Messaging: materialize the Phase 3 decision (a simple outbox before a dedicated broker, if that was decided).

**4. Build sequence — vertical changes**
- Order by risk + value: first the change that cuts through everything (UI → API → domain → database) and proves the architecture.
- Each change delivers one command/event of the model working end-to-end, with a test.
- For each change: an observable acceptance criterion.

### Deliverable

Write `docs/design/4-implementation-plan.md` — the **build sequence in vertical changes**, covering the four axes: the scaffold mirroring the context map, the confirmed stack (each piece traceable to an ADR in `docs/decisions/`), the minimum pipeline (build/test/deploy) and the backlog of vertical changes ordered by risk+value, each change with its acceptance criterion. The first change must come out specified and ready for the aidakit cycle.

**Emit the backlog as roadmap epics.** The ordered backlog is not only prose in this deliverable — write it into `docs/roadmap/` too, so the project has a live, status-derived roadmap from day one. Group the vertical changes into features and the features into one or more epics, and write `docs/roadmap/epics/EPIC-<slug>.md` (per [aidakit:roadmap](../roadmap/SKILL.md) — the same generator its `from` mode uses; you already did the interview and decomposition in this phase, so hand the result straight to the roadmap writer). The change-ids you mint here are the single key (§2.7). The changes start as `backlog` on the roadmap and flip to in-progress when `/aidakit:flow-fast`/`/aidakit:flow-full` authors each.

ADRs born in this phase (a new stack piece that did not yet have a recorded decision) go in `docs/decisions/ADR-NNN-slug.md`, global sequential numbering, registered in the index `docs/decisions/README.md`. **An ADR is WORM:** an approved decision is never edited — changed your mind, a new ADR that supersedes or amends.

### Passing the baton (execution)

From the end of this phase, each change of the plan is built with `/aidakit:flow-fast` (or `/aidakit:flow-full` for architectural changes) — the human interface that takes **one change of the plan to the PR** over the aidakit flow engine (full reference: `PROCESS.md` at the root of the plugin; git, PR and escalation rules: `GOVERNANCE.md`).

- The owner **does not need to point at the change by hand**: the first step of the flow picks the next ready change of the plan (via the `aidakit:orchestrator` agent, respecting dependencies). For a specific change, name it in the `/aidakit:flow-fast`/`/aidakit:flow-full` request.
- The flow runs the change end-to-end — plan, readiness, TDD implementation, validation/coverage, review against specs/ADRs and commit/PR — pausing at the human gates. **The merge is always the human's, never the agent's** (`GOVERNANCE.md`).

The design remains the owner of the STATE: at the end of each change, record in `STATE.md` the completed change and the next one.

### Signaling to the flow

Check the exit checklist below. With all the items satisfied and the deliverable written, show the owner a **short summary** of the plan (the scaffold, the stack and its ADRs, the pipeline, the ordered backlog and the first ready change) — not the whole document — and return to the flow the **`ready`** outcome. If any item is missing, stay in the interview until you close it; if the owner wants to review before you signal, let them review and adjust the deliverable.

Do not open the approval gate here: it is the next `human_gate` step of the flow. Once `ready` is returned, the flow presents the gate and the owner decides.

## Outputs

- `docs/design/4-implementation-plan.md` — this phase's deliverable (scaffold + stack traced to ADRs + minimum pipeline + backlog of vertical changes with acceptance criteria; first change ready for `/aidakit:flow-fast`/`/aidakit:flow-full`).
- `docs/roadmap/epics/EPIC-<slug>.md` — the backlog emitted as roadmap epics (features → change-ids), so the project has a status-derived roadmap immediately.
- New ADRs from this phase in `docs/decisions/ADR-NNN-slug.md`, registered in the index `docs/decisions/README.md`.
- `docs/design/STATE.md` updated with the stopping point and, when the phase closes, the "Execution" section ready to receive the changes. (Marking the phase as *approved* in the STATE happens after the flow's human gate, not here.)
- **Outcome to the flow:** `ready` when the exit checklist is satisfied.

### Exit checklist (condition for `ready`)

- [ ] Scaffold defined mirroring the context map
- [ ] Stack confirmed, each piece traceable to an ADR in `docs/decisions/`
- [ ] Minimum pipeline described (build/test/deploy)
- [ ] Backlog of vertical changes ordered by risk+value, each with an acceptance criterion
- [ ] Backlog emitted as roadmap epics in `docs/roadmap/epics/` (features → change-ids)
- [ ] First change specified and ready for the aidakit cycle (`/aidakit:flow-fast`/`/aidakit:flow-full`)

> The phase's last item — "the project's design is complete; execution begins" — is the **owner's explicit approval**, and it lives in the flow's human gate, not in this checklist. This skill only ensures the five items above and signals `ready`.

## Gates and guardrails

- **The approval gate belongs to the flow, not to the skill.** This skill runs the phase and returns `ready`; the next `human_gate` of [design.yaml](../../governance/flows/design.yaml) is the one that collects the owner's "I approve". Do not simulate or anticipate that gate.
- **Order is law:** this is the last phase and depends on the three earlier ones being approved. An execution matter that comes up at the wrong time (e.g. a detail of a specific change) goes to the "Parking lot" of `STATE.md` or to the `/aidakit:flow-fast`/`/aidakit:flow-full` cycle itself — not into the architecture plan.
- **An ADR is WORM** (DOCS.md): an approved decision is never edited — a new ADR that supersedes or amends. Contradicting or superseding an existing ADR escalates to the human (`GOVERNANCE.md`).
- **A new stack piece without an ADR = a premature decision:** do not put it in the plan; go back to Phase 3 and record the decision first.
- **From here on, execution follows GOVERNANCE.md:** short branch + PR, the human does the merge, the agent never.

## Related

- [governance/flows/design.yaml](../../governance/flows/design.yaml) — the flow that dispatches this skill as phase 4 and forces the next human gate.
- `aidakit:design-architecture` — Phase 3 (Architecture), a direct input: the ADRs and the context map that this phase materializes.
- `aidakit:docs` — deploys and audits the standard `docs/` structure.
- `aidakit:catalog` — searchable index of all the kit's tools.
- Post-Phase 4 execution cycle: `/aidakit:flow-fast`/`/aidakit:flow-full` — builds each change of the plan to the PR (the flow itself picks the next ready change at startup). Reference: `PROCESS.md` at the root of the plugin.
- Support for the phase: `engineering:system-design`.

<!-- aidakit v0.3 — skill design-implementation (Phase 4, ex-phase of the design skill): runs the implementation interview, delivers docs/design/4-implementation-plan.md, returns the "ready" outcome; the human gate belongs to the design.yaml flow, 2026-07-17 — translated to EN -->
