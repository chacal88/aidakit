---
description: Single-shot utility — (re)generates project-local flow-<name> commands from .aidakit/flows/*.yaml (ADR-017)
---

First, inspect `$ARGUMENTS`. This command takes no arguments — if `$ARGUMENTS` is
non-empty, do NOT guess or proceed — print the Usage block verbatim and stop.

## Usage
**This is a single-shot utility command.** It wears the `flow-` prefix not because it drives the engine, but because it *is* the front of the flow-command generator — the flow mechanism family ([ADR-017](../docs/decisions/ADR-017-flow-command-generation.md)).

**Expected inputs:** none — `/aidakit:flow-sync` takes no arguments.

**Examples (copy-paste):**
- `/aidakit:flow-sync`

Scans this project's `.aidakit/flows/*.yaml` and (re)generates `.claude/commands/flow-<name>.md` for each — the SAME template the plugin's own built-ins (`flow-fast`, `flow-full`, `flow-design`) are generated from, so a project flow gets a self-contained implicit-start command with no hand-authoring. Idempotent: a no-change re-run leaves the files byte-identical. Fail-closed: refuses (with a reason, per flow) a project flow named `fast`/`full`/`design` (would shadow a shipped built-in) and never overwrites a hand-authored `.claude/commands/flow-<name>.md` that lacks the `<!-- aidakit:generated ` sentinel in its header.

- `sync` (the only mode) → `: "${AIDAKIT_GOVERNANCE?agent-validator-paths: AIDAKIT_GOVERNANCE not set — SessionStart hook missing (see docs/guides/flows.md §6)}"; node "$AIDAKIT_GOVERNANCE/commands/generate-flow-commands.js" --mode consumer` (writes/updates `.claude/commands/flow-<name>.md` per `.aidakit/flows/<name>.yaml`; reports created/updated/unchanged/refused per flow)

Create a flow of your own at `.aidakit/flows/<name>.yaml` first (see `docs/guides/flows.md` §6), then run this command to get `/aidakit:flow-<name>` for free.

Full guide: `docs/guides/flows.md`. Generator source of truth: `governance/commands/generate-flow-commands.js`.

$ARGUMENTS

<!-- aidakit v0.11 — /aidakit:flow-sync: single-shot utility front for the flow-command generator's consumer mode (ADR-017), 2026-07-27 -->
