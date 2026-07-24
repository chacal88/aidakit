# Evidence — agent-validator-paths

**Change ID:** `agent-validator-paths`
**Date:** `2026-07-24`
**Owner:** `@chacal88`
**Phase / Package:** `hooks + agents + skills + commands — cwd-independent kit path for direct validator invocations`
**PRD:** `n/a`
**Tech Spec:** `n/a`

> **Pre-execution stub.** No commands have been run yet — the implementer fills each section during tasks.md execution. The intended reproductions are documented below so the implementer knows what to capture; the exact outputs are recorded here at implement time.

## Validation Outputs

### Step 1c — SessionStart hook capability finding

*Intended:* record the finding from the Claude Code hook-docs inspection (or reverse-engineering) that validates assumption 2. Include the exact hook-protocol JSON shape identified. If the assumption FAILS, this section names the failure and points at the fallback branch chosen in [design.md](design.md) §Contingency; the flow re-plans from there.

```
(to be filled at implement time — output of the hook-docs inspection / harness probe)
```

### RED — bug reproduced from a consumer cwd (pre-fix)

*Intended:* mirror the shape of [`validator-path-resolution/evidence.md`](../../archive/2026-07-23-validator-path-resolution/evidence.md) §"Consumer-repo simulation" — one Bash tool call per surface (orchestrator's `derive-roadmap-status.js`, doc-planner's `check-doc-manifest.js`, roadmap SKILL's `derive-roadmap-status.js`, flow-build's `cli.js`, flow-design's `cli.js`) executed from a cwd outside any `governance/` folder, each expected to fail with `Cannot find module '<consumer-cwd>/governance/…'`.

Reproduction template (implementer runs each and pastes the exact stderr):

```
tmp=$(mktemp -d); cd "$tmp"

# orchestrator surface
bash -lc 'node governance/validators/derive-roadmap-status.js --root .'
# → expected: MODULE_NOT_FOUND

# doc-planner surface
bash -lc 'node governance/validators/check-doc-manifest.js .aidakit/tasks/x/doc-manifest.json'
# → expected: MODULE_NOT_FOUND

# roadmap SKILL surface
bash -lc 'node governance/validators/derive-roadmap-status.js --root .'
# → expected: MODULE_NOT_FOUND

# flow-build surface
bash -lc 'node governance/cli.js list'
# → expected: MODULE_NOT_FOUND

# flow-design surface
bash -lc 'node governance/cli.js list'
# → expected: MODULE_NOT_FOUND

rm -rf "$tmp"
```

```
(to be filled at implement time — 5 MODULE_NOT_FOUND captures, one per surface)
```

### RED — regression test before implementation

*Intended:* run `node governance/__tests__/agent-validator-paths.test.mjs` after tasks.md §2.1 (test written) but before §2.2/§2.3 (hook + rewrites landed). Expected failures on cases 1, 3, 4 (guard, grep, hooks.json shape); case 2 may pass or fail depending on whether `AIDAKIT_GOVERNANCE` happens to be set in the shell.

```
(to be filled at implement time — the RED tally)
```

### GREEN — regression test after implementation

*Intended:* re-run `node governance/__tests__/agent-validator-paths.test.mjs` after tasks.md §2.2/§2.3/§2.4 complete. All 4 cases pass; assertion count matches the case count.

```
(to be filled at implement time — the GREEN tally)
```

### Mutation proof

*Intended:* after GREEN, reintroduce ONE relative-path hit (e.g. change `node "$AIDAKIT_GOVERNANCE/cli.js" list` back to `node governance/cli.js list` at `commands/flow-build.md:24`), re-run the test, confirm case 3 (grep) goes RED with the exact reintroduced line named; revert; confirm 4/4 GREEN. The intent — same as the predecessor's `docs-onboarding.yaml` mutation proof — is to demonstrate the test actually catches the regression, not just passes by chance.

```
(to be filled at implement time — RED tally with the offending line, then GREEN tally after revert)
```

### GREEN — full governance suite

*Intended:* `for f in governance/__tests__/*.test.mjs; do echo "== $f"; node "$f" 2>&1 | tail -1; done` — every file `0 failed`, no regression from touching `hooks/hooks.json` or the shipped agents/skills/commands.

```
(to be filled at implement time — one line per test file)
```

### Consumer-cwd reproduction — after fix (per surface)

*Intended:* same 5 commands as the RED block above, but with the `SessionStart` hook active (either a fresh Claude Code session, or an equivalent harness that runs the hook and then executes the surface command). Each expected to resolve the kit path via `$AIDAKIT_GOVERNANCE` and complete without `MODULE_NOT_FOUND`.

```
(to be filled at implement time — 5 successful runs, one per surface)
```

### AC1 lint

Pass/fail command (filtered sweep):

```bash
grep -rnE 'node +governance/(validators|cli|engine)' agents/ skills/ commands/ \
  | grep -vE '^skills/(catalog/INDEX|review/SKILL)\.md:'
```

*Intended:* empty stdout, exit 1 (from the trailing `grep -v` finding nothing). Records the "zero executable relative-path hits in agent/skill/command surfaces" invariant. The pipe excludes the two known descriptive-prose exceptions declared in [design.md](design.md) §"Out of scope — same rule as the predecessor" (`skills/catalog/INDEX.md:48` and `skills/review/SKILL.md:114`), so the lint can honestly hit zero.

```
(to be filled at implement time — empty output + exit code from the filtered pipe)
```

Baseline command (unfiltered inventory — must remain exactly 2 lines after the fix, no more no less):

```bash
grep -rnE 'node +governance/(validators|cli|engine)' agents/ skills/ commands/
```

```
(to be filled at implement time — the exact 2 out-of-scope lines: skills/catalog/INDEX.md:48 and skills/review/SKILL.md:114)
```

### AC2 — session env visible to Bash tool

*Intended:* in a fresh Claude Code session (post-hook-install), run `env | grep AIDAKIT_GOVERNANCE`. Assert one line, key = `AIDAKIT_GOVERNANCE`, value = `<plugin-root>/governance` where `<plugin-root>` is the path Claude Code substituted for `${CLAUDE_PLUGIN_ROOT}` at hook-manifest time.

```
(to be filled at implement time — the exact env line, with plugin-root anonymized if it contains user-identifying prefixes)
```

### Links

Command: `node governance/validators/check-links.js docs/features/agent-validator-paths docs/decisions docs/guides/flows.md governance/README.md hooks/`

*Intended:* exit 0; all internal links resolve, including the newly-added ADR-010 pointer in `README.md` / `governance/README.md` / `flows.md` / ADR-010 itself.

```
(to be filled at implement time)
```

## Files Touched

*Intended shape:*

```
$ git status --porcelain
 M docs/decisions/README.md
 M docs/decisions/ADR-004-aidakit-governance-env-contract.md
 M docs/guides/flows.md
 M docs/roadmap/epics/EPIC-flow-engine-leashes.md
 M governance/README.md
 M hooks/hooks.json
 M agents/orchestrator.md
 M agents/doc-planner.md
 M skills/roadmap/SKILL.md
 M commands/flow-build.md
 M commands/flow-design.md
?? docs/decisions/ADR-010-aidakit-governance-session-wide.md
?? docs/features/agent-validator-paths/
?? hooks/session-start.js
?? governance/__tests__/agent-validator-paths.test.mjs

$ git diff --stat
(to be filled at implement time)
```

Matches the scope declared in [proposal.md](proposal.md): 1 new hook manifest edit + 1 new hook script + 5 markdown rewrites (2 agents + 1 skill + 2 commands) + 4 doc edits (flows.md, governance/README.md, decisions/README.md, ADR-004 `## Amendments` append) + 1 roadmap Aceite edit (`EPIC-flow-engine-leashes.md`) + 1 new ADR + 1 new test file + this change directory. The ADR-004 modification is a strict **append** of a new `## Amendments` section at the tail; the pre-existing Context/Decision/Consequences/Review-trigger/Alternatives content is byte-identical (grep-verifiable via `git diff docs/decisions/ADR-004-aidakit-governance-env-contract.md` — the diff should show only added lines at file tail).

## Unresolved Deviations

### AC4 reconciliation — literal "in-place amend" vs WORM

The brainstorm distillate at [`.aidakit/tasks/agent-validator-paths/events.ndjson`](../../../.aidakit/tasks/agent-validator-paths/events.ndjson) records AC4 literally as "ADR-004 is amended **in-place** (kind:amend, not superseded)". Read literally, "in-place" contradicts [DOCS.md](../../../DOCS.md) §2 rule 2 (WORM: never edit a past decision's body — a changed mind lands as a new ADR that supersedes or amends). This plan satisfies AC4 via the ADR-007→ADR-002 **amendment pattern** (which is also what ADR-004's own §Review trigger authorized), not via a literal edit of ADR-004's Context/Decision/Consequences/Alternatives:

- A new ADR ([ADR-010](../../decisions/ADR-010-aidakit-governance-session-wide.md)) is written with `Status: accepted (amends [ADR-004](ADR-004-aidakit-governance-env-contract.md))` — same shape as [ADR-007](../../decisions/ADR-007-roadmap-status-from-shared-git.md).
- A `## Amendments` back-link section is appended to the tail of ADR-004 — same shape as [`docs/decisions/ADR-002-roadmap-status-derived-from-disk.md:42-44`](../../decisions/ADR-002-roadmap-status-derived-from-disk.md). The append is a metadata-only surface (bidirectional pointer per DOCS.md §2 rule 2); ADR-004's Context/Decision/Consequences/Review-trigger/Alternatives bodies are not touched.

**Reading AC4 as this ADR-007-style pattern is the reconciliation**; a future audit reading the literal brainstorm word "in-place" should be pointed here to see that (a) the mechanism is the repo's own established amendment pattern, (b) WORM stays intact, (c) the bidirectional linking DOCS.md requires is satisfied. This note stands even if all other Unresolved Deviations resolve to `None`.

### Other deviations

*To be filled at implement time.* If step 1c reveals the SessionStart-env assumption fails, name here the fallback taken (A/B/C from [design.md](design.md) §Contingency), the extra scope it introduces, and any additional review round it triggers.

Two Open Questions from [proposal.md](proposal.md) also close here:

- **Assumption validation** (proposal.md OQ 1) — resolved by the finding in "Step 1c" above.
- **Guard placement — inline vs once-per-file** (proposal.md OQ 2) — resolved by the reviewer's call; document here which convention was applied.

If none of the above surfaces an issue: write `None` explicitly.
