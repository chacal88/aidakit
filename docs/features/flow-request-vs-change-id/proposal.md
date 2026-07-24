# Proposal — flow-request-vs-change-id

**Change ID:** `flow-request-vs-change-id`
**Date:** `2026-07-24`
**Owner:** `@chacal88`
**Phase / Package:** `engine + flows (governance/) — bugfix with contract change (ADR-005)`
**PRD:** `n/a`
**Tech Spec:** `n/a`

## Why

The documented usage of `/aidakit:build` is `start full request="<free-form text>"` — and the request is prose, often multiline. But `governance/flows/full.yaml` (`check_implement_bench`, `check_review_bench`, `dna_gate`, `dna_freshness`, `check_docs`) and `fast.yaml` (`check_implement_bench`, `check_review_bench`, `check_docs`) interpolated that same raw `${inputs.request}` into `runs` shell commands as if it were a change-id. Live capture `full-260724-ca264a` (`.aidakit/flows/state/`, context.check_implement_bench): the multiline request word-split and line-split inside `bash -lc` — exit 127, `test: too many arguments`, every request line executed as a command — and the step's `on_failure` back-edge looped the flow between `implement`/`review_bench` forever.

Root cause is missing plumbing, not just missing quoting: the `select` step (aidakit:orchestrator) resolves the real change-id, but the engine recorded only `{outcome, invoke_target}` in `context.select` — the resume protocol had no channel for data, so the yaml had no safe variable carrying the change-id and reached for `${inputs.request}` instead.

## What Changes

- **Engine — structured invoke outputs** (`governance/engine/resume-output.js` new; `invoke.js`, `engine.js`, `parser.js`, `types.js`, `cli.js`): an invoke step may declare `outputs: {<outcome>: [key, ...]}`; the resume grammar becomes `resume <flow_id> <outcome> [key=value ...]`; declared keys are REQUIRED (fail-closed re-pause when missing/unsafe) and persist into `context[step.id]` for `${context.<step>.<key>}`. Values constrained to safe single tokens (`^[A-Za-z0-9._:@/-]+$`); keys to identifiers, with `outcome`/`invoke_target`/prototype-mutating names reserved.
- **Engine — `runs` values as data** (`interpolate.js` `interpolateCommand`, `runs.js`): each resolvable `${expr}` in a command renders as `$AIDAKIT_VAR_n` and the value travels through the child env — expanded by bash as data after parsing, never re-parsed as shell syntax. Step output records `command` + `vars`.
- **Flows** (`full.yaml`, `fast.yaml`): `select` declares `outputs: {success: [change_id]}`; every `.aidakit/tasks/…`/`.aidakit/dna/…` path keys on `${context.select.change_id}`, double-quoted; `--outcome` arguments quoted; `change_id` added to the `input` of steps that operate on the change package (`plan` in fast; `learn`, `dna_pr`, `document` in full).
- **Docs**: [ADR-005](../../decisions/ADR-005-flow-values-as-data.md) (the `runs` interpolation contract changed — condition for an ADR met); `governance/README.md`, `docs/guides/flows.md` §3–§5, `commands/build.md` updated with the new grammar; footers bumped to v0.6.
- **Release**: plugin manifest `0.5.1` → `0.6.0` (PROCESS.md §5 — without the bump, `claude plugin update` no-ops).

## Non-goals

1. **No retry cap on the `implement`↔`check_*` back-edges** — the infinite loop was the *symptom*; the mechanical cap is the already-declared `engine-max-visits` debit ([EPIC-flow-engine-leashes](../../roadmap/epics/EPIC-flow-engine-leashes.md)).
2. **No migration of already-broken flow states** — `full-260724-ca264a` predates the fix and stays keyed to the raw request; abort it and start fresh.
3. **`${inputs.request}` is NOT banned from prompts or skill inputs** — prose belongs there (`pre_apply`/`merge` prompts, `classify`/`brainstorm` inputs keep it).
4. **`docs-onboarding.yaml` untouched** — its only interpolations are prompts/inputs (`${inputs.project}`), no task-path commands.

## Affected capabilities

Flow engine (`governance/engine/`), shipped flows (`governance/flows/full.yaml`, `fast.yaml`), CLI resume grammar (`governance/cli.js`). No `docs/specs/` exists in this repo; no capability spec delta. The `runs` interpolation contract change is recorded as ADR-005.

## Impact per surface

| Surface | Impact |
|---|---|
| `governance/engine/` | `resume-output.js` (new), `interpolate.js`, `runs.js`, `invoke.js`, `engine.js`, `parser.js`, `types.js` |
| `governance/cli.js` | `resume` accepts/validates `key=value` output tokens |
| `governance/flows/` | `full.yaml`, `fast.yaml`: select outputs + change-id-keyed paths |
| `governance/__tests__/` | `engine.test.mjs`: driver supports structured answers; §9 regression suite (multiline request, fail-closed leash, data-passing, parser rejection) |
| `docs/` | ADR-005 + index; guides/flows.md; this change package; roadmap line |
| `commands/` | `build.md` resume grammar |
| `.claude-plugin/` | version `0.6.0` |

## Dependencies

None — self-contained. Builds on [ADR-004](../../decisions/ADR-004-aidakit-governance-env-contract.md)'s env conventions for `runs` children.

## Exit criteria

- `node governance/__tests__/engine.test.mjs` → green, including §9: a hostile multiline request drives `full` to completion keyed to the reported change-id; no runs step exits 127; the raw request never appears in a command; `select` success without/with-unsafe `change_id` re-pauses.
- Full test suite (`governance/__tests__/*.test.mjs`) → green.
- Live CLI smoke: `start full request="<multiline>"` → select re-pauses until `change_id` arrives → `check_implement_bench` exits 0 against `.aidakit/tasks/<change-id>/`.
- `node governance/validators/check-adr-format.js docs/decisions/ADR-005-flow-values-as-data.md` → exit 0.
- `node governance/validators/check-plugin-version.js .` → exit 0 with manifest `0.6.0`.
- `node governance/validators/derive-roadmap-status.js --root .` → exit 0; `ROADMAP.md` regenerated (this change's line derives `in-progress`).
- `node governance/validators/check-links.js docs/features/flow-request-vs-change-id docs/decisions` → exit 0.

## Unblocks

Free-form `/aidakit:build start full request="…"` (the documented usage) stops being a flow-killer; consumer-authored flows inherit both guarantees (data-passing + fail-closed outputs) with zero effort.

## Recorded decisions and inherited open decisions

- [ADR-005](../../decisions/ADR-005-flow-values-as-data.md) (new, this change) — flow values are data; records the `runs` interpolation contract change and the structured-outputs resume grammar with rejected alternatives.
- [ADR-004](../../decisions/ADR-004-aidakit-governance-env-contract.md) constrains the `runs` child env — `AIDAKIT_VAR_n` joins `AIDAKIT_GOVERNANCE` as engine-owned names, spread before it so the governance path always wins. No contradiction; ADR-001/002/003 untouched.
