---
name: identify-domain
description: Classifies the delivery into domain × type × flags to select the brainstorm's "ammunition" and the review matrix. Use as the first step of a change — before the brainstorm and the spec. Triggers when the user starts new work ("let's build X", "new change", "I need a feature/bugfix"), or when a flow reaches the classification step. Fail-closed: when in doubt, the strictest track.
---

# aidakit:identify-domain — classify the delivery

> Classifies the change into domain × type × flags. It is what SELECTS what [aidakit:brainstorm](../brainstorm/SKILL.md) will grill against and WHICH roles [aidakit:review](../review/SKILL.md) convenes. Every change starts here.

Precedence: if it diverges from [DOCS.md](../../DOCS.md) or [GOVERNANCE.md](../../GOVERNANCE.md), the doctrine wins and this skill is corrected.

## When to use (and when not)

- **Use** it as step 1 of any new change, before brainstorm and spec.
- **Don't use** it for already-classified work (the classification lives in the change package — reuse it).

## Prerequisites

- A natural-language request from the owner, or the change-id of an already-open change.
- Optional: a project domain map (see below). Without it, the skill operates with the generic `product` domain.

## Process (fail-closed algorithm)

1. **Already classified?** If the change package (`docs/features/<change-id>/` or the change metadata) declares a domain and the owner confirmed it, use that value.

2. **Domain — by where the work touches.** The project may declare its domains in a `domain-by-path` map in `aidakit.config.yaml` (each domain lists the globs that belong to it and its strictness order). Apply the first match by path.
   - Mechanism-only paths (`docs/`, `.aidakit/`, `scripts/`, config) → `process` domain (built-in).
   - If the project declares no domains → single domain `product`.
   - Mixed → the **strictest** of the touched domains, by the declared strictness order.

3. **Type:** "doesn't work / Y came back instead of Z" → `bug`; data/schema migration → `migration`; the rest → `feature`. The project may declare its own types.

4. **Flags** (sum all that apply): the UI changes → `ui`; structure/responsibility/boundary changes → `architecture`; the contract between modules changes → `contract`; a real external resource is needed to validate (third-party service, hardware) → the resource flag the project declares.

5. **Ambiguous → STRICTEST track** + mark `classification: strict-assumed` (the brainstorm/pre-apply gate confirms with the owner). **Never** default to the weakest.

## Outputs

A classification object — `{ domain, type, flags[], classification }` — recorded in the change package (or returned to the flow step that invoked it). Feeds the brainstorm's ammunition selection and the review's convening matrix.

## Gates and guardrails

- Fail-closed is the rule: doubt raises the strictness, it does not reduce it (GOVERNANCE.md §1, scope escalation).
- The skill classifies; it does not implement nor decide the design.

## Related

- [aidakit:brainstorm](../brainstorm/SKILL.md) — consumes the classification to choose the ammunition.
- [aidakit:review](../review/SKILL.md) — consumes the flags for the convening matrix.

<!-- aidakit v0.3 — adapted from identify-domain (codeflow/psim), generic ammunition — translated to EN -->
