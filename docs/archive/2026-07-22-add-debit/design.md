# Design — add-debit

**Change ID:** `add-debit`
**Date:** `2026-07-22`
**Owner:** `@chacal88`
**Phase / Package:** `n/a (fast flow — small reversible engine-surface change)`
**PRD:** `n/a`
**Tech Spec:** `n/a`

## The form decision (the open assumption, resolved)

**Chosen: a `mode` enum input on the existing `fast` flow (`build` | `register`, default `build`), with the registration intelligence staying in `aidakit:roadmap` (dispatched by `/aidakit:build` BEFORE `start`) and the flow contributing only the deterministic half: a route, a leash, and a park.** The register path in `fast.yaml` is `route_mode → check_registered → parked`, and `parked`'s `plan` option routes into the existing `select` — so a later resume continues down the very same pipeline the manual dry-run continued down.

Grounding in the engine code, per rejected alternative:

- **New CLI verb (`cli.js register`) — rejected.** `governance/cli.js` is generic flow lifecycle (`start|resume|status|abort|list`); a `register` verb would embed change-specific semantics in the engine surface. Worse: registration needs judgment (which epic, what acceptance line, collision questions) — that is an `invoke`, and the engine constitutionally never dispatches skills (inversion of control, `governance/README.md`). A deterministic JS re-implementation of the epic-line writer would fork `aidakit:roadmap`'s logic. The CLI stays generic; `start fast … mode=register` already expresses the verb.
- **Dedicated `register.yaml` flow — rejected.** A separate flow that completes leaves **no parked resumable flow** — the acceptance requires `resume` to *continue into planning*, and `resumeFlow` (`governance/engine/engine.js`) refuses non-`paused` states. Parking it forever at a gate whose continuation is the build pipeline would require duplicating fast.yaml's entire graph after the gate (fork maintenance for zero gain).
- **Park raw at `select` (the manual dry-run's literal form) — rejected as-is.** It works (flow `fast-260722-8e7af2` proves it) but the state is dishonest: the pause is an active dispatch instruction ("Dispatch skill/agent: aidakit:orchestrator"), not a named debit; and nothing verified the roadmap entry actually landed — the dry-run relied on hand discipline. The `parked` human_gate names the state (`status` shows `paused at: parked (human_gate)`; parked debits are greppable by `"step_id": "parked"`), and `check_registered` makes the registration mechanical.
- **Register `invoke` step inside the flow, started with the free-form sentence — rejected structurally.** `startFlow` freezes `inputs`; an in-flow minted id could never replace `inputs.request` (an invoke's resume carries only an outcome token — `governance/engine/steps/invoke.js` persists just `outcome` + `invoke_target`). Every downstream `${inputs.request}` path (`.aidakit/tasks/…/bench.ndjson`, `doc-manifest.json`) would carry the raw sentence — exactly the pollution the dry-run flagged. Minting must precede `start`.

## The register path in `fast.yaml` (concrete)

New input:

```yaml
  - name: mode
    type: enum
    values: [build, register]
    default: build
    description: build = the full pipeline; register = park a debit (roadmap entry + paused flow), no plan/implement.
```

`startFlow` already validates enums and applies defaults (`governance/engine/engine.js`), so an invalid mode fails at start and old invocations are untouched.

New steps — `route_mode` becomes the **first** step in the list (fast.yaml declares no `entry`, so the first step is the entry, per `startFlow`):

```yaml
  - id: route_mode
    type: runs
    description: Routes by mode. register → verify + park; build (default) → the existing pipeline, unchanged.
    command: "test \"${inputs.mode}\" = register"
    on_success: check_registered
    on_failure: select

  - id: check_registered
    type: runs
    description: |
      REGISTRATION LEASH — the flow refuses to park an id the roadmap does not
      declare. Also structurally rejects a raw free-form sentence leaking into
      request (a sentence never matches a declared kebab-case change-id), which
      is what keeps ${inputs.request} paths clean downstream.
    command: "node governance/validators/derive-roadmap-status.js --change ${inputs.request}"
    on_success: parked
    on_failure: aborted

  - id: parked
    type: human_gate
    description: THE PARK — a registered debit. Resumable across sessions; nothing runs until resumed.
    prompt: |
      Debit registered: "${inputs.request}" is declared on the roadmap (backlog)
      and this flow is PARKED. Nothing is planned or implemented until you resume.
        plan    → continue into planning (select → plan → …)
        discard → abort this parked flow (the roadmap entry stays declared)
    options:
      - plan
      - discard
    on_result:
      plan: select
      discard: aborted
```

`select` onward is untouched. The build path costs one extra `runs` step (`test "build" = register`, exit 1 → `on_failure: select` — the same exit-code-routing idiom as `review_outcome` and full.yaml's `dna_gate`). Runs steps never pause, so the existing pause-order test (`engine.test.mjs` §2, `visited`) is unaffected. Note the interpolation grammar: `${...}` in `command`/`prompt` (the expression trap, `governance/README.md`).

## The `--change` flag (deterministic leash half)

- `governance/roadmap/roadmap.js` — new exported pure helper, reusing `collectEpics` + `parseEpic` (no forked parse; `FEATURE_RE` remains the single grammar):

  ```js
  /** Finds the epic/feature that declares changeId. @returns {{epic:string, feature:string}|null} */
  export function findDeclaredChange(changeId, root = projectRoot())
  ```

- `governance/validators/derive-roadmap-status.js` — `--change <id>`: short-circuits before any git/gh spawn (declared-ness is pure epic parsing; no status needed), prints `{ validator, ok, change: { id, declared, epic, feature } }` on stdout, exits 0 (declared) / 1 (not declared) / 2 (missing value) — the house validator contract.

The engine's `runs` step spawns with `cwd = projectRoot()` (`governance/engine/steps/runs.js`) and the validator resolves root via `AIDAKIT_PROJECT_ROOT || cwd`, so the command needs no `--root` in real runs and works under the test harness's symlinked-governance tmp root unchanged.

## Context preservation (why resume needs no re-explanation)

Coordination is through versioned artifacts, never chat memory (GOVERNANCE.md §6):

1. **The epic feature line** (`- **Feature:** <name> — changes: <id>` + the one-line acceptance sub-bullet) is the durable request context — written by `aidakit:roadmap` register mode, versioned, exactly what the dry-run's `add-debit` line proved sufficient for a later planner. If the request is too rich for a feature line + acceptance bullet, register is the wrong tool — plan it now (recorded as a boundary in `commands/build.md`).
2. **The parked state** (`.aidakit/flows/state/<flow_id>.json`) carries `inputs.request` = the change-id, and `context.check_registered.stdout` = the validator JSON naming the declaring epic + feature (the `runs` executor persists its output under `context[step.id]`).
3. **On resume** (`resume <flow_id> plan`), `parked` routes to `select`; the orchestrator's protocol already runs `derive-roadmap-status.js` and confirms an id-carrying request instead of selecting (`agents/orchestrator.md` §3.2); `plan` receives `request: <change-id>` via the existing `${inputs.request}` input.

## Who writes what (no forked logic)

| Concern | Owner | Mechanism |
|---|---|---|
| Mint the kebab-case change-id from free-form (single key, DOCS.md §2.7) | `aidakit:roadmap` register mode | judgment — skill |
| Write the epic feature line + acceptance sub-bullet; create the epic (proposing first) when `docs/roadmap/epics/` is absent | `aidakit:roadmap` register mode | reuses the existing `add-feature` writer path |
| Regenerate `ROADMAP.md` | `aidakit:roadmap` `regen` | existing mode, unchanged |
| Verify the entry landed | `check_registered` (runs) | `derive-roadmap-status.js --change` |
| Park + resume | the engine | existing human_gate pause/resume, zero engine-core change |
| Sequence it all for the user | `/aidakit:build` (`commands/build.md`) | register verb: pre-check parked flows → dispatch roadmap register → `start fast request=<id> mode=register` → report `flow_id` + change-id |

Status remains derived-only ([ADR-002](../../decisions/ADR-002-roadmap-status-derived-from-disk.md)): register writes **no** status anywhere; the entry is `backlog` because nothing exists on disk, and flips to `in-progress` only when planning creates `docs/features/<id>/`.

## Failure modes

| Failure | Handling | Where |
|---|---|---|
| change-id collision (id already declared in an epic, or already has `docs/features/<id>/` / an archive dir) | register mode refuses and asks the owner (extend vs rename) — judgment, per the planner's own unique-key rule | `skills/roadmap/SKILL.md` |
| roadmap file/dir absent | register mode proposes + creates the epic; if `start … mode=register` runs without the registration landing, `check_registered` exits 1 → terminal `aborted`, nothing parked | skill + leash |
| flow already parked for the same id | `/aidakit:build` pre-checks `.aidakit/flows/state/*.json` for a paused flow with `pause.step_id: "parked"` and the same `inputs.request` → resumes it instead of double-parking. The engine intentionally does not dedupe (flow_ids are unique by design, `persistence.js`) | `commands/build.md` |
| free-form sentence reaches `start` as `request` | `check_registered` can only pass for a declared id → `aborted`; the path-pollution lesson is prevented structurally, not by discipline | leash |
| invalid resume value at `parked` | human_gate re-pauses on an invalid option (`governance/engine/steps/human-gate.js`) — existing behavior, free | engine |

## Constraining ADRs

[ADR-002](../../decisions/ADR-002-roadmap-status-derived-from-disk.md) constrains the whole shape (derived-only status; single key; `ROADMAP.md` generated). [ADR-001](../../decisions/ADR-001-executable-dna-crystallization.md) and [ADR-003](../../decisions/ADR-003-shared-knowledge-in-docs.md) are not touched. No new ADR: the `mode` input is flow-level design inside the doctrine ADR-002 already locks, and the alternatives table above lives here, not in a decision record.

## Rollback

Revert the single PR: fast.yaml gains back its old entry step, the validator flag and helper disappear, prose surfaces revert. Engine core untouched → no state-format migration; an already-parked flow state would fail to find `parked` on the reverted flow, which is acceptable for an ephemeral, gitignored state dir (documented in the PR body if it ever matters).

## Conventions and evidence location

- Step ids frozen: `route_mode`, `check_registered`, `parked`. Input frozen: `mode` ∈ `build|register`. Validator flag frozen: `--change <id>`. Resume vocabulary at the park: `plan` | `discard`.
- Test naming follows the numbered-section idiom of `governance/__tests__/engine.test.mjs` and the library-level idiom of `roadmap.test.mjs` (helpers tested pure, CLI flag covered end-to-end through the flow's `runs` step under the symlinked tmp root).
- Canonical commands (`governance/README.md`): `node governance/__tests__/engine.test.mjs`; full suite = each file under `governance/__tests__/*.test.mjs` run with `node`.
- Evidence at the fixed location `docs/features/add-debit/evidence.md`.
