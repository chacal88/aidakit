# aidakit/governance — executable governance layer

Declarative flow engine + (under construction) validators, ported and slimmed down from recruit's `.governance`. Pure Node (ESM), **zero npm dependencies** — installs with the plugin, no `npm install`. It is the embryo of the aida engine.

> Doctrine: [GOVERNANCE.md](../GOVERNANCE.md) (authority model, 3 escalations) and [DOCS.md](../DOCS.md). This directory MAKES executable what those describe.

## What exists today (Milestone 1)

- **`engine/`** — the engine: runs a YAML flow step by step, with gates, persisted state, and inversion of control.
- **`flows/`** — default flows: `fast.yaml` (Margi style) and `full.yaml` (codeflow style). A project can have its own in `.aidakit/flows/`.
- **`cli.js`** — `node governance/cli.js <start|resume|status|abort|list>`.
- **`__tests__/`** — Node table tests (no framework): `node governance/__tests__/engine.test.mjs`.

## How a flow works

A flow is a sequence of **steps** of 7 types. Each step routes to the next via `on_result[outcome]`, `on_success`, or `on_failure`.

| Type | What it does |
|---|---|
| `invoke` | Dispatches a **skill OR an agent** — the `invoke_target:` field names which one (e.g., `invoke_target: aidakit:readiness` is a skill; `invoke_target: aidakit:orchestrator` is an agent). **Does not execute** — it pauses and asks Claude to run it (inversion of control) and to resume with the outcome. |
| `runs` | Runs a deterministic shell command; routes by exit code (0 = success). The cheap "command" half. |
| `human_gate` | Pauses and asks the human to choose among `options`. |
| `human_handoff` | Pauses and hands a free-text task to the human/Claude. |
| `loop` | Iterates the `body` over an array, with a `max` ceiling and/or an `until` condition (so it never runs forever). |
| `parallel` | Runs `branches`; all must pass. (Real subagent parallelism = Claude dispatches via the Task tool in one message.) |
| `terminal` | Ends the flow (`completed` or `aborted`). |

> **Backward compatibility:** the parser still accepts the legacy `agent` type and the `agent:` field as synonyms for `invoke`/`invoke_target:` — old flows load without edits (the parser normalizes `agent` → `invoke` and `agent:` → `invoke_target:` before validating, in [`engine/parser.js`](engine/parser.js)). New flows and the doctrine use `invoke`/`invoke_target:`, because the step dispatches a skill **or** an agent and the old name pretended to dispatch only an agent.

### ⚠️ Expression convention (the trap)

Two grammars for referencing state, **do not mix them**:

- **`over` and `until`** (loop) use a **bare expression**: `over: inputs.items`, `until: context.review.ok`. **No `${}`.**
- **`command`, `prompt`, `input`** use `${...}` **interpolation**: `command: "validar ${inputs.change_id}"`, `prompt: "Revise ${context.plan.summary}"`.

Available expressions: `${inputs.x}`, `${context.<step>.<field>}`, `${flow_id}`, `${item}`/`${as}` (inside a loop).

## Inversion of control (the central point)

The engine **never dispatches a skill/subagent** — that is Claude's job. An `invoke` step pauses with `step_type: "invoke"` (carrying `invoke_target:` = the skill/agent to run), Claude runs the skill/agent and calls `resume <flow_id> <outcome>`. This way the engine is the deterministic spine (order, gates, state that survives the session) and Claude is the intelligence engine. Each one resolves what the other does poorly.

## State

Lives in `.aidakit/flows/{state,logs}/` in the target project (ephemeral — gitignore recommended). `state/<flow_id>.json` is the resumable state; `logs/<flow_id>.log` is the JSON-lines event log. Base overridable via the `AIDAKIT_PROJECT_ROOT` env var.

## Ported from recruit, coupling cut

Brought over: the type contract, the loop with IoC, pause/resume, the `max`/`until` loop, interpolation. Cut: ajv (light manual validation), tsx (pure Node), recruit's paths (`.aidakit/` in their place), `/rc:*` (the `aidakit:*` namespace), the `yaml` dep (own mini-parser in `engine/yaml-min.js`), and the whole OpenSpec/cloud mode as mandatory.

<!-- aidakit v0.3 — flow engine, Milestone 1, 2026-07-17 — translated to EN -->
