<!-- File: docs/decisions/ADR-005-command-namespacing.md — global sequential numbering, never recycled. Registered in the index docs/decisions/README.md. -->
<!-- An ADR is WORM: never edit a past decision. Changed your mind → a new ADR that supersedes or amends this one. -->

# ADR-005: Command namespacing — the `flow` group prefix, locked syntax, and the mechanical grouping rule

- **Status:** accepted
- **Date:** 2026-07-24

## Context

The kit ships **7 flat commands** (`commands/build.md`, `catalog.md`, `design.md`, `docs.md`, `governance.md`, `plan.md`, `review.md`) under a single `/aidakit:*` namespace. Two of the seven (`build`, `design`) are **stateful flow orchestrators** — they drive the executable engine (`node governance/cli.js start <flow>`) with resumable state and human gates. The other five (`catalog`, `docs`, `governance`, `plan`, `review`) are **single-shot utilities** — they invoke a skill or read a file and return. Typing `/aidakit:` in Claude Code shows a flat alphabetical list that gives no way to tell a stateful, resumable flow apart from a one-shot call without opening each file. Commands also don't surface their expected inputs: invoked with empty or malformed `$ARGUMENTS`, a command today guesses or fails silently instead of showing what it expects. Finally, the command/skill/agent distinction that separates the three piece types lives only in [PROCESS.md](../../PROCESS.md) §1 prose — invisible at the point of confusion (the command a human just typed).

The naming syntax for the group prefix required verifying how Claude Code renders a command placed under a `commands/` subdirectory — no shipped official plugin uses command subdirectories, so there was no precedent (`docs/features/command-grouping-and-inputs/proposal.md` and `design.md` §2).

## Decision

**The mechanical grouping criterion.** A command is an **orchestrator** iff its body drives the flow engine — i.e. it dispatches `node governance/cli.js start <flow>` against a flow `.yaml`. Everything else is a **single-shot utility**. Applied to the current 7 commands: `build` and `design` are orchestrators (both dispatch the engine); `catalog`, `docs`, `governance`, `plan`, `review` are utilities (each reads a file or invokes a skill directly — including `docs`, which invokes the `aidakit:docs` skill directly rather than driving `governance/flows/docs-onboarding.yaml` through the engine). The rule is mechanical and future-proof: if `docs` is ever rewired to drive that flow via `cli.js`, it migrates to the `flow` group by the same rule, no special-casing.

**The `flow` group prefix.** The two orchestrators move into a named group so autocomplete visually separates them from the utilities. Utilities stay flat — the **absence** of a group prefix is itself the "utility" signal.

**The locked naming syntax (spike outcome).** The design considered a primary 3-segment plugin namespace (`commands/flow/build.md` → `/aidakit:flow:build`) gated on a spike verifying that Claude Code renders a command subdirectory as an extra `:`-segment. The spike resolved via the official Claude Code Agent SDK documentation ([code.claude.com/docs/en/agent-sdk/slash-commands.md](https://code.claude.com/docs/en/agent-sdk/slash-commands.md), "Organization with Namespacing"): *"The subdirectory appears in the command description but doesn't affect the command name itself."* A subdirectory is flattened into the description for plugin, project, and personal commands alike — `commands/flow/build.md` would render as `/aidakit:build`, identical to the pre-change name and useless for grouping. The primary syntax is therefore **not achievable** and is rejected. The **locked, shipped syntax is the flat two-token prefix**: `commands/build.md` → `commands/flow-build.md` → `/aidakit:flow-build`; `commands/design.md` → `commands/flow-design.md` → `/aidakit:flow-design`. Both files sort adjacently under the literal `flow-` prefix in the `/aidakit:` autocomplete list, visibly apart from the five flat utility names.

**Utilities stay flat, no group prefix in this change.** Rationale: (a) the absence of a prefix is itself the "utility" signal once the `flow` group exists; (b) prefixing all five utilities would rename five more files and their cross-references for no acceptance gain; (c) it keeps the direct break to two commands. Each command's `description:` frontmatter carries the classification word (flow orchestrator vs single-shot utility) so the distinction survives even where the prefix is not visible, and each command's body gains a `## Usage` block naming its expected inputs and at least one copy-paste example, printed on empty/malformed `$ARGUMENTS`.

**Direct break, no bridge aliases.** `commands/build.md` and `commands/design.md` are renamed outright via `git mv` — no alias left behind pointing at the new name. An alias was considered and rejected (see Alternatives).

**Extensibility contract.** Any command that drives the engine on a flow belongs in a mechanism-named group — a consumer authoring `.aidakit/flows/<my>.yaml` and a command that drives it follows the same rule in their own plugin namespace (`<plugin>:flow-<name>`). Future groups generalize as `<plugin>:<group>-<command>` where `<group>` names a mechanism family (e.g. a future `hook` group). The rule for entering a group is always mechanical — "does the command drive that mechanism?" — never editorial. No command is invented for a future group by this decision.

## Consequences

- Positive: `/aidakit:` autocomplete now unambiguously separates the two resumable, stateful flow orchestrators from the five single-shot utilities, without opening any file; the grouping criterion is mechanical and reproducible (re-derivable by reading each command body), not a hand-picked list; the `flow-` prefix generalizes to consumer-authored flows and commands without a redesign; every command now proactively shows its expected inputs and a realistic copy-paste example on empty/malformed `$ARGUMENTS`, and the command/skill/agent distinction is visible at the command itself, not only in `PROCESS.md` §1 prose.
- Negative:
  - The direct break stops **psim-kernel**'s existing `/aidakit:build` and `/aidakit:design` invocations from resolving until it updates to the new names on its next plugin sync — **Accepted** (the alternative, permanent aliases, would double the very autocomplete clutter this decision removes; the break is recorded in the release/version note).
  - The `flow-` prefix is now a **public contract**: a future relocation or rename of the prefix would be a breaking change for any consumer command built against it — **Accepted** (documented here, not hidden; a future change would need a migration note or a superseding ADR).
  - The primary 3-segment syntax (`/aidakit:flow:build`) is unavailable under Claude Code's current command-loading behavior — **Mitigated** (the spike de-risked this before any rename landed; the locked flat-prefix fallback fully satisfies the acceptance criterion, so no capability is actually lost).

### Review trigger

If a future Claude Code release changes subdirectory rendering behavior (i.e., a subdirectory under `commands/` starts contributing a `:`-segment to the command name), this ADR's Decision section is stale on that specific point and should be amended or superseded to record the newly-available 3-segment syntax as an option — the mechanical grouping criterion and the `flow` group name itself would not need to change.

## Alternatives considered

| Option | Pros | Cons | Cost to undo |
|---|---|---|---|
| Bridge aliases (keep `commands/build.md`/`design.md` as aliases pointing at the new names) | No break for psim-kernel or any other consumer today | Doubles autocomplete clutter — the exact problem this decision removes; two names for one command forever (or until a second, later break) | medium |
| Prefix all five utilities too (`flow-` for orchestrators, some other prefix for utilities) | Fully uniform naming scheme | Renames five more files and every cross-reference to them, for no acceptance gain — the absence of a prefix already signals "utility" once the `flow` group exists | high |
| Hand-pick which commands are "important" enough to group, instead of a mechanical rule | Faster to decide once | Non-reproducible — the next command added needs the same subjective call again; the mechanical rule (drives the engine?) is exactly the value this decision locks in | low |
| Record this as a `docs/specs/` spec instead of an ADR | n/a | No spec corpus exists in this repo; a decision with rejected alternatives is an ADR by [ADR-003](ADR-003-shared-knowledge-in-docs.md)'s placement boundary, not a spec | low |
