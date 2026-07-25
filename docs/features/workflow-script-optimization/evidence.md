# Evidence — workflow-script-optimization

**Change ID:** `workflow-script-optimization`
**Date:** `2026-07-25`
**Owner:** `@chacal88`
**Phase / Package:** `n/a (audit-only, docs surface: docs/features/ + docs/roadmap/)`
**PRD:** `n/a`
**Tech Spec:** `n/a`

> Pre-execution stub. Everything below the plan-time sections is filled during implementation with the **command and its output**, verbatim, per criterion `no-fabricated-token-numbers` — no number ships here that a re-run of its own command does not reproduce.
>
> Two structural rules for whoever fills this file:
> 1. `## Context-pack telemetry rollup` is owned by `governance/telemetry/rollup.js`, which rewrites everything from that heading to the next `## ` heading (or EOF). It is deliberately the **last** section; never put content inside its span.
> 2. A fenced block whose last line matches `N files changed` is a claim gated by `governance/validators/check-evidence-stat.js` against the live diff. Capture it last and iterate to a fixpoint.

## Plan-time baselines (measured 2026-07-25, before any audit file existed)

Recorded so that implementation-time results are read against a real baseline rather than an assumption. Re-measure; do not copy.

- `node governance/validators/check-links.js .` → **exit 0**, `{"validator":"aidakit.check-links","ok":true,"files_checked":241,"errors":[]}`.
- `node governance/validators/check-plugin-version.js .` → **exit 0**, `{"validator":"aidakit.check-plugin-version","ok":true,"manifest":"0.9.1","highest":"0.9","behind":[],"scanned":309}` — so a docs-only change with no doctrine footer needs no version bump.
- `node governance/validators/derive-roadmap-status.js --root . --json` → **exit 0**, `ok=true`, **6 orphans**, all legitimate pre-existing backlog items (`post-merge-sweep`, `engine-parallel-fate`, `review-bench-manifest-mechanical-writer`, `context-pack-heading-alignment`, `context-pack-heading-drift`, `check-links-code-span-skip`). This is why the validation task runs the deriver **without** `--strict`.
- Flow shape: `grep -cE '^\s+- id:' governance/flows/<f>.yaml` → `full: 36`, `fast: 23`, `design: 10`, `docs-onboarding: 9`. Type histogram (`awk '/^  - id:/{f=1} f&&/^    type:/{print $2; f=0}' … | sort | uniq -c`) → `full` 15 `invoke` / 15 `runs` / 4 `human_gate` / 2 `terminal`; `fast` 9/9/3/2; `design` 5/0/4/1; `docs-onboarding` 4/2/1/2.
- Agent prompt bodies: `wc -c -w agents/*.md` → **13 files, 20800 words, 139797 bytes** in total.
- Prior telemetry in this repo: `grep -rl '^No telemetry captured for this run' docs/` → **2** files (`docs/archive/2026-07-24-context-pack-l1/evidence.md:56`, `docs/features/review-usage-bench-manifest/evidence.md:179`), which are the only two `evidence.md` files carrying the section at all. This change's run is the first with rows on disk.

## Validation Outputs

_(filled during implementation — one entry per Exit criterion of [proposal.md](proposal.md), command + output + exit code)_

### Baselines re-measured at implementation start

_(pending)_

### Post-authoring validation

_(pending: `check-links`, `check-plugin-version`, `derive-roadmap-status` non-strict, `rollup.js`, `check-evidence-stat`, the audit-only stat guard, the 22-file governance suite)_

### Reproduction of every quoted number

_(pending: each command quoted inside `inventory.md` / `dispatch-cost.md`, re-run against the shipped tree, with its output)_

## Raw dispatch telemetry (verbatim JSONL)

Source: `cat .aidakit/tasks/workflow-script-optimization/.telemetry.jsonl` — gitignored and worktree-local, which is why it is pasted here. **A prefix of the run, not a total:** dispatches continue after this capture (document, acceptance, pr…), so no per-flow total is derivable from these rows.

Capture at plan time (2026-07-25, after the `brainstorm` step resolved, while `specify` was paused — 3 dispatches):

```
{"ts":"2026-07-25T12:53:26.287Z","subagent":"aidakit:orchestrator","cache_creation":62356,"cache_read":125910,"output_tokens":3747,"pack_size":0,"duration_ms":53425,"pack_rebuilt":false}
{"ts":"2026-07-25T12:53:46.862Z","subagent":"aidakit:identify-domain","cache_creation":0,"cache_read":0,"output_tokens":0,"pack_size":0,"duration_ms":0,"pack_rebuilt":false}
{"ts":"2026-07-25T12:54:01.225Z","subagent":"aidakit:brainstorm","cache_creation":397550,"cache_read":1377529,"output_tokens":44539,"pack_size":0,"duration_ms":331959,"pack_rebuilt":false}
```

Reading, kept inside what the rows support:

- `aidakit:brainstorm` — `cache_read` 1377529 against `output_tokens` 44539 → **30.9×** (1377529 / 44539 = 30.93). Re-read context, not generation, is what the dispatch paid for.
- `aidakit:identify-domain` (the `classify` step) — every counter zero: the classification was reused from the change package, so the step consumed no new LLM tokens on this run. Recorded as finding F3, not as a missing measurement.
- `pack_size` is 0 on all three rows: `docs/features/workflow-script-optimization/.context-pack.md` does not exist yet at this point in the flow (the `context_pack` phase sits between `readiness` and `implement`). Not a defect; a consequence of where in the graph these dispatches happened.

_(re-captured at implementation end, appended below with its own capture time — the plan-time block above is kept, not overwritten, so the two capture points stay comparable)_

## Files Touched

_(filled at implementation end from `git diff HEAD --stat`, one line per file with what changed and why. Expected set: this change package's four plan artifacts plus `inventory.md`, `dispatch-cost.md`, `.context-pack.md`, `retry-history.json` if written, and the three `docs/roadmap/epics/EPIC-*.md` files plus `docs/roadmap/ROADMAP.md`. Zero files under `governance/`, `agents/`, `skills/`, `commands/`, `hooks/` — pasted here as the mechanical proof of `audit-only-no-flow-edits`.)_

## Unresolved Deviations

_(filled during implementation. Record here — never by editing the plan into agreement — any assumption of [design.md](design.md) §12 that reality contradicted, any finding that a sibling worktree closed before this landed, any candidate the five-slot rule rejected that a reviewer may disagree about, and any telemetry hole where a resume did not carry the kwargs.)_

## Context-pack telemetry rollup

_(owned by `governance/telemetry/rollup.js --change-id workflow-script-optimization`; rewritten idempotently. This placeholder fixes the section's position. A rendered "No telemetry captured for this run" here is a FAIL of criterion `telemetry-first-measurement`, not a pass.)_
