# Design — validator-path-resolution

**Change ID:** `validator-path-resolution`
**Date:** `2026-07-23`
**Owner:** `@chacal88`
**Phase / Package:** `n/a (fast flow — small reversible bugfix)`
**PRD:** `n/a`
**Tech Spec:** `n/a`

## The mechanism

The engine's `runs` step is the only place that spawns a child process with a controllable env: [`governance/engine/steps/runs.js:20,26`](../../../governance/engine/steps/runs.js) (`const env = { ...process.env }`, then `spawnSync("bash", ["-lc", command], { cwd, env, … })`). It is therefore the single injection point.

### AIDAKIT_GOVERNANCE — semantics (decided and pinned)

`AIDAKIT_GOVERNANCE` points **at the `governance/` directory itself**, not its parent. Computed at module scope from `import.meta.url`:

```
governance/engine/steps/runs.js
  dirname(fileURLToPath(import.meta.url))  → governance/engine/steps
  resolve(…, "..", "..")                   → governance/
```

Two `..` levels land **on** `governance/`. Flows then call `$AIDAKIT_GOVERNANCE/validators/<x>.js`, which expands to `governance/validators/<x>.js` — the same path they name today, but rooted absolutely at the kit install rather than relatively at the consumer cwd. This matches the owner's snippet and flow example verbatim ([`request.md`](../../../.aidakit/tasks/validator-path-resolution/request.md)); the alternative (point at the parent, flows write `$AIDAKIT_GOVERNANCE/governance/validators/…`) is rejected below.

Change to `executeRuns`:

```js
// module scope, near the imports
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
// governance/engine/steps/runs.js → up two levels lands ON governance/ (the kit's
// governance dir), so $AIDAKIT_GOVERNANCE/validators/x resolves regardless of cwd.
const AIDAKIT_GOVERNANCE = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
```
```js
// inside executeRuns, replacing line 20
const env = { ...process.env, AIDAKIT_GOVERNANCE };
```

Precedence: the computed value is spread **after** `...process.env`, so it always wins over any inherited `AIDAKIT_GOVERNANCE` (the kit is authoritative about its own location). The existing `step.env` loop runs after and may still override per-step; no shipped step does. `resolve` is already imported by sibling modules ([`persistence.js:10`](../../../governance/engine/persistence.js)); add `dirname` from `node:path` and `fileURLToPath` from `node:url`.

### The two grammars must not collide

`$AIDAKIT_GOVERNANCE` uses a **bare `$`** (no braces). The engine's `interpolateString` only substitutes `${...}` (dollar-brace) tokens ([`governance/engine/interpolate.js`](../../../governance/engine/interpolate.js), [flows.md §3](../../guides/flows.md)); `$AIDAKIT_GOVERNANCE` therefore passes through the engine **untouched** and is expanded by `bash -lc` from the injected child env. This is deliberate: engine interpolation (`${inputs.request}`) and shell expansion (`$AIDAKIT_GOVERNANCE`) coexist in the same command string without conflict. Quoting is required (`"$AIDAKIT_GOVERNANCE/…"`) because the plugin cache path (`~/.claude/plugins/cache/aidakit/aidakit/<version>/governance`) may contain spaces.

## Inventory — every relative validator call (verified against the files)

**In scope — flow `runs` calls (10 invocations). Swap `node governance/validators/X` → `node "$AIDAKIT_GOVERNANCE/validators/X"`; leave the `.aidakit/…` argument paths relative.**

| File | Line | Step | Validator | Note |
|---|---|---|---|---|
| `governance/flows/fast.yaml` | 43 | `check_registered` | `derive-roadmap-status.js` | already escapes inner `\"` for `${inputs.request}` |
| `governance/flows/fast.yaml` | 128 | `check_implement_bench` | `check-bench.js` | compound `test … \|\| ! grep … \|\| node …` — swap only the `node` clause |
| `governance/flows/fast.yaml` | 155 | `check_review_bench` | `check-bench.js` | |
| `governance/flows/fast.yaml` | 188 | `check_docs` | `check-doc-manifest.js` | |
| `governance/flows/full.yaml` | 133 | `check_implement_bench` | `check-bench.js` | compound — swap only the `node` clause |
| `governance/flows/full.yaml` | 160 | `check_review_bench` | `check-bench.js` | |
| `governance/flows/full.yaml` | 215 | `dna_freshness` | `check-dna-freshness.js` | |
| `governance/flows/full.yaml` | 258 | `check_docs` | `check-doc-manifest.js` | |
| `governance/flows/docs-onboarding.yaml` | 66 | `diff` | `check-doc-manifest.js` | |
| `governance/flows/docs-onboarding.yaml` | 128 | `check` | `check-doc-manifest.js` | |

**Verified NOT affected:**

- `governance/flows/design.yaml` — inspected: only `invoke`/`human_gate`/`terminal` steps, **no `runs`, no `governance/` path**. Untouched.
- `hooks/` (`hooks.json`, `pre-bash.js`) — reference no validator path. Untouched.
- No `.aidakit/flows/*.yaml` exist in this repo. `AIDAKIT_GOVERNANCE` is a new variable, referenced nowhere yet.

**Out of scope — prose mentions (decision recorded per mention):**

| Location | Kind | Decision |
|---|---|---|
| `agents/orchestrator.md:50` (`derive-roadmap-status.js --root`) | agent runs validator **directly** | **Follow-up debit.** Same defect, different vector: agent Bash sessions get no injected `AIDAKIT_GOVERNANCE`. Do NOT swap to `$AIDAKIT_GOVERNANCE` (undefined there). |
| `agents/doc-planner.md:155` (`check-doc-manifest.js`) | agent next-step instruction | Same as above — follow-up. |
| `skills/roadmap/SKILL.md:64` (`derive-roadmap-status.js --root`) | skill runs validator directly | Same as above — follow-up. |
| `PROCESS.md:291` (`check-plugin-version.js .`) | release-time command, run **inside** the kit repo by maintainers/CI | Correct as relative — always runs where `governance/` exists. Leave. |
| Markdown source links to `governance/validators/*.js` files in `skills/*`, `docs/guides/*`, `governance/README.md`, ADRs, `docs/roadmap/README.md`, code comments | descriptive references to file **location** | Correctly point at the kit-repo path. Not commands. Leave. |
| `docs/archive/2026-07-22-add-debit/*`, `docs/decisions/*` | archived jurisprudence / WORM ADRs | Never edited. Leave. |
| `governance/__tests__/engine.test.mjs:14` (comment) | comment describing the `check_docs` command | In the edited region — update the comment to the post-fix reality (validator reached via `$AIDAKIT_GOVERNANCE`, no symlink). |

The rule applied: **flow calls are fixed; agent/skill direct-invocation is flagged as a distinct debit; source links, release-time in-kit commands, WORM and archive content are left intact.**

## Test change — removing the fabrication (RED→GREEN)

[`governance/__tests__/engine.test.mjs`](../../../governance/__tests__/engine.test.mjs) sets `AIDAKIT_PROJECT_ROOT = tmp` (line 11) and then symlinks the real `governance/` into `tmp` (lines 19-20, justified by the comment on 13-18). Remove:

- `symlinkSync` from the `node:fs` import (line 5) — it becomes unused.
- the `govReal` const and the `symlinkSync(...)` call (lines 19-20).
- the comment block (13-18) that justifies the symlink; replace with a one-line note that validators are now reached via the absolute `$AIDAKIT_GOVERNANCE` injected by `runs.js`, so `cwd = tmp` (a folder with **no** `governance/`) faithfully mirrors a consumer repo.

Everything else stays, including the manifest/bench/roadmap seed helpers and **section 7** (loop-var-resume regressions) — only the setup region is touched.

Why this proves the fix: with `cwd = tmp` and no symlink, the validator-gated tests (§2 happy path, §2b/§2c doc-leash, §2d parallelism leash, §2e register path, §5a) exercise exactly the consumer-repo condition. Against the pre-fix code (relative paths, no env injection) they go **RED** with `Cannot find module`; after the `runs.js` env injection + YAML swap, `$AIDAKIT_GOVERNANCE` supplies the absolute kit path and they go **GREEN**. The child still inherits `AIDAKIT_PROJECT_ROOT = tmp` (spread from `process.env`), so validator **data** (manifest, roadmap epics, bench ndjson) keeps resolving from `tmp` while the validator **script** resolves from the kit — the two concerns are cleanly separated. The non-validator tests (§1 parse, §3 persist, §4 loopmax, §5b/5c, §6, §7) never hit a validator and stay green throughout.

## Documentation change — `docs/guides/flows.md`

- Add an `AIDAKIT_GOVERNANCE` note (best fit: §6 "Creating a flow of your own", where consumer flow authors are addressed, cross-referenced from the §2 `runs` row): kit validators must be called as `node "$AIDAKIT_GOVERNANCE/validators/…"`; relative `governance/…` only resolves inside the kit repo because `governance/` ships inside the plugin. State that `runs.js` injects `AIDAKIT_GOVERNANCE` (pointing at the kit's `governance/` dir) into every `runs` child env.
- Extend §3 ("The expression trap") to name the `${...}` (engine interpolation) vs `$FOO` (shell expansion, e.g. `$AIDAKIT_GOVERNANCE`) distinction — the guide already teaches expression traps; this is the one that makes the fix legible.
- Update the §5 register-mode prose (line ~160) that quotes `node governance/validators/derive-roadmap-status.js …` to the `$AIDAKIT_GOVERNANCE` form, keeping the guide consistent with the fixed `fast.yaml` (flows.md §5 precedence: the flow wins; the guide is corrected to match).

## Alternatives considered

- **Point `AIDAKIT_GOVERNANCE` at the parent of `governance/`** (flows write `$AIDAKIT_GOVERNANCE/governance/validators/…`). Rejected: an extra path segment in every one of the 10 call sites for no gain, and it diverges from the owner's snippet and the documented flow example — more surface to get wrong.
- **Resolve the kit root inside each validator** (each validator self-locates via its own `import.meta.url`). Rejected: the breakage is in *how the flow spells the command*, not inside the validators; every validator would need the same boilerplate, and it does nothing for a consumer flow that spells a fresh `node governance/validators/…` command.
- **Keep the test symlink and only fix the flows.** Rejected: the symlink is precisely what masked the bug; leaving it means the regression can silently return. Removing it is what makes the test faithful to a consumer repo (the RED that proves the GREEN).
- **`process.chdir` to the kit root before spawning.** Rejected: `runs` steps legitimately need `cwd = projectRoot()` so the `.aidakit/…` argument paths and validator **data** resolve against the consumer repo; changing cwd would break those. Injecting an env var separates "where the script lives" from "where the data lives."

## Constraining ADRs

None pre-existing constrained this change. [ADR-001](../../decisions/ADR-001-executable-dna-crystallization.md), [ADR-002](../../decisions/ADR-002-roadmap-status-derived-from-disk.md), [ADR-003](../../decisions/ADR-003-shared-knowledge-in-docs.md) govern DNA crystallization, roadmap-status derivation, and shared knowledge — none touches flow-engine path resolution.

**Revised at review (round 1): this change introduces [ADR-004](../../decisions/ADR-004-aidakit-governance-env-contract.md)**, locking the `AIDAKIT_GOVERNANCE` contract this design pins above — the variable name, points-AT-`governance/` semantics (§"AIDAKIT_GOVERNANCE — semantics"), `runs`-child-only injection, precedence (computed wins over inherited env), the quoting requirement, the four rejected alternatives (§"Alternatives considered" below, lifted verbatim into the ADR), and the consequence that renaming/moving `governance/` becomes a breaking change for consumer flows. The original claim ("no new decision is locked") undersold the mechanism decided here; ADR-003's placement boundary ("a decision with alternatives → ADR") applies to it.

## Rollback

Revert the single commit: `runs.js` drops the env line, the flows return to relative paths, the test regains its symlink, `flows.md` loses the note. The validator-gated tests would go RED again (with the symlink also reverted) — the intended signal.

## Conventions and evidence location

- Flow YAML edits stay within the zero-dep mini-parser's subset ([flows.md §7](../../guides/flows.md)): spaces only, `- ` list items, values with a trailing `#` quoted (none here). Inner double quotes escaped as `\"`, matching the existing `${inputs.request}` idiom in `fast.yaml:43`.
- Test edits follow the file's numbered-section convention; section 7 is preserved verbatim.
- Canonical commands (from `governance/README.md`): `node governance/__tests__/engine.test.mjs`; full suite = every file under `governance/__tests__/*.test.mjs` run with `node`.
- Evidence is recorded at the fixed location [`docs/features/validator-path-resolution/evidence.md`](evidence.md).
