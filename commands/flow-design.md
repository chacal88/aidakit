---
description: "Flow orchestrator — Architecture design in 4 DDD phases on a leash."
---
<!-- aidakit:generated flow=design template=0.11 source=governance/flows/design.yaml -->
First, inspect `$ARGUMENTS`. If it is empty, do NOT guess or proceed — print the Usage block verbatim and stop.

## Usage
**This is a flow orchestrator command.** It drives the `design` flow via the engine (`node "$AIDAKIT_GOVERNANCE/cli.js"`).

**Expected inputs:** <free-form project> (implicit — no verb needed) · `resume <flow_id> <outcome> [key=value ...]` · `status <flow_id>` · `abort <flow_id>` · `list`

**Reserved verbs:** `resume`, `status`, `abort`, `list`. Anything else — including a bare free-form request — is read as the start payload (see "Implicit start" below).

**Examples (copy-paste):**
- `/aidakit:flow-design <project>`
- `/aidakit:flow-design status <flow_id>`

Human interface to the `design` flow (the engine in `governance/`, which does NOT get renamed). Translate the user's request into the engine's CLI and run it via Bash. **Every command below is self-guarding**: each one chains the fail-closed check (`: "${AIDAKIT_GOVERNANCE?agent-validator-paths: AIDAKIT_GOVERNANCE not set — SessionStart hook missing (see docs/guides/flows.md §6)}"`) ahead of the `node` call, so running any single bullet in isolation — not just the first one in a session — still fails loud if the `SessionStart` hook (see [ADR-012](../docs/decisions/ADR-012-aidakit-governance-session-wide.md), `docs/guides/flows.md` §6) is missing or broken, instead of a silent relative-path fallback.

## What this flow does

Architecture design in 4 DDD phases on a leash.
The engine enforces the order (Business → Modeling → Architecture → Implementation),
stops at each human gate and persists state. Each phase invokes the interview skill
that drives the conversation; the engine guarantees no phase is skipped and no gate is
bypassed. At the end, the vertical changes are ready. Run /aidakit:flow-full (or
/aidakit:flow-fast) to build the first change.

## Implicit start — the default verb

Bare `$ARGUMENTS` starts the flow directly — no `start`/`<flow>`/`<key>=` typed — UNLESS it matches one of the reserved verbs below, checked in this exact order:

1. **`resume` / `status` / `abort`** — recognized only when the 1st token is exactly that verb AND the 2nd token is flow_id-shaped: it matches `^[a-z][a-z0-9-]*-[0-9]{6}-[0-9a-f]{1,6}$` (e.g. `full-260727-ec4472`). If the 2nd token is absent or doesn't match, the WHOLE `$ARGUMENTS` falls through to start.
2. **`list`** — recognized only when `$ARGUMENTS` is EXACTLY the sole token `list` (nothing after it). `list all invoices` is NOT the list verb — it starts a flow with that payload.
3. **Otherwise** — the ENTIRE `$ARGUMENTS` is the start payload.

**Inversion of control:** when the flow pauses on an `invoke` step, the CLI prints the dispatch (which skill/subagent to run). Run it (via the named `aidakit:*` skill/agent), obtain the outcome, and resume with `resume`. When it pauses on a `human_gate`/`human_handoff`, present the prompt to the user and wait for their answer before resuming. Never invent an outcome — an invalid outcome re-pauses the gate.

- <free-form project> → `: "${AIDAKIT_GOVERNANCE?agent-validator-paths: AIDAKIT_GOVERNANCE not set — SessionStart hook missing (see docs/guides/flows.md §6)}"; node "$AIDAKIT_GOVERNANCE/cli.js" start design project="$ARGUMENTS"` (starts the `design` flow with the bare `$ARGUMENTS` as `project`.)
- `resume <flow_id> <outcome> [key=value ...]` → `: "${AIDAKIT_GOVERNANCE?agent-validator-paths: AIDAKIT_GOVERNANCE not set — SessionStart hook missing (see docs/guides/flows.md §6)}"; node "$AIDAKIT_GOVERNANCE/cli.js" resume <flow_id> <outcome> [key=value ...]` (resumes a paused flow; the `key=value` tokens carry the step's declared structured outputs when the paused step requires them)
- `status <flow_id>` → `: "${AIDAKIT_GOVERNANCE?agent-validator-paths: AIDAKIT_GOVERNANCE not set — SessionStart hook missing (see docs/guides/flows.md §6)}"; node "$AIDAKIT_GOVERNANCE/cli.js" status <flow_id>`
- `abort <flow_id>` → `: "${AIDAKIT_GOVERNANCE?agent-validator-paths: AIDAKIT_GOVERNANCE not set — SessionStart hook missing (see docs/guides/flows.md §6)}"; node "$AIDAKIT_GOVERNANCE/cli.js" abort <flow_id>`
- `list` → `: "${AIDAKIT_GOVERNANCE?agent-validator-paths: AIDAKIT_GOVERNANCE not set — SessionStart hook missing (see docs/guides/flows.md §6)}"; node "$AIDAKIT_GOVERNANCE/cli.js" list` (available flows: the plugin defaults + those in the repo's `.aidakit/flows/`)

Full guide: `docs/guides/flows.md`. Engine source of truth: `governance/README.md`. Authority and gates doctrine: `GOVERNANCE.md` at the plugin root.

User request: $ARGUMENTS

<!-- aidakit v0.11 — flow-design: generated per-flow command (governance/commands/generate-flow-commands.js, ADR-017) -->
