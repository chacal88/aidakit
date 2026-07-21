---
name: brainstorm
description: Adversarial brainstorm, default-on — the 1st phase of specification, BEFORE writing a spec or spending implementation tokens. This skill is the DOCTRINE (the 4 attack axes, default-on, opt-out, event trail, calibration) + the DISPATCH of the aidakit:brainstorm agent, which grills the owner in an isolated context; the skill integrates the verdict back. Use at the start of any new change, when exploring an idea, or as the first step of a flow. Opt out via natural language ("I don't want a brainstorm", "skip this"). It is a gate — the event trail transitions the phase.
---

# aidakit:brainstorm — the brainstorm that grills

> Helps the owner EVOLVE the idea and extract the doubt they didn't know they had, BEFORE writing the artifacts. It is not a new bureaucratic stop — it is the deepest gate 1. The questions are not loose: they are **ammunition derived from the project's law**.

Precedence: if it diverges from [DOCS.md](../../DOCS.md) / [GOVERNANCE.md](../../GOVERNANCE.md), the doctrine wins and this skill is corrected.

## The skill is the doctrine + the dispatch; the agent is the executor

This skill **does not grill the owner in the current context**. It does two things and stops:

1. **Loads the doctrine** — the 4 attack axes, the default-on, the opt-out, calibration by complexity, and the event trail. This is the LAW the skill hands to the executor; it does not change when the context changes.
2. **Dispatches the [aidakit:brainstorm](../../agents/brainstorm.md) agent** (`subagent_type: "aidakit:brainstorm"`), which runs in an **isolated context**: it is IT that absorbs the ammunition and grills the owner via AskUserQuestion, without polluting the main window with the back-and-forth of the interrogation. The skill then **integrates the verdict** the agent returns (assumptions + criteria + the `brainstorm-event`) and passes it on to the next phase.

Why separate: the grilling is long and full of back-and-forth; running it in the main context bloats the window with disposable reasoning. The agent isolates that and returns only the distillate. **The doctrine belongs to the skill (loads and enforces it); the work of grilling belongs to the agent (executes in isolation).**

## When to use (and when not)

- **Use** it as the FIRST phase of any broad, architectural, or irreversible change — before the spec. Default-on: run it without asking "want a brainstorm?".
- **Don't use** it (opt-out) when the owner explicitly says they don't want one ("I don't want a brainstorm", "skip the brainstorm"). Then don't dispatch the agent: record the skip trail and move on.
- For a trivial and reversible change, instruct the agent to calibrate to few questions — don't turn it into friction.

## Prerequisites

- The classification from [aidakit:identify-domain](../identify-domain/SKILL.md) (domain × type × flags) — it is what selects the ammunition.
- Access to the project's "ammunition" (see Process, step 2) — the skill locates it and hands it to the agent as an envelope (or as pointers for the agent to read).
- The `aidakit:brainstorm` agent available.

## The doctrine the skill loads

This is the LAW handed to the agent on dispatch — it belongs to the skill, the agent executes it.

**Default-on.** Run unless there is an explicit opt-out; don't ask permission.

**Calibration by complexity.** Trivial/reversible change → few questions, converge fast. Broad/irreversible/`architecture`/`contract` change → grill deeper. Don't turn it into an endless interrogation.

**The 4 attack axes** (the questions derive FROM THE AMMUNITION, never generic):

- **Scope:** what is IN and what is OUT? What is the owner NOT asking for that someone might assume they are?
- **End effect:** what is the OBSERVABLE state of "done"? (not "success = true" — the real effect in the world. E.g.: "the cancelled appointment frees the professional's slot for a new booking", not "returns 200".)
- **Edges:** empty, error, concurrency, large volume. (Performance is often a gate — ask.)
- **Confrontation with the law:** "this is the inviolable rule X (ADR-00N) — does your request respect it, or do you want an explicit and recorded exception?"

**Classification of each doubt.** Critical doubt (changes what is delivered) → interrogate until resolved, it becomes an acceptance criterion. Small/reversible doubt → becomes a recorded **assumption**, does not block.

**Event trail whenever it decides.** Ran → `{ "kind": "brainstorm", "questions": <n>, "assumptions": <n> }`; opt-out → `{ "kind": "brainstorm-skipped", "reason": "..." }`. Without the event, the flow gate does not transition from `brainstorm` to `specify`.

## Process

### 1. Check the opt-out first
If the owner has already said they don't want a brainstorm: honor it on this change (don't ask again), **don't dispatch the agent**, record the skip trail, and go straight to the spec. The skip `brainstorm-event` (`brainstorm-skipped`) is what satisfies the gate — the skill emits it itself in this case, without spending a subagent.

### 2. Locate the ammunition of the classified domain
The ammunition is the documents that give the question its adversarial edge — the skill locates them to hand to the agent:
- the project's **relevant ADRs** (in `docs/decisions/`, via the index) — the locked decisions;
- the project's/domain's **Definition of Done**, if declared;
- the **inviolable rules** the project or domain declares;
- for a change that touches an external resource, that resource's material (protocol, known limitations).

If the project declares none of this, the minimal ammunition is: the existing ADRs + the rules from [DOCS.md](../../DOCS.md)/[GOVERNANCE.md](../../GOVERNANCE.md). You can hand the ammunition already read or as **pointers** (paths/index) — the agent reads what is missing.

### 3. Dispatch the aidakit:brainstorm agent (isolated context)
Invoke `subagent_type: "aidakit:brainstorm"` with a self-contained envelope carrying the doctrine and the ammunition:

> Conduct the adversarial brainstorm of the change `<slug/description>` in an isolated context, following the doctrine below.
>
> **Envelope:** `{ request: "<owner's request verbatim>", domain: "<classification from aidakit:identify-domain>", ammunition: <ammunition read OR pointers: docs/decisions/ + index, DoD, inviolable rules, external-resource material> }`. If the ammunition comes as pointers, read it yourself before grilling.
>
> **Doctrine (the law you obey):** grill along the 4 axes — scope, end effect (observable state, not `success=true`), edges (empty/error/concurrency/volume; performance is a gate), and confrontation with the law (inviolable rule X / ADR-00N: respected or recorded exception?). Derive EVERY question from the ammunition — nothing generic. Use AskUserQuestion, one line of reasoning at a time, following the thread the answer resonates. Calibrate the depth by complexity (trivial/reversible → few; broad/irreversible/`architecture`/`contract` → deep); don't turn it into an endless interrogation. Critical doubt → interrogate, it becomes an acceptance criterion; small/reversible doubt → becomes a recorded assumption. Collision with an ADR/inviolable rule or scope beyond what was approved → record it as an escalation to the human (GOVERNANCE.md §1), don't decide on your own.
>
> **Return** the verdict in your output format: the `brainstorm-event:` line at the top, followed by the assumptions, acceptance criteria, questions asked, and escalations. Don't write a spec and don't implement.

### 4. Integrate the verdict back
The agent returns the verdict block. The skill:
- **Passes the assumptions + acceptance criteria** on to spec generation ([aidakit:plan](../plan/SKILL.md)) as input.
- **Propagates the `brainstorm-event`** to the flow state (or records it in `.aidakit/tasks/<slug>/events.ndjson` when outside a flow) — it is what satisfies the gate. Don't rewrite the event; propagate what the agent emitted.
- **Don't implement and don't write the spec here.** Brainstorm is thinking; the spec belongs to another step.

### 5. Map the outcome to the flow
In a flow, the `brainstorm` step expects `done` | `skipped`. Translate the agent's `brainstorm-event`: `brainstorm` → `done`; `brainstorm-skipped` (or the opt-out skip from step 1) → `skipped`. Both advance to `specify`.

If the verdict brings an **escalation** (collision with an ADR/inviolable rule, or scope beyond what was approved), don't advance on your own: present the escalation and wait for the human (GOVERNANCE.md §1).

## Outputs

Assumptions and acceptance criteria (input for the spec) + the `brainstorm-event` (`brainstorm` or `brainstorm-skipped`) propagated to the flow state. The back-and-forth of the interrogation stays in the agent's isolated context — only the distillate returns.

## Gates and guardrails

- **Default-on.** Run unless there is an explicit opt-out; don't ask permission.
- **The skill does not grill; it dispatches.** The grilling runs in the `aidakit:brainstorm` agent (isolated context). On opt-out, it doesn't even dispatch — it just records the skip.
- **Trail whenever it decides.** Without the `brainstorm-event` (ran or skipped), the flow gate does not transition from `brainstorm` to `specify`.
- **The ammunition is the project's law**, not third-party docs — the questions confront the request against the real ADRs/rules (the skill hands over the ammunition; the agent uses it).
- **Don't implement.** It only extracts requirements and feeds the spec.
- **Escalation is not worked around** (GOVERNANCE.md §1): a collision with an ADR/inviolable rule or scope beyond what was approved that the agent reports escalates to the human — the skill does not advance in silence.

## Related

- [aidakit:brainstorm (agent)](../../agents/brainstorm.md) — the isolated executor this skill dispatches and whose output it integrates.
- [aidakit:identify-domain](../identify-domain/SKILL.md) — classifies first, selects the ammunition.
- [aidakit:plan](../plan/SKILL.md) — receives the assumptions and criteria.
- Invoked as the 1st step of the [full](../../governance/flows/full.yaml) flow.

<!-- aidakit v0.3 — went thin: doctrine (4 axes, default-on, opt-out, trail, calibration) + dispatch of the aidakit:brainstorm agent (isolated context); port of guided-discovery (codeflow/psim, ADR-0049) 2026-07-17 — translated to EN -->
