# Proposal — step-summaries-type-gate-tests

**Change ID:** `step-summaries-type-gate-tests`
**Date:** `2026-07-24`
**Owner:** `@chacal88`
**Phase / Package:** `tests only (governance/__tests__/) — EPIC-kit-discipline-hardening, feature 3`
**PRD:** `n/a`
**Tech Spec:** `n/a`

## Why

The per-step summary emitter has a **two-part gate** in [`governance/engine/engine.js:221-226`](../../../governance/engine/engine.js): a *kind* gate (`outcome.kind === "next" || outcome.kind === "fail"`) and a *type* gate (`step.type === "invoke" || "human_gate" || "human_handoff"`). The type gate is the mechanical statement of the contract published in [`governance/README.md` §Per-step summaries](../../../governance/README.md) — "`runs`/`loop`/`parallel`/`terminal` never emit".

That exclusion is barely under test. [`governance/__tests__/step-summaries.test.mjs`](../../../governance/__tests__/step-summaries.test.mjs) has exactly two negative cases: `§S3-v` (runs, line 296) and `§S3-vi` (loop, line 315). The `flow-step-summaries` tester round-1 proved by mutation that adding `parallel` to the type gate left the suite at **95/0** — the exclusion was not locked. The learning was registered as feature 3 of [EPIC-kit-discipline-hardening](../../roadmap/epics/EPIC-kit-discipline-hardening.md) after `deriveCandidates(threshold: 3)` returned empty (no DNA crystallization, [ADR-001](../../decisions/ADR-001-executable-dna-crystallization.md)).

Mutation runs re-executed during planning (throwaway copy of `governance/` in a scratch dir, never the worktree) sharpen the picture and correct two assumptions carried in from the `select` step:

| Mutation applied to the emission gate | Result on today's suite | Reading |
|---|---|---|
| type gate `+ "parallel"` | `95 passed, 0 failed` | **Real gap** — nothing locks the parallel exclusion. |
| type gate `+ "loop"` | `94 passed, 1 failed` (`FAIL S3-vi: no summary entry for the loop step id`) | **Already locked** — the empty-array loop still dispatches once and returns `kind:"next"`, so the mutation does reach `emitSummary`. The "weak lock" hypothesis is false; the case is weak in *coverage* (never exercises `__iterate__`), not in mutation sensitivity. |
| type gate `+ "terminal"` | `95 passed, 0 failed` | **Not discriminating** — `executeTerminal` returns `kind:"terminal"`, so the *kind* gate blocks emission before the type gate is consulted. A type-gate-only mutation for `terminal` is a no-op by construction. |
| type gate `+ "terminal"` **and** kind gate `+ "terminal"` | `89 passed, 6 failed` (S3-i, S3-ii, S3-iii, S3-v, S3-viii, S3-ix) | Caught only as **collateral** by cases that count entries — no named case asserts "a terminal step never emits". |

So: one genuine hole (`parallel`), one shallow case (`loop`), and one exclusion that is asserted nowhere by name (`terminal`) and whose only meaningful mutation is the two-part one.

## What Changes

- **`governance/__tests__/step-summaries.test.mjs` only.** The `§S3-vi` slot becomes a family of four named cases, one per excluded type, each built on a flow that genuinely executes the excluded step and that carries a positive control (a neighbouring `invoke` that *does* emit), so the absence of an entry is a real signal instead of an artifact of a flow that never ran:
  - `§S3-vi-loop-empty` — the current `§S3-vi`, renamed verbatim (degenerate empty-array loop; keeps the existing lock).
  - `§S3-vi-loop` — **new**: a loop over two items whose body is a pausing `invoke`; asserts the two body entries emit (`visit_n` 1 and 2) and zero entries carry the loop's own `step_id`, exercising the `__iterate__` dispatches the empty-array case never reaches.
  - `§S3-vi-parallel` — **new**: a `parallel` step with two branches, each a pausing `invoke`; asserts both branch entries emit and zero entries carry the parallel step's `step_id`.
  - `§S3-vi-terminal` — **new**: an `invoke` routing into a `terminal` that declares a `summary:`; asserts the flow completes (the terminal genuinely executed) and no entry carries the terminal's `step_id`.
- **Test file header comment** updated so the §S3-v + §S3-vi-\* family is legible as "one named case per excluded type", and so the `terminal` double-gate note is recorded where the next reader will be standing.
- **No production change.** `governance/engine/` is off limits; the gate the tests pin is the gate that ships today.

## Non-goals

1. **No change to the emission gate, the emitter, the template renderer, the progress table or the CLI.** If a test appears to demand a production change, that is an escalation, not a fix.
2. **No renumbering of `§S3-v` or of `§S3-vii`…`§S3-xiii`.** The new cases live inside the `§S3-vi` family, so no later label moves and the archived [`flow-step-summaries`](../../archive/2026-07-24-flow-step-summaries/design.md) references stay valid.
3. **No mutation harness, no mutation-testing tool, no CI step.** The mutation check is a manual, throwaway, local verification recorded in [evidence.md](evidence.md); building a harness is a separate change with its own decision.
4. **No coverage for the `infra` outcome kind** ([ADR-011](../../decisions/ADR-011-runs-infra-error-routing.md)) — an infra error hard-stops before routing, and `§S3-v` plus the existing `engine.test.mjs` infra suite already own that path.
5. **No `docs/specs/` delta** — this repo has no `docs/specs/` directory; the step-summary contract is stated in `governance/README.md` and in the archived change's design, neither of which changes here.

## Acceptance criteria

- `parallel-exclusion-locked` — `governance/__tests__/step-summaries.test.mjs` contains a named case `§S3-vi-parallel` that drives a `parallel` step to completion through both branches, and the mutation that adds `parallel` to the engine's type gate turns the suite RED on that case's assertions (before/after logs captured in evidence.md).
- `loop-exclusion-strengthened` — the suite contains both `§S3-vi-loop-empty` (the renamed existing case) and a new `§S3-vi-loop` that iterates over two items with a pausing body, asserts the two body-step entries and zero entries for the loop step id, and the mutation adding `loop` to the type gate turns BOTH cases RED (log captured in evidence.md).
- `terminal-exclusion-locked` — the suite contains a named case `§S3-vi-terminal` asserting a completed flow whose terminal step declares a `summary:` produces no entry for that step id, and evidence.md records both mutation runs for terminal: the type-gate-only mutation staying green (documented as a no-op caused by the kind gate) and the two-part type+kind mutation turning the new case RED.

> The green-suite gate (`step-summaries.test.mjs` at 0 failed, the directory sweep) and the command gate proving `governance/engine/` untouched are **not** listed here: they are validator/green-suite gates, which [ADR-010](../../decisions/ADR-010-acceptance-leash.md) §Decision 3 keeps in `## Exit criteria` — "observable-effect promises live in `## Acceptance criteria`; validator commands live in `## Exit criteria`; the two do not merge". Both are stated below under §Exit criteria and are enforced there.

## Affected capabilities

Test surface of the flow engine only (`governance/__tests__/step-summaries.test.mjs`). No capability spec delta: this repo has no `docs/specs/` directory, and the behavioral contract being pinned is unchanged (documented in [`governance/README.md`](../../../governance/README.md) §Per-step summaries and in [`docs/archive/2026-07-24-flow-step-summaries/design.md`](../../archive/2026-07-24-flow-step-summaries/design.md) §Emission points).

## Impact per surface

| Surface | Impact |
|---|---|
| `governance/engine/` | **none — off limits.** Read-only reference for the gate anchors. |
| `governance/__tests__/` | `step-summaries.test.mjs`: header comment + `§S3-vi` family (1 rename, 3 new cases) |
| `governance/flows/`, `governance/cli.js`, `governance/validators/` | none |
| `docs/` | this change package, **plus one Feature block appended to `docs/roadmap/epics/EPIC-kit-discipline-hardening.md`** registering the debit `context-pack-heading-alignment` (see §Recorded decisions). `docs/roadmap/ROADMAP.md` is NOT touched — `derive-roadmap-status.js` reports the derived status (`in-progress`, from this directory) but never writes the file; the sync is a separate chore of the `aidakit:roadmap` skill |
| `.claude-plugin/` | none — no doctrine footer moves, so no manifest bump ([PROCESS.md](../../../PROCESS.md) §5) |

## Dependencies

None. Builds on the shipped [`flow-step-summaries`](../../archive/2026-07-24-flow-step-summaries/proposal.md) (PR #34, merged) and needs nothing from the other three features of [EPIC-kit-discipline-hardening](../../roadmap/epics/EPIC-kit-discipline-hardening.md) — the epic's non-goals explicitly forbid bundling them.

## Exit criteria

- `node governance/__tests__/step-summaries.test.mjs` → `0 failed`, passing count > 95 (exit criterion `suite-no-regression`).
- `for f in governance/__tests__/*.test.mjs; do node "$f"; done` → every suite exit 0, **except `context-pack.test.mjs`**, which carries 12 failures that pre-date this change and are unrelated to it (a dogfood regression comparing another change's `.context-pack.md` against live repo filenames). The exclusion is not an excuse: evidence.md reproduces the identical `129 passed, 12 failed` on a stashed tree, which is what proves the failures are pre-existing rather than introduced here.
- Mutation matrix executed and captured in [evidence.md](evidence.md): `+parallel` RED, `+loop` RED, `+terminal` (type only) green with the documented explanation, `+terminal` (type+kind) RED — each followed by a revert and a re-run proving green.
- `node governance/validators/check-links.js docs/features/step-summaries-type-gate-tests` → exit 0.
- `node governance/validators/derive-roadmap-status.js --root .` → exit 0, deriving this change as `in-progress`. The validator is report-only (stdout); it does not write `docs/roadmap/ROADMAP.md`, which stays untouched by this change and is synced separately by the `aidakit:roadmap` skill.
- `node governance/validators/check-plugin-version.js .` → exit 0 (no footer moved; no bump expected).
- `git status --short` **and** `git diff --stat` show no path under `governance/engine/` (exit criterion `production-untouched`). Both are required: `git diff --stat` reports only tracked paths, so an untracked leak from the mutation protocol — a scratch copy, a `.orig` — is visible only in `git status --short`.

## Unblocks

The exclusion half of the step-summary contract stops depending on a reviewer noticing it. Any future edit that widens the type gate — a consumer adding a step type, or a refactor that collapses the two gates into one — trips a named test instead of shipping silently. It also leaves the mutation-check protocol written down in a change package, which is what feature 2 of the same epic (`plan-gate-executor-internals-check`) will build on.

## Recorded decisions and inherited open decisions

- [ADR-010](../../decisions/ADR-010-acceptance-leash.md) — mandates the `## Acceptance criteria` section above for a `fast`-flow change and makes `check-acceptance.js` map each criterion to an evidence artifact; the criteria here are phrased as named test cases plus captured mutation logs so the mapping is mechanical.
- [ADR-011](../../decisions/ADR-011-runs-infra-error-routing.md) — establishes `kind:"infra"` as a first-class outcome that hard-stops; together with `kind:"terminal"` it is why the emission gate has a *kind* half at all, and why the `terminal` exclusion cannot be flipped by a type-gate-only mutation. Cited in [design.md](design.md) §The gate is two gates.
- [ADR-006](../../decisions/ADR-006-flow-values-as-data.md) — the invoke `outputs` / `resume <flow_id> <outcome> [key=value]` protocol the existing fixtures drive through `resumeWith`; the new cases stay inside it (plain outcome resumes, no declared outputs).
- [ADR-002](../../decisions/ADR-002-roadmap-status-derived-from-disk.md) + [ADR-007](../../decisions/ADR-007-roadmap-status-from-shared-git.md) — the existence of this directory is what flips the roadmap line to `in-progress` **in this worktree**; nothing is hand-written in `ROADMAP.md`. The package is still untracked, so the shared-git half of ADR-007's union is empty and every other clone correctly derives `backlog` — the shared signal lands only when the package is committed ([ADR-007](../../decisions/ADR-007-roadmap-status-from-shared-git.md) §Decision ¶3). `fast` has no `commit_plan` step ([ADR-009](../../decisions/ADR-009-flow-commits-plan-early.md) wires it into `full` only), so that window is expected here, not a defect.
- [ADR-001](../../decisions/ADR-001-executable-dna-crystallization.md) — the epic records that this learning did NOT reach the ≥3× crystallization threshold, so it lands as a normal change and not as executable DNA.
- [ADR-002](../../decisions/ADR-002-roadmap-status-derived-from-disk.md) — **why this change also edits an epic.** Review round 1 found a pre-existing kit defect (`governance/context-pack/build.js` reads `## Problem` / `## Success criteria` while [ADR-010](../../decisions/ADR-010-acceptance-leash.md) mandates `## Why` / `## Acceptance criteria`, so every change ships a context pack with an empty summary and DoD). Fixing `build.js` from a tests-only change would be scope creep; but under ADR-002 a deferred defect is real only once declared on disk, so it is registered as the debit `context-pack-heading-alignment` in [EPIC-kit-discipline-hardening](../../roadmap/epics/EPIC-kit-discipline-hardening.md) rather than promised in prose. Full rationale in [evidence.md](evidence.md) §Unresolved Deviations.
- **An open decision IS touched, and the coupling is deliberate: [`engine-parallel-fate`](../../roadmap/epics/EPIC-flow-engine-leashes.md).** This repo keeps no `OPEN_DECISIONS.md`; the roadmap epics are the parking lot, and `EPIC-flow-engine-leashes` carries an owner-pending decision on `type: parallel` — track (a) delete `governance/engine/steps/parallel.js` from parser + validator + types (no shipped flow uses it; `governance/README.md` itself calls it dead code), or track (b) rewrite it for real concurrency. `§S3-vi-parallel` adds a new dependent on that undecided surface: if track (a) wins, this case and its `s3-paralleltype` fixture are deleted along with the step type. This change neither resolves nor pre-empts the decision — it pins the gate that ships **today**, which is what a regression test is for — but the dependency must be visible to the owner before merge rather than discovered during the deletion. Feature 3 of [EPIC-kit-discipline-hardening](../../roadmap/epics/EPIC-kit-discipline-hardening.md) is this change.

<!-- aidakit v0.6 — proposal for step-summaries-type-gate-tests, 2026-07-24 -->
