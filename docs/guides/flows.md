# Executable flows — how to use them

> **Scope:** the HOW of the aidakit flows layer — the model, the 7 step types, the two expression grammars, inversion of control, the CLI commands, and how to create a flow of your own. **Anti-scope:** the engine's internal mechanics and the type contract live in the engine's source of truth — [governance/README.md](../../governance/README.md) and the code under `governance/engine/`. The authority and gate doctrine lives at the root ([GOVERNANCE.md](../../GOVERNANCE.md), [PROCESS.md](../../PROCESS.md)).
>
> **Precedence:** this guide narrates and points, it does not duplicate ([DOCS.md §2](../../DOCS.md), rule 1). If it diverges from the engine, the flows, or the linked doctrine, the **other wins** and this file is corrected.

## 1. What the layer is

Three orthogonal pieces, **model B** (data, not code):

- **A generic engine** — a pure Node interpreter (zero-dep, ESM) that reads a flow and executes it step by step, with outcome routing, gates, persisted state, and inversion of control. It knows nothing about "review" or "PR"; it only knows how to run steps. Source: [governance/README.md](../../governance/README.md).
- **Flows as data** — declarative YAML files (`flow`, `inputs`, `steps`). The **order** of the steps and the routing live here; the **behavior** does not.
- **Skills that the steps invoke** — the `invoke` step names a skill/subagent in `invoke_target:` (`aidakit:plan`, `aidakit:review`…); the rich behavior lives in the skill, whose source of truth is its `SKILL.md`. The order lives in the flow, the intelligence in the skill.

This separation is deliberate: it is the **embryo of the aida engine** (see the product-vision memory). The engine is the deterministic, portable spine; the flows are the versionable composition; the skills are the muscle. Swapping the flow reorders the process without touching code; swapping the skill changes the behavior without touching the flow.

## 2. The 7 step types

Every step has an `id` and a `type`, and routes to the next via `on_result[outcome]`, `on_success`, or `on_failure`.

| Type | What it does | When to use |
|---|---|---|
| `invoke` | **Does not execute.** It pauses and asks Claude to run the skill/subagent named in `invoke_target:` and resume with the outcome (see §4). Outcomes restricted to the `expects` list (default `success`/`failure`). The legacy `agent` type is still accepted as a synonym. | Every step that requires intelligence: plan, review, implement, learn. |
| `runs` | Runs a deterministic shell command via `bash -lc`; routes by exit code (`0` → `success`, `≠0` → `failure`). The cheap "command" half. | Deterministic steps: lint, tests, validators, tree checks. |
| `human_gate` | Pauses and asks the human to choose among `options`. The resume value must match an option; routes by `on_result[option]`. | Human-authority decisions: the merge, the pre-apply gate. |
| `human_handoff` | Pauses and hands off a free-text task; the (free) resume value becomes `context.<id>.response` and routes by `on_success`. | Handing the human/Claude a step with no closed menu of options. |
| `loop` | Iterates the `body` over an array (`over`), with a `max` ceiling and/or an `until` condition (so it never runs forever). Renames the iteration variable via `as`. | Repeating a block per item, or bounded back-edges (review rounds with a ceiling). |
| `parallel` | Runs the `branches` (a list of lists) sequentially inside the engine — the parallelism here is logical, not concurrent. **No shipped flow uses it.** | Not the tool for real subagent concurrency — see §3.5 (the "bench" pattern) for that. |
| `terminal` | Ends the flow with an `outcome` (`completed` or `aborted`) and a `message`. | The flow's final nodes (the `done` and the `aborted`). |

## 3.5. Real subagent parallelism: the "bench" pattern

The engine is single-threaded by design — pause/resume against state persisted to disk, which is what lets a flow survive a crash or a session ending. It has no mechanism to run subagents concurrently itself, which is exactly why `parallel` above is unused: real concurrency happens **inside a skill**, when Claude fires several `Agent` tool calls in the *same message*. Two skills already do this: `aidakit:review`'s reviewer bench and `aidakit:implement`'s per-surface fan-out (see their `SKILL.md`s).

Dispatching N agents "in the same message" used to be prose-only — nothing mechanically confirmed it happened, that every agent reported, or that the outcome the skill relayed to the flow matched what the agents actually said. That gap is closed by a **bench**: a named group of independent subagents, tracked in `.aidakit/tasks/<change-id>/bench.ndjson` ([`governance/ledgers/ledger.js`](../../governance/ledgers/ledger.js)) and mechanically checked by [`governance/validators/check-bench.js`](../../governance/validators/check-bench.js) — see [governance/README.md](../../governance/README.md#real-parallelism-the-bench-pattern) for the full manifest → dispatch → verdict → check shape. In a flow, this shows up as a `runs` step right after the `invoke` (`check_review_bench`, `check_implement_bench`) that rejects the round — routing back to redo it — if a role was skipped, the reported consensus doesn't match the ndjson, or the dispatch wasn't genuinely parallel.

## 3. The expression trap

There are **two grammars** for referencing state in the engine, and they **do not mix**. This is the easy mistake.

- **`over` and `until`** (the `loop` step) use a **bare expression** — the engine passes them straight to `resolve()`. Write the path **without `${}`**:

  ```yaml
  over: inputs.items            # right
  until: context.review.ok      # right
  ```

  With `${}` the expression **does not resolve**: `over: ${inputs.items}` is not an array (`resolve` doesn't know what to do with the literal string `${inputs.items}`), and the step fails with "over expression … did not resolve to an array".

- **`command`, `prompt`, and `input`** (the `runs`, `human_gate`, `human_handoff`, `invoke` steps) use **`${...}` interpolation** — the engine substitutes `${expr}` with the value inside a larger string:

  ```yaml
  command: "validate ${inputs.change_id}"    # right
  prompt:  "Review ${context.plan.summary}"  # right
  input:
    request: "${inputs.request}"             # right
  ```

  Here, the bare path (`command: validate inputs.change_id`) comes out **literal** — nothing is substituted.

  **In a `runs` command, the value travels as data, not shell text** ([ADR-006](../decisions/ADR-006-flow-values-as-data.md)): each resolvable `${expr}` renders as a bash variable reference (`$AIDAKIT_VAR_n`) whose value is injected into the child env — bash expands it after parsing, so a multiline or metacharacter-laden value (a free-form `${inputs.request}`, say) can never break the command structure or inject commands. Two consequences: quote the interpolation site with **double** quotes (`".aidakit/tasks/${context.select.change_id}/…"`) to also prevent word-splitting, and never put an interpolation inside **single** quotes — `'${x}'` stops expanding and renders the literal text `$AIDAKIT_VAR_n`.

**Rule of thumb:** `over`/`until` = the whole value is the expression → bare. `command`/`prompt`/`input` = the expression is **embedded** in a string → `${...}`.

Expressions available in both grammars: `inputs.<name>`, `context.<step>.<field>`, `flow_id`, and `item`/`<as>` inside a loop. (Detail in [governance/engine/interpolate.js](../../governance/engine/interpolate.js).)

**A third, unrelated `$`-form: bare `$FOO` is shell expansion, not engine interpolation.** A `runs` step's `command` is a shell string executed via `bash -lc`, so bash's own environment-variable expansion also applies there — e.g. `$AIDAKIT_GOVERNANCE` (injected by `runs.js` into every `runs` child env; see §6). The engine's `interpolateString` only substitutes `${...}` (dollar-brace) tokens, so a bare `$AIDAKIT_GOVERNANCE` passes through the engine **untouched** and is expanded by bash instead. The two grammars coexist in the same command string without conflict: `command: "node \"$AIDAKIT_GOVERNANCE/validators/x.js\" ${inputs.request}"` — `${inputs.request}` resolves at the engine layer, `$AIDAKIT_GOVERNANCE` resolves at the shell layer, one substitution each.

## 4. Inversion of control

The engine **never dispatches a subagent** — that's Claude's job. When the engine reaches an `invoke` step, it **pauses** with `pause.step_type: "invoke"`, records the skill and the rendered `input` in the state, and returns control. Then:

1. The CLI prints the dispatch (which skill, which input, which expected outcomes — and, when the step declares `outputs`, which `key=value` tokens the resume must carry).
2. The **operator-Claude** runs the skill/subagent.
3. Claude calls `resume <flow_id> <outcome> [key=value ...]`, and the engine advances.

The `key=value` tokens are the step's **structured outputs** ([ADR-006](../decisions/ADR-006-flow-values-as-data.md)): an invoke step may declare `outputs: {<outcome>: [key, ...]}`, and resuming with that outcome then *requires* those keys as safe single tokens (`[A-Za-z0-9._:@/-]+` — ids, branches, URLs; never prose). They persist into `context.<step_id>.<key>` for downstream interpolation — this is how `select` reports the resolved change-id (`resume … success change_id=<id>`) and every task path keys on `${context.select.change_id}` instead of the free-form request.

This way the engine is the **deterministic spine** (order, gates, state that survives the session) and Claude is the **intelligence engine**. Each does what the other does poorly. If the outcome isn't in `expects` — or a declared output is missing or unsafe — the engine **re-pauses** instead of killing the run — an invalid resume does not destroy work already done. Source: [governance/engine/steps/invoke.js](../../governance/engine/steps/invoke.js).

## 5. The CLI commands

`node governance/cli.js <command>` — five commands:

| Command | Does |
|---|---|
| `start <flow> [key=value …]` | Starts a flow, passing the `inputs` via `key=value`. |
| `resume <flow_id> <outcome> [key=value …]` | Resumes a paused flow with the outcome (the value of an `invoke`, the option of a `human_gate`, the free text of a `human_handoff`). The `key=value` tokens carry an invoke step's declared structured outputs (e.g. `change_id=<id>` on `select`). |
| `status <flow_id>` | Shows the state, the current step, and where it's paused. |
| `abort <flow_id> [reason]` | Aborts a flow in flight. |
| `list` | Lists the available flows (project + the plugin default). |

### End-to-end example with the `fast` flow

```console
$ node governance/cli.js start fast request="add a date filter to the listing"

[fast-260717-8f2a] PAUSED at "select" (invoke)
Dispatch skill/agent: aidakit:orchestrator
Purpose: the orchestrator picks/confirms the next change ready to build (1st step of the flow).
Input: { "request": "add a date filter to the listing" }
Expected outcomes: success | failure
When done, run:
  node governance/cli.js resume fast-260717-8f2a <outcome>
```

Claude runs the `aidakit:orchestrator` agent, which picks the change, and resumes reporting the resolved change-id (the `select` step declares `outputs: {success: [change_id]}`, so a `success` without it re-pauses) — the flow advances to the `plan` step:

```console
$ node governance/cli.js resume fast-260717-8f2a success change_id=listing-date-filter

[fast-260717-8f2a] PAUSED at "plan" (invoke)
Dispatch skill/agent: aidakit:plan
Purpose: aidakit:plan — plans the chosen change (implementation plan).
Expected outcomes: success | failure
```

Claude runs the `aidakit:plan` skill, produces the plan, resumes with `success`, and the flow proceeds to GATE 1:

```console
$ node governance/cli.js resume fast-260717-8f2a success

[fast-260717-8f2a] PAUSED at "readiness" (invoke)
Dispatch skill/agent: aidakit:readiness
...
Expected outcomes: approved | needs-revision | blocked
```

Then comes `resume fast-260717-8f2a approved` → the `implement` step, and so on, up to the merge `human_gate`:

```console
$ node governance/cli.js resume fast-260717-8f2a pass      # review passed → goes to pr
...
[fast-260717-8f2a] PAUSED at "merge" (human_gate)
PR ready to add a date filter to the listing. Review it on the git host and merge it yourself.
Options: merged | discard

$ node governance/cli.js resume fast-260717-8f2a merged

[fast-260717-8f2a] COMPLETED (completed)
Change delivered and merged. aidakit:docs archives and promotes specs.
```

Between one step and the next, `node governance/cli.js status fast-260717-8f2a` shows where the run stopped. The resumable state lives in `.aidakit/flows/state/<flow_id>.json` and the event log in `.aidakit/flows/logs/<flow_id>.log` in the target project (ephemeral — gitignore recommended).

For the step-by-step of the process the `fast` flow enacts, see the [change-flow.md](change-flow.md) guide.

### Register mode — deferring a request as a debit

`fast.yaml` also carries a `mode` input (`build` | `register`, default `build`). `start … mode=register` skips straight past `select`/`plan`/`implement` and **parks** at a named human gate instead — for "just remember this for later" (`/aidakit:flow-build register "<free-form request>"`, `commands/flow-build.md`):

```console
$ node governance/cli.js start fast request=add-a-date-filter mode=register

[fast-260722-8e7af2] PAUSED at "parked" (human_gate)
Debit registered: "add-a-date-filter" is declared on the roadmap (backlog)
and this flow is PARKED. Nothing is planned or implemented until you resume.
  plan    → continue into planning (select → plan → …)
  discard → abort this parked flow (the roadmap entry stays declared)
Options: plan | discard
```

Two `runs` steps (never pausing, so they never appear as a dispatch) route it there:

- **`route_mode`** — the first step in `fast.yaml`'s list (the flow declares no `entry`, so the first step IS the entry). `test "${inputs.mode}" = register`: exit 0 routes into the register path; exit 1 (the default, `build`) falls through to `select` — the pipeline above, byte-identical.
- **`check_registered`** — THE LEASH: `node "$AIDAKIT_GOVERNANCE/validators/derive-roadmap-status.js" --change "${inputs.request}"`. It refuses to park an id the roadmap doesn't already declare — which also structurally rejects a raw free-form sentence leaking into `request` (a sentence never matches a declared kebab-case change-id, keeping every downstream `${inputs.request}` path clean). Exit 1 routes to the `aborted` terminal, nothing parked; the request must be registered on the roadmap first (`aidakit:roadmap` register mode mints the id and writes the feature line — `skills/roadmap/SKILL.md`).

Resuming continues right into planning with no re-explanation needed — the change-id carries into `select`'s input, and the roadmap's feature line + acceptance sub-bullet is the durable context the planner reads:

```console
$ node governance/cli.js resume fast-260722-8e7af2 plan

[fast-260722-8e7af2] PAUSED at "select" (invoke)
Dispatch skill/agent: aidakit:orchestrator
Input: { "request": "add-a-date-filter" }
...
```

`resume <flow_id> discard` aborts the parked flow instead (the roadmap entry stays declared, at `backlog` — status is derived, never written, [ADR-002](../decisions/ADR-002-roadmap-status-derived-from-disk.md)).

## 6. Creating a flow of your own

Put the file in `.aidakit/flows/<name>.yaml` **in the target project**. The loader looks there **first**; only if it doesn't find it does it fall back to the default flows embedded in the plugin (`governance/flows/`). That is, a project flow with the same name **overrides** the default — and `list` shows the union of the two directories. The file name must match the internal `flow:` field (the parser rejects a divergence). Source: [governance/engine/parser.js](../../governance/engine/parser.js).

Minimal structure: a top-level map with `flow` (string), `description` (string), `inputs` (a list), and `steps` (a non-empty list). The parser validates the shape on `load` (unique ids, existing routing targets, mandatory fields per type) — a typographically broken flow fails at `start`, not after human gates and wasted work.

**Calling a kit validator from a flow of your own:** `governance/validators/*.js` ships **inside the plugin**, not the target project, so a relative `node governance/validators/x.js` only resolves when the flow happens to run inside the kit repo itself — every consumer project's own `.aidakit/flows/*.yaml` needs the absolute path instead. `runs.js` injects `AIDAKIT_GOVERNANCE` (pointing at the kit's own `governance/` directory) into every `runs` step's child env; call a kit validator as `node "$AIDAKIT_GOVERNANCE/validators/x.js"` — double-quoted, since the plugin cache path may contain spaces. Leave your own project's argument paths (e.g. `.aidakit/…`) relative, unaffected by this — see §3 for why the bare `$AIDAKIT_GOVERNANCE` passes untouched through the engine's own `${...}` interpolation.

### The two default flows

- **[fast.yaml](../../governance/flows/fast.yaml)** — Margi style: from change to PR with minimal ceremony (pick → plan → readiness → TDD → review → PR → human merge). For small, reversible work.
- **[full.yaml](../../governance/flows/full.yaml)** — codeflow/psim style: maximum rigor (adversarial brainstorm → spec with a critic → pre-apply gate → readiness → TDD → bench review with a ceiling → hardening → learn → PR → merge). For broad, architectural, or irreversible work.

## 7. Limitations of the mini YAML parser

The flows are read by a zero-dep mini YAML parser of its own ([governance/engine/yaml-min.js](../../governance/engine/yaml-min.js)) — not the `yaml` package. It covers only the subset the flows use; **write the flows within it**. From the file's header:

- **Indent with SPACES, never tabs** (2 spaces per level is the convention).
- **A list item with an inline map uses `- ` (one space after the dash):** `- id: a`. Wide spacing (`-   id: a`) is not supported.
- **A value with a `#` at the end needs quotes.** A legitimate `#` in the middle of the value (e.g., `fixes #42`) is preserved; but to put a comment at the **end** of a value line, **quote the value** — otherwise the `#` and the rest become a comment.

It does **not** support anchors/aliases, tags, nested flow-style (`{a: 1}`, `[1, 2]`), or multi-line keys. If a flow uses something out of scope, the parser throws a clear error instead of accepting it silently.

---

Back to the [guides index](README.md) or the [master index](../INDEX.md).

<!-- aidakit v0.3 — guide to the executable flows layer, created on 2026-07-17 — translated to EN -->
<!-- aidakit v0.4 — §5 register-mode subsection: route_mode → check_registered → parked (add-debit), 2026-07-22 -->
<!-- aidakit v0.5 — AIDAKIT_GOVERNANCE for consumer flows calling kit validators (§3, §5, §6), 2026-07-23 -->
<!-- aidakit v0.6 — ADR-006: runs values as env data (§3) + structured resume outputs / change_id (§4, §5), 2026-07-24 -->
