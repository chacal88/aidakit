# Design — context-pack-l1

**Change ID:** `context-pack-l1`
**Date:** `2026-07-24`
**Owner:** `@chacal88`
**Phase / Package:** `skills + agents + governance (flows/validators) — per-change L1 context pack`

## Architecture

> **Note (PoC E2, 2026-07-24):** the premise of this design is **prefix-size reduction**, NOT cross-dispatch cache hit-rate. The PoC showed the SDK-level cache reuses only for the same `subagent_type` (~59 % of the SDK-owned prefix); every cross-type dispatch — the norm in our flow — is a complete miss. The pack profits because it strictly SHRINKS the durable context each dispatch processes, independent of any upstream cache behavior. If a future SDK version raises the cross-type hit-rate, the pack's stable-prefix injection lets us keep whatever reuse the SDK grants; if it does not, the size reduction alone still pays for the change.

### The artifact: `.context-pack.md`

Location: `docs/features/<change-id>/.context-pack.md` (dogfood: `docs/features/context-pack-l1/.context-pack.md`).

#### Frontmatter schema

```yaml
---
change_id: <kebab-case-id>            # matches the containing directory
built_at_source_hash: <sha256>        # rolling hash of the sorted `sources[]` entries below (byte-stable across builds, no wall-clock)
pack_version: 1                       # bump if the six-section layout ever changes
sources:                              # every doc distilled into the pack, in path-sorted order
  - path: docs/features/<id>/proposal.md
    sha256: <sha256 of the file's bytes>
  - path: docs/features/<id>/design.md
    sha256: <sha256 of the file's bytes>
  - path: docs/features/<id>/tasks.md
    sha256: <sha256 of the file's bytes>
  - path: docs/decisions/ADR-004-aidakit-governance-env-contract.md
    sha256: <sha256 of the file's bytes>
  # …one entry per ADR/spec/pointer-target the pack distills
---
```

Invariants enforced by `check-context-pack.js`:

- `built_at_source_hash` is a deterministic function of `sources[]` alone (path-sorted, tab-normalized, LF line endings). It **must not** include wall-clock time, process id, tmp paths, or any host-specific value. A change to any source's sha256 changes the top hash; nothing else does.
- `sources[]` is path-sorted lexicographically to make the file byte-stable across builds regardless of the discovery order.
- `pack_version` is an integer, not a semver, and only the pack-schema owner bumps it.

#### The six fixed sections (pointers only, never excerpts)

Order and headings are frozen — reviewers are wired against these exact names:

1. `## identity` — change-id, dates, owner, phase, one-line summary distilled from `proposal.md`.
2. `## decisions` — bullet list of the **local** planning decisions taken in `design.md` (one bullet per decision, `file:line` pointer, one-line rationale). Not ADRs — those are §3.
3. `## ADRs` — every recorded ADR the change touches, listed as `- [ADR-NNN](docs/decisions/ADR-NNN-slug.md) — one-line role in this change`. Read-once addresses; no ADR body copied.
4. `## specs` — the capability specs the change extends (kit mode: `docs/specs/…`; OpenSpec mode when applicable: `openspec/specs/<capability>/spec.md`). Pointers only.
5. `## code-map-pointers` — the files the implementation will create/modify/delete, `file:line-range` where a line range is meaningful. No source code inlined.
6. `## DoD` — the Definition of Done for the change, extracted from the proposal's `## Success criteria` — bullet list, no prose.

**Excerpts are banned.** A copied paragraph drifts from its source; the sha256 in `sources[]` would still match its file even if the excerpt is stale, which silently defeats invalidation. Pointers force the reader to open the current source when they need the detail, which is the whole point of the design.

### Invalidation: hash-check, source-scoped, lazy

The freshness validator (`check-context-pack-freshness.js`) reads the pack's frontmatter, walks `sources[]`, recomputes each file's sha256, and exits 0 iff all match. It **never globs the repo**. If the pack references `docs/decisions/ADR-004-*.md` and someone edits `docs/decisions/ADR-005-*.md`, the pack is still fresh — because ADR-005 is not one of its sources. The pack is scoped to *its* change.

The build step (`aidakit:context-pack build`) is deterministic:

1. Discover the sources (from the change dir's `proposal.md`/`design.md`/`tasks.md` and their explicit ADR/spec citations — the same citations reviewers already look for).
2. Compute sha256 of each source's bytes.
3. Sort by path, render the frontmatter and the six sections in fixed order.
4. Write byte-stably (LF line endings, no trailing whitespace, no wall-clock).

Rebuild (`aidakit:context-pack rebuild`) is `build` with an implicit `--force`.

Verify (`aidakit:context-pack verify`) is a thin wrapper around the two validators, for local use before dispatching by hand.

### The new flow phase: `context_pack` (between `readiness` and `implement`)

Both `full.yaml` and `fast.yaml` gain a new `runs` step (type: `runs`, NOT `invoke` — this is critical: only `runs` steps receive the `$AIDAKIT_GOVERNANCE` env var per [ADR-004](../../decisions/ADR-004-aidakit-governance-env-contract.md), and the freshness/build commands depend on it). Placement is right after `readiness` (approved → `context_pack`) and before `implement`. Contract: verify freshness; if stale, rebuild lazily; then route to `implement`. Never blocks the flow — a build failure (unlikely; the build is deterministic) routes to `implement` anyway (best-effort, mirroring `commit_plan`'s fail-safe posture from [ADR-009](../../decisions/ADR-009-flow-commits-plan-early.md)); the dispatchers themselves tolerate the missing pack by falling back to reading the raw docs.

**Insertion points in the flow YAMLs** (confirmed by inspection):

- `full.yaml`: change `readiness.on_result.approved` from `implement` to `context_pack`; the new `context_pack` step routes `on_success: implement` and `on_failure: implement`. `full.yaml` also loops back to `implement` from `bench_outcome`, `check_review_bench`, and `hardening` — those back-edges are LEFT UNCHANGED. Reason: on any re-entry to `implement` after the first pass, the pack file already exists on disk (dispatcher writes never invalidate it — the pack only invalidates when a `sources[]` file changes, and back-edges do not necessarily edit sources). Re-verifying freshness on every back-edge would either (a) rebuild on every mutation of proposal/design/tasks (fine but redundant) or (b) do nothing (waste). The `context_pack` phase runs ONCE per plan-approval; any staleness that develops during implementation is handled by the read-if-present fallback in the dispatcher wrapper.
- `fast.yaml`: same insertion between `readiness` (line 100) and `implement` (line 113). Same back-edges, same reasoning.

The `runs` step's command executes the freshness validator; on non-zero exit, it invokes the pack build script (which is also a node file under `governance/` — see §File structure below — so `$AIDAKIT_GOVERNANCE` reaches it cleanly). Both node invocations use double-quoted `$AIDAKIT_GOVERNANCE/<path>` per [ADR-004](../../decisions/ADR-004-aidakit-governance-env-contract.md) §Decision.

Command shape (values-as-data per [ADR-006](../../decisions/ADR-006-flow-values-as-data.md); the exact string below is what the implementer writes into `full.yaml` and `fast.yaml`):

```
node "$AIDAKIT_GOVERNANCE/validators/check-context-pack-freshness.js" \
  "docs/features/${context.select.change_id}/.context-pack.md" \
  || node "$AIDAKIT_GOVERNANCE/context-pack/build.js" \
       --change-id "${context.select.change_id}"
```

Note the build script path: `$AIDAKIT_GOVERNANCE/context-pack/build.js` (i.e. `governance/context-pack/build.js`), NOT `$AIDAKIT_GOVERNANCE/skills/context-pack/build.js`. Reason: `$AIDAKIT_GOVERNANCE` points at the `governance/` directory itself ([ADR-004](../../decisions/ADR-004-aidakit-governance-env-contract.md)); `skills/` is a sibling of `governance/`, not a child, so the skills path is not reachable through the env contract. The skill (`skills/context-pack/SKILL.md`) remains the human/agent-facing contract that documents subcommands and discipline; the actual node script lives under `governance/context-pack/` so `runs` steps can call it directly.

Routing:

- `on_success: implement` — pack fresh OR successfully rebuilt.
- `on_failure: implement` — build failed; the flow proceeds and dispatchers degrade gracefully. A build regression surfaces as a rollup finding in `evidence.md` via telemetry, not as a hard stop.

### Dispatcher/reviewer integration: read-if-present, freshness upstream

Every dispatcher/reviewer named in the epic changes the same way, mechanically:

1. On entry, resolve `docs/features/<change_id>/.context-pack.md`.
2. **If the file exists → read it and inject it as the stable prefix of the agent's context** (before the diff/prompt/task). Agents/reviewers do NOT independently re-validate freshness. Freshness is guaranteed by the upstream `context_pack` flow phase — a `runs` step that DOES receive `$AIDAKIT_GOVERNANCE` — which runs immediately before every group of dispatcher/reviewer invocations. If the pack is stale at agent-read time, that is a flow-engine bug (the phase failed to fire before this group), not an agent responsibility. The agent is instructed via its SKILL/agent prompt to treat the pack as authoritative for durable context and to open the pointed-at files on demand only.
3. **If the pack is absent → the dispatcher logs `pack_rebuilt: false` in telemetry, falls back to reading `proposal.md`/`design.md`/`tasks.md`/cited ADRs the old way, and completes normally.** This graceful-degradation path is what lets the change roll out one dispatcher at a time; a change that hasn't run through the new flow phase (older changes, in-flight worktrees) still works.

Rationale for the contract split — per [ADR-004](../../decisions/ADR-004-aidakit-governance-env-contract.md) §negative-consequence-2, `$AIDAKIT_GOVERNANCE` is injected into the child env of `runs` steps ONLY. Agent/skill Bash sessions never receive it — the exact gap tracked as `agent-validator-paths` in [EPIC-flow-engine-leashes](../../roadmap/epics/EPIC-flow-engine-leashes.md), which remains OPEN and is explicitly out of scope for this change. Having agents shell out to `check-context-pack-freshness.js` would either require them to reinvent path resolution (violating the ADR-004 contract by design) or would fail at runtime in any repo where `governance/` is not co-located with `cwd`. The upstream `runs` phase sidesteps the whole class of problem: it validates once, in the one place where the env contract already works.

Why the SAME bytes across dispatches: preserving whatever same-`subagent_type` cache reuse the SDK does grant. This is additive on top of the size-reduction win — no dispatcher depends on it.

### Telemetry: `.aidakit/tasks/<change-id>/.telemetry.jsonl`

Append-only, gitignored, one JSON object per dispatch:

```json
{"ts":"2026-07-25T14:03:12Z","subagent":"aidakit:reviewer-quality","cache_creation":1240,"cache_read":18320,"output_tokens":512,"pack_size":9284,"duration_ms":11530,"pack_rebuilt":false}
```

Fields:

| Field | Type | Meaning |
|---|---|---|
| `ts` | ISO-8601 UTC | dispatch timestamp — kept in the JSONL because the file is not the pack (the byte-stability rule applies only to the pack) |
| `subagent` | string | the `subagent_type` dispatched (e.g. `aidakit:reviewer-quality`) |
| `cache_creation` | integer | tokens attributed to cache_creation in the SDK response |
| `cache_read` | integer | tokens attributed to cache_read in the SDK response |
| `output_tokens` | integer | tokens attributed to the dispatch's own output (round-1 bench fix E: parsed off `--tokens-output` but previously dropped before reaching the JSONL record) |
| `pack_size` | integer | bytes of the pack injected (0 if fallback) |
| `duration_ms` | integer | wall-clock dispatch duration |
| `pack_rebuilt` | boolean | true when this dispatch triggered a lazy rebuild |

The file is gitignored (extension of `.aidakit/` in `.gitignore` covers it — the whole `.aidakit/` dir is already ignored). It is written by the engine at resume time (see the next sub-section), not by the agent itself and not by any "dispatcher wrapper" (there is no such wrapper — `governance/engine/steps/invoke.js` is IoC: it pauses, asks the parent Claude to dispatch, and resumes on `node governance/cli.js resume …`, so the engine itself never observes the SDK response).

#### Live write-site — engine extension

Because the invoke step is IoC, the engine never sees the SDK response of the dispatched agent — it only sees whatever the *parent* Claude passes back on `resume`. Therefore the sanctioned live write-site for `.telemetry.jsonl` is **the `resume` handler itself**, extended additively to accept the usage fields from the parent as optional key=value arguments after the outcome:

```
node governance/cli.js resume <flow_id> <outcome> \
  [change_id=<id>] \
  [--tokens-cache-read=N] \
  [--tokens-cache-creation=N] \
  [--tokens-output=N] \
  [--duration-ms=N] \
  [--pack-rebuilt=true|false]
```

Contract:

- The **parent dispatcher** (the Claude session running the flow) reads its own SDK response after each dispatch, extracts `usage.cache_read`, `usage.cache_creation`, `usage.output_tokens`, wall-clock duration, and whether the previous `context_pack` phase rebuilt the pack, and appends the corresponding kwargs to the `resume` invocation. The parent supplies the data.
- The **engine** is the mechanical writer. `governance/cli.js` parses the new optional telemetry kwargs; `governance/engine/steps/invoke.js`'s resume handler forwards them to a `governance/telemetry/append.js` helper (co-located with `governance/context-pack/build.js`) which appends one JSONL line under `.aidakit/tasks/<change-id>/.telemetry.jsonl`. The `change_id` used to build the path is either the explicit `change_id=<id>` structured output already declared by `select`, or the value already persisted in `state.context.select.change_id`.
- When any/all telemetry kwargs are ABSENT (the backward-compatible path — every existing `resume` callsite, all existing tests, all older flows), no telemetry line is written and the flow proceeds unaffected. Zero regression risk for callers that don't opt in.
- The kwargs are appended to the value-token whitelist of `governance/engine/resume-output.js` under the same "safe single token" rule — an integer for the counters, a bool for `pack-rebuilt`, so no unsafe string ever reaches the JSONL. A malformed kwarg is a usage error before any state is touched, mirroring the existing `parseResumeOutput` contract.

Rationale — this is the ONLY place in the engine that runs after the dispatched agent has actually completed and where the parent Claude is authoritatively holding the SDK response. Any earlier write-site would either fabricate the numbers (wrong) or violate the ADR-004 env contract (a hypothetical write from inside an agent's Bash session, which has no `$AIDAKIT_GOVERNANCE` and no reliable path to the change dir). The extension is additive: the existing `resume` signature (`<flow_id> <outcome> [key=value ...]`) is preserved, and the new kwargs sit alongside the existing structured outputs.

### `aidakit:learn` rollup

At the `learn` step (both flows), `aidakit:learn` reads the telemetry JSONL and writes a rollup section into `evidence.md` before the worktree is cleaned. The rollup includes: total dispatches, mean/median `pack_size`, sum of `cache_read`/`cache_creation`, number of rebuilds, and a per-subagent breakdown. The rollup is the durable record; the JSONL itself is ephemeral by design (gitignored).

## Concrete implementation plan

### Surfaces discovered from the repo

| Surface | Path | Role in this change |
|---|---|---|
| Skills | `skills/context-pack/SKILL.md` (new, contract only), `skills/learn/` (modify) | Document the pack skill contract; distill the rollup |
| Governance code | `governance/context-pack/build.js` (new) | The deterministic build implementation, reachable from `runs` steps via `$AIDAKIT_GOVERNANCE/context-pack/build.js` per [ADR-004](../../decisions/ADR-004-aidakit-governance-env-contract.md) |
| Agents | `agents/adr-reviewer.md`, `agents/spec-reviewer.md`, `agents/reviewer-quality.md`, `agents/reviewer-security.md`, `agents/reviewer-architecture.md`, `agents/tester.md`, `agents/implementer.md` | Verify-then-inject the pack |
| Flow YAMLs | `governance/flows/full.yaml`, `governance/flows/fast.yaml` | Insert `context_pack` phase between `readiness` and `implement` |
| Validators | `governance/validators/check-context-pack.js` (new), `governance/validators/check-context-pack-freshness.js` (new) | Byte-stability + hash-invalidation; separate from `check-doc-manifest.js` |
| Decisions | `docs/decisions/ADR-013-context-pack-per-change.md` (new), `docs/decisions/README.md` (modify — index entry) | Register the pack as first-class |
| Ignore | `.gitignore` | Already covers `.aidakit/` — no change; documented here for clarity |

### File structure — create / modify / delete

**CREATE**

- `skills/context-pack/SKILL.md` — the skill's authoritative (human/agent-facing) contract: subcommands `build`, `verify`, `rebuild`; deterministic-build discipline; where the pack lives; how it discovers `sources[]`. The SKILL.md documents that the underlying node script lives at `governance/context-pack/build.js` (Option A resolution — see §The new flow phase above), so `runs` steps can invoke it via `$AIDAKIT_GOVERNANCE/context-pack/build.js` per [ADR-004](../../decisions/ADR-004-aidakit-governance-env-contract.md).
- `governance/context-pack/build.js` — the build implementation (deterministic, LF, path-sorted, no wall-clock, no PID, no tmp-path). Colocated under `governance/` so it is reachable from `runs` steps through the `$AIDAKIT_GOVERNANCE` env contract; `skills/context-pack/SKILL.md` remains the human-facing contract that documents it.
- `governance/validators/check-context-pack.js` — byte-stability validator; contract identical to sibling validators (`AIDAKIT_GOVERNANCE`-invoked, JSON+stderr output, exit 0/1/2).
- `governance/validators/check-context-pack-freshness.js` — hash-invalidation validator scoped to the pack's own `sources[]`; separate from `check-doc-manifest.js`.
- `governance/__tests__/context-pack.test.mjs` — parser-style tests: byte-stability (rebuild produces identical bytes), fuzz-with-system-time (produces identical bytes even when the wall-clock advances), freshness pass/fail cases, separation from doc-manifest (a stale pack does not trip doc-manifest), telemetry-line JSON validity, `aidakit:learn` rollup writing, contract test per dispatcher/reviewer.
- `docs/decisions/ADR-013-context-pack-per-change.md` — the ADR; format mirrors ADR-009.
- `governance/telemetry/append.js` — the JSONL-append helper. Zero-dep, opens the file in append mode, resolves `.aidakit/tasks/<change_id>/.telemetry.jsonl` via `findProjectRoot`/`AIDAKIT_PROJECT_ROOT` (same convention as `check-doc-manifest.js`), writes one JSON object per invocation, never rewrites prior lines. Called from `governance/engine/steps/invoke.js`'s resume handler when telemetry kwargs are present.
- `docs/features/context-pack-l1/.context-pack.md` — the dogfood pack for this change itself (built by the new skill during implementation).

**MODIFY**

- `governance/flows/full.yaml` — insert `context_pack` step between `readiness` (approved → `context_pack`) and `implement`; route `on_success` and `on_failure` to `implement`.
- `governance/flows/fast.yaml` — same insertion between `readiness` and `implement`.
- `agents/adr-reviewer.md`, `agents/spec-reviewer.md`, `agents/reviewer-quality.md`, `agents/reviewer-security.md`, `agents/reviewer-architecture.md`, `agents/tester.md`, `agents/implementer.md` — extend the Protocol with a "Step 0.5 — Load the context pack" clause: read `docs/features/<change_id>/.context-pack.md` when the file exists; treat it as authoritative for durable context; open cited files only on demand; fall back to raw docs (`proposal.md`/`design.md`/`tasks.md`/cited ADRs) when the pack is absent. Agents do NOT run `check-context-pack-freshness.js` — freshness is guaranteed upstream by the `context_pack` flow phase per [ADR-004](../../decisions/ADR-004-aidakit-governance-env-contract.md) §negative-consequence-2 (agent Bash sessions do not receive `$AIDAKIT_GOVERNANCE`; the `agent-validator-paths` gap in [EPIC-flow-engine-leashes](../../roadmap/epics/EPIC-flow-engine-leashes.md) remains out of scope for this change).
- `skills/implement/SKILL.md`, `skills/review/SKILL.md`, `skills/ship/SKILL.md` — same read-if-present clause added to the Prerequisites section so the agents dispatched under these skills receive the pack via their invocation prompt. No freshness invocation from these skills either — same ADR-004 reasoning.
- `skills/learn/SKILL.md` — extend §4 (Record the scoped memory) or add a §4.5 that reads `.aidakit/tasks/<change_id>/.telemetry.jsonl` and writes a rollup into `evidence.md`.
- `governance/cli.js` — extend the `resume` command handler to parse the new optional telemetry kwargs (`--tokens-cache-read=N`, `--tokens-cache-creation=N`, `--tokens-output=N`, `--duration-ms=N`, `--pack-rebuilt=bool`) after the outcome and the existing structured outputs. Preserve the existing `<flow_id> <outcome> [key=value ...]` signature; the new kwargs are additive and default to absent (backward compatible).
- `governance/engine/steps/invoke.js` — extend the resume-side handler (the branch entered when `ctx.resumeValue !== undefined`) to forward the parsed telemetry kwargs to the telemetry-append helper. When the kwargs are all absent, do nothing (no line written). Freshness/routing logic is unchanged; the extension is additive.
- `docs/decisions/README.md` — add the ADR-013 index row and, if the thematic grouping applies, cite it under a "Context caching" bucket (or extend an existing bucket).

**DELETE**

- None.

### 3-point estimate

```
Optimistic: 6 hours   (skill + validators + one dispatcher wired; the pattern generalizes fast)
Likely:     10 hours  (full dispatcher/reviewer sweep + full test surface + ADR-013)
Pessimistic: 14 hours (SDK telemetry field names differ from PoC and per-dispatch wrapper needs refactor)

Recommendation: start from "Likely"; adjust if the SDK telemetry field discovery uncovers surprises.
```

### Effort breakdown and risk matrix

| Component | Hours | Type | Risk |
|---|---|---|---|
| `skills/context-pack/SKILL.md` (contract) + `governance/context-pack/build.js` (deterministic build) | 2 | Core | LOW |
| `governance/validators/check-context-pack.js` (byte-stability) | 1 | Core | LOW |
| `governance/validators/check-context-pack-freshness.js` (source-scoped hash-check) | 1 | Core | LOW |
| `governance/__tests__/context-pack.test.mjs` (byte-stability fuzz + freshness cases + separation from doc-manifest + telemetry-line JSON + per-dispatcher contract test) | 2 | Testing | MEDIUM |
| `governance/flows/full.yaml` + `fast.yaml` — insert `context_pack` phase | 0.5 | Integration | LOW |
| Agent wiring (7 agent files: verify-then-inject clause) | 1.5 | Integration | MEDIUM (blast radius; see risks) |
| Skill wiring (`skills/{implement,review,ship}/SKILL.md`) | 0.5 | Integration | LOW |
| `skills/learn/SKILL.md` extension + rollup writer | 1 | Integration | LOW |
| `docs/decisions/ADR-013-context-pack-per-change.md` + index entry in `README.md` | 0.5 | Documentation | LOW |
| Dogfood: build `docs/features/context-pack-l1/.context-pack.md` and validate it | 0.5 | Documentation | LOW |
| **Total** | **10.5** | | |

**Risks & mitigations** (Probability × Impact):

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Pack drifts from sources without tripping invalidation (someone edits a distilled bullet by hand) | LOW | HIGH | The pointers-only rule removes distillate to be drifted; byte-stability validator + freshness validator running as separate gates catch the two failure modes distinctly. The invariant is codified in ADR-013. |
| Telemetry JSONL grows unbounded across long sessions | MEDIUM | LOW | File is gitignored and per-change; `aidakit:learn` rolls it up at end-of-run and the operator is free to delete the JSONL after archiving. No unbounded state escapes the change dir. |
| Dispatcher-modification blast radius: a wiring bug on one agent silently breaks all reviewers | MEDIUM | HIGH | Contract test per agent (§Test §…-contract-per-agent below) asserting the pack is read when present and fallback works when absent; graceful-degradation path means an incorrectly-wired agent still runs, only without the pack — the failure mode is a size regression visible in telemetry, not a broken flow. |
| The same-`subagent_type` cache assumption from PoC E2 does not hold on future SDK versions | LOW | LOW | The design does not depend on it — the win is prefix-size reduction. Telemetry captures `cache_read` vs `cache_creation` so any regression is visible in the `aidakit:learn` rollup. |
| Freshness check is confused with doc-manifest and starts blocking the doc-leash | MEDIUM | HIGH | The freshness validator is a SEPARATE file (`check-context-pack-freshness.js`) invoked by a SEPARATE flow step; it does not touch `doc-manifest.json`. Explicit test §…-separation-from-doc-manifest asserts a stale pack does not add a `doc-missing` error. Codified in ADR-013's Consequences. |
| Non-deterministic build (someone adds `Date.now()` to the pack template) | LOW | HIGH | Byte-stability validator rejects wall-clock content; test §…-byte-stability-under-time fuzzes the wall clock while rebuilding and asserts identical bytes. Codified in ADR-013's Decision. |

**Assumptions** — each is a point where the plan breaks if reality differs; the executor re-inspects before coding (GOVERNANCE.md §8):

- The pack is byte-stable across builds given identical sources — enforced by the design (LF, sorted, no wall-clock) and by `check-context-pack.js`. Cited in [ADR-013](../../decisions/ADR-013-context-pack-per-change.md).
- The dispatcher change is mechanical, not semantic: agents receive the pack via their prompt entry; behavior downstream is unchanged. If a reviewer's verdict shape depends on re-reading `proposal.md` in a way the pack does not preserve, that is a bug in the pack schema, not in the reviewer — surface as an escalation.
- `aidakit:learn` runs BEFORE the worktree is cleaned. Confirmed by the flow order: `learn` is upstream of `dna_gate`/`document`/`pr`; the worktree is cleaned only after the human merge gate.
- `.aidakit/` is already gitignored (confirmed line 1 of the repo's `.gitignore`); no change needed for the telemetry file to inherit that.
- The `AIDAKIT_GOVERNANCE` env is available to the new validators when invoked from `runs` steps — inherited from [ADR-004](../../decisions/ADR-004-aidakit-governance-env-contract.md).

### Dependencies

- [ADR-004](../../decisions/ADR-004-aidakit-governance-env-contract.md) — validator invocation contract; the two new validators plug into it identically to `check-doc-manifest.js`.
- [ADR-006](../../decisions/ADR-006-flow-values-as-data.md) — `${context.select.change_id}` interpolation for the new `runs` step; `$AIDAKIT_GOVERNANCE/validators/…` invocation.
- [ADR-009](../../decisions/ADR-009-flow-commits-plan-early.md) — the phase-insertion precedent (same shape: a `runs` step, best-effort, fail-safe, routes back into the main line).
- [EPIC-context-caching](../../roadmap/epics/EPIC-context-caching.md) — the L1 acceptance envelope.

## Backwards compatibility

- Existing changes without a pack behave unchanged. The dispatcher wrapper checks for the pack; a missing pack means the dispatcher reads raw docs, same as today.
- Existing tests (governance suite) continue to pass; the new tests add to §context-pack without modifying existing sections.
- The `context_pack` flow step is additive: routing to `implement` on both success and failure means a broken build never blocks the flow.

## Anti-drift check

To re-verify before writing code:

- Every dispatcher/reviewer path listed in **File structure — MODIFY** exists in the current tree (`agents/adr-reviewer.md`, `agents/spec-reviewer.md`, `agents/reviewer-quality.md`, `agents/reviewer-security.md`, `agents/reviewer-architecture.md`, `agents/tester.md`, `agents/implementer.md`, `skills/{implement,review,ship,learn}/SKILL.md`). Confirmed at planning time.
- `governance/flows/full.yaml` has a `readiness` step routing `approved: implement` (line 156-157) — the insertion point is before that route target, and the `approved` route is edited to point at `context_pack` which then routes to `implement`. Confirmed.
- `governance/flows/fast.yaml` has the same shape (line 108-109). Confirmed.
- `governance/validators/check-doc-manifest.js` uses `findProjectRoot` and `AIDAKIT_PROJECT_ROOT` — the freshness validator will follow the same convention. Confirmed.
- `.gitignore` line 1 covers the whole `.aidakit/` tree — the telemetry file inherits. Confirmed.
