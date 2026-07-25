<!-- File: docs/decisions/ADR-012-aidakit-governance-session-wide.md — global sequential numbering, never recycled. Registered in the index docs/decisions/README.md. -->
<!-- An ADR is WORM: never edit a past decision. Changed your mind → a new ADR that supersedes or amends this one. -->

# ADR-012: `AIDAKIT_GOVERNANCE` becomes session-wide via a `SessionStart` hook (amends ADR-004)

- **Status:** accepted (amends [ADR-004](ADR-004-aidakit-governance-env-contract.md))
- **Date:** 2026-07-24

## Context

[ADR-004](ADR-004-aidakit-governance-env-contract.md) named `AIDAKIT_GOVERNANCE` and injected it into the child env of every `runs` step — but its own §Consequences flagged the gap explicitly as `Mitigated`, not closed: "the variable only reaches `runs`-step children — agent/skill Bash sessions that invoke a validator directly (`agents/orchestrator.md:50`, `agents/doc-planner.md:155`, `skills/roadmap/SKILL.md:64`) never receive it and carry the same relative-path defect via a different vector." Its Review trigger anticipated exactly this follow-up: "If `agent-validator-paths` … lands with a *different* variable name or mechanism for the same concern, amend this ADR to point at the unified mechanism instead of two divergent ones."

Roadmap owns the debit as `agent-validator-paths` under [EPIC-flow-engine-leashes](../roadmap/epics/EPIC-flow-engine-leashes.md) (line 25-26). The brainstorm for this change broadened the inventory beyond the 3 originally-cited agent/skill call sites to also include `commands/flow-build.md` and `commands/flow-design.md`'s `cli.js` verb mappings — every one of those is a Bash tool call Claude Code executes directly, never through `runs.js`, so `AIDAKIT_GOVERNANCE` was never set for any of them (`Cannot find module` in any repo that is not the kit itself).

`CLAUDE_PLUGIN_ROOT` — the token that names the kit's install location — is a **hook-manifest-only substitution**, not a session runtime env var (empirically verified: `echo $CLAUDE_PLUGIN_ROOT` in a Bash tool call returns empty). No markdown instruction can spell an absolute kit path from its own text. The only surface that both sees `CLAUDE_PLUGIN_ROOT` and can influence the Bash tool's env is a Claude Code **hook**.

## Decision

`AIDAKIT_GOVERNANCE` **remains the same name with the same value semantics** — it still points **at** the `governance/` directory, exactly as ADR-004 decided. The injection surface is broadened from "`runs`-step children only" to **session-wide**, via a new `SessionStart` hook (`hooks/session-start.js`, registered in `hooks/hooks.json`).

**Mechanism (verified empirically against the Claude Code build driving this session, and cross-checked against the published npm `@anthropic-ai/claude-code` CLI — see `docs/features/agent-validator-paths/evidence.md` §"Step 1c" for the full trail).** Claude Code spawns `SessionStart` (and `Setup`/`CwdChanged`/`FileChanged`) command hooks with a `CLAUDE_ENV_FILE` env var: an absolute path to a scratch file. Shell text **written** to that path (not printed to stdout as JSON) is later prepended, `&&`-joined, ahead of every subsequent Bash tool invocation in the session. There is no `hookSpecificOutput` field for env export on `SessionStart` — its schema carries only `additionalContext`/`initialUserMessage`/`sessionTitle`/`watchPaths`/`reloadSkills`. `hooks/session-start.js` reads `CLAUDE_PLUGIN_ROOT`, computes `AIDAKIT_GOVERNANCE = ${CLAUDE_PLUGIN_ROOT}/governance`, and appends `export AIDAKIT_GOVERNANCE='<value>'` (single-quoted, escaping embedded quotes) to the file at `$CLAUDE_ENV_FILE`.

`runs.js`'s injection is **preserved unchanged** — a `runs` step still spreads its own computed `AIDAKIT_GOVERNANCE` after `...process.env`, and that computed value wins inside `runs` steps (kit-wins precedence, per ADR-004 §Decision). The session hook is strictly additive: it covers the vectors `runs.js` never touches. Both mechanisms compute the same value from the same on-disk plugin location, so precedence between them is a theoretical concern only.

Every rewritten call site in `agents/`, `skills/`, `commands/` (18 in-scope hits: `agents/orchestrator.md:50`, `agents/doc-planner.md:155`, `skills/roadmap/SKILL.md:64`, 8 in `commands/flow-build.md`, 7 in `commands/flow-design.md`) guards with the POSIX `?word` parameter-expansion idiom before using `$AIDAKIT_GOVERNANCE`: `: "${AIDAKIT_GOVERNANCE?agent-validator-paths: AIDAKIT_GOVERNANCE not set — SessionStart hook missing (see docs/guides/flows.md §6)}"`. A missing/broken hook fails loud (non-zero exit, diagnostic naming the variable) — never a silent relative-path fallback, which would re-import the exact defect this decision closes.

## Consequences

- Positive: every direct-invocation vector now resolves the kit's `governance/` path independent of cwd — the `Mitigated` bullet of ADR-004 §Consequences is now `Accepted` because the coverage is complete; a lint of `node governance/` in `agents|skills|commands` becomes a valid CI check (AC1); the mechanism generalizes to any future agent/skill/command that needs to call a kit validator directly.
- Negative:
  - A `SessionStart` hook is a new plugin obligation and a new failure surface — **Accepted** (the fail-closed guard at every call site makes a broken/missing hook a legible error, not a silent wrong path).
  - The exact env-export mechanism (`CLAUDE_ENV_FILE`) is not documented in Claude Code's public-facing hook reference at the time of writing — it was validated by inspecting the actual shipped `cli.js`/binary, not from a published spec — **Accepted, flagged** (if a future Claude Code release changes or removes this internal mechanism, the hook's own fail-loud path surfaces the break immediately rather than silently degrading; a follow-up ADR would then re-anchor the mechanism to whatever the new public contract is).
  - Session environment injection for `SessionStart` hooks is explicitly unsupported on Windows in the traced implementation ("Session environment not yet supported on Windows") — **Accepted** (the kit's primary supported platforms are macOS/Linux; a Windows user hits the same fail-loud guard as a missing hook, which is the correct degraded behavior, not a crash).
  - `runs.js` injection and this hook now coordinate to honor one contract — **Mitigated** (both compute the identical value from the same on-disk location; if Claude Code ever deprecates/renames the `SessionStart` hook capability, a follow-up ADR must re-anchor both mechanisms together, not just this one).

### Review trigger

If a future kit surface introduces yet another vector that needs `AIDAKIT_GOVERNANCE` outside both `runs`-step children and the Claude session Bash env (e.g. a background daemon spawned outside both), amend this ADR with the third injection point. If Claude Code's `CLAUDE_ENV_FILE`/session-env mechanism changes shape in a future release, this ADR needs a superseding record documenting the new mechanism.

## Alternatives considered

| Option | Pros | Cons | Cost to undo |
|---|---|---|---|
| Sourced shell helper (`source hooks/kit-env.sh` at the top of each caller) | No hook needed | The `source` line itself needs an absolute path — the same cwd problem recurses; doubles the boilerplate every markdown instruction must remember | medium |
| CLI shim per validator/CLI (`bin/aidakit-derive-roadmap`, etc. on `$PATH`) | Familiar UX | Requires a plugin post-install step Claude Code plugin loading does not do automatically; `node "$AIDAKIT_GOVERNANCE/x.js"` is already a plain call — a wrapper adds a second name to keep in sync, no resolution benefit | medium |
| Per-file self-locate via `import.meta.url` inside each validator | No engine/hook change | The breakage is in how the *instruction* spells the command, not inside the validator; every future validator needs the same boilerplate; does nothing for a consumer instruction spelled from scratch | medium |
| Interpolate `${CLAUDE_PLUGIN_ROOT}` directly in each markdown call site | Zero new mechanism | `CLAUDE_PLUGIN_ROOT` is a hook-manifest-only substitution, empirically confirmed NOT exposed to Bash tool sessions — a rendered instruction using it verbatim fails identically to the pre-fix bug | — |
| `SessionStart` hook exports session-wide `AIDAKIT_GOVERNANCE` via `CLAUDE_ENV_FILE` (**chosen**) | Closes every direct-invocation vector at once; reuses the exact variable name/semantics ADR-004 established; fail-closed guard makes a broken hook legible | New plugin obligation (a hook that must keep working); mechanism verified against the shipped binary rather than a published spec | low |
