# Design — retry-memory

**Change ID:** `retry-memory`
**Date:** `2026-07-24`
**Owner:** `@chacal88`
**Phase / Package:** `engine + flows (governance/) + skills — structured retry history for the implement loop`

## Problem shape

Back-edges in [full.yaml](../../../governance/flows/full.yaml) — `critic.revise → specify`, `readiness.needs-revision → specify`, `check_implement_bench.on_failure → implement`, `bench_outcome.on_failure → implement`, `hardening.on_failure → implement` — re-dispatch the target step's invoke with the SAME `input:` map every round. The engine's [invoke.js:91-124](../../../governance/engine/steps/invoke.js) renders the input at fresh entry from `step.input`; there is no channel through which a previous round's rejection can inform the next round's dispatch.

[engine-max-visits](../engine-max-visits/design.md) bounds these loops — after 3 dispatches of `specify` the flow escalates via `specify_escalation` — but a bounded loop that re-produces the same output in every round is still a wasted loop. The user's captured session that motivated `engine-max-visits` (specify ↔ critic, ~102M tokens on round 4) is the archetype: the second and third rounds could have been informed by round 1's critique but were not.

## Mechanism

Two data paths and one committed artifact:

```
                                       (writes on failure)
  ┌────────────┐   fail   ┌───────────────────────────┐   append   ┌────────────────────────────┐
  │  critic    │─────────▶│ record_critic_cause       │───────────▶│ docs/features/<id>/        │
  │  (invoke)  │  cause=  │ (runs — append helper)    │            │ retry-history.json         │
  └────────────┘  <key>   └───────────────────────────┘            └────────────────────────────┘
       │                                                                        │
       │ok                                                                      │
       ▼                                                                        │reads
  ┌────────────┐                                                                ▼
  │ pre_apply  │                                                      ┌────────────────────┐
  └────────────┘                                                      │  aidakit:implement │
                                                                      │  (input:           │
                                                                      │   retry_history_   │
                                                                      │   path)            │
                                                                      └────────────────────┘
```

### The committed artifact — `docs/features/<change-id>/retry-history.json`

- **Location:** `docs/features/${context.select.change_id}/retry-history.json` — sibling of `proposal.md`/`design.md`/`tasks.md`/`evidence.md`. Committed to git as part of the change's docs. **This is why the file lives here and not under `.aidakit/`**: [ADR-007](../../decisions/ADR-007-roadmap-status-from-shared-git.md) / [ADR-009](../../decisions/ADR-009-flow-commits-plan-early.md) established the doctrine that flow-produced artifacts a downstream reader needs must be committed early to be visible from any worktree/clone. `.aidakit/` is gitignored and per-worktree; a signal that lives only there is not a signal.
- **Shape:** a JSON array of records (empty array `[]` when there are no failures yet):

  ```json
  [
    { "round": 1, "step_id": "specify", "cause": "critic-reject" },
    { "round": 2, "step_id": "specify", "cause": "readiness-not-ready" },
    { "round": 1, "step_id": "implement", "cause": "bench-veto-security" }
  ]
  ```

  Field semantics:
  - `round` (positive integer): the `state.context.__visits[step_id]` value at the time of the write — i.e. the dispatch count of the RETRY TARGET after the failure that just happened. So a record with `step_id: "specify"` and `round: 1` means "the first dispatch of `specify` failed; the second dispatch (round 2) will read this record". Reading `__visits` avoids a parallel counter (see §Relationship to `__visits`).
  - `step_id` (string): the retry-target step id (the step that will be re-dispatched), NOT the failing source. This is what the READER cares about — "how many times has THIS step run so far, and why did each prior round fail". A single change's `retry-history.json` may interleave records for multiple targets (`specify` and `implement`) — the reader filters by its own step id.
  - `cause` (snake_case single-token key, matches `RESUME_OUTPUT_VALUE_RE` from [ADR-006](../../decisions/ADR-006-flow-values-as-data.md) §2): a stable identifier for the failure class. Never raw stdout/stderr, never prose. See §Cause-key registry.

- **Append is atomic:** the append helper writes a new file to `<path>.tmp` then `rename`s over the original (POSIX `rename` is atomic within a filesystem). Concurrent writers are impossible in practice (see §Single writer), but the atomic swap keeps a partial write from ever landing on disk.
- **Fail-safe on missing file:** first append creates the file with `[]` semantics (writes `[{record}]`); reads treat missing/empty/malformed as "no history" (round 1 semantics, unchanged).
- **Size bounded by `max_visits`:** each retry target has (or will have) a `max_visits: N` — the file grows to at most `N-1` records per target per flow-run. No explicit size cap needed (Non-goals #3 in [proposal.md](proposal.md#non-goals)).

### The append helper — `governance/validators/append-retry-history.js`

Zero-dep, pure Node, same shape as the other validators (see [check-bench.js](../../../governance/validators/check-bench.js), [check-doc-manifest.js](../../../governance/validators/check-doc-manifest.js) etc). CLI:

```
node governance/validators/append-retry-history.js <change_id> <target_step_id> <cause> [--flow-id <flow_id>]
```

Behavior:
1. If `<change_id>` or `<cause>` is empty (unresolved interpolation, per [ADR-006](../../decisions/ADR-006-flow-values-as-data.md) fail-safe), exit 0 no-op (same defensive pattern as `commit_plan` in `full.yaml` — [ADR-009](../../decisions/ADR-009-flow-commits-plan-early.md)). This is why the runs step is `on_success/on_failure` fall-through to the retry target regardless.
2. Validate `<cause>` matches `RESUME_OUTPUT_VALUE_RE` (`^[A-Za-z0-9._:@/-]+$`). If not, exit 1 with a diagnostic — a bad cause key is a real error (the caller writing it violated the contract).
3. Compute the record: `round` = read from `.aidakit/flows/state/<flow_id>.json` (the canonical state path defined by [persistence.js:25,31](../../../governance/engine/persistence.js) — `stateDir()` returns `.aidakit/flows/state`, `statePath(flowId)` returns `<stateDir>/<flowId>.json`; we must NOT reinvent the path here) `state.context.__visits[<target_step_id>]` (present because `<target_step_id>` has already been visited at least once — otherwise there would be no failure to record). If `--flow-id` is not passed and cannot be inferred from `$AIDAKIT_FLOW_ID`, or the state file is missing, fall back to `round: null` (helper still records the cause; reader tolerates null). Implementation MUST import the path helpers (`projectRoot`, and the equivalent `statePath` construction) from `persistence.js` rather than string-concatenate the path, so any future move of the state root propagates automatically. A dedicated anti-drift test (see [tasks.md §2a test 1f-anti-drift](tasks.md#2a-red)) pins this contract.
4. Read `docs/features/<change_id>/retry-history.json` (create with `[]` if absent), parse, append, write to `.tmp`, rename.
5. Emit JSON on stdout `{validator, ok, change_id, target_step_id, cause, round}`; exit 0 on success.

Contract mirrors the other validators (exit 0/1/2, JSON on stdout, human report on stderr). The flow calls it via short `runs` steps — the [ADR-006](../../decisions/ADR-006-flow-values-as-data.md) env-passing already renders `${context.select.change_id}` and `${context.<failing_step>.cause}` as `$AIDAKIT_VAR_n` bound in the child env, so no value ever touches the command text.

### Single writer — WHERE the append happens

The brainstorm assumption was "the routing that dispatches `on_failure` appends before re-queuing". We realize that as a dedicated **short `runs` step positioned on the failure branch**, one per source-of-failure. Placing it in the flow (not the engine core) preserves the engine's "no side effects hidden from the YAML" property — every act the flow performs is visible in `full.yaml`.

Three record sites in `full.yaml`:

| Source step | Trigger | New runs step | Target after append |
|---|---|---|---|
| `critic` | `on_result.revise` | `record_critic_cause` (`--target specify --cause ${context.critic.cause}`) | `specify` |
| `readiness` | `on_result.needs-revision` | `record_readiness_cause` (`--target specify --cause ${context.readiness.cause}`) | `specify` |
| `check_implement_bench` | `on_failure` | `record_check_implement_cause` (reads `cause` from sidecar file — see below) | `implement` |
| `bench_outcome` | `on_failure` | `record_bench_outcome_cause` (`--target implement --cause bench-veto`) | `implement` |
| `hardening` | `on_failure` | `record_hardening_cause` (`--target implement --cause test-failure`) | `implement` |

For the **invoke** sources (`critic`, `readiness`) we extend `outputs:` on the failing outcome per [ADR-006](../../decisions/ADR-006-flow-values-as-data.md) §2:

```yaml
  - id: critic
    type: invoke
    outputs:
      revise: [cause]
    on_result:
      ok: pre_apply
      revise: record_critic_cause    # was: specify
```

The resume grammar becomes `resume <flow_id> revise cause=critic-reject`; the fail-closed re-pause (already implemented in [invoke.js:60-75](../../../governance/engine/steps/invoke.js)) enforces the key. `${context.critic.cause}` interpolates into the record helper's command as `$AIDAKIT_VAR_n` per ADR-006.

For the **runs** source (`check_implement_bench`), the caller has no resume-output channel — its outcome is derived from exit code alone. Two sub-options were considered:

| Sub-option | Pros | Cons |
|---|---|---|
| A: `check-bench.js` writes `cause=<key>` to a sidecar `.aidakit/tasks/<id>/last-cause` on exit ≠ 0; `record_check_implement_cause` reads it. | Preserves the `runs` step's shape (single exit code = single outcome); one place captures failure detail (in `check-bench.js`). | Introduces a sidecar file the engine's state does not know about; if two failures interleave (they can't, but theoretically), the sidecar overwrites. |
| B: Split `check_implement_bench` into two runs steps: the first records `cause=bench-violation` unconditionally, the second is today's check. On failure, the recorded cause is already on disk. | No sidecar file; each cause is emitted by a dedicated step. | Ugly and hardcodes cause per branch — loses granularity (all `check_implement_bench` failures collapse to `bench-violation`). |

**Chosen: A**, with the concession that `check_implement_bench`'s cause is initially always `bench-violation` (the granularity — `bench-veto-security` etc — comes from `review_bench` which IS invoke and CAN emit specific causes). Extending `check-bench.js` to write finer-grained causes is a small follow-up; the plumbing accepts arbitrary keys today.

For `bench_outcome` and `hardening` (both runs/invoke where the cause is either fixed per branch or comes from a resume output on `hardening`), we start with a **fixed cause per branch**: `bench-veto` and `test-failure` respectively. Refining `hardening` to emit specific test-failure classes via a resume output is a Non-goal here (it needs the same `outputs:` extension as `critic`).

### Relationship to `__visits`

[engine-max-visits](../engine-max-visits/design.md) established `state.context.__visits[step.id]`: incremented on each fresh entry of a step, read by the parser-validated `max_visits` cap. Retry-memory READS this counter — the `round` field of every retry-history record is `state.context.__visits[<target_step_id>]` at the moment of the write.

- **Timing:** the failing step has ALREADY dispatched (that's what made it fail); its retry target has been dispatched `k` times so far. The write records `round: k` — meaning "the k-th dispatch of `<target>` failed via this cause". The (k+1)-th dispatch of `<target>` (about to happen after the append step routes to it) will see this record in its `retry_history_path`.
- **No parallel counter.** Retry-memory never increments anything. If `__visits[<target>]` is missing (a very old flow state pre-#29, which cannot happen once this ships since #29 is already merged), the helper writes `round: null` and readers treat null as "unknown round" — no crash.
- **Reset semantics inherited.** `__visits` resets on new `startFlow` ([engine.js](../../../governance/engine/engine.js) — a fresh `state.context`); `retry-history.json` is per-change (not per-flow), so it persists across re-runs of the flow for the same change. This is deliberate: if a change gets aborted at `specify_escalation` and a fresh flow starts, the new flow inherits the prior rounds' lessons via the still-present `retry-history.json` — round 1 of the new flow already has memory of what the old flow tried. The `round` field in the new flow's records will re-start at 1 (fresh `__visits`), producing a file with two-run interleaving that the reader can still make sense of by ordering. If this becomes a UX problem, a follow-up can partition by `flow_id`; not needed for v1.

### Read-side injection — how `aidakit:implement` (and `plan`, `learn`) see the history

**Constraint:** per [ADR-006](../../decisions/ADR-006-flow-values-as-data.md) §1, values MUST NOT be spliced into shell command text. That decision explicitly permits plain-string interpolation on non-shell surfaces (`invoke input`, prompts) — because no shell re-parses them. So the injection is via `input:`:

```yaml
  - id: implement
    type: invoke
    invoke_target: aidakit:implement
    input:
      request: "${inputs.request}"
      retry_history_path: "docs/features/${context.select.change_id}/retry-history.json"
```

`${context.select.change_id}` interpolates as a plain string into the `input:` map ([invoke.js:92](../../../governance/engine/steps/invoke.js) `interpolate(step.input, ctx)`), then the pause payload carries `input: {retry_history_path: "docs/features/<resolved-id>/retry-history.json"}` — the driver (Claude) sees the path in the dispatch prompt and passes it to `aidakit:implement`, which reads the file with a plain `fs.readFileSync`.

Why not `$AIDAKIT_RETRY_HISTORY` (the env-var name the brainstorm mentioned)? Because `implement` is `invoke`, not `runs`. `$AIDAKIT_VAR_n` (ADR-006) only reaches a subprocess `bash` spawn; an invoke step doesn't spawn a subprocess — the skill runs in Claude's own context. **The brainstorm's `$AIDAKIT_RETRY_HISTORY` is the CONCEPTUAL name for the injection slot; the CONCRETE realization is `input.retry_history_path`** for invoke and would be `$AIDAKIT_RETRY_HISTORY_PATH` for a hypothetical runs consumer (with the same fail-closed interpolation guarantees). The name in the design is `retry_history_path` (a path, deterministically resolved by the engine) rather than the raw JSON contents (which would require a new engine capability — file-read interpolation — with no offsetting benefit).

The skills (`aidakit:implement`, `aidakit:plan`, `aidakit:learn`) get one paragraph in their `SKILL.md` explaining:

- Read `retry_history_path` at the start of each dispatch.
- If the file is absent, empty, or malformed → treat as round 1 (unchanged behavior). Never crash on a malformed file.
- Filter records to `step_id === "<self>"` (`implement` reads `implement` records; `plan` reads `specify` records).
- Build a prompt-preamble like: "Prior rounds of this step failed with: round 1 → `critic-reject`, round 2 → `readiness-not-ready`. Steer explicitly away from repeating those failure classes."
- Never treat a missing history as a bug.

### Interop with `aidakit:learn`

The [aidakit:learn skill](../../../skills/learn/SKILL.md) already consumes `correction` events from `.aidakit/tasks/<change-id>/events.ndjson` (§1) and already funnels recurrence-≥3× into DNA crystallization (§6, via `deriveCandidates`). Retry-memory bridges to that stream by having the `learn` step also receive `retry_history_path` in its `input:`, and the skill translates each record into a `correction` event:

```json
{"kind":"correction","errorType":"retry-cause","key":"critic-reject","phase":"specify","at":"2026-07-24T…"}
```

Because `deriveCandidates(change-id, {threshold: 3})` groups by `errorType`+`key` ([ledger.js](../../../governance/ledgers/ledger.js) — already implements this bucketing), a `cause` key that recurs 3× in one change (or 3× across changes when the funnel widens) surfaces as a DNA candidate with no ledger changes. This is the "erro recorrente ≥3x" clause of the epic acceptance realized mechanically.

The translation is idempotent by design: `aidakit:learn` compares the record set against events already emitted for this change (existence check by `{errorType, key, phase, round}` tuple) and skips duplicates — a re-run of `learn` on the same history file doesn't inflate the count.

### Cause-key registry

The starter set (all snake_case, all match `RESUME_OUTPUT_VALUE_RE`):

| Key | Emitted by | Meaning |
|---|---|---|
| `critic-reject` | `critic` on `revise` | Spec reviewer asked for a revision. |
| `readiness-not-ready` | `readiness` on `needs-revision` | Mechanical readiness gate flagged the plan as not-ready. |
| `bench-violation` | `check_implement_bench` on failure | Parallelism bench leash rejected the implement run (any of: missing role, false consensus, non-parallel dispatch). Finer-grained keys can come later from `check-bench.js` — plumbing already accepts arbitrary keys. |
| `bench-veto` | `bench_outcome` on failure (review bench said rejected) | Review bench rejected consensus. Same finer-grain caveat. |
| `bench-veto-security` | (future) `review_bench` on `rejected` when veto came from a security-role | Reserved for the review-bench `outputs` extension. |
| `bench-veto-architecture` | (future) `review_bench` on `rejected` when veto came from an architecture-role | Reserved. |
| `bench-veto-quality` | (future) `review_bench` on `rejected` when veto came from a quality-role | Reserved. |
| `test-failure` | `hardening` on failure | Full test suite failed at hardening. Coarse-grained; finer classification is a Non-goal (see Non-goal on `hardening` output extension). |
| `check-failure` | (fallback) any runs check whose specific cause is unknown | Escape hatch — never intentionally emitted by a shipped step, but the registry names it so an ad-hoc caller has a valid key. |

**Growth rule:** adding a new key is a doc-only PR (this table + a note in the emitting step). No code change gate — the append helper only validates the shape (`RESUME_OUTPUT_VALUE_RE`), not membership. Reasoning: a closed set would need an ADR the first time an unforeseen failure shape emerges, which is exactly when the friction is worst.

### `full.yaml` diff shape

Additive; no existing step semantics change. New shape around `critic` (analogous for `readiness` and the three back-to-`implement` paths):

```yaml
  - id: critic
    type: invoke
    invoke_target: aidakit:spec-reviewer
    expects: [ok, revise]
    outputs:
      revise: [cause]              # NEW — ADR-006 §2
    on_result:
      ok: pre_apply
      revise: record_critic_cause  # was: specify

  - id: record_critic_cause          # NEW — the append gate
    type: runs
    description: |
      RETRY-MEMORY (single writer) — records the critic's cause key in
      docs/features/<change_id>/retry-history.json before re-entering specify,
      so aidakit:plan sees the shape of the prior rejection on its next round
      and aidakit:learn later reads the correction stream for DNA promotion.
      Best-effort and fail-safe: an unresolvable change_id or cause short-circuits
      to a no-op (exit 0) — the flow must never loop on a bookkeeping hiccup.
    command: "node \"$AIDAKIT_GOVERNANCE/validators/append-retry-history.js\" \"${context.select.change_id}\" specify \"${context.critic.cause}\" --flow-id \"$AIDAKIT_FLOW_ID\""
    on_success: specify
    on_failure: specify              # never blocks the retry target
```

Notes:
- `on_success` and `on_failure` both route to the retry target — a bookkeeping failure must not swallow the retry (same doctrine as `commit_plan` in [ADR-009](../../decisions/ADR-009-flow-commits-plan-early.md)).
- `$AIDAKIT_FLOW_ID` is added to the engine's `runs` child env alongside `$AIDAKIT_GOVERNANCE` (ADR-004) so the helper can locate the state file. This is a one-line addition to [runs.js](../../../governance/engine/steps/runs.js).
- Every `${…}` value in `command` is env-passed per [ADR-006](../../decisions/ADR-006-flow-values-as-data.md); the command text never contains a value, so a `cause` with unexpected characters (would be rejected by the parser fail-closed resume-output check, but as belt-and-suspenders) cannot alter command structure.

## Test surface

New file: [governance/__tests__/retry-memory.test.mjs](../../../governance/__tests__/retry-memory.test.mjs) (mirrors [engine.test.mjs](../../../governance/__tests__/engine.test.mjs) idiom — pure Node `.mjs`, `let pass=0, fail=0`, `ok()`/`eq()`, exit code = fail count). Sections:

- **§1 — Append helper unit tests.**
  - 1a: append into a missing dir/file creates both; the file is `[<record>]`.
  - 1b: append into an existing file appends; ordering preserved; no duplication.
  - 1c: empty `change_id` or empty `cause` → exit 0 no-op, file unchanged.
  - 1d: invalid `cause` (contains a space) → exit 1, file unchanged.
  - 1e: atomic write — assert the `.tmp` file does not exist after a successful call (rename cleaned it up); simulate a crash mid-write by pre-creating a stale `.tmp` and asserting the next append overwrites cleanly.
  - 1f: `round` is read from a mock state file's `__visits[<target>]`; missing state → `round: null`.

- **§2 — Resume-output extension on invoke steps.**
  - 2a: modify a minimal test flow with `critic` declaring `outputs: {revise: [cause]}`; parser accepts.
  - 2b: drive the flow; resume with `revise` alone (no `cause=`) → the invoke re-pauses (same fail-closed behavior as [invoke.js:60-75](../../../governance/engine/steps/invoke.js)).
  - 2c: resume with `revise cause=critic-reject` → `context.critic.cause === "critic-reject"`, the flow proceeds to `record_critic_cause`.

- **§3 — `full.yaml` schema.**
  - 3a: `implement.input.retry_history_path === "docs/features/${context.select.change_id}/retry-history.json"`; same for `specify` and `learn`.
  - 3b: `critic.outputs === {revise: [cause]}`; `readiness.outputs === {"needs-revision": [cause]}`.
  - 3c: `record_critic_cause`, `record_readiness_cause`, `record_check_implement_cause`, `record_bench_outcome_cause`, `record_hardening_cause` all exist as `runs` steps with `on_success === on_failure === <target>`.
  - 3d: back-edges wire through the new record steps: `critic.on_result.revise === "record_critic_cause"`, etc; no leftover direct back-edge.

- **§4 — End-to-end drive.**
  - 4a: start `full` for a mock change-id; drive select/classify/brainstorm/specify=success/commit_plan; critic=revise `cause=critic-reject`; assert `record_critic_cause` runs; assert `docs/features/<id>/retry-history.json` on disk = `[{round: 1, step_id: "specify", cause: "critic-reject"}]`; drive second round of specify (=success)/commit_plan/critic=ok; assert the file is unchanged.
  - 4b: extend 4a to `learn`: drive through implement=success/checks=success/review_bench=consensus/checks=success/hardening=success/learn=success; assert the `learn` dispatch pause carried `input.retry_history_path`; simulate the skill emitting the correction event and assert the events.ndjson has one `{errorType:"retry-cause", key:"critic-reject", phase:"specify"}` record.
  - 4c: exhaust the specify loop (three revise rounds via [engine-max-visits](../engine-max-visits/design.md)'s `max_visits: 3`); assert `retry-history.json` has 3 records `{round: 1..3, step_id: "specify", cause: "critic-reject"}` and the flow reached `specify_escalation` (the escalation is unchanged — retry-memory doesn't alter the cap semantic).

- **§5 — Cross-file: no regression in engine.test.mjs.** Not a new assertion — just a run to confirm 149/0 stays 149/0 (engine core untouched).

All sections use the existing `driveDry`-style harness. No new test infrastructure.

## Backwards compatibility

- Existing changes without a `retry-history.json` file: the readers treat missing as "no history" → round 1 semantics unchanged.
- Existing flows: only `full.yaml` is modified. `fast.yaml`, `design.yaml`, `docs-onboarding.yaml` are untouched — they don't have the back-edges this change targets.
- Existing invoke steps that don't declare `outputs:` in resume-output form: unchanged (the extension is opt-in per step, per [ADR-006](../../decisions/ADR-006-flow-values-as-data.md)).
- Existing tests: the change adds a new file (`retry-memory.test.mjs`) and does not touch `engine.test.mjs` — assumes `149/0` remains after the change.

## Rollback

- `retry-history.json` is a normal committed file — `git rm docs/features/<id>/retry-history.json` in a follow-up commit removes the artifact if the change is rolled back after landing.
- The `record_*_cause` runs steps are additive; removing them from `full.yaml` restores today's direct back-edges. The invoke steps' `outputs:` extensions are removed at the same time.
- `append-retry-history.js` is a new file — `git rm` it. No engine core changes to unwind (only a one-line addition to `runs.js` for `AIDAKIT_FLOW_ID`, which is a straightforward revert).

## Anti-drift check

Re-inspected before writing this design:

- [engine.js:130-182](../../../governance/engine/engine.js) `drive()` — max-visits check reads `state.context.__visits[step.id]` (increments on fresh entry). Confirmed the counter is populated for any step ever dispatched — the helper's read is safe. (`state.context.__visits` is initialized to `{}` on first bump; missing key = 0.)
- [invoke.js:60-75](../../../governance/engine/steps/invoke.js) — fail-closed `outputs` leash: a resume with a missing declared key re-pauses. Confirmed the `outputs: {revise: [cause]}` extension gets the fail-closed guarantee for free.
- [invoke.js:92](../../../governance/engine/steps/invoke.js) — `interpolate(step.input, ctx)`: plain-string interpolation into the input map, no shell involved. Confirmed the `retry_history_path` injection is safe per [ADR-006](../../decisions/ADR-006-flow-values-as-data.md) §Decision 1.
- [full.yaml:120](../../../governance/flows/full.yaml) `commit_plan` — precedent for `runs` steps whose `on_success` and `on_failure` both route to the same successor (best-effort, fail-safe). Confirmed the same pattern for `record_*_cause`.
- [ledger.js:137+](../../../governance/ledgers/ledger.js) `deriveCandidates(changeId, {threshold})` — groups by `errorType`+`key`. Confirmed `{errorType:"retry-cause", key:<cause>}` slots in without ledger changes.
- [aidakit:learn SKILL.md §6](../../../skills/learn/SKILL.md) — DNA crystallization triggers on `deriveCandidates(..., {threshold: 3})`. Confirmed the correction-event bridge is enough — no new skill wiring for DNA promotion.
- [engine-max-visits/design.md](../engine-max-visits/design.md) §Escalation semantics — a specify_escalation route ends the flow; retry-memory writes are lost if the escalation aborts (the append still happened before the escalation runs, so the file already has the records; a fresh flow re-reads them). Confirmed no interaction that requires escalation-aware bookkeeping.

No divergence from proposal assumptions.
