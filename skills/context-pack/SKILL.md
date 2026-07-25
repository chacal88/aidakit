---
name: context-pack
description: Builds, verifies and rebuilds a change's per-change L1 context pack (`docs/features/<change-id>/.context-pack.md`) — a small, deterministic, pointers-only distillation of proposal/design/tasks + cited ADRs/specs, injected as a stable prefix into every dispatcher/reviewer so they stop re-reading the durable context on every dispatch. Use when a change's pack needs to be authored, refreshed after a source edit, or checked for byte-stability/freshness before dispatching.
---

# aidakit:context-pack — the per-change L1 context cache

> One dispatch shrinks: instead of every reviewer/dispatcher re-reading `proposal.md` + `design.md` + `tasks.md` + the cited ADRs/specs from scratch, they read one small, byte-stable pointers-only pack. See [ADR-013](../../docs/decisions/ADR-013-context-pack-per-change.md) for the full decision and [EPIC-context-caching](../../docs/roadmap/epics/EPIC-context-caching.md) for the L1 envelope (L2 — embeddings/cross-change — is explicitly out of scope here).

Precedence: if it diverges from [DOCS.md](../../DOCS.md) / [GOVERNANCE.md](../../GOVERNANCE.md) / [ADR-013](../../docs/decisions/ADR-013-context-pack-per-change.md), the doctrine wins.

## When to use (and when not)

- **Use** `build` right after a change's plan is authored (or whenever the flow's `context_pack` phase detects the pack is missing/stale — see below).
- **Use** `verify` locally before dispatching by hand, to confirm the pack is both well-formed (byte-stable) and fresh (sources unchanged).
- **Use** `rebuild` after editing `proposal.md`/`design.md`/`tasks.md` or any cited ADR/spec, to force a fresh pack.
- **Don't use** it to author the plan itself — that's [aidakit:plan](../plan/SKILL.md). This skill only distills an ALREADY-authored plan into a smaller artifact.
- **Don't use** it to enforce freshness from inside an agent/reviewer's Bash session — agents/reviewers/skills READ the pack if present and fall back to the raw docs if absent; they never re-invoke the freshness validator themselves (ADR-013 §Decision-6, ADR-004 §negative-consequence-2). Freshness is enforced upstream, once, by the flow's `context_pack` `runs` step.

## The artifact

`docs/features/<change-id>/.context-pack.md` — frontmatter (`change_id`, `built_at_source_hash`, `pack_version`, `sources[]` of `{path, sha256}`, path-sorted) followed by six fixed sections, in this exact order:

1. `## identity` — change-id, date, owner, phase, one-line summary (the first sentence of `proposal.md`'s `## Why`; the legacy `## Problem` is accepted as a fallback).
2. `## decisions` — the local planning decisions from `design.md`, one bullet per decision with a `file:line` pointer.
3. `## ADRs` — every ADR the change cites, as a read-once address (`- [ADR-NNN](<path>) — role`).
4. `## specs` — the capability specs the change extends, pointers only.
5. `## code-map-pointers` — the files the implementation creates/modifies, pointers only.
6. `## DoD` — the Definition of Done, lifted verbatim from `proposal.md`'s `## Acceptance criteria` — the section [ADR-010](../../docs/decisions/ADR-010-acceptance-leash.md) §Decision-3 makes mandatory — parsed through [parse-criteria.js](../../governance/acceptance/parse-criteria.js), the single owner of that section's grammar. The legacy `## Success criteria` list is accepted as a fallback. `## Exit criteria` is **never** folded in: ADR-010 keeps validator commands (Exit) and observable-effect promises (Acceptance) as separate sections that do not merge. A change carrying neither criteria section builds `- (no acceptance criteria found)` — a signal to fix the proposal, not the pack.

> The pack is **derived, never hand-edited.** Both the summary and the DoD come from headings in `proposal.md`; if either renders empty, the fix is the proposal's headings followed by a `rebuild` — editing `.context-pack.md` directly desynchronizes it from its own `sources[]` hashes and the next freshness check will contradict you.

**Pointers only — excerpts are banned.** A copied paragraph drifts from its source without the source's `sha256` changing, which silently defeats invalidation. If you need the detail, open the pointed-at file — that's the whole point of the design.

## Subcommands

The skill is the human/agent-facing contract; the underlying implementation is a zero-dep Node script at `governance/context-pack/build.js` — placed under `governance/` (not `skills/`) specifically so a flow's `runs` step can reach it through the `$AIDAKIT_GOVERNANCE` env var per [ADR-004](../../docs/decisions/ADR-004-aidakit-governance-env-contract.md) (`skills/` is a sibling of `governance/`, not a child, so a script under `skills/` would not be reachable that way).

```
node governance/context-pack/build.js build   --change-id <id> [--root <path>]
node governance/context-pack/build.js rebuild --change-id <id> [--root <path>]
node governance/context-pack/build.js verify  --change-id <id> [--root <path>]
```

- **`build`** — discovers the change's sources (`proposal.md`/`design.md`/`tasks.md` plus every ADR/spec they cite), computes each source's sha256, renders the six sections, and writes the pack — overwriting any prior pack at the same path.
- **`rebuild`** — an explicit alias for `build`. Kept as a distinct verb for the "force refresh after I edited a source" mental model; `build` is already idempotent and deterministic, so there is no functional difference.
- **`verify`** — runs BOTH validators against the pack and fails if EITHER does:
  - [`governance/validators/check-context-pack.js`](../../governance/validators/check-context-pack.js) — byte-stability + schema (six sections present and in order; no wall-clock/UUID/tmp-path leak; no fenced-code excerpts under `code-map-pointers`/`specs`).
  - [`governance/validators/check-context-pack-freshness.js`](../../governance/validators/check-context-pack-freshness.js) — every declared `sources[N].sha256` still matches the file on disk; scoped strictly to the pack's own `sources[]`, never a repo-wide glob.

## The inviolable rule: deterministic build

The build **must** produce byte-identical output across repeated runs from identical sources, regardless of:

- **Wall-clock** — no `Date.now()`, no timestamp of any kind in the pack (the telemetry JSONL is where timestamps legitimately live — see [ADR-013](../../docs/decisions/ADR-013-context-pack-per-change.md) §Decision-7).
- **Process identity** — no PID, no environment-derived randomness.
- **Working directory** — every path stored in `sources[]` is REPO-RELATIVE; building the same source tree from two different absolute cwd's produces the same bytes.
- **Discovery order** — `sources[]` is always emitted path-sorted, independent of the order sources were discovered on disk.

A rebuild that produces different bytes from unchanged sources is a bug in the build script, never a "just rerun it" situation — `check-context-pack.js` exists precisely to catch this class of regression mechanically.

## Where the flow calls this

Neither `build` nor `verify` are invoked by agents/reviewers directly. The flow's `context_pack` phase (a `runs` step between `readiness` and `implement` in both `governance/flows/full.yaml` and `governance/flows/fast.yaml`) checks freshness first and lazily rebuilds on staleness — best-effort, fail-safe: both outcomes route to `implement`. See [ADR-013](../../docs/decisions/ADR-013-context-pack-per-change.md) §Decision-5 for the routing rationale.
