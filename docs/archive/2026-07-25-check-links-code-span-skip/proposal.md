# Proposal — check-links-code-span-skip

**Change ID:** `check-links-code-span-skip`
**Date:** `2026-07-25`
**Owner:** `@chacal88`
**Epic:** [Endurecimento da disciplina do próprio kit](../../roadmap/epics/EPIC-kit-discipline-hardening.md)
**Status:** shipped — commit `ec2ce7e` (merged via PR [#45](https://github.com/chacal88/aidakit/pull/45), 2026-07-25 UTC).

> Retroactive archive stub. This change shipped as a direct fix (no `docs/features/` lifecycle — PR #45 carried only the validator, its tests and the roadmap registration), so its roadmap status is recorded here — the archive dir is the disk evidence the deriver reads for `done` (ADR-002, as amended by ADR-007). Same pattern as [`flow-commit-plan-early`](../2026-07-24-flow-commit-plan-early/proposal.md).

## Problem

`governance/validators/check-links.js` read a markdown link inside an inline code span as a navigable address. A link in a code span is documentation of a FORMAT, not an address — the motivating line, `skills/context-pack/SKILL.md:26`, documents the shape the skill emits (`- [ADR-NNN](path) — role`) and therefore could NEVER pass the validator. A validator that always fails trains the reader to ignore its output.

## What shipped

`stripInlineCode()` blanks inline code spans before link extraction — the same jurisprudence check-links already applied to fenced blocks, one granularity down:

- Follows CommonMark's code-span rule (a run of N backticks opens, the next run of exactly N closes), scoped to the line like the existing fence toggle.
- An unclosed backtick run stays literal — fail-open: a link after a stray tick is still checked; the validator may report a placeholder, it never silently skips a real link.
- Spans are replaced by spaces, not deleted, so surrounding text cannot splice into a link nobody wrote, and a real link whose TEXT is a code span still resolves.
- Measured on the merged tree: 985 → 983 extracted links — exactly the 2 code-span placeholders in this change's own epic entry newly skipped, zero previously-checked links lost; repo-wide result 2 broken → 0.

Complements PR #46's `resolveArchived()` (ADR-014): that absorbs archive rot in links that WERE addresses; this one declines links that never were.

## Acceptance (met)

- Placeholder link-shape inside an inline code span and inside a fenced block are both skipped. ✔ (`governance/__tests__/check-links.test.mjs`, mutation-tested — reverting `stripInlineCode` to identity fails 4 assertions.)
- `node governance/validators/check-links.js skills/context-pack/SKILL.md` exits 0. ✔ (re-run on this tree at archive time: `ok: true`, 1 file, no broken links.)
- Full `governance/__tests__/*.test.mjs` suite green, no regression. ✔ (`check-links.test.mjs` re-run on this tree at archive time: pass, 0 fail.)
