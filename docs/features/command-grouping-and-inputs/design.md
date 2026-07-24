# Design — command-grouping-and-inputs

**Change ID:** `command-grouping-and-inputs`
**Date:** `2026-07-24`
**Owner:** `@chacal88`
**Phase / Package:** `n/a (command-surface refactor; classification: domain=product, type=feature, flags=[architecture, contract])`
**PRD:** `n/a`
**Tech Spec:** `n/a`

> Scope is the `/aidakit:*` **command surface** (`commands/*.md`) and the prose that references it. The engine (`governance/`) and the skills are untouched. This file records the decisions the change locks; [ADR-005](#5-adr-005--the-recorded-decision-authored-post-spike) is the durable form of §1–§4, authored after the Task 1 spike.

## 1. The mechanical grouping criterion (not hand-picked)

A command is an **orchestrator** iff its body **drives the flow engine** — i.e. it dispatches `node governance/cli.js start <flow>` against a flow `.yaml` (plugin defaults in `governance/flows/` or a consumer flow in `.aidakit/flows/`). Everything else is a **single-shot utility**.

Applying the rule to the current 7 commands (verified by reading each `commands/*.md`):

| Command | Body dispatches the engine? | Group |
|---|---|---|
| `build` | yes — `node governance/cli.js start fast\|full …` | **orchestrator** (`flow`) |
| `design` | yes — `node governance/cli.js start design …` | **orchestrator** (`flow`) |
| `catalog` | no — reads `skills/catalog/INDEX.md` | utility |
| `docs` | no — invokes the `aidakit:docs` skill directly | utility |
| `governance` | no — invokes the `aidakit:governance` skill directly | utility |
| `plan` | no — invokes the `aidakit:plan` skill directly | utility |
| `review` | no — invokes the `aidakit:review` skill directly | utility |

This matches the owner's confirmed list exactly (orchestrators: `build`, `design`; utilities: the other five).

**Subtlety the criterion resolves — `docs`.** A flow yaml `governance/flows/docs-onboarding.yaml` exists, but `commands/docs.md` invokes the `aidakit:docs` skill **directly** (init/audit/index/archive modes); it does not drive that flow through the engine. So `docs` is a **utility** by the mechanical rule. The criterion is "**the command drives the engine**", not "a related flow yaml exists somewhere". If `docs` is ever rewired to drive `docs-onboarding` via `cli.js`, it migrates to the `flow` group by the same rule — no special-casing. That is the criterion's whole point: mechanical and future-proof.

## 2. The naming scheme — spike-gated primary, locked fallback

The orchestrator group prefix is **`flow`** (owner-sanctioned; both `build` and `design` drive the engine on a flow). The utilities stay flat.

- **Primary (pending Task 1 spike): 3-segment plugin namespace via a subdirectory.**
  - `commands/build.md` → `commands/flow/build.md` → `/aidakit:flow:build`
  - `commands/design.md` → `commands/flow/design.md` → `/aidakit:flow:design`
- **Fallback (LOCKED, spec-safe): flat two-token prefix, no subdirectory.**
  - `commands/build.md` → `commands/flow-build.md` → `/aidakit:flow-build`
  - `commands/design.md` → `commands/flow-design.md` → `/aidakit:flow-design`

Both branches satisfy the acceptance criterion: in a `/aidakit:` autocomplete list, `flow:build`/`flow:design` (or `flow-build`/`flow-design`) sort adjacently under a shared, self-describing prefix, visibly apart from the five flat utilities. **The spec and the ADR record whichever the spike locks — never an unverified syntax.** The design deliberately does not depend on the 3-segment form working.

Utilities are **not** given a group prefix in this change. Rationale: (a) the absence of a prefix is itself the "utility" signal once the `flow` group exists; (b) prefixing all five would rename five more files and their cross-references for no acceptance gain; (c) it keeps the direct break to two commands. The `description:` frontmatter carries the classification word so the distinction survives even where the prefix is not visible.

## 3. The input-example pattern (every command .md)

A command file is a **prompt** Claude executes; "detecting malformed `$ARGUMENTS`" is an instruction, not code. Each of the 7 command files gains, at the top of its body (before the action), a guard plus a `## Usage` block:

```md
First, inspect `$ARGUMENTS`. If it is empty or does not match one of the
forms below, do NOT guess or proceed — print the Usage block verbatim and stop.

## Usage
**This is a** <flow orchestrator | single-shot utility> **command.** It <drives the
`<flow>` flow via the engine | invokes the `aidakit:<skill>` skill | reads `<file>`>.

**Expected inputs:** <the verbs/modes/arguments this command accepts>

**Examples (copy-paste):**
- `/aidakit:<name> <realistic invocation 1>`
- `/aidakit:<name> <realistic invocation 2>`
```

Concrete per-command input contracts the implementer fills in (derived from each command's current body):

- **`flow:build`** — verbs `start <flow> [key=value …]` · `resume <flow_id> <outcome>` · `status <flow_id>` · `abort <flow_id>` · `list` · `register "<free-form request>"`. Example: `/aidakit:flow:build start fast request="add rate limiting to the webhook endpoint"`.
- **`flow:design`** — verbs `start design project="…"` · `resume <flow_id> <outcome>` · `status <flow_id>` · `abort <flow_id>` · `list`. Example: `/aidakit:flow:design start design project="loyalty program"`.
- **`catalog`** — a free-form "which tool for X?" question (optional; empty → print the grouped index summary). Example: `/aidakit:catalog do I have something for threat modeling?`.
- **`docs`** — `<mode> <target>` with mode ∈ {init, audit, index, archive}. Example: `/aidakit:docs audit .`.
- **`governance`** — `<mode> <context>` with mode ∈ {explain, audit, onboarding}. Example: `/aidakit:governance explain why did the hook block my push?`.
- **`plan`** — a change-id or a description. Example: `/aidakit:plan webhook-retry-safety`.
- **`review`** — a change-id or `--diff`. Example: `/aidakit:review --diff`.

The classification line in the Usage block is exactly what makes the **command/skill/agent distinction visible at the point of confusion** (acceptance criterion 3) — a human who mistypes a command sees, in the reply, that it is a command and what it dispatches, without reading [PROCESS.md](../../../PROCESS.md) §1.

## 4. Extensibility contract (consumer flows, future groups)

Recorded so the scheme generalizes without a redesign (owner requirement):

- **Any command that drives the engine on a flow belongs in a mechanism-named group.** A consumer who authors `.aidakit/flows/<my>.yaml` and a command that drives it follows the same rule in their own plugin namespace: `<plugin>:flow:<name>` (or the locked `<plugin>:flow-<name>`). The group name mirrors the mechanism (`flow`), not the individual flow.
- **Future groups generalize as `<plugin>:<group>:<command>`** where `<group>` names a mechanism family (e.g. a future `hook` group for hook routines). The rule for entering a group is always mechanical — "does the command drive that mechanism?" — never editorial. **No command is invented for a future group in this change.**

## The Task 1 spike — what it proves, both branches

**Question:** does Claude Code render a command placed at `commands/flow/build.md` (plugin cache path `…/aidakit/<version>/commands/flow/build.md`) as `/aidakit:flow:build`?

**Method (any one is sufficient; do not ship product code from the spike):**
- Create a **scratch copy** of the plugin with `commands/flow/probe.md` and inspect how Claude Code lists it (`/help`, or the `/aidakit:` autocomplete), reading the rendered name; **or**
- Inspect the plugin loader's behavior against the cache layout (`~/.claude/plugins/cache/aidakit/aidakit/<version>/commands/…`) to determine whether a subdirectory becomes a `:`-segment.

**Branches:**
- **Feasible** → primary syntax; renames go to `commands/flow/{build,design}.md`; ADR Decision records the 3-segment namespace, with the flat prefix noted as the fallback that was available.
- **Not feasible / ambiguous** → **locked fallback**; renames go to `commands/flow-{build,design}.md`; ADR Decision records the flat prefix as the shipped syntax.

The spike outcome is recorded in [evidence.md](evidence.md) before any rename lands.

## File layout (both branches)

```
commands/
  flow/build.md   OR  flow-build.md      # was commands/build.md
  flow/design.md  OR  flow-design.md     # was commands/design.md
  catalog.md      governance.md          # unchanged names, + Usage block
  docs.md         plan.md   review.md    # unchanged names, + Usage block
docs/decisions/
  ADR-005-command-namespacing.md         # new (Task 2)
  README.md                              # + ADR-005 row (Task 2)
.claude-plugin/plugin.json               # version bump (Task 6)
```

## Cross-reference surgery (surgical, not find-replace)

Only the two **command** tokens change: `/aidakit:build` → `/aidakit:flow:build` (or `flow-build`) and `/aidakit:design` → `/aidakit:flow:design` (or `flow-design`), plus the bare-`aidakit:build`/`aidakit:design` command mentions in tables.

**Footgun — do NOT blind-replace `aidakit:design`.** The string `aidakit:design` is a prefix of the four design-phase **skills** `aidakit:design-business`, `aidakit:design-modeling`, `aidakit:design-architecture`, `aidakit:design-implementation`, which are **not** renamed. A word-boundary match (`\b`) is **not** a safe filter: `aidakit:design\b` still matches inside `aidakit:design-business` (there is a `\b` at the `n`→`-` transition). The accurate rule is **"`aidakit:design` not immediately followed by `-`"** — i.e. `aidakit:design(?!-)` (PCRE), or, portably, an exclude pipe `… | grep -vE "aidakit:design-(business|modeling|architecture|implementation)"`. **Automated blanket find-replace is disallowed; every hit is confirmed per-site by hand.** Same care for `governance/flows/design.yaml` (a flow name, unchanged) and the `design` flow argument in `cli.js start design`.

**Two greps, and the bare-token one is authoritative.** The slash-only grep (`grep -rEn "/aidakit:(build|design)\b"`) finds only the `/`-prefixed invocations and **misses bare-token command mentions** in prose/tables (e.g. `aidakit:design` in a skills table). The authoritative enumeration is the **bare-token** grep with the design-phase-skill exclusion:

```
grep -rnE "\baidakit:(build|design)\b" --include="*.md" . \
  | grep -vE "\.claude/|docs/archive|docs/examples|docs/features/(loop-var-resume|command-grouping-and-inputs)" \
  | grep -vE "aidakit:design-(business|modeling|architecture|implementation)"
```

Real cross-reference sites (reconciled against the bare-token grep above — **representative, not a substitute for re-running it**; the Task 7 leash is the completeness gate):

- Root: [PROCESS.md](../../../PROCESS.md), [README.md](../../../README.md), [DOCS.md](../../../DOCS.md) (bare-token mention)
- `docs/`: `OVERVIEW.md`, `INDEX.md`
- `docs/guides/`: `README.md`, `getting-started.md`, `change-flow.md`, `existing-repo-flow.md`, `new-project-flow.md`, `flows.md`, `roadmap-and-knowledge.md`
- `docs/reference/`: `skills.md`, `agents.md`, `README.md`
- `skills/`: `catalog/INDEX.md`, `catalog/SKILL.md`, `plan/SKILL.md`, `review/SKILL.md`, `learn/SKILL.md`, `roadmap/SKILL.md`, **`docs/SKILL.md` (lines 14, 96)**, **`spec/SKILL.md` (lines 55, 362)**, `design-business/SKILL.md`, `design-architecture/SKILL.md`, `design-implementation/SKILL.md`
- `docs/roadmap/epics/EPIC-flow-engine-leashes.md`
- The two renamed command files' own self-references and the `design → build` handoff line in `commands/design.md`

Note: `skills/docs/SKILL.md` and `skills/spec/SKILL.md` carry the `/aidakit:design` command only as **bare tokens** (no slash), which is exactly why the slash-only grep missed them — they name the command as the producer of `docs/design/` phase deliverables, so they are real rename sites.

The `docs/examples/*` files illustrate a **hypothetical target project's** artifacts, not this repo's command surface — they are left as-is unless a reference is unambiguously to the kit command; the implementer confirms per hit (they carry no `/aidakit:` slash-form command invocation, only bare mentions).

## 5. ADR-005 — the recorded decision (authored post-spike)

`docs/decisions/ADR-005-command-namespacing.md`, format per [ADR-004](../../decisions/ADR-004-aidakit-governance-env-contract.md) (5 sections: Status+Date · Context · Decision · Consequences · Alternatives considered), registered in `docs/decisions/README.md`. Decision content ready to transcribe:

- **Context:** 7 flat commands; orchestrators indistinguishable from utilities; the command/skill/agent distinction buried in prose.
- **Decision:** the mechanical grouping criterion (§1); the `flow` group for engine-driving commands; the locked naming syntax from the spike (§2); utilities stay flat; direct break, no aliases; the extensibility contract (§4).
- **Consequences:** positive — unambiguous autocomplete, future-proof mechanical rule, one prefix generalizes to consumer flows; negative — *Accepted* the direct break stops psim-kernel's old invocations until its next sync; *Accepted* the group prefix is now a public contract a relocation would break; *Mitigated* the spike de-risks the unverified 3-segment syntax with a locked fallback.
- **Alternatives considered:** bridge aliases (rejected — doubles autocomplete clutter); prefix all utilities too (rejected — churn for no acceptance gain); hand-pick which commands are "important" (rejected — non-reproducible, the mechanical rule is the whole value); a `docs/specs/` spec instead of an ADR (rejected — no spec corpus exists; the decision-with-alternatives home is an ADR, DOCS.md §3).

The ADR is authored in Task 2 **after** the spike so its Decision names the real shipped syntax.

## Version bump constraint

`.claude-plugin/plugin.json` is at `0.5.1` at plan-revision time — **re-read it at implementation start; the constraint is relative to the live manifest, not a frozen number.** Two rules bind the bump (see [PROCESS.md](../../../PROCESS.md) §5 and `check-plugin-version.js`):

1. It must be **strictly above the live manifest**, or `claude plugin update` no-ops and the rename never reaches installed users (including psim-kernel).
2. It must be **≥ the highest doctrine footer** in the tree, or `check-plugin-version.js` exits 1.

**Recommendation: bump to `0.6.0`** (a breaking command rename warrants a loud minor bump) and give the two new/renamed command files a `v0.5` doctrine footer (an `aidakit v0.5 — command grouping …` line in the usual HTML-comment form). `0.6.0 > 0.5.1` (update fires) and `0.6.0 ≥ 0.5` (validator passes). The ship/release step picks the final number — it must be **strictly greater than the manifest on main at that moment**, or `claude plugin update` no-ops and the rename reaches no one.

> Note for the implementer: the `v0.5` footer belongs only in the two renamed **command** files (part of the versioned doctrine surface), never in these WORKING change artifacts — `check-plugin-version.js` scans every `.md` for an `aidakit vX.Y` comment and does not skip code spans.

## Constraining ADRs

- [ADR-002](../../decisions/ADR-002-roadmap-status-derived-from-disk.md) — constrains **Task 0** only: register epic **intent**; never hand-edit the generated `ROADMAP.md` (regenerate it via `aidakit:roadmap` / `derive-roadmap-status.js`).
- [ADR-001](../../decisions/ADR-001-executable-dna-crystallization.md), [ADR-003](../../decisions/ADR-003-shared-knowledge-in-docs.md), [ADR-004](../../decisions/ADR-004-aidakit-governance-env-contract.md) — do not constrain the command surface; ADR-004's engine is explicitly out of scope.

## Rollback

The change is a set of file renames + prose edits + one ADR + a version bump — all reversible by reverting the change's commits. A single-commit revert restores the flat command surface; because the migration is a direct break with no aliases, a revert also restores the old invocations cleanly (no half-migrated alias state to untangle). The spike leaves no product artifact to roll back (scratch copy only).

## Conventions and evidence location

- Command files keep the existing frontmatter shape (`--- description: … ---`) and the trailing `<!-- aidakit vX.Y — … -->` doctrine footer that every command in `commands/` already carries.
- Change artifacts (this directory) follow the [loop-var-resume](../../archive/2026-07-22-loop-var-resume/design.md) precedent: header block, terse structured prose, **no** doctrine footer (WORKING artifacts are not part of the versioned doctrine surface that `check-plugin-version.js` scans).
- Canonical validators (run from this repo root): `node governance/validators/check-links.js .`, `node governance/validators/check-adr-format.js <adr>`, `node governance/validators/check-plugin-version.js .`.
- Evidence is recorded at the fixed location `docs/features/command-grouping-and-inputs/evidence.md`.
