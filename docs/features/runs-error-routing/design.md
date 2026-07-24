# Design — runs-error-routing

**Change ID:** `runs-error-routing`
**Date:** `2026-07-24`
**Owner:** `@chacal88`
**Phase / Package:** `n/a (governance/engine)`
**PRD:** `n/a`
**Tech Spec:** `n/a`

## Scope

Modify the `runs` step + engine router so **infrastructure errors** (command not found, permission-denied, signal-kill, spawn failure, Node `require()` failure) are classified as a first-class outcome kind — `infra` — that ALWAYS bypasses `step.on_failure` and hard-stops the flow. Validator-verdict semantics (exit 0 = success, exit≠0 with no infra signal = failure) are preserved.

## Exit-code taxonomy the engine applies

The classifier in [`governance/engine/steps/runs.js`](../../../governance/engine/steps/runs.js) inspects `spawnSync`'s result in this order — first match wins. All conditions are **structural**; no stderr pattern-matching (rejected in [brainstorm.md §"Q2 detector"](brainstorm.md)):

| Signal | Meaning | Route |
|---|---|---|
| `res.error` truthy | spawnSync failed to start the child (nonexistent `bash`, ENOENT on the shell) | `infra` |
| `res.signal` truthy (`res.status === null`) | child killed by signal — SIGKILL, SIGSEGV, SIGTERM, OOM | `infra` |
| `res.status === 127` | POSIX "command not found" — bash executed but couldn't find the command | `infra` |
| `res.status === 126` | POSIX "permission denied" invoking the command (`chmod -x`) | `infra` |
| `res.status === 250` | Reserved sentinel emitted by the Node prelude on `MODULE_NOT_FOUND` / `ERR_MODULE_NOT_FOUND` / `require.resolve` ENOENT (see §"The Node prelude") | `infra` |
| `res.status === 0` | validator judged YES | `next / success` |
| any other exit (`1`, `2`, `3`, …, `125`, `128–255`) | validator judged NO | `next / failure` |

**Why 250:** POSIX reserves 128 + N for signal exits (128–165); shells use 126–128 for permission/not-found; 250 is safely outside those ranges AND outside the 1–125 "normal application error" band. Documented in ADR-011. Consumer flows that legitimately want to reserve their own exits above 250 are free to; nothing else in the kit uses ≥250.

**Ambiguous case (Q3, deferred to plan):** when none of the infra signals match, the classifier returns validator-failure (exit≠0 → `outcome:"failure"`), preserving today's routing via `on_failure`. Locked here — the detector is high-confidence so ambiguous cases are rare by construction; changing this default to fail-closed would break every shipped `on_failure` retry loop with no benefit the structural signals don't already provide.

## The Node prelude module

**Location:** `governance/engine/prelude/infra-detect.cjs` (new file, ~30 lines, CommonJS).

**Why CommonJS:** Node's `--require` flag only accepts CJS modules; ESM loading pre-boot uses `--import` (Node ≥ 20.6), which is not yet universally available in the plugin's install matrix. `.cjs` is universally supported and the prelude is a one-shot init module — no ergonomic loss.

**Body sketch (design shape, not code):**

- On load, install `process.on('uncaughtException', handler)`.
- `handler(err)` inspects `err.code`. Matches `'MODULE_NOT_FOUND'`, `'ERR_MODULE_NOT_FOUND'`; also `err.code === 'ENOENT'` when the stack frame comes from `require.resolve` / internal loader (`err.requireStack` present or `err.stack` mentions `resolve`).
- On match: write a single-line diagnostic to stderr (`aidakit-prelude: infra error: <code>: <message>`) and `process.exit(250)`.
- On miss: `throw err` — do NOT swallow arbitrary uncaught exceptions; only the two module-resolution shapes remap.
- Idempotent (safe if the module is required twice by nested `NODE_OPTIONS`).

**Injection mechanism:** `executeRuns` in [`governance/engine/steps/runs.js:29`](../../../governance/engine/steps/runs.js) currently sets `env = { ...process.env, ...vars, AIDAKIT_GOVERNANCE }`. Add:

```
NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --require=${preludePath}`.trim()
```

where `preludePath` is resolved once at module scope via `import.meta.url`, same idiom as `AIDAKIT_GOVERNANCE` ([ADR-004](../../decisions/ADR-004-aidakit-governance-env-contract.md)):

```
const AIDAKIT_PRELUDE = resolve(dirname(fileURLToPath(import.meta.url)), "..", "prelude", "infra-detect.cjs");
```

**Alternatives considered and rejected:**

- **Argv rewrite** (parse `command`, prepend `--require` to every `node` invocation). Fragile: commands can be `some-cli && node …`, `env FOO=bar node …`, or shell-piped; a parser would have to understand bash. `NODE_OPTIONS` is one string, universally honored by every child `node`.
- **Fresh spawn shape** (skip `bash -lc` and spawn `node` directly). Breaks the entire shipped-flow idiom — commands rely on shell features (`&&`, `||`, `test`, quoting, `$AIDAKIT_GOVERNANCE` expansion).
- **Wrap validators individually with a helper import.** Retrofits a call-site contract onto every kit-shipped validator (10+ sites per [`validator-path-resolution` inventory](../../archive/2026-07-23-validator-path-resolution/)) AND every consumer validator. NODE_OPTIONS reaches all `node` children with zero call-site changes.

**Precedence note (consumer inheritance):** the `NODE_OPTIONS` injection preserves any inherited value by appending to `process.env.NODE_OPTIONS`, so a consumer that sets `NODE_OPTIONS=--experimental-vm-modules` for their own reasons still gets it, plus the kit's prelude. Same precedence philosophy as `AIDAKIT_GOVERNANCE` (engine appends, doesn't clobber).

## Router change in `engine.js`

**Chosen shape:** add a NEW outcome kind `"infra"`, handled BEFORE the existing `kind:"fail"` block in [`governance/engine/engine.js:223-228`](../../../governance/engine/engine.js).

**Why a new kind (not a flag on `kind:"fail"`):**

- Explicit > flag. Reading the router switch, `if (outcome.kind === "infra") { hard-stop, log runs_infra_error, no on_failure lookup }` is self-documenting; `if (outcome.kind === "fail" && outcome.infra) { … } else { … }` hides the semantics one indirection deeper.
- Cleaner impact on `outcomeKey` at [`engine.js:320-325`](../../../governance/engine/engine.js): `if (o.kind === "infra") return "infra_error"` is one line. Overloading `kind:"fail"` would force branch-in-a-branch there too.
- The `dispatch` catch-all at [`engine.js:187-191`](../../../governance/engine/engine.js) that produces `{kind:"fail", …}` for thrown exceptions stays untouched (an unknown-step-type or module-load-time crash inside the engine is a **different** class of error from a validator's spawn result — those still go through `on_failure` if declared; the router change is scoped to `runs` outcomes).
- `types.js` `StepOutcome` typedef gains one union member — small doc change; the JSDoc-only contract has no compile-time cost.

**Concrete insertion point** (immediately before line 223, `if (outcome.kind === "fail") { … }`):

```
if (outcome.kind === "infra") {
  logEvent(state.flow_id, {
    event: "runs_infra_error",
    step_id: step.id,
    command: outcome.output?.command,
    exit_code: outcome.output?.exit_code,
    signal: outcome.output?.signal,
    stderr: (outcome.output?.stderr ?? "").slice(-2000),
  });
  state.status = "failed";
  state.outcome = "failed";
  state.finished_at = new Date().toISOString();
  saveState(state);
  logEvent(state.flow_id, { event: "flow_end", outcome: "failed", error: outcome.error });
  return { status: state.status, state };
}
```

The `step_history` entry for this step is written above (line 196-206) with `result: outcomeKey(outcome)` → `"infra_error"`. **Also required — extend the `history.error` ternary at [`engine.js:204`](../../../governance/engine/engine.js).** Today the line reads `error: outcome.kind === "fail" ? outcome.error : undefined`, which would leave the `kind:"infra"` history entry with `error: undefined` even though `outcome.error` carries the classifier's full triage string ("runs infra error: exit 127; stderr: …"). Change it to:

```
error: outcome.kind === "fail" || outcome.kind === "infra" ? outcome.error : undefined,
```

So `state.step_history[last].error` mirrors the `runs_infra_error` event's `stderr`/exit summary and satisfies the "state file gives the human every triage field" contract stated below. History + event log + `state.step_history[last].error` all preserve the classification.

## Interrupt semantics — hard-stop, not synthetic human_gate

**Chosen semantic:** `state.status = "failed"`, `state.outcome = "failed"`, no resume record, error message names exit code / signal / trailing stderr. Flow ends.

**Why not a synthetic `human_gate` pause with triage options:**

- Adds engine surface (a synthesized `PauseInfo` with `step_type:"human_gate"` that no YAML step authored) — creates a code path the parser cannot validate, and a resume grammar (`resume <flow_id> abort|retry|skip`) that couples the engine to specific triage verbs.
- The state file plus the `runs_infra_error` event give the human every field they need to triage manually. A new `start` (with `--resume-from` if that's ever built) is the honest resume path — not a synthesized gate.
- Matches the brainstorm's "surface immediately, no retry" and fail-closed instinct.
- Matches [ADR-009](../../decisions/ADR-009-flow-commits-plan-early.md) precedent: prefer structural mechanism (hard-stop) over knob (choose-your-triage gate).

**Consequence:** a flow that dies to infra loses its in-progress in-memory state. It's recoverable from `state.json` + `step_history` + the new `runs_infra_error` event. Accepted; the alternative (synthesizing an unauthored gate) is worse.

## The `runs_infra_error` log event shape

Non-breaking addition to `logEvent` ([`governance/engine/persistence.js:77`](../../../governance/engine/persistence.js)). Emitted exactly once per infra classification (right before the `flow_end` event that closes the flow):

```
{
  at: "<ISO-8601>",
  event: "runs_infra_error",
  step_id: "<step id from YAML>",
  command: "<rendered bash command, with $AIDAKIT_VAR_n references per ADR-006>",
  exit_code: <number | null>,           // res.status
  signal: "<string | null>",            // res.signal
  stderr: "<last 2000 chars of stderr>",
}
```

Fields are chosen to satisfy `aidakit:learn`'s mining needs (recurring infra defect = same `exit_code` + similar `stderr` prefix across flow runs) without leaking `vars` values (which may contain change-ids or paths already visible in `command` via `$AIDAKIT_VAR_n` references — the values themselves stay in the state file's `output.vars` for authorized debugging).

## Backward compatibility — flow audit

Every `on_failure` in the shipped flows was inspected. Verdict: **none depends on catching infra errors**; the routing change is safe for the shipped flows.

**`governance/flows/fast.yaml` (12 `on_failure` sites — verified with `grep -c on_failure governance/flows/fast.yaml`)** — all target either `aborted` (terminal), a prior invoke step (e.g. `on_failure: select`, `on_failure: implement`), or `document`/`review` retry cycles. Every one assumes the target is being asked to correct a validator-detected NO. None inspects the failing step's error text.

**`governance/flows/full.yaml` (17 `on_failure` sites)** — same pattern. Notable: `on_failure: critic` at line 122 (the `commit_plan` step from [ADR-009](../../decisions/ADR-009-flow-commits-plan-early.md)) — best-effort commit that routes both success and failure to `critic`. Under the new contract, if `git commit` returns 127 (git missing) that flow will hard-stop instead of falling through to `critic`. **Correct new behavior** — a machine without `git` is an infra problem the human must see, not a step to silently skip.

**`governance/flows/docs-onboarding.yaml` (5 `on_failure` sites)** — mostly `on_failure: aborted` (terminal) or `on_failure: propose` / `on_failure: apply` retry loops. Same pattern. Safe.

**`governance/flows/design.yaml`** — no `on_failure` beyond `aborted`. Trivially safe.

**Consumer flows (out of scope for edits, in scope for the ADR consequences section):** any `.aidakit/flows/*.yaml` that relied on `on_failure` catching a spawn-error would now hard-stop. Documented in ADR-011 as the "consumer flows breaking-change surface"; the mitigation is that no shipped kit example ever suggested that idiom, so consumers are unlikely to have written it.

## Freeze — naming conventions and evidence location

- **New outcome kind:** `"infra"` (singular, lower-case, matches existing `"next"|"pause"|"fail"|"terminal"` style).
- **New history result:** `"infra_error"` (snake_case, matches existing `"max_visits_exceeded"` from [`engine.js:161`](../../../governance/engine/engine.js)).
- **New log event:** `"runs_infra_error"` (namespaced by step type, matches existing `"step_start"`/`"step_end"`/`"step_max_visits_exceeded"` pattern).
- **Sentinel exit code:** `250` (documented in ADR-011; not reserved for anything else in the kit).
- **New env var:** none — `NODE_OPTIONS` is a standard Node variable, not a kit-specific name (unlike `AIDAKIT_GOVERNANCE` / `AIDAKIT_VAR_n`).
- **New file paths:** `governance/engine/prelude/infra-detect.cjs` (new dir `prelude/` under `engine/`).
- **Evidence location:** [`docs/features/runs-error-routing/evidence.md`](evidence.md) — records the manual repro of the original `validator-path-resolution` bug + the full test-suite output.

## Rollback

Single-commit revert restores the prior behavior — the change is additive at every touch point:

- Removing the `if (outcome.kind === "infra")` clause in `engine.js` restores old routing.
- Removing the classifier in `runs.js` returns to `{kind:"next", outcome:"failure"}` for any exit≠0.
- Removing the `NODE_OPTIONS` injection makes the prelude module a dead file; deleting `prelude/` is optional cleanup.

No state file migration needed — flows that ran under the new contract and completed successfully never populated any new field; flows that hit an infra hard-stop failed with a specific event that can be re-triaged manually.

## Alternatives considered (summary — full detail in ADR-011)

| Option | Pros | Cons | Cost to undo |
|---|---|---|---|
| **New `kind:"infra"` outcome + Node prelude via NODE_OPTIONS (chosen)** | Structural, zero call-site changes at validators, self-documenting router, minimal engine.js delta | Adds one new outcome kind (small typedef change) | low |
| Extend `kind:"fail"` with `infra:true` flag | Fewer new symbols | Router logic hides semantics behind a boolean; branch-in-branch in `outcomeKey`; less scannable | low |
| Add `on_infra_error` sibling target per step | Consumer flow can catch it | Adds knob doctrine; every shipped flow would need auditing whether to declare it; opposite of ADR-009 spirit | medium |
| Stderr pattern-matching for "cannot find module" | Fast to implement | Doctrine-in-prose; false positives on validators that legitimately assert absence; fragile across Node versions | low |
| Wrap every validator individually with a helper import | Explicit at call site | Retrofits contract onto every kit-shipped + consumer validator; NODE_OPTIONS reaches them all for free | high |
| Synthetic `human_gate` on infra with retry/abort/skip options | Preserves the run for triage | Adds unauthored PauseInfo, couples engine to triage verbs, more surface than the state.json + event log already give | medium |
