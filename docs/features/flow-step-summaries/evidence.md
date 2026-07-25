# Evidence — flow-step-summaries

**Change ID:** `flow-step-summaries`
**Date:** `2026-07-24`
**Owner:** `@chacal88`
**Phase / Package:** `engine + CLI (governance/) — declarative per-step narrative on every pause`

## Setup / grounding re-check (Task 1)

Re-verified every item in [design.md](design.md) §Grounding against the LIVE code before writing any test:

- `state.step_history.push(history)` at [governance/engine/engine.js:206](../../../governance/engine/engine.js) — confirmed, unchanged line number and shape.
- `context[step.id]` writes: [invoke.js:79-87](../../../governance/engine/steps/invoke.js) (`bag.outcome = outcome; bag.invoke_target = ...`), [human-gate.js:30-33](../../../governance/engine/steps/human-gate.js) (`bag.choice = choice`), [human-handoff.js:14-17](../../../governance/engine/steps/human-handoff.js) (`bag.response = ...`) — all confirmed at the cited lines.
- Row template in [progress-table.js:19-42](../../../governance/engine/progress-table.js) — confirmed (`${gutter}${marker.padEnd(7)}  ${step.id}`).
- `switch(cmd)` in [cli.js:121-131](../../../governance/cli.js) — confirmed, flat switch, one-line `case` addition.
- `governance/engine/parser.js` `validateSteps` — confirmed the per-type validation block shape (`${at}: '<field>' must be …` message style).

**No correction needed at setup time.** One correction WAS needed mid-implementation during Task 4 GREEN (see "Unresolved Deviations" below) — the design's claim that `context[step.id].outcome` is "populated by every pause-emitting executor" is inaccurate: only `invoke.js` writes `.outcome` explicitly; `human-gate.js` writes only `.choice`, `human-handoff.js` writes only `.response`. Root-caused and fixed per [systematic-debugging](../../../skills/systematic-debugging/SKILL.md) discipline — see the correction event below.

## Acceptance-criterion → evidence map

| # | Criterion | Evidence |
|---|---|---|
| 1 | Engine-persisted, replayable | `governance/engine/engine.js` `emitSummary()`; §S3-i/ii/iii (state.summaries entry shape, ISO ts); live smoke (a) — `resume` then `status`/`summaries` re-read the persisted entry from a fresh CLI process. |
| 2 | Emitted on every pause-emitting step, uniformly across all flows | §S3-i (invoke), §S3-ii (human_gate), §S3-iii (human_handoff), §S3-v (no emission on `runs`), §S3-vi (no emission on `loop`); `engine.test.mjs` 149/0 unchanged (kit flows unaffected). |
| 3 | `failure` outcome still emits | §S3-vii (`invoke` failure → entry emitted, routes via `on_failure`); §S3-viii (`human_gate` abort choice → entry emitted, routes to `aborted` terminal); live smoke (f). |
| 4 | `abort` preserves prior summaries | §S3-xii (simulated `cmdAbort` — 2 prior entries intact after abort, order preserved); live smoke (g) — real `cli.js abort` then `summaries` still shows the prior entry. |
| 5 | Back-edge appends (visit_n increments; no overwrites) | §S3-ix (A#1→B#1→A#2→B#2, insertion order, monotonic visit_n, A#1 unchanged after A#2); live smoke (b) — real CLI back-edge drive, `summaries` shows 4 chronological lines, `status` shows only the LATEST (`#2`) under the row. |
| 6 | YAML template channel (ADR-006-aligned; unset key marker) | §S2-i..xi (renderer unit tests); §S3-xi (unset key in a live drive never throws, renders `<unset:does_not_exist>`); §S1 (parser accepts/rejects `summary:` by type). |
| 7 | 1-line 200-char envelope, graceful truncation on ingest | §S2-viii..xi + §S2-xii (owner's optional multi-byte test); §S3-x (500-char `human_handoff` response capped to exactly 200, ends with `…`); live smoke (e). |
| 8 | Progress-table integration preserves sibling row invariants | §S4-i..v (second line only under `done` + summary present; LATEST wins; absent-summaries byte-identical to the sibling; `current`/`pending` never carry a second line, even a re-entered `current` step with a stale summary); `progress-table.test.mjs` 30/0 unchanged. |
| 9 | `summaries <flow_id>` CLI subcommand | §S5-i..vi (full log, back-edge order, missing-arg exit 2, not-found exit 2, "no summaries recorded" graceful message, direct-vs-bash byte-identical output); live smoke (a)/(b). |
| 10 | Non-breaking on old state files (no `summaries` field) | §S3-xiii (renderProgressTable half); §S5-v (CLI half); §S4-iii/iv (progress-table half, byte-identical to absent-vs-empty); live smoke (d) — hand-fabricated pre-change state file, both `status` and `summaries` handle it gracefully. |
| 11 | No prose channel through `resume` (ADR-006 grammar unchanged) | No edit to `resume-output.js`/`RESUME_OUTPUT_VALUE_RE` in this diff (confirmed via `git status` — file not touched); `cli.js`'s `resume` command signature/parsing unchanged. |
| 12 | Identical output whether run directly or dispatched via Bash | §S5-vi — `runCli(["summaries", flowId])` vs. `execFileSync("bash", ["-lc", "node cli.js summaries ..."])` byte-identical (`eq(out1, out2, ...)`). |

## Validation Outputs

- [x] `node governance/__tests__/step-summaries.test.mjs` → **95 passed, 0 failed**. Blocks: §S1 (10 — parser schema), §S2 (23 — renderer + cap, incl. owner's §S2-xii multi-byte case), §S3 (44 — engine emission, incl. crit 3/4/5/6/7/10), §S4 (12 — progress-table second line, incl. crit 8/10), §S5 (11 — CLI subcommand, incl. crit 9/12).
- [x] `node governance/__tests__/engine.test.mjs` → **149 passed, 0 failed** (no regression).
- [x] `node governance/__tests__/progress-table.test.mjs` → **30 passed, 0 failed** (row-line output byte-identical; second-line addition dormant when `state.summaries` absent).
- [x] Full suite `for t in governance/__tests__/*.test.mjs; do node "$t" || echo "FAIL $t"; done` → all 15 files green:
  ```
  candidates.test.mjs       :: 8 passed, 0 failed
  check-adr-format.test.mjs :: 8 passed, 0 failed
  check-bench.test.mjs      :: 20 passed, 0 failed
  check-docs.test.mjs       :: 8 passed, 0 failed
  check-links.test.mjs      :: 7 passed, 0 failed
  dna-freshness.test.mjs    :: 7 passed, 0 failed
  dna-write.test.mjs        :: 14 passed, 0 failed
  engine.test.mjs           :: 149 passed, 0 failed
  ledger.test.mjs           :: 8 passed, 0 failed
  plugin-version.test.mjs   :: 12 passed, 0 failed
  pr-automation.test.mjs    :: 161 passed, 0 failed
  progress-table.test.mjs   :: 30 passed, 0 failed
  roadmap.test.mjs          :: 28 passed, 0 failed
  step-summaries.test.mjs   :: 95 passed, 0 failed   ← new file, this change
  yaml-min.test.mjs         :: 17 passed, 0 failed
  ```
- [x] Live CLI smoke (isolated `AIDAKIT_PROJECT_ROOT`, real `node governance/cli.js …` invocations):
  - **(a) Template + second line + CLI subcommand.** `.aidakit/flows/summ-smoke.yaml`, `select`-style invoke with `summary: "resolved change_id={change_id}"` + `outputs: {success:[change_id]}`. `start summ-smoke request=...` → paused. `resume <id> success change_id=xyz`. Actual transcript:
    ```
    Flow: summ-smoke · summ-smoke-260724-e5652e · completed/completed
       done     select
                 ↳ resolved change_id=xyz
       done     done

    [summ-smoke-260724-e5652e] COMPLETED (completed)
    ```
    Then `summaries <flow_id>` → `[select#1 success] resolved change_id=xyz`. Matches design exactly.
  - **(b) Back-edge append.** Hand-authored `A (invoke) → B (invoke) → back to A` on `revise`. Drove A#1(success)→B#1(revise)→A#2(success)→B#2(success). `summaries` printed all 4 lines chronologically:
    ```
    [A#1 success] visit success
    [B#1 revise] revise
    [A#2 success] visit success
    [B#2 success] success
    ```
    `status`'s second line under `done A` showed only the LATEST (`↳ visit success`, i.e. #2) — confirmed via `grep -A1 "done     A"`.
  - **(c) Fallback default (no `summary:` field).** `summ-fallback.yaml`, one `invoke` with no `summary:`. Resume `success` → table shows `↳ success` under the `done` row; `summaries` shows `[work#1 success] success`.
  - **(d) Non-breaking on old state.** Hand-fabricated a state JSON with no `summaries` key at all. `status` rendered fine (`flow: fixture ...`, no crash, no progress table since `loadFlow("fixture")` errors — expected, best-effort). `summaries old-flow-000000-aaaaaa` → `no summaries recorded for old-flow-000000-aaaaaa`, exit 0.
  - **(e) 200-char cap.** `summ-cap.yaml`, `human_handoff` with `summary: "{response}"`, resumed with a 500-char response. Result: `text.length= 200 ends with ellipsis: true`.
  - **(f) `failure` outcome emits.** `summ-fail.yaml`, `invoke` with `expects:[success,failure]`, `summary:"{outcome}"`, resumed with `failure`. Table showed `↳ failure` under `done work`, routed to `recover` (the `on_failure` target) and completed. `summaries` → `[work#1 failure] failure`.
  - **(g) `abort` preserves.** `summ-abort.yaml`, drove `s1` to success (1 summary emitted), then `abort <flow_id>` before `s2` resolved. `summaries` still showed `[s1#1 success] success` after the abort.
- [x] `node governance/validators/check-links.js docs/features/flow-step-summaries` → exit 0.
  ```json
  {"validator":"aidakit.check-links","ok":true,"files_checked":4,"errors":[]}
  ```
- [x] `node governance/validators/derive-roadmap-status.js --root .` → exit 0; `flow-step-summaries` derives **`in-progress`**:
  ```json
  {"name":"Sumários de passo do flow","changes":[{"id":"flow-step-summaries","status":"in-progress"}],"status":"in-progress"}
  ```
- [x] `node governance/validators/check-plugin-version.js .` → exit 0 with the bumped manifest. Old → new: `0.8.0` → `0.9.0` (main's manifest re-read at implementation start: `0.8.0`, matching the worktree's pre-change value; bumped one minor above).
  ```json
  {"validator":"aidakit.check-plugin-version","ok":true,"manifest":"0.9.0","highest":"0.8","behind":[],"scanned":262}
  ```

## Manual-verification snippets

- `jq '.summaries[]' .aidakit/flows/state/<flow_id>.json` — confirmed via the live smokes above (every printed entry carries `step_id`, `visit_n`, `outcome`, `text`, `ts`; `text.length` observed ≤ 200 in the cap smoke; `visit_n` monotonic per `step_id` in the back-edge smoke).
- `grep -n 'isatty\|columns\|TTY\|process\.stdout\.write.*↳' governance/engine/progress-table.js governance/cli.js governance/engine/summary-template.js` → only the one `↳` write site in `progress-table.js` (the second-line append); no TTY-conditional branch in any of the three files.
- Byte-identical piped-vs-TTY / direct-vs-bash: proven programmatically in §S5-vi (`node cli.js summaries <id>` via `execFileSync` directly vs. via `bash -lc "node cli.js summaries <id>"` — `eq(out1, out2, ...)` passes).
- `grep -n 'summary' governance/flows/*.yaml` → no match; confirmed no kit-shipped flow (`fast`, `full`, `docs-onboarding`) declares a `summary:` field (adding them is an explicit follow-up per [proposal.md](proposal.md) §Impact per surface / §Unblocks).

## Files Touched

`git status --porcelain` (post-implementation, pre-cleanup-review):

- [x] `governance/engine/summary-template.js` (new) — `renderSummary`/`capSummary`, the pure template renderer + cap.
- [x] `governance/engine/engine.js` — `emitSummary()` helper + insertion in `drive()` between `step_history.push` and the outcome-kind switch.
- [x] `governance/engine/types.js` — `BaseStep.summary?`, `FlowState.summaries?`, new `StepSummary` typedef.
- [x] `governance/engine/parser.js` — one-line `validateSteps` check: `summary` must be a string when present.
- [x] `governance/engine/progress-table.js` — `groupLatestByStep()` helper + the second-line append under `done` rows.
- [x] `governance/cli.js` — `cmdSummaries()` + `case "summaries"` in the switch + usage-comment/default-case updates.
- [x] `governance/__tests__/step-summaries.test.mjs` (new) — §S1-§S5, 95 assertions.
- [x] `governance/README.md` — new "Per-step summaries (the narrative layer)" section + CLI bullet update + doctrine footer bump (v0.8).
- [x] `.claude-plugin/plugin.json` — version bump `0.8.0` → `0.9.0`.
- [x] `docs/roadmap/epics/EPIC-flow-cli-ux.md` — enriched the `flow-step-summaries` feature's acceptance sub-bullet to the confirmed criteria (hand-authored per this skill's own `add-feature` escape-hatch grammar — see "Unresolved Deviations" for why `aidakit:roadmap` wasn't dispatched as a separate agent).
- [x] `docs/roadmap/ROADMAP.md` — minimally regenerated: moved the `flow-step-summaries` line from Later→Now under "Experiência de linha de comando dos flows", reflecting the now-`in-progress` derived status. Unrelated pre-existing drift in other epics (e.g. `configurable-pr-automation`/`engine-max-visits` now showing `done` upstream) was deliberately left untouched — out of this change's scope (see "Unresolved Deviations").
- [x] `docs/features/flow-step-summaries/{proposal,design,tasks,evidence}.md` — `tasks.md` checkboxes marked through Task 9; this file filled.
- [x] `docs/guides/flows.md` — **deviation, not in the original declared surface list**: added a `summaries <flow_id>` row to the §5 CLI commands table and updated "five commands" → "six commands" (see "Unresolved Deviations").

## Unresolved Deviations

1. **Correction event (systematic-debugging, Task 4 GREEN).** Root cause: the design's fallback-default rationale ("`{outcome}` resolves from `context[step.id].outcome`, populated by every pause-emitting executor") is inaccurate against the design's own grounding evidence — only `invoke.js` writes `.outcome` into the context bag; `human-gate.js` writes only `.choice`, `human-handoff.js` writes only `.response`. Caught by §S3-iii (`human_handoff` fallback template rendered `<unset:outcome>` instead of `"handoff success"`). Fix: `emitSummary()` synthesizes the interpolation bag as `{ ...(state.context[step.id] ?? {}), outcome: resolvedOutcome }` — `resolvedOutcome` being the SAME `outcomeKey(outcome)` value already persisted as the entry's own `outcome` field — so `{outcome}` is guaranteed to resolve uniformly across all three pause-emitting step types, independent of what each individual executor happens to write. No behavior change for `invoke` (its own `.outcome` write was already identical to `outcomeKey(outcome)`). `{ kind: "correction", task: "Task 4 — engine emission block (GREEN)", root_cause: "human-gate.js/human-handoff.js executors don't write context[step.id].outcome — only invoke.js does; the design's fallback-default claim was inaccurate for 2 of 3 pause-emitting step types", fix: "emitSummary() synthesizes {outcome} in the interpolation bag from the already-computed outcomeKey(outcome), overriding/supplementing whatever the executor itself wrote" }`.
2. **Two YAML/engine syntax bugs found and fixed in test fixtures during §S3 RED, not the product code.** (a) `default: []` in a flow's `inputs:` block triggers the mini-YAML-parser's flow-style-collection rejection — fixed by declaring the input without a YAML-level default and passing the empty array via `startFlow({inputs: {...}})` directly. (b) `over: "${inputs.items}"` (with `${}`) does not resolve — `loop.over`/`until` use the BARE-expression grammar (`over: inputs.items`), confirmed against `engine.test.mjs`'s own fixtures and `governance/README.md`'s "Expression convention" warning. Neither is a product bug; both are test-fixture-authoring mistakes, corrected before the loop-step test (§S3-vi) went green.
3. **`docs/guides/flows.md` edit — outside the tasks.md-declared file surface.** The plan's declared surface (tasks.md §10) does not list this file. However, §5 of that guide explicitly enumerates "five commands" in prose + a table; adding a sixth CLI command (`summaries`) without updating it would leave the guide factually wrong (an incomplete command inventory, not just a stale behavioral aside — unlike the sibling `flow-run-progress-table` change, which changed `status`'s *output* without changing the *command count*, and correctly left this file untouched). Judged in-scope under Task 7's own instruction ("note the `summary:` template in DOCS.md OR the flows guide — only if flow-authoring guidance is affected"); the addition is one new table row plus a word change, no duplication of `governance/README.md`'s fuller writeup (DOCS.md §2 rule 1 respected via a one-line pointer back to the README section).
4. **`aidakit:roadmap` was not dispatched as a separate agent invocation.** The implementer role has no Task/Agent-dispatch tool available in this session. Per the skill's own documented `add-feature` escape-hatch grammar (hand-author a `- **Feature:** <name> — changes: <ids>` line with an acceptance sub-bullet, matching `FEATURE_RE`), the epic enrichment and the minimal `ROADMAP.md` regen were performed directly, following the skill's exact conventions (verified the resulting entry against `derive-roadmap-status.js`'s live JSON output: `flow-step-summaries` → `in-progress`, matching). `ROADMAP.md` itself was touched only surgically (move one line reflecting the just-confirmed status flip) — no unrelated epic/feature line was rewritten, and no status field was hand-written anywhere (status stays 100% disk-derived, per [ADR-002](../../decisions/ADR-002-roadmap-status-derived-from-disk.md)).
5. **Owner's optional improvement §S2-xii (multi-byte cap) implemented as requested** — one extra unit test in `summary-template.test.mjs`'s host file (`step-summaries.test.mjs`), confirming `capSummary` operates on UTF-16 code units (not grapheme clusters) and does not mangle BMP multi-byte characters at the truncation boundary. Locks down readiness-review risk #3.
6. **Owner's optional improvement re: §S3-x simplification implemented as requested** — the cap-on-ingest test asserts `text.length === 200` and `text.endsWith("…")` for a template that renders >200 chars (via a real `human_handoff` free-text response, not a fabricated context bag), without debating the substrate truncation mechanism inline in the test comments.
