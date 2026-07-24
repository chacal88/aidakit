---
description: Single-shot utility — starts the plan-only planning of a change — authors proposal/design/tasks without product code
---

First, inspect `$ARGUMENTS`. If it is empty, do NOT guess or proceed — print
the Usage block verbatim and stop.

## Usage
**This is a single-shot utility command.** It invokes the `aidakit:plan` skill.

**Expected inputs:** a change-id already on the roadmap, or a free-form description of the change to plan

**Examples (copy-paste):**
- `/aidakit:plan webhook-retry-safety`
- `/aidakit:plan add rate limiting to the webhook endpoint`

Invoke this plugin's `aidakit:plan` skill and follow its protocol: generate the self-contained prompt for the `aidakit:planner` agent to author the change's plan-only artifacts (proposal/design/tasks/evidence), as an OpenSpec change or under `docs/features/<change-id>/` in kit mode. Plan-only — never writes product code in this phase.

Change to plan (change-id or description): $ARGUMENTS

<!-- aidakit v0.3 — command for the plan skill, 2026-07-17 -->
<!-- aidakit v0.5 — classification-led description + Usage block (command-grouping-and-inputs), 2026-07-24 -->
