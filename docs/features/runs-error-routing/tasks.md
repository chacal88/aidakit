# Tasks — runs-error-routing

**Change ID:** `runs-error-routing`
**Date:** `2026-07-24`
**Owner:** `@chacal88`
**Phase / Package:** `n/a (governance/engine)`
**PRD:** `n/a`
**Tech Spec:** `n/a`

Order: RED → GREEN → REFACTOR. Each test task must fail against `main` before its implementation task lands.

## 1. Setup

- [ ] 1.1 Create the change branch `claude/runs-error-routing-<sha>` from `main` (or continue on `claude/resume-runs-error-routing-c538fb` if already checked out).
- [ ] 1.2 Confirm the baseline: `node governance/__tests__/engine.test.mjs` reports 127 passed / 0 failed on the pre-change tree.

## 2. Surface Work — `governance/engine/` (RED tests first)

Every RED test goes into a new section `// §12. Infra-error routing (runs-error-routing)` at the tail of [`governance/__tests__/engine.test.mjs`](../../../governance/__tests__/engine.test.mjs) (currently 1224 lines; section §11 ends at line ~1189 per the flow-request-vs-change-id merge). Each test uses the existing `driveDry`/`resumeWith` helpers ([`engine.test.mjs:103-130`](../../../governance/__tests__/engine.test.mjs)) and asserts against `state.status`, `state.outcome`, `state.step_history[last].result`, and the `runs_infra_error` event in the log JSONL.

- [ ] 2.1 **RED**: test §12.1 — a `runs` step invoking `bash -lc "definitely-not-a-real-command-xyz"` (POSIX exit 127 from bash-builtin lookup miss) hard-stops even when the step declares `on_failure: some_target`. Assertions: `state.status === "failed"`, `state.outcome === "failed"`, last history entry `result === "infra_error"`, the `on_failure` target step is NOT present in `step_history`, a `runs_infra_error` event exists in the JSONL log at `.aidakit/logs/<flow_id>.jsonl` with `exit_code: 127`.
- [ ] 2.2 **RED**: test §12.2 — a `runs` step invoking a file with mode `000` (exit 126, permission denied). Same assertion shape as §12.1 with `exit_code: 126`. Test seeds the file via `writeFileSync` + `chmodSync(0o000)` in the tmp project root, cleans up in the test's finally.
- [ ] 2.3 **RED**: test §12.3 — a `runs` step whose child is killed by signal (`res.signal` set). Simulate via `bash -lc "kill -SEGV $$"` (self-SIGSEGV). Assertions: `signal: "SIGSEGV"` in the event, `exit_code: null`, hard-stop as above.
- [ ] 2.4 **RED**: test §12.4 — a `runs` step whose command references a nonexistent SHELL (via `env` override forcing `SHELL` unknown; the test sets `step.env.PATH = ""` and `command = "/no/such/shell -c true"` so `spawnSync`'s bash arg still starts but the CHILD spawn produces exit 127; alternatively drive `res.error` by monkey-patching the spawn in a test-only branch). Concrete option: use `command = "exec /bin/does-not-exist"` in bash — bash reports "not found" via exit 127; this collapses into §12.1's shape. Prefer this cleaner formulation; drop the `res.error` test if a reliable trigger requires patching spawn.
- [ ] 2.5 **RED**: test §12.5 — a Node validator that `require()`s a missing module. Seed a validator file at `<tmp>/gov-fake/needs-missing.cjs` with body `require('./absolutely-missing-module')`. Step command: `node "<tmp>/gov-fake/needs-missing.cjs"`. Assertions: `exit_code: 250` in the event (once the prelude is loaded), hard-stop, `on_failure` target NOT dispatched. Pre-implementation this test FAILS because there is no prelude and Node exits 1 → routed via `on_failure` (the current defect this change fixes).
- [ ] 2.6 Run the suite: expect 5 new failures. Record the failing output — this is the "bug present" proof for the implementer.

- [ ] 2.7 **GREEN**: create `governance/engine/prelude/infra-detect.cjs` per [design.md §"The Node prelude module"](design.md). Body:
  - `process.on('uncaughtException', ...)` handler that inspects `err.code` for `MODULE_NOT_FOUND` / `ERR_MODULE_NOT_FOUND` and `err.code === 'ENOENT'` when `err.requireStack` is present.
  - On match: write to stderr `aidakit-prelude: infra error: <code>: <message>\n`, then `process.exit(250)`.
  - On miss: `throw err` (re-raise).
  - Idempotent — first-import guard via a `Symbol.for('aidakit.infra-detect.installed')` on `globalThis`.
- [ ] 2.8 **GREEN**: modify [`governance/engine/steps/runs.js`](../../../governance/engine/steps/runs.js) — at module scope (near line 16, next to `AIDAKIT_GOVERNANCE`), compute `AIDAKIT_PRELUDE = resolve(dirname(fileURLToPath(import.meta.url)), "..", "prelude", "infra-detect.cjs")`. In `executeRuns` (line 29), extend the env construction:
  ```
  const nodeOpts = (process.env.NODE_OPTIONS ?? "").trim();
  const injectedNodeOpts = `${nodeOpts} --require=${JSON.stringify(AIDAKIT_PRELUDE)}`.trim();
  const env = { ...process.env, ...vars, AIDAKIT_GOVERNANCE, NODE_OPTIONS: injectedNodeOpts };
  ```
  Then step.env loop runs after (preserving [ADR-004](../../decisions/ADR-004-aidakit-governance-env-contract.md) precedence).
- [ ] 2.9 **GREEN**: add the classifier to `executeRuns` — after `spawnSync` returns (around line 40), BEFORE the `res.error` branch at line 53:
  ```
  const isInfra =
    res.error ||
    res.signal ||
    res.status === 127 ||
    res.status === 126 ||
    res.status === 250;
  if (isInfra) {
    const parts = [];
    if (res.error) parts.push(`spawn error: ${res.error.message}`);
    if (res.signal) parts.push(`killed by ${res.signal}`);
    if (res.status != null) parts.push(`exit ${res.status}`);
    const tail = (res.stderr ?? "").slice(-1000).trim();
    if (tail) parts.push(`stderr: ${tail}`);
    // Reuse the same `output` object; add `signal` so the event can include it.
    const infraOutput = { ...output, signal: res.signal ?? null };
    ctx.state.context[step.id] = infraOutput;
    return { kind: "infra", error: `runs infra error: ${parts.join("; ")}`, output: infraOutput };
  }
  ```
  Delete the old `if (res.error) { return { kind: "fail", ... } }` block at lines 52-55 — its cases are now covered.
- [ ] 2.10 **GREEN**: modify [`governance/engine/engine.js`](../../../governance/engine/engine.js) — insert the `if (outcome.kind === "infra")` clause BEFORE line 223 (the `kind:"fail"` block), per [design.md §"Router change"](design.md). The clause emits `runs_infra_error`, sets `state.status = "failed"`, calls `saveState`, emits `flow_end`, returns. Also update `outcomeKey` at line 320-325: add `if (o.kind === "infra") return "infra_error";` above the existing `fail` branch.
- [ ] 2.11 **GREEN**: update the JSDoc `StepOutcome` typedef in [`governance/engine/types.js:121-125`](../../../governance/engine/types.js) — add `|{kind:"infra",error:string,output?:unknown}` to the union.
- [ ] 2.12 Re-run `node governance/__tests__/engine.test.mjs`. Expect all 132 (127 existing + 5 new) passing.

## 3. Surface Work — `governance/flows/` audit

- [ ] 3.1 Re-run the shipped flows in the isolated test tmp to confirm no `on_failure` regression. The existing `engine.test.mjs` tests §1-§11 exercise every real `runs` step in `fast.yaml` / `full.yaml` / `docs-onboarding.yaml`; a green suite is the audit.
- [ ] 3.2 No YAML edits needed (per [design.md §"Backward compatibility"](design.md)). If §3.1 surfaces any test that expected an `on_failure` target to fire on a `res.error`-shaped outcome, ESCALATE — the design assumed none exists.

## 4. Documentation

- [ ] 4.1 Draft `docs/decisions/ADR-010-runs-infra-error-routing.md` per the template in [design.md §"Alternatives"](design.md) — five sections (Status+Date · Context · Decision · Consequences · Alternatives). Cite [ADR-004](../../decisions/ADR-004-aidakit-governance-env-contract.md), [ADR-006](../../decisions/ADR-006-flow-values-as-data.md), [ADR-009](../../decisions/ADR-009-flow-commits-plan-early.md); link back to this change directory. Follow the format of [ADR-009](../../decisions/ADR-009-flow-commits-plan-early.md) (short, precise, alternatives table).
- [ ] 4.2 Update `docs/decisions/README.md` — add the ADR-010 row to the index table (line 26 area) and to the "Flow engine" thematic grouping (line 32).
- [ ] 4.3 Add a paragraph to `docs/guides/flows.md` (locate near the `AIDAKIT_GOVERNANCE` / `NODE_OPTIONS` documentation from `validator-path-resolution`): describe the infra-error surface for consumer flow authors — "when a runs step's command cannot be found, its permission is denied, its child crashes on signal, or a `node` sub-invocation fails to resolve a module, the engine emits `runs_infra_error` and hard-stops the flow regardless of `on_failure`. Do not attempt to catch these with `on_failure`; fix the underlying environment."
- [ ] 4.4 Register the change in the roadmap: mark the `runs-error-routing` sub-bullet in [`docs/roadmap/epics/EPIC-flow-engine-leashes.md:21`](../../roadmap/epics/EPIC-flow-engine-leashes.md) as **Entregue** with the PR number after merge (same pattern as flow-commit-plan-early on line 30).
- [ ] 4.5 If `.aidakit/tasks/runs-error-routing/doc-manifest.json` exists (created by `aidakit:document` in later flow steps), ensure every required doc is mapped.

## 5. Validation

Every command below is executable in this repo (verified against `governance/flows/*.yaml` and `governance/validators/`):

- [ ] 5.1 `node governance/__tests__/engine.test.mjs` → 132/0.
- [ ] 5.2 `node governance/__tests__/roadmap.test.mjs` → 28/0 (no regression on the roadmap deriver — unrelated to this change, run as a safety net).
- [ ] 5.3 `node governance/validators/check-adr-format.js docs/decisions/ADR-010-runs-infra-error-routing.md` → exit 0.
- [ ] 5.4 `node governance/validators/check-links.js docs/features/runs-error-routing docs/decisions/ADR-010-runs-infra-error-routing.md docs/guides/flows.md docs/decisions/README.md docs/roadmap/epics/EPIC-flow-engine-leashes.md` → exit 0.
- [ ] 5.5 Manual repro (see §"How to verify manually" below) recorded in [evidence.md](evidence.md).
- [ ] 5.6 Full governance suite: `for f in governance/__tests__/*.test.mjs; do node "$f"; done` — 0 failures across all files.

## 6. Cleanup

- [ ] 6.1 Remove any scratch files under `/private/tmp/…` used for manual repro.
- [ ] 6.2 Fill in [evidence.md](evidence.md) — all three sections (`## Validation Outputs`, `## Files Touched`, `## Unresolved Deviations`) populated with real command output, real file paths, and either "None" or a listed deviation.
- [ ] 6.3 Confirm no `console.log` / debug prints left in `runs.js` / `engine.js` / `infra-detect.cjs`.
- [ ] 6.4 The prelude module writes a `aidakit-prelude:` diagnostic to stderr; verify it does NOT pollute a validator that runs cleanly (only fires inside the exception handler).

## How to verify manually (one-liner reproduction)

The original `validator-path-resolution` bug: a `node` validator whose `require()` cannot resolve its target exits 1 and gets caught by `on_failure`, spinning the flow. Under the new contract that exit becomes 250 → `runs_infra_error` → hard-stop.

Repro (from repo root, after §2 implementation lands):

```
mkdir -p /tmp/aidakit-infra-repro && cd /tmp/aidakit-infra-repro
cat > needs-missing.cjs <<'EOF'
require('./absolutely-not-here');
EOF
NODE_OPTIONS="--require=<repo>/governance/engine/prelude/infra-detect.cjs" node needs-missing.cjs
echo "exit: $?"
```

**Expected**: stderr contains `aidakit-prelude: infra error: MODULE_NOT_FOUND: …`, `exit: 250`.

**Before the fix**: the same command without `NODE_OPTIONS` exits with `1` and stderr is Node's default `Error: Cannot find module './absolutely-not-here'` — indistinguishable from a validator's legitimate `process.exit(1)` NO.

Second repro — full engine round-trip (after §2 lands):

```
cd <repo> && node -e "
import('./governance/engine/engine.js').then(({startFlow}) => {
  const flow = {
    flow: 'infra-repro', version: 1, steps: [
      { id: 'r', type: 'runs', command: 'node /tmp/aidakit-infra-repro/needs-missing.cjs', on_failure: 'never_taken' },
      { id: 'never_taken', type: 'terminal', outcome: 'aborted', message: 'this should NOT execute' },
    ],
  };
  const {status, state} = startFlow({flow, inputs: {}, startedBy: 'repro'});
  console.log('status:', status, 'outcome:', state.outcome);
  console.log('history:', state.step_history.map(h => h.step_id + ':' + h.result));
});
"
```

**Expected**: `status: failed`, `outcome: failed`, `history: ['r:infra_error']` — the `never_taken` step is NOT in the history. Log JSONL contains a `runs_infra_error` event with `exit_code: 250`.

**Before the fix**: `history` would contain `['r:failure', 'never_taken:success']` and the flow would end via the terminal step — masking the real infra error.
