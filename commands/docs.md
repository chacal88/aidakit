---
description: Single-shot utility — deploys, audits, indexes or archives the project's standardized document architecture (DOCS.md)
---

First, inspect `$ARGUMENTS`. If it is empty or the mode is not one of `init`,
`audit`, `index`, `archive`, do NOT guess or proceed — print the Usage block
verbatim and stop.

## Usage
**This is a single-shot utility command.** It invokes the `aidakit:docs` skill.

**Expected inputs:** `<mode> <target>` with mode ∈ {`init`, `audit`, `index`, `archive`}

**Examples (copy-paste):**
- `/aidakit:docs audit .`
- `/aidakit:docs archive docs/features/<change-id>`

Invoke this plugin's `aidakit:docs` skill and follow its protocol according to the requested mode: **init** (deploys the canonical DOCS.md structure in a project), **audit** (checks the 7 rules — links, placement, ADR format, legacy banners, indexes, drift), **index** (rebuilds/syncs INDEX.md and decisions/README.md), **archive** (archives a completed doc or change: dated folder, legacy banner, promotion of specs WORKING→DURABLE). Moving/deleting a doc always confirms with the human.

Mode and target: $ARGUMENTS

<!-- aidakit v0.3 — command for the docs skill, 2026-07-17 -->
<!-- aidakit v0.5 — classification-led description + Usage block (command-grouping-and-inputs), 2026-07-24 -->
