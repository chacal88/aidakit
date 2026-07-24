# Tasks — context-pack-l1

**Change ID:** `context-pack-l1`
**Date:** `2026-07-24`
**Owner:** `@chacal88`
**Phase / Package:** `skills + agents + governance (flows/validators) — per-change L1 context pack`

> TDD, tests first. Every validator, the deterministic build, the dispatcher wiring and the telemetry writer get a RED test before the GREEN implementation, then REFACTOR. Test idiom: pure Node `.mjs`, no framework — mirrors [`governance/__tests__/engine.test.mjs`](../../../governance/__tests__/engine.test.mjs). **Anti-drift ([GOVERNANCE.md](../../../GOVERNANCE.md) §8):** re-inspect the repo before coding; any assumption from [design.md](design.md) that changed → STOP and report.

## 1. Setup

- [x] N1. Re-read [design.md](design.md) against live code: confirm the flow YAML shapes ([full.yaml:148-161](../../../governance/flows/full.yaml), [fast.yaml:100-113](../../../governance/flows/fast.yaml)), the validator invocation convention ([check-doc-manifest.js](../../../governance/validators/check-doc-manifest.js), [ADR-004](../../decisions/ADR-004-aidakit-governance-env-contract.md)), the current dispatcher agent files ([agents/adr-reviewer.md](../../../agents/adr-reviewer.md) ... [agents/tester.md](../../../agents/tester.md)), and the `.gitignore` `.aidakit/` line. No divergence found → proceed. Divergence found → STOP and report.

## 2. Pack schema + `check-context-pack.js` (byte-stability validator)

### 2a. RED

- [x] N2a-i. Test §pack-byte-stability-empty-sources: write a pack with an empty `sources[]`; `check-context-pack.js` exits 0 (an empty pack is well-formed).
- [x] N2a-ii. Test §pack-byte-stability-wall-clock-rejected: write a pack whose frontmatter contains an ISO-8601 timestamp field not covered by the schema (`built_at: 2026-07-25T…`); validator exits 1 with an error naming the offending field. (AC #11)
- [x] N2a-iii. Test §pack-byte-stability-random-id-rejected: write a pack containing a UUID/tmp-path in the body sections; validator exits 1 naming the pattern. (AC #11)
- [x] N2a-iv. Test §pack-schema-missing-section: write a pack missing one of the six required sections; validator exits 1 naming the missing section. (AC #3)
- [x] N2a-v. Test §pack-schema-excerpt-forbidden: write a pack whose `code-map-pointers` section contains a fenced code block; validator exits 1 with `pointers-only rule violated`. (AC #3)

### 2b. GREEN

- [x] N2b-i. Create `governance/validators/check-context-pack.js` — zero-dep, exit codes 0/1/2, JSON+stderr contract mirroring `check-doc-manifest.js`. Enforce: frontmatter fields (`change_id`, `built_at_source_hash`, `pack_version`, `sources[]`); six required `##` sections in fixed order; ban ISO timestamps outside the schema, UUIDs, `/tmp/…` and other wall-clock/host-varying patterns; ban fenced code blocks under `## code-map-pointers` and `## specs`. (AC #3, #11)

### 2c. REFACTOR

- [x] N2c. Re-run §pack-byte-stability-* and §pack-schema-* → green; full governance suite → no regression.

## 3. Freshness validator (`check-context-pack-freshness.js`)

### 3a. RED

- [x] N3a-i. Test §freshness-all-sources-match: given a pack whose every `sources[N].sha256` matches the file on disk, exit 0.
- [x] N3a-ii. Test §freshness-one-source-diverges: mutate one source file after pack build; validator exits 1 naming the divergent path. (AC #2, #6)
- [x] N3a-iii. Test §freshness-source-missing: delete one source file; validator exits 1 with `source-missing` naming the path. (AC #2)
- [x] N3a-iv. Test §freshness-scope-only-declared-sources: mutate a file that is NOT in `sources[]`; validator exits 0 (invalidation MUST NOT be repo-wide). (AC #6)
- [x] N3a-v. Test §freshness-separation-from-doc-manifest: run both validators on the same change dir where the pack is stale but the doc-manifest is complete; freshness exits 1 while doc-manifest exits 0 (the two failure modes stay independent). (AC #12)

### 3b. GREEN

- [x] N3b-i. Create `governance/validators/check-context-pack-freshness.js` — reads the pack frontmatter, walks `sources[]`, recomputes sha256, exits 0 iff all match. Never globs the repo; only reads the paths declared in `sources[]`. Uses `findProjectRoot` / `AIDAKIT_PROJECT_ROOT` per [ADR-004](../../decisions/ADR-004-aidakit-governance-env-contract.md). (AC #6, #11, #12)

### 3c. REFACTOR

- [x] N3c. Re-run §freshness-* → green; full governance suite → no regression.

## 4. `aidakit:context-pack` skill (build / verify / rebuild)

### 4a. RED

- [x] N4a-i. Test §build-deterministic-twice: call `build` twice from identical sources; `diff -q pack1 pack2` returns nothing (byte-identical). (AC #4, #11)
- [x] N4a-ii. Test §build-deterministic-under-host-fuzz: broaden AC #11 (byte-stability) coverage by fuzzing every host-varying vector the pack schema forbids. Sub-bullets:
  - [x] **N4a-ii-a. Wall-clock fuzz** — mock `Date.now` and/or set env `SOURCE_DATE_EPOCH` to different values across two consecutive `build` invocations from identical sources; output bytes remain identical. (AC #11)
  - [x] **N4a-ii-b. PID fuzz** — run one `build` in the current process (PID A) and a second `build` in a forked/spawned subprocess (PID B, e.g. via `node:child_process.spawnSync`) from the same source tree; `diff -q` returns nothing. Alternative equivalent: inject a fake PID via env (e.g. `FAKE_PID=99999`) if the build helper reads a PID at all — the assertion is that no PID reaches the output regardless of vector. (AC #11)
  - [x] **N4a-ii-c. Tmp-cwd fuzz** — copy the source tree into `/tmp/build-a-<rand>` and `/tmp/build-b-<rand>` (byte-identical trees, different absolute paths), run `build` from each cwd, assert byte-identical pack output. Guarantees no absolute path from the build environment leaks into the pack (paths inside the pack must be repo-relative, not cwd-relative). (AC #11)
- [x] N4a-iii. Test §build-sources-path-sorted: input sources in random order → `sources[]` in the output is path-sorted lexicographically.
- [x] N4a-iv. Test §build-rebuild-refreshes-hashes: mutate a source, run `rebuild`; the pack's `sources[N].sha256` for that path updates and `built_at_source_hash` changes. (AC #7)
- [x] N4a-v. Test §verify-wraps-both-validators: `verify` returns non-zero if either byte-stability OR freshness fails. (AC #4)

### 4b. GREEN

- [x] N4b-i. Create `skills/context-pack/SKILL.md` (contract only) with the three subcommands documented and the deterministic-build discipline stated as an inviolable rule (LF line endings, path-sorted, no wall-clock, no PID, no tmp-path, no random IDs). Document that the underlying node script lives at `governance/context-pack/build.js` (reachable from `runs` steps via `$AIDAKIT_GOVERNANCE/context-pack/build.js` per [ADR-004](../../decisions/ADR-004-aidakit-governance-env-contract.md)). Cite [ADR-012](../../decisions/ADR-012-context-pack-per-change.md). (AC #4)
- [x] N4b-ii. Create `governance/context-pack/build.js` (NOT under `skills/` — placement under `governance/` is what makes it reachable through `$AIDAKIT_GOVERNANCE`; `skills/` is a sibling of `governance/`, not a child, so a `skills/context-pack/build.js` node script would not be callable from a `runs` step): discover sources from the change dir (proposal/design/tasks + cited ADRs/specs), compute sha256, render the six sections with pointers-only content, write byte-stably. Support `build`, `rebuild` (=`build --force`), `verify` (runs both validators). Zero-dep node, mirrors the invocation contract of `governance/validators/check-doc-manifest.js`. (AC #1, #3, #4)

### 4c. REFACTOR

- [x] N4c. Re-run §build-* and §verify-* → green; full suite → no regression.

## 5. New flow phase `context_pack` in `full.yaml` and `fast.yaml`

### 5a. RED

- [x] N5a-i. Test §flow-full-phase-inserted: load `full.yaml`; assert a `context_pack` step exists with `type: runs` (NOT `invoke` — the `$AIDAKIT_GOVERNANCE` env var only reaches `runs`-step children per [ADR-004](../../decisions/ADR-004-aidakit-governance-env-contract.md) §Decision); asserts the wiring `readiness.on_result.approved === "context_pack"`, `context_pack.on_success === "implement"`, `context_pack.on_failure === "implement"` (best-effort, fail-safe). (AC #5)
- [x] N5a-ii. Test §flow-fast-phase-inserted: same assertions on `fast.yaml` — `type: runs`, inserted between `readiness` (currently at line 100) and `implement` (currently at line 113), same routing. (AC #5)
- [x] N5a-iii. Test §flow-phase-uses-governance-env: the `context_pack.command` string contains BOTH `"$AIDAKIT_GOVERNANCE/validators/check-context-pack-freshness.js"` AND `"$AIDAKIT_GOVERNANCE/context-pack/build.js"` (the build script lives under `governance/context-pack/`, not `governance/skills/context-pack/` — see §4b-ii and [ADR-004](../../decisions/ADR-004-aidakit-governance-env-contract.md)). Both invocations are double-quoted. (AC #5)
- [x] N5a-iv. Test §flow-phase-interpolates-change-id: the command references `${context.select.change_id}` inside double quotes ([ADR-006](../../decisions/ADR-006-flow-values-as-data.md)). (AC #5)
- [x] N5a-v. Test §flow-back-edges-unchanged: assert that back-edges to `implement` from `check_implement_bench.on_failure`, `check_review_bench.on_failure` (which routes to `review_bench` in full.yaml, but the pattern applies to any flow with implement back-edges), `bench_outcome.on_failure`, `hardening.on_failure` are LEFT UNCHANGED (the `context_pack` phase runs ONCE per plan-approval, not on every back-edge into `implement`; back-edge staleness is handled by the dispatcher's read-if-present fallback). (AC #5)

### 5b. GREEN

- [x] N5b-i. Edit [`governance/flows/full.yaml`](../../../governance/flows/full.yaml): change `readiness.on_result.approved` from `implement` (line 157) to `context_pack`; insert a `context_pack` step with `type: runs` between `readiness` (lines 148-159) and `implement` (line 161). The step's `command` runs `node "$AIDAKIT_GOVERNANCE/validators/check-context-pack-freshness.js" "docs/features/${context.select.change_id}/.context-pack.md"` and on non-zero exit invokes `node "$AIDAKIT_GOVERNANCE/context-pack/build.js" --change-id "${context.select.change_id}"` (chained via `||`, mirroring the shape shown in [design.md](design.md) §"The new flow phase"). Route `on_success: implement` and `on_failure: implement`. Do NOT touch the back-edges to `implement` from `check_implement_bench` (line 188), `bench_outcome` (line 222), or `hardening` (line 232). (AC #5)
- [x] N5b-ii. Edit [`governance/flows/fast.yaml`](../../../governance/flows/fast.yaml): identical insertion between `readiness` (line 100) and `implement` (line 113); same routing; same back-edge preservation.

### 5c. REFACTOR

- [x] N5c. Re-run §flow-* → green; run `node governance/__tests__/engine.test.mjs` → no regression.

## 6. Dispatcher/reviewer wiring (read-if-present, graceful fallback — freshness upstream)

### 6a. RED — contract test per dispatcher

- [x] N6a-i. Test §dispatcher-reads-pack-when-present: for each of `agents/adr-reviewer.md`, `agents/spec-reviewer.md`, `agents/reviewer-quality.md`, `agents/reviewer-security.md`, `agents/reviewer-architecture.md`, `agents/tester.md`, `agents/implementer.md`, `skills/implement/SKILL.md`, `skills/review/SKILL.md`, `skills/ship/SKILL.md` — grep-assert the file contains the marker string `context pack` AND references `docs/features/<change_id>/.context-pack.md` (or the templated equivalent). (AC #8)
- [x] N6a-ii. Test §dispatcher-falls-back-when-absent: same files contain an explicit fallback clause (regex: `fall.?back.*raw|absent.*proposal|pack.*absent`). (AC #8)
- [x] N6a-iii. Test §dispatcher-does-not-invoke-freshness-validator: grep-assert that NONE of the ten files above shell out to `check-context-pack-freshness.js` (regex: `check-context-pack-freshness`). Freshness is guaranteed by the upstream `context_pack` `runs` phase per [ADR-004](../../decisions/ADR-004-aidakit-governance-env-contract.md) §negative-consequence-2 — agent Bash sessions do not receive `$AIDAKIT_GOVERNANCE`, and the `agent-validator-paths` gap in [EPIC-flow-engine-leashes](../../roadmap/epics/EPIC-flow-engine-leashes.md) is explicitly out of scope for this change. (AC #8)

### 6b. GREEN

- [x] N6b-i. Add a "Step 0.5 — Load the context pack" clause to each of the seven agent files listed above: **read `docs/features/<change_id>/.context-pack.md` when the file exists** (no freshness re-check — freshness is guaranteed by the upstream `context_pack` flow phase per [ADR-004](../../decisions/ADR-004-aidakit-governance-env-contract.md)); treat the pack as authoritative for durable context; open pointed-at files on demand; **fall back to reading `proposal.md`/`design.md`/`tasks.md`/cited ADRs directly when the pack is absent — never fail the dispatch**. Do NOT instruct the agent to invoke `check-context-pack-freshness.js` — that validator is called only from the `context_pack` `runs` step, never from an agent/skill Bash session. (AC #8)
- [x] N6b-ii. Add the equivalent read-if-present clause to `skills/implement/SKILL.md`, `skills/review/SKILL.md`, `skills/ship/SKILL.md` under Prerequisites so their invocation prompt injects the pack. Same no-freshness-invocation rule. (AC #8)

### 6c. REFACTOR

- [x] N6c. Re-run §dispatcher-* → green.

## 7. Telemetry: JSONL file + engine write-site extension

### 7a. RED

- [x] N7a-i. Test §telemetry-lines-valid-json: write a synthetic telemetry file with three dispatches; every line parses as JSON and carries the six declared fields (`subagent`, `cache_creation`, `cache_read`, `pack_size`, `duration_ms`, `pack_rebuilt`) plus `ts`. (AC #9)
- [x] N7a-ii. Test §telemetry-append-only: append a fourth dispatch; the file contains four lines in the original order (no truncation, no rewrite of prior lines). (AC #9)
- [x] N7a-iii. Test §telemetry-gitignored: assert `.aidakit/` line is present in [`.gitignore`](../../../.gitignore) so `.aidakit/tasks/<id>/.telemetry.jsonl` is transitively ignored. (AC #9)

### 7b. GREEN

- [x] N7b-i. Create `governance/telemetry/append.js` — the JSONL-append helper. Zero-dep node, resolves `.aidakit/tasks/<change_id>/.telemetry.jsonl` via `findProjectRoot`/`AIDAKIT_PROJECT_ROOT` (same convention as `check-doc-manifest.js`), opens the file in append mode, writes one JSON object per invocation, never rewrites prior content. (AC #9)
- [x] N7b-ii. Confirm [`.gitignore`](../../../.gitignore) already covers `.aidakit/` (line 1) — no edit required; document in `evidence.md`. (AC #9)

### 7c. REFACTOR

- [x] N7c. Re-run §telemetry-* → green.

### 7d. RED — engine extension for the live write-site

> Context (see [design.md](design.md) §"Live write-site — engine extension" and [ADR-012](../../decisions/ADR-012-context-pack-per-change.md) Consequences): [`governance/engine/steps/invoke.js`](../../../governance/engine/steps/invoke.js) is IoC — it pauses, asks the parent Claude to dispatch, resumes on `node governance/cli.js resume …`. The engine itself never observes the SDK response, so the only sanctioned live write-site for `.telemetry.jsonl` is the resume handler, extended additively to accept usage kwargs from the parent.

- [x] N7d-i. Test §resume-parses-telemetry-kwargs: `node governance/cli.js resume <flow_id> <outcome> change_id=<id> --tokens-cache-read=18320 --tokens-cache-creation=1240 --tokens-output=512 --duration-ms=11530 --pack-rebuilt=false` parses without error; the existing `<flow_id> <outcome> [key=value ...]` signature keeps working; the new kwargs are validated as safe single tokens under the same rule as `resume-output.js` (integers for the counters, `true|false` for `pack-rebuilt`); a malformed kwarg errors out BEFORE any state is touched. (AC #9)
- [x] N7d-ii. Test §invoke-forwards-kwargs-to-helper: when the resume handler receives the telemetry kwargs, it forwards them to `governance/telemetry/append.js` with `subagent` derived from `step.invoke_target`, `pack_size` computed from the on-disk pack (0 if absent), and `ts` set to the current UTC ISO-8601 timestamp; one JSONL line is appended to `.aidakit/tasks/<change_id>/.telemetry.jsonl` with the six declared fields plus `ts`. (AC #9)
- [x] N7d-iii. Test §resume-without-kwargs-writes-nothing: `node governance/cli.js resume <flow_id> <outcome>` (no telemetry kwargs) proceeds normally and appends NO line to `.telemetry.jsonl`; the flow state advances exactly as it did before this extension. Backward-compatibility guard for every existing `resume` callsite (all current flows, all current tests, every third-party driver). (AC #9)
- [x] N7d-iv. Test §engine-test-still-green: `node governance/__tests__/engine.test.mjs` (which drives `invoke.js` through many `resume` paths) → 127/0 with no code change to the test file itself. Any regression here indicates the extension was NOT additive.

### 7e. GREEN — engine extension

- [x] N7e-i. Extend [`governance/cli.js`](../../../governance/cli.js) `cmdResume`: after `parseResumeOutput` handles the existing `key=value` structured outputs, parse the additional `--tokens-cache-read=N`, `--tokens-cache-creation=N`, `--tokens-output=N`, `--duration-ms=N`, `--pack-rebuilt=true|false` kwargs (leading `--`, integer or boolean values only, single safe tokens). Group them into a `telemetry` object and pass it through to `resumeFlow`; when none of the kwargs are supplied, `telemetry` is `undefined`. (AC #9)
- [x] N7e-ii. Extend [`governance/engine/steps/invoke.js`](../../../governance/engine/steps/invoke.js) `executeInvoke` (resume branch, entered when `ctx.resumeValue !== undefined`): after the existing outputs-persistence step, when `ctx.telemetry` is present, call `governance/telemetry/append.js`'s helper with `{subagent: step.invoke_target, cache_read, cache_creation, output_tokens, duration_ms, pack_rebuilt, pack_size, ts}`. When `ctx.telemetry` is absent, do nothing (no line written, no error). Freshness/routing/existing behavior is unchanged. (AC #9)
- [x] N7e-iii. Thread `telemetry` through `resumeFlow` (in `governance/engine/engine.js`) into `ctx.telemetry` so `invoke.js` can read it. No change to routing, no change to outcomes, no new fields on `state`. Pure additive plumbing.

### 7f. REFACTOR — engine extension

- [x] N7f-i. Re-run §resume-parses-telemetry-kwargs, §invoke-forwards-kwargs-to-helper, §resume-without-kwargs-writes-nothing → green.
- [x] N7f-ii. Cross-check every existing `resume` callsite continues to work: grep the repo for `cli.js resume ` and `resumeFlow(` — every match must operate unchanged (no telemetry required). Confirm all `governance/flows/*.yaml` invoke steps' resume prompts still print the exact same instruction line (the extension is invisible to callers that don't opt in).

## 8. `aidakit:learn` rollup into `evidence.md`

### 8a. RED

- [x] N8a-i. Test §learn-rollup-written: given a synthetic telemetry JSONL with three dispatches, `aidakit:learn` writes a `## Context-pack telemetry rollup` section into `evidence.md` containing total dispatches, mean `pack_size`, sum of `cache_read`/`cache_creation`, count of `pack_rebuilt=true`, and a per-subagent table. (AC #10)
- [x] N8a-ii. Test §learn-rollup-idempotent: running `learn` twice replaces the section rather than duplicating it. (AC #10)

### 8b. GREEN

- [x] N8b-i. Edit [`skills/learn/SKILL.md`](../../../skills/learn/SKILL.md): add §4.5 "Context-pack telemetry rollup" that reads `.aidakit/tasks/<change_id>/.telemetry.jsonl`, aggregates it, and writes the rollup section into `evidence.md` idempotently. Cite [ADR-012](../../decisions/ADR-012-context-pack-per-change.md). (AC #10)
  - When `.telemetry.jsonl` is absent OR empty (zero lines), the rollup section written into `evidence.md` says exactly `No telemetry captured for this run.` instead of crashing on a missing file or zero-division on empty aggregates. The section header itself is still written (so the idempotent replacement in N8a-ii keeps working on the next run when telemetry does arrive).

### 8c. REFACTOR

- [x] N8c. Re-run §learn-* → green.

## 9. ADR-012 + index update

### 9a. RED

- [x] N9a-i. Test §adr-010-passes-format: `node governance/validators/check-adr-format.js docs/decisions/ADR-012-context-pack-per-change.md` exits 0. (AC #13)
- [x] N9a-ii. Test §adr-010-indexed: `docs/decisions/README.md` contains a row for `ADR-012` in the ID table AND a mention under a thematic bucket. (AC #13)

### 9b. GREEN

- [x] N9b-i. Create [`docs/decisions/ADR-012-context-pack-per-change.md`](../../decisions/ADR-012-context-pack-per-change.md) with the five sections (Status+Date · Context · Decision · Consequences · Alternatives considered) mirroring [ADR-009](../../decisions/ADR-009-flow-commits-plan-early.md). Status: `Proposed` at authoring time, moves to `accepted` in the same commit that merges this change. (AC #13)
- [x] N9b-ii. Edit [`docs/decisions/README.md`](../../decisions/README.md): add the ADR-012 row to the index table and a bullet under an appropriate thematic bucket (Context caching — new bucket, or extend Learning & memory). (AC #13)

### 9c. REFACTOR

- [x] N9c. Re-run §adr-010-* → green; `node governance/validators/check-links.js docs/decisions` → exit 0.

## 10. Dogfood: build the pack for THIS change

- [x] N10. Run `node governance/context-pack/build.js --change-id context-pack-l1` → writes `docs/features/context-pack-l1/.context-pack.md`. Validate:
  - `node "$AIDAKIT_GOVERNANCE/validators/check-context-pack.js" docs/features/context-pack-l1/.context-pack.md` → exit 0. (AC #1, #3, #11)
  - `node "$AIDAKIT_GOVERNANCE/validators/check-context-pack-freshness.js" docs/features/context-pack-l1/.context-pack.md` → exit 0. (AC #2, #6, #12)
  - Re-run `build` → produces byte-identical output (`diff -q` returns nothing). (AC #4)

## 11. Full suite + doc validators

- [x] N11-i. `node governance/__tests__/engine.test.mjs` → green (no regression).
- [x] N11-ii. All `governance/__tests__/*.test.mjs` → green (including the new `context-pack.test.mjs`).
- [x] N11-iii. `node governance/validators/derive-roadmap-status.js --root .` → exit 0; `context-pack-l1` derives `in-progress`.
- [x] N11-iv. `node governance/validators/check-links.js docs/features/context-pack-l1` → exit 0.
- [x] N11-v. `node governance/validators/check-adr-format.js docs/decisions/ADR-012-context-pack-per-change.md` → exit 0.
- [x] N11-vi. `node governance/validators/check-doc-manifest.js .aidakit/tasks/context-pack-l1/doc-manifest.json` → exit 0 (produced by the flow's `document` step; verified end-to-end that a stale context pack does NOT trip this validator — AC #12).
