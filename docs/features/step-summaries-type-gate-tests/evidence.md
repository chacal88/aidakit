# Evidence — step-summaries-type-gate-tests

**Change ID:** `step-summaries-type-gate-tests`
**Date:** `2026-07-24`
**Owner:** `@chacal88`
**Phase / Package:** `tests only (governance/__tests__/) — EPIC-kit-discipline-hardening, feature 3`
**PRD:** `n/a`
**Tech Spec:** `n/a`

> Every block below is filled with REAL captured output from implementation — never a summary, never a reconstruction. The mutation edits were throwaway and reverted in the same task; `git diff --stat governance/engine/engine.js` is confirmed empty at the end (see §Files Touched) — no mutated `engine.js` is present.

## Validation Outputs

### Baseline (before any edit)

```
$ node governance/__tests__/step-summaries.test.mjs
aidakit — error: usage: summaries <flow_id>
aidakit — error: flow not found: nonexistent-flow-000000-ffffff

95 passed, 0 failed
```

### Final suite (unmutated engine, all cases in place)

```
$ node governance/__tests__/step-summaries.test.mjs
aidakit — error: usage: summaries <flow_id>
aidakit — error: flow not found: nonexistent-flow-000000-ffffff

107 passed, 0 failed
```

12 new assertions over the 95-baseline, four per new case: `§S3-vi-loop` (4: parse, status, exact-list, zero-lp), `§S3-vi-parallel` (4: parse, status, exact-list, zero-par), `§S3-vi-terminal` (4: parse, status, exact-list, zero-done) — the `§S3-vi-loop-empty` rename adds 0 new assertions (same 3 as the old `§S3-vi`, renamed). 4 × 3 = 12 = the 95 → 107 delta.

### Whole-directory sweep

```
$ for f in governance/__tests__/*.test.mjs; do echo "== $f"; node "$f" || echo "FAILED $f"; done
== governance/__tests__/agent-validator-paths.test.mjs

31 passed, 0 failed
== governance/__tests__/brainstorm-schema.test.mjs

34 passed, 0 failed
== governance/__tests__/candidates.test.mjs

8 passed, 0 failed
== governance/__tests__/check-acceptance.test.mjs

31 passed, 0 failed
== governance/__tests__/check-adr-format.test.mjs

8 passed, 0 failed
== governance/__tests__/check-bench.test.mjs

20 passed, 0 failed
== governance/__tests__/check-docs.test.mjs

8 passed, 0 failed
== governance/__tests__/check-links.test.mjs

7 passed, 0 failed
== governance/__tests__/context-pack.test.mjs
FAIL §dogfood-regression-code-map-pointers: code-map-pointers includes agents/adr-reviewer.md
FAIL §dogfood-regression-code-map-pointers: code-map-pointers includes agents/spec-reviewer.md
FAIL §dogfood-regression-code-map-pointers: code-map-pointers includes agents/reviewer-quality.md
FAIL §dogfood-regression-code-map-pointers: code-map-pointers includes agents/reviewer-security.md
FAIL §dogfood-regression-code-map-pointers: code-map-pointers includes agents/reviewer-architecture.md
FAIL §dogfood-regression-code-map-pointers: code-map-pointers includes agents/tester.md
FAIL §dogfood-regression-code-map-pointers: code-map-pointers includes agents/implementer.md
FAIL §dogfood-regression-code-map-pointers: code-map-pointers includes skills/implement/SKILL.md
FAIL §dogfood-regression-code-map-pointers: code-map-pointers includes skills/review/SKILL.md
FAIL §dogfood-regression-code-map-pointers: code-map-pointers includes skills/ship/SKILL.md
FAIL §dogfood-regression-adrs: ADRs section lists ADR-006 (design.md Dependencies, relative link)
FAIL §dogfood-regression-adrs: ADRs section lists ADR-009 (design.md Dependencies, relative link)
aidakit — error: invalid value for --duration-ms: expected a non-negative integer, got "not-a-number"

129 passed, 12 failed
FAILED governance/__tests__/context-pack.test.mjs
== governance/__tests__/dna-freshness.test.mjs

7 passed, 0 failed
== governance/__tests__/dna-write.test.mjs

14 passed, 0 failed
== governance/__tests__/engine.test.mjs

264 passed, 0 failed
== governance/__tests__/ledger.test.mjs

8 passed, 0 failed
== governance/__tests__/plugin-version.test.mjs

12 passed, 0 failed
== governance/__tests__/pr-automation.test.mjs

161 passed, 0 failed
== governance/__tests__/prelude.test.mjs

13 passed, 0 failed
== governance/__tests__/progress-table.test.mjs

30 passed, 0 failed
== governance/__tests__/retry-memory.test.mjs
append-retry-history — error: cause "has space" is not a valid single safe token — must match RESUME_OUTPUT_VALUE_RE (^[A-Za-z0-9._:@/-]+$)

87 passed, 0 failed
== governance/__tests__/roadmap.test.mjs

28 passed, 0 failed
== governance/__tests__/step-summaries.test.mjs
aidakit — error: usage: summaries <flow_id>
aidakit — error: flow not found: nonexistent-flow-000000-ffffff

107 passed, 0 failed
== governance/__tests__/yaml-min.test.mjs

17 passed, 0 failed
```

**Pre-existing, unrelated failure — `context-pack.test.mjs` (12 failed).** Verified via `git stash` (stashing this change's `step-summaries.test.mjs` edit and re-running against the untouched worktree) that the same 12 assertions fail identically before any edit of this change is applied. It is a dogfood-regression test comparing a DIFFERENT change's `.context-pack.md`/design.md against the live repo (agent/skill filenames and ADR citations), unrelated to `governance/__tests__/step-summaries.test.mjs` or `governance/engine/engine.js`. Out of scope for `step-summaries-type-gate-tests`; not caused by, and not fixed by, this change. All other suites — including the one under test — are green.

### Mutation checks

Protocol per row (tasks.md §5): clean check → apply edit at `governance/engine/engine.js:221-226` → run → capture → `git checkout -- governance/engine/engine.js` → re-run green.

Edit applied at `governance/engine/engine.js:221-226` before each row (`git diff --quiet governance/engine/engine.js` confirmed clean before starting), reverted with `git checkout -- governance/engine/engine.js` immediately after capturing the RED/no-op tail — the mutated file was never committed and `git diff --quiet governance/engine/engine.js` was re-confirmed clean after every revert.

#### M1 — type gate `+ "parallel"` (expect RED on `S3-vi-parallel`)

Edit: `(step.type === "invoke" || step.type === "human_gate" || step.type === "human_handoff" || step.type === "parallel")`

```
$ node governance/__tests__/step-summaries.test.mjs
  S3-vi-parallel: exactly the two branch entries emit, positive control: expected ["b1","b2"], got ["par","b1","par","b2","par"]
FAIL S3-vi-parallel: exactly the two branch entries emit, positive control
  S3-vi-parallel: zero entries carry the parallel step's own id: expected 0, got 3
FAIL S3-vi-parallel: zero entries carry the parallel step's own id
aidakit — error: usage: summaries <flow_id>
aidakit — error: flow not found: nonexistent-flow-000000-ffffff

105 passed, 2 failed

$ git checkout -- governance/engine/engine.js && node governance/__tests__/step-summaries.test.mjs
aidakit — error: usage: summaries <flow_id>
aidakit — error: flow not found: nonexistent-flow-000000-ffffff

107 passed, 0 failed
```

Result: exactly as predicted — RED on both `S3-vi-parallel` assertions, nothing else. `parallel-exclusion-locked` satisfied.

#### M2 — type gate `+ "loop"` (expect RED on `S3-vi-loop-empty` and `S3-vi-loop`)

Edit: `(step.type === "invoke" || step.type === "human_gate" || step.type === "human_handoff" || step.type === "loop")`

```
$ node governance/__tests__/step-summaries.test.mjs
FAIL S3-vi-loop-empty: no summary entry for the loop step id
  S3-vi-loop: exactly the two body_step entries emit, positive control: expected [{"step_id":"body_step","visit_n":1},{"step_id":"body_step","visit_n":2}], got [{"step_id":"lp","visit_n":1},{"step_id":"body_step","visit_n":1},{"step_id":"lp","visit_n":2},{"step_id":"body_step","visit_n":2},{"step_id":"lp","visit_n":3}]
FAIL S3-vi-loop: exactly the two body_step entries emit, positive control
  S3-vi-loop: zero entries carry the loop step's own id: expected 0, got 3
FAIL S3-vi-loop: zero entries carry the loop step's own id
aidakit — error: usage: summaries <flow_id>
aidakit — error: flow not found: nonexistent-flow-000000-ffffff

104 passed, 3 failed

$ git checkout -- governance/engine/engine.js && node governance/__tests__/step-summaries.test.mjs
aidakit — error: usage: summaries <flow_id>
aidakit — error: flow not found: nonexistent-flow-000000-ffffff

107 passed, 0 failed
```

Result: exactly as predicted — RED on `S3-vi-loop-empty` (the degenerate empty-array case) AND on both `S3-vi-loop` assertions (the iterating case, now also proving the `__iterate__` dispatches inject `lp` entries). `loop-exclusion-strengthened` satisfied.

#### M3 — type gate `+ "terminal"` only (expect GREEN — documented no-op)

Edit: `(step.type === "invoke" || step.type === "human_gate" || step.type === "human_handoff" || step.type === "terminal")` — kind gate left unchanged.

The kind gate (`outcome.kind === "next" || "fail"`) rejects `executeTerminal`'s `{kind:"terminal"}` before the type gate is consulted, so this mutation cannot change behavior. Recorded so the asymmetry is visible rather than mistaken for a weak test.

```
$ node governance/__tests__/step-summaries.test.mjs
aidakit — error: usage: summaries <flow_id>
aidakit — error: flow not found: nonexistent-flow-000000-ffffff

107 passed, 0 failed

$ git checkout -- governance/engine/engine.js
```

Result: exactly as predicted — no failures, confirming `executeTerminal`'s `kind:"terminal"` never reaches the type-gate check. `terminal-exclusion-locked`, part 1, satisfied.

#### M4 — type gate `+ "terminal"` AND kind gate `+ outcome.kind === "terminal"` (expect RED on `S3-vi-terminal`)

Edit: kind gate → `(outcome.kind === "next" || outcome.kind === "fail" || outcome.kind === "terminal")`; type gate → `(step.type === "invoke" || step.type === "human_gate" || step.type === "human_handoff" || step.type === "terminal")`

```
$ node governance/__tests__/step-summaries.test.mjs
  S3-i: exactly one summary entry emitted: expected 1, got 2
FAIL S3-i: exactly one summary entry emitted
  S3-ii: exactly one summary entry emitted: expected 1, got 2
FAIL S3-ii: exactly one summary entry emitted
  S3-iii: exactly one summary entry emitted: expected 1, got 2
FAIL S3-iii: exactly one summary entry emitted
FAIL S3-v: no summary entry for a runs step, even with a summary: field declared
  S3-vi-loop: exactly the two body_step entries emit, positive control: expected [{"step_id":"body_step","visit_n":1},{"step_id":"body_step","visit_n":2}], got [{"step_id":"body_step","visit_n":1},{"step_id":"body_step","visit_n":2},{"step_id":"done","visit_n":1}]
FAIL S3-vi-loop: exactly the two body_step entries emit, positive control
  S3-vi-parallel: exactly the two branch entries emit, positive control: expected ["b1","b2"], got ["b1","b2","done"]
FAIL S3-vi-parallel: exactly the two branch entries emit, positive control
  S3-vi-terminal: exactly the work entry emits, positive control: expected ["work"], got ["work","done"]
FAIL S3-vi-terminal: exactly the work entry emits, positive control
  S3-vi-terminal: zero entries carry the terminal step's own id: expected 0, got 1
FAIL S3-vi-terminal: zero entries carry the terminal step's own id
  S3-viii: one summary entry emitted before the abort terminal: expected 1, got 2
FAIL S3-viii: one summary entry emitted before the abort terminal
  S3-ix: insertion order + monotonic per-step visit_n, no overwrite: expected [{"step_id":"A","visit_n":1},{"step_id":"B","visit_n":1},{"step_id":"A","visit_n":2},{"step_id":"B","visit_n":2}], got [{"step_id":"A","visit_n":1},{"step_id":"B","visit_n":1},{"step_id":"A","visit_n":2},{"step_id":"B","visit_n":2},{"step_id":"done","visit_n":1}]
FAIL S3-ix: insertion order + monotonic per-step visit_n, no overwrite
aidakit — error: usage: summaries <flow_id>
aidakit — error: flow not found: nonexistent-flow-000000-ffffff

97 passed, 10 failed

$ git checkout -- governance/engine/engine.js && node governance/__tests__/step-summaries.test.mjs
aidakit — error: usage: summaries <flow_id>
aidakit — error: flow not found: nonexistent-flow-000000-ffffff

107 passed, 0 failed
```

Result: exactly as predicted — RED on `S3-vi-terminal` (both assertions), plus the pre-existing collateral (S3-i, S3-ii, S3-iii, S3-v, S3-viii, S3-ix — 6 cases), plus the new `S3-vi-loop`/`S3-vi-parallel` exact-list assertions now also seeing a `done` entry. 10 failed assertions total, matching design.md's enumerated set. `terminal-exclusion-locked`, part 2, satisfied.

No mutation produced an unexpected colour; every row matched design.md §Mutation-check protocol exactly. No escalation triggered.

### Validators

```
$ node governance/validators/check-links.js docs/features/step-summaries-type-gate-tests
{"validator":"aidakit.check-links","ok":true,"files_checked":5,"errors":[]}
# check-links

OK — 5 file(s), no broken links.

$ node governance/validators/check-plugin-version.js .
{"validator":"aidakit.check-plugin-version","ok":true,"manifest":"0.9.0","highest":"0.8","behind":[],"scanned":298}
# check-plugin-version

OK — manifest 0.9.0 covers the highest footer (v0.8), 298 file(s).

$ node governance/validators/derive-roadmap-status.js --root .
{"validator":"aidakit.derive-roadmap-status","ok":true,"epics_count":5,"epics":[{"id":"EPIC-context-caching","title":"Cacheamento de contexto por change","file":"/Users/kauesantos/Documents/winker/aidakit/.claude/worktrees/step-summaries-type-gate-tests-cbd578/docs/roadmap/epics/EPIC-context-caching.md","features":[{"name":"Context pack por change (L1)","changes":[{"id":"context-pack-l1","status":"done"}],"status":"done"}],"status":"done"},{"id":"EPIC-delivery-automation","title":"Automação de entrega (PR → merge)","file":"/Users/kauesantos/Documents/winker/aidakit/.claude/worktrees/step-summaries-type-gate-tests-cbd578/docs/roadmap/epics/EPIC-delivery-automation.md","features":[{"name":"Merge autônomo opt-in do PR","changes":[{"id":"configurable-pr-automation","status":"done"}],"status":"done"},{"name":"Sweep pós-merge — arquiva, apaga branch, remove worktree","changes":[{"id":"post-merge-sweep","status":"backlog"}],"status":"backlog"}],"status":"backlog"},{"id":"EPIC-flow-cli-ux","title":"Experiência de linha de comando dos flows","file":"/Users/kauesantos/Documents/winker/aidakit/.claude/worktrees/step-summaries-type-gate-tests-cbd578/docs/roadmap/epics/EPIC-flow-cli-ux.md","features":[{"name":"Agrupamento de comandos + inputs","changes":[{"id":"command-grouping-and-inputs","status":"done"}],"status":"done"},{"name":"Tabela de progresso do flow","changes":[{"id":"flow-run-progress-table","status":"done"}],"status":"done"},{"name":"Sumários de passo do flow","changes":[{"id":"flow-step-summaries","status":"done"}],"status":"done"}],"status":"done"},{"id":"EPIC-flow-engine-leashes","title":"Coleiras mecânicas do flow engine","file":"/Users/kauesantos/Documents/winker/aidakit/.claude/worktrees/step-summaries-type-gate-tests-cbd578/docs/roadmap/epics/EPIC-flow-engine-leashes.md","features":[{"name":"Cap mecânico de retries","changes":[{"id":"engine-max-visits","status":"done"}],"status":"done"},{"name":"Coleira das metas","changes":[{"id":"acceptance-leash","status":"done"}],"status":"done"},{"name":"Retry com memória","changes":[{"id":"retry-memory","status":"done"}],"status":"done"},{"name":"Fate do `type: parallel` do engine","changes":[{"id":"engine-parallel-fate","status":"backlog"}],"status":"backlog"},{"name":"Registro diferido no build (débito)","changes":[{"id":"add-debit","status":"done"}],"status":"done"},{"name":"Arquivamento do loop-var-resume (bookkeeping)","changes":[{"id":"archive-loop-var-resume","status":"done"}],"status":"done"},{"name":"`runs` distingue erro de infraestrutura de veredito negativo","changes":[{"id":"runs-error-routing","status":"done"}],"status":"done"},{"name":"Request livre vs change-id nos flows","changes":[{"id":"flow-request-vs-change-id","status":"done"}],"status":"done"},{"name":"Caminho absoluto do validador nos `runs` steps","changes":[{"id":"validator-path-resolution","status":"done"}],"status":"done"},{"name":"Caminho de validador para invocações diretas de agente/skill/command","changes":[{"id":"agent-validator-paths","status":"done"}],"status":"done"},{"name":"Status derivado do git compartilhado (single-valued entre worktrees)","changes":[{"id":"roadmap-status-from-shared-git","status":"done"}],"status":"done"},{"name":"Commit precoce do plano no `full` flow (fecha a janela do ADR-007)","changes":[{"id":"flow-commit-plan-early","status":"done"}],"status":"done"}],"status":"backlog"},{"id":"EPIC-kit-discipline-hardening","title":"Endurecimento da disciplina do próprio kit","file":"/Users/kauesantos/Documents/winker/aidakit/.claude/worktrees/step-summaries-type-gate-tests-cbd578/docs/roadmap/epics/EPIC-kit-discipline-hardening.md","features":[{"name":"Usage do `aidakit:review` mostra o requisito do bench manifest","changes":[{"id":"review-usage-bench-manifest","status":"in-progress"}],"status":"in-progress"},{"name":"Gate do plano verifica claims sobre internals dos executors","changes":[{"id":"plan-gate-executor-internals-check","status":"in-progress"}],"status":"in-progress"},{"name":"Testes de step-summaries afirmam exclusão de tipo positivamente","changes":[{"id":"step-summaries-type-gate-tests","status":"in-progress"}],"status":"in-progress"},{"name":"Brainstorm trava assumptions sobre schema/path em forma literal inequívoca","changes":[{"id":"brainstorm-schema-path-literal-lock","status":"backlog"}],"status":"backlog"},{"name":"Builder do context pack lê os headings que o kit realmente exige","changes":[{"id":"context-pack-heading-alignment","status":"backlog"}],"status":"backlog"}],"status":"in-progress"}],"orphans":[{"epic":"EPIC-delivery-automation","feature":"Sweep pós-merge — arquiva, apaga branch, remove worktree","change":"post-merge-sweep"},{"epic":"EPIC-flow-engine-leashes","feature":"Fate do `type: parallel` do engine","change":"engine-parallel-fate"},{"epic":"EPIC-kit-discipline-hardening","feature":"Brainstorm trava assumptions sobre schema/path em forma literal inequívoca","change":"brainstorm-schema-path-literal-lock"},{"epic":"EPIC-kit-discipline-hardening","feature":"Builder do context pack lê os headings que o kit realmente exige","change":"context-pack-heading-alignment"}]}
# roadmap (derived from disk)

## Cacheamento de contexto por change  —  **done**
- Context pack por change (L1) — **done**
  - `context-pack-l1` → done

## Automação de entrega (PR → merge)  —  **backlog**
- Merge autônomo opt-in do PR — **done**
  - `configurable-pr-automation` → done
- Sweep pós-merge — arquiva, apaga branch, remove worktree — **backlog**
  - `post-merge-sweep` → backlog

## Experiência de linha de comando dos flows  —  **done**
- Agrupamento de comandos + inputs — **done**
  - `command-grouping-and-inputs` → done
- Tabela de progresso do flow — **done**
  - `flow-run-progress-table` → done
- Sumários de passo do flow — **done**
  - `flow-step-summaries` → done

## Coleiras mecânicas do flow engine  —  **backlog**
- Cap mecânico de retries — **done**
  - `engine-max-visits` → done
- Coleira das metas — **done**
  - `acceptance-leash` → done
- Retry com memória — **done**
  - `retry-memory` → done
- Fate do `type: parallel` do engine — **backlog**
  - `engine-parallel-fate` → backlog
- Registro diferido no build (débito) — **done**
  - `add-debit` → done
- Arquivamento do loop-var-resume (bookkeeping) — **done**
  - `archive-loop-var-resume` → done
- `runs` distingue erro de infraestrutura de veredito negativo — **done**
  - `runs-error-routing` → done
- Request livre vs change-id nos flows — **done**
  - `flow-request-vs-change-id` → done
- Caminho absoluto do validador nos `runs` steps — **done**
  - `validator-path-resolution` → done
- Caminho de validador para invocações diretas de agente/skill/command — **done**
  - `agent-validator-paths` → done
- Status derivado do git compartilhado (single-valued entre worktrees) — **done**
  - `roadmap-status-from-shared-git` → done
- Commit precoce do plano no `full` flow (fecha a janela do ADR-007) — **done**
  - `flow-commit-plan-early` → done

## Endurecimento da disciplina do próprio kit  —  **in-progress**
- Usage do `aidakit:review` mostra o requisito do bench manifest — **in-progress**
  - `review-usage-bench-manifest` → in-progress
- Gate do plano verifica claims sobre internals dos executors — **in-progress**
  - `plan-gate-executor-internals-check` → in-progress
- Testes de step-summaries afirmam exclusão de tipo positivamente — **in-progress**
  - `step-summaries-type-gate-tests` → in-progress
- Brainstorm trava assumptions sobre schema/path em forma literal inequívoca — **backlog**
  - `brainstorm-schema-path-literal-lock` → backlog
- Builder do context pack lê os headings que o kit realmente exige — **backlog**
  - `context-pack-heading-alignment` → backlog
```

All three validators exit 0. `derive-roadmap-status.js` correctly derives `step-summaries-type-gate-tests` as `in-progress` from the existence of this change's directory (ADR-002/ADR-007).

**`derive-roadmap-status.js` is report-only.** It prints the derived roadmap to stdout (verbatim above, including the worktree-absolute `"file"` paths the JSON line emits per epic) and never writes `docs/roadmap/ROADMAP.md` — the source has no write path for it, and the stdout rendering is a different shape from the committed file (which carries `## Done` sections and single-line change entries). `docs/roadmap/ROADMAP.md` is therefore **unmodified by this change** and still shows this line as `backlog`; it is synced by the `aidakit:roadmap` skill as a separate chore commit (cf. `ab037b7 chore(docs): sync roadmap`), which is what will flip the line once this package is committed. The plan's exit criterion said "ROADMAP.md regenerated" on a wrong premise about this validator; the criterion is corrected in [proposal.md](proposal.md) §Exit criteria to "derives `in-progress`", which is what the validator actually proves.

## Files Touched

```
$ git status --short
 M docs/roadmap/epics/EPIC-kit-discipline-hardening.md
 M governance/__tests__/step-summaries.test.mjs
?? docs/features/step-summaries-type-gate-tests/

$ git diff --stat
 .../roadmap/epics/EPIC-kit-discipline-hardening.md |   9 +-
 governance/__tests__/step-summaries.test.mjs       | 141 ++++++++++++++++++++-
 2 files changed, 141 insertions(+), 9 deletions(-)
```

Re-captured after the final prose edit of round 3 (see §Unresolved Deviations for why the ordering matters).

Why **both** commands are load-bearing for `production-untouched`, and why neither alone suffices:

- `git diff --stat` reports only paths already tracked by git, so it never lists the untracked package directory — nor would it list an untracked artifact leaked under `governance/engine/` by the mutation protocol (a scratch copy, a `.orig`). Only `git status --short` surfaces those, as `??`.
- `git diff --stat` (without `--cached`) is also blind to a *staged* mutation; `git status --short`'s index column catches that too.

`docs/roadmap/ROADMAP.md` appears in neither capture because it was never written — `derive-roadmap-status.js` only reports (see §Validators).

| Path | Why |
|---|---|
| `governance/__tests__/step-summaries.test.mjs` | header comment + `§S3-vi` family (rename + 3 new cases) |
| `docs/features/step-summaries-type-gate-tests/*` | this change package |
| `docs/roadmap/epics/EPIC-kit-discipline-hardening.md` | one appended Feature block registering the debit `context-pack-heading-alignment` (round-1 review finding 4), plus the two non-goal lines rescoped so their "4 items" claims no longer speak for the fifth, review-originated item |

Three paths, matching the captures above. The epic is a deliberate widening of this change's `docs/` surface beyond the package directory: [ADR-002](../../decisions/ADR-002-roadmap-status-derived-from-disk.md) makes a deferred defect real only when it is declared on disk, so deferring the `build.js` heading defect without registering it would have been a promise in prose. `production-untouched` is unaffected — no path under `governance/engine/`.

## Unresolved Deviations

**One, in the plan rather than the code.** The plan (proposal §Impact/§Exit criteria, tasks §3) asserted that `derive-roadmap-status.js` regenerates `docs/roadmap/ROADMAP.md`. It does not — the validator is report-only, printing the derived roadmap to stdout with no write path for that file, and its stdout shape differs from the committed file's. The first implementation pass propagated the wrong premise into this document, claiming a regeneration that had not happened and explaining the file's absence from `git status` as "unstaged" (an unstaged write would still appear). Corrected across proposal.md, tasks.md and this file: `ROADMAP.md` is untouched by this change and is synced separately by the `aidakit:roadmap` skill. No test, fixture, or assertion was affected.

**Four more, all raised by `aidakit:adr-reviewer` in review round 1 and all fixed in the plan documents — no test code changed.**

1. **`## Acceptance criteria` was merging validator gates into the observable-effect section.** `suite-no-regression` and `production-untouched` are a green-suite gate and a command gate; [ADR-010](../../decisions/ADR-010-acceptance-leash.md) §Decision 3 keeps those in `## Exit criteria` ("the two do not merge"), where both were already stated verbatim. Removed from `## Acceptance criteria`, which now carries only the three exclusion-lock promises; a pointer records why.
2. **`suite-no-regression` promised something false.** It said "every other suite under `governance/__tests__/` stays green", but `context-pack.test.mjs` reports `129 passed, 12 failed`. Those failures pre-date this change — reproduced identically on a stashed tree — so the finding is the criterion's wording, not the suite. Since the criterion moved to `## Exit criteria` under fix 1, the exclusion is now stated there explicitly instead of being contradicted by this file.
3. **An open decision IS touched.** The plan claimed none was. `EPIC-flow-engine-leashes` carries the owner-pending `engine-parallel-fate` decision, whose track (a) deletes `type: parallel` outright — which would delete `§S3-vi-parallel` and its fixture with it. `aidakit:spec-reviewer` raised the same coupling independently. proposal.md §Recorded decisions now names it so the owner sees the dependency before merge rather than during the deletion.
4. **The ADR-007 citation overstated what it grants.** "The existence of this directory flips the roadmap line to `in-progress`" is only the local-tree half of the union; the package is untracked, so every other clone still derives `backlog` (matching `ROADMAP.md:27`). Caveated in proposal.md and tasks.md. `fast` has no `commit_plan` step, so the window is expected.

A fifth round-1 finding is **out of scope and left open**: `governance/context-pack/build.js` derives its `summary` from a `## Problem` heading and its DoD from `## Success criteria`, while ADR-010 and the plan skill mandate `## Why` and `## Acceptance criteria` — so this change's `.context-pack.md` ships with both sections empty. That is a pre-existing kit defect affecting every change, not something to hand-patch in one pack (and patching `build.js` from a tests-only change would itself be a scope violation). It is registered as the debit `context-pack-heading-alignment` under [EPIC-kit-discipline-hardening](../../roadmap/epics/EPIC-kit-discipline-hardening.md), which is the only thing that makes this deferral hold on disk rather than in prose ([ADR-002](../../decisions/ADR-002-roadmap-status-derived-from-disk.md)).

**Round 3 (a confirming single-role round, authorized by the owner after the bench hit its 2-round cap) found six more, all of them staleness created by the round-2 edits rather than new defects — and all in documents, never in test code.** The round-2 epic edit widened this change's `docs/` surface, but `proposal.md` §Impact, `tasks.md` §6 and this file's §Files Touched still claimed the package directory was the only `docs/` path; the pasted `derive-roadmap-status` capture predated the epic edit, so the one artifact meant to prove the debit exists on disk still showed it absent; `design.md` §Evidence location still promised the `git diff --stat` proof alone; the id `suite-no-regression` was cited but no longer defined anywhere; the per-case assertion counts in §Final suite summed to 17 against an actual 12; and the epic's own non-goals still counted four items after a fifth was appended. All corrected above.

**Root cause, recorded for the next reader:** an evidence document that carries pasted captures goes stale on every subsequent edit to the change, and each round of prose fixes silently invalidated a capture elsewhere. The protocol that stops it is the one used in this round — make every prose correction first, then re-capture all live outputs once, last, so no capture can predate an edit. The captures in §Validators and §Files Touched above were taken after the final prose edit of round 3.

Otherwise empty. Every fixture, drive sequence, rand id, and assertion shape landed exactly as design.md prescribed (including the `yaml-min` nested-list trap for `§S3-vi-parallel`'s `branches:`), and all four mutation runs produced exactly the predicted colour on the first attempt — no assertion was adjusted to match a surprise. Two readiness findings were also folded in during implementation: `tasks.md` §3 now states that `derive-roadmap-status.js` is report-only and leaves `docs/roadmap/ROADMAP.md` untouched (deviation 1 above is what corrected it), and the §Files Touched note above documents why `git diff --stat` alone does not prove `production-untouched` for an untracked path — which is also why exit criterion `production-untouched` requires `git status --short` alongside it.

<!-- aidakit v0.6 — evidence for step-summaries-type-gate-tests, 2026-07-24 -->
