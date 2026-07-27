# Proposal — per-flow-commands

**Change ID:** `per-flow-commands`
**Date:** `2026-07-27`
**Owner:** `@chacal88`
**Phase / Package:** `n/a (command-surface + generator; classification: domain=process, type=feature, flags=[architecture, contract], confirmed)`
**PRD:** `n/a`
**Tech Spec:** `n/a`

## Why

Today the `flow-` command group has **two orchestrators named by activity, not by flow**: [`commands/flow-build.md`](../../../commands/flow-build.md) drives *both* the `fast` and the `full` flow (`start fast …` / `start full …`), and [`commands/flow-design.md`](../../../commands/flow-design.md) drives `design`. That naming is a leftover from before the engine had named flows: [ADR-005](../../decisions/ADR-005-command-namespacing.md) locked the `flow-` prefix and the *mechanical grouping criterion* ("the command drives the engine") but derived the individual command name from the **activity** (`build`), not from the **flow name** in the YAML. The result is a surface that does not line up with the four flow YAMLs it wraps ([`governance/flows/fast.yaml`](../../../governance/flows/fast.yaml), [`full.yaml`](../../../governance/flows/full.yaml), [`design.yaml`](../../../governance/flows/design.yaml), [`docs-onboarding.yaml`](../../../governance/flows/docs-onboarding.yaml)) and forces the operator to type the engine boilerplate by hand — `start <flow> <inputKey>=…` — even though every flow already *declares* its required input key in its top-level `inputs:` list.

Two concrete costs follow. **First, boilerplate at the point of use.** To start the fast flow the operator types `/aidakit:flow-build start fast request="…"` — the `start`, the `fast`, and the `request=` are all mechanically derivable from the flow YAML, yet the human supplies them every time. **Second, the surface does not scale to consumer flows.** ADR-005 §"Extensibility contract" promises that a consumer authoring `.aidakit/flows/<my>.yaml` "follows the same rule in their own plugin namespace" — but there is no mechanism that turns a project flow into a command. A consumer must hand-author a command `.md` that duplicates the same wrapper prose the built-ins carry, with no tool to keep it in sync with the flow it wraps.

This change makes the command surface **flow-name-based and generated**. One command per flow YAML (`flow-fast`, `flow-full`, `flow-design`), each self-contained for the whole lifecycle, with the start verb *implicit* so the bare `$ARGUMENTS` is the request. A single zero-dep generator under `governance/` renders every `flow-<name>.md` from a flow YAML's declared `inputs:`/`flow:`/`description:` through **one template**; the three built-ins in `commands/` become the generator's committed output, guarded by a byte-drift test. The same generator, in consumer mode, is exposed as the utility `/aidakit:flow-sync`, which scans a project's `.aidakit/flows/*.yaml` and writes `.claude/commands/flow-<name>.md` — fail-closed on a sentinel-less file and on a name that collides with a built-in. Because the generator legitimately wears the `flow-` prefix without itself driving the engine, and because the naming shifts from activity to flow-name, this change extends ADR-005 on two points and records it in a new WORM **ADR-017** — an owner-approved, recorded contract change (see [Recorded decisions](#recorded-decisions)), not a silent one.

## What Changes

- **`commands/flow-build.md` is removed**; its fast+full coverage splits into `commands/flow-fast.md` and `commands/flow-full.md`, and `commands/flow-design.md` is replaced by the generator's committed output for the `design` flow. No bridge alias (consistent with ADR-005's rejected-alias stance).
- **Start becomes the implicit verb.** `/aidakit:flow-fast <free-form request>` runs `cli.js start fast request="<args>"` with no `start`/`fast`/`request=` typed by the operator. Each command still carries the full lifecycle (`resume`, `status`, `abort`, `list`) as explicit verbs; `register` lands **only** on `flow-fast` (it is fast's `mode=register`).
- **A single generator ships as runtime under `governance/`** — pure Node, zero-dep, reusing the engine's existing YAML loader. It renders every `flow-<name>.md` from one template, in two source/target modes (kit-dev → committed `commands/`; consumer → `.claude/commands/`).
- **`/aidakit:flow-sync`** is a new single-shot utility command that runs the generator in consumer mode over `.aidakit/flows/*.yaml`, idempotently.
- **A drift test in `governance/__tests__/`** fails if any committed built-in drifts byte-for-byte from re-running the generator over the same flow YAMLs.
- **`docs/decisions/ADR-017-flow-command-generation.md`** is authored (WORM; ADR-005 is not edited) recording the two-point extension, plus the `docs/decisions/README.md` index row.
- **`.claude-plugin/plugin.json` `version` is bumped** (ADR-016) and the regenerated command files carry a fresh doctrine footer, so both CI leashes stay green.
- **`docs-onboarding` gets no generated command** — it is excluded via a per-flow opt-out marker so the existing `aidakit:docs` utility stays the single door (see [design.md §8](design.md), the AMBIGUOUS-assumption resolution).
- **Cross-reference migration:** every `/aidakit:flow-build` mention (docs, guides, skills, the `design → build` handoff) is repointed to `flow-fast`/`flow-full`.

## Non-goals

- **No change to the engine or the flow YAMLs' step graphs.** `governance/engine/*` and the `steps:` graph, gate options and step semantics of every flow are untouched. Two flow-YAML files are edited, both non-behavioral: (1) the one-line opt-out marker on `docs-onboarding.yaml` (§8, the only *structural* edit); (2) a **prose-only** cross-reference edit to `governance/flows/design.yaml` — three text fields (the flow `description:`, the `gate4` prompt, the `done` terminal message) that today tell the operator to run the removed `/aidakit:flow-build` are repointed to `/aidakit:flow-full` (or `/aidakit:flow-fast`) (design.md §9). This is a migration of a stale handoff reference, not a change to how the design flow runs.
- **No generic orchestrator command.** The owner settled the topology (brainstorm question 3): each `flow-<x>` is full-featured; the `resume`/`status`/`abort`/`list` prose repeating across commands is accepted duplication, not a defect to factor into a shared command.
- **`docs-onboarding` is not promoted to an engine-driven command.** Default (b) of the AMBIGUOUS assumption; `aidakit:docs` remains the single door.
- **No generation hook.** Generation is on-demand via `/aidakit:flow-sync` only — no `SessionStart` or other hook is added or changed (brainstorm assumption `on-demand-not-hook`).
- **No bridge alias for `flow-build`.** The break is direct and recorded in ADR-017's migration note (psim-kernel re-syncs and runs `flow-sync`).
- **No spec delta.** This repo has no `docs/specs/` corpus (ADR-005 §Alternatives) — the command-surface contract lives in ADRs, so the contract change is recorded in ADR-017, not a spec.
- **ADR-005 is not edited.** It is WORM; ADR-017 supersedes it on the two named points and the index records the supersession.

## Acceptance criteria

- `per-flow-start-shortcut` — invoking `/aidakit:flow-fast <text>` (and `flow-full`, `flow-design`) starts the corresponding engine flow via `cli.js start <flowName> <inputKey>=<text>` with the bare `$ARGUMENTS` as the start payload — no `start`/`<flowName>`/`<inputKey>=` boilerplate typed; running the command on a one-line request yields a flow paused at its first step.
- `input-key-derived-from-yaml` — each generated start-shortcut maps the bare `$ARGUMENTS` to the flow's required input key read from the flow YAML top-level `inputs:` list (fast/full → `request`, design → `project`), never a hardcoded key.
- `full-lifecycle-self-contained` — each `flow-<x>` command is self-contained for the whole lifecycle (start implicit, `resume`, `status`, `abort`, `list`) with no separate generic orchestrator command in the surface.
- `flow-name-command-rule` — exactly one `flow-<yamlFlowName>` command per flow YAML ships; `flow-build` is removed (fast+full split across `flow-fast`/`flow-full`); `flow-design` survives; `commands/flow-build.md` no longer exists after the change.
- `generator-single-source-of-truth` — a single generator produces every `flow-<name>.md`; the built-in `commands/flow-fast.md`, `flow-full.md`, `flow-design.md` are its committed output over `governance/flows/*.yaml`, and a `governance/__tests__/` test fails if any committed built-in drifts byte-for-byte from re-running the generator.
- `generator-consumer-sync-command` — `/aidakit:flow-sync` scans the consumer project's `.aidakit/flows/*.yaml` and (re)generates `.claude/commands/flow-<name>.md` per flow, idempotently (a no-change re-run produces byte-identical files); dropping `.aidakit/flows/foo.yaml` then running flow-sync creates `.claude/commands/flow-foo.md` that starts the `foo` flow.
- `generator-fail-closed-collision` — the generator stamps a sentinel header (`<!-- aidakit:generated flow=<name> … -->`), never overwrites a `flow-*.md` lacking the sentinel, and refuses to generate for a project flow whose YAML name collides with a shipped built-in (`fast`/`full`/`design`), reporting the refusal reason.
- `adr017-extends-flow-group` — a new WORM ADR-017 records (no edit to ADR-005) that the `flow-` group-membership criterion widens from "drives the engine" to "belongs to the flow mechanism family" (so `/aidakit:flow-sync` legitimately wears the prefix), and that naming shifts from activity-based (`flow-build`) to flow-name-based (`flow-<yamlName>`), superseding ADR-005 on those two points.
- `plugin-version-bumped` — `.claude-plugin/plugin.json` `version` is bumped so the changed command surface reaches installed users via `claude plugin update` (ADR-016); both CI validators pass — `check-runtime-bump` (the generator under `governance/` changed) and `check-plugin-version` (the new vX.Y doctrine footer).
- `adr005-conventions-preserved` — every generated command preserves the ADR-005 conventions: a `description:` frontmatter carrying the classification word (flow orchestrator vs single-shot utility), a `## Usage` block with at least one copy-paste example printed on empty/malformed `$ARGUMENTS`, and the fail-closed `: "${AIDAKIT_GOVERNANCE?…}"` guard chained ahead of every `cli.js` call.

## Affected surfaces

One line per surface the change touches (this repo is a single-package plugin):

- **Runtime (`governance/`)** — new generator module + template + drift test; one-line opt-out marker added to `governance/flows/docs-onboarding.yaml`. Trips `check-runtime-bump` (ADR-016).
- **Command surface (`commands/`)** — `flow-build.md` removed; `flow-fast.md`, `flow-full.md`, `flow-design.md`, `flow-sync.md` are the generator's committed output (design/full via generation; `flow-sync` is a hand-authored utility command).
- **Decisions (`docs/decisions/`)** — `ADR-017-flow-command-generation.md` + `README.md` index row.
- **Prose (`docs/`, `skills/`)** — cross-reference migration `flow-build` → `flow-fast`/`flow-full`.
- **Manifest (`.claude-plugin/plugin.json`)** — version bump.

## Dependencies

- **ADR-005** (locked) — the contract this change extends; must be read before authoring ADR-017. No unresolved open decision blocks this change (`aidakit:flow-sync`, the generator, and the split were all settled at the brainstorm gate — [`.aidakit/tasks/per-flow-commands/brainstorm.json`](../../../.aidakit/tasks/per-flow-commands/brainstorm.json)).
- **ADR-016** (locked) — mandates the plugin-version bump because the generator ships under `governance/`.
- The engine's YAML loader ([`governance/engine/parser.js`](../../../governance/engine/parser.js), [`yaml-min.js`](../../../governance/engine/yaml-min.js)) — reused, not reimplemented ("cut, don't copy", mirroring ADR-016's `resolveBaseRef` reuse).

## Exit criteria

- `node governance/__tests__/<drift-test>.mjs` → exit 0 (the three built-ins match the generator's output; consumer-mode collision/sentinel/idempotency cases pass).
- `node governance/validators/check-adr-format.js docs/decisions/ADR-017-flow-command-generation.md` → exit 0.
- `node governance/validators/check-links.js .` → exit 0 (no broken link; every `flow-build` reference repointed).
- `node governance/validators/check-plugin-version.js .` → exit 0 (manifest ≥ highest footer).
- `node governance/validators/check-runtime-bump.js . --base origin/main` → exit 0 (manifest rose in the same range the generator changed).
- `commands/flow-build.md` does not exist; `commands/flow-fast.md`, `flow-full.md`, `flow-design.md`, `flow-sync.md` exist; no stale `/aidakit:flow-build` invocation remains outside this change's own artifacts.

## Recorded decisions

Settled with the owner at the brainstorm gate ([`.aidakit/tasks/per-flow-commands/brainstorm.json`](../../../.aidakit/tasks/per-flow-commands/brainstorm.json)) — designed around, not relitigated:

1. Syntax is the flat `flow-` prefix ([ADR-005](../../decisions/ADR-005-command-namespacing.md); the `flow:fast` colon form is impossible under Claude Code's subdirectory flattening).
2. No generic orchestrator command; each `flow-<x>` is self-contained. `flow-build` removed; fast+full split; `flow-design` stays.
3. `register` is fast's `mode=register` → lives only on `flow-fast`.
4. One generator renders every command from one template; the three built-ins are its committed output; a drift test guards them.
5. `/aidakit:flow-sync` runs the generator in consumer mode.
6. Fail-closed generator: sentinel header, never overwrites a sentinel-less file, refuses built-in-name collisions.
7. **ADR-017** (new, WORM) extends ADR-005 on group-membership and naming — the recorded contract-change escalation (brainstorm `escalations[0]`).
8. `plugin.json` bumps (ADR-016); both CI validators pass.

**Inherited open decisions:** none. The `docs-onboarding-scope` assumption carried an `AMBIGUOUS:` marker; it is resolved in [design.md §8](design.md) (default (b) — opt-out marker, `aidakit:docs` stays the single door).

## What this unblocks

The next package: consumer-authored flow commands become a supported, tool-maintained surface — a project can drop `.aidakit/flows/<x>.yaml` and get a `/aidakit:flow-<x>` command via `flow-sync`, fulfilling ADR-005's extensibility contract that until now had no mechanism.
