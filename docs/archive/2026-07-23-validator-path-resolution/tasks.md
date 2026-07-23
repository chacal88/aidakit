# Tasks — validator-path-resolution

**Change ID:** `validator-path-resolution`
**Date:** `2026-07-23`
**Owner:** `@chacal88`
**Phase / Package:** `n/a (fast flow — small reversible bugfix)`
**PRD:** `n/a`
**Tech Spec:** `n/a`

> The bullets in section 2 are **order-dependent** — they encode the RED→GREEN proof. Do 2.1 first (the RED), then 2.2 and 2.3 (the GREEN). Do not reorder.

## 1. Setup

- [x] Confirm a clean worktree and that `node governance/__tests__/engine.test.mjs` is GREEN before touching anything (baseline; the symlink is still masking the bug).
- [x] Re-confirm the 10 in-scope call sites against the live files (line numbers in [design.md](design.md) may drift): `grep -n 'governance/validators/' governance/flows/fast.yaml governance/flows/full.yaml governance/flows/docs-onboarding.yaml`.

## 2. Surface Work — governance (ordered: RED → GREEN)

### 2.1 RED — remove the fabrication first

- [x] In [`governance/__tests__/engine.test.mjs`](../../../governance/__tests__/engine.test.mjs): remove `symlinkSync` from the `node:fs` import (line 5), delete the `govReal` const + `symlinkSync(...)` call (lines 19-20), and replace the justifying comment (lines 13-18) with a one-line note that validators are reached via the absolute `$AIDAKIT_GOVERNANCE` injected by `runs.js`, so `cwd = tmp` (no `governance/` folder) mirrors a consumer repo. **Preserve section 7** and every seed helper — touch only the setup region. (Also removed the now-orphaned `resolve` from the `node:path` import, per readiness-gate finding.)
- [x] Run `node governance/__tests__/engine.test.mjs` and confirm the validator-gated cases now FAIL with `Cannot find module …/governance/validators/…` (the consumer-repo bug, reproduced). Record the RED output in [evidence.md](evidence.md). This failure is the proof; do not skip recording it.

### 2.2 GREEN part 1 — inject the kit root

- [x] In [`governance/engine/steps/runs.js`](../../../governance/engine/steps/runs.js): add `import { fileURLToPath } from "node:url"` and `import { dirname, resolve } from "node:path"`; compute at module scope `const AIDAKIT_GOVERNANCE = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..")` with a comment noting it lands ON `governance/`; change line 20 to `const env = { ...process.env, AIDAKIT_GOVERNANCE };`. No other logic change.

### 2.3 GREEN part 2 — swap the flow paths

- [x] `governance/flows/fast.yaml` — replace `node governance/validators/X` with `node "$AIDAKIT_GOVERNANCE/validators/X"` at lines 43 (`derive-roadmap-status.js`), 128 (`check-bench.js`, only the `node` clause of the compound), 155 (`check-bench.js`), 188 (`check-doc-manifest.js`). Escape inner quotes as `\"`; leave the `.aidakit/…` argument paths relative.
- [x] `governance/flows/full.yaml` — same swap at lines 133 (`check-bench.js`, compound), 160 (`check-bench.js`), 215 (`check-dna-freshness.js`), 258 (`check-doc-manifest.js`).
- [x] `governance/flows/docs-onboarding.yaml` — same swap at lines 66 and 128 (`check-doc-manifest.js`).
- [x] Do NOT touch `governance/flows/design.yaml` (no `runs`/validator calls — verified in [design.md](design.md)).

## 3. Documentation

- [x] [`docs/guides/flows.md`](../../guides/flows.md): add an `AIDAKIT_GOVERNANCE` note in §6 (consumer flow authors call kit validators as `node "$AIDAKIT_GOVERNANCE/validators/…"`; relative `governance/…` only works inside the kit repo; `runs.js` injects the variable pointing at the kit's `governance/` dir).
- [x] `docs/guides/flows.md` §3 ("The expression trap"): add the `${...}` (engine interpolation) vs `$FOO` (shell expansion, e.g. `$AIDAKIT_GOVERNANCE`) distinction.
- [x] `docs/guides/flows.md` §5 register-mode prose (~line 160): update the quoted `derive-roadmap-status.js` command to the `$AIDAKIT_GOVERNANCE` form so the guide matches the fixed `fast.yaml`.
- [x] Bump the doctrine footer of `docs/guides/flows.md` per the repo convention (add a `<!-- aidakit vX.Y — AIDAKIT_GOVERNANCE for consumer flows … -->` line).
- [x] `## Files Touched` filled in [evidence.md](evidence.md).

## 4. Validation

- [x] GREEN: `node governance/__tests__/engine.test.mjs` → `0 failed`; record in [evidence.md](evidence.md) (the same cases that were RED in 2.1).
- [x] Full governance suite: `for f in governance/__tests__/*.test.mjs; do echo "== $f"; node "$f" 2>&1 | tail -1; done` → every file `0 failed`; record in [evidence.md](evidence.md).
- [x] Consumer-repo simulation (proves the real bug, not just the unit test): run a validator-gated `runs` step with `cwd` outside any `governance/` folder and confirm it resolves —
  ```
  tmp=$(mktemp -d); mkdir -p "$tmp/docs/roadmap/epics"
  printf -- '- **Feature:** X — changes: validator-path-resolution\n' > "$tmp/docs/roadmap/epics/EPIC-x.md"
  AIDAKIT_PROJECT_ROOT="$tmp" node governance/cli.js start fast request=validator-path-resolution mode=register
  ```
  Expect: PARKED at `parked` (the `check_registered` leash resolved the validator via `$AIDAKIT_GOVERNANCE`), NOT an abort with `Cannot find module`. Record stdout in [evidence.md](evidence.md); clean up `$tmp`.
- [x] Links resolve (DOCS.md §2.4): `node governance/validators/check-links.js docs/features/validator-path-resolution docs/guides/flows.md` → exit 0.
- [x] `git diff --stat` matches the scope declared in [proposal.md](proposal.md) (5 code/doc files: `governance/engine/steps/runs.js`, the 3 flow YAMLs, `governance/__tests__/engine.test.mjs`, `docs/guides/flows.md` + this change directory).

## 5. Cleanup

- [x] No stray files outside the declared scope; `$tmp` from the simulation removed.
- [x] `## Unresolved Deviations` in [evidence.md](evidence.md) filled (or explicitly "None").
- [x] Confirm the two flagged follow-up debits are recorded for the readiness gate / roadmap: (a) `runs` error-routing "module-missing vs judged-NO", (b) agent/skill direct validator invocation (`agents/orchestrator.md`, `agents/doc-planner.md`, `skills/roadmap/SKILL.md`). Do NOT implement either here.

## 6. Review Round 1 Fixes (review bench FAIL: adr NEEDS-REVISION, quality rejected, tests Coverage FAIL)

- [x] **Roadmap debits.** Added two `- **Feature:**` bullets (+ `- Aceite:` sub-bullets, kebab-case change-ids) to [`docs/roadmap/epics/EPIC-flow-engine-leashes.md`](../../roadmap/epics/EPIC-flow-engine-leashes.md): `runs-error-routing` (module-missing vs judged-NO) and `agent-validator-paths` (agent/skill direct validator invocation). Regenerated the derived view with `node governance/validators/derive-roadmap-status.js --root .` and updated [`docs/roadmap/ROADMAP.md`](../../roadmap/ROADMAP.md)'s Later section by hand to match (both new changes show `backlog`).
- [x] **ADR-004.** Wrote [`docs/decisions/ADR-004-aidakit-governance-env-contract.md`](../../decisions/ADR-004-aidakit-governance-env-contract.md) in the exact ADR-001/002/003 format (5 sections, WORM header, Alternatives table lifted from `design.md`), registered it in [`docs/decisions/README.md`](../../decisions/README.md) (index row + thematic grouping). Corrected the now-false "no ADR applies / no new decision is locked" claims in [proposal.md](proposal.md) §"Recorded decisions" and [design.md](design.md) §"Constraining ADRs" to state ADR-004 is introduced BY this change.
- [x] **`governance/README.md`.** Added a line in the `## State` section documenting that `runs` children also receive `AIDAKIT_GOVERNANCE` (pointing at the kit's own `governance/` dir), cross-referencing `docs/guides/flows.md` §3/§6 and ADR-004.
- [x] **Test gap — docs-onboarding dark.** In [`governance/__tests__/engine.test.mjs`](../../../governance/__tests__/engine.test.mjs): added `"docs-onboarding"` to the §1 parse/validate loop; added a new §8 subsection that seeds a satisfied PROJECT-level manifest (`.aidakit/doc-manifest-project.json`, fixed path — distinct from the per-change `manifestPathFor`), drives the flow through its full happy path (`inventory→manifest→diff→propose→gate_migration→apply→check→done`), and asserts the `diff`/`check` `runs` steps' actual output (`exit_code === 0`, stderr has no `Cannot find module`/`MODULE_NOT_FOUND`) — not just routing. **Mutation proof** (recorded in [evidence.md](evidence.md)): temporarily reintroduced the typo `$AIDAKIT_GOVERNANC` at `docs-onboarding.yaml:66`, confirmed the two new `diff`-step assertions went RED (84 passed, 2 failed) while routing/final-status assertions stayed green (proving those alone would NOT have caught the regression), reverted the typo, confirmed GREEN again (86 passed, 0 failed).
- [x] Re-ran the full validation battery after all four fixes: engine suite green (86 passed, 0 failed), all 12 `governance/__tests__/*.test.mjs` files green, `check-links` on the widened scope (change dir + `flows.md` + `docs/decisions/` + `docs/roadmap/`) exit 0, `git diff --stat` recorded in [evidence.md](evidence.md) consistent with the review-widened scope.
- [x] Noted the tester's non-blocking observations as known residual test-debt in [evidence.md](evidence.md) `## Unresolved Deviations` (recorded, not fixed, per the tester's own "do not block" classification): [6] `dna_freshness` unreachable by the suite, [4] `fast.yaml`'s `check_implement_bench` node-clause dark, [5] `cli.js` untested.
- [x] Did NOT bump `.claude-plugin/plugin.json` (release-commit convention), did NOT implement either roadmap debit, did NOT touch `agents/*.md`, `skills/*`, or `design.yaml` — all confirmed out of scope for this fix round.
