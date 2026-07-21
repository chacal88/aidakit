---
description: Builds a change from plan to PR via the aidakit flow engine — start, resume, status, abort, list
---

Human interface to build **one change** — from plan to PR — on top of the executable flow engine (the engine in `governance/`, which does NOT get renamed). Translate the user's request into the engine's CLI and run it via Bash:

- `start <flow> [key=value ...]` → `node governance/cli.js start <flow> ...` (starts; e.g. `build start fast request="..."`)
- `resume <flow_id> <outcome>` → `node governance/cli.js resume <flow_id> <outcome>` (resumes a paused flow)
- `status <flow_id>` → `node governance/cli.js status <flow_id>`
- `abort <flow_id>` → `node governance/cli.js abort <flow_id>`
- `list` → `node governance/cli.js list` (available flows: the plugin defaults + those in the repo's `.aidakit/flows/`)

**The 1st step picks the change:** the first step of the flows (`governance/flows/fast.yaml` and `full.yaml`) runs the `aidakit:orchestrator` agent to pick the next ready change from the plan (logic previously exposed as a separate command, now absorbed). You don't have to point at the change by hand — the flow selects it at startup; if the user names an explicit change in the request, pass it through as a parameter.

**Inversion of control:** when the flow pauses on an `agent` step, the CLI prints the dispatch (which skill/subagent to run). Run it (via the named `aidakit:*` skill/agent), obtain the outcome, and resume with `resume`. When it pauses on a `human_gate`/`human_handoff`, present the prompt to the user and wait for their answer before resuming. Never invent an outcome — an invalid outcome re-pauses the gate.

Full guide: `docs/guides/flows.md`. Engine source of truth: `governance/README.md`.

User request: $ARGUMENTS

<!-- aidakit v0.3 — /aidakit:build: builds a change (flow engine in governance/); 1st step absorbs the change selection, 2026-07-17 -->
