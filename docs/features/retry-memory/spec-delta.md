# Spec Delta — retry-memory

**Change ID:** `retry-memory`
**Date:** `2026-07-24`
**Owner:** `@chacal88`
**Phase / Package:** `engine + flows (governance/) + skills — structured retry history for the implement loop`

## Status of `docs/specs/` in this repo

There is currently **no `docs/specs/` directory** in `aidakit` — no canonical capability spec exists for the flow-retry-loop area (confirmed by the same absence noted in [engine-max-visits/proposal.md #Affected capabilities](../engine-max-visits/proposal.md#affected-capabilities)). Prior changes that touched the flow engine (`engine-max-visits`, `flow-request-vs-change-id`, `flow-commit-plan-early`) also carried no spec delta, deferring the first canonical spec to whichever change felt the DOCS.md §4 promotion pressure most sharply.

Retry-memory is a candidate for that first spec, but does NOT ship it in this change. Reason: the retry-loop area has three cooperating pieces already ([engine-max-visits](../engine-max-visits/proposal.md) — the cap, [flow-request-vs-change-id](../../archive/2026-07-24-flow-request-vs-change-id/proposal.md) — the safe-value contract, this change — the memory of retries) and one is likely still coming (retry-memory wired into `fast.yaml`). A canonical spec written now would misrepresent the surface as three-piece when it is four-piece — the WORKING → DURABLE cycle of DOCS.md §4 asks us to wait for the picture to stabilize.

## Proposed canonical spec (deferred to archive-time promotion)

When `retry-memory` is archived and the `fast.yaml` wiring lands, promote the following to `docs/specs/flow-retry-loop.md` as the FIRST canonical spec of this area:

```markdown
# docs/specs/flow-retry-loop.md — Flow retry loop (canonical)

## Capability

The flow engine bounds and INFORMS every back-edge loop in a shipped flow:

- **Bounded** — no back-edge can iterate more than `max_visits` times per flow_id;
  the (N+1)-th entry short-circuits to `on_max_visits` (typically a human_gate).
  Realized by: `max_visits` + `on_max_visits` fields on any step
  (see [ADR-006](../decisions/ADR-006-flow-values-as-data.md) for the values-as-data
  interpolation the escalation prompt uses; mechanism delivered in
  [archive/YYYY-MM-DD-engine-max-visits/](../archive/YYYY-MM-DD-engine-max-visits/)).

- **Informed** — every re-entry of a retry target invokes the skill with a
  structured retry history: a JSON array of `{round, step_id, cause}` records,
  where `round` is read from the same `__visits` counter the cap uses (no
  parallel counter). The retrying skill reads it via `input.retry_history_path`
  and PREAMBLEs its round with the prior rounds' failure classes, steering away
  from them. Realized by: `outputs: {<failing-outcome>: [cause]}` on failing
  invoke steps (ADR-006 §2), per-branch `record_*_cause` runs steps that append
  to `docs/features/<change-id>/retry-history.json`, and `input.retry_history_path`
  on retry targets. Mechanism delivered in
  [archive/YYYY-MM-DD-retry-memory/](../archive/YYYY-MM-DD-retry-memory/).

- **Learned from** — the same records feed `aidakit:learn`: each becomes a
  `correction` event of shape `{errorType:"retry-cause", key:<cause>, phase:<step_id>}`,
  which the existing `deriveCandidates(change-id, {threshold: 3})` funnel picks
  up for DNA-promotion (see [aidakit:learn SKILL.md §6](../../skills/learn/SKILL.md)).
  A `cause` recurring ≥3× in a change qualifies as a DNA candidate with zero
  ledger changes.

## Contract

- `retry-history.json` shape:
  ```json
  [
    { "round": <positive int | null>, "step_id": <retry-target-step-id>, "cause": <snake_case_key> }
  ]
  ```
- `cause` values MUST match `RESUME_OUTPUT_VALUE_RE` (`^[A-Za-z0-9._:@/-]+$`) — the
  same safe-token contract as [ADR-006](../decisions/ADR-006-flow-values-as-data.md) §2.
- Registry of shipped `cause` keys: see the emitting steps' YAML and the growth
  rule ("adding a key is a doc-only PR"). No closed vocabulary in code.
- The file is committed with the change's `docs/features/<change-id>/` per
  [ADR-007](../decisions/ADR-007-roadmap-status-from-shared-git.md) /
  [ADR-009](../decisions/ADR-009-flow-commits-plan-early.md) — the memory must be
  visible from any worktree/clone.
- The write path is a single `runs` step per failure branch; the read path is
  `input.retry_history_path` (invoke) or `$AIDAKIT_RETRY_HISTORY_PATH` (a
  hypothetical runs consumer — same env-passing guarantees as `AIDAKIT_VAR_n`).
- Missing/empty/malformed file → "no history" (round 1 semantics). Never a crash.

## Rules

1. Every back-edge in a shipped flow SHOULD declare `max_visits` + `on_max_visits`
   (bounded) OR justify in the flow's YAML why the loop is naturally bounded
   (e.g. a body-iteration loop with its own `max`).
2. Every back-edge that re-enters an expensive skill (invoke) SHOULD emit a
   `cause` (via `outputs:` for invoke sources, sidecar cause-file for runs
   sources) and route through a `record_*_cause` runs step before reaching the
   retry target. Cheap back-edges (a runs → runs quick retry) may skip this.
3. Every retry target SHOULD carry `retry_history_path` in its `input:` so the
   skill can be informed. This is opt-in per step — a step that does not opt in
   silently ignores the history (backwards compatible).
```

## Merge instructions at archive time

When `retry-memory` is archived (`docs/archive/YYYY-MM-DD-retry-memory/`), the human promotion gate ([DOCS.md §4](../../../DOCS.md)) SHOULD:

1. If `docs/specs/flow-retry-loop.md` does not yet exist, create it from the block above (fill the two archive dates with the actual archive events).
2. If it already exists (a preceding change from the same epic already promoted it), append this change's specifics to the existing sections rather than duplicating them:
   - The **Informed** bullet under `## Capability`.
   - The `retry-history.json` shape + `cause` contract under `## Contract`.
   - Rules #2 and #3 under `## Rules` (Rule #1 was engine-max-visits' contribution).
3. Update [docs/decisions/README.md](../../decisions/README.md) `Thematic grouping → Flow engine` line to add "shared canonical spec at [flow-retry-loop.md](../specs/flow-retry-loop.md)".
4. Update [docs/INDEX.md](../../INDEX.md) with the new `docs/specs/` folder if it is the first spec (index policy per [DOCS.md §2](../../../DOCS.md) rule 1).

No changes to the plan artifacts (proposal/design/tasks/evidence) at promotion time — they are archived intact per [DOCS.md §4](../../../DOCS.md).

## Not a delta against an existing spec

Because there is no prior `docs/specs/flow-retry-loop.md` to diff against, this file is a **forward proposal** for the canonical spec, not a "change these lines" delta. If a preceding change from this epic (e.g. `fast.yaml` retry-memory wiring, or a follow-up refinement of `check-bench.js` cause granularity) lands first and creates the spec, this file will be revised at that time to become a proper diff — that revision is itself a small doc-only follow-up, not something to force into this change.
