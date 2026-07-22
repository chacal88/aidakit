# Proposal — add-debit

**Change ID:** `add-debit`
**Date:** `2026-07-22`
**Owner:** `@chacal88`
**Phase / Package:** `n/a (fast flow — small reversible engine-surface change)`
**PRD:** `n/a`
**Tech Spec:** `n/a`

## Why

`/aidakit:build` has no register-only path. The `fast` flow (`governance/flows/fast.yaml`) goes `select → plan → …` and its only exits are the terminals — a request of "just register this for later" cannot result in anything but a full build or an abort. The gap was hit in production on 2026-07-22 (this branch): the owner asked to register a change for later, and the workaround was manual — `aidakit:roadmap` hand-registered `add-debit` in [EPIC-flow-engine-leashes](../../roadmap/epics/EPIC-flow-engine-leashes.md) + regenerated [ROADMAP.md](../../roadmap/ROADMAP.md), then `node governance/cli.js start fast request="add-debit"` parked flow `fast-260722-8e7af2` PAUSED at `select`, and a later resume continued into planning. That manual sequence is the behavior to productize (declared on the roadmap, feature "Registro diferido no build (débito)").

Lesson from the dry-run, inherited as a hard constraint: a free-form sentence as `request` pollutes every `${inputs.request}` path downstream (`.aidakit/tasks/${inputs.request}/bench.ndjson`, `doc-manifest.json`) — the parked flow must be keyed to the **minted change-id**, never the raw sentence.

## What Changes (user-visible)

- `/aidakit:build register "<free-form request>"` becomes a first-class path: the request is registered on the roadmap as a declared change (derived status: `backlog`, per [ADR-002](../../decisions/ADR-002-roadmap-status-derived-from-disk.md)) and a `fast` flow is started in **register mode**, which parks at an explicit `parked` human gate without dispatching `select`/`plan`/`implement`.
- `aidakit:roadmap` gains a `register` mode (mint kebab-case change-id from the free-form request, append the feature line + acceptance sub-bullet to the chosen epic, regen `ROADMAP.md` — reusing the existing `add-feature` + `regen` machinery, no forked writer).
- The `fast` flow gains a `mode` enum input (`build` | `register`, default `build`) and three steps on the register path: `route_mode` (runs) → `check_registered` (runs — a leash: the flow refuses to park an id the roadmap does not declare) → `parked` (human_gate, options `plan` | `discard`).
- `node governance/cli.js resume <flow_id> plan` resumes the parked flow into the existing `select` step — the orchestrator confirms the roadmap-declared change and planning proceeds with no re-explanation (context = the epic feature line + the parked state's `inputs.request`).
- `governance/validators/derive-roadmap-status.js` gains a `--change <id>` flag (exit 0 = declared in some epic, exit 1 = not) backed by a new pure helper in `governance/roadmap/roadmap.js` — the deterministic half of the leash.

Default path unchanged: `start fast request=<id>` with no `mode` behaves exactly as today.

## Acceptance criteria (observable)

1. A register-only request does **not** trigger plan/implement: the parked flow's `step_history` contains no `select`/`plan` record before the park.
2. The parked flow is keyed to the minted change-id: `.aidakit/flows/state/<flow_id>.json` has `status: "paused"`, `pause.step_id: "parked"`, and `inputs.request` = the kebab-case change-id (never the raw sentence).
3. The roadmap entry derives as `backlog`: `derive-roadmap-status.js` lists the id under the epic with status `backlog` (no hand-written status — ADR-002).
4. A free-form request gets a minted kebab-case change-id (`aidakit:roadmap` register mode, single key of DOCS.md §2.7).
5. `resume <flow_id> plan` continues into planning with context preserved: the flow pauses next at `select` with `input.request` = the change-id; the epic feature line carries the acceptance context the planner reads.
6. `start fast mode=register` with an id the roadmap does not declare (including a raw sentence) → terminal `aborted`, nothing parked — the `check_registered` leash catches it mechanically.
7. Full governance suite green; the new tests were written RED-first.

## Non-goals

- No register mode on `full.yaml` (the same `mode` input composes there later; fast-only keeps this change small).
- No parked-debit listing/GC UX beyond the existing `cli.js list`/`status` (the state dir is the truth).
- No engine core changes (`governance/engine/*.js` untouched); the engine in `governance/` does NOT get renamed.
- No multi-change registration per invocation (one debit at a time).
- No new ADR: nothing here locks a new architectural decision — ADR-002 already governs the roadmap discipline this change obeys.

## Affected capabilities

Flow layer (`governance/flows/`), roadmap derivation (`governance/roadmap/`, `governance/validators/`), and the `/aidakit:build` + `aidakit:roadmap` prose surfaces. No `docs/specs/` exists in this repo, so **no spec delta** — the behavioral contract is pinned by the new regression tests (same treatment as [loop-var-resume](../loop-var-resume/proposal.md)).

## Impact per surface

| Surface | Impact |
|---|---|
| `governance/` | `flows/fast.yaml` (+1 input, +3 steps); `roadmap/roadmap.js` (+1 exported helper); `validators/derive-roadmap-status.js` (`--change` flag); `__tests__/roadmap.test.mjs` + `__tests__/engine.test.mjs` (new RED-first sections) |
| `commands/` | `build.md` — the `register` verb sequence (roadmap register → start in register mode → report parked flow_id; resume guidance; already-parked pre-check) |
| `skills/` | `roadmap/SKILL.md` — `register` mode (mint id, collision refusal, epic line + regen) |
| `agents/` | none (the orchestrator already confirms an id-carrying request at `select`) |
| `hooks/` | none |
| `docs/` | this change directory; one subsection in `docs/guides/flows.md`; the riding roadmap diff (below) |

## Dependencies

None. Self-contained and reversible (revert the flow/validator/prose edits; the engine core is untouched).

**Riding diff:** the registration of `add-debit` itself — the currently uncommitted edits to [docs/roadmap/ROADMAP.md](../../roadmap/ROADMAP.md) and [docs/roadmap/epics/EPIC-flow-engine-leashes.md](../../roadmap/epics/EPIC-flow-engine-leashes.md) in this worktree — ships with this change's eventual PR (it is this capability's own first artifact, produced by the manual dry-run).

## Exit criteria

- New tests exist, documented RED-first, and the full governance suite (`for f in governance/__tests__/*.test.mjs; do node "$f"; done`, 11 files) exits 0.
- The three register-path acceptance criteria above are demonstrated end-to-end in the engine test (park → resume → select).
- Evidence recorded in [evidence.md](evidence.md); PR opened and stopped at the URL (GOVERNANCE.md §1 — the merge is human).

## Unblocks

The remaining EPIC-flow-engine-leashes features (`engine-max-visits`, `acceptance-leash`, `retry-memory`, `flow-parallel-bench`) can themselves be parked as debits instead of hand-worked around — the registration path becomes self-hosting.

## Recorded decisions and inherited open decisions

- Read the [decisions index](../../decisions/README.md): [ADR-001](../../decisions/ADR-001-executable-dna-crystallization.md) (executable DNA — not touched), [ADR-002](../../decisions/ADR-002-roadmap-status-derived-from-disk.md) (**constrains this change**: the register mode writes no status field anywhere; the entry shows as `backlog` because nothing exists on disk yet, and flips to `in-progress` only when `docs/features/<id>/` appears), [ADR-003](../../decisions/ADR-003-shared-knowledge-in-docs.md) (knowledge in docs — not touched). No contradiction; no supersession needed.
- No open-decisions log exists in this repo. The one open assumption recorded on the roadmap line ("the form — CLI verb vs `register.yaml` flow vs `fast` input — is decided in the plan") is resolved in [design.md](design.md) by explicit delegation from the owner — not an escalation.
