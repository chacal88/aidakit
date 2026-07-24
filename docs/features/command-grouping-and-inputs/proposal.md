# Proposal — command-grouping-and-inputs

**Change ID:** `command-grouping-and-inputs`
**Date:** `2026-07-24`
**Owner:** `@chacal88`
**Phase / Package:** `n/a (command-surface refactor; classification: domain=product, type=feature, flags=[architecture, contract])`
**PRD:** `n/a`
**Tech Spec:** `n/a`

## Why

The kit ships **7 flat commands** (`commands/build.md`, `catalog.md`, `design.md`, `docs.md`, `governance.md`, `plan.md`, `review.md`) under a single namespace: `/aidakit:build`, `/aidakit:catalog`, … Three problems fall out of that flatness:

1. **Orchestrators are indistinguishable from utilities in autocomplete.** Two of the seven (`build`, `design`) are **stateful flow orchestrators** — they drive the executable engine (`node governance/cli.js start <flow>`) with resumable state and human gates. The other five (`catalog`, `docs`, `governance`, `plan`, `review`) are **single-shot utilities** — they invoke a skill or read a file and return. Typing `/aidakit:` in Claude Code shows a flat alphabetical list that gives the human no way to tell a stateful, resumable flow apart from a one-shot call **without opening each file**.
2. **Commands don't surface their expected inputs.** `build`/`design` take a verb grammar (`start <flow> key=value …`, `resume <flow_id> <outcome>`, `status|abort|list`, plus `register "…"`); the utilities take a mode or a free-form argument. Invoked with empty or malformed `$ARGUMENTS`, a command today **guesses or fails silently** instead of proactively showing what it expects and a realistic invocation to copy-paste.
3. **The command/skill/agent distinction is buried.** The yardstick that separates the three piece types lives in [PROCESS.md](../../../PROCESS.md) §1 prose. At the actual point of confusion — the command a human just typed, or `aidakit:catalog` — the distinction is invisible.

This change fixes all three at the command-surface level. It is **theme 1 of a 3-theme request**; themes 2 (a flow progress table) and 3 (step summaries between steps) are explicitly out (see Non-goals) and get registered as future changes.

## What Changes

- **Group the orchestrators under a `flow` prefix.** The two engine-driving commands move into a named group so autocomplete visually separates them from the utilities. The exact syntax is **spike-gated** (see Dependencies and [design.md](design.md)): the primary is a 3-segment plugin namespace `/aidakit:flow:build` and `/aidakit:flow:design`; the **locked, spec-safe fallback** is a flat prefix `/aidakit:flow-build` / `/aidakit:flow-design`. Both satisfy the acceptance criterion because both sort the two orchestrators together under a shared, self-describing prefix.
- **Utilities stay flat and keep their names** (`/aidakit:catalog`, `/aidakit:docs`, `/aidakit:governance`, `/aidakit:plan`, `/aidakit:review`). The **absence** of a group prefix is what marks a utility. This also keeps the migration blast radius to two renamed files.
- **Every command gains an inputs/usage block.** On empty or malformed `$ARGUMENTS`, the command proactively prints (a) the inputs it expects and (b) at least one realistic copy-paste example — instead of guessing. Pattern in [design.md](design.md).
- **The command/skill/agent distinction becomes visible at the command.** Each command's `description:` frontmatter leads with its classification (flow orchestrator vs single-shot utility) and its usage block names what it dispatches (a flow, a skill, or a file). `aidakit:catalog` (`skills/catalog/INDEX.md`) surfaces the grouping.
- **The naming/grouping scheme is recorded as an ADR** (`docs/decisions/ADR-005-command-namespacing.md`), authored **after** the spike locks the syntax, following the format of [ADR-001](../../decisions/ADR-001-executable-dna-crystallization.md)…[ADR-004](../../decisions/ADR-004-aidakit-governance-env-contract.md).
- **Plugin manifest version bump** so the rename actually reaches installed users (see Migration).

## Non-goals

- **Theme 2 — flow progress table** (`flow-run-progress-table`): showing a progress table at flow start/during a run. Out. Registered as a future change (see Unblocks).
- **Theme 3 — step summaries** (`flow-step-summaries`): summaries between steps and at human gates. Out. Registered as a future change.
- **No progress table or step summary is added by any file in this change.**
- **The flow engine is NOT renamed.** `governance/`, `governance/cli.js`, and `governance/flows/*.yaml` (`fast`, `full`, `design`, `docs-onboarding`) keep their names. The `flow` group prefix on the command surface is **not** license to rename the engine.
- **The design-phase skills are NOT renamed.** `aidakit:design-business`, `aidakit:design-modeling`, `aidakit:design-architecture`, `aidakit:design-implementation` keep their names — they contain `design` but are unrelated to the `/aidakit:design` command (see the cross-reference surgery in [design.md](design.md)).
- **Utilities get no group prefix** in this change. Anticipated future groups (e.g. hook routines) are described as an extensibility contract but **no command is invented for them now**.

## Migration — direct break, no bridge aliases

The rename is a **direct break**: `commands/build.md` and `commands/design.md` are renamed outright (no `commands/build.md` alias left behind pointing at the new name). Bridge aliases were considered and **rejected**: an alias would keep the old name in autocomplete, doubling the very clutter this change removes.

The break is recorded in the release/version note (the manifest bump). **Named tradeoff:** the real dogfooding consumer, **psim-kernel**, invokes `/aidakit:build` and `/aidakit:design` today; on a direct break those invocations stop resolving until psim-kernel updates to the new names on its **next plugin sync**. This is accepted deliberately — the alternative (permanent aliases) is worse for the primary acceptance goal (a clean, unambiguous autocomplete surface). The manifest version bump is what makes `claude plugin update` actually copy the rename to installed users; **without a bump strictly above the manifest version on main at implementation start (re-read `plugin.json`; currently `0.5.1`), `claude plugin update` no-ops and the rename never reaches anyone** (the two-numbering trap recorded in [PROCESS.md](../../../PROCESS.md) §5).

## Affected capabilities

- **The `/aidakit:*` command surface** (`commands/`). No canonical capability spec exists for the command surface (this repo has no `docs/specs/`), so **no spec delta** — mirroring [loop-var-resume](../../archive/2026-07-22-loop-var-resume/proposal.md), whose engine contract was pinned by tests rather than a spec. Here the behavioral contract (the grouping criterion, the naming scheme, the input-example pattern, the extensibility rule) is pinned by **`ADR-005`** plus the command files themselves.

## Impact per surface

| Surface | Impact |
|---|---|
| `commands/` | 2 files renamed (`build.md`, `design.md` → the `flow` group per the spike outcome); inputs/usage block added to **all 7** command files; `description:` frontmatter re-led with the classification |
| `docs/decisions/` | 1 new ADR (`ADR-005-command-namespacing.md`) + its row in `README.md` |
| `docs/roadmap/` | new epic `EPIC-flow-cli-ux` registering this change + themes 2/3 — **deferred to Task 0** via `aidakit:roadmap` (ADR-002: `ROADMAP.md` is derived, never hand-edited) |
| `skills/catalog/` | `INDEX.md` + `SKILL.md` cross-refs updated; grouping surfaced |
| prose docs | cross-references to `/aidakit:build` and `/aidakit:design` updated in ~21 files (see [design.md](design.md) for the exact, surgical list) |
| `.claude-plugin/plugin.json` | `version` bump strictly above the live manifest (currently `0.5.1`; recommended `0.6.0`) |
| `governance/` | **none** — engine, CLI, and flow yamls untouched (non-goal) |

## Dependencies

- **Spike gates the naming syntax (Task 1, blocking).** Nothing today verifies that Claude Code renders a 3-segment plugin command namespace (`/aidakit:flow:build`) from a `commands/flow/build.md` subdirectory — the official plugins inspected use no command subdirectories, so there is no precedent. Task 1 verifies feasibility with a **locked fallback** (`/aidakit:flow-build`). No spec or acceptance criterion depends on the unverified 3-segment syntax.
- **ADR-005 depends on the spike** — its Decision section records whichever syntax the spike locks. Authored after Task 1, before the renames.

## Exit criteria

Each maps to an owner-confirmed acceptance criterion; evidence recorded in [evidence.md](evidence.md).

- Typing `/aidakit:` shows a name+description scheme where the two orchestrators (`build`, `design`) are visually grouped under the `flow` prefix and the five utilities are visibly single-shot — clear **without opening files**.
- Each of the 7 commands, invoked with empty/malformed `$ARGUMENTS`, responds with expected inputs **and** at least one realistic copy-paste example.
- The command/skill/agent distinction is visible at the command itself and in `aidakit:catalog`.
- Task 1 spike ran; the naming syntax is locked (3-segment **or** the fallback), and the ADR/spec reflect the locked syntax — not an unverified one.
- All cross-references to the two renamed commands are updated; `node "$AIDAKIT_GOVERNANCE/validators/check-links.js" .` (or `node governance/validators/check-links.js .` in this repo) exits 0 (main is clean as of 2026-07-24; if pre-existing breaks reappear before implementation, the baseline captured as the first action is authoritative and only NEW breaks fail this change).
- `ADR-005-command-namespacing.md` exists and `node governance/validators/check-adr-format.js docs/decisions/ADR-005-command-namespacing.md` exits 0.
- `.claude-plugin/plugin.json` `version` is bumped strictly above the manifest version on main at implementation start (re-read it; currently `0.5.1`); `node governance/validators/check-plugin-version.js .` exits 0.
- No file in this change adds a progress table or a step summary.

## Unblocks

The new epic **`EPIC-flow-cli-ux`** (registered in Task 0) groups this change with the two deferred themes:

- `flow-run-progress-table` — theme 2: a flow progress table at start/during a run.
- `flow-step-summaries` — theme 3: step summaries between steps and at human gates.

The orchestrator's earlier analysis found the existing `EPIC-flow-engine-leashes` ([epic](../../roadmap/epics/EPIC-flow-engine-leashes.md)) — mechanical leashes on the engine (retry caps, acceptance leash, retry memory) — does **not** fit these CLI-UX concerns, hence the new epic.

## Recorded decisions and inherited open decisions

- Read the [decisions index](../../decisions/README.md) and all four ADRs:
  - [ADR-001](../../decisions/ADR-001-executable-dna-crystallization.md) (executable DNA), [ADR-003](../../decisions/ADR-003-shared-knowledge-in-docs.md) (knowledge in docs) — do not constrain the command surface.
  - [ADR-002](../../decisions/ADR-002-roadmap-status-derived-from-disk.md) (roadmap status derived from disk) — **constrains Task 0**: the roadmap registration authors epic intent but never hand-edits the generated `ROADMAP.md`.
  - [ADR-004](../../decisions/ADR-004-aidakit-governance-env-contract.md) (`AIDAKIT_GOVERNANCE` env contract) — informs how validators are invoked from flows; the engine it governs is explicitly out of scope here.
- **New decision locked by this change:** the command naming/grouping scheme → drafted as `ADR-005-command-namespacing.md` (Task 2). It does not supersede or contradict any existing ADR, so no escalation is triggered; it is a fresh public-interface decision the task inherently introduces.
- No open-decisions log exists in this repo; nothing inherited.
