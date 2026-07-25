---
description: Single-shot utility — runs the pre-ship review gate — adversarial bench of agents in parallel, aggregates verdicts, decides consensus
---

First, inspect `$ARGUMENTS`. If it is empty, do NOT guess or proceed — print
the Usage block verbatim and stop.

## Usage
**This is a single-shot utility command.** It invokes the `aidakit:review` skill.

**Expected inputs:** a change-id, or `--diff`

**Examples (copy-paste):**
- `/aidakit:review --diff`
- `/aidakit:review webhook-retry-safety`

**Before the fan-out — the bench manifest is not optional.** Before dispatching any reviewer agent, the caller writes a `__manifest__` record — the full list of roles the round commits to — to `.aidakit/tasks/<change-id>/bench.ndjson` via `recordBenchManifest` ([ledger.js](../governance/ledgers/ledger.js)). Skip it and the leash `check_review_bench` ([check-bench.js](../governance/validators/check-bench.js)) fails with `manifest-missing` and back-edges the flow to the review step (`review_bench` in `full.yaml`, `review` in `fast.yaml`): **the entire bench re-runs**, every role, one full extra round of subagent cost. Copy-paste shape (manifest → parallel `Agent` calls → `recordBench` per role): step 5 of [the review skill](../skills/review/SKILL.md).

Invoke this plugin's `aidakit:review` skill and follow its protocol: mechanical structural validation first, then the adversarial bench (the reviewer agents in parallel, convened by a role×flag matrix), aggregation of the verdicts with severities, and a consensus decision (rounds with a ceiling). Report, don't fix — the skill reports, it doesn't fix; the merge is always the human's.

Review target (change-id or `--diff`): $ARGUMENTS

<!-- aidakit v0.3 — command for the review skill, 2026-07-17 -->
<!-- aidakit v0.5 — classification-led description + Usage block (command-grouping-and-inputs), 2026-07-24 -->
<!-- aidakit v0.9 — review-usage-bench-manifest: bench manifest requirement + consequence surfaced in Usage, 2026-07-25 -->
