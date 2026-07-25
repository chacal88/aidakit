# Proposal — trim-doc-planner-agent-prompt

**Change ID:** `trim-doc-planner-agent-prompt`
**Date:** `2026-07-25`
**Owner:** `@chacal88`
**Phase / Package:** `n/a (agents/doc-planner.md prompt-body trim + docs/features/workflow-script-optimization/dispatch-cost.md re-measure — no mechanical surface)`
**PRD:** `n/a`
**Tech Spec:** `n/a`

## Why

`agents/doc-planner.md` is the kit's single most expensive agent prompt by the measured ranking in [`dispatch-cost.md`](../workflow-script-optimization/dispatch-cost.md) §2: **15105 bytes / 2198 words**, ranked **first** at **45315** on the lower-bound `body_bytes × happy_path_dispatches` metric (15105 × 3 — it is the only first-order agent with a non-zero `static` count in three of the four flows: `full`, `fast`, `docs-onboarding`). Every dispatch of the agent starts a fresh isolated context that pays the full body size again; three happy-path dispatches per clean traversal make it the highest-leverage body to shrink.

The reduction is *engineering*, not modelling: the win is prefix-size reduction, deterministic and independent of SDK cache hit-rate — exactly the L1 lever [ADR-013](../../decisions/ADR-013-context-pack-per-change.md) establishes ("The win we *can* engineer is **prefix-size reduction**: shrinking what each dispatch processes in the first place"). This change realises that lever on the top-ranked body by removing prose that is *redundant*, never prose that is *judgment-bearing*.

The Feature is already declared on the roadmap ([EPIC-context-caching](../../roadmap/epics/EPIC-context-caching.md) line 14, "Trim `agents/doc-planner.md`'s prompt body — changes: trim-doc-planner-agent-prompt"). Its acceptance sets the leash for this change: trim only content genuinely redundant with the context pack ([ADR-013](../../decisions/ADR-013-context-pack-per-change.md)) or already loaded by the caller; **no judgment-bearing instruction removed**; before/after byte counts recorded in this change's own evidence. The `15105`/`45315` figures in that acceptance line are the **FROM baseline** this change trims from — left intact as the baseline.

## What Changes

- **[`agents/doc-planner.md`](../../../agents/doc-planner.md) — body-prose compression, no semantic loss.** The agent's own doctrine (the doc-manifest schema, the mandatoriness rules, the two manifest paths, the enum values, the fail-closed guard, the six-section anatomy) is stated **once, authoritatively**, and the 3–4× restatements of the same points across `## Role`, `## Protocol`, `## What you decide on your own`, `## Escalation triggers` and `## What you do NOT do` are compressed to pointers or dropped. Long parenthetical asides and the escalation prose that re-explains [GOVERNANCE.md §1](../../../GOVERNANCE.md) (which the caller already loads) are the primary byte savings. Concrete regions and the freeze list are in [design.md](design.md).
- **[`dispatch-cost.md`](../workflow-script-optimization/dispatch-cost.md) — mandatory cascade re-measure (the DNA gate makes this non-optional).** Trimming the body changes `Buffer.byteLength`, so the [`regression-measured-body-size-tables-match-live-tree`](../../../governance/__tests__/regression-measured-body-size-tables-match-live-tree.test.mjs) DNA gate — which re-measures every fenced `wc -c -w` row against the live tree — FAILS until the `doc-planner` row is updated. This change re-measures on the trimmed tree and updates the live figures: the §1 fenced row (line 27, gate-enforced), the §1 `total` row (line 37, internal sum), the §2 ranking cell `45315 (15105 × 3)` (line 52), and the §2 "Reading the extremes" prose (line 68). It ADDS a dated trim note to §1 mirroring the existing PR #54 drift note, and PRESERVES that existing note (line 40) as WORM history.
- **Provenance footer** — one appended `<!-- aidakit vX.Y — … -->` line at the tail of `agents/doc-planner.md`, following repo convention (append, never rewrite the existing footers — precedent [`GOVERNANCE.md:58-59`](../../../GOVERNANCE.md)).

## Non-goals (explicit)

1. **No behavior change to what the manifest contains.** Not one field, enum value, path, mandatoriness rule, or decision-authority statement is removed or altered. The three hard invariants in [design.md](design.md) §"The leash (what must survive the trim)" are frozen. If a candidate trim would touch any of them, it is dropped — a byte saved by weakening the leash is refused.
2. **No mechanical surface.** No validator, no test, no engine/YAML/schema/hook edit. `governance/**` is byte-identical to the merge-base. This is prose surgery on one agent file plus a measurement update on one docs file.
3. **No new ADR, no supersession.** The change is downstream of [ADR-013](../../decisions/ADR-013-context-pack-per-change.md); it records no new locked decision and contradicts none. A prompt trim changes no structure, responsibility, boundary or contract (no `arquitetura`/`contrato` flag), so DOCS.md §2 requires no ADR.
4. **No spec delta.** The change touches no capability spec — `docs/specs/` does not exist in this repo (same finding as [brainstorm-schema-path-literal-lock §Affected capabilities](../brainstorm-schema-path-literal-lock/proposal.md)). It references [ADR-013](../../decisions/ADR-013-context-pack-per-change.md) without modifying it.
5. **No target byte count invented.** Acceptance is "bytes drop from 15105 with no judgment-bearing instruction removed" — there is no fixed target. Every number recorded is one that was actually `wc`-run on the tree (measure, don't recall).
6. **No rewrite of history.** The [`dispatch-cost.md`](../workflow-script-optimization/dispatch-cost.md) line-40 drift note (the 14752→15105 PR #54 record) and the `44256` historical figures stay verbatim; the `proposal.md`/`design.md`/`evidence.md`/`inventory.md` of `workflow-script-optimization` are NOT touched (they are that merged change's historical narrative — only `dispatch-cost.md` carries the gate-tracked live rows). The [EPIC](../../roadmap/epics/EPIC-context-caching.md) `15105`/`45315` acceptance figure is the FROM baseline — left intact.

## Affected capabilities

- The `aidakit:doc-planner` agent's own prompt body (the DOC-LEASH author). No canonical capability spec exists in this repo (`docs/specs/` absent). **No spec delta.**

## Impact per surface

| Surface | Impact |
|---|---|
| `agents/` | 1 file: `doc-planner.md` — body-prose compression (no `##`-section removed; the six-section GOVERNANCE §7 anatomy preserved in order) + appended provenance footer. The frozen leash regions are byte-preserved (see [design.md](design.md)). |
| `docs/features/workflow-script-optimization/` | 1 file: `dispatch-cost.md` — the mandatory cascade: §1 fenced `doc-planner` row (line 27) + `total` row (line 37) re-measured; §2 ranking cell (line 52) + "Reading the extremes" prose (line 68) reconciled to the measured value; a new dated §1 trim note added; the line-40 PR #54 drift note preserved. No other row (12 agents + 14 skills) altered. |
| `governance/**` (engine, validators, flows, acceptance, `__tests__`) | **none** — no mechanical surface (non-goal 2). |
| `docs/decisions/` | **none** — no new ADR, no supersession (non-goal 3). |
| `docs/specs/` | **none** — absent; no capability touched (non-goal 4). |
| `docs/roadmap/epics/EPIC-context-caching.md` | **none** — status derives from disk ([ADR-002](../../decisions/ADR-002-roadmap-status-derived-from-disk.md)/[ADR-007](../../decisions/ADR-007-roadmap-status-from-shared-git.md)); the `15105`/`45315` acceptance figure is the FROM baseline, left intact (non-goal 6). |
| `docs/features/trim-doc-planner-agent-prompt/` | this change directory (proposal/design/tasks/evidence). |
| `commands/`, `hooks/`, `skills/`, `.claude-plugin/` | none. |

## Dependencies

- **[`workflow-script-optimization`](../workflow-script-optimization/dispatch-cost.md) must have shipped its `dispatch-cost.md`** — it has (merged; the file is on the tree, HEAD `7cfbb1f`). This change edits that file's live rows; it does not depend on the change being *archived* (it is still in `docs/features/`, so the DNA gate scans it).
- **The DNA gate ([`regression-measured-body-size-tables-match-live-tree.test.mjs`](../../../governance/__tests__/regression-measured-body-size-tables-match-live-tree.test.mjs)) is on the tree** (PR #62, HEAD `7cfbb1f`) — it is what makes the cascade non-optional, and it must be green after the re-measure.
- **Concurrent-worktree drift risk.** The DNA gate exists precisely because sibling PRs advance `origin/main` mid-change and stale a measured row. This change re-measures *the whole table* at validation time (after any rebase) and reconciles only its own `doc-planner` row; drift on another agent/skill row is a rebase artifact to escalate, not silently rewrite (see [tasks.md](tasks.md) §Validation).

## Acceptance criteria

- `bytes-reduced-measured` — `wc -c -w agents/doc-planner.md` on the trimmed tree records fewer bytes than the `15105` baseline; both before and after counts are pasted verbatim into [evidence.md](evidence.md) from actual `wc` runs.
- `no-judgment-instruction-removed` — every frozen leash element survives byte-for-byte in meaning: the Step 3 item schema (`doc`/`path`/`status`/`condition`/`kind`/`owner`) and manifest envelope (`change_id`/`level`/`required[]`); the "`n/a` is the only waiver and always needs a `condition`" rule; the `status` (`pendente`\|`resolvido`\|`n/a`) and `kind` (`adr`\|`doc`\|`index`) enums; the two manifest paths (`.aidakit/tasks/<change-id>/doc-manifest.json`, `.aidakit/doc-manifest-project.json`); the decision authority (mandatory-vs-waivable judgment, derive paths/rules from DOCS.md, assemble the project manifest on a project identity, honour the 3 escalations). Evidence quotes each survivor.
- `guard-literal-survives-verbatim` — the fail-closed guard string `: "${AIDAKIT_GOVERNANCE?agent-validator-paths: AIDAKIT_GOVERNANCE not set — SessionStart hook missing (see docs/guides/flows.md §6)}"` (backslash-escaped in the Output-format step-5 sentence) survives byte-identical, at least one occurrence; [`agent-validator-paths.test.mjs`](../../../governance/__tests__/agent-validator-paths.test.mjs) is `0 failed`.
- `doc-manifest-contract-intact` — a fixture manifest built directly from the trimmed Step 3 schema block passes [`check-doc-manifest.js`](../../../governance/validators/check-doc-manifest.js) (exit 0 with all fields present) and an `n/a` item lacking a `condition` fails it (`manifest-invalid`, exit 2); [`check-docs.test.mjs`](../../../governance/__tests__/check-docs.test.mjs) is `0 failed`. Both runs pasted into evidence.
- `dna-gate-green-after-remeasure` — after the trim, [`dispatch-cost.md`](../workflow-script-optimization/dispatch-cost.md) line 27 carries the new measured `<words> <bytes> agents/doc-planner.md`, line 37 the new `total`, line 52 the new ranking cell, line 68 the reconciled prose; [`regression-measured-body-size-tables-match-live-tree.test.mjs`](../../../governance/__tests__/regression-measured-body-size-tables-match-live-tree.test.mjs) is `0 failed`.
- `ranking-order-preserved` — with the measured new byte count `B`, `B × 3 > 26940` holds (doc-planner stays rank 1 over `reviewer-quality`), verified arithmetically in evidence; the §2 "largest single agent file" prose is reconciled to the measured `B` vs `reviewer-quality`'s `13470` (flip the wording if `B < 13470` — the ranking stays 1 either way, driven by reuse, but the body-size superlative is measured, not assumed).
- `dated-trim-note-added` — a new dated trim note in §1 records the `15105 → B` reduction and the ranking `45315 → B×3`, mirroring the existing drift note's shape; the line-40 PR #54 drift note (14752→15105) is preserved verbatim.
- `anatomy-and-scope-clean` — the six GOVERNANCE §7 sections (`Role` · `Protocol` · `What you decide on your own` · `Escalation triggers` · `What you do NOT do` · `Output format`) survive in order; `git diff --stat` shows exactly `agents/doc-planner.md`, `docs/features/workflow-script-optimization/dispatch-cost.md`, plus this change directory — no `.js`/`.mjs`/`.yaml`, no history file rewritten.

## Exit criteria

- `wc -c -w agents/doc-planner.md` before and after, recorded in [evidence.md](evidence.md); after `< 15105` bytes.
- `node governance/__tests__/regression-measured-body-size-tables-match-live-tree.test.mjs` → `0 failed` (the DNA gate, after the re-measure).
- `node governance/__tests__/agent-validator-paths.test.mjs` → `0 failed` (guard literal survives).
- `node governance/__tests__/check-docs.test.mjs` → `0 failed` (doc-manifest validator contract).
- Full governance suite `for f in governance/__tests__/*.test.mjs; do echo "== $f"; node "$f" 2>&1 | tail -1; done` → every file `0 failed`, **against a baseline captured before any edit** — any file already red at baseline is a pre-existing condition named in evidence, not attributed to this change (the `context-pack.test.mjs` merge-base caveat is the known candidate; baseline first, do not recall its state).
- `check-doc-manifest.js` smoke run on a fixture manifest derived from the trimmed Step 3 block: exit 0 for the well-formed manifest, exit 2 (`manifest-invalid`) for an `n/a` item without a `condition`.
- `node governance/validators/check-links.js docs/features/trim-doc-planner-agent-prompt agents/doc-planner.md docs/features/workflow-script-optimization/dispatch-cost.md` → exit 0.
- `git diff --stat` paired with `git status --porcelain` matches §Impact per surface — exactly the two files + this change directory, no stray edits, no `governance/**` change.

## Unblocks

- The sibling Feature [`trim-reviewer-quality-agent-prompt`](../../roadmap/epics/EPIC-context-caching.md) (second-ranked body, 13470 bytes / 26940) inherits the same redundancy bar and the same cascade recipe proven here on the top-ranked body.
- Populates the first real datum for the L1 size-reduction lever of [ADR-013](../../decisions/ADR-013-context-pack-per-change.md): a measured before/after byte delta on the most-dispatched agent body, which the EPIC's L2 promotion trigger reads (gain-stagnation is a *measured* signal, not a calendar one).

## Recorded decisions and inherited open decisions

- Read the [decisions index](../../decisions/README.md).
  - [ADR-013](../../decisions/ADR-013-context-pack-per-change.md) — the context pack as a first-class per-change artifact; **directly constrains this change**: the win is deterministic prefix-size reduction independent of cache hit-rate, and the trim removes only what is redundant with material the caller already loads or the pack would carry. This ADR is the redundancy rationale the acceptance leash names; the change references it, never modifies it (its status stays `proposed`).
  - [GOVERNANCE.md §7](../../../GOVERNANCE.md) — the mandatory agent anatomy (six sections in order); the trim compresses within sections but removes none. §1 — the three escalations the agent must keep honouring (invariant #3).
  - [ADR-002](../../decisions/ADR-002-roadmap-status-derived-from-disk.md) / [ADR-007](../../decisions/ADR-007-roadmap-status-from-shared-git.md) — roadmap status stays derived from disk; this change hand-writes no status and leaves the EPIC's FROM-baseline figure intact.
  - [ADR-001](../../decisions/ADR-001-executable-dna-crystallization.md) — the [`regression-measured-body-size-tables-match-live-tree`](../../../governance/__tests__/regression-measured-body-size-tables-match-live-tree.test.mjs) gate is crystallized DNA (the concurrent-worktree drift class, recurred 3×); this change obeys it by re-measuring mechanically rather than trusting a manual re-measure.
- This change **introduces no ADR** and **supersedes none** (non-goal 3). The trim is downstream of decisions already recorded; DOCS.md §2 precedence: the prompt is corrected to match the doctrine, never the reverse.
- No open-decisions log exists in this repo; nothing inherited. `docs/roadmap/ROADMAP.md` lists this change as `backlog` under the context-caching epic; no unresolved decision blocks it.
