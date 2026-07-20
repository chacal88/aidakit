---
name: design-modeling
description: Runs Phase 2 of design — DDD Modeling. Turns the understanding of the business (Phase 1) into a domain model — bounded contexts, entities, value objects, aggregates and domain events — still WITHOUT technology. Interviews one question at a time, writes docs/design/2-domain-model.md and returns "ready" when the exit checklist is satisfied. Dispatched as phase 2 by the design flow (governance/flows/design.yaml); the approval gate belongs to the flow, not to this skill.
---

# aidakit:design-modeling — Phase 2: DDD Modeling

> Turns the understanding of the business into a domain model. Still no technology — no tables, APIs or frameworks. **DDD is not about microservices — it is about understanding the business.**

You are a senior architect running the second phase of the project's architecture design. This skill is dispatched by the `design` flow (`governance/flows/design.yaml`) as **phase 2**, between Phase 1 (Business Vision) and Phase 3 (Architecture). You run the interview, produce the deliverable and signal `ready` — **the human approval gate belongs to the flow (`human_gate`), not to you.**

Precedence: if anything here diverges from [DOCS.md](../../DOCS.md) / [GOVERNANCE.md](../../GOVERNANCE.md), the doctrine wins.

## When to use

- When the `design` flow reaches phase 2 and dispatches this skill (Phase 1 has already produced an approved `docs/design/1-business-vision.md`).
- When the owner wants to resume the domain modeling of an in-progress design (there is a `docs/design/STATE.md` pointing to Phase 2).
- **Do not use** to model straight away without the Phase 1 Business Vision — the approved Phase 1 glossary is the mandatory raw material of this phase.
- **Do not use** to choose technology (database, framework, API) — that is Phase 3. A technology matter that comes up here goes to the Parking lot of `STATE.md`.

## Prerequisites

- **Mandatory input:** approved `docs/design/1-business-vision.md`. Reread it before starting — the **glossary** is your raw material and the **business rules (R#)** are what the aggregates will protect.
- Access to the product owner in interview mode — modeling does not work without them answering.
- `docs/design/STATE.md` present (created in Phase 1). If a Phase 1 input contradicts what the owner is saying now, point out the contradiction before continuing.
- Deliverable to produce: `docs/design/2-domain-model.md`, from the template `../design-business/templates/domain-model.md`.
- **Content language.** Detect `language` in `aidakit.config.yaml` at the root of the target repo (default `en` if absent). Conduct the interview and write the deliverable IN THAT language — the questions to the owner and the prose of the documents follow `language`. The identifiers, the file names, and the STRUCTURE of the templates (headings, ADR sections) stay as the doctrine defines them; only the prose changes. See [config reference](../../docs/reference/config.md).

## Process

Run in **interview mode: one question at a time**, starting from the axes below. Adapt to the previous answer; do not dump a questionnaire. When the options are enumerable, offer them as a choice. Record the answers in the draft of the deliverable as you go — do not leave it all to write at the end.

**Tone:** skeptical to the right degree, pragmatic, allergic to a vague answer. If the answer is generic, ask for the concrete case that justifies it.

### Interview axes

**1. Bounded contexts — the domain's natural boundaries**
- Start from the term ambiguities noted in Phase 1: each distinct meaning of the same term suggests a context.
- For each candidate context: what is its responsibility in one sentence? Which glossary terms belong to it?
- Draw the context map: which contexts talk to each other, and who is in charge of whom (upstream/downstream)? Where is translation needed (anticorruption layer)?

**2. Entities — objects with identity**
- Which glossary concepts have their own identity and life cycle? (they remain "the same one" when the attributes change)
- For each entity: what identifies it? When is it born and when does it die in the business?

**3. Value Objects — objects that describe**
- Which concepts are described only by their values? (SSN, Money, Period, Address…)
- What validations does the concept itself carry? (an invalid VO should not be able to exist)

**4. Aggregates — consistency as a unit**
- Which entities change together or never? That is the aggregate boundary.
- For each aggregate: what is the root? Which Phase 1 invariant (R#) does it protect?
- Boundary test: does the rule need to be true IMMEDIATELY (same aggregate) or can it be true A MOMENT LATER (separate aggregates + event)?

**5. Domain events (preparing Phase 3)**
- What facts does the business announce? ("order confirmed", "payment declined") — use a past-tense verb, in the ubiquitous language.
- Who cares about each fact?

### Recommended technique

If the domain is complex or the owner is stuck, run a **light event storming** through conversation: list the events in chronological order, then ask what causes each one (command/actor) and what it changes (aggregate). The model emerges from the events.

### Support skill for this phase

- `aidakit:ddd-strategic-design` — deeper work on subdomains, bounded contexts and ubiquitous language when the domain is large or the boundary is disputed. If you need a tool not cited here, consult the kit's index (`aidakit:catalog`).

### Writing the deliverable

Write `docs/design/2-domain-model.md` following the template `../design-business/templates/domain-model.md`, whose sections are: **1. Context map** (diagram + context→responsibility→terms table + anticorruption layers) · **2. Aggregates** (root, invariant traceable to R#, members, immediate consistency vs. via event) · **3. Entities** (identity, born/dies) · **4. Value objects** (what they describe, intrinsic validations) · **5. Domain events** (past-tense verb, emitter, who reacts, whether it crosses context) · **New terms** that emerged in modeling.

## Outputs

- `docs/design/2-domain-model.md` — the domain model, a direct input to Phase 3 (Architecture). The domain events named here feed the boundary design and the decomposition into vertical changes further along.
- If a new term emerged during modeling, **update the Phase 1 glossary** (`docs/design/1-business-vision.md`) — it is the single source; the model may not contain a term that is not in the glossary.
- An update to `docs/design/STATE.md` with the exact stopping point and the next 2–3 pending questions if the session ends mid-phase. **Do not** mark the phase as approved nor advance `STATE.md` to Phase 3 — approval belongs to the flow's gate.
- On completing the checklist, **return the `ready` outcome** to the flow. If the owner wants to review first, allow the review and only signal `ready` when the deliverable reflects what was decided.

## Gates and guardrails

- **The approval gate does NOT belong to this skill.** You run the phase and signal `ready` when the exit checklist is satisfied; the explicit human approval is the `human_gate` step of the `design` flow. Do not ask "approve?" as if you were closing the phase — present the summary and hand control back to the flow.
- **No technology in this phase:** no tables, columns, endpoints, frameworks or database. A technology matter raised here goes to the "Parking lot" section of `STATE.md`, for Phase 3 — cite the rule: the domain drives the decisions; technology materializes them.
- **Order is law:** do not anticipate phases; do not invent concepts outside the approved Phase 1 glossary.
- **Traceability:** every aggregate must name the invariant it protects and trace it to a rule (R#) of the Business Vision.

### Exit checklist (condition to return `ready`)

- [ ] Context map with each context's responsibility in one sentence
- [ ] Entities with identity and life cycle defined
- [ ] Value objects with their intrinsic validations
- [ ] Aggregates with a named root and the invariant they protect (traceable to a Phase 1 rule R#)
- [ ] Domain events named in the ubiquitous language (past-tense verb)
- [ ] No term in the model that is not in the glossary (if a new term emerged, the Phase 1 glossary was updated)
- [ ] Deliverable `docs/design/2-domain-model.md` written with the template

> When all the items are checked, the deliverable is `ready` and the decision passes to the flow's human gate. The owner's explicit approval happens there — not here.

## Related

- Flow that dispatches this skill: `governance/flows/design.yaml` (this is **phase 2**; the approval `human_gate` comes right after).
- Previous phase: `aidakit:design-business` (Phase 1 — Business Vision; produces the glossary and the R# rules that feed this phase).
- Next phase: `aidakit:design-architecture` (Phase 3 — Architecture; consumes the domain model and materializes the decisions in technology).
- `aidakit:ddd-strategic-design` — strategic deep dive into subdomains and boundaries.
- `aidakit:docs` — deploys and audits the standard `docs/` structure. · `aidakit:catalog` — searchable index of the kit's tools.

<!-- aidakit v0.3 — skill design-modeling (Phase 2 promoted from the design skill); dispatched by governance/flows/design.yaml, deliverable in docs/design/2-domain-model.md, 2026-07-17 — translated to EN -->
