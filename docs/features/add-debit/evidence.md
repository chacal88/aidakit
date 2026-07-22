# Evidence — add-debit

**Change ID:** `add-debit`
**Date:** `2026-07-22`
**Owner:** `@chacal88`
**Phase / Package:** `n/a (fast flow — small reversible engine-surface change)`
**PRD:** `n/a`
**Tech Spec:** `n/a`

> Pre-execution stub. The implement/review/ship steps record here: exact commands, outputs, files, PR URL, and any unresolved deviations. RED runs (section 2 of [tasks.md](tasks.md)) are recorded BEFORE the GREEN runs — the TDD order is part of the evidence.

## Validation Outputs

### 1. Baseline (before any change)

Command: `for f in governance/__tests__/*.test.mjs; do node "$f"; done`

11 files, all exit 0, 177 passed / 0 failed:
candidates 8, check-adr-format 8, check-bench 20, check-docs 8, check-links 7, dna-freshness 7, dna-write 14, engine 60, ledger 8, roadmap 20, yaml-min 17.

### 2. RED — new sections fail for the right reason

`node governance/__tests__/roadmap.test.mjs`:
```
TypeError: findDeclaredChange is not a function
    at .../roadmap.test.mjs:68:4
```
Fails immediately — the helper does not exist yet. Exit 1.

`node governance/__tests__/engine.test.mjs` — 68 passed, 6 failed (exit 1):
```
FAIL register: pause.step_id is 'parked'
FAIL register: pause.step_type is 'human_gate'
FAIL register: step_history has no select/plan entry before the park
FAIL register-discard: parks first
  register: resume 'discard' terminates aborted: expected "aborted", got "paused"
FAIL register: resume 'discard' terminates aborted
  register: start … mode=register with an undeclared id → terminal aborted: expected "aborted", got "paused"
FAIL register: start … mode=register with an undeclared id → terminal aborted
```
Fails for the right reason: `mode` isn't a declared flow input yet, so `startFlow` silently drops it and the flow always enters at `select` — exactly the gap section 3 closes.

### 3. GREEN — both files, after `roadmap.js` + the `--change` flag + `fast.yaml`

`node governance/__tests__/roadmap.test.mjs` → **25 passed, 0 failed**, exit 0.
`node governance/__tests__/engine.test.mjs` → **74 passed, 0 failed**, exit 0.

### 4. Full governance suite (before review round 1)

Command: `for f in governance/__tests__/*.test.mjs; do node "$f"; done`

11 files, all exit 0, **196 passed / 0 failed**:
candidates 8, check-adr-format 8, check-bench 20, check-docs 8, check-links 7, dna-freshness 7, dna-write 14, engine 74, ledger 8, roadmap 25, yaml-min 17.

### 5. Live smoke on this repo (task §6)

```
$ node governance/validators/derive-roadmap-status.js --change add-debit
{"validator":"aidakit.derive-roadmap-status","ok":true,"change":{"id":"add-debit","declared":true,"epic":"EPIC-flow-engine-leashes","feature":"Registro diferido no build (débito)"}}
exit=0

$ node governance/validators/derive-roadmap-status.js --change no-such-change
{"validator":"aidakit.derive-roadmap-status","ok":false,"change":{"id":"no-such-change","declared":false,"epic":null,"feature":null}}
exit=1

$ node governance/validators/derive-roadmap-status.js --change
derive-roadmap-status — error: --change requires a value
exit=2
```
(third invocation is the missing-value edge case from the plan, exercised beyond what task §6 required.)

### 6. Links

```
$ node governance/validators/check-links.js docs/features/add-debit docs/guides/flows.md
{"validator":"aidakit.check-links","ok":true,"files_checked":5,"errors":[]}
exit=0
```

### 7. Review round 1 — RED/GREEN for the quoting fix (see Corrections below)

RED (`engine.test.mjs`, before the fix): 74 passed, **2 failed** — the false-park case (2e-v).
GREEN (`engine.test.mjs`, after the fix): **76 passed, 0 failed**.

### 8. Full governance suite (final, after review round 1's fix)

Command: `for f in governance/__tests__/*.test.mjs; do node "$f"; done`

11 files, all exit 0, **198 passed / 0 failed**:
candidates 8, check-adr-format 8, check-bench 20, check-docs 8, check-links 7, dna-freshness 7, dna-write 14, engine **76**, ledger 8, roadmap 25, yaml-min 17.

### 9. Live smoke, re-run after the fix (incl. the word-split case, live)

```
$ node governance/validators/derive-roadmap-status.js --change add-debit
exit=0   (unchanged — declared: true)

$ node governance/validators/derive-roadmap-status.js --change no-such-change
exit=1   (unchanged — declared: false)

$ node governance/validators/derive-roadmap-status.js --change "add-debit plus extra words"
{"validator":"aidakit.derive-roadmap-status","ok":false,"change":{"id":"add-debit plus extra words","declared":false,"epic":null,"feature":null}}
exit=1   (the fixed bug, live: a declared id's first token no longer falsely passes when the request is polluted with extra words)
```

### 10. Links, re-run after the fix

```
$ node governance/validators/check-links.js docs/features/add-debit docs/guides/flows.md
{"validator":"aidakit.check-links","ok":true,"files_checked":5,"errors":[]}
exit=0
```

## Files Touched

`git diff --stat` (tracked) + `git status --short` (untracked), final — after review round 1's fix, matching [proposal.md](proposal.md)'s surface table exactly (same 10 tracked files as before the round; only line counts grew, no new file touched):

```
 commands/build.md                              |  12 +++
 docs/guides/flows.md                           |  34 ++++++++
 docs/roadmap/ROADMAP.md                        |   6 +-
 docs/roadmap/epics/EPIC-flow-engine-leashes.md |   4 +-
 governance/__tests__/engine.test.mjs           | 115 +++++++++++++++++++++++++
 governance/__tests__/roadmap.test.mjs          |  17 +++-
 governance/flows/fast.yaml                     |  44 ++++++++++
 governance/roadmap/roadmap.js                  |  21 +++++
 governance/validators/derive-roadmap-status.js |  32 ++++++-
 skills/roadmap/SKILL.md                        |  18 +++-
 10 files changed, 297 insertions(+), 6 deletions(-)
```

Plus untracked `docs/features/add-debit/` (this change directory: proposal.md, design.md, tasks.md, evidence.md).

`docs/roadmap/ROADMAP.md` and `docs/roadmap/epics/EPIC-flow-engine-leashes.md` are the riding diff (proposal.md Dependencies) — the manual dry-run's own registration of `add-debit`, plus (round 1) the mechanical regen reflecting that `docs/features/add-debit/` now exists on disk (`add-debit` derives `in-progress`, moved from Later to Now — ADR-002, never hand-written). Nothing outside the approved surface table was touched.

## Unresolved Deviations

One recorded, non-scope-widening: `governance/flows/fast.yaml`'s `mode` enum's `values:` field is written as a block list (`- build` / `- register`) rather than the flow-style `[build, register]` shown in [design.md](design.md)'s illustrative snippet. The project's mini YAML parser (`governance/engine/yaml-min.js`) does not support flow-style collections — it throws a clear parse error by design (documented in its own header and in `docs/guides/flows.md` §7), and the same file's `options:` lists already use the block form. The frozen contract (enum values `build`/`register`, default `build`) is unchanged; only the on-disk YAML spelling differs from the design doc's snippet. No other deviation.

## Corrections (review round 1 — resolved)

**Finding (quality, reproduced live by tester, gap score 8):** `check_registered`'s `command` interpolated `${inputs.request}` UNQUOTED into `bash -lc`. A multi-word request whose FIRST token was a declared id word-split at the shell: `--change` only consumed the first token, `derive-roadmap-status.js` exited 0 (declared) for that token alone, and the flow FALSELY PARKED with the full polluted sentence sitting in `inputs.request` on disk — contradicting proposal.md acceptance criteria #2 and #6.

- **RED**: new case in `engine.test.mjs` §2e (2e-v), driven through the real engine/shell seam (`spawnSync("bash", ["-lc", command])`, no mock): seeded a declared id, started the flow with `request: "<declared-id> plus extra free-form words"`, `mode: "register"`. Before the fix: `res.state.status === "paused"` at `pause.step_id === "parked"` (the false park) — expected `"aborted"`. 2 assertions failed, 74 passed.
- **GREEN**: quoted the interpolation — `--change \"${inputs.request}\"` (the same idiom `route_mode` already used on the line above it). Re-run: `engine.test.mjs` → 76 passed, 0 failed. Full suite (11 files) → 198 passed, 0 failed.
- **Root cause**: the `runs` step executor (`governance/engine/steps/runs.js`) interpolates `command` as a plain string and hands it to `bash -lc` verbatim — quoting an interpolated value that may contain spaces is the author's responsibility per step, not something the engine enforces structurally (the injection risk itself is a broader, already-flagged follow-up — see below, not touched in this round).
- **Correction event recorded** to `.aidakit/tasks/add-debit/error.ndjson` (gitignored, local telemetry — `aidakit:learn` raw material) via `governance/ledgers/ledger.js`'s `recordError`: `{ errorType: "correction", key: "check_registered-unquoted-interpolation", phase: "review-round-1", detail: "unquoted \${inputs.request} in bash -lc word-splits; declared first token falsely parks polluted sentence", mitigation: "quote the interpolation + engine-level RED test through the real shell seam" }`.
- **Not touched this round (recorded follow-ups per the coordinator, not widened into this diff):** tester's finding [6] (a codified exit-2/usage test for `--change`) and [4] (the inherited shell-injection debt of unsanitized `${...}` interpolation into `bash -lc` generally, beyond this one call site) — both out of scope for this correction.

## Ship

- **PR:** https://github.com/chacal88/aidakit/pull/7 — opened 2026-07-22, stopped at the URL (GOVERNANCE.md §1 — the merge is the human's).
- **Branch:** `claude/add-debit-8e7af2` (change-id as the single key, §2.7; suffix echoes the flow id). Commit `6d71af8`, 14 files, nominal staging.
- **Flow trail:** `fast-260722-8e7af2` — registered as a debit (the manual dry-run this change productizes) → parked at `select` → resumed → `plan` → `readiness` APPROVED → `implement` (TDD RED-first) → `review` bench round 1 **fail** (4 roles; quality + tester caught the unquoted-interpolation false park — see Corrections) → correction → round 2 **pass** (2/2) → `check_review_bench` mechanical OK → doc-leash 100% (`check-doc-manifest` exit 0) → `pr` → paused at the `merge` human_gate.
- **Bench ledger:** `.aidakit/tasks/add-debit/bench.ndjson` (gitignored) — manifest-first both rounds, verified by `check-bench.js` (parallel dispatch confirmed).
