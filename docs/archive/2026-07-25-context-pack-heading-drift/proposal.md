# Proposal — context-pack-heading-drift

**Change ID:** `context-pack-heading-drift`
**Date:** `2026-07-25`
**Owner:** `@chacal88`
**Epic:** [Endurecimento da disciplina do próprio kit](../../roadmap/epics/EPIC-kit-discipline-hardening.md)
**Status:** shipped — commit `43201d5` (merged via PR [#47](https://github.com/chacal88/aidakit/pull/47), 2026-07-25 UTC).

> Retroactive archive stub. This change shipped as a direct fix (no `docs/features/` lifecycle — PR #47 carried the builder fix, its tests and the roadmap registration), so its roadmap status is recorded here — the archive dir is the disk evidence the deriver reads for `done` (ADR-002, as amended by ADR-007). Same pattern as [`flow-commit-plan-early`](../2026-07-24-flow-commit-plan-early/proposal.md).
>
> **Duplicate registration, single delivery:** [`context-pack-heading-alignment`](../2026-07-25-context-pack-heading-alignment/proposal.md) is the SAME defect registered earlier as a debit (round 1 of the `step-summaries-type-gate-tests` review) by a concurrent worktree; `context-pack-heading-drift` is the registration made by the delivering PR itself. One fix satisfies both aceites; both ids archive against commit `43201d5`.

## Problem

`governance/context-pack/build.js` derived two of ADR-013's six pack sections from heading names the kit no longer emits: `summary` from `## Problem` (the plan skill emits `## Why`) and the DoD from `## Success criteria` (ADR-010 §Decision-3 mandates `## Acceptance criteria`). Every conforming change therefore shipped a pack with `summary:` empty and `DoD: (no success criteria found)` — and since the pack is the stable context prefix injected into every dispatcher/reviewer ([ADR-013](../../decisions/ADR-013-context-pack-per-change.md)), those dispatches lost exactly the two things the pack exists to carry. Confirmed live on the `step-summaries-type-gate-tests` pack.

## What shipped

- Both derivations read the mandated heading first (`## Why`, `## Acceptance criteria`) and accept the legacy name as fallback, so in-flight changes authored either way still build a populated pack.
- The DoD parse REUSES `governance/acceptance/parse-criteria.js`'s text-level parser (single owner of the `## Acceptance criteria` grammar per ADR-010 §Decision-3) — deliberately NOT `parseCriteria()`, whose precedence prefers the gitignored `.aidakit/tasks/<id>/brainstorm.json` and would break ADR-013 byte-stability. `## Exit criteria` is never folded in.
- `sectionBody` became case-insensitive; the legacy list parser accepts `-`/`*` bullets, not just `1.`.
- No `.context-pack.md` was hand-edited (generated artifacts); affected packs regenerate on their next `context_pack` step.

## Acceptance (met)

- A pack built from a conforming proposal has non-empty `summary` and a real DoD. ✔ (§4b in `governance/__tests__/context-pack.test.mjs`, 13 assertions, mutation-verified in PR #47; the legacy §4 fixture doubles as the fallback regression.)
- Suite green, no regression. ✔ (PR #47: full governance suite 1038 passed, 0 failed; `context-pack.test.mjs` re-run on this tree at archive time: pass, 0 fail.)
