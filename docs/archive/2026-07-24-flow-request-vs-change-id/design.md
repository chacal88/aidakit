# Design — flow-request-vs-change-id

**Change ID:** `flow-request-vs-change-id`
**Date:** `2026-07-24`
**Owner:** `@chacal88`
**Phase / Package:** `engine + flows (governance/) — bugfix with contract change (ADR-006)`
**PRD:** `n/a`
**Tech Spec:** `n/a`

## The two halves of the defect

The live failure (`full-260724-ca264a`) composes two independent gaps, and each gets its own mechanism:

1. **No channel for the change-id.** The orchestrator resolves it at `select`, but `executeInvoke` persisted only `{outcome, invoke_target}`. The flow yaml *had* to reach for `${inputs.request}` — there was nothing else. → **Structured invoke outputs.**
2. **Interpolated values are re-parsed as shell.** `interpolateString` splices raw text into `command`, and `bash -lc` parses the result — any value with newlines/metacharacters becomes command structure. → **Values as env data.**

Fixing only (1) leaves the landmine armed for the next flow that naively interpolates prose into a command; fixing only (2) still paths bench/doc-manifest files under a request-shaped directory name. Both land together under [ADR-006](../../decisions/ADR-006-flow-values-as-data.md).

## Half 1 — structured invoke outputs (the fail-closed leash)

- **Declaration** (yaml, validated at LOAD by `parser.js`): `outputs: {<outcome>: [key, ...]}` on an invoke step; every declared outcome must appear in `expects`, every key must be an identifier and not reserved. A malformed declaration is a load error, same doctrine as a nonexistent routing target.
- **Transport**: CLI `resume <flow_id> <outcome> [key=value ...]` → `parseResumeOutput` (`resume-output.js`) rejects malformed tokens with a usage error BEFORE any state is touched; the engine API mirrors it as `resumeFlow({…, resumeOutput})`, threaded single-shot through `drive()` exactly like `resumeValue`.
- **Enforcement** (`invoke.js`): a valid outcome whose declared keys are missing or unsafe **re-pauses** the step with the exact `resume … change_id=<value>` line to run — the preserve-the-run doctrine already used for invalid outcomes (whose broken prompt template, printing empty `""` placeholders, is fixed in passing). Supplied keys merge into `context[step.id]` before `outcome`/`invoke_target` are set, so the engine-owned fields can never be overridden; `__proto__`-shaped keys are rejected at both boundaries.
- **Value shape**: `^[A-Za-z0-9._:@/-]+$`, single line. Ids, branch names, paths and URLs fit; prose deliberately does not — these values exist to be interpolated into commands and paths. Widening is a deliberate future ADR (review trigger in ADR-006), not a regex tweak.
- **Why outcome-scoped** (`outputs.success`, not a flat list): `select` on `failure` routes to `aborted` — demanding a change-id there would force the operator to invent one. The map scopes the requirement to the outcomes that actually feed downstream paths.

## Half 2 — `runs` values as env data

`interpolateCommand` (`interpolate.js`) walks the same `${expr}` grammar as `interpolateString`, but instead of splicing the value it emits `$AIDAKIT_VAR_n` and returns the value in a `vars` map; `runs.js` spreads `{...process.env, ...vars, AIDAKIT_GOVERNANCE}` (governance last — the kit stays authoritative about its own path, per ADR-004's precedence note). Properties:

- **Injection is dead by construction**: bash expands `$AIDAKIT_VAR_n` *after* parsing — the value can never contribute command structure, quotes, `$(…)` or separators. Same guarantee as parameterized SQL.
- **Existing idioms survive byte-for-byte**: `test "${inputs.mode}" = register` renders `test "$AIDAKIT_VAR_0" = register` — the yaml's own double quotes now also suppress word-splitting. No shipped flow single-quotes an interpolation (checked: `full`, `fast`, `docs-onboarding`); the caveat is documented in flows.md §3.
- **Unresolved expressions unchanged**: left as literal `${…}` (bash "bad substitution" → exit≠0 → routes `on_failure`), exactly the pre-change behavior. The outputs leash makes the interesting case (`${context.select.change_id}` before select reported) unreachable at the source instead.
- **Debuggability**: step output records the executed `command` (with `$AIDAKIT_VAR_n` references) plus the `vars` map — the state file shows both what ran and what the values were, without pretending a spliced string was executed.
- **Scope**: only `command`. `cwd`/`env` values and invoke/gate prompts keep plain interpolation — no shell re-parses them.

## Flow rewiring

`select` declares `outputs: {success: [change_id]}` in both flows. Every task path keys on `${context.select.change_id}`, double-quoted: full's `check_implement_bench`, `check_review_bench`, `dna_gate`, `dna_freshness`, `check_docs`, plus `dna_pr`'s branch; fast's `check_implement_bench`, `check_review_bench`, `check_docs`. `--outcome ${context.…}` sites gain quotes. Steps that operate on the change package (`plan` in fast; `learn`, `dna_pr`, `document` in both/full) receive `change_id` in their `input` alongside the original `request` — the request stays available as context, the id stays authoritative for paths. Register mode is untouched: there `${inputs.request}` IS the declared change-id and `check_registered` already leashes it.

## Regression tests (engine.test.mjs §9)

- **9a** — the live bug, end-to-end: a hostile multiline request (quotes, `$(…)`, backticks, `test: too many arguments` text) drives `full` through the REAL engine/shell seam to completion; asserts no exit 127, no `command not found`/`too many arguments` in any stderr, the raw request absent from every executed command, all four gates exit 0 against the change-id path, and the change-id arriving as env data.
- **9b / 9b-ii** — the leash is fail-closed (missing key re-pauses with the key named; unsafe value re-pauses; valid value advances and persists) and outcome-scoped (failure needs nothing).
- **9c** — `parseResumeOutput` grammar: accepts ids/URLs, rejects missing `=`, empty keys, reserved keys, `__proto__`, spaces, newlines, metacharacters.
- **9d** — data-passing proof at the bash seam: a payload containing `$(echo pwned)`, backticks, `; exit 127` and newlines reaches the child byte-identical via `printf %s "${inputs.payload}"` — nothing executes.
- **9e** — parser rejects `outputs` declaring an outcome outside `expects` or a reserved key, at LOAD.
- **§7a updated honestly**: it asserted the *spliced* command text (`echo building alpha`); it now asserts what bash actually saw — stdout + `vars` — since the command text legitimately changed shape.

## Rejected shapes

Recorded with pros/cons in [ADR-006 — Alternatives considered](../../decisions/ADR-006-flow-values-as-data.md): in-place shell-escaping (breaks the flows' existing quoting idioms), flows-only fix (leaves the landmine for future/consumer flows), failing residual `${`, mutating `inputs.request` after select (audit loss, re-conflates the two meanings), free-form JSON resume payload (invites prose back into context).
