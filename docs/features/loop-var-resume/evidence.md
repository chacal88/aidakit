# Evidence — loop-var-resume

**Change ID:** `loop-var-resume`
**Date:** `2026-07-22`
**Owner:** `@chacal88`
**Phase / Package:** `n/a (fast flow — small reversible bugfix)`
**PRD:** `n/a`
**Tech Spec:** `n/a`

> Pre-execution stub. The implement/ship steps record here: exact commands, outputs, files, PR URL, and any unresolved deviations.

## Validation Outputs

Command: `node governance/__tests__/engine.test.mjs`
```
60 passed, 0 failed
```

Command: `for f in governance/__tests__/*.test.mjs; do echo "== $f"; node "$f" 2>&1 | tail -1; done`
```
== governance/__tests__/candidates.test.mjs
8 passed, 0 failed
== governance/__tests__/check-adr-format.test.mjs
8 passed, 0 failed
== governance/__tests__/check-bench.test.mjs
20 passed, 0 failed
== governance/__tests__/check-docs.test.mjs
8 passed, 0 failed
== governance/__tests__/check-links.test.mjs
7 passed, 0 failed
== governance/__tests__/dna-freshness.test.mjs
7 passed, 0 failed
== governance/__tests__/dna-write.test.mjs
14 passed, 0 failed
== governance/__tests__/engine.test.mjs
60 passed, 0 failed
== governance/__tests__/ledger.test.mjs
8 passed, 0 failed
== governance/__tests__/roadmap.test.mjs
20 passed, 0 failed
== governance/__tests__/yaml-min.test.mjs
17 passed, 0 failed
```
All 11 files exit 0. Total: 177 passed, 0 failed across the governance suite.

RED-first provenance (verified by reasoning over the delivered code, fix not reverted): `driveLoopFlow` resumes by reloading `state` from disk (`loadState(res.state.flow_id)`) before calling `resumeFlow`, so `rebuildLoopVars` is the only source of loop vars on resume — no in-memory carry-over. In `drive()`, the `__iterate__` branch builds `iterPath = [...frame.path, step.id, "iter[${loopFrame.index}]"]` and pushes `firstBody.id` as the next `stepId` *without* appending the body step's own id to the path (see `governance/engine/engine.js:185,195`) — so a paused body step's `state.pause.path` always ends in `iter[N]`. Under the pre-fix loop `for (let i = 0; i < path.length - 1; i++)`, that last segment is the one excluded, so:
- 7a (single loop): the `work`/`report` pause after resume would read `loopVars = {}` (the sole `iter[N]` sits at the excluded last index), and `${feature}` would leak literally into `input.feature` and into the `build` step's `runs` command — reproducing the exact production symptom (psim-kernel `new-device-driver-260722-8598f2`).
- 7b (nested loops): the outer `iter[N]` sits at an intermediate index (still within `< path.length - 1`) and would still resolve; only the innermost `${feature}` — at the excluded last index — would leak, matching the "nested loops only lose the innermost var" note in `proposal.md` and the section 7 header comment in the test file.

## Files Touched

```
 governance/__tests__/engine.test.mjs | 151 +++++++++++++++++++++++++++++++++++
 governance/engine/engine.js          |   9 ++-
 2 files changed, 158 insertions(+), 2 deletions(-)
```

`git status --short`:
```
 M governance/__tests__/engine.test.mjs
 M governance/engine/engine.js
?? docs/features/
```
Scope matches `proposal.md` exactly: 2 modified code files, no other tracked changes. `docs/features/` (this change directory: proposal.md, design.md, tasks.md, evidence.md) is the only untracked path.

## Unresolved Deviations

None. Scope, tests, and validation match the proposal and tasks.md exactly.

## Ship

<!-- PR URL -->
