# Proposal — acceptance-leash

**Change ID:** `acceptance-leash`
**Date:** `2026-07-24`
**Owner:** `@chacal88`
**Phase / Package:** `governance/ (validator + agent + flow wiring) + skills/brainstorm (schema formalization) — mechanical goal-leash on the PR gate`

**PRD:** `n/a`
**Tech Spec:** `n/a`

## Why

The kit already leashes the **documentation** to the PR gate: `aidakit:doc-planner` authors a `doc-manifest.json`, `check-doc-manifest.js` verifies each required doc exists on disk, and `check_docs` blocks the flow until the list is 100% ([full.yaml:308-316](../../../governance/flows/full.yaml), [fast.yaml:193-201](../../../governance/flows/fast.yaml)). The **acceptance criteria** — the goals extracted at brainstorm time (`aidakit:brainstorm` returns them as prose, see [agents/brainstorm.md:88-91](../../../agents/brainstorm.md)) — carry no such leash. They live only as text in `proposal.md`/`brainstorm.json`, and there is no mechanical check that the tests/evidence a criterion promised actually exist before the PR opens.

The [EPIC-flow-engine-leashes](../../roadmap/epics/EPIC-flow-engine-leashes.md) Feature 2 named this gap explicitly: *"brainstorm emits `acceptance-manifest.json` (goal → how to verify) and `check-acceptance.js` locks the `pr` step while any criterion has no test/evidence mapped — same treatment as the doc-leash."* This change delivers that leash — a mirror of the doc-leash pattern, weak-bar (path-exists, no re-execution), gating both `full` and `fast`, with `max_visits` from day one so a broken manifest cannot spin forever.

The observable effect: a change whose brainstorm promised "the merge autonomous path routes through the human_gate on failure" cannot reach `pr` unless the acceptance-manifest maps that criterion to a concrete evidence path (test file, evidence.md section, log capture) AND the path resolves on disk. The goal is not enforced by the model's goodwill; it is enforced by a Node validator the engine calls between `check_docs` and `pr`.

## What Changes

- **New agent `aidakit:acceptance-planner`** (mirror of [aidakit:doc-planner](../../../agents/doc-planner.md)): consumes the criteria produced upstream (from `aidakit:brainstorm` in `full`, from `aidakit:plan`'s output in `fast`) plus the change's proposal/design/tasks, and writes `.aidakit/tasks/<change-id>/acceptance-manifest.json` — one item per criterion, each with a fixed evidence path. Isolated context, `Write`-tool-authorized, self-contained system prompt. Does not run the validator, does not touch the source of the criteria.

- **New validator `governance/validators/check-acceptance.js`** (mirror of [check-doc-manifest.js](../../../governance/validators/check-doc-manifest.js)): pure Node, zero-dep. Reads the manifest, verifies each required item's evidence path resolves on disk. Output contract identical to `check-doc-manifest.js`: `{validator: "aidakit.check-acceptance", ok, change_id, level, required, resolved, errors[]}`. Exit 0 pass · 1 incomplete · 2 usage/error. **Weak-bar** by decision: does NOT re-execute tests; `hardening` (the `aidakit:test` invoke) already re-runs the suite upstream. The leash's job is "the promise was mapped to a real artifact," not "the artifact still passes."

- **`aidakit:brainstorm` — formalized output schema.** The agent already emits `acceptance_criteria[]` as prose (`agents/brainstorm.md:90-93`); this change codifies the JSON shape the new agent consumes. `brainstorm.json` gains a canonical `acceptance_criteria` field whose items are `{ id: <kebab-slug>, criterion: <observable effect prose>, source: "brainstorm" }`. No back-compat break — the current field is already an array of strings; the change wraps each into an object with a stable id the manifest can key on.

- **`aidakit:plan` — new `## Acceptance criteria` section, formalized by this change.** In `fast` there is no brainstorm step, so the acceptance criteria are authored inside the plan itself. This change introduces `## Acceptance criteria` as a NEW REQUIRED section of `proposal.md` — a distinct concept from the existing `## Exit criteria` section (which lists validator commands / green-suite gates). `## Acceptance criteria` lists observable-effect promises the goal-leash keys on; `## Exit criteria` stays as-is for validator commands. Existing archived and in-flight proposals (`engine-max-visits/proposal.md`, `configurable-pr-automation/proposal.md`) predate the leash and are grandfathered — they do not need to be retrofitted (they will never re-enter the flow). Only new changes from this PR onward carry the section. The requirement is documented in [skills/plan/SKILL.md](../../../skills/plan/SKILL.md) and the proposal-template guidance in [docs/features/README.md](../README.md); `parse-criteria.js` reads this new section (never `## Exit criteria`) when `brainstorm.json` is absent.

- **`governance/flows/full.yaml` — new `acceptance` + `check_acceptance` steps** between `check_docs` and `pr` (see [design.md](design.md) §Slot decision for the ordering justification). `check_acceptance` back-edge (`on_failure → acceptance`) carries `max_visits: 3` + `on_max_visits: acceptance_escalation` from day one, consistent with [engine-max-visits](../engine-max-visits/proposal.md). New `acceptance_escalation` `human_gate` (`options: [abort]`, routes to `aborted`) mirrors the `specify_escalation` shape.

- **`governance/flows/fast.yaml` — same wiring**, criteria source keyed off the plan's proposal instead of `brainstorm.json`. Same `max_visits` cap and escalation gate.

- **New ADR (`ADR-010`)** documenting the four load-bearing decisions from the brainstorm: (i) separate agent (not overloading `brainstorm`/`plan`), (ii) weak-bar validator (path-exists, no re-execution), (iii) gates both flows, (iv) `max_visits` from day one.

- **Engine tests** (`governance/__tests__/engine.test.mjs` new §11): parser accepts the new steps; `check_acceptance` success routes to `pr`; failure loops back to `acceptance`; `max_visits` exhaustion routes to `acceptance_escalation` and `abort` terminates the flow. Validator tests (`governance/__tests__/check-docs.test.mjs` extended, or new `check-acceptance.test.mjs`): manifest-missing blocks, evidence-missing blocks, `n/a` skipped, all-resolved releases.

## Non-goals

1. **Does not re-execute tests inside `check-acceptance.js`.** The weak-bar decision is explicit ([design.md](design.md) §Validator contract, §Weak-bar rationale). `hardening` (the `aidakit:test` invoke of `full`) and the `aidakit:test` step of `fast` re-run the suite; a doubled re-run at the leash adds cost without adding signal.
2. **Does not freeze criteria at brainstorm time.** Re-runs on every plan revision — a `critic: revise → specify` back-edge that changes the plan naturally re-enters `acceptance` when the flow reaches that slot again. Criteria are always fresh against the current plan. (See [design.md](design.md) §Re-run semantics.)
3. **Does not couple to a specific test framework.** The `evidence.path` in each manifest item is a filesystem path (test file, evidence.md, log capture, screenshot); the validator only checks `existsSync + isFile`. Framework-agnostic by construction.
4. **Does not gate flows other than `full` and `fast`.** `docs-onboarding.yaml` and any future consumer-authored flow that opts in adds the two steps explicitly; there is no engine-level default.
5. **Does not touch the archived changes' acceptance sections retroactively.** Only in-flight changes from this PR onward carry the manifest; historical changes are untouched.
6. **Does not add a "waived" workflow at the manifest level beyond `n/a`.** The same `status: n/a` + `condition` waiver that `check-doc-manifest.js` accepts is inherited verbatim — the agent decides mandatoriness with a written justification; no new waiver primitive is invented.

## Affected capabilities

Governance leashes (`governance/validators/check-acceptance.js` new; `governance/flows/full.yaml`, `fast.yaml` new step pair each), agent surface (`agents/acceptance-planner.md` new), skill contract (`skills/brainstorm/SKILL.md` documents the emitted schema; `skills/plan/SKILL.md` documents the acceptance section as required input in `fast`), and doctrine (new [ADR-010](../../decisions/ADR-010-acceptance-leash.md)). **No `docs/specs/` in this repo** (confirmed in prior changes) — no capability spec delta.

## Impact per surface

| Surface | Impact |
|---|---|
| `governance/validators/check-acceptance.js` | NEW — mirrors `check-doc-manifest.js` output contract; weak-bar path-exists |
| `governance/flows/full.yaml` | `check_docs` re-routes `on_success → acceptance`; new `acceptance` (invoke) + `check_acceptance` (runs) + `acceptance_escalation` (human_gate) steps; `pr` upstream edge moves from `check_docs` to `check_acceptance` |
| `governance/flows/fast.yaml` | same wiring; criteria source is the plan's proposal (no brainstorm upstream) |
| `agents/acceptance-planner.md` | NEW — mirrors `agents/doc-planner.md` (Role/Protocol/Decisions/Escalations/Not-do/Output); tools `Read, Glob, Grep, Write`; `model: sonnet` |
| `skills/brainstorm/SKILL.md` | documents the canonical `acceptance_criteria[]` shape the manifest consumes; no doctrine change |
| `agents/brainstorm.md` | Output format §"Acceptance criteria" section clarifies each item is `{ id, criterion }` (the id is a stable kebab-slug for the manifest to key on) |
| `skills/plan/SKILL.md` | documents `## Acceptance criteria` as a REQUIRED section of `proposal.md` (input to acceptance-planner in `fast`) |
| `docs/decisions/ADR-010-acceptance-leash.md` | NEW; `docs/decisions/README.md` index gains the entry |
| `governance/__tests__/engine.test.mjs` | new §11 — parser + mechanism (success/failure/max_visits) + `full.yaml` + `fast.yaml` end-to-end |
| `governance/__tests__/check-docs.test.mjs` **or** new `governance/__tests__/check-acceptance.test.mjs` | validator: manifest-missing, evidence-missing, `n/a` skipped, all-resolved |

## Dependencies

- **[engine-max-visits](../engine-max-visits/proposal.md) — SATISFIED in `main`.** The `max_visits`/`on_max_visits` fields on `BaseStep` are the mechanism the `check_acceptance` back-edge relies on. Without the mechanical cap already in the engine, this change would have to either ship without the cap (regression against the just-merged decision) or bundle the mechanism (out of scope). Since `engine-max-visits` landed, the cap is a two-line addition on the new `check_acceptance` step.
- **[flow-request-vs-change-id](../../archive/2026-07-24-flow-request-vs-change-id/proposal.md) — SATISFIED in `main`.** Every `.aidakit/tasks/${context.select.change_id}/acceptance-manifest.json` path keys on the structured `select.change_id` output, never on the free-form `${inputs.request}`.
- **[ADR-006](../../decisions/ADR-006-flow-values-as-data.md)** — the `check_acceptance` `runs` step interpolates `${context.select.change_id}` in the command; env-passed data, consistent with the ADR.
- No new runtime dependency (Node stdlib only; the manifest is a JSON file, no YAML parser needed).

## Exit criteria

- `node governance/__tests__/engine.test.mjs` → green, including new §11 (parser + mechanism + `full.yaml`/`fast.yaml` wiring end-to-end).
- Validator tests (extended `check-docs.test.mjs` or new `check-acceptance.test.mjs`) → green: manifest-missing blocks; evidence-missing blocks; `n/a` item skipped; all-resolved releases (exit 0).
- Full suite `governance/__tests__/*.test.mjs` → green (no regression from the 149-of-149 baseline `engine-max-visits` left).
- `node governance/validators/check-adr-format.js docs/decisions/ADR-010-acceptance-leash.md` → exit 0.
- `node governance/validators/check-links.js docs/features/acceptance-leash docs/decisions` → exit 0.
- `node governance/validators/derive-roadmap-status.js --root .` → exit 0; `acceptance-leash` derives `in-progress`.
- Dogfooding smoke: the change's own PR runs through the wired `full` flow with an acceptance-manifest that maps each of the seven acceptance criteria (this file, `tasks.md` §Validation) to a concrete evidence path, and `check_acceptance` clears the gate.

## Unblocks

- Closes [EPIC-flow-engine-leashes](../../roadmap/epics/EPIC-flow-engine-leashes.md) Feature 2 (Coleira das metas).
- Makes the acceptance-manifest pattern available for consumer-authored flows: any future flow that wants the goal-leash adds the same three steps (`acceptance` invoke + `check_acceptance` runs + `acceptance_escalation` human_gate) and points at `aidakit:acceptance-planner` — no engine surface change needed.

## Recorded decisions and inherited open decisions

- [ADR-010](../../decisions/ADR-010-acceptance-leash.md) (NEW, this change) — records the four load-bearing decisions from the brainstorm (separate agent, weak-bar validator, gates both flows, `max_visits` from day one). Deliverable of this change.
- [engine-max-visits](../engine-max-visits/proposal.md) — the `max_visits`/`on_max_visits` mechanism this change relies on. No superseding: this change is a consumer.
- [ADR-006](../../decisions/ADR-006-flow-values-as-data.md) — `runs` interpolation as env-passed data; `check_acceptance` follows the pattern.
- [DOCS.md](../../../DOCS.md) §4 — WORKING vs DURABLE life cycle: `.aidakit/tasks/<id>/acceptance-manifest.json` is WORKING (per-change, lives with the flow state, does not migrate); the `evidence.md` paths it references are the DURABLE record that survives the archive.
- No open decision inherited — the one open item from the brainstorm (slot ordering of `acceptance`/`check_acceptance` in `full.yaml`) is resolved in [design.md](design.md) §Slot decision.

## Coordination (soft) with in-flight changes

- **`context-pack-l1` (in-flight on a separate branch, paused at brainstorm — not present in this worktree, hence no relative link here).** Touches per-change context caching; no overlap with the acceptance surface. This change's `acceptance-planner` reads the plan artifacts and does not participate in the context-pack cache path.
- No other in-flight change edits `governance/flows/*.yaml` at the same slot (the tail `check_docs → pr` is stable in `main` since ADR-009 landed).
