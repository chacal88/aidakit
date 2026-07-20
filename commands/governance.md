---
description: Explains, audits or onboards the project's execution governance (GOVERNANCE.md + hook)
---

Invoke this plugin's `aidakit:governance` skill and follow its protocol according to the mode: **explain** (answers questions citing the exact section of GOVERNANCE.md — including why a command was blocked by the `pre-bash` hook and how to use `AIDAKIT_BYPASS=1` with an explicit human request), **audit** (reviews conformance: bypass log, single-writer verdicts, no direct commit on main by an agent, versioned scripts), **onboarding** (prepares a repo: the 3 escalations, branch protection, adoption ADR). The skill never disables a rule nor grants an exception — an exception is a recorded human decision.

Mode and context: $ARGUMENTS

<!-- aidakit v0.3 — command for the governance skill, 2026-07-17 -->
