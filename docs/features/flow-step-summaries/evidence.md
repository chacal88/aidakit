# Evidence — flow-step-summaries

**Change ID:** `flow-step-summaries`
**Date:** `2026-07-24`
**Owner:** `@chacal88`
**Phase / Package:** `engine + CLI (governance/) — declarative per-step narrative on every pause`

> Stub — pre-execution. Fill each section during `implement` with the actual commands, outputs and files. Format mirrors [../../archive/2026-07-24-flow-run-progress-table/evidence.md](../../archive/2026-07-24-flow-run-progress-table/evidence.md) so reviewers can diff the two side by side.

## Setup / grounding re-check (Task 1)

_To fill: re-verify each grounding item of [design.md](design.md) §Grounding against the LIVE code before writing any test; record any divergence + correction, or "no correction needed"._

## Acceptance-criterion → evidence map

_To fill during `implement`; one row per criterion from [proposal.md](proposal.md) §Acceptance criteria, each pointing at the specific test name(s) in `step-summaries.test.mjs` and/or the live-smoke transcript below that proves it. Mirror the sibling change's table shape (id + criterion + evidence)._

| # | Criterion | Evidence |
|---|---|---|
| 1 | Engine-persisted, replayable |  |
| 2 | Emitted on every pause-emitting step, uniformly across all flows |  |
| 3 | `failure` outcome still emits |  |
| 4 | `abort` preserves prior summaries |  |
| 5 | Back-edge appends (visit_n increments; no overwrites) |  |
| 6 | YAML template channel (ADR-006-aligned; unset key marker) |  |
| 7 | 1-line 200-char envelope, graceful truncation on ingest |  |
| 8 | Progress-table integration preserves sibling row invariants |  |
| 9 | `summaries <flow_id>` CLI subcommand |  |
| 10 | Non-breaking on old state files (no `summaries` field) |  |
| 11 | No prose channel through `resume` (ADR-006 grammar unchanged) |  |
| 12 | Identical output whether run directly or dispatched via Bash |  |

## Validation Outputs

_To fill during `implement`. Each item below corresponds to a Task 8 bullet in [tasks.md](tasks.md)._

- [ ] `node governance/__tests__/step-summaries.test.mjs` → **… passed, 0 failed**. Enumerate covered blocks (§S1 parser, §S2 renderer, §S3 emission, §S4 progress-table, §S5 CLI) and assertion counts per block.
- [ ] `node governance/__tests__/engine.test.mjs` → **149 passed, 0 failed** (no regression; engine API/state shape backward-compatible; kit flows declare no `summary:`).
- [ ] `node governance/__tests__/progress-table.test.mjs` → **30 passed, 0 failed** (row-line output byte-identical; second-line addition dormant when `state.summaries` absent).
- [ ] Full suite `for t in governance/__tests__/*.test.mjs; do node "$t" || echo "FAIL $t"; done` → all N files green. Per-file counts (mirror the sibling change's evidence.md shape):
  ```
  candidates.test.mjs       :: … passed, 0 failed
  check-adr-format.test.mjs :: … passed, 0 failed
  check-bench.test.mjs      :: … passed, 0 failed
  check-docs.test.mjs       :: … passed, 0 failed
  check-links.test.mjs      :: … passed, 0 failed
  dna-freshness.test.mjs    :: … passed, 0 failed
  dna-write.test.mjs        :: … passed, 0 failed
  engine.test.mjs           :: 149 passed, 0 failed
  ledger.test.mjs           :: … passed, 0 failed
  plugin-version.test.mjs   :: … passed, 0 failed
  pr-automation.test.mjs    :: … passed, 0 failed
  progress-table.test.mjs   :: 30 passed, 0 failed
  roadmap.test.mjs          :: … passed, 0 failed
  step-summaries.test.mjs   :: … passed, 0 failed         ← new file, this change
  yaml-min.test.mjs         :: … passed, 0 failed
  ```
- [ ] Live CLI smoke (isolated `AIDAKIT_PROJECT_ROOT`, real `node governance/cli.js …` invocations):
  - **(a) Template + second line + CLI subcommand.** Create `.aidakit/flows/summ-smoke.yaml` with an invoke step declaring `summary: "resolved change_id={change_id}"` + `outputs: {success:[change_id]}`. `start summ-smoke request="…"` → paused. `resume … success change_id=xyz`. Expected transcript snippet (paste actual output here):
    ```
    …
       done     select
                 ↳ resolved change_id=xyz
     > current  …
    …
    ```
    Then `summaries <flow_id>` → `[select#1 success] resolved change_id=xyz`.
  - **(b) Back-edge append.** Hand-author a 3-step flow where step A routes to B and B can route back to A (revise-style). Drive: A#1 → B (revise) → A#2 → B (success). Expected: `summaries` grows to 4 entries; `A#2` is the LATEST entry rendered under A's row; `A#1` still on disk (asserted via `summaries <flow_id>` output showing both).
  - **(c) Fallback default (no `summary:` field).** Drive a flow whose steps declare no `summary:`. Expected: every pause-emitting `done` row gets a second line `↳ success` (or the actual outcome); `runs`/`terminal` rows get no second line; `state.summaries` populated with `text:"success"`/`text:"failure"` etc.
  - **(d) Non-breaking on old state.** Fabricate a state.json where `state.summaries` is absent, run `status <flow_id>` and `summaries <flow_id>` — expected: `status` renders the sibling's pure row-only table (no `↳` characters); `summaries` prints `no summaries recorded for <flow_id>` and exits 0.
  - **(e) 200-char cap.** Drive a `human_handoff` with `summary: "{response}"` and a >500-char response value. Expected: `state.summaries[i].text.length === 200`, ends with `…`; no re-pause, no error.
  - **(f) `failure` outcome emits.** Invoke with `expects:[success, failure]`, `summary:"{outcome}"`, resume with `failure`. Expected: entry with `outcome:"failure"`, `text:"failure"`; flow proceeds to `on_failure` target.
  - **(g) `abort` preserves.** Drive to at least 2 summaries, `cli.js abort <flow_id>`. Expected: `summaries <flow_id>` still prints both entries; state file has terminal fields set but `summaries` array intact.
- [ ] `node governance/validators/check-links.js docs/features/flow-step-summaries` → exit 0. Paste the JSON output.
- [ ] `node governance/validators/derive-roadmap-status.js --root .` → exit 0; `flow-step-summaries` derives **`in-progress`**. Paste the JSON entry.
- [ ] `node governance/validators/check-plugin-version.js .` → exit 0 with the bumped manifest. Record old → new version.

## Manual-verification snippets

_To fill: any hand-run commands beyond the automated suite (state-file inspection with `jq`, byte-identical piped-vs-TTY check for the second-line output, verification that no `${` interpolation is used in `summary_template.js` — the template grammar is strictly single-brace `{key}`)._

- [ ] `jq '.summaries[]' .aidakit/flows/state/<flow_id>.json` — confirm every entry has all 5 fields (`step_id`, `visit_n`, `outcome`, `text`, `ts`), `text.length <= 200`, `visit_n` monotonic per `step_id`.
- [ ] `grep -n 'isatty\|columns\|TTY\|process\.stdout\.write.*↳' governance/engine/progress-table.js governance/cli.js governance/engine/summary-template.js` — confirm no TTY-conditional branch; the only `↳` write is in `progress-table.js`.
- [ ] Byte-identical piped-vs-TTY: `node governance/cli.js status <id> > pipe.txt` and `node governance/cli.js status <id> | cat > tty.txt` — `diff pipe.txt tty.txt` empty.
- [ ] `grep -n 'summary' governance/flows/*.yaml` — confirm NO kit-shipped flow declares a `summary:` field (adding them is a follow-up change per [proposal.md](proposal.md) §Impact per surface).

## Files Touched

_To fill during `implement` with the actual `git diff --name-only` list (should match [tasks.md](tasks.md) §10 Cleanup exactly)._

- [ ] `governance/engine/summary-template.js` (new)
- [ ] `governance/engine/engine.js`
- [ ] `governance/engine/types.js`
- [ ] `governance/engine/parser.js`
- [ ] `governance/engine/progress-table.js`
- [ ] `governance/cli.js`
- [ ] `governance/__tests__/step-summaries.test.mjs` (new)
- [ ] `governance/README.md`
- [ ] `.claude-plugin/plugin.json`
- [ ] `docs/roadmap/epics/EPIC-flow-cli-ux.md` (via `aidakit:roadmap`)
- [ ] `docs/roadmap/ROADMAP.md` (regenerated view — never hand-edited)
- [ ] `docs/features/flow-step-summaries/{proposal,design,tasks,evidence}.md`

## Unresolved Deviations

_To fill: any post-review polish, off-by-ones caught during TDD, follow-up test-coverage debts, or environmental observations (concurrent-worktree noise). Mirror the sibling change's evidence.md §Unresolved Deviations shape._
