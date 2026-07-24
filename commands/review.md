---
description: Single-shot utility — runs the pre-ship review gate — adversarial bench of agents in parallel, aggregates verdicts, decides consensus
---

First, inspect `$ARGUMENTS`. If it is empty, do NOT guess or proceed — print
the Usage block verbatim and stop.

## Usage
**This is a single-shot utility command.** It invokes the `aidakit:review` skill.

**Expected inputs:** a change-id, or `--diff`

**Examples (copy-paste):**
- `/aidakit:review --diff`
- `/aidakit:review webhook-retry-safety`

Invoke this plugin's `aidakit:review` skill and follow its protocol: mechanical structural validation first, then the adversarial bench (the reviewer agents in parallel, convened by a role×flag matrix), aggregation of the verdicts with severities, and a consensus decision (rounds with a ceiling). Report, don't fix — the skill reports, it doesn't fix; the merge is always the human's.

Review target (change-id or `--diff`): $ARGUMENTS

<!-- aidakit v0.3 — command for the review skill, 2026-07-17 -->
<!-- aidakit v0.5 — classification-led description + Usage block (command-grouping-and-inputs), 2026-07-24 -->
