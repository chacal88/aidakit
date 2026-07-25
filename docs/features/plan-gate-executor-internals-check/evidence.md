# Evidence — plan-gate-executor-internals-check

**Change ID:** `plan-gate-executor-internals-check`
**Date:** `2026-07-25`
**Owner:** `@chacal88`
**Phase / Package:** `skills/readiness + governance/validators — the plan gate verifies internals claims against live code`

> **Pre-execution stub.** Every section below is filled during implementation with the **real** command and its **real** output — never a paraphrase, never a prediction. A criterion without a runnable proof line stays `pending`.

## Setup / grounding re-check (Task 1)

_(pending — record here, per item, whether each shape in [design.md](design.md) §Grounding still matches live code, and any correction made to the design before coding.)_

## Acceptance-criterion → evidence map

| # | Criterion id | Status | Evidence |
|---|---|---|---|
| 1 | `readiness-owns-the-gate` | pending | |
| 2 | `mechanical-validator-scoped-as-secondary` | pending | |
| 3 | `not-flow-wired-by-default` | pending | |
| 4 | `planner-naming-corrected` | pending | |
| 5 | `new-file-citations-excluded` | pending | |
| 6 | `precedent-incident-documented` | pending | |

### 1. `readiness-owns-the-gate`

_(pending — `skills/readiness/SKILL.md` §14 as shipped: heading, placement between §13 and `### Severity classification`, the three claim shapes, the `Critical` / `Mandatory before implementation` rule for generalizations, the guarded `$AIDAKIT_GOVERNANCE` invocation, the `Read`/`Grep` fallback. Proof: test §C20 output + `node governance/__tests__/agent-validator-paths.test.mjs` exit code.)_

### 2. `mechanical-validator-scoped-as-secondary`

_(pending — `governance/validators/check-design-claims.js` exists; test §C1-§C18 output; a sample envelope for a passing run and for each of the two failure rules; the exit-code triple 0/1/2 demonstrated; test §C19 output for the header comment.)_

### 3. `not-flow-wired-by-default`

_(pending — `git diff --stat governance/flows/full.yaml governance/flows/fast.yaml` → empty; `git status --porcelain docs/decisions/` → empty; test §C21 output; the `skills/readiness/SKILL.md` line that invokes it via `Bash`.)_

### 4. `planner-naming-corrected`

_(pending — the before/after of the epic's `Aceite:` sub-bullet; `grep -rn "skills/planner/SKILL.md"` → no hits; test §C22 output.)_

### 5. `new-file-citations-excluded`

_(pending — test §C10 output showing exit 0 with `waived_new_files: 1` for a cited-but-not-yet-created path declared under `## New files` and corroborated in `tasks.md`; plus §C11/§C12/§C13 showing the waiver correctly withheld.)_

### 6. `precedent-incident-documented`

_(pending — the shipped header comment of `check-design-claims.js` quoted verbatim, plus the [design.md](design.md) §"The incident, stated plainly" reference, with the three incident anchors re-confirmed at implementation time.)_

## Validation Outputs

_(pending — one line per command from [tasks.md](tasks.md) §8, each with its real exit code and output:)_

- `node governance/__tests__/check-design-claims.test.mjs` → _pending_
- `node governance/__tests__/agent-validator-paths.test.mjs` → _pending_
- `for t in governance/__tests__/*.test.mjs; do node "$t" || echo "FAIL $t"; done` → _pending_ (per-file counts here)
- `node governance/validators/check-design-claims.js docs/features/plan-gate-executor-internals-check` → _pending_ (dogfood)
- Negative dogfood (scratch rotten anchor → exit 1) → _pending_
- `node governance/validators/check-links.js .` → _pending_
- `node governance/validators/check-plugin-version.js` → _pending_
- `node governance/validators/check-adr-format.js docs/decisions` → _pending_
- `git diff --stat governance/flows/full.yaml governance/flows/fast.yaml` → _pending_
- `grep -rn "skills/planner/SKILL.md" …` → _pending_

## Files Touched

_(pending — created vs edited, matching [tasks.md](tasks.md) §9's expected diff surface. Any file outside that list is a deviation and goes in the section below.)_

**Created:**

- `governance/validators/check-design-claims.js` — _pending_
- `governance/__tests__/check-design-claims.test.mjs` — _pending_

**Edited:**

- `skills/readiness/SKILL.md` — _pending_
- `governance/__tests__/agent-validator-paths.test.mjs` — _pending_
- `docs/roadmap/epics/EPIC-kit-discipline-hardening.md` — _pending_
- `docs/OVERVIEW.md`, `PROCESS.md`, `docs/guides/existing-repo-flow.md`, `docs/guides/change-flow.md`, `docs/reference/skills.md`, `skills/catalog/INDEX.md` — _pending_

## Unresolved Deviations

_(pending — anything the implementation had to decide that the plan did not settle, anything in [design.md](design.md) §Grounding found stale at setup, and the disposition of the open point in [design.md](design.md) §"Open point — is `Bash` actually available where `aidakit:readiness` runs?" if the execution surface turns out to differ from the inversion-of-control reading of [invoke.js:1-7](../../../governance/engine/steps/invoke.js).)_
