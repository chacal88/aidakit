---
description: "Flow orchestrator — Fast flow, Margi-style: from the chosen change to the PR, with minimal ceremony."
---
<!-- aidakit:generated flow=fast template=0.11 source=governance/flows/fast.yaml -->
First, inspect `$ARGUMENTS`. If it is empty, do NOT guess or proceed — print the Usage block verbatim and stop.

## Usage
**This is a flow orchestrator command.** It drives the `fast` flow via the engine (`node "$AIDAKIT_GOVERNANCE/cli.js"`).

**Expected inputs:** <free-form request> (implicit — no verb needed) · `resume <flow_id> <outcome> [key=value ...]` · `status <flow_id>` · `abort <flow_id>` · `list` · `register "<free-form request>"`

**Reserved verbs:** `resume`, `status`, `abort`, `list`, `register`. Anything else — including a bare free-form request — is read as the start payload (see "Implicit start" below).

**Examples (copy-paste):**
- `/aidakit:flow-fast <request>`
- `/aidakit:flow-fast status <flow_id>`

Human interface to the `fast` flow (the engine in `governance/`, which does NOT get renamed). Translate the user's request into the engine's CLI and run it via Bash. **Every command below is self-guarding**: each one chains the fail-closed check (`: "${AIDAKIT_GOVERNANCE?agent-validator-paths: AIDAKIT_GOVERNANCE not set — SessionStart hook missing (see docs/guides/flows.md §6)}"`) ahead of the `node` call, so running any single bullet in isolation — not just the first one in a session — still fails loud if the `SessionStart` hook (see [ADR-012](../docs/decisions/ADR-012-aidakit-governance-session-wide.md), `docs/guides/flows.md` §6) is missing or broken, instead of a silent relative-path fallback.

## What this flow does

Fast flow, Margi-style: from the chosen change to the PR, with minimal ceremony.
The orchestrator picks the next change and plans it; readiness gate; implementation
with TDD; review; PR; and the human merge gate. No brainstorm nor full panel —
for small, reversible work where practicality matters more than rigor.
`agent` steps pause for Claude to dispatch the skill/subagent (inversion of
control) and resume with the outcome.

## Implicit start — the default verb

Bare `$ARGUMENTS` starts the flow directly — no `start`/`<flow>`/`<key>=` typed — UNLESS it matches one of the reserved verbs below, checked in this exact order:

1. **`resume` / `status` / `abort`** — recognized only when the 1st token is exactly that verb AND the 2nd token is flow_id-shaped: it matches `^[a-z][a-z0-9-]*-[0-9]{6}-[0-9a-f]{1,6}$` (e.g. `full-260727-ec4472`). If the 2nd token is absent or doesn't match, the WHOLE `$ARGUMENTS` falls through to start.
2. **`list`** — recognized only when `$ARGUMENTS` is EXACTLY the sole token `list` (nothing after it). `list all invoices` is NOT the list verb — it starts a flow with that payload.
3. **`register`** — recognized when the 1st token is exactly `register`; the REST of `$ARGUMENTS` is the free-form request (register takes free-form text, not a flow_id).
4. **Otherwise** — the ENTIRE `$ARGUMENTS` is the start payload.

**Inversion of control:** when the flow pauses on an `invoke` step, the CLI prints the dispatch (which skill/subagent to run). Run it (via the named `aidakit:*` skill/agent), obtain the outcome, and resume with `resume`. When it pauses on a `human_gate`/`human_handoff`, present the prompt to the user and wait for their answer before resuming. Never invent an outcome — an invalid outcome re-pauses the gate.

- <free-form request> → `: "${AIDAKIT_GOVERNANCE?agent-validator-paths: AIDAKIT_GOVERNANCE not set — SessionStart hook missing (see docs/guides/flows.md §6)}"; node "$AIDAKIT_GOVERNANCE/cli.js" start fast request="$ARGUMENTS"` (starts the `fast` flow with the bare `$ARGUMENTS` as `request`.)
- `resume <flow_id> <outcome> [key=value ...]` → `: "${AIDAKIT_GOVERNANCE?agent-validator-paths: AIDAKIT_GOVERNANCE not set — SessionStart hook missing (see docs/guides/flows.md §6)}"; node "$AIDAKIT_GOVERNANCE/cli.js" resume <flow_id> <outcome> [key=value ...]` (resumes a paused flow; the `key=value` tokens carry the step's declared structured outputs when the paused step requires them)
- `status <flow_id>` → `: "${AIDAKIT_GOVERNANCE?agent-validator-paths: AIDAKIT_GOVERNANCE not set — SessionStart hook missing (see docs/guides/flows.md §6)}"; node "$AIDAKIT_GOVERNANCE/cli.js" status <flow_id>`
- `abort <flow_id>` → `: "${AIDAKIT_GOVERNANCE?agent-validator-paths: AIDAKIT_GOVERNANCE not set — SessionStart hook missing (see docs/guides/flows.md §6)}"; node "$AIDAKIT_GOVERNANCE/cli.js" abort <flow_id>`
- `list` → `: "${AIDAKIT_GOVERNANCE?agent-validator-paths: AIDAKIT_GOVERNANCE not set — SessionStart hook missing (see docs/guides/flows.md §6)}"; node "$AIDAKIT_GOVERNANCE/cli.js" list` (available flows: the plugin defaults + those in the repo's `.aidakit/flows/`)

**`register "<free-form request>"`** — defer the request as a debit, no plan/implement now. For "just remember this for later" instead of building it now:

1. **Pre-check for an already-parked flow**: scan `.aidakit/flows/state/*.json` for a `paused` flow whose `pause.step_id === "parked"` and whose `inputs.request` already names the same change. If found, resume it instead of double-parking — report its `flow_id` and stop.
2. **Dispatch `aidakit:roadmap` in `register` mode** on the free-form request — it mints the kebab-case change-id, refuses a collision (asks you if the id or `docs/features/<id>/` already exists), writes the feature line + acceptance sub-bullet, and regenerates `ROADMAP.md`. Obtain the minted change-id back.
3. **Start the flow in register mode, keyed to the minted id — never the raw sentence**: `: "${AIDAKIT_GOVERNANCE?agent-validator-paths: AIDAKIT_GOVERNANCE not set — SessionStart hook missing (see docs/guides/flows.md §6)}"; node "$AIDAKIT_GOVERNANCE/cli.js" start fast request=<change-id> mode=register`. The flow parks at a named human_gate (`pause.step_id: "parked"`) without dispatching `select`/`plan`/`implement` — `check_registered` mechanically refuses to park anything the roadmap doesn't declare.
4. **Report** the `flow_id` and the change-id, and stop.

**Resuming a parked debit:** `: "${AIDAKIT_GOVERNANCE?agent-validator-paths: AIDAKIT_GOVERNANCE not set — SessionStart hook missing (see docs/guides/flows.md §6)}"; node "$AIDAKIT_GOVERNANCE/cli.js" resume <flow_id> plan` continues into planning (the flow proceeds into `select`, with the roadmap's feature line + acceptance sub-bullet as context — no re-explanation needed); `: "${AIDAKIT_GOVERNANCE?agent-validator-paths: AIDAKIT_GOVERNANCE not set — SessionStart hook missing (see docs/guides/flows.md §6)}"; node "$AIDAKIT_GOVERNANCE/cli.js" resume <flow_id> discard` aborts the parked flow (the roadmap entry stays declared, at `backlog`).

**Boundary — when NOT to use `register`:** a request too rich to fit a feature line + a one-line acceptance sub-bullet is not a debit — start the flow directly with the bare request (or `aidakit:roadmap from` for a bigger backlog), don't park it.

Full guide: `docs/guides/flows.md`. Engine source of truth: `governance/README.md`. Authority and gates doctrine: `GOVERNANCE.md` at the plugin root.

User request: $ARGUMENTS

<!-- aidakit v0.11 — flow-fast: generated per-flow command (governance/commands/generate-flow-commands.js, ADR-017) -->
