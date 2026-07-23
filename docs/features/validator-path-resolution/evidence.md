# Evidence — validator-path-resolution

**Change ID:** `validator-path-resolution`
**Date:** `2026-07-23`
**Owner:** `@chacal88`
**Phase / Package:** `n/a (fast flow — small reversible bugfix)`
**PRD:** `n/a`
**Tech Spec:** `n/a`

> Pre-execution stub. The implement/ship steps record here: the RED proof, the exact GREEN commands and outputs, the consumer-repo simulation, files touched, and any unresolved deviations.

## Validation Outputs

### RED — bug reproduced after symlink removal (record before applying the fix)

Command: `node governance/__tests__/engine.test.mjs` (after removing the `symlinkSync` fabrication from the test's setup region, before touching `runs.js`/the flow YAMLs)

```
  fast: pause order (happy path, with the leash): expected ["select","plan","readiness","implement","review","document","pr","merge"], got ["select","plan","readiness","implement","review","review","review", … x50 …]
FAIL fast: pause order (happy path, with the leash)
  fast: final status completed: expected "completed", got "paused"
FAIL fast: final status completed
  fast: outcome completed: expected "completed", got undefined
FAIL fast: outcome completed
  fast: review fail re-enters implement: expected "implement", got "review"
FAIL fast: review fail re-enters implement
  fast: recovers and completes on the corrected round: expected [...], got ["select","plan","readiness","implement","review","review", … x50 …]
FAIL fast: recovers and completes on the corrected round
  fast: recovers and completes after correction: expected "completed", got "paused"
FAIL fast: recovers and completes after correction
  fast: merge=discard aborts: expected "aborted", got "paused"
FAIL fast: merge=discard aborts
  leash: check_docs returns to document until the list closes (3 rounds): expected 3, got 0
FAIL leash: check_docs returns to document until the list closes (3 rounds)
FAIL leash: only reaches pr AFTER the gate releases
  leash: gate released → flow completes through the merge: expected "completed", got "paused"
FAIL leash: gate released → flow completes through the merge
  full: pause order with the leash (document between learn and pr): expected [...], got ["select","classify","brainstorm","specify","critic","pre_apply","readiness","implement","review_bench","review_bench", … x38 …]
FAIL full: pause order with the leash (document between learn and pr)
  full: final status completed: expected "completed", got "paused"
FAIL full: final status completed
  full: outcome completed: expected "completed", got undefined
FAIL full: outcome completed
FAIL parallelism leash: check_review_bench recorded the consensus-mismatch
FAIL parallelism leash: check_implement_bench recorded the missing role
  register: parks (paused): expected "paused", got "aborted"
FAIL register: parks (paused)
FAIL register: pause.step_id is 'parked'
FAIL register: pause.step_type is 'human_gate'
file:///…/governance/engine/engine.js:73
  if (state.status !== "paused") throw new Error(`cannot resume flow ${state.flow_id}: status is ${state.status}`);
                                       ^
Error: cannot resume flow fast-260717-reg2e1: status is aborted
    at resumeFlow (file:///…/governance/engine/engine.js:73:40)
    at file:///…/governance/__tests__/engine.test.mjs:363:14
Node.js v22.22.0
```

18 `FAIL` lines, then a hard crash (uncaught exception) on the first attempt to resume a flow the register path had aborted instead of parked — the suite never reaches its final tally. Every validator-gated case fails or hangs in a retry loop (the `review`/`review_bench` repeats up to the loop `max`), exactly the routing symptom the owner reported (`request.md` "Observação sobre prioridade"): `on_failure` sends the flow back into a correction loop instead of surfacing the real error. Confirmed manually that the underlying cause is the reported module-resolution defect, run with `cwd` outside any `governance/` folder (mirroring `cwd = tmp` in the now-unsymlinked test):

Command: `tmp=$(mktemp -d); cd "$tmp" && bash -lc 'node governance/validators/check-bench.js .aidakit/tasks/x/bench.ndjson --bench review --outcome pass'`
```
node:internal/modules/cjs/loader:1478
  throw err;
  ^
Error: Cannot find module '/private/var/folders/.../T/tmp.ZwhxptIF3I/governance/validators/check-bench.js'
    at Module._resolveFilename (node:internal/modules/cjs/loader:1475:15)
    ...
  code: 'MODULE_NOT_FOUND',
  requireStack: []
}
```

This is the RED proof: the consumer-repo bug (`Cannot find module …/governance/validators/…`), reproduced.

### GREEN — engine suite after the runs.js + YAML fix

Command: `node governance/__tests__/engine.test.mjs`
```
76 passed, 0 failed
```

Same 76 cases that were RED above (or crashed the run) are green again — same count as the pre-implementation baseline.

### Full governance suite

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
76 passed, 0 failed
== governance/__tests__/ledger.test.mjs
8 passed, 0 failed
== governance/__tests__/plugin-version.test.mjs
12 passed, 0 failed
== governance/__tests__/roadmap.test.mjs
25 passed, 0 failed
== governance/__tests__/yaml-min.test.mjs
17 passed, 0 failed
```

All 12 files under `governance/__tests__/*.test.mjs` — every one `0 failed`.

### Consumer-repo simulation (validator resolves via $AIDAKIT_GOVERNANCE with cwd outside any governance/)

Command:
```
tmp=$(mktemp -d); mkdir -p "$tmp/docs/roadmap/epics"
printf -- '- **Feature:** X — changes: validator-path-resolution\n' > "$tmp/docs/roadmap/epics/EPIC-x.md"
AIDAKIT_PROJECT_ROOT="$tmp" node governance/cli.js start fast request=validator-path-resolution mode=register
```
```
[fast-260723-0a1318] PAUSED at "parked" (human_gate)

Debit registered: "validator-path-resolution" is declared on the roadmap (backlog)
and this flow is PARKED. Nothing is planned or implemented until you resume.
  plan    → continue into planning (select → plan → …)
  discard → abort this parked flow (the roadmap entry stays declared)

Options: plan | discard

To continue: node governance/cli.js resume fast-260723-0a1318 <outcome>
```

Exit 0. PAUSED at `"parked"` (`human_gate`) — NOT an abort with `Cannot find module`. The `check_registered` leash resolved `derive-roadmap-status.js` via `$AIDAKIT_GOVERNANCE` with `cwd = $tmp` (no `governance/` folder there at all). `$tmp` and the state/log files it wrote under `$tmp/.aidakit/flows/{state,logs}/fast-260723-0a1318.*` were removed after capture (`rm -rf "$tmp"`).

### Links

Command: `node governance/validators/check-links.js docs/features/validator-path-resolution docs/guides/flows.md`
```
{"validator":"aidakit.check-links","ok":true,"files_checked":5,"errors":[]}
# check-links

OK — 5 file(s), no broken links.
```
Exit 0.

## Files Touched (before review round 1)

```
$ git diff --stat
 docs/guides/flows.md                  |  7 ++++++-
 governance/__tests__/engine.test.mjs  | 15 ++++++---------
 governance/engine/steps/runs.js       |  8 +++++++-
 governance/flows/docs-onboarding.yaml |  4 ++--
 governance/flows/fast.yaml            |  8 ++++----
 governance/flows/full.yaml            |  8 ++++----
 6 files changed, 29 insertions(+), 21 deletions(-)

Untracked (new): docs/features/validator-path-resolution/ (this change directory)
```

Matched the scope declared in [proposal.md](proposal.md) at that point: 5 code files (`governance/engine/steps/runs.js`, the 3 flow YAMLs, `governance/__tests__/engine.test.mjs`) + `docs/guides/flows.md` + this change directory.

## Review Round 1 — Fixes (bench FAIL: adr NEEDS-REVISION, quality rejected, tests Coverage FAIL)

All four mandatory findings fixed in the same working tree, nothing committed. Full narrative in [tasks.md](tasks.md) §6.

### 1. Roadmap debits

Added `runs-error-routing` and `agent-validator-paths` as `- **Feature:**` bullets (+ `- Aceite:` sub-bullets) to [`docs/roadmap/epics/EPIC-flow-engine-leashes.md`](../../roadmap/epics/EPIC-flow-engine-leashes.md), matching the epic's exact existing convention (Portuguese prose, kebab-case change-ids). Regenerated the derived view:

Command: `node governance/validators/derive-roadmap-status.js --root .`
```
# roadmap (derived from disk)

## Coleiras mecânicas do flow engine  —  **backlog**
- Cap mecânico de retries — **backlog**
  - `engine-max-visits` → backlog
- Coleira das metas — **backlog**
  - `acceptance-leash` → backlog
- Retry com memória — **backlog**
  - `retry-memory` → backlog
- Bench paralelo estrutural — **backlog**
  - `flow-parallel-bench` → backlog
- Registro diferido no build (débito) — **done**
  - `add-debit` → done
- Arquivamento do loop-var-resume (bookkeeping) — **backlog**
  - `archive-loop-var-resume` → backlog
- `runs` distingue erro de infraestrutura de veredito negativo — **backlog**
  - `runs-error-routing` → backlog
- Caminho de validador para invocações diretas de agente/skill — **backlog**
  - `agent-validator-paths` → backlog
```

Both new changes show `backlog`, as expected (declared, not yet started). Updated [`docs/roadmap/ROADMAP.md`](../../roadmap/ROADMAP.md)'s Later section by hand to match this derived view (the repo has no CI-wired auto-regen; the convention per `skills/roadmap/SKILL.md`'s `regen` mode is to write the deriver's Now/Next/Later view into `ROADMAP.md` — done here by hand, same output).

### 2. ADR-004

Wrote [`docs/decisions/ADR-004-aidakit-governance-env-contract.md`](../../decisions/ADR-004-aidakit-governance-env-contract.md) in the ADR-001/002/003 format (WORM header comment, Status+Date, Context, Decision, Consequences with each negative marked Accepted/Mitigated, Review trigger, Alternatives considered — the same 4 alternatives from `design.md`, verbatim). Registered it in [`docs/decisions/README.md`](../../decisions/README.md) (index row + a new "Flow engine" thematic group). Validated:

Command: `node governance/validators/check-adr-format.js docs/decisions/ADR-004-aidakit-governance-env-contract.md`
```
{"validator":"aidakit.check-adr-format","ok":true,"adrs_checked":1,"errors":[]}
OK — 1 ADR(s), valid format.
```

Corrected the now-false claims: [proposal.md](proposal.md) §"Recorded decisions and inherited open decisions" and [design.md](design.md) §"Constraining ADRs" both now state ADR-004 is introduced BY this change, per ADR-003's placement boundary ("a decision with alternatives → ADR").

### 3. `governance/README.md`

Added a line in `## State` (right after the existing `AIDAKIT_PROJECT_ROOT` mention) documenting that `runs` children also receive `AIDAKIT_GOVERNANCE`, pointing at the kit's own `governance/` dir, cross-referencing `docs/guides/flows.md` §3/§6 and ADR-004.

### 4. Test gap — docs-onboarding dark

In [`governance/__tests__/engine.test.mjs`](../../../governance/__tests__/engine.test.mjs): added `"docs-onboarding"` to the §1 parse/validate loop; added a `seedSatisfiedProjectManifest` helper (fixed-path PROJECT-level manifest, `.aidakit/doc-manifest-project.json` — distinct from the per-change `manifestPathFor`); added a new §8 subsection driving the flow through its full happy path (`inventory→manifest→diff→propose→gate_migration→apply→check→done`) and asserting the `diff`/`check` `runs` steps' actual output (`exit_code === 0`, stderr has neither `Cannot find module` nor `MODULE_NOT_FOUND`) — not just routing/final-status.

New count after the fix (before mutation): `node governance/__tests__/engine.test.mjs` → **86 passed, 0 failed** (76 → 86, +10 new assertions: +3 from §1's parse/validate loop gaining a 3rd flow name (`docs-onboarding`, 2 `eq` + 1 `ok` per flow), +7 in the new §8 block (2 `eq` for visited/status, 1 `eq` for outcome, 4 `ok` for the `diff`/`check` steps' exit-code and no-module-error assertions)).

**Mutation proof** — temporarily reintroduced the typo `$AIDAKIT_GOVERNANC` (missing final `E`) at `docs-onboarding.yaml:66` (the `diff` step's command):

Command: `node governance/__tests__/engine.test.mjs` (with the typo)
```
FAIL docs-onboarding: diff step (runs) exited 0
FAIL docs-onboarding: diff step actually resolved the validator (no MODULE_NOT_FOUND in stderr)

84 passed, 2 failed
```

Confirmed RED — and precisely on the two new output-inspection assertions, NOT on routing or final status: `diff`'s `on_success`/`on_failure` both route to `propose` regardless of exit code, and `check` (line 128, untouched by the typo) still resolves fine, so the flow still visits `["inventory","manifest","propose","gate_migration","apply"]` and still completes — routing-only or final-status-only assertions would have stayed green through this exact regression, which is precisely the tester's finding. Only the explicit `exit_code`/`stderr` checks on the `diff` step's own `step_history` entry caught it. Reverted the typo:

Command: `node governance/__tests__/engine.test.mjs` (typo reverted)
```
86 passed, 0 failed
```

Confirmed GREEN again — the new test is proven to both fail correctly (catches the regression) and pass correctly (no false positive) around the reverted fix.

### Full validation battery, re-run after all four fixes

Command: `node governance/__tests__/engine.test.mjs`
```
86 passed, 0 failed
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
86 passed, 0 failed
== governance/__tests__/ledger.test.mjs
8 passed, 0 failed
== governance/__tests__/plugin-version.test.mjs
12 passed, 0 failed
== governance/__tests__/roadmap.test.mjs
25 passed, 0 failed
== governance/__tests__/yaml-min.test.mjs
17 passed, 0 failed
```

All 12 files, every one `0 failed`.

Command: `node governance/validators/check-links.js docs/features/validator-path-resolution docs/guides/flows.md docs/decisions docs/roadmap`
```
{"validator":"aidakit.check-links","ok":true,"files_checked":13,"errors":[]}
OK — 13 file(s), no broken links.
```
Exit 0 — the widened scope (change dir + `flows.md` + the whole `docs/decisions/` + `docs/roadmap/` trees, since both were touched by this round) resolves cleanly.

Consumer-repo simulation re-verified after the docs-onboarding.yaml mutation-and-revert cycle: `PAUSED at "parked"` again, unaffected (same command as before, `$tmp` cleaned up again).

## Files Touched (after review round 1 — final)

```
$ git status --porcelain
 M docs/decisions/README.md
 M docs/guides/flows.md
 M docs/roadmap/ROADMAP.md
 M docs/roadmap/epics/EPIC-flow-engine-leashes.md
 M governance/README.md
 M governance/__tests__/engine.test.mjs
 M governance/engine/steps/runs.js
 M governance/flows/docs-onboarding.yaml
 M governance/flows/fast.yaml
 M governance/flows/full.yaml
?? docs/decisions/ADR-004-aidakit-governance-env-contract.md
?? docs/features/validator-path-resolution/

$ git diff --stat
 docs/decisions/README.md                       |  2 +
 docs/guides/flows.md                           |  7 ++-
 docs/roadmap/ROADMAP.md                        |  2 +
 docs/roadmap/epics/EPIC-flow-engine-leashes.md |  4 ++
 governance/README.md                           |  2 +
 governance/__tests__/engine.test.mjs           | 71 ++++++++++++++++++++++----
 governance/engine/steps/runs.js                |  8 +-
 governance/flows/docs-onboarding.yaml          |  4 +-
 governance/flows/fast.yaml                     |  8 +--
 governance/flows/full.yaml                     |  8 +--
 10 files changed, 93 insertions(+), 23 deletions(-)
```

Widened from the original 6 files to 10 tracked + 1 new untracked file (ADR-004), consistent with the review's four findings: roadmap epic + ROADMAP.md (finding 1), decisions/README.md + the new ADR-004 file (finding 2), governance/README.md (finding 3), engine.test.mjs's larger diff + docs-onboarding.yaml's mutation-and-revert leaving it net-unchanged from the pre-review state (finding 4). `docs/features/validator-path-resolution/` (this change dir, tasks.md + evidence.md updates) remains untracked, as before. `.claude-plugin/plugin.json` deliberately NOT bumped (release-commit convention); `agents/*.md`, `skills/*`, `design.yaml` deliberately untouched.

## Unresolved Deviations

None. Two known follow-up debits are NOT deviations from this change's scope — they are now formally recorded on the roadmap (see "Review Round 1 — Fixes" §1 above), not left only as prose in this file:
- Follow-up: `runs` error-routing should distinguish "module/command missing" (infra) from "validator judged NO" (exit≠0) so a missing module surfaces instead of looping via `on_failure` (proposal.md non-goal 1; roadmap change `runs-error-routing`).
- Follow-up: agent/skill-invoked validator commands (`agents/orchestrator.md:50`, `agents/doc-planner.md:155`, `skills/roadmap/SKILL.md:64`) carry the same defect via a vector the injected env var does not reach (proposal.md non-goal 2; roadmap change `agent-validator-paths`).

Known residual test-debt, flagged by the tester in review round 1 as **non-blocking** ("do not block") — recorded here, deliberately NOT fixed in this change:
- `dna_freshness` (in `full.yaml`) is unreachable by the current engine test suite — no scenario drives the `full` flow's DNA-crystallization branch far enough to exercise it.
- `fast.yaml`'s `check_implement_bench` `node` clause (the compound `test … || ! grep … || node "$AIDAKIT_GOVERNANCE/validators/check-bench.js" …` on the implement-bench gate) is dark — no test drives a bench.ndjson shape that forces that specific clause to execute and inspects its output the way §8 now does for docs-onboarding's `diff`/`check`.
- `cli.js` (the `start`/`resume`/`status`/`abort`/`list` CLI entrypoint) has no dedicated test file — the engine tests exercise `engine.js`/`parser.js`/`persistence.js` directly, never the CLI's own argv parsing/dispatch layer.
