<!-- File: docs/decisions/ADR-011-runs-infra-error-routing.md — global sequential numbering, never recycled. Registered in the index docs/decisions/README.md. -->
<!-- An ADR is WORM: never edit a past decision. Changed your mind → a new ADR that supersedes or amends this one. -->

# ADR-011: The `runs` step separates infra errors from validator verdicts, and infra always bypasses `on_failure`

- **Status:** accepted
- **Date:** 2026-07-24

## Context

The `runs` step classifies every exit≠0 as `outcome:"failure"` and lets [`governance/engine/engine.js:223-228`](../../governance/engine/engine.js) route it via `step.on_failure`. That collapses two very different signals into one — a validator's legitimate NO (exit 1 = "this test judged your code failed") and an infrastructure error the validator never got to weigh in on (missing shell command, permission denied, killed by signal, `require()` failed to resolve a Node module). Under the shipped flows every `on_failure` target sends the flow back to a prior step to correct the code, so an infra error becomes a silent retry loop — the archived change [`validator-path-resolution`](../archive/2026-07-23-validator-path-resolution/proposal.md) surfaced this concretely: `node governance/validators/x.js` failed to resolve `governance/` in a consumer repo, Node exited 1, the flow entered a `implement`/`review_bench` correction loop and burned rounds trying to fix code that had nothing to do with the actual defect.

This ADR pairs with the change `runs-error-routing` — see the planning artifacts at [`docs/features/runs-error-routing/proposal.md`](../features/runs-error-routing/proposal.md) and [`docs/features/runs-error-routing/design.md`](../features/runs-error-routing/design.md) for the concrete deliverables the decision authorizes.

The comment in [`governance/engine/steps/runs.js:52-54`](../../governance/engine/steps/runs.js) had claimed for months that spawn failures were "an infra error — not a routable test that failed", but nothing in the engine enforced it. And the concrete `require()`-throws-exit-1 case never even reached the `res.error` field the comment referred to — Node bash-started fine, Node itself exited 1 after the module resolution failed.

Per [ADR-003](ADR-003-shared-knowledge-in-docs.md)'s placement boundary, a routing + detection contract change with rejected alternatives and consumer-facing consequences is a decision, not only an implementation detail; the same treatment [ADR-004](ADR-004-aidakit-governance-env-contract.md) received for `AIDAKIT_GOVERNANCE`.

## Decision

**1. Infra errors are a first-class outcome kind and always hard-stop the flow.** [`governance/engine/steps/runs.js`](../../governance/engine/steps/runs.js) classifies the `spawnSync` result via **structural signals only** — no stderr pattern-matching:

- `res.error` truthy (`spawnSync` failed to start the child),
- `res.signal` truthy / `res.status === null` (child killed by signal — SIGKILL / SIGSEGV / OOM / SIGTERM),
- `res.status === 127` (POSIX "command not found"),
- `res.status === 126` (POSIX "permission denied invoking the command"),
- `res.status === 250` (reserved sentinel, see §2 below).

Any of these → `{kind:"infra", error, output}`. `engine.js` has a new clause BEFORE the existing `kind:"fail"` block: on `kind:"infra"` it emits a `runs_infra_error` log event (with `command`, `exit_code`, `signal`, tail of `stderr`), sets `state.status = "failed"` / `state.outcome = "failed"`, and returns — **regardless of whether the step declared `on_failure`**. The `on_failure` lookup is not performed for infra outcomes.

**2. Node `require()` failures are remapped to exit 250 by an engine-owned prelude.** `executeRuns` injects `NODE_OPTIONS=--require=<AIDAKIT_PRELUDE>` into every `runs` child's env, where `AIDAKIT_PRELUDE` resolves at module scope from `import.meta.url` to [`governance/engine/prelude/infra-detect.cjs`](../../governance/engine/prelude/infra-detect.cjs) (same self-locating idiom as `AIDAKIT_GOVERNANCE` — [ADR-004](ADR-004-aidakit-governance-env-contract.md)). The prelude installs an `uncaughtException` handler that inspects `err.code`; on `MODULE_NOT_FOUND` / `ERR_MODULE_NOT_FOUND` (and `ENOENT` when `err.requireStack` is present) it writes a one-line `aidakit-prelude:` diagnostic to stderr and calls `process.exit(250)`. Every other uncaught exception is re-raised untouched — the prelude only remaps the two module-resolution shapes. Injection preserves any inherited `NODE_OPTIONS` (append, don't clobber) — same "engine extends, doesn't shadow" precedence as `AIDAKIT_GOVERNANCE`.

**Sentinel 250 is chosen because** POSIX reserves 128+N for signal exits (128–165), shells use 126–128 for permission / not-found, and 1–125 is the "normal application error" band — 250 sits safely outside all three. Nothing else in the kit uses ≥250; consumer validators are free to reserve their own high exits, but any consumer that ships an intentional `process.exit(250)` will be misread as infra. Documented consequence.

**3. Bash-only `runs` steps (no `node` in the command) keep POSIX-signal-only detection.** The Node prelude only wraps `node` sub-invocations — a step running `test -n "${x}" && …` never loads the prelude, so its exit codes are interpreted purely by the POSIX table above. Pure-bash validators never `require()` anything, so the sentinel path is not relevant.

**4. Ambiguous cases default to validator-failure.** When none of the structural signals match, any exit≠0 remains `outcome:"failure"` and routes via `on_failure` — today's behavior. Locked to preserve backward compatibility for every shipped `on_failure` retry loop; the detector is high-confidence so ambiguous cases are rare by construction. No fail-closed default here.

## Consequences

- Positive: the infra-vs-verdict class dies mechanically for every `runs` step — kit-shipped and consumer-authored — with zero call-site changes at validators; the flow never again silently loops on a missing module / missing command / crashed validator; `aidakit:learn` gains a first-class `runs_infra_error` event to mine recurring infra defects; the `runs.js:52-54` aspirational comment becomes enforced behavior.
- Negative:
  - Infra errors hard-stop rather than pause for triage — the operator loses the mid-flow resume path and must inspect `state.json` + `step_history` + the `runs_infra_error` event to triage — **Accepted** (matches the "surface immediately, no retry" instinct; the alternative — a synthesized `human_gate` — would add unauthored engine surface and couple the resume grammar to triage verbs, worse tradeoff).
  - A consumer flow that legitimately catches a spawn error via `on_failure` today (idiom never suggested by any kit example, no shipped flow uses it) will silently start hard-stopping instead — **Accepted** (the new behavior is the point; migration note: replace with an explicit `runs` step whose `on_success` checks for a known-good precondition, then let the following step fail loudly).
  - `NODE_OPTIONS` joins `AIDAKIT_GOVERNANCE` and `AIDAKIT_VAR_n` ([ADR-006](ADR-006-flow-values-as-data.md)) as engine-set names in the `runs` child env; a per-step `env:` entry could still shadow it (no shipped step does) — **Accepted** (documented; the append preserves any inherited value).
  - The prelude runs in every `runs` step, even those with no `node` invocation — the process boot cost is a few ms per shell command — **Mitigated** (the prelude is loaded by `node` children only, not by bash itself; `NODE_OPTIONS` is only honored by `node`; pure-bash steps pay zero overhead).
  - A validator that intentionally uses `process.exit(250)` for its own semantics is misread as infra — **Accepted** (documented reservation; no kit validator does this; a consumer that wants to use 250 must be aware).
  - The prelude only reaches `node` children of `runs` steps — agent/skill Bash sessions that invoke `node` validators directly (`agents/orchestrator.md`, `agents/doc-planner.md`, `skills/roadmap/SKILL.md`) carry the same latent defect via a different vector — **Mitigated** (same non-goal boundary as [ADR-004](ADR-004-aidakit-governance-env-contract.md); tracked by the `agent-validator-paths` debit in [EPIC-flow-engine-leashes](../roadmap/epics/EPIC-flow-engine-leashes.md), needs its own mechanism).

### Review trigger

If a real consumer flow needs to catch infra errors selectively (rather than hard-stop), amend this ADR with the `on_infra_error` sibling-target extension (additive, non-breaking) — do not loosen the always-bypasses-`on_failure` rule in place. Likewise if the sentinel exit 250 ever collides with a validator that legitimately needs to use it, widen the detection contract (e.g. a JSON envelope on a dedicated fd) in a new ADR rather than shifting the sentinel to another arbitrary number.

## Alternatives considered

| Option | Pros | Cons | Cost to undo |
|---|---|---|---|
| **New `kind:"infra"` outcome + Node prelude via NODE_OPTIONS (chosen)** | Structural, zero call-site changes at validators, self-documenting router, minimal engine.js delta, sentinel reaches every `node` child transparently | Adds one new outcome kind + one new sentinel exit code convention | low |
| Extend `kind:"fail"` with `infra:true` boolean flag | Fewer new symbols in the outcome union | Router logic hides semantics behind a boolean; branch-in-branch in `outcomeKey`; less scannable; overloads the pre-existing meaning of `kind:"fail"` (which today is used for `dispatch` catch-all crashes and step-not-found — a different failure class) | low |
| Add `on_infra_error` sibling target per step | Consumer flow can catch it if it wants to | Adds knob doctrine; every shipped flow would need auditing whether to declare it; opposite of [ADR-009](ADR-009-flow-commits-plan-early.md)'s "structural mechanism over opt-in doctrine" spirit; deferrable as an additive amendment if a real need surfaces | medium |
| Stderr pattern-matching for "cannot find module" | Fast to implement, no prelude needed | Doctrine-in-prose; false positives on validators that legitimately assert absence (e.g. a plugin-presence check whose FAIL message mentions "cannot find module"); fragile across Node versions and locale settings; the epic's whole thesis is structural mechanism over prose heuristics | low |
| Wrap every validator individually with a helper import (`require('@aidakit/infra-detect')`) | Explicit at call site; no environment inheritance | Retrofits a contract onto every kit-shipped validator (10+ sites per [`validator-path-resolution` inventory](../archive/2026-07-23-validator-path-resolution/)) AND every consumer validator; `NODE_OPTIONS` reaches all `node` children (including recursively spawned ones) for free with zero call-site work | high |
| Argv rewrite (parse the `command` string and prepend `--require=…` to every `node` invocation) | No env indirection | Requires a bash-command parser: commands can be `some-cli && node …`, `env FOO=bar node …`, shell-piped, or hidden behind aliases; `NODE_OPTIONS` is one string universally honored by every `node` child regardless of how it was invoked | medium |
| Fresh spawn shape (skip `bash -lc` and spawn `node` directly for node-based validators) | No `NODE_OPTIONS` needed | Breaks the entire shipped-flow idiom — commands rely on shell features (`&&`, `||`, `test`, quoting, `$AIDAKIT_GOVERNANCE` expansion); would need per-command shape detection; enormous surface change | high |
| Synthetic `human_gate` on infra with `abort` / `retry` / `skip` triage options | Preserves the run for triage; matches the epic's "surfaces AND interrupts" wording | Adds unauthored `PauseInfo` shape that the parser cannot validate; couples engine to specific triage verbs; more surface than the `state.json` + `runs_infra_error` event log already give an operator; the operator can start a fresh run manually with the corrected environment | medium |
| Sentinel exit code other than 250 (e.g. 199, 42, 240) | Any choice works technically | 250 sits above the POSIX signal band (128–165) and shell reservations (126–128) with the widest headroom before 255; documented rationale beats arbitrary alternatives | trivial |
