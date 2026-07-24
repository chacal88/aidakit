<!-- File: docs/decisions/ADR-004-aidakit-governance-env-contract.md — global sequential numbering, never recycled. Registered in the index docs/decisions/README.md. -->
<!-- An ADR is WORM: never edit a past decision. Changed your mind → a new ADR that supersedes or amends this one. -->

# ADR-004: `AIDAKIT_GOVERNANCE` — the env var flows use to call kit validators independent of cwd

- **Status:** accepted
- **Date:** 2026-07-23

## Context

Every shipped flow calls its validators by **relative path** (`node governance/validators/x.js`). A `runs` step executes with `cwd = projectRoot()` — the **consumer** repo root (`AIDAKIT_PROJECT_ROOT` or `process.cwd()`, [`governance/engine/persistence.js`](../../governance/engine/persistence.js)). But `governance/` ships **inside the plugin**, so no consumer repo has that folder on disk — every validator-gated `runs` step broke with `Cannot find module '<repo>/governance/validators/…'` in any project that was not the kit repo itself (owner's bug report, [`docs/archive/2026-07-23-validator-path-resolution/`](../archive/2026-07-23-validator-path-resolution/)). The defect went undetected because the engine's own test suite fabricated the missing folder with a symlink.

The fix needed a **name and a set of semantics** for the resolution mechanism, not just an implementation detail buried inside `runs.js` — it is a contract every future flow (kit-shipped or authored by a consumer project's own `.aidakit/flows/*.yaml`) must honor to call a kit validator correctly. Per [ADR-003](ADR-003-shared-knowledge-in-docs.md)'s placement boundary ("a decision with alternatives → ADR"), a mechanism with rejected alternatives and consumer-facing consequences belongs in the decision record, not only in `design.md`/code comments.

## Decision

The variable is named **`AIDAKIT_GOVERNANCE`**. Its semantics: it points **at the `governance/` directory itself** (not its parent). It is computed once, at module scope, in [`governance/engine/steps/runs.js`](../../governance/engine/steps/runs.js) from `import.meta.url`:

```js
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
// governance/engine/steps/runs.js → up two levels lands ON governance/
const AIDAKIT_GOVERNANCE = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
```

It is injected into the child env of **every `runs` step, and only `runs` steps** — `executeRuns` spreads it after `...process.env`: `const env = { ...process.env, AIDAKIT_GOVERNANCE };`. Precedence: the computed value is spread **after** `...process.env`, so it always wins over any inherited `AIDAKIT_GOVERNANCE` from the calling shell (the kit is authoritative about its own location on disk); the existing `step.env` loop runs after and may still override per-step, though no shipped step does.

Flow commands call kit validators as `node "$AIDAKIT_GOVERNANCE/validators/x.js"` — double-quoted, since the plugin cache install path (`~/.claude/plugins/cache/aidakit/aidakit/<version>/governance`) may contain spaces. The bare `$` (no braces) is deliberate: the engine's own `interpolateString` only substitutes `${...}` (dollar-brace) tokens ([`governance/engine/interpolate.js`](../../governance/engine/interpolate.js)), so `$AIDAKIT_GOVERNANCE` passes through the engine **untouched** and is expanded by `bash -lc` from the injected child env instead — the two grammars (engine interpolation and shell expansion) coexist in the same command string without conflict. Documented for flow authors in [`docs/guides/flows.md`](../guides/flows.md) §3 and §6.

## Consequences

- Positive: every validator-gated `runs` step now resolves identically inside the kit repo and in any consumer/dogfooding repo (e.g. psim-kernel); the fix is a single injection point (`runs.js`), not a patch per validator or per flow; the mechanism generalizes to any future flow — kit-shipped or authored by a consumer project — that needs to call a kit validator regardless of `cwd`.
- Negative:
  - `AIDAKIT_GOVERNANCE` is now a **public contract** a consumer flow can depend on — renaming or moving `governance/` inside the plugin becomes a **breaking change** for any `.aidakit/flows/*.yaml` written against it — **Accepted** (the coupling is documented, not hidden; a future relocation must ship a migration note here or in a superseding ADR).
  - The variable only reaches **`runs`-step** children — agent/skill Bash sessions that invoke a validator **directly** (`agents/orchestrator.md:50`, `agents/doc-planner.md:155`, `skills/roadmap/SKILL.md:64`) never receive it and carry the same relative-path defect via a different vector — **Mitigated** (flagged as a distinct roadmap debit, `agent-validator-paths` in [EPIC-flow-engine-leashes](../roadmap/epics/EPIC-flow-engine-leashes.md), needing its own mechanism; not silently assumed fixed by this decision).
  - A per-step `env:` override could shadow the computed value — **Accepted** (the precedence is documented here: computed wins over inherited process env, but an explicit `step.env` entry would win over the computed value if one were ever added; no shipped step does this today).

### Review trigger

If `agent-validator-paths` (the follow-up debit) lands with a *different* variable name or mechanism for the same concern, amend this ADR to point at the unified mechanism instead of two divergent ones. Or if `governance/` is ever relocated/renamed inside the plugin, the "breaking change for consumer flows" consequence fires and this decision needs a migration note (new amending/superseding ADR).

## Alternatives considered

| Option | Pros | Cons | Cost to undo |
|---|---|---|---|
| Point `AIDAKIT_GOVERNANCE` at the **parent** of `governance/` (flows write `$AIDAKIT_GOVERNANCE/governance/validators/…`) | Mirrors "kit root" more literally | An extra path segment in every one of the 10 call sites for no gain; diverges from the owner's own snippet and the documented flow example — more surface to get wrong | medium |
| Resolve the kit root **inside each validator** (self-locate via its own `import.meta.url`) | No engine change | The breakage is in how the *flow* spells the command, not inside the validators; every validator would need the same boilerplate; does nothing for a consumer flow spelling a fresh `node governance/validators/…` command | medium |
| Keep the test symlink and only fix the flows | Smaller diff | The symlink is precisely what masked the bug in the first place; leaving it means the regression can silently return | low |
| `process.chdir` to the kit root before spawning | One less env var | `runs` steps legitimately need `cwd = projectRoot()` so `.aidakit/…` argument paths and validator **data** resolve against the consumer repo; changing cwd would break those | high |

## Amendments

- [ADR-012](ADR-012-aidakit-governance-session-wide.md) (2026-07-24) — amends the injection surface of `AIDAKIT_GOVERNANCE` from `runs`-child-only to **session-wide** via a `SessionStart` hook. The variable name, value semantics, and precedence rule are preserved; the hook is additive to the `runs.js` injection, so every Bash tool call (engine-spawned `runs` children and direct-invocation call sites from agents/skills/commands) now sees the same value. Closes the `Mitigated` bullet of §Consequences.
