# Evidence — context-pack-heading-drift

**Change ID:** `context-pack-heading-drift`
**Date:** `2026-07-25`
**Commit:** `43201d5` — merged via PR [#47](https://github.com/chacal88/aidakit/pull/47)

## What proves it shipped

| Acceptance criterion | Evidence |
|---|---|
| `summary` derives from `## Why`, DoD from `## Acceptance criteria`, legacy fallback kept | `governance/context-pack/build.js` on main post-`43201d5`; §4b of `governance/__tests__/context-pack.test.mjs` (13 assertions, mutation-verified: reverting the summary heading → 2 RED, skipping the mandated DoD parse → 4 RED, folding `## Exit criteria` → 2 RED, dropping case-insensitivity → 1 RED). |
| Single owner of the criteria grammar reused | DoD parse calls the exported text-level parser of `governance/acceptance/parse-criteria.js` (ADR-010 §Decision-3), not a second grammar; never `parseCriteria()` (gitignored-source precedence would violate ADR-013 §Decision-1/4 byte-stability). |
| No generated artifact hand-edited | PR #47 touches no `.context-pack.md`; archived `context-pack-l1` pack proven byte-identical when rebuilt. |
| Suite green | PR #47: 1038 passed, 0 failed. Re-run on this tree at archive time (2026-07-25): `node --test governance/__tests__/context-pack.test.mjs` → pass 1, fail 0. |

## Companion registration

[`context-pack-heading-alignment`](../2026-07-25-context-pack-heading-alignment/evidence.md) — same delivery, registered earlier as a review-round debit by a concurrent worktree. Both ids resolve to commit `43201d5`.
