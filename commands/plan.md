---
description: Starts the plan-only planning of a change — authors proposal/design/tasks without product code
---

Invoke this plugin's `aidakit:plan` skill and follow its protocol: generate the self-contained prompt for the `aidakit:planner` agent to author the change's plan-only artifacts (proposal/design/tasks/evidence), as an OpenSpec change or under `docs/features/<change-id>/` in kit mode. Plan-only — never writes product code in this phase.

Change to plan (change-id or description): $ARGUMENTS

<!-- aidakit v0.3 — command for the plan skill, 2026-07-17 -->
