---
description: Single-shot utility — explains, audits or onboards the project's execution governance (GOVERNANCE.md + hook)
---

First, inspect `$ARGUMENTS`. If it is empty or the mode is not one of `explain`,
`audit`, `onboarding`, do NOT guess or proceed — print the Usage block verbatim
and stop.

## Usage
**This is a single-shot utility command.** It invokes the `aidakit:governance` skill.

**Expected inputs:** `<mode> <context>` with mode ∈ {`explain`, `audit`, `onboarding`}

**Examples (copy-paste):**
- `/aidakit:governance explain why did the hook block my push?`
- `/aidakit:governance audit`

Invoke this plugin's `aidakit:governance` skill and follow its protocol according to the mode: **explain** (answers questions citing the exact section of GOVERNANCE.md — including why a command was blocked by the `pre-bash` hook and how to use `AIDAKIT_BYPASS=1` with an explicit human request), **audit** (reviews conformance: bypass log, single-writer verdicts, no direct commit on main by an agent, versioned scripts), **onboarding** (prepares a repo: the 3 escalations, branch protection, adoption ADR). The skill never disables a rule nor grants an exception — an exception is a recorded human decision.

Mode and context: $ARGUMENTS

<!-- aidakit v0.3 — command for the governance skill, 2026-07-17 -->
<!-- aidakit v0.5 — classification-led description + Usage block (command-grouping-and-inputs), 2026-07-24 -->
