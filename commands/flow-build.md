---
description: Flow orchestrator — builds a change from plan to PR via the aidakit flow engine — start, resume, status, abort, list, register
---

First, inspect `$ARGUMENTS`. If it is empty or does not start with one of the
verbs below (`start`, `resume`, `status`, `abort`, `list`, `register`), do NOT
guess or proceed — print the Usage block verbatim and stop.

## Usage
**This is a flow orchestrator command.** It drives the `fast`/`full` flow via the engine (`node governance/cli.js`).

**Expected inputs:** `start <flow> [key=value ...]` · `resume <flow_id> <outcome> [key=value ...]` · `status <flow_id>` · `abort <flow_id>` · `list` · `register "<free-form request>"`

**Examples (copy-paste):**
- `/aidakit:flow-build start fast request="add rate limiting to the webhook endpoint"`
- `/aidakit:flow-build status <flow_id>`

Human interface to build **one change** — from plan to PR — on top of the executable flow engine (the engine in `governance/`, which does NOT get renamed). Translate the user's request into the engine's CLI and run it via Bash:

- `start <flow> [key=value ...]` → `node governance/cli.js start <flow> ...` (starts; e.g. `build start fast request="..."`)
- `resume <flow_id> <outcome> [key=value ...]` → `node governance/cli.js resume <flow_id> <outcome> [key=value ...]` (resumes a paused flow; the `key=value` tokens carry the step's declared structured outputs — e.g. the `select` step requires `change_id=<kebab-case-id>` on `success`, and re-pauses until it arrives)
- `status <flow_id>` → `node governance/cli.js status <flow_id>`
- `abort <flow_id>` → `node governance/cli.js abort <flow_id>`
- `list` → `node governance/cli.js list` (available flows: the plugin defaults + those in the repo's `.aidakit/flows/`)

**The 1st step picks the change:** the first step of the flows (`governance/flows/fast.yaml` and `full.yaml`) runs the `aidakit:orchestrator` agent to pick the next ready change from the plan (logic previously exposed as a separate command, now absorbed). You don't have to point at the change by hand — the flow selects it at startup; if the user names an explicit change in the request, pass it through as a parameter. **Report the resolved change-id back**: resume `select` with `success change_id=<kebab-case-id>` — every downstream task path keys on that id, never on the free-form request ([ADR-006](../docs/decisions/ADR-006-flow-values-as-data.md)).

**Inversion of control:** when the flow pauses on an `agent` step, the CLI prints the dispatch (which skill/subagent to run). Run it (via the named `aidakit:*` skill/agent), obtain the outcome, and resume with `resume`. When it pauses on a `human_gate`/`human_handoff`, present the prompt to the user and wait for their answer before resuming. Never invent an outcome — an invalid outcome re-pauses the gate.

**`register "<free-form request>"` — defer the request as a debit, no plan/implement now.** For "just remember this for later" instead of building it now:

1. **Pre-check for an already-parked flow**: scan `.aidakit/flows/state/*.json` for a `paused` flow whose `pause.step_id === "parked"` and whose `inputs.request` already names the same change. If found, resume it instead of double-parking — report its `flow_id` and stop.
2. **Dispatch `aidakit:roadmap` in `register` mode** on the free-form request — it mints the kebab-case change-id, refuses a collision (asks you if the id or `docs/features/<id>/` already exists), writes the feature line + acceptance sub-bullet, and regenerates `ROADMAP.md`. Obtain the minted change-id back.
3. **Start the flow in register mode, keyed to the minted id — never the raw sentence**: `node governance/cli.js start fast request=<change-id> mode=register`. The flow parks at a named human_gate (`pause.step_id: "parked"`) without dispatching `select`/`plan`/`implement` — `check_registered` mechanically refuses to park anything the roadmap doesn't declare.
4. **Report** the `flow_id` and the change-id, and stop.

**Resuming a parked debit:** `node governance/cli.js resume <flow_id> plan` continues into planning (the flow proceeds into `select`, with the roadmap's feature line + acceptance sub-bullet as context — no re-explanation needed); `resume <flow_id> discard` aborts the parked flow (the roadmap entry stays declared, at `backlog`).

**Boundary — when NOT to use `register`:** a request too rich to fit a feature line + a one-line acceptance sub-bullet is not a debit — plan it now (`aidakit:roadmap from` or `/aidakit:flow-build` in the default build mode), don't park it.

Full guide: `docs/guides/flows.md`. Engine source of truth: `governance/README.md`.

User request: $ARGUMENTS

<!-- aidakit v0.3 — /aidakit:build: builds a change (flow engine in governance/); 1st step absorbs the change selection, 2026-07-17 -->
<!-- aidakit v0.4 — `register` verb: defer a request as a debit (roadmap register mode → start fast mode=register → park), no plan/implement until resumed, 2026-07-22 -->
<!-- aidakit v0.5 — renamed /aidakit:build → /aidakit:flow-build (flow group prefix, command-grouping-and-inputs); adds the classification-led description, Usage block and empty/malformed-$ARGUMENTS guard, 2026-07-24 -->
<!-- aidakit v0.6 — resume carries structured outputs (select reports change_id; ADR-006), 2026-07-24 -->
