# Design — agent-validator-paths

**Change ID:** `agent-validator-paths`
**Date:** `2026-07-24`
**Owner:** `@chacal88`
**Phase / Package:** `hooks + agents + skills + commands — cwd-independent kit path for direct validator invocations`
**PRD:** `n/a`
**Tech Spec:** `n/a`

## Problem shape

Two facts collide:

1. **`AIDAKIT_GOVERNANCE` is `runs`-child-only today** ([ADR-004](../../decisions/ADR-004-aidakit-governance-env-contract.md) §Decision — "injected into the child env of every `runs` step, and only `runs` steps"). The var is computed at [`governance/engine/steps/runs.js`](../../../governance/engine/steps/runs.js) module scope and spread into `spawnSync`'s env; nothing else in the process tree sees it.
2. **Direct-invocation call sites live outside that tree.** Every place an agent, skill, or slash command instructs Claude to `node governance/…` becomes a Bash tool call in Claude Code's own session; there is no engine spawn in the middle. `runs.js` never runs, so `AIDAKIT_GOVERNANCE` is never set.

Empirically confirmed this session (see [`.aidakit/tasks/agent-validator-paths/events.ndjson`](../../../.aidakit/tasks/agent-validator-paths/events.ndjson) brainstorm assumption 1):

- `echo $CLAUDE_PLUGIN_ROOT` in a Bash tool call returns empty. `CLAUDE_PLUGIN_ROOT` is a **hook-manifest substitution token** (visible in [`hooks/hooks.json`](../../../hooks/hooks.json) as `"${CLAUDE_PLUGIN_ROOT}/hooks/pre-bash.js"`), not a session runtime env var.
- So there is no way for a markdown instruction to spell an absolute kit path via its own text: the token that WOULD name the kit's location is unavailable at the point of execution.

The only surface that both (a) sees `CLAUDE_PLUGIN_ROOT` and (b) can influence the Bash tool's env is a **hook**. The Claude Code hook system is what created the surface where the manifest token is expanded; a `SessionStart` hook is the closest analogue to `runs.js`'s injection point, but for the Claude session itself instead of a spawned child.

## Mechanism — the `SessionStart` hook

Add a `SessionStart` handler to [`hooks/hooks.json`](../../../hooks/hooks.json), alongside the existing `PreToolUse/Bash` block:

```json
{
  "hooks": {
    "PreToolUse": [ /* unchanged: pre-bash.js */ ],
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/session-start.js\""
          }
        ]
      }
    ]
  }
}
```

The hook script — new file [`hooks/session-start.js`](../../../hooks/session-start.js) — reads the `CLAUDE_PLUGIN_ROOT` env var (populated by Claude Code when the hook is spawned, exactly the same way [`hooks/pre-bash.js`](../../../hooks/pre-bash.js) is reachable through it — verified by inspection of the existing manifest), computes `AIDAKIT_GOVERNANCE = ${CLAUDE_PLUGIN_ROOT}/governance` and emits the Claude Code hook-protocol JSON that adds it to the session env. Skeleton (the implementer writes the exact protocol contract after step 1 of tasks.md validates the hook capability):

```js
#!/usr/bin/env node
// hooks/session-start.js — exports AIDAKIT_GOVERNANCE session-wide.
// Companion to runs.js: runs.js covers `runs`-step children; this hook covers
// every direct Bash tool call an agent/skill/command instructs. ADR-012
// (amends ADR-004) locks the contract.
const root = process.env.CLAUDE_PLUGIN_ROOT;
if (!root) {
  // Fail-loud: leave the env unset so the guard in each rewritten call
  // site prints a legible error at first use, instead of silently
  // pointing at a nonsense path.
  process.stderr.write("aidakit session-start: CLAUDE_PLUGIN_ROOT is empty — AIDAKIT_GOVERNANCE not exported\n");
  process.exit(1);
}
// Exact JSON shape TBD by tasks.md step 1 (Claude Code hook protocol validation).
process.stdout.write(JSON.stringify({
  // e.g. { "session": { "env": { "AIDAKIT_GOVERNANCE": `${root}/governance` } } }
  // The literal key structure is what the hook protocol expects — validated
  // empirically in tasks.md step 1 before this file lands.
}));
```

**Value semantics — identical to `runs.js`.** The var still points **at** the `governance/` directory (not its parent), same as ADR-004 §Decision. Every rewritten call site uses `node "$AIDAKIT_GOVERNANCE/(validators|cli|engine)/x.js …"`.

**Precedence and interaction with `runs.js`.** A `runs` step still spreads its own `AIDAKIT_GOVERNANCE` after `...process.env` (`runs.js:26`) — the runs-computed value wins inside runs steps. The session-injected value is what every other Bash tool call sees. The values are identical (both computed from the same on-disk plugin location), so precedence is a theoretical concern only; the semantics are stable across the two vectors.

**Fail-closed at every layer.**

- **Hook layer.** If `CLAUDE_PLUGIN_ROOT` is empty at hook time (broken plugin load, hostile invocation), the hook prints to stderr and exits non-zero. The variable is not set in the session; the next in-scope Bash call will hit the guard below and fail with a diagnostic that names the missing hook.
- **Call-site layer.** Every rewritten instruction includes the shell one-liner `: "${AIDAKIT_GOVERNANCE?agent-validator-paths: AIDAKIT_GOVERNANCE not set — SessionStart hook missing (see docs/guides/flows.md §6)}"` before the actual command. This is the [POSIX parameter-expansion `?word` idiom](https://pubs.opengroup.org/onlinepubs/9699919799/utilities/V3_chap02.html): if the variable is unset or null, the shell prints `word` to stderr and exits non-zero. Zero cost when set, hard fail when not. Never a relative-path fallback — silence would re-import the bug this change is closing.

## In-scope call-site inventory

Result of `grep -rE 'node +governance/(validators|cli|engine)' agents/ skills/ commands/` at the time of writing (2026-07-24; line numbers may drift — the implementer re-verifies at task-execution time):

| File | Line | Kind | Old command (fragment) | New command (fragment) |
|---|---|---|---|---|
| [`agents/orchestrator.md`](../../../agents/orchestrator.md) | 50 | agent instruction | `node governance/validators/derive-roadmap-status.js --root <project-root>` | `node "$AIDAKIT_GOVERNANCE/validators/derive-roadmap-status.js" --root <project-root>` |
| [`agents/doc-planner.md`](../../../agents/doc-planner.md) | 155 | agent next-step | `node governance/validators/check-doc-manifest.js .aidakit/tasks/<change-id>/doc-manifest.json` | `node "$AIDAKIT_GOVERNANCE/validators/check-doc-manifest.js" .aidakit/tasks/<change-id>/doc-manifest.json` |
| [`skills/roadmap/SKILL.md`](../../../skills/roadmap/SKILL.md) | 64 | skill fenced command | `node governance/validators/derive-roadmap-status.js --root <project-root>` | `node "$AIDAKIT_GOVERNANCE/validators/derive-roadmap-status.js" --root <project-root>` |
| [`commands/flow-build.md`](../../../commands/flow-build.md) | 10 | prose in `Usage` | ``via the engine (`node governance/cli.js`)`` | ``via the engine (`node "$AIDAKIT_GOVERNANCE/cli.js"`)`` |
| [`commands/flow-build.md`](../../../commands/flow-build.md) | 20 | verb mapping | `node governance/cli.js start <flow> ...` | `node "$AIDAKIT_GOVERNANCE/cli.js" start <flow> ...` |
| [`commands/flow-build.md`](../../../commands/flow-build.md) | 21 | verb mapping | `node governance/cli.js resume <flow_id> <outcome> [key=value ...]` | `node "$AIDAKIT_GOVERNANCE/cli.js" resume <flow_id> <outcome> [key=value ...]` |
| [`commands/flow-build.md`](../../../commands/flow-build.md) | 22 | verb mapping | `node governance/cli.js status <flow_id>` | `node "$AIDAKIT_GOVERNANCE/cli.js" status <flow_id>` |
| [`commands/flow-build.md`](../../../commands/flow-build.md) | 23 | verb mapping | `node governance/cli.js abort <flow_id>` | `node "$AIDAKIT_GOVERNANCE/cli.js" abort <flow_id>` |
| [`commands/flow-build.md`](../../../commands/flow-build.md) | 24 | verb mapping | `node governance/cli.js list` | `node "$AIDAKIT_GOVERNANCE/cli.js" list` |
| [`commands/flow-build.md`](../../../commands/flow-build.md) | 34 | register-mode start | `node governance/cli.js start fast request=<change-id> mode=register` | `node "$AIDAKIT_GOVERNANCE/cli.js" start fast request=<change-id> mode=register` |
| [`commands/flow-build.md`](../../../commands/flow-build.md) | 37 | resume prose | `node governance/cli.js resume <flow_id> plan` / `resume <flow_id> discard` | `node "$AIDAKIT_GOVERNANCE/cli.js" resume <flow_id> plan` / same for discard |
| [`commands/flow-design.md`](../../../commands/flow-design.md) | 10 | prose in `Usage` | ``via the engine (`node governance/cli.js`)`` | ``via the engine (`node "$AIDAKIT_GOVERNANCE/cli.js"`)`` |
| [`commands/flow-design.md`](../../../commands/flow-design.md) | 20 | verb mapping | `node governance/cli.js start design project="..."` | `node "$AIDAKIT_GOVERNANCE/cli.js" start design project="..."` |
| [`commands/flow-design.md`](../../../commands/flow-design.md) | 21 | verb mapping | `node governance/cli.js resume <flow_id> <outcome>` | `node "$AIDAKIT_GOVERNANCE/cli.js" resume <flow_id> <outcome>` |
| [`commands/flow-design.md`](../../../commands/flow-design.md) | 22 | verb mapping | `node governance/cli.js status <flow_id>` | `node "$AIDAKIT_GOVERNANCE/cli.js" status <flow_id>` |
| [`commands/flow-design.md`](../../../commands/flow-design.md) | 23 | verb mapping | `node governance/cli.js abort <flow_id>` | `node "$AIDAKIT_GOVERNANCE/cli.js" abort <flow_id>` |
| [`commands/flow-design.md`](../../../commands/flow-design.md) | 24 | verb mapping | `node governance/cli.js list` | `node "$AIDAKIT_GOVERNANCE/cli.js" list` |
| [`commands/flow-design.md`](../../../commands/flow-design.md) | 30 | resume prose | `node governance/cli.js resume <flow_id> <outcome>` | `node "$AIDAKIT_GOVERNANCE/cli.js" resume <flow_id> <outcome>` |

**18 in-scope hits total** (3 in agents/skills as the roadmap acceptance already named — `agents/orchestrator.md:50`, `agents/doc-planner.md:155`, `skills/roadmap/SKILL.md:64`; 15 in commands surfaced by the brainstorm — 8 in `commands/flow-build.md` + 7 in `commands/flow-design.md`, as the inventory table above lists row-by-row). The raw `grep -rnE 'node +governance/(validators|cli|engine)' agents/ skills/ commands/` returns 20 lines today: the 18 in-scope hits plus the 2 descriptive-prose exceptions (`skills/catalog/INDEX.md:48`, `skills/review/SKILL.md:114`) that §"Out of scope — same rule as the predecessor" declares must not be rewritten. Every in-scope hit is a command Claude executes verbatim in a Bash tool call — the mapping between the SlashCommand verb and the Bash line is literal in `flow-build.md` / `flow-design.md`; a wrong path there is a wrong path Claude will type.

### Out of scope — same rule as the predecessor

The predecessor pinned the boundary in [`validator-path-resolution/design.md` §Out of scope](../../archive/2026-07-23-validator-path-resolution/design.md) ("flow calls are fixed; source links, release-time in-kit commands, WORM and archive content are left intact"). This change extends the same rule:

- **Descriptive prose that names `governance/` as a file location** (e.g. `roadmap.js` linked as [`../../governance/roadmap/roadmap.js`](../../../governance/roadmap/roadmap.js) in [`skills/roadmap/SKILL.md:92,130`](../../../skills/roadmap/SKILL.md), [`skills/catalog/INDEX.md:48`](../../../skills/catalog/INDEX.md), [`skills/review/SKILL.md:114`](../../../skills/review/SKILL.md), any ADR mention). These are relative links from a source doc INSIDE the kit to a source file INSIDE the kit — they render correctly on GitHub and are not commands. Leave.
- **`PROCESS.md:291`** (`node governance/validators/check-plugin-version.js .`) — release-time command that runs INSIDE the kit repo by maintainers; the relative path is correct there. Leave (same as the predecessor's decision).
- **Archive content** ([`docs/archive/`](../../archive/)) — WORM. Never edited.
- **`hooks/pre-bash.js`** — invoked by the `PreToolUse/Bash` hook, unrelated to validator paths. Untouched (though the `hooks.json` manifest itself gains a `SessionStart` block).
- **`.aidakit/…` argument paths** stay relative — they are consumer-project data paths, correctly resolved from cwd (same reasoning as the predecessor).

The rule applied: **executed commands are rewritten; source-file links, release-time in-kit commands, and archive/WORM content are left intact.**

## Alternatives considered

- **Sourced shell helper** (`source hooks/kit-env.sh` at the top of each caller). Rejected: (a) the `source` line itself needs an absolute path, so the very problem recurses; (b) doubles the required boilerplate in every markdown instruction and every reader has to remember to include it; (c) unclear what "top" means in a markdown file that is not a shell script — Claude reads the whole file and picks commands from it, not sourcing anything.
- **CLI shim per validator/CLI** (a `bin/` directory with `aidakit-derive-roadmap`, `aidakit-check-doc-manifest`, `aidakit-cli` on `$PATH`). Rejected: requires a plugin post-install step that Claude Code plugin loading does not do automatically; the payoff over `node "$AIDAKIT_GOVERNANCE/x.js"` is zero (the argv the caller has to spell stays the same) and it introduces a second name to keep in sync with each validator/entrypoint.
- **Per-file self-locate via `import.meta.url` inside each validator**. Rejected for the same reason as the predecessor's rejection ([`validator-path-resolution/design.md` §Alternatives](../../archive/2026-07-23-validator-path-resolution/design.md)): the breakage is in how the *instruction* spells the command, not inside the validator. Every future validator/entrypoint would need the same boilerplate, and it does nothing for a consumer instruction spelled from scratch.
- **Interpolate `${CLAUDE_PLUGIN_ROOT}` in each markdown call site.** Rejected: the token is only expanded inside `hooks.json`; it is not a session env var (empirically verified — see §Problem shape). A rendered markdown instruction that says `node ${CLAUDE_PLUGIN_ROOT}/governance/cli.js …` would literally execute with `${CLAUDE_PLUGIN_ROOT}` unset and fail identically to the current bug.
- **Rely on `pre-bash.js` to rewrite matching commands in-flight** (a `PreToolUse/Bash` hook that patterns `node governance/…` → absolute). Rejected: `PreToolUse` hooks may modify but should not silently rewrite the command Claude was told to execute; this hides the fact that the instructions are wrong (the instructions must be corrected once, not patched every call), and it makes the pre-bash guard itself carry a load unrelated to its execution-governance job (documented at [`hooks/pre-bash.js:3-43`](../../../hooks/pre-bash.js)).

## ADR-004 amendment shape — a new ADR-012

**Why a new ADR, not an in-place edit of ADR-004.** [DOCS.md](../../../DOCS.md) rule 2 (WORM) explicitly: "An ADR is WORM: never edit a past decision. Changed your mind → a new ADR that supersedes or amends this one." The repo's own established pattern is [ADR-007](../../decisions/ADR-007-roadmap-status-from-shared-git.md), whose Status header reads `accepted (amends [ADR-002](../../decisions/ADR-002-roadmap-status-derived-from-disk.md))` — the amended ADR (ADR-002) is not edited; the new one carries the header and the pointer. ADR-004's own Review trigger anticipated this exact shape: "amend this ADR to point at the unified mechanism instead of two divergent ones."

**Shape of the new record — [ADR-012](../../decisions/ADR-012-aidakit-governance-session-wide.md).**

- Filename: `docs/decisions/ADR-012-aidakit-governance-session-wide.md`.
- WORM header comment (copy from ADR-004/007).
- **Status:** `accepted (amends [ADR-004](../../decisions/ADR-004-aidakit-governance-env-contract.md))`.
- **Date:** `2026-07-24`.
- **Context:** cite ADR-004's `Mitigated` consequence (§Consequences bullet 2) and its Review trigger; cite this change's roadmap declaration and the [predecessor's non-goal 2](../../archive/2026-07-23-validator-path-resolution/proposal.md).
- **Decision:** `AIDAKIT_GOVERNANCE` remains the same name with the same value semantics (points AT `governance/`), broadened from "injected into `runs`-step children only" to "additionally exported into the Claude session env by a `SessionStart` hook, so every Bash tool call — `runs`-child or direct-invocation — resolves the kit's `governance/` path identically". `runs.js` injection is preserved unchanged; the session injection is additive. The kit's rewritten call sites in `agents/`, `skills/`, `commands/` guard with the POSIX `?word` expansion, so a missing hook fails loud.
- **Consequences:** positive (all direct-invocation vectors resolved; a lint of `node governance/` in `agents|skills|commands` becomes a valid CI check; the `Mitigated` bullet of ADR-004 is now `Accepted` because the coverage is complete). Negative (a `SessionStart` hook is a new plugin obligation — Accepted; if Claude Code deprecates/renames the hook capability, both `runs.js` injection and this hook coordinate and a follow-up ADR is needed — Mitigated by keeping both mechanisms co-owned in one contract).
- **Review trigger:** if a future kit surface introduces yet another vector (e.g. a background daemon spawned outside `runs` and outside the Claude session), amend ADR-012 with the third injection point.
- **Alternatives considered:** lift the 4-row table from this design's §Alternatives.
- **Registered** in [`docs/decisions/README.md`](../../decisions/README.md) with an index row and (if the file has thematic groupings) placed in the "Flow engine" group next to ADR-004.

**Bidirectional link — append `## Amendments` to ADR-004.** DOCS.md §2 rule 2 mandates the reverse pointer, and the repo's own precedent is [`docs/decisions/ADR-002-roadmap-status-derived-from-disk.md:42-44`](../../decisions/ADR-002-roadmap-status-derived-from-disk.md) — an `## Amendments` block appended at the tail after ADR-007 amended it. This change appends the mirror block to the tail of ADR-004, exact shape:

```md
## Amendments

- [ADR-012](ADR-012-aidakit-governance-session-wide.md) (2026-07-24) — amends the injection surface of `AIDAKIT_GOVERNANCE` from `runs`-child-only to **session-wide** via a `SessionStart` hook. The variable name, value semantics, and precedence rule are preserved; the hook is additive to the `runs.js` injection, so every Bash tool call (engine-spawned `runs` children and direct-invocation call sites from agents/skills/commands) now sees the same value. Closes the `Mitigated` bullet of §Consequences.
```

WORM is preserved: `## Context`, `## Decision`, `## Consequences`, `### Review trigger`, and `## Alternatives considered` are not edited. The append is a metadata-only surface for the bidirectional link — exactly the shape ADR-002 uses.

## Doc alignment

The three prose surfaces that currently describe `AIDAKIT_GOVERNANCE` as `runs`-only get an update — small, targeted, keep the doctrinal tone of the source:

- **[`docs/guides/flows.md`](../../guides/flows.md) §3** (line ~67, the `${...}` vs `$FOO` explainer): the current sentence "`$AIDAKIT_GOVERNANCE` (injected by `runs.js` into every `runs` child env; see §6)" broadens to name both injection points and cross-links ADR-012.
- **[`docs/guides/flows.md`](../../guides/flows.md) §5** — inspect for any wording that scopes the var to `runs` only and adjust.
- **[`docs/guides/flows.md`](../../guides/flows.md) §6** (line ~187, "Calling a kit validator from a flow of your own"): the current "`runs.js` injects `AIDAKIT_GOVERNANCE` … into every `runs` step's child env" broadens to "`runs.js` and a `SessionStart` hook together inject `AIDAKIT_GOVERNANCE` … so every Bash execution surface — engine-spawned `runs` steps and direct-invocation call sites from agents/skills/commands — resolves the kit's `governance/` path identically". Cross-link ADR-012.
- **[`governance/README.md`](../../../governance/README.md)** line 61: the sentence "`runs` steps also receive `AIDAKIT_GOVERNANCE` in their child env" broadens to "Every Bash session under the plugin — `runs`-step children (via `runs.js`) and direct Bash tool calls (via the `SessionStart` hook) — receives `AIDAKIT_GOVERNANCE`". Cross-link ADR-012.
- Bump the doctrine footer of `docs/guides/flows.md` per repo convention.

## Regression test — AC5

New file [`governance/__tests__/agent-validator-paths.test.mjs`](../../../governance/__tests__/agent-validator-paths.test.mjs) (or, if the reviewer prefers, a new §11 subsection in [`governance/__tests__/engine.test.mjs`](../../../governance/__tests__/engine.test.mjs) — the implementer picks based on file-size heuristics; a dedicated file is preferred because the test is not about the engine). Cases:

1. **Guard fails loud with `AIDAKIT_GOVERNANCE` unset.** Spawn `bash -lc '<the guard one-liner>; node "$AIDAKIT_GOVERNANCE/validators/derive-roadmap-status.js" --root .'` with an env that explicitly deletes `AIDAKIT_GOVERNANCE`; assert exit code ≠ 0 AND stderr contains the string `AIDAKIT_GOVERNANCE not set` AND stderr contains `agent-validator-paths` (naming the change so the diagnostic is traceable).
2. **Guard passes silently when set.** Same command with `AIDAKIT_GOVERNANCE` pointed at the real `governance/`; assert exit 0 (or the validator's own exit code, distinguished from a guard failure).
3. **Grep discipline (AC1).** Assert the filtered sweep — `grep -rnE 'node +governance/(validators|cli|engine)' agents/ skills/ commands/ | grep -vE '^skills/(catalog/INDEX|review/SKILL)\.md:'` — produces zero lines. The pipe excludes the two known descriptive-prose lines (`skills/catalog/INDEX.md:48`, `skills/review/SKILL.md:114`) declared out of scope in §"Out of scope — same rule as the predecessor"; any regression reintroducing an executable `node governance/…` call in an unfiltered path is still caught. If someone later adds a NEW executable call inside either excluded file, the test won't catch it — but that would itself be a §Out-of-scope escalation, flagged at review.
4. **Manifest discipline.** Parse [`hooks/hooks.json`](../../../hooks/hooks.json), assert the `SessionStart` key exists with at least one hook whose command references `hooks/session-start.js` and `${CLAUDE_PLUGIN_ROOT}`.

**Mutation proof** (recorded in [evidence.md](evidence.md)): after implementation, temporarily reintroduce a relative-path hit in one command file, run the suite, confirm case 3 goes RED; revert, confirm GREEN.

## Contingency — if the SessionStart env-injection assumption fails

Assumption 2 (`SessionStart` hook can export env vars into the Bash tool session) is validated at [tasks.md](tasks.md) step 1. If it does NOT hold — e.g. Claude Code hook protocol lacks an env-export field, or the value does not survive to Bash-tool-time — the change re-plans, not silently degrades:

- **Fallback A — hook-side rewriting.** Move the injection to `hooks/pre-bash.js` (an existing `PreToolUse/Bash` handler): detect a leading `node governance/(validators|cli|engine)/` in the command being about to execute and rewrite it in-flight to the absolute path. Cheap to implement, but adds an execution-governance-adjacent behavior to `pre-bash.js` that its own header explicitly says is not its job ([`hooks/pre-bash.js:3-43`](../../../hooks/pre-bash.js)) — requires re-negotiating that boundary.
- **Fallback B — installer-time absolute paths.** A plugin install step rewrites `governance/…` to the absolute plugin cache path in the shipped agent/skill/command files. Rejected upstream because Claude Code plugins do not run install scripts; would need a new install mechanism.
- **Fallback C — every markdown call site self-locates.** Ship a small `hooks/kit-locator.sh` (hypothetical — never created; this fallback was not chosen) that, when sourced, computes `AIDAKIT_GOVERNANCE`, and every rewritten instruction says `source "$(command -v aidakit-locator 2>/dev/null || echo <fixed-relative-shot>)"` first. Also brittle and doesn't fully close the resolve problem.

The critic step of the flow decides between the primary design and a fallback based on step-1 evidence.

## Constraining ADRs

- [ADR-004](../../decisions/ADR-004-aidakit-governance-env-contract.md) — this change amends it via [ADR-012](../../decisions/ADR-012-aidakit-governance-session-wide.md); the amendment is precisely what ADR-004's Review trigger authorized.
- [ADR-003](../../decisions/ADR-003-shared-knowledge-in-docs.md) placement boundary — "a decision with alternatives → ADR" — drives writing ADR-012 rather than hiding the broadening as a design-only footnote.
- [DOCS.md](../../../DOCS.md) rule 2 (WORM) — drives the "new ADR, no in-place edit of ADR-004" shape.

## Rollback

Revert the single commit that lands this change: `hooks/hooks.json` loses the `SessionStart` block, `hooks/session-start.js` is deleted, the 18 in-scope call sites revert to relative paths, the test file is removed, ADR-012 is deleted, ADR-004's appended `## Amendments` section is removed, `docs/decisions/README.md` loses its ADR-012 row, `governance/README.md`/`flows.md` revert, and `docs/roadmap/epics/EPIC-flow-engine-leashes.md` line 25-26 reverts to its pre-change Aceite wording. The behavior returns to the pre-change reality (relative paths that only resolve inside the kit repo). Then Fallback A/B/C are open.

## Conventions and evidence location

- Every rewritten command uses double quotes around `"$AIDAKIT_GOVERNANCE/…"` — the plugin cache path may contain spaces (`~/.claude/plugins/cache/aidakit/aidakit/<version>/governance`). Same convention as the predecessor.
- Markdown edits keep the file's existing tone (agents/skills/commands are terse operational docs; the rewrite is one line at a time, no reflow).
- New ADR-012 follows the ADR-001–009 format exactly (5 sections, WORM header, Alternatives table).
- Test discipline: mutation proof captured, not just assertion counts (same pattern the predecessor established in its `docs-onboarding` test-gap fix).
- Evidence is recorded at the fixed location [`docs/features/agent-validator-paths/evidence.md`](evidence.md).
