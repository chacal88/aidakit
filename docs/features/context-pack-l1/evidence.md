# Evidence — context-pack-l1

**Change ID:** `context-pack-l1`
**Date:** `2026-07-24`
**Owner:** `@chacal88`
**Phase / Package:** `skills + agents + governance (flows/validators) — per-change L1 context pack`

> This file starts as a STUB authored during planning. Concrete validation outputs, files touched and unresolved deviations are populated during implementation; the context-pack telemetry rollup section is written by `aidakit:learn` at the end of the run, before the worktree is cleaned. The PoC-E2 summary below is the only pre-implementation content — it is the empirical justification for the L1 design and is reproduced here so reviewers do not need external context.

## PoC-E2 summary (2026-07-24)

Reconstructed from the prior-session brainstorm handoff for this change; the original raw traces from the live SDK dispatches are not preserved in this worktree. Numbers reproduced from the handoff verbatim — **do NOT extrapolate beyond the stated bullets**.

- **Cross-dispatch cache hits fire ONLY for the same `subagent_type`.** In the traces, same-subagent cross-dispatch reuse covered ~59 % of the SDK-owned prefix — enough to matter for repeated calls to the same reviewer, negligible for the mixed cross-type dispatch pattern our flow actually runs.
- **Cross-type dispatches are complete cache misses.** A dispatch from (say) `aidakit:reviewer-quality` immediately after `aidakit:reviewer-security` gets 0 % cache_read on the durable prefix — the norm in our flow, not the exception.
- **L1 remains viable because the win is prefix-size reduction, independent of hit-rate.** The pack shrinks the durable per-change context each dispatch processes (proposal + design + tasks + cited ADRs → a small pointers-only pack), so the size reduction pays for the change regardless of what the SDK cache does. Whatever same-subagent-type reuse the SDK does grant is additive on top; the pack's byte-stability preserves it.

The design in [design.md](design.md) rests on those three bullets and no other empirical claim. If the SDK's caching semantics change, the pack's value proposition (size reduction) is unaffected; the telemetry file (§ Context-pack telemetry rollup below, once populated) is the ongoing signal that would surface a regression.

## Validation Outputs

<!-- Populated during implementation. Expected entries mirror the exit criteria in tasks.md §11:
     - node governance/__tests__/engine.test.mjs → PASS
     - Full suite → per-file pass/fail counts
     - node governance/validators/derive-roadmap-status.js --root . → exit 0
     - node governance/validators/check-links.js docs/features/context-pack-l1 → exit 0
     - node governance/validators/check-adr-format.js docs/decisions/ADR-010-context-pack-per-change.md → exit 0
     - node "$AIDAKIT_GOVERNANCE/validators/check-context-pack.js" docs/features/context-pack-l1/.context-pack.md → exit 0
     - node "$AIDAKIT_GOVERNANCE/validators/check-context-pack-freshness.js" docs/features/context-pack-l1/.context-pack.md → exit 0
     - diff of two consecutive build outputs → empty
-->

## Files Touched

<!-- Populated during implementation. Enumerate every created/modified/deleted path relative to the repo root. -->

## Context-pack telemetry rollup

<!-- Written by `aidakit:learn` (skills/learn/SKILL.md §4.5) at end-of-run. Idempotent — reruns replace this section. Expected shape:

## Context-pack telemetry rollup

- Total dispatches: N
- Mean pack_size: X bytes
- Sum cache_read: Y tokens
- Sum cache_creation: Z tokens
- Pack rebuilds: R

| subagent | dispatches | mean cache_read | mean pack_size |
|---|---|---|---|
| aidakit:reviewer-quality | ... | ... | ... |
| aidakit:reviewer-security | ... | ... | ... |
| aidakit:reviewer-architecture | ... | ... | ... |
| aidakit:tester | ... | ... | ... |
| aidakit:adr-reviewer | ... | ... | ... |
| aidakit:spec-reviewer | ... | ... | ... |
| aidakit:implementer | ... | ... | ... |
-->

## Coverage report

<!-- Populated during implementation. Behavioral coverage of the new surfaces (context-pack skill, both validators, the flow phase, the dispatcher wiring, the learn rollup). Not % of lines — % of behaviors. -->

## Benchmark comparison

<!-- Populated during implementation. Per-dispatch token cost before vs. after the pack is wired for a representative dispatcher (e.g. aidakit:reviewer-quality) on this same change. Expected direction: cache_read shrinks by roughly the size of proposal+design+tasks+ADRs minus the pack size; cache_creation shrinks proportionally on the first dispatch. Report as raw numbers, not %, so a reader can audit the arithmetic. -->

## Unresolved Deviations

<!-- Populated during implementation. Any change from design.md that WAS applied (not just discussed) but did not motivate a design.md/proposal.md edit — surface here so the reviewer can flag it. If empty at ship time, delete the section. -->
