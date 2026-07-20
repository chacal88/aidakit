---
description: Deploys, audits, indexes or archives the project's standardized document architecture (DOCS.md)
---

Invoke this plugin's `aidakit:docs` skill and follow its protocol according to the requested mode: **init** (deploys the canonical DOCS.md structure in a project), **audit** (checks the 7 rules — links, placement, ADR format, legacy banners, indexes, drift), **index** (rebuilds/syncs INDEX.md and decisions/README.md), **archive** (archives a completed doc or change: dated folder, legacy banner, promotion of specs WORKING→DURABLE). Moving/deleting a doc always confirms with the human.

Mode and target: $ARGUMENTS

<!-- aidakit v0.3 — command for the docs skill, 2026-07-17 -->
