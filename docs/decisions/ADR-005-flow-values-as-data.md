<!-- File: docs/decisions/ADR-005-flow-values-as-data.md — global sequential numbering, never recycled. Registered in the index docs/decisions/README.md. -->
<!-- An ADR is WORM: never edit a past decision. Changed your mind → a new ADR that supersedes or amends this one. -->

# ADR-005: Flow values are data — env-passed `runs` interpolation and structured invoke outputs

- **Status:** accepted
- **Date:** 2026-07-24

## Context

The documented usage of `/aidakit:build` is `start full request="<free-form text>"` — the request is prose, often multiline. But `full.yaml`/`fast.yaml` interpolated that same `${inputs.request}` into `runs` **shell commands** as if it were a change-id: `test ! -f .aidakit/tasks/${inputs.request}/bench.ndjson || …`. The engine's `interpolateString` splices the raw value into the command text, and `bash -lc` then re-parses the result — so a multiline request exploded into multiple shell commands (live capture `full-260724-ca264a`: exit 127, `test: too many arguments`, every line of the request executed as a command), and the step's `on_failure` back-edge looped the flow between `implement`/`review_bench` forever.

The deeper defect is that the flow had **no safe variable carrying the change-id at all**: the `select` step (aidakit:orchestrator) resolves the real change-id, but the engine recorded only `{outcome, invoke_target}` in `context.select` — the resume protocol (`resume <flow_id> <outcome>`) had no channel for data. The task paths reached for `${inputs.request}` because nothing better existed.

Two contracts therefore needed to change together: how a value **enters** the flow state from the operator (inversion of control, [governance/README.md](../../governance/README.md)), and how a value **leaves** the flow state into a shell command.

## Decision

**1. `runs` interpolation passes values as environment DATA, never as shell text.** `executeRuns` renders the command with `interpolateCommand` ([governance/engine/interpolate.js](../../governance/engine/interpolate.js)): each resolvable `${expr}` is replaced by a bash variable reference `$AIDAKIT_VAR_n` and the value is injected into the child's environment. Bash expands the variable at runtime — after command parsing — so the value can never alter the command structure or inject commands, the same guarantee parameterized queries give SQL. Repeated expressions share one variable; unresolved expressions are left as-is (unchanged); `cwd`, `env` and non-shell surfaces (prompts, invoke `input`) keep plain textual interpolation, since no shell re-parses them. The recorded step output carries both the executed `command` and the `vars` map, so state files stay debuggable.

**2. `invoke` steps can declare structured outputs, and the resume protocol carries them.** An invoke step may declare `outputs: {<outcome>: [key, ...]}`. The resume grammar becomes `resume <flow_id> <outcome> [key=value ...]`; the tokens are validated ([governance/engine/resume-output.js](../../governance/engine/resume-output.js)) and persisted into `context[step.id]` for downstream `${context.<step>.<key>}`. The leash is **fail-closed**: resuming with an outcome whose declared keys are missing or unsafe **re-pauses** the step (same preserve-the-run doctrine as an invalid outcome), so a task-path variable can never be left unresolved. Values are constrained to safe single tokens (`^[A-Za-z0-9._:@/-]+$` — ids, branches, paths, URLs; never prose), keys to plain identifiers with `outcome`/`invoke_target`/prototype-mutating names reserved.

**3. Flows key task paths on the reported change-id, quoted.** `select` declares `outputs: {success: [change_id]}`, and every `.aidakit/tasks/…`/`.aidakit/dna/…` path in `full.yaml`/`fast.yaml` interpolates `${context.select.change_id}` inside double quotes. `${inputs.request}` remains legitimate in prompts and skill inputs — surfaces where prose belongs.

## Consequences

- Positive: the request-vs-change-id class dies mechanically — a free-form request cannot break a command (data-passing), and the flow cannot reach a task-path step without a validated change-id (fail-closed outputs). Any future flow, kit-shipped or consumer-authored, inherits both guarantees without doing anything.
- Negative:
  - A flow command can no longer interpolate a value **as shell syntax** (e.g. storing a command fragment in context and splicing it in) — **Accepted** (no shipped flow did this; values-as-data is the point of the decision, and a flow that truly needs shell fragments can still write them literally in `command`).
  - An engine expression inside **single quotes** (`'${x}'`) now renders as the literal text `$AIDAKIT_VAR_n` instead of the value — **Accepted** (no shipped flow single-quotes an interpolation; documented in [flows.md §3](../guides/flows.md) as part of the grammar).
  - The recorded `output.command` in state files shows `$AIDAKIT_VAR_n` references instead of inlined values — **Mitigated** (the sibling `output.vars` map records every value; debugging reads both).
  - Operators (and drivers) must learn the extended resume grammar — **Mitigated** (the pause prompt prints the exact `resume … change_id=<value>` line to run, and re-pauses with the same instruction when a key is missing).
  - `AIDAKIT_VAR_n` joins `AIDAKIT_GOVERNANCE` ([ADR-004](ADR-004-aidakit-governance-env-contract.md)) as engine-owned names in the `runs` child env — **Accepted** (a step-level `env:` entry could still shadow one; no shipped step does).

### Review trigger

If a flow ever legitimately needs to interpolate multi-word prose into a command argument (the value regex forbids it), widen the contract deliberately — e.g. a declared per-key type — in a new ADR instead of loosening `RESUME_OUTPUT_VALUE_RE` in place. Likewise if `parallel`/bench evolution needs multiple structured outputs per step beyond flat `key=value`.

## Alternatives considered

| Option | Pros | Cons | Cost to undo |
|---|---|---|---|
| Shell-escape interpolated values in place (quote-wrap the spliced text) | No env indirection | Escaping is context-dependent: the flows already double-quote most sites, so auto-quoting breaks `test "${inputs.mode}" = register`-style idioms; single-quote wrapping breaks on embedded quotes | medium |
| Only fix the flows (use `${context.select.change_id}`, keep text-splice interpolation) | Smallest diff, no contract change (no ADR) | The landmine survives for every future/consumer flow that naively interpolates `${inputs.request}` into a command — the exact mistake the shipped flows made; nothing enforces the change-id exists before the path steps run | low |
| Have the engine fail any `runs` command whose rendered text still contains `${` | Catches unresolved variables | Solves the *unresolved* half only — a resolved multiline value still exploded; the outputs leash closes unresolved variables at the source instead, before wasted work | low |
| Carry the change-id as a mutable flow input (engine rewrites `inputs.request` after select) | No new YAML field | Overwrites the owner's original request (audit loss), conflates two meanings in one variable — the exact ambiguity that caused the bug | medium |
| Free-form JSON resume payload (`resume <id> <outcome> --json '{…}'`) | Arbitrary structure | Invites prose/nested data straight back into context and thence into commands; `key=value` with a safe-token regex is the leash | medium |
