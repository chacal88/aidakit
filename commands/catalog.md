---
description: Single-shot utility — query the aidakit tool index — which skill/command/agent to use for each situation
---

This command takes a free-form question — there is no fixed grammar to malform.
If `$ARGUMENTS` is empty, do NOT skip straight to the summary: print the `## Usage`
block below verbatim **first**, then continue into the "no specific question"
behavior (the grouped index summary) right after it — both, never just one.

## Usage
**This is a single-shot utility command.** It reads `skills/catalog/INDEX.md` and answers which skill/command/agent to use.

**Expected inputs:** a free-form "which tool for X?" question (optional — empty prints this Usage block followed by the grouped index summary, grouped by the `flow` group vs the flat utilities)

**Examples (copy-paste):**
- `/aidakit:catalog do I have something for threat modeling?`
- `/aidakit:catalog` (empty — prints the Usage block, then the grouped index summary)

Read the `INDEX.md` file of this plugin's `aidakit:catalog` skill (`skills/catalog/INDEX.md`) and answer the user's question about which tool to use: $ARGUMENTS

If the user didn't ask anything specific (`$ARGUMENTS` empty), first print the `## Usage` block above verbatim, then present a summary of the index grouped by category (one line per group, with the 2-3 most useful tools of each) right after it.

<!-- aidakit v0.2 — renamed from kit-index to /aidakit:catalog -->
<!-- aidakit v0.5 — classification-led description + Usage block, printed before the grouped summary on empty $ARGUMENTS (command-grouping-and-inputs), 2026-07-24 -->
