# Brainstorm — `runs-error-routing`

Dispatched by `full-260724-da7f14` · brainstorm step. Agent: `aidakit:brainstorm`.

Tooling note: the dispatched agent was read-only (no `AskUserQuestion`), so no live owner grill was run inside the agent context. The axis analysis below is the ammunition-grounded adversarial substitute; the 3 open escalations were surfaced back to the owner in the main session via AskUserQuestion.

---

## Key finding from reading the engine

`governance/engine/engine.js:223-228` routes `kind:"fail"` (spawn error, e.g. `res.error` from `spawnSync`) through `step.on_failure` **if the step declares one** — the same target `kind:"next", outcome:"failure"` uses. The comment in `steps/runs.js` ("Failure to START the process… is an infra error — not a routable test that failed") is **aspirational, not enforced**.

And the bug that motivated this change — `Cannot find module` from a `node` validator — doesn't even reach `res.error`: bash and node both start fine, node's own `require()` throws inside the process, and the process exits with code 1, byte-for-byte indistinguishable from a validator's legitimate `process.exit(1)` verdict-NO.

**Two defects, not one:**
1. The router doesn't honor the fail/failure distinction it already has.
2. The detector doesn't exist yet for the `require()`-throws-exit-1 case.

## Assumptions (small/reversible, decided by the agent — owner correct as needed)

- Scope is `runs` steps only. `invoke` (agent/skill) dispatch has no process-spawn concept — out of scope here (mirrors how `agent-validator-paths` was split off from `validator-path-resolution` as its own debit).
- A validator killed by signal (`res.signal` set, `res.status === null` — SIGSEGV/SIGKILL/OOM) is unconditionally an infra error. No validator legitimately "judges NO" by crashing.
- `EACCES`/permission-denied invoking the command itself is unconditionally infra error, not a verdict.
- No automatic retry on infra-error detection — surface immediately. Matches the epic's "surfaces and interrupts" wording and fail-closed instinct.
- A dedicated log event (e.g. `runs_infra_error`, distinct from generic `step_end`) is emitted with `command`/`exit_code`/`signal`/`stderr` so `aidakit:learn` can later mine recurring infra defects — non-breaking addition, mirrors existing `logEvent` calls.

## Escalation resolutions (owner delegated Q1+Q2 to Claude, deferred Q3 to plan)

- **Q1 routing** → **(a) Always bypass `on_failure`**. Infra errors ALWAYS hard-stop/pause regardless of step config. Rationale: this epic's whole point is structural mechanism over opt-in doctrine (fewer knobs); precedent is ADR-009 choosing fail-closed structural fix over a knob. Adding `on_infra_error` later is a non-breaking additive change if a consumer flow ever needs it; the reverse is breaking. YAGNI.
- **Q2 detector** → **refined sentinel/wrapper, no stderr heuristics**:
  - POSIX signals treated as infra unconditionally by the engine: `res.status === 127` (command not found), `res.status === 126` (permission denied), signal-kill (`res.signal` set), `res.error` (spawnSync failure).
  - Node validators invoked through a `--require`d prelude that catches `uncaughtException` where `code === 'MODULE_NOT_FOUND'` / `ERR_MODULE_NOT_FOUND` / `require.resolve` ENOENT → remaps to reserved sentinel exit **250** → infra.
  - Explicitly reject stderr pattern-matching — kills false positives from validators whose legitimate output mentions "cannot find module" (e.g. asserting plugin absence).
  - Engine-side wrapper, zero call-site changes at consumers.
- **Q3 ambiguous fallback** → **deferred to plan**. With the Q2 detector the "ambiguous" bucket barely exists (all structural signals). Plan step will lock in "no structural signal matches → validator-failure, backward-compatible" as the default unless the plan surfaces a real edge that needs otherwise.

## Original open escalations (kept for audit trail)

### 1. Routing semantics (architecture+contract, ADR-worthy)

Fixing the router means picking one of:
- **(a)** Infra errors *always* bypass `on_failure` and hard-stop/pause regardless of what the step declares — a breaking behavior change for any flow that (even accidentally) relied on `on_failure` catching a `res.error` case.
- **(b)** A new sibling target (`on_infra_error`) flow authors wire explicitly, defaulting to hard-stop when absent.

Per ADR-003's placement boundary this is ADR-worthy — same treatment as ADR-004 and ADR-006 from this same epic.

### 2. Detection mechanism for the `Cannot find module` case

`res.error` doesn't catch it. Real options, each with a real cost:
- **Stderr pattern-matching** on known infra signatures — fast but heuristic/fragile, risks false positives if a validator legitimately prints matching text. Itself doctrine-in-prose-shaped.
- **Sentinel exit-code / wrapper convention** — structural (per the epic's "never doctrine in prose"), but retrofits a new authoring contract onto every existing validator (10+ call sites per `validator-path-resolution`'s inventory) and is consumer-facing since `.aidakit/flows/*.yaml` authors inherit it.
- **JSON status envelope** — most structural, heaviest migration.

### 3. Ambiguous-signal default

When the chosen detector can't confidently classify, does the engine default to:
- **Validator-failure** (today's behavior, backward-compatible), or
- **Infra-error** (fail-closed: "on doubt it blocks")?

Depends on which option #2 lands on.

## Acceptance criteria (only the parts independent of the open escalations)

- A signal-killed validator (`res.signal` set) never enters the `on_failure` correction loop — always surfaces as an interrupted flow naming the signal and trailing stderr.
- A `runs` step whose command can't even spawn (`res.error`) never silently loops via `on_failure` even when the step declares one — regression closing the `engine.js:223-228` gap.
- The specific `Cannot find module` case from `docs/archive/2026-07-23-validator-path-resolution/` is mechanically caught and surfaces the real error instead of exhausting the on_failure loop.
- The routing/detection decision lands in a new ADR (precedent: ADR-004, ADR-006, ADR-009) since it changes the `runs`/`on_failure` contract for every kit-shipped and consumer-authored flow.
- `governance/__tests__/engine.test.mjs` gains coverage for: signal-crash, spawn-failure-with-`on_failure`-declared, and the require-failure/exit-1 case under whichever detector is chosen.
- `fast.yaml`/`full.yaml`/`docs-onboarding.yaml` audited for any `runs` step whose `on_failure` target assumed it also caught infra errors, updated if the routing change affects it.

## Relevant paths read

- `governance/engine/steps/runs.js`
- `governance/engine/engine.js` (esp. lines 223-228)
- `governance/engine/types.js`
- `docs/decisions/ADR-006-flow-values-as-data.md`
- `docs/decisions/ADR-004-aidakit-governance-env-contract.md`
- `docs/archive/2026-07-23-validator-path-resolution/proposal.md` (non-goal 1 is the direct source of this change)
- `docs/roadmap/epics/EPIC-flow-engine-leashes.md`
- `GOVERNANCE.md`
- `aidakit.config.yaml`

## Event summary

```
outcome: done
questions_asked: 0 (agent-side; owner grill on 3 escalations happens in the main session)
assumptions: 5 (see above)
acceptance_criteria: 6
open_escalations: 3 (routing semantics · detection mechanism · ambiguous-signal default)
```
