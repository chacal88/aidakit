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

- `node governance/__tests__/engine.test.mjs` → **149 passed, 0 failed** (no regression; the new `context_pack` phase and the engine's telemetry-kwargs extension are both exercised by this suite via the real `full`/`fast` flows).
- `node governance/__tests__/context-pack.test.mjs` (new, this change) → **98 passed, 0 failed**. Covers: byte-stability validator (§2), freshness validator (§3), the deterministic build (§4, including wall-clock/PID/tmp-cwd fuzz), the `context_pack` flow phase in both YAMLs (§5), the 10-file dispatcher/skill wiring contract (§6), the telemetry JSONL helper + engine resume-kwargs extension (§7), the `aidakit:learn` rollup (§8), and ADR-012 conformance (§9).
- Full governance suite (`governance/__tests__/*.test.mjs`, 15 files) → **all green**, no regression: candidates 8/0, check-adr-format 8/0, check-bench 20/0, check-docs 8/0, check-links 7/0, context-pack 98/0, dna-freshness 7/0, dna-write 14/0, engine 149/0, ledger 8/0, plugin-version 12/0, pr-automation 161/0, progress-table 30/0, roadmap 28/0, yaml-min 17/0.
- `node governance/validators/derive-roadmap-status.js --root .` → exit 0; `context-pack-l1` derives **in-progress** (feature "Context pack por change (L1)" under `EPIC-context-caching`).
- `node governance/validators/check-links.js docs/features/context-pack-l1` → exit 0, 5 files checked, no broken links (after fixing the dogfood pack's ADR links to be pack-relative — see Correction events below).
- `node governance/validators/check-adr-format.js docs/decisions/ADR-012-context-pack-per-change.md` → exit 0.
- `node governance/validators/check-context-pack.js docs/features/context-pack-l1/.context-pack.md` → exit 0 (byte-stable, all six sections present and in order, no wall-clock/UUID/tmp-path, no excerpts).
- `AIDAKIT_PROJECT_ROOT=<worktree> node governance/validators/check-context-pack-freshness.js docs/features/context-pack-l1/.context-pack.md` → exit 0, 5/5 sources fresh. (The explicit `AIDAKIT_PROJECT_ROOT` is needed only because this worktree is nested under the main checkout, which has its own `.aidakit/` marker that `findProjectRoot` would otherwise climb to first — an artifact of this sandbox's directory layout, not of the validator; the real flow's `runs` step always passes the correct `cwd`/root.)
- Rebuild determinism: built the dogfood pack twice from identical sources → `diff -q` returns nothing (byte-identical), confirmed both via the pure `buildPackContent` function (unit test) and via the actual CLI dogfood run.
- `node governance/validators/check-doc-manifest.js .aidakit/tasks/context-pack-l1/doc-manifest.json` — **not run directly**: no live `doc-manifest.json` exists for this change yet (that artifact is produced by `aidakit:doc-planner` in the flow's `document` step, which has not run in this direct-implementation session). The substantive guarantee this task names — a stale context pack must never trip `check-doc-manifest.js` (AC #12) — is verified mechanically instead by `governance/__tests__/context-pack.test.mjs`'s `§freshness-separation-from-doc-manifest` test (§3), which stages a stale pack next to a satisfied doc-manifest and asserts the two validators disagree independently.

## Files Touched

**Created**
- `governance/validators/check-context-pack.js`
- `governance/validators/check-context-pack-freshness.js`
- `governance/context-pack/build.js`
- `skills/context-pack/SKILL.md`
- `governance/telemetry/append.js`
- `governance/telemetry/rollup.js` (see Unresolved Deviations)
- `governance/__tests__/context-pack.test.mjs`
- `docs/features/context-pack-l1/.context-pack.md` (dogfood)

**Modified**
- `governance/flows/full.yaml`, `governance/flows/fast.yaml` — inserted the `context_pack` phase.
- `agents/adr-reviewer.md`, `agents/spec-reviewer.md`, `agents/reviewer-quality.md`, `agents/reviewer-security.md`, `agents/reviewer-architecture.md`, `agents/tester.md`, `agents/implementer.md` — "Step 0.5 — Load the context pack" clause.
- `skills/implement/SKILL.md`, `skills/review/SKILL.md`, `skills/ship/SKILL.md` — read-if-present clause under Prerequisites.
- `skills/learn/SKILL.md` — §4.5 telemetry rollup.
- `governance/cli.js`, `governance/engine/engine.js`, `governance/engine/resume-output.js`, `governance/engine/steps/invoke.js` — additive telemetry-kwargs extension of `resume`.

**Deleted:** none.

## Context-pack telemetry rollup

No telemetry captured for this run — the engine extension (`resume` kwargs → `governance/telemetry/append.js`) shipped in this change; per-dispatch telemetry starts landing on the NEXT change that runs the flow with reviewer dispatches supplying `cache_read`/`cache_creation`/`pack_size` kwargs. Once populated, the section is rewritten idempotently by `governance/telemetry/rollup.js` from `.aidakit/tasks/context-pack-l1/.telemetry.jsonl`.

## Coverage report

Behavioral coverage (by behavior, not by line):

- **Byte-stability validator** — empty sources, wall-clock rejection (with field naming), UUID/tmp-path rejection, missing-section rejection, excerpt (fenced code) rejection. 5/5 behaviors from tasks.md §2a.
- **Freshness validator** — all-match, one-diverges, source-missing, scope-only-declared-sources (never repo-wide), and separation from `check-doc-manifest.js`. 5/5 behaviors from §3a.
- **Deterministic build** — build-twice byte-identical, wall-clock/PID/tmp-cwd fuzz (3 vectors), path-sorted sources, rebuild refreshes hashes, `verify` fails on either validator. 7/7 behaviors from §4a, plus the ADR-links-resolve-from-pack-location regression found during dogfood.
- **Flow phase** — step exists with `type: runs` in both flows, correct routing (`readiness→context_pack→implement`, both outcomes), both validator/build invocations double-quoted and referencing `$AIDAKIT_GOVERNANCE`, `${context.select.change_id}` interpolated, and all pre-existing back-edges into `implement` verified unchanged. 5/5 behaviors from §5a, both flows.
- **Dispatcher/skill wiring** — all 10 files (7 agents + 3 skills) mention the pack and the `.context-pack.md` path, all 10 declare an explicit fallback-when-absent clause, and none of the 10 shells out to the freshness validator by name. 3 assertions × 10 files = 30/30 from §6a.
- **Telemetry** — JSONL lines valid + carry all 6 fields + `ts`, append-only (order preserved), `.gitignore` coverage confirmed; plus the engine extension: kwargs parse, malformed kwarg fails closed before touching state, forwarding to `append.js` with correct `subagent`/`pack_size`/`ts`, absence of kwargs writes nothing, and the pre-existing `engine.test.mjs` suite stays green. 7/7 behaviors from §7a/§7d.
- **Learn rollup** — written with correct totals/sums/means/per-subagent breakdown, idempotent replace (not duplicate) on rerun, and the exact `No telemetry captured for this run.` message when the JSONL is absent. 3/3 behaviors from §8a.
- **ADR-012 conformance** — passes `check-adr-format.js`, indexed in `docs/decisions/README.md`. 2/2 behaviors from §9a.

## Benchmark comparison

Not measured in this session: producing a real before/after `cache_read`/`cache_creation` comparison requires an actual live dispatch of a reviewer agent (e.g. `aidakit:reviewer-quality`) both with and without the pack injected, which only happens when this change's own flow run reaches the `review`/bench steps — outside the implementer's scope (the implementer does not dispatch reviewers; see agents/implementer.md "What you do NOT do"). The `aidakit:learn` rollup (§ above) is the durable place this comparison lands once the flow actually runs dispatches with telemetry kwargs supplied by the parent Claude.

As a size proxy (not a token-cost measurement): `docs/features/context-pack-l1/proposal.md` + `design.md` + `tasks.md` + the two cited ADRs (`ADR-004`, `ADR-012`) total well over 30 KB combined, versus the built `.context-pack.md` at under 4 KB — consistent with the prefix-size-reduction premise the design rests on, though the real `cache_read`/`cache_creation` delta can only be measured via actual dispatches.

## Unresolved Deviations

- **§4 (build.js) was written before its RED tests.** The mechanical distillation algorithm (how to extract identity/decisions/ADRs/specs/code-map-pointers/DoD from proposal/design/tasks text) needed to be designed concretely before test fixtures could target it meaningfully. Tests were then written and used to harden/debug the implementation (one real bug found and fixed: the yaml-min parser returns `null`, not `[]`, for an empty `sources:` key — the byte-stability validator now treats `null` sources as a well-formed empty list). All §4 tests pass; TDD discipline was not followed top-down for this one section.
- **§8's rollup logic lives in `governance/telemetry/rollup.js`**, a file not explicitly named in design.md's File-structure table (which lists only `skills/learn/SKILL.md` as MODIFY for this concern). Making the rollup mechanically testable (per tasks.md's own RED tests, §8a) required an executable helper; it was placed alongside `governance/telemetry/append.js` (the writer it reads back) rather than inventing a new top-level directory, since both own the same JSONL-shape concern from opposite ends.
- **Correction event (found during §10 dogfood):** the built pack's `## ADRs` section originally emitted markdown links using the bare repo-root-relative source path as the href (a link straight to `docs/decisions/ADR-004-...`, unadjusted). `check-links.js` resolves a link relative to the *file's own directory* (`docs/features/<id>/`), not the repo root, so the link was reported broken. Root cause: `renderAdrs` in `build.js` used the repo-relative source path directly as the href. Fix: added `linkFromPack(changeId, repoRelativePath)` (uses `node:path.relative`, deterministic, no cwd/wall-clock dependency) to compute a pack-relative href; added a regression test (`§build-adr-links-resolve-from-pack-location`) that runs the real `check-links.js` against a freshly built pack. `N11-iv` (`check-links.js docs/features/context-pack-l1`) now passes.
- **N11-vi (`check-doc-manifest.js` against a live doc-manifest.json for this change) was not run directly** — no such artifact exists yet; it is produced by `aidakit:doc-planner` in the flow's `document` step, downstream of `implement`. The AC #12 guarantee is instead verified by the automated `§freshness-separation-from-doc-manifest` test. See Validation Outputs above.
