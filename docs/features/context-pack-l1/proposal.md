# Proposal — context-pack-l1

**Change ID:** `context-pack-l1`
**Date:** `2026-07-24`
**Owner:** `@chacal88`
**Phase / Package:** `skills + agents + governance (flows/validators) — per-change L1 context pack`
**PRD:** `n/a`
**Tech Spec:** `n/a`

## Problem

Every dispatch of a subagent in a change's flow re-reads the same durable per-change context: `proposal.md`, `design.md`, `tasks.md`, the cited ADRs, and the relevant capability specs. That context is stable for the whole change and often for the whole session, yet every dispatcher pays its full size again — and the reviewers dispatched right after it pay it again on top.

The owner's own measurement, crystallized as memory `aidakit-token-cost-drivers`, is the hard evidence: **98 % of real token cost is `cache_read`**; an 8-hour session accounts for ~61 % of a day's total; the root cause is re-reading long durable context, not the flow-engine steps themselves. The PoC on 2026-07-24 (E2 of this change's brainstorm) sharpened the picture further: cross-dispatch cache hits at the SDK layer only fire for the **same `subagent_type`** (~59 % of the SDK-owned prefix); cross-type dispatches — the norm in this flow — are complete misses. The naive assumption that "the cache handles it" is empirically false for the workload we actually run.

The mechanism to fix it must be repo-native — deterministic, byte-stable, hash-invalidated — because we cannot re-tune Anthropic's cache policy from inside the kit. The win we *can* engineer is **prefix-size reduction**: shrinking what each dispatch processes in the first place. That win is independent of hit-rate, so it survives whatever the SDK does upstream.

## Solution

Introduce **L1 context caching** as a first-class per-change artifact:

- `docs/features/<change-id>/.context-pack.md` — a small, curated markdown file with frontmatter listing every source it distills (`{path, sha256}`) and six fixed sections: `identity`, `decisions`, `ADRs`, `specs`, `code-map-pointers`, `DoD`. Pointers only (`file:line`) — **no code excerpts**, because excerpts drift and re-introduce the very re-read cost this change removes.
- A new skill `aidakit:context-pack` (`build`, `verify`, `rebuild`) that authors and refreshes the pack, always deterministically (byte-stable across builds when the sources are unchanged).
- A new flow phase inserted between `readiness` and `implement` in both `governance/flows/full.yaml` and `governance/flows/fast.yaml`, which lazily rebuilds the pack when any declared source's sha256 changed.
- All dispatchers and reviewers — `implement`, `review`, `ship`, `aidakit:adr-reviewer`, `aidakit:spec-reviewer`, `aidakit:reviewer-quality`, `aidakit:reviewer-security`, `aidakit:reviewer-architecture`, `aidakit:tester` — **verify-then-inject the pack** as a stable prefix instead of re-reading the durable sources one by one. Injecting the same bytes across dispatches preserves whatever same-subagent-type cache reuse the SDK does provide, while shrinking every cross-type dispatch to the size of the pack.
- Two new validators under `governance/validators/`: `check-context-pack.js` (byte-stability of the pack — reject wall-clock-varying content like timestamps, random ids or ephemeral paths) and `check-context-pack-freshness.js` (invalidation by hash-check scoped to `sources[]` of *this* change, never a repo-wide glob). Freshness is a **separate** validator from `check-doc-manifest.js` — a stale pack must not be conflated with a missing mandatory document and must not block the doc-leash.
- Telemetry: `.aidakit/tasks/<change-id>/.telemetry.jsonl` (append-only, gitignored) records per dispatch `{subagent, cache_creation, cache_read, pack_size, duration, pack_rebuilt}`. The MVP has no live TUI; the end-of-run rollup is written into `evidence.md` by `aidakit:learn` before the worktree is cleaned.
- A new ADR — **ADR-010** — registers the context pack as a first-class artifact and locks its frontmatter schema, its invalidation semantics and the validator split.

The premise is unambiguous: **L1 wins by shrinking the per-dispatch prefix, not by depending on cross-dispatch cache hits.** Any future SDK-side cache improvements are additive, not required.

## Scope

- Author the `.context-pack.md` schema (frontmatter with `sources[]` of `{path, sha256}`; six fixed sections; pointers-only rule).
- Ship the `aidakit:context-pack` skill (`build`, `verify`, `rebuild`).
- Insert a new phase in `full.yaml` and `fast.yaml` between `readiness` and `implement` that verifies pack freshness and rebuilds lazily.
- Wire the pack into every dispatcher/reviewer named above.
- Ship both validators (byte-stability + freshness) under the `AIDAKIT_GOVERNANCE` contract of [ADR-004](../../decisions/ADR-004-aidakit-governance-env-contract.md).
- Ship the telemetry JSONL file, gitignored, and extend `aidakit:learn` to distill it into `evidence.md` at the end of the run.
- Author [ADR-010](../../decisions/ADR-010-context-pack-per-change.md) and register it in `docs/decisions/README.md`.

## Non-goals

- **No embeddings, no vector store, no ANN index.** Those are L2 and stay explicitly out of this change, per [EPIC-context-caching](../../roadmap/epics/EPIC-context-caching.md). L2 is triggered by data — not by calendar — after L1 reports metrics.
- **No cross-change knowledge sharing.** The pack's `sources[]` scope is *this* change; the invalidation glob never widens beyond it. Cross-change reuse is L2's problem.
- **No live TUI or streaming cache/token display during a run.** That belongs to a future change under [EPIC-flow-cli-ux](../../roadmap/epics/EPIC-flow-cli-ux.md) (working name `flow-step-summaries`, not yet started). This change's MVP writes telemetry only; the rollup lands in `evidence.md`.
- **No changes to `governance/flows/design.yaml` or `docs-onboarding.yaml`.** The new phase lands only in `full.yaml` and `fast.yaml` — the flows the epic named. Extending to other flows is a follow-up.
- **No repo-wide glob invalidation.** Freshness is strictly scoped to the pack's own declared `sources[]`. A repo-wide watcher would defeat the point.
- **No hard dependency on any specific SDK caching behaviour.** The design must remain profitable if cross-dispatch hits stay per-subagent-type only (PoC E2).

## Success criteria

1. `.context-pack.md` exists at `docs/features/context-pack-l1/.context-pack.md` (dogfooded) with the six sections and a valid `sources[]` frontmatter.
2. `node "$AIDAKIT_GOVERNANCE/validators/check-context-pack.js" docs/features/context-pack-l1/.context-pack.md` → exit 0 (byte-stability holds; no wall-clock content).
3. `node "$AIDAKIT_GOVERNANCE/validators/check-context-pack-freshness.js" docs/features/context-pack-l1/.context-pack.md` → exit 0 when sources match, exit 1 when any source's sha256 diverges.
4. Rebuilding the pack twice from identical sources produces byte-identical output (`diff -q pack1 pack2` returns nothing).
5. `governance/flows/full.yaml` and `governance/flows/fast.yaml` both declare the new phase between `readiness` and `implement`, and the phase routes to `implement` on both success and freshness-rebuild.
6. Every dispatcher/reviewer named in the epic (`implement`, `review`, `ship`, the five reviewer agents, `aidakit:tester`) reads the pack instead of re-loading `proposal.md`/`design.md`/`tasks.md` for durable context (contract test per agent).
7. Missing pack degrades gracefully: dispatch still succeeds (the reviewer falls back to reading the raw docs) — no dispatcher fails hard on absent pack during rollout.
8. `.aidakit/tasks/<change-id>/.telemetry.jsonl` is gitignored, append-only, and every line parses as JSON with the six declared fields.
9. `aidakit:learn` writes a rollup section into `docs/features/<change-id>/evidence.md` before the worktree is cleaned.
10. [ADR-010](../../decisions/ADR-010-context-pack-per-change.md) is authored and registered in `docs/decisions/README.md`.
11. Full governance test suite → green with the new tests added; no regression.

## References

- [EPIC-context-caching](../../roadmap/epics/EPIC-context-caching.md) — L1 envelope, L2 out-of-scope, promotion trigger.
- Memory `aidakit-token-cost-drivers` — the 98 %/61 % measurement that motivates this change.
- PoC E2 findings (reconstructed in [evidence.md](evidence.md)) — cross-dispatch cache is per-`subagent_type` only; L1 wins by prefix-size reduction.
- [ADR-004](../../decisions/ADR-004-aidakit-governance-env-contract.md) — the `AIDAKIT_GOVERNANCE` env contract the new validators plug into.
- [ADR-006](../../decisions/ADR-006-flow-values-as-data.md) — flow YAML schema for the new phase's `runs` step and `${context.select.change_id}` interpolation.
- [ADR-009](../../decisions/ADR-009-flow-commits-plan-early.md) — the phase-insertion precedent right before this one.
- [ADR-010](../../decisions/ADR-010-context-pack-per-change.md) — this change's registration of the pack as a first-class artifact.
