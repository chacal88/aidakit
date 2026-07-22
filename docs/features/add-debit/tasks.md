# Tasks — add-debit

**Change ID:** `add-debit`
**Date:** `2026-07-22`
**Owner:** `@chacal88`
**Phase / Package:** `n/a (fast flow — small reversible engine-surface change)`
**PRD:** `n/a`
**Tech Spec:** `n/a`

> TDD order is load-bearing: section 2 (RED) lands and demonstrably fails BEFORE section 3 (GREEN). Record the RED run in [evidence.md](evidence.md).

## 1. Setup

- [x] Baseline green: `for f in governance/__tests__/*.test.mjs; do node "$f"; done` — 11 files exit 0 (record the totals in [evidence.md](evidence.md)).
- [x] Confirm the riding roadmap diff is still present and uncommitted: `git status --short` shows `M docs/roadmap/ROADMAP.md` and `M docs/roadmap/epics/EPIC-flow-engine-leashes.md` (it ships with this PR — [proposal.md](proposal.md) Dependencies).

## 2. Surface Work — governance (RED tests)

- [x] `governance/__tests__/roadmap.test.mjs`: tests for `findDeclaredChange(changeId, root)` — (a) a declared id returns `{ epic, feature }` matching the seeded epic; (b) an undeclared id returns `null`; (c) missing `docs/roadmap/epics/` returns `null`, no crash. FAILS RED (helper does not exist yet).
- [x] `governance/__tests__/engine.test.mjs`, new numbered section (register path, seeding an epic file in the tmp root that declares a test change-id):
  - [x] `start fast request=<declared-id> mode=register` → status `paused`, `pause.step_id === "parked"`, `pause.step_type === "human_gate"`, and `step_history` contains **no** `select`/`plan` entry; state on disk keyed to the change-id (`inputs.request === <declared-id>`).
  - [x] resume with `plan` (reloading state from disk first, like the §7 idiom) → next pause is `select` with `pause.input.request === <declared-id>`.
  - [x] resume with `discard` (separate flow instance) → terminal `aborted`.
  - [x] `start fast request=<undeclared-or-free-form> mode=register` → terminal `aborted`, no `parked` pause (the leash).
  - [x] regression guard: the existing §2 happy path (`mode` defaulting to `build`) still passes unmodified — `route_mode` is a `runs` step and must not appear in `visited`.
- [x] Run the two files; record the RED failures in [evidence.md](evidence.md).

## 3. Surface Work — governance (GREEN)

- [x] `governance/roadmap/roadmap.js`: export `findDeclaredChange(changeId, root)` reusing `collectEpics` + `parseEpic` (no new parse grammar; `FEATURE_RE` stays the single source).
- [x] `governance/validators/derive-roadmap-status.js`: `--change <id>` flag — short-circuits before the git/gh spawns; stdout JSON `{ validator, ok, change: { id, declared, epic, feature } }`; exit 0 declared / 1 not declared / 2 missing value.
- [x] `governance/flows/fast.yaml`: add the `mode` enum input (`build|register`, default `build`) and the `route_mode` → `check_registered` → `parked` steps exactly as frozen in [design.md](design.md) (`route_mode` becomes the first step in the list; `select` onward untouched). Deviation: `values:` written as a block list (`- build` / `- register`), not `[build, register]` — the mini YAML parser (`governance/engine/yaml-min.js`) does not support flow-style collections; same convention already used by `options:` elsewhere in this file. No change to the frozen enum values/default.
- [x] Both test files from section 2 now GREEN: `node governance/__tests__/roadmap.test.mjs` and `node governance/__tests__/engine.test.mjs` exit 0.

## 4. Surface Work — kit command/skill surfaces

- [x] `skills/roadmap/SKILL.md`: add the `register` mode — deferred single-change registration: mint the kebab-case change-id (single key §2.7), refuse collisions (id already declared, or `docs/features/<id>/` / archive dir exists — ask the owner), write the feature line + one-line acceptance sub-bullet via the existing `add-feature` path (creating the epic first, proposing per the skill's gates, when `docs/roadmap/epics/` is absent), then `regen` `ROADMAP.md`. Status stays derived-only (cite [ADR-002](../../decisions/ADR-002-roadmap-status-derived-from-disk.md)).
- [x] `commands/build.md`: document the `register` verb — sequence: (1) pre-check `.aidakit/flows/state/*.json` for an existing paused flow with `pause.step_id: "parked"` and the same `inputs.request`, resume it instead of double-parking; (2) dispatch `aidakit:roadmap` register → obtain the minted change-id; (3) `node governance/cli.js start fast request=<change-id> mode=register` (never the raw sentence); (4) report flow_id + change-id and stop. Plus the resume line (`resume <flow_id> plan`) and the boundary note (a request too rich for a feature line should be planned now, not parked).

## 5. Documentation

- [x] `docs/guides/flows.md`: short subsection under §5 (CLI commands / fast example) — register mode: the start invocation, the parked pause, the resume-into-planning, the leash behavior on an undeclared id.
- [x] Change artifacts complete and mutually consistent under `docs/features/add-debit/` (this directory).

## 6. Validation

- [x] Full governance suite: `for f in governance/__tests__/*.test.mjs; do node "$f"; done` — all files exit 0; record totals in [evidence.md](evidence.md).
- [x] Live smoke on this repo (add-debit is already declared in the epic): `node governance/validators/derive-roadmap-status.js --change add-debit` → exit 0, `declared: true`; and `--change no-such-change` → exit 1. Record both in [evidence.md](evidence.md).
- [x] Links resolve (DOCS.md §2.4): `node governance/validators/check-links.js docs/features/add-debit docs/guides/flows.md` → exit 0.
- [x] `git diff --stat` matches the surface table in [proposal.md](proposal.md) (governance flows/roadmap/validators/tests + `commands/build.md` + `skills/roadmap/SKILL.md` + `docs/guides/flows.md` + this change dir + the riding `docs/roadmap/` diff — nothing else).

## 7. Evidence & Ship

- [x] `## Validation Outputs` and `## Files Touched` filled in [evidence.md](evidence.md); deviations (if any) recorded under `## Unresolved Deviations`.
- [ ] Ship via `aidakit:ship`: named staging only (GOVERNANCE.md §4), conventional commit, branch carries the change-id suffix (single key §2.7), PR opened, **stop at the URL** — the merge is the human's (GOVERNANCE.md §1). (Out of scope for the implementer — left for the `ship` step of the flow.)
