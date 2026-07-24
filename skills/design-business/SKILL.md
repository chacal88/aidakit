---
name: design-business
description: Phase 1 of design — Business. Runs the interview that understands the business BEFORE any technical decision (goals, processes, rules, experts, ubiquitous language), produces the deliverable docs/design/1-business-vision.md and returns "ready" when the exit checklist is satisfied. Dispatched by the design flow (governance/flows/design.yaml) as phase 1; the approval gate belongs to the flow, not to this skill. Use when the design flow reaches Phase 1, or when the user asks to (re)do the business vision of a new project.
---

# aidakit:design-business — Phase 1: Business

> Understands the business before any technical decision. Runs the Phase 1 interview (one question at a time), fills the deliverable `docs/design/1-business-vision.md` and returns `ready` to the flow when the exit checklist is satisfied. **DDD is not about microservices — it is about understanding the business.** No technology in this phase.

## When to use (and when not)

- **Use** when the `design` flow (`governance/flows/design.yaml`) dispatches this phase — it is **phase 1** of the architecture design journey, the first step before Modeling, Architecture and Implementation.
- **Use** when starting a new project (there is no business deliverable yet) or when resuming an in-progress Phase 1 (there is a `docs/design/STATE.md` pointing to the Business phase).
- **Do not use** for the later phases — DDD Modeling, Architecture and Implementation have their own skills that the flow dispatches after this one.
- **Do not use** to build an already-planned change — that is the execution cycle (`/aidakit:flow-build`). Do not use for pointed changes in an existing system that do not call for redefining the architecture.
- **Do not run the approval here.** Approving the deliverable is a `human_gate` of the flow, immediately AFTER this skill returns `ready`. This skill runs the phase and signals that it is ready; who decides "approved" is the owner, at the flow's gate.

## Prerequisites

- **Standard `docs/` structure already existing.** On the first design run in a project, `aidakit:docs` init should already have spawned the structure (`INDEX.md`, `design/`, `decisions/`, ...) per DOCS.md. This phase writes only inside that structure; if `docs/design/` does not exist, run `aidakit:docs` init first.
- **`docs/design/STATE.md` present.** It is the single source of the design's state. If it does not exist, the `design` flow creates it from the `STATE.md` template, with the project name and one sentence, before entering this phase.
- **Access to the user in interview mode.** Phase 1 does not work without the product owner answering — the domain drives the decisions; technology (in the later phases) materializes them.
- **Deliverable template at hand:** `business-vision.md` (this phase's deliverable follows this mold).
- **Content language.** Detect `language` in `aidakit.config.yaml` at the root of the target repo (default `en` if absent). Conduct the interview and write the deliverable IN THAT language — the questions to the owner and the prose of the documents follow `language`. The identifiers, the file names, and the STRUCTURE of the templates (headings, ADR sections) stay as the doctrine defines them; only the prose changes. See [config reference](../../docs/reference/config.md).

## Process

1. **Locate the state.** Read `docs/design/STATE.md`. If Phase 1 has already been approved, do not redo it without an explicit request — announce that it is ready and return `ready`. If it is in progress, announce in one sentence where it stopped (from the "Exact stopping point" and the "Next pending questions") and resume from there, without repeating what has already been answered.

2. **Run the interview in interview mode — one question at a time.** Walk the five axes below IN THIS order, going deeper as answers come in. Adapt to the previous answer; do not dump a questionnaire. When the options are enumerable, offer them as a choice. Record each answer in the draft of the deliverable as you go — do not leave it all to write at the end.

   ### Axis 1. Goals — what does the business need to achieve?
   - What problem does this project solve, and for whom?
   - How will we know it worked? (an observable metric or event, not "success")
   - What happens if the project is NOT done?
   - What is the scope of the first version that already delivers value?

   ### Axis 2. Processes — how is the work done?
   - Describe the end-to-end process TODAY (without the system). Who does what, in what order?
   - Where does the process get stuck, repeat itself or depend on heroics?
   - Which steps will the system absorb, and which remain human?

   ### Axis 3. Rules — what are the rules of the game?
   - Which rules can never be violated? (business invariants)
   - Which rules have exceptions, and who authorizes the exception?
   - Are there deadlines, limits, calculations or validations imposed by law/contract?

   ### Axis 4. Domain experts — who really understands the business?
   - Who answers the questions when no one else knows? (name/role)
   - Is that expert accessible during the project?
   - Where do experts disagree with each other? (a classic signal of distinct bounded contexts — note it for Phase 2)

   ### Axis 5. Ubiquitous language — what is the language of the domain?
   - List the terms the business uses (nouns and verbs). Define each one in the expert's own sentence.
   - Are there terms with different meanings in different areas? (note it — it becomes a context boundary in Phase 2)
   - Are there synonyms that should be unified? Choose ONE canonical term per concept.

3. **Interview tone.** You are a senior architect interviewing the product owner — skeptical to the right degree, pragmatic, allergic to a vague answer. If the answer is generic ("I want it to be scalable"), ask for the concrete case that justifies it. No technology: if the user wants to jump ahead to a matter of a future phase (e.g. database, framework, Kubernetes), note it in `STATE.md` under the "Parking lot" section and return the focus to Phase 1 — the domain drives the decisions; technology materializes them.

4. **Write the deliverable** in `docs/design/1-business-vision.md` using the `business-vision.md` template. The five sections of the template map one-to-one onto the five axes: 1 Goals (problem, observable success criterion, cost of not doing it, scope of the first version, explicit out of scope) · 2 Processes (current without the system / future with the system) · 3 Rules of the game (invariants table with origin × table of rules with exception and who authorizes) · 4 Domain experts (name/role × area × accessibility table, plus divergences that are candidates for a context boundary) · 5 Ubiquitous-language glossary (canonical term × definition in the expert's sentence × absorbed synonyms × ambiguity across areas).

5. **Check the exit checklist** (below, under Gates and guardrails). While any essential item is still open, go back to the corresponding axis and continue the interview — do not return `ready` with the checklist incomplete.

6. **When the checklist is satisfied, return `ready` to the flow.** Beforehand, show the owner a short summary of the deliverable (not the whole document) and offer the chance to review/adjust. Update `STATE.md` (Phase 1 situation = awaiting approval, deliverable link, key decisions and any term/divergence parked for Phase 2). The flow then runs its approval `human_gate`; the "approved" decision belongs to the owner, there, not here.

7. **End of session mid-phase.** If the conversation ends before the checklist closes, update `STATE.md` with the exact stopping point and the next 2–3 pending questions, so the next run of this phase resumes without losing context.

### Support skills for this phase

- `product-management:brainstorm` — if the problem is still vague and needs exploration before the interview.
- `product-management:write-spec` — if the user wants to formalize the vision as a PRD beyond the standard deliverable.
- `deep-research` — if there is a market/competition/regulation question that no internal expert can answer.
- For any tool this file does not mention, consult the kit's index: `aidakit:catalog` (`/aidakit:catalog`).

## Outputs

Per DOCS.md (placement and index rules):

- `docs/design/1-business-vision.md` — the Phase 1 deliverable, written from the `business-vision.md` template, with the five axes filled in.
- `docs/design/STATE.md` updated — Phase 1 situation, deliverable link, key decisions and Parking lot (ambiguous terms and expert divergences noted for Phase 2).
- **Outcome to the flow:** `ready` — returned when the exit checklist is satisfied and the deliverable is written. It is the signal for the `design` flow to advance to its approval `human_gate`.

## Gates and guardrails

- **This skill approves nothing.** The deliverable's approval gate is a `human_gate` of the `design` flow, run AFTER this skill returns `ready`. Here you run the phase and signal readiness; the owner's explicit approval happens in the flow.
- **Exit checklist (precondition to return `ready`):**
  - [ ] Goal with an observable success criterion
  - [ ] End-to-end process described (current and future)
  - [ ] Invariant rules separated from rules with exceptions
  - [ ] Experts named and accessibility confirmed
  - [ ] Ubiquitous-language glossary with ≥ the 10 core terms, one canonical per concept
  - [ ] Cross-area term ambiguities noted for Phase 2
- **No technology in this phase.** A technical or future-phase matter goes to the "Parking lot" of `STATE.md`, not into the business deliverable — the domain drives the decisions; technology materializes them in the later phases.
- **Order is law.** This is phase 1; the later phases (Modeling, Architecture, Implementation) are dispatched by the flow after this one, each with its own skill. Do not jump ahead to a future-phase decision.
- **Writing via PR.** Every deliverable in a versioned file ships via a short branch + PR; the merge is always the human's (GOVERNANCE.md).

## Related

- Flow `design` (`governance/flows/design.yaml`) — the conductor that dispatches this skill as phase 1, applies the approval `human_gate` after the `ready`, and chains the later phases.
- `aidakit:design-modeling` — Phase 2 (DDD Modeling): consumes this business deliverable as input; receives the ambiguous terms and expert divergences parked here.
- `aidakit:docs` — deploys and audits the standard `docs/` structure (run it at the design init, before this phase).
- `aidakit:catalog` — searchable index of all the kit's tools (`/aidakit:catalog`).
- Support for this phase: `product-management:brainstorm`, `product-management:write-spec`, `deep-research`.

<!-- aidakit v0.3 — Phase 1 (Business) promoted to its own skill, dispatched by the design flow; deliverable in docs/design/1-business-vision.md, returns "ready" to the flow, 2026-07-17 — translated to EN -->
