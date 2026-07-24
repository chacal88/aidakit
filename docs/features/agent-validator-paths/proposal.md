# Proposal — agent-validator-paths

**Change ID:** `agent-validator-paths`
**Date:** `2026-07-24`
**Owner:** `@chacal88`
**Phase / Package:** `hooks + agents + skills + commands — cwd-independent kit path for direct validator invocations`
**PRD:** `n/a`
**Tech Spec:** `n/a`

## Why

The predecessor [`validator-path-resolution`](../../archive/2026-07-23-validator-path-resolution/proposal.md) closed the cwd-dependence of validator calls made from `runs` steps by injecting `AIDAKIT_GOVERNANCE` in [`governance/engine/steps/runs.js`](../../../governance/engine/steps/runs.js). Its own §Non-goal 2 named the leftover vector: every place we teach an **agent, skill, or command** to run a kit script directly (`node governance/…`) still uses a relative path, and those Bash sessions never pass through `runs.js` — the injected env var never reaches them. The defect is identical (`Cannot find module '<consumer-cwd>/governance/…'` in any repo that is not the kit itself); the vector is different.

Roadmap owns the debit as [`agent-validator-paths` under EPIC-flow-engine-leashes](../../roadmap/epics/EPIC-flow-engine-leashes.md) (line 25-26). [ADR-004](../../decisions/ADR-004-aidakit-governance-env-contract.md) §Consequences explicitly `Mitigated`s the same concern ("`runs`-step children [only] … carry the same relative-path defect via a different vector … needing its own mechanism") and pins the amendment path in its Review trigger: "If `agent-validator-paths` (the follow-up debit) lands with a *different* variable name or mechanism for the same concern, amend this ADR to point at the unified mechanism instead of two divergent ones."

The brainstorm broadened the inventory: the same relative-path shape also lives in `commands/flow-build.md` and `commands/flow-design.md`, which repeat `node governance/cli.js …` in every verb mapping the SlashCommand teaches Claude to run. Those hits are in-scope for the same reason as the agent/skill hits: they are Bash-executed by Claude sessions that never touch `runs.js`.

**Context:** anyone dogfooding the kit (psim-kernel migration is the driving case) or a user in any consumer repo triggering `/aidakit:flow-build`, `/aidakit:flow-design`, `aidakit:orchestrator`, `aidakit:doc-planner`, or `aidakit:roadmap` from a cwd outside the kit repo — every one of those paths currently attempts a relative-path resolution that only works inside the kit's own worktree.
**Impact:** a consumer session can never advance past the first direct-invocation step; it fails with `Cannot find module` and (per the predecessor's known routing debit, non-goal 1 there) can even loop silently in downstream flows that route the exit code back into the same instruction. The bug is fully reproducible and blocks the consumer story of the whole kit.

## What Changes

- **New `SessionStart` hook** in [`hooks/hooks.json`](../../../hooks/hooks.json) + a new [`hooks/session-start.js`](../../../hooks/session-start.js): reads `CLAUDE_PLUGIN_ROOT` (the value Claude Code substitutes into the hook manifest) and prints the Claude Code hook-protocol JSON that exports `AIDAKIT_GOVERNANCE=${CLAUDE_PLUGIN_ROOT}/governance` into the session's Bash-tool env. Fail-loud: if `CLAUDE_PLUGIN_ROOT` is empty at hook time, the hook logs a diagnostic to stderr and exits non-zero so the session's env stays unset — the fail-closed guard in step 3 will then surface a legible error at the first invocation instead of a `Cannot find module`.
- **Rewrite every in-scope call site** in `agents/`, `skills/`, `commands/` to `node "$AIDAKIT_GOVERNANCE/(validators|cli|engine)/…"`, quoting for spaces in the plugin cache path. Inventory (verified by `grep -rnE 'node +governance/(validators|cli|engine)' agents/ skills/ commands/` — 20 raw hits, minus 2 descriptive-prose exceptions = 18 in-scope; full table in [design.md](design.md)): [agents/orchestrator.md:50](../../../agents/orchestrator.md), [agents/doc-planner.md:155](../../../agents/doc-planner.md), [skills/roadmap/SKILL.md:64](../../../skills/roadmap/SKILL.md), [commands/flow-build.md](../../../commands/flow-build.md) (8 hits: lines 10, 20, 21, 22, 23, 24, 34, 37), [commands/flow-design.md](../../../commands/flow-design.md) (7 hits: lines 10, 20, 21, 22, 23, 24, 30). Descriptive-prose mentions of `governance/…` file paths that are NOT executed commands stay unchanged — specifically `skills/catalog/INDEX.md:48` and `skills/review/SKILL.md:114` (same rule as the predecessor's out-of-scope table).
- **Fail-closed guard for direct callers.** Each rewritten instruction is prefixed with a one-liner (or documented once at the top of each file) that asserts `AIDAKIT_GOVERNANCE` is set: e.g. `: "${AIDAKIT_GOVERNANCE?agent-validator-paths: AIDAKIT_GOVERNANCE not set — SessionStart hook missing (see docs/guides/flows.md §6)}"`. Never a relative-path fallback — silent fallback would mask a broken hook and re-import the very bug this change closes.
- **New [ADR-010](../../decisions/ADR-010-aidakit-governance-session-wide.md)** amending [ADR-004](../../decisions/ADR-004-aidakit-governance-env-contract.md) to broaden the `AIDAKIT_GOVERNANCE` contract from `runs`-child-only to **session-wide** (the value is the same, the injection surface is wider). ADR-004's body stays intact per WORM ([DOCS.md](../../../DOCS.md) rule 2 — Context/Decision/Consequences/Review trigger/Alternatives untouched); ADR-010 is registered in [`docs/decisions/README.md`](../../decisions/README.md) and follows the same pattern [ADR-007](../../decisions/ADR-007-roadmap-status-from-shared-git.md) uses to amend [ADR-002](../../decisions/ADR-002-roadmap-status-derived-from-disk.md) (Status header names the amendment; body of the amended ADR is not edited). Chosen expressly because ADR-004's Review trigger authorized it.
- **Bidirectional link on ADR-004.** An `## Amendments` section is appended to the tail of ADR-004 with a one-line back-link to ADR-010 (mirroring [ADR-002:42-44](../../decisions/ADR-002-roadmap-status-derived-from-disk.md) — the append ADR-002 gained when ADR-007 amended it). DOCS.md §2 rule 2 mandates the reverse pointer; a metadata append at the tail is WORM-compliant because the Context/Decision/Consequences/Review-trigger/Alternatives bodies are not touched.
- **Doc alignment.** [`docs/guides/flows.md`](../../guides/flows.md) §3, §5, §6 and [`governance/README.md`](../../../governance/README.md) currently frame `AIDAKIT_GOVERNANCE` as `runs`-only ([flows.md:67,187](../../guides/flows.md), [governance/README.md:61](../../../governance/README.md)); each is updated to reflect the session-wide contract and cross-linked to ADR-010.
- **Regression test** in [`governance/__tests__/`](../../../governance/__tests__/) proving AC5: an in-scope command executed with `AIDAKIT_GOVERNANCE` unset exits non-zero and prints a diagnostic naming the variable. Test file name and shape decided in [design.md](design.md).

## Goals / Non-Goals

**Goals:**

- Every direct-invocation call site in `agents/`, `skills/`, `commands/` resolves the kit's `governance/` path independent of cwd (AC1).
- The `SessionStart` hook injects `AIDAKIT_GOVERNANCE` into the Bash-tool env for any session where the plugin is loaded (AC2), including sessions that never touch a `runs` step.
- Missing hook / unset variable fails loud, not silent (AC5).
- The decision that broadens `AIDAKIT_GOVERNANCE`'s contract is recorded as ADR-010, not smuggled in as an implementation detail (AC4).

**Non-Goals:**

1. **Not changing the `runs.js` injection.** The `runs`-child injection stays as-is — it is still authoritative inside `runs` steps (kit-wins precedence, per [ADR-004](../../decisions/ADR-004-aidakit-governance-env-contract.md) §Decision). The session hook is additive: it covers the vectors `runs.js` never touches.
2. **Not editing ADR-004's decision body in place.** ADR-004's Context/Decision/Consequences/Review-trigger/Alternatives bodies stay WORM ([DOCS.md](../../../DOCS.md) rule 2). The amendment is a new record (ADR-010) whose Status header amends ADR-004, matching the [ADR-007 → ADR-002 amendment pattern](../../decisions/ADR-007-roadmap-status-from-shared-git.md); a small `## Amendments` section is appended at the tail of ADR-004 to carry the required bidirectional back-link (mirroring [ADR-002:42-44](../../decisions/ADR-002-roadmap-status-derived-from-disk.md) — the append is a metadata surface, not an edit of a past decision).
3. **Not touching descriptive prose that mentions `governance/`** — spec catalogs (`skills/catalog/INDEX.md`), Markdown source links (e.g. `[roadmap.js](../../governance/roadmap/roadmap.js)`), and code-review skill prose about `governance/flows/*.yaml` are file-location references, not commands. The predecessor's same rule applies ([`validator-path-resolution/design.md` §Out of scope](../../archive/2026-07-23-validator-path-resolution/design.md)).
4. **Not touching consumer-project `.aidakit/flows/*.yaml`.** Consumer flow authors were already directed to `$AIDAKIT_GOVERNANCE` by the predecessor; the doctrine there does not change.
5. **Not addressing the `runs` error-routing debit** (`runs-error-routing` in [EPIC-flow-engine-leashes](../../roadmap/epics/EPIC-flow-engine-leashes.md) line 21). A missing hook still surfaces as exit≠0 from the guard; distinguishing "infra error" from "validator judged NO" is orthogonal and out of scope.
6. **Not implementing a shell wrapper or per-file self-locate**. Rejected alternatives are recorded in [design.md](design.md) §Alternatives with the "why not" for each.

## Alternatives Considered

- **Sourced shell helper that self-locates the kit** (each caller `source`s `hooks/kit-env.sh` first). Rejected: adds a required prelude to every markdown instruction, doubles the surface each caller has to remember to include, and the `source` path itself has the same cwd problem the change is supposed to eliminate. See [design.md](design.md).
- **CLI shim per validator** (`bin/aidakit-derive-roadmap`, `bin/aidakit-check-doc-manifest`, `bin/aidakit-cli`) exposed on `$PATH`. Rejected: needs an install step (not automatic under Claude Code plugin loading), and the underlying `node …/validators/x.js` idiom is a plain Node call — a wrapper adds cost without eliminating the resolution question. See [design.md](design.md).
- **Per-file self-locate via `import.meta.url` inside each validator** (as considered and rejected in [`validator-path-resolution/design.md` §Alternatives](../../archive/2026-07-23-validator-path-resolution/design.md)). Rejected for the same reason: the breakage is in how the *instruction* spells the command, not inside the validators.
- **Interpolate `${CLAUDE_PLUGIN_ROOT}` directly in each markdown call site.** Rejected: `CLAUDE_PLUGIN_ROOT` is a hook-manifest-only substitution (verified empirically this session — `echo $CLAUDE_PLUGIN_ROOT` in a Bash tool call returns empty); it is NOT a runtime env var Claude Code exposes to Bash sessions. See the "Assumptions" trail in [`.aidakit/tasks/agent-validator-paths/events.ndjson`](../../../.aidakit/tasks/agent-validator-paths/events.ndjson) and [design.md](design.md) §Mechanism.

## Success Criteria

- [ ] **AC1** — the executable-call-site sweep returns **zero** hits after the change. Exact command (the pipe excludes the two pre-existing descriptive-prose exceptions declared in [design.md](design.md) §"Out of scope — same rule as the predecessor" — `skills/catalog/INDEX.md` and `skills/review/SKILL.md` — so the raw `grep -rE 'node +governance/(validators|cli|engine)' agents/ skills/ commands/` continues to work as an unfiltered inventory, and the filtered form is the pass/fail lint):

  ```bash
  grep -rnE 'node +governance/(validators|cli|engine)' agents/ skills/ commands/ \
    | grep -vE '^skills/(catalog/INDEX|review/SKILL)\.md:'
  ```

  Pass criterion: the pipe emits zero lines. A new offender in any file other than the two excluded ones is still caught; a new offender inside the excluded pair must be flagged by review (documented as the trade-off of the exclusion — those two files are on the §Out-of-scope list and any new executable call added there is itself a scope escalation).
- [ ] **AC2** — the `SessionStart` hook exports `AIDAKIT_GOVERNANCE` from `${CLAUDE_PLUGIN_ROOT}` at session start, and the value is visible to Bash tool calls (verified by an `env | grep AIDAKIT_GOVERNANCE` reproduction recorded in [evidence.md](evidence.md)).
- [ ] **AC3** — [evidence.md](evidence.md) reproduces the pre-fix `Cannot find module` failure from a consumer cwd for each in-scope call site (RED), then re-runs each green with the hook active (GREEN).
- [ ] **AC4** — [ADR-010](../../decisions/ADR-010-aidakit-governance-session-wide.md) is written and registered in [`docs/decisions/README.md`](../../decisions/README.md); [ADR-004](../../decisions/ADR-004-aidakit-governance-env-contract.md) gains a WORM-compliant `## Amendments` back-link (metadata-only append at file tail, mirroring [ADR-002:42-44](../../decisions/ADR-002-roadmap-status-derived-from-disk.md)); [`docs/guides/flows.md`](../../guides/flows.md) §3/§5/§6 and [`governance/README.md`](../../../governance/README.md) are updated to reflect the session-wide contract, cross-linking ADR-010. The brainstorm's literal wording "amended in-place" is reconciled to this ADR-007-style pattern in [evidence.md](evidence.md) §"AC4 reconciliation".
- [ ] **AC5** — a regression test in [`governance/__tests__/`](../../../governance/__tests__/) proves an in-scope command with `AIDAKIT_GOVERNANCE` unset fails loudly (non-zero exit, error message names the variable).
- [ ] `node governance/__tests__/*.test.mjs` → 0 failures (regression coverage stays green).
- [ ] `node governance/validators/check-links.js docs/features/agent-validator-paths docs/decisions docs/guides/flows.md governance/README.md hooks/` → exit 0.

## Open Questions

- [ ] **Claude Code hook capability — must be validated as the first implementation step.** Assumption 2 from the brainstorm: a `SessionStart` hook (declared in `hooks/hooks.json`) can export an env var reachable by later Bash tool calls in the same session. Fallback branch is documented in [design.md](design.md) §Contingency; the implementer must confirm the capability from the Claude Code hook docs (or by reverse-engineering `hooks/hooks.json` + plugin fixtures) before wiring the hook. If the assumption fails, the change re-plans to the fallback and the flow re-critiques.
- [ ] **Does the fail-closed one-liner belong inline in each rewritten command or once at the top of each file?** The design defaults to inline (one guard per emitted command, so a copy-paste of a single line still fails loud) but the implementer may downgrade to once-per-file if line-noise dominates. Reviewer decides.

## Dependencies

- **Predecessor [validator-path-resolution](../../archive/2026-07-23-validator-path-resolution/proposal.md) — DONE.** This change consumes its inventory table (`design.md` §Out of scope) and its consumer-cwd reproduction shape (`evidence.md`).
- **[ADR-004](../../decisions/ADR-004-aidakit-governance-env-contract.md)** — the contract this change amends. Read before drafting ADR-010.
- **[EPIC-flow-engine-leashes](../../roadmap/epics/EPIC-flow-engine-leashes.md) line 25-26** — the roadmap declaration.
- **[DOCS.md](../../../DOCS.md) rule 2 (WORM)** — governs ADR handling; drives the "new ADR, no in-place edit" decision.
- No open-decisions log in this repo; nothing inherited.

## Unblocks

- Enables consumer sessions (psim-kernel migration + any external dogfooding repo) to run the direct-invocation call sites of the kit's agents/skills/commands without a `Cannot find module`.
- Completes the `AIDAKIT_GOVERNANCE` contract to full session coverage, closing the "different vector" caveat ADR-004 flagged as `Mitigated` at write-time.
- Removes the last cwd-dependent kit-path reference outside of intentional file-location prose — a lint of `node governance/` in `agents|skills|commands` becomes a legitimate CI check.

## Recorded decisions and inherited open decisions

- **Read** [ADR-001](../../decisions/ADR-001-executable-dna-crystallization.md), [ADR-002](../../decisions/ADR-002-roadmap-status-derived-from-disk.md), [ADR-003](../../decisions/ADR-003-shared-knowledge-in-docs.md), [ADR-004](../../decisions/ADR-004-aidakit-governance-env-contract.md), [ADR-005](../../decisions/ADR-005-command-namespacing.md), [ADR-006](../../decisions/ADR-006-flow-values-as-data.md), [ADR-007](../../decisions/ADR-007-roadmap-status-from-shared-git.md), [ADR-008](../../decisions/ADR-008-opt-in-autonomous-pr-merge.md), [ADR-009](../../decisions/ADR-009-flow-commits-plan-early.md).
- **Constrains this change:** [ADR-004](../../decisions/ADR-004-aidakit-governance-env-contract.md) directly (contract broadened by ADR-010 introduced here); [ADR-003](../../decisions/ADR-003-shared-knowledge-in-docs.md)'s placement boundary ("a decision with alternatives → ADR") drives the choice to write ADR-010 rather than bury the mechanism in `design.md`; [DOCS.md](../../../DOCS.md) rule 2 (WORM) drives the new-record-not-in-place-edit shape.
- **Not constraining** (read to be sure): ADR-001/002/005/006/007/008/009 — none touches hook/session env injection nor the `agent`/`skill`/`command` markdown surface.
- No open-decisions log in this repo; nothing inherited.
