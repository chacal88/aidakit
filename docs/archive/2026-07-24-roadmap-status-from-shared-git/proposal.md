# Proposal — roadmap-status-from-shared-git

**Change ID:** `roadmap-status-from-shared-git`
**Date:** `2026-07-24`
**Owner:** `@chacal88`
**Epic:** [Coleiras mecânicas do flow engine](../../roadmap/epics/EPIC-flow-engine-leashes.md)
**Status:** shipped — PR [#21](https://github.com/chacal88/aidakit/pull/21), merged `1e5019b`.

> Retroactive archive stub. This change shipped as a direct fix (no `docs/features/` lifecycle), so its roadmap status is recorded here — the archive dir is the disk evidence the deriver reads for `done` (ADR-002, as amended by ADR-007).

## Problem

`derive-roadmap-status.js` derived `in-progress`/`done` by `existsSync`-ing the local working tree. Under git worktrees — which the kit's own flows run in — a change planned in one worktree was invisible to a deriver run in another, so the status depended on **where** you asked it (`in-progress` in the authoring tree, `backlog` in main). That is the drift ADR-002 set out to kill, reintroduced by geometry.

## What shipped

Derive from the substrate every worktree shares — the git refs. The deriver reads the artifact dirs committed on any branch (`git ls-tree` per ref, O(branches), never a worktree filesystem walk) and injects `gitFeatureIds`/`gitArchiveDirs` via `ctx`, so `roadmap.js` stays pure. `deriveChangeStatus` unions the shared git signal with the local working tree; no git → disk-only fallback. Recorded as **ADR-007** (amends ADR-002).

## Acceptance (met)

- The derived status is single-valued across worktrees for committed work. ✔ (PR #21, `roadmap.test.mjs` 28/28)
- No git → byte-for-byte the pre-change disk-only behavior. ✔
- ADR-007 amends ADR-002 with a bidirectional link; `check-adr-format` green. ✔
