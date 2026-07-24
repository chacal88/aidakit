# Tasks — agent-validator-paths

**Change ID:** `agent-validator-paths`
**Date:** `2026-07-24`
**Owner:** `@chacal88`
**Phase / Package:** `hooks + agents + skills + commands — cwd-independent kit path for direct validator invocations`
**PRD:** `n/a`
**Tech Spec:** `n/a`

> Sections 1 and 2 are **order-dependent**. Do 1 first (validate the `SessionStart` env-export assumption — if it fails, escalate to the fallback branch in [design.md](design.md) §Contingency, don't proceed). Then do 2.1 (RED test) BEFORE 2.2/2.3 (the GREEN work). Do not reorder.

## 1. Setup — validate the assumption first

- [ ] Confirm a clean worktree; `node governance/__tests__/engine.test.mjs` GREEN as baseline.
- [ ] Re-run the grep sweep against the live files (line numbers in [design.md](design.md) may drift): `grep -rnE 'node +governance/(validators|cli|engine)' agents/ skills/ commands/`. Record the count and file list in [evidence.md](evidence.md) — this is the pre-fix count that AC1 will drive to zero.
- [ ] **Validate the `SessionStart` hook capability.** Consult the Claude Code hook documentation (or, if the docs are ambiguous, reverse-engineer from the existing `hooks/hooks.json` + any plugin fixtures the kit has). Confirm: (a) `SessionStart` is a supported matcher; (b) the hook receives `CLAUDE_PLUGIN_ROOT` in its own env; (c) the hook can export session-wide env vars visible to subsequent Bash tool calls, and identify the exact hook-protocol JSON shape (e.g. `{"session":{"env":{"AIDAKIT_GOVERNANCE":"..."}}}` or whatever the protocol uses). Record the finding — and the exact protocol shape — in [evidence.md](evidence.md).
- [ ] **Decision gate.** If step 1c fails (no supported env-export path), STOP and escalate — the flow re-plans against [design.md](design.md) §Contingency (Fallback A/B/C). Do NOT invent a mechanism that "should work" — the whole change hinges on this assumption.

## 2. Surface Work — hooks + call sites + test (ordered: RED → GREEN)

### 2.1 RED — write the regression test first

- [ ] Create [`governance/__tests__/agent-validator-paths.test.mjs`](../../../governance/__tests__/agent-validator-paths.test.mjs) with the 4 cases spelled in [design.md](design.md) §"Regression test — AC5":
  1. guard fails loud with `AIDAKIT_GOVERNANCE` unset (non-zero exit + stderr contains `AIDAKIT_GOVERNANCE not set` AND `agent-validator-paths`),
  2. guard passes when set,
  3. `grep -rE 'node +governance/(validators|cli|engine)' agents/ skills/ commands/` produces zero lines,
  4. `hooks/hooks.json` declares a `SessionStart` hook that runs `hooks/session-start.js` via `${CLAUDE_PLUGIN_ROOT}`.
- [ ] Run `node governance/__tests__/agent-validator-paths.test.mjs`. Confirm cases 1, 3, and 4 go **RED** (grep still finds hits; `hooks.json` has no SessionStart entry; the guard one-liner has nothing to protect yet). Case 2 will only be meaningful after the hook exists. Record the RED output in [evidence.md](evidence.md).

### 2.2 GREEN part 1 — write the hook

- [ ] Create [`hooks/session-start.js`](../../../hooks/session-start.js) using the exact hook-protocol JSON shape identified in step 1c. Value: `AIDAKIT_GOVERNANCE = ${CLAUDE_PLUGIN_ROOT}/governance`. Fail-loud stderr path when `CLAUDE_PLUGIN_ROOT` is empty, non-zero exit.
- [ ] Edit [`hooks/hooks.json`](../../../hooks/hooks.json) to add the `SessionStart` block alongside the existing `PreToolUse/Bash` block (verbatim shape in [design.md](design.md) §Mechanism).
- [ ] **Empirical verification.** In a fresh Claude Code session (or via any equivalent hook harness the implementer has), run `env | grep AIDAKIT_GOVERNANCE` in a Bash tool call. Assert the variable is set and points at the kit's `governance/` directory. Record the output in [evidence.md](evidence.md). If it is NOT set, do NOT proceed — go back to step 1c and revise the protocol shape.

### 2.3 GREEN part 2 — rewrite the 17 call sites (+ inline guard)

Per the inventory table in [design.md](design.md) §"In-scope call-site inventory". Do each file in isolation; run the grep-lint (case 3 of the test) after each save to catch a missed hit.

- [ ] [`agents/orchestrator.md`](../../../agents/orchestrator.md) line 50 — swap `derive-roadmap-status.js` call to the `$AIDAKIT_GOVERNANCE` form, prefixed by the guard one-liner (or reference a once-per-file guard block, at the reviewer's discretion — see [proposal.md](proposal.md) Open Question 2).
- [ ] [`agents/doc-planner.md`](../../../agents/doc-planner.md) line 155 — swap `check-doc-manifest.js` call.
- [ ] [`skills/roadmap/SKILL.md`](../../../skills/roadmap/SKILL.md) line 64 — swap `derive-roadmap-status.js` call inside the fenced block.
- [ ] [`commands/flow-build.md`](../../../commands/flow-build.md) — swap 7 hits (lines 10, 20, 21, 22, 23, 24, 34, 37 per current file — re-verify line numbers). Include the `$Usage` prose backtick on line 10.
- [ ] [`commands/flow-design.md`](../../../commands/flow-design.md) — swap 6 hits (lines 10, 20, 21, 22, 23, 24, 30 — same drift caveat).
- [ ] Re-run the grep sweep (`grep -rnE 'node +governance/(validators|cli|engine)' agents/ skills/ commands/`) and confirm **zero** hits. Record the empty output in [evidence.md](evidence.md).
- [ ] Bump the doctrine footer (`<!-- aidakit vX.Y — agent-validator-paths session-wide AIDAKIT_GOVERNANCE, 2026-07-24 -->`) at the tail of each of the 5 edited files, matching the repo convention visible in [`commands/flow-build.md:45-48`](../../../commands/flow-build.md) etc.

### 2.4 GREEN part 3 — the ADR

- [ ] Write [`docs/decisions/ADR-010-aidakit-governance-session-wide.md`](../../decisions/ADR-010-aidakit-governance-session-wide.md) using the shape in [design.md](design.md) §"ADR-004 amendment shape". Match the format of [ADR-007](../../decisions/ADR-007-roadmap-status-from-shared-git.md) exactly (WORM header, 5 sections, Status header naming the amendment target, Alternatives table lifted from `design.md`).
- [ ] Validate: `node governance/validators/check-adr-format.js docs/decisions/ADR-010-aidakit-governance-session-wide.md` → exit 0.
- [ ] Register ADR-010 in [`docs/decisions/README.md`](../../decisions/README.md): add an index row and place it in the "Flow engine" thematic grouping next to ADR-004 (follow the file's existing convention — inspect first).

## 3. Documentation

- [ ] [`docs/guides/flows.md`](../../guides/flows.md) §3 (line ~67, `${...}` vs `$FOO` explainer): broaden `$AIDAKIT_GOVERNANCE`'s description to name both injection points (runs.js + SessionStart hook) and cross-link ADR-010.
- [ ] [`docs/guides/flows.md`](../../guides/flows.md) §5: inspect for any wording that scopes `AIDAKIT_GOVERNANCE` to `runs`-only; adjust to session-wide.
- [ ] [`docs/guides/flows.md`](../../guides/flows.md) §6 (line ~187, "Calling a kit validator from a flow of your own"): broaden per [design.md](design.md) §"Doc alignment". Cross-link ADR-010.
- [ ] Bump the doctrine footer of `docs/guides/flows.md` (`<!-- aidakit v0.6 — session-wide AIDAKIT_GOVERNANCE via SessionStart hook (§3, §6), agent-validator-paths, 2026-07-24 -->`).
- [ ] [`governance/README.md`](../../../governance/README.md) line 61: broaden the sentence per [design.md](design.md) §"Doc alignment"; cross-link ADR-010.
- [ ] `## Files Touched` filled in [evidence.md](evidence.md).

## 4. Validation

- [ ] **Regression test GREEN**: `node governance/__tests__/agent-validator-paths.test.mjs` → 0 failures (all 4 cases pass). Record output in [evidence.md](evidence.md).
- [ ] **Mutation proof** (recorded, not just asserted): temporarily reintroduce one relative-path hit (e.g. `node governance/cli.js list` in `commands/flow-build.md` line 24), re-run the test file, confirm case 3 goes RED with the exact reintroduced line surfaced; revert; confirm GREEN. Record the RED-then-GREEN sequence in [evidence.md](evidence.md).
- [ ] **Full engine suite**: `node governance/__tests__/engine.test.mjs` → 0 failures (no regression from touching `hooks/hooks.json`).
- [ ] **Full governance suite**: `for f in governance/__tests__/*.test.mjs; do echo "== $f"; node "$f" 2>&1 | tail -1; done` → every file `0 failed`.
- [ ] **AC1 verified as a shell one-liner**: `grep -rE 'node +governance/(validators|cli|engine)' agents/ skills/ commands/` → empty stdout, exit 1. Record in [evidence.md](evidence.md).
- [ ] **AC2 verified in a live session** (or the equivalent harness identified in step 1c): `env | grep AIDAKIT_GOVERNANCE` → set to `<plugin-root>/governance`. Record the exact output.
- [ ] **AC3 — consumer-cwd reproduction, before and after.** With the hook DISABLED (revert `hooks/hooks.json` temporarily or point Claude Code at a version without it), run one command from each surface (orchestrator, doc-planner, roadmap SKILL, flow-build, flow-design) from a cwd outside any `governance/` folder; capture the `Cannot find module` failure. Re-enable the hook; re-run each; capture the success. This mirrors [`validator-path-resolution/evidence.md`](../../archive/2026-07-23-validator-path-resolution/evidence.md) §"Consumer-repo simulation".
- [ ] **Links**: `node governance/validators/check-links.js docs/features/agent-validator-paths docs/decisions docs/guides/flows.md governance/README.md hooks/` → exit 0.
- [ ] **Scope discipline**: `git diff --stat` matches the scope declared in [proposal.md](proposal.md) — `hooks/hooks.json`, `hooks/session-start.js` (new), 5 markdown files (2 agents + 1 skill + 2 commands), `docs/guides/flows.md`, `governance/README.md`, `docs/decisions/README.md`, `docs/decisions/ADR-010-aidakit-governance-session-wide.md` (new), `governance/__tests__/agent-validator-paths.test.mjs` (new), plus this change directory. No stray edits.

## 5. Cleanup

- [ ] No stray files outside declared scope.
- [ ] `## Unresolved Deviations` in [evidence.md](evidence.md) filled (or explicitly "None"). If step 1c revealed the SessionStart-env assumption fails, this section names the fallback taken and why.
- [ ] Confirm the two Open Questions in [proposal.md](proposal.md) are resolved (assumption 2 validated in step 1c; guard placement per-line vs once-per-file resolved during review).
- [ ] Do NOT bump `.claude-plugin/plugin.json` (release-commit convention). Do NOT touch [ADR-004](../../decisions/ADR-004-aidakit-governance-env-contract.md)'s body (WORM). Do NOT commit — the flow's `commit_plan` step handles that.
