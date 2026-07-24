---
description: Flow orchestrator — puts the leash on design flow via the engine, enforcing the order of the 4 DDD phases and a human gate between each
---

First, inspect `$ARGUMENTS`. If it is empty or does not start with one of the
verbs below (`start`, `resume`, `status`, `abort`, `list`), do NOT guess or
proceed — print the Usage block verbatim and stop.

## Usage
**This is a flow orchestrator command.** It drives the `design` flow via the engine (`node "$AIDAKIT_GOVERNANCE/cli.js"`).

**Expected inputs:** `start design project="..."` · `resume <flow_id> <outcome>` · `status <flow_id>` · `abort <flow_id>` · `list`

**Examples (copy-paste):**
- `/aidakit:flow-design start design project="loyalty program"`
- `/aidakit:flow-design status <flow_id>`

Human interface to **design the architecture of a new project** — from business to implementation plan — under the executable flow engine (the engine in `governance/`, which does NOT get renamed). Unlike the old conversational version (the `aidakit:design` skill, now retired), here the **engine is the leash**: it enforces the order of the 4 DDD phases and a **mandatory human gate** between each, instead of relying on the discipline of a script skill. Translate the user's request into the engine's CLI and run it via Bash. **Every command below is self-guarding**: each one chains the fail-closed check (`: "${AIDAKIT_GOVERNANCE?agent-validator-paths: AIDAKIT_GOVERNANCE not set — SessionStart hook missing (see docs/guides/flows.md §6)}"`) ahead of the `node` call, so running any single bullet in isolation — not just the first one in a session — still fails loud if the `SessionStart` hook (see [ADR-012](../docs/decisions/ADR-012-aidakit-governance-session-wide.md), `docs/guides/flows.md` §6) is missing or broken, instead of a silent relative-path fallback.

- `start design project="..."` → `: "${AIDAKIT_GOVERNANCE?agent-validator-paths: AIDAKIT_GOVERNANCE not set — SessionStart hook missing (see docs/guides/flows.md §6)}"; node "$AIDAKIT_GOVERNANCE/cli.js" start design project="..."` (starts the `design` flow for the named project)
- `resume <flow_id> <outcome>` → `: "${AIDAKIT_GOVERNANCE?agent-validator-paths: AIDAKIT_GOVERNANCE not set — SessionStart hook missing (see docs/guides/flows.md §6)}"; node "$AIDAKIT_GOVERNANCE/cli.js" resume <flow_id> <outcome>` (resumes a paused `design` flow, passing the step's outcome)
- `status <flow_id>` → `: "${AIDAKIT_GOVERNANCE?agent-validator-paths: AIDAKIT_GOVERNANCE not set — SessionStart hook missing (see docs/guides/flows.md §6)}"; node "$AIDAKIT_GOVERNANCE/cli.js" status <flow_id>`
- `abort <flow_id>` → `: "${AIDAKIT_GOVERNANCE?agent-validator-paths: AIDAKIT_GOVERNANCE not set — SessionStart hook missing (see docs/guides/flows.md §6)}"; node "$AIDAKIT_GOVERNANCE/cli.js" abort <flow_id>`
- `list` → `: "${AIDAKIT_GOVERNANCE?agent-validator-paths: AIDAKIT_GOVERNANCE not set — SessionStart hook missing (see docs/guides/flows.md §6)}"; node "$AIDAKIT_GOVERNANCE/cli.js" list` (confirms that `design` is among the available flows)

**The 4 phases are skills the flow dispatches, in order, with a forced human gate between each** (the flow `governance/flows/design.yaml`): phase 1 `aidakit:design-business` (Business) → phase 2 `aidakit:design-modeling` (DDD Modeling) → phase 3 `aidakit:design-architecture` (Architecture) → phase 4 `aidakit:design-implementation` (Implementation). Each phase conducts the interview, writes its deliverable in `docs/design/` and returns `ready`; the flow then pauses on a `human_gate` for the owner to approve before releasing the next phase. The order and the gates live in the flow — the owner doesn't depend on the skill "remembering" to stop; the engine stops for it.

**The leash, in practice:** the engine enforces every step. When the flow pauses on an `invoke` step (one of the phases), the CLI prints the dispatch (which `aidakit:*` skill to run); run it, obtain the outcome (`ready`) and resume with `resume <flow_id> ready`. When it pauses on a phase-approval `human_gate`, present the prompt to the owner and wait for their decision before resuming — never invent an outcome; an invalid outcome re-pauses the gate. It's this inversion of control that guarantees no phase advances without the deliverable ready and without the owner's explicit "approve".

**Resuming a design in progress:** `: "${AIDAKIT_GOVERNANCE?agent-validator-paths: AIDAKIT_GOVERNANCE not set — SessionStart hook missing (see docs/guides/flows.md §6)}"; node "$AIDAKIT_GOVERNANCE/cli.js" resume <flow_id> <outcome>` — the engine holds the flow's state (current phase, deliverables already approved, stopping point), so the design continues exactly from where it stopped, without redoing an approved phase. Use `status <flow_id>` to see which phase the flow is on.

On finishing the 4 phases, the handoff is to `/aidakit:flow-build`, which builds each change from plan to PR (the build flow itself picks the next ready change at startup).

Flows guide: `docs/guides/flows.md`. Engine source of truth: `governance/README.md`. Authority and gates doctrine: `GOVERNANCE.md` at the plugin root.

User request (project name/description): $ARGUMENTS

<!-- aidakit v0.3 — /aidakit:design becomes the LEASH: starts/resumes the design flow (governance/cli.js) that enforces the 4 DDD phases (skills design-business/modeling/architecture/implementation) with a human gate between each; replaces the conversational design skill (retired), 2026-07-17 -->
<!-- aidakit v0.5 — renamed /aidakit:design → /aidakit:flow-design (flow group prefix, command-grouping-and-inputs); adds the classification-led description, Usage block and empty/malformed-$ARGUMENTS guard, 2026-07-24 -->
<!-- aidakit v0.6 — agent-validator-paths session-wide AIDAKIT_GOVERNANCE, 2026-07-24 -->
<!-- aidakit v0.7 — agent-validator-paths round 2: retire the once-per-file guard allowance, chain the fail-closed check inline into every cli.js bullet so each fails loud in isolation, 2026-07-24 -->
