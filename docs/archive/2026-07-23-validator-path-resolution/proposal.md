# Proposal — validator-path-resolution

**Change ID:** `validator-path-resolution`
**Date:** `2026-07-23`
**Owner:** `@chacal88`
**Phase / Package:** `n/a (fast flow — small reversible bugfix)`
**PRD:** `n/a`
**Tech Spec:** `n/a`

## Why

Every shipped flow calls its validators by **relative path** (`node governance/validators/...`). A `runs` step executes with `cwd = projectRoot()` — the **consumer** repo root (`AIDAKIT_PROJECT_ROOT` or `process.cwd()`, [`governance/engine/persistence.js:18-22`](../../../governance/engine/persistence.js)). But `governance/` ships **inside the plugin**, so no consumer repo has that folder. Every validator-gated `runs` step fails with `Cannot find module '<repo>/governance/validators/…'` in any project that is not the kit repo itself.

Reproduction (owner's report, [`request.md`](../../../.aidakit/tasks/validator-path-resolution/request.md)): in any consumer repo, `start fast … mode=register` aborts at the first gate (`check_registered`); in build mode the flow reaches `check_review_bench` / `check_docs` and, because their `on_failure` routes back to the prior step, spins in a correction loop instead of surfacing the real error.

The defect went undetected because the test **fabricates the missing folder**: [`governance/__tests__/engine.test.mjs:19-20`](../../../governance/__tests__/engine.test.mjs) `symlinkSync`s the real `governance/` into the isolated tmp project root, so the validators resolve from `cwd = tmp` — a folder **no real repo has**. The suite is green while production is broken.

## What Changes

- **`governance/engine/steps/runs.js`** — compute the kit's `governance/` directory from `import.meta.url` (`governance/engine/steps/runs.js` → up two levels lands **on** `governance/`) and inject it as `AIDAKIT_GOVERNANCE` into every `runs` child's env: `const env = { ...process.env, AIDAKIT_GOVERNANCE }`. The value points **at the `governance/` directory itself**, so `$AIDAKIT_GOVERNANCE/validators/x.js` resolves to `governance/validators/x.js`.
- **`governance/flows/fast.yaml`, `governance/flows/full.yaml`, `governance/flows/docs-onboarding.yaml`** — replace every relative `node governance/validators/…` invocation with `node "$AIDAKIT_GOVERNANCE/validators/…"` (double-quoted: the plugin cache path may contain spaces). 10 invocations total (inventory in [design.md](design.md)). The `.aidakit/…` argument paths stay relative — those are consumer-project paths, correctly resolved from `cwd`.
- **`governance/__tests__/engine.test.mjs`** — remove the symlink fabrication (the `symlinkSync` import, the `govReal` line, and the justifying comment). Without the symlink the validator-gated tests reproduce the consumer-repo reality; the `runs.js` + YAML fix makes them pass via the absolute `$AIDAKIT_GOVERNANCE` path. RED→GREEN sequencing is pinned in [tasks.md](tasks.md).
- **`docs/guides/flows.md`** — document `AIDAKIT_GOVERNANCE`: consumer flows in `.aidakit/flows/*.yaml` must call kit validators as `$AIDAKIT_GOVERNANCE/validators/…`; relative `governance/…` only resolves inside the kit repo. Also clarify the `${...}` (engine interpolation) vs `$FOO` (shell expansion) distinction, since `$AIDAKIT_GOVERNANCE` relies on it.

## Non-goals (explicit)

1. **The `runs` error-routing contract is NOT changed.** Today a missing module exits `≠0` and is indistinguishable from a validator that legitimately judged NO, so `on_failure` sends the flow into a retry loop rather than surfacing the infra error (`request.md` §"Observação sobre prioridade"). Making `runs` distinguish "validator judged NO" from "command/module missing" is a distinct behavioral change to the error-routing contract — **recommended as a separate roadmap debit**, not implemented here.
2. **Agent/skill-invoked validator commands are NOT changed.** `agents/orchestrator.md:50`, `agents/doc-planner.md:155`, and `skills/roadmap/SKILL.md:64` teach an **agent** to run `node governance/validators/…` **directly** (not via a `runs` step). Those Bash sessions never receive the injected `AIDAKIT_GOVERNANCE` (only `runs.js` children do), so they carry the **same latent defect via a different vector** and need a different fix. Inventoried in [design.md](design.md) and **flagged as a follow-up debit**; touching them here (e.g. swapping to `$AIDAKIT_GOVERNANCE`) would be wrong — the variable is undefined in those shells.
3. **Consumer repos' own flows are out of write scope.** e.g. psim-kernel `.aidakit/flows/new-device-driver.yaml` copied the relative pattern; the in-repo obligation is the `docs/guides/flows.md` documentation that teaches flow authors the correct idiom, not editing another repo.
4. **No engine version bump policy decision** (left to the ship step / repo convention).

## Affected capabilities

- Flow engine (`governance/engine/`) and the shipped flows (`governance/flows/`). No canonical capability spec exists for the engine or flows in this repo (there is no `docs/specs/`), so **no spec delta** — the behavioral contract is pinned by the regression change in [`governance/__tests__/engine.test.mjs`](../../../governance/__tests__/engine.test.mjs) (same treatment as [loop-var-resume](../loop-var-resume/proposal.md) and archived [add-debit](../../archive/2026-07-22-add-debit/proposal.md)).

## Impact per surface

| Surface | Impact |
|---|---|
| `governance/` (engine + flows + tests) | 5 files: `engine/steps/runs.js` (env injection), 3 flow YAMLs (10 path swaps), `__tests__/engine.test.mjs` (symlink removal + comment) |
| `docs/` | `docs/guides/flows.md` (document `AIDAKIT_GOVERNANCE`) + this change directory |
| `agents/` | none (defect flagged as follow-up — see non-goal 2) |
| `commands/` | none |
| `skills/` | none (defect flagged as follow-up — see non-goal 2) |
| `hooks/` | none (verified: `hooks/` references no validator path) |

## Dependencies

None. Self-contained and reversible (single-commit revert restores prior behavior). No ADR gates it (see below).

## Exit criteria

- Symlink fabrication removed from `engine.test.mjs`; validator-gated tests go RED against the pre-fix code (proving the consumer-repo bug), then GREEN after the `runs.js` + YAML fix.
- `node governance/__tests__/engine.test.mjs` → 0 failed; full governance suite (`governance/__tests__/*.test.mjs`) → 0 failures.
- Consumer-repo simulation (a validator-gated `runs` step executed with `cwd` outside any `governance/` folder) resolves the validator via `$AIDAKIT_GOVERNANCE` — recorded in [evidence.md](evidence.md).
- All internal links resolve: `node governance/validators/check-links.js docs/features/validator-path-resolution docs/guides/flows.md` → exit 0.
- Evidence recorded in [evidence.md](evidence.md).

## Unblocks

Every flow (`fast`, `full`, `docs-onboarding`) becomes runnable in consumer/dogfooding repos (psim-kernel migration) — today they abort at the first validator gate outside the kit repo.

## Recorded decisions and inherited open decisions

- Read the [decisions index](../../decisions/README.md): [ADR-001](../../decisions/ADR-001-executable-dna-crystallization.md) (executable DNA), [ADR-002](../../decisions/ADR-002-roadmap-status-derived-from-disk.md) (roadmap status derived from disk), [ADR-003](../../decisions/ADR-003-shared-knowledge-in-docs.md) (shared knowledge in docs). None constrains flow-engine internals or path resolution at the time this change started.
- **Revised at review (round 1):** this change **introduces [ADR-004](../../decisions/ADR-004-aidakit-governance-env-contract.md)** to lock the `AIDAKIT_GOVERNANCE` contract — the variable name, points-AT-`governance/` semantics, `runs`-child-only injection, precedence, quoting requirement, and the consumer-facing "renaming/moving `governance/` is a breaking change" consequence. Per [ADR-003](../../decisions/ADR-003-shared-knowledge-in-docs.md)'s placement boundary ("a decision with alternatives → ADR"), a mechanism with rejected alternatives and consumer-facing consequences is a decision, not only an implementation detail — the original claim that "no new decision is locked by it" undersold what the change actually pins down.
- No open-decisions log exists in this repo; nothing inherited.
