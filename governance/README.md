# aidakit/governance — executable governance layer

Declarative flow engine + (under construction) validators, ported and slimmed down from recruit's `.governance`. Pure Node (ESM), **zero npm dependencies** — installs with the plugin, no `npm install`. It is the embryo of the aida engine.

> Doctrine: [GOVERNANCE.md](../GOVERNANCE.md) (authority model, 3 escalations) and [DOCS.md](../DOCS.md). This directory MAKES executable what those describe.

## What exists today (Milestone 1)

- **`engine/`** — the engine: runs a YAML flow step by step, with gates, persisted state, and inversion of control.
- **`flows/`** — default flows: `fast.yaml` (Margi style) and `full.yaml` (codeflow style). A project can have its own in `.aidakit/flows/`.
- **`cli.js`** — `node governance/cli.js <start|resume|status|summaries|abort|list>`. `start`/`resume`/`status` each print a **progress table** first: every step declared in the flow's YAML, tagged `done`/`current`/`pending` (`engine/progress-table.js`) — a structural map of the whole run, not just the local pause/prompt. Any step that has emitted a per-step summary (see below) gets a second, indented `↳ <text>` line under its `done` row — the **narrative** layered under the **position**. `summaries <flow_id>` prints the full ordered narrative log on its own, one line per entry (`[<step_id>#<visit_n> <outcome>] <text>`), including back-edge history.
- **`__tests__/`** — Node table tests (no framework): `node governance/__tests__/engine.test.mjs`.

## How a flow works

A flow is a sequence of **steps** of 7 types. Each step routes to the next via `on_result[outcome]`, `on_success`, or `on_failure`.

| Type | What it does |
|---|---|
| `invoke` | Dispatches a **skill OR an agent** — the `invoke_target:` field names which one (e.g., `invoke_target: aidakit:readiness` is a skill; `invoke_target: aidakit:orchestrator` is an agent). **Does not execute** — it pauses and asks Claude to run it (inversion of control) and to resume with the outcome. May declare `outputs: {<outcome>: [key, ...]}`: resuming with that outcome then REQUIRES `key=value` tokens (safe single tokens), persisted into `context[step.id]` for `${context.<step>.<key>}` — how `select` carries the change-id ([ADR-006](../docs/decisions/ADR-006-flow-values-as-data.md)). |
| `runs` | Runs a deterministic shell command; routes by exit code (0 = success). The cheap "command" half. `${...}` values are passed to bash as environment **data** (`$AIDAKIT_VAR_n`), never spliced as shell text — a multiline/metacharacter value can't break or inject the command ([ADR-006](../docs/decisions/ADR-006-flow-values-as-data.md)). |
| `human_gate` | Pauses and asks the human to choose among `options`. |
| `human_handoff` | Pauses and hands a free-text task to the human/Claude. |
| `loop` | Iterates the `body` over an array, with a `max` ceiling and/or an `until` condition (so it never runs forever). |
| `parallel` | Runs `branches` sequentially inside the engine — the parallelism here is logical, not concurrent. **Not used by any shipped flow.** Real subagent concurrency is a **bench** dispatch (below), not this step type. |
| `terminal` | Ends the flow (`completed` or `aborted`). |

> **Backward compatibility:** the parser still accepts the legacy `agent` type and the `agent:` field as synonyms for `invoke`/`invoke_target:` — old flows load without edits (the parser normalizes `agent` → `invoke` and `agent:` → `invoke_target:` before validating, in [`engine/parser.js`](engine/parser.js)). New flows and the doctrine use `invoke`/`invoke_target:`, because the step dispatches a skill **or** an agent and the old name pretended to dispatch only an agent.

### ⚠️ Expression convention (the trap)

Two grammars for referencing state, **do not mix them**:

- **`over` and `until`** (loop) use a **bare expression**: `over: inputs.items`, `until: context.review.ok`. **No `${}`.**
- **`command`, `prompt`, `input`** use `${...}` **interpolation**: `command: "validar ${inputs.change_id}"`, `prompt: "Revise ${context.plan.summary}"`.

Available expressions: `${inputs.x}`, `${context.<step>.<field>}`, `${flow_id}`, `${item}`/`${as}` (inside a loop).

In a `runs` **command**, each resolvable `${...}` renders as a bash env-var reference (`$AIDAKIT_VAR_n`) whose value travels through the child environment — data, not shell text ([ADR-006](../docs/decisions/ADR-006-flow-values-as-data.md)). Interpolation sites in commands must therefore be bare or double-quoted, never inside single quotes (a single-quoted `'${x}'` stops expanding).

## Per-step summaries (the narrative layer)

Any `invoke`/`human_gate`/`human_handoff` step may declare an optional `summary:` string template — a one-line, human-readable narrative rendered after the step resolves (never on the initial pause) and appended to `state.summaries[]`. `runs`/`loop`/`parallel`/`terminal` never emit (a `runs` result is already machine-parseable under `context[step.id]`; the others are structural, not semantic pauses).

```yaml
  - id: select
    type: invoke
    invoke_target: aidakit:orchestrator
    outputs:
      success:
        - change_id
    summary: "resolved change_id={change_id}"     # ← optional; falls back to "{outcome}"
    on_success: classify
```

- **Grammar: single-brace `{key}`** — deliberately not the engine's `${...}` interpolation above; a summary template is already scoped to the ONE step's `context[step.id]` bag, so `{key}` (not `${context.<step>.<key>}`) is enough. `{outcome}` always resolves (synthesized from the step's resolved outcome, regardless of which fields the executor itself wrote); any other key falls back to the step's declared outputs (`{change_id}`, `{choice}`, `{response}`, …). An unset key renders as a visible `<unset:key>` marker — never throws.
- **Absent `summary:`** → the engine falls back to the default template `"{outcome}"`.
- **200-char cap, engine-side, at ingest** — a rendered text longer than 200 chars is truncated with `…` as the last character; newlines are collapsed to spaces. `state.summaries[i].text.length` is always ≤ 200.
- **Back-edge append, never overwrite** — a re-entered step gets a NEW entry with `visit_n` incremented (`select#1`, `select#2`, …); the array is append-only, in insertion order, and survives `abort`/`failure` routing.
- **Non-breaking** — `state.summaries` is optional; a state file from before this field existed reads fine everywhere (`state.summaries ?? []`), and `summaries <flow_id>` prints `no summaries recorded for <flow_id>` instead of erroring.

This is the **narrative** layer, distinct from the **position** layer (the progress table's `done`/`current`/`pending` row, unchanged by this): the row still shows only `id + marker`; the summary is a second, indented line UNDER a `done` row that has one.

## Inversion of control (the central point)

The engine **never dispatches a skill/subagent** — that is Claude's job. An `invoke` step pauses with `step_type: "invoke"` (carrying `invoke_target:` = the skill/agent to run), Claude runs the skill/agent and calls `resume <flow_id> <outcome> [key=value ...]` — the `key=value` tokens carry the step's declared structured outputs (e.g. `change_id=<id>` on `select`; the engine re-pauses, fail-closed, until every declared key arrives as a safe single token). This way the engine is the deterministic spine (order, gates, state that survives the session) and Claude is the intelligence engine. Each one resolves what the other does poorly.

## Real parallelism: the "bench" pattern

The engine is single-threaded by design (pause/resume against persisted state on disk — that's what survives a crash or a session end). It cannot itself run subagents concurrently, and the `parallel` step type above is dead code precisely because of that constraint. Real parallelism — N independent subagents genuinely running at once — only happens **inside a skill**, when Claude fires N `Agent` tool calls in the *same message*. `aidakit:review`'s reviewer bench (`skills/review/SKILL.md`) is the canonical example; `aidakit:implement`'s per-surface fan-out (`skills/implement/SKILL.md`) is the other.

That kind of dispatch used to be pure-prose trust: the skill said "dispatch N agents in parallel," and nothing checked that it actually happened, that every agent reported, or that the consensus the skill relayed to the flow matched what the agents actually said. **This is what `bench.ndjson` + `governance/validators/check-bench.js` close:**

1. **Before dispatching anyone**, the skill writes a `__manifest__` record to `.aidakit/tasks/<change-id>/bench.ndjson` (`recordBenchManifest`, [`governance/ledgers/ledger.js`](ledgers/ledger.js)) — the full list of roles this round commits to. It must be the round's *earliest* record, so it can't be quietly shrunk after seeing a role fail.
2. **As each subagent returns**, the skill records its normalized verdict (`recordBench`) with `dispatched_at`/`returned_at` — the role's own dispatch/return timestamps, not the ledger-write time.
3. A `runs` step right after the `invoke` (e.g. `check_review_bench` in `full.yaml`/`fast.yaml`) calls `check-bench.js`, which mechanically verifies: every manifested role reported exactly once; the consensus derived from the roles' own verdicts matches what the skill reported to the engine; and the roles' dispatch windows genuinely *overlap* — proof of real concurrency, not a sequential dispatch dressed up as one. Any violation routes back to redo the round, exactly like the doc-leash routes back to `document`.

This is the reusable "team" primitive of the kit: any skill that fans out to N independent subagents and returns one consolidated outcome is a **bench**, and gets the same manifest → dispatch → verdict → mechanical-check shape — see `check-bench.js`'s own header for the exact ndjson contract.

## State

Lives in `.aidakit/flows/{state,logs}/` in the target project (ephemeral — gitignore recommended). `state/<flow_id>.json` is the resumable state; `logs/<flow_id>.log` is the JSON-lines event log. Base overridable via the `AIDAKIT_PROJECT_ROOT` env var.

`runs` steps also receive `AIDAKIT_GOVERNANCE` in their child env, computed by `runs.js` from its own `import.meta.url` and pointing at the kit's own `governance/` directory — not the target project's. This lets a flow command call a kit validator as `node "$AIDAKIT_GOVERNANCE/validators/…"` and resolve it regardless of `cwd` (which is `AIDAKIT_PROJECT_ROOT`/the consumer repo, not the kit). See [docs/guides/flows.md](../docs/guides/flows.md) §3 (the `${...}` vs `$FOO` grammar distinction) and §6 (calling a kit validator from a flow of your own), and [ADR-004](../docs/decisions/ADR-004-aidakit-governance-env-contract.md) for the decision.

## Ported from recruit, coupling cut

Brought over: the type contract, the loop with IoC, pause/resume, the `max`/`until` loop, interpolation. Cut: ajv (light manual validation), tsx (pure Node), recruit's paths (`.aidakit/` in their place), `/rc:*` (the `aidakit:*` namespace), the `yaml` dep (own mini-parser in `engine/yaml-min.js`), and the whole OpenSpec/cloud mode as mandatory.

<!-- aidakit v0.3 — flow engine, Milestone 1, 2026-07-17 — translated to EN -->
<!-- aidakit v0.6 — ADR-006: structured invoke outputs (change_id) + runs values passed as env data, 2026-07-24 -->
<!-- aidakit v0.7 — flow-run-progress-table: read-only progress table (done/current/pending) at start/resume/status, 2026-07-24 -->
<!-- aidakit v0.8 — flow-step-summaries: declarative per-step narrative (state.summaries[], summary: template, `summaries <flow_id>` CLI), 2026-07-24 -->
