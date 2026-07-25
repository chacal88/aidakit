# Evidence — check-links-code-span-skip

**Change ID:** `check-links-code-span-skip`
**Date:** `2026-07-25`
**Commit:** `ec2ce7e` — merged via PR [#45](https://github.com/chacal88/aidakit/pull/45)

## What proves it shipped

| Acceptance criterion | Evidence |
|---|---|
| Code-span link-shape skipped, fence skip preserved | `governance/__tests__/check-links.test.mjs` — 9 assertions added by PR #45, mutation-tested against the merged file (reverting `stripInlineCode` to identity fails 4; over-eager blanking fails others). |
| Motivating file passes | `node governance/validators/check-links.js skills/context-pack/SKILL.md` → exit 0, `{"ok":true,"files_checked":1,"errors":[]}` — re-run on this tree at archive time (2026-07-25). |
| No real link silently lost | Measured in PR #45 by diffing the full extracted-link set: 985 → 983 links; the only 2 newly-skipped are the code-span placeholders in the epic entry itself. Fail-open on unclosed backtick runs. |
| Suite green | `node --test governance/__tests__/check-links.test.mjs` → pass 1, fail 0 — re-run on this tree at archive time. |

## Relation to neighbors

- [ADR-014](../../decisions/ADR-014-archive-aware-link-resolution.md) / PR #46 — absorbs archive rot in links that WERE addresses; this change declines links that never were (orthogonal axes, recorded as a non-goal on the epic).
- PR #47 rewrote the one motivating line's `(path)` to `(<path>)` (site-local fix); this change is the general rule that makes that rewrite unnecessary.
