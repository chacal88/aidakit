# Proposal — review-usage-bench-manifest

**Change ID:** `review-usage-bench-manifest`
**Date:** `2026-07-25`
**Owner:** `@chacal88`
**Phase / Package:** `n/a (doc-only surface fix on the review command + skill; classification: domain=product, type=feature, flags=[], confirmed)`
**PRD:** `n/a`
**Tech Spec:** `n/a`

## Why

`check_review_bench` — the PARALLELISM LEASH in [governance/flows/full.yaml](../../../governance/flows/full.yaml) (`full.yaml:260-274`, mirrored in `fast.yaml`) — refuses a review round whose `bench.ndjson` has no `__manifest__` record (rule `manifest-missing`, [check-bench.js](../../../governance/validators/check-bench.js):110-112) and back-edges to `review_bench`. The back-edge is not a warning: it re-runs **the entire bench**, six subagents, at ~15× a chat turn each. That is exactly what happened during the `flow-step-summaries` run (post-mortem 2026-07-24, [EPIC-kit-discipline-hardening](../../roadmap/epics/EPIC-kit-discipline-hardening.md)) — one full extra bench round paid for a record nobody wrote.

The requirement is *already* documented in prose: [skills/review/SKILL.md](../../../skills/review/SKILL.md):62 says "Before dispatching anyone, write the bench manifest … Write it, THEN dispatch." It was documented, and the miss happened anyway. Two concrete gaps explain why, and both are fixable at the doc surface:

1. **The command says nothing.** [commands/review.md](../../../commands/review.md)'s `## Usage` block (lines 8-17) — the surface a human or an agent hits *first*, and the only one a caller who already "knows the skill" bothers to re-read — never mentions the manifest, `bench.ndjson`, or the leash. A reader who only opens the command cannot learn that a mandatory pre-dispatch write exists.
2. **There is no executable shape anywhere.** Neither the skill, nor the command, nor [governance/README.md](../../../governance/README.md) §"Real parallelism" carries a copy-paste invocation. The prose names the function (`recordBenchManifest`), the file, and the record shape, and then leaves the caller to invent the ESM-import-from-Bash one-liner under time pressure, in the same turn it is assembling six agent prompts. Prose that requires on-the-spot synthesis is prose that gets skipped.

This change closes both gaps and nothing else. It is **deliberately not** the epic's "PREFERRED (larger scope)" option — see Non-goals and Dependencies for why that option is not structurally achievable as written, and Unblocks for where it goes instead.

## What Changes

- **[commands/review.md](../../../commands/review.md) `## Usage` gains a manifest line.** It states the requirement (a `__manifest__` record written via `recordBenchManifest` to `.aidakit/tasks/<change-id>/bench.ndjson` **before** the parallel fan-out), names the consequence (`manifest-missing` → `check_review_bench` exit 1 → back-edge to `review_bench` → the whole bench re-runs), and **links** to step 5 of the skill for the concrete shape. The `## Usage` block's existing contract from [ADR-005](../../decisions/ADR-005-command-namespacing.md) (expected inputs + at least one copy-paste invocation example, printed on empty/malformed `$ARGUMENTS`) is preserved unchanged — the manifest line is additive.
- **[skills/review/SKILL.md](../../../skills/review/SKILL.md) step 5 gains the one and only copy-paste dispatch example.** Manifest write → the single parallel-`Agent` message → one `recordBench` per role with real `dispatched_at`/`returned_at`, plus the three leash invariants that a hand-written record actually trips (verbatim role strings, `dispatched_at` after the manifest write, exactly one manifest per round). It cites [governance/ledgers/ledger.js](../../../governance/ledgers/ledger.js) and [governance/validators/check-bench.js](../../../governance/validators/check-bench.js) as the mechanical source of truth, and names the same skip-consequence as the command.
- **Single source, enforced by placement.** The concrete example exists in exactly one file ([DOCS.md](../../../DOCS.md) §2 rule 1). The command cites and links; it does not carry a second copy that would drift.
- **The larger-scope option is registered as a separate debit** on [EPIC-kit-discipline-hardening](../../roadmap/epics/EPIC-kit-discipline-hardening.md) as change-id `review-bench-manifest-mechanical-writer`, with an acceptance sub-bullet naming the `manifest-duplicate` contract conflict as the crux. Verified non-colliding at plan time (no epic declaration, no `docs/features/` dir, no archive dir).
- **Delivery hygiene:** doctrine footers on the two touched files + a `.claude-plugin/plugin.json` version bump, without which `claude plugin update` copies nothing and the doc fix never reaches an installed user ([PROCESS.md](../../../PROCESS.md) §5).

## Non-goals

- **`aidakit:review` does NOT start writing the manifest mechanically.** This change adds no `runs` step, no validator, no code under `governance/`, and no test. Rationale (settled by the owner at the brainstorm gate, `.aidakit/tasks/review-usage-bench-manifest/brainstorm.json`): `review_bench` is a `type: invoke` step (`full.yaml:249-250`), so "the skill writes it" and "the doc tells the model to write it" are *the same mechanism* — the skill IS the model's instructions. See Dependencies for the structural blocker.
- **[skills/implement/SKILL.md](../../../skills/implement/SKILL.md) is out of scope.** It documents an analogous `bench: "implement"` manifest (lines 69-74) with the same footgun, but the epic's feature line names only `aidakit:review`. Not fixed here, not silently widened.
- **No second copy of the example.** Not in `commands/review.md`, not in `governance/README.md`, not in `docs/guides/flows.md` — those three already describe the pattern in prose at their own altitude and stay untouched.
- **No new ADR.** The change formalizes doctrine already implicit in `check-bench.js`'s design; it locks no new decision. (The *mechanical writer* debit likely does need one — that is the debit's problem, not this change's.)
- **`check-bench.js`'s `manifest-duplicate` rule is not touched, softened, or reinterpreted.** It is the invariant that makes the manifest anti-tamper.
- **No claim that this makes the bench pass on the first round every time.** Prose cannot guarantee LLM conformance; see Acceptance criteria for the observable bar actually being promised.

## Affected capabilities

No `docs/specs/` exists in this repo, so **no spec delta** — same precedent as [command-grouping-and-inputs](../../archive/2026-07-24-command-grouping-and-inputs/proposal.md) and [loop-var-resume](../../archive/2026-07-22-loop-var-resume/proposal.md). The behavioral contract this change documents is already pinned mechanically by `governance/validators/check-bench.js` and its suite `governance/__tests__/check-bench.test.mjs` (20/0); this change adds prose *about* that pinned contract and therefore pins nothing new.

## Impact per surface

| Surface | Impact |
|---|---|
| `commands/` | `review.md` only — 1 line added to `## Usage` + 1 doctrine footer. No other command touched. |
| `skills/` | `review/SKILL.md` only — step 5 gains the copy-paste block (+ a forward pointer in the existing line-62 paragraph) + 1 doctrine footer. `skills/implement/SKILL.md` explicitly untouched (non-goal). |
| `docs/roadmap/` | `epics/EPIC-kit-discipline-hardening.md` gains one `- **Feature:**` line + acceptance sub-bullet for `review-bench-manifest-mechanical-writer`; `ROADMAP.md` **regenerated**, never hand-edited ([ADR-002](../../decisions/ADR-002-roadmap-status-derived-from-disk.md), [ADR-007](../../decisions/ADR-007-roadmap-status-from-shared-git.md)). `docs/roadmap/README.md` needs no row — the epic is already listed. |
| `docs/features/` | this change package (proposal/design/tasks/evidence). |
| `.claude-plugin/plugin.json` | `version` bumped strictly above the manifest on `main` at implementation start (`0.9.0` at plan time). |
| `governance/` | **none.** No validator, no flow step, no test, no ledger change — the load-bearing non-goal. |
| `docs/decisions/` | **none.** No new ADR, no supersession. |

## Dependencies

- **None blocking.** No spike, no upstream change, no unresolved decision. `recordBenchManifest`/`recordBench`/`check-bench.js` all exist and are shipped; the example's exact invocation was executed and verified at plan time (see [design.md](design.md) §2, reproduced in [evidence.md](evidence.md) at implementation).
- **The rejected larger scope is blocked, and that is why it is a debit, not a task here.** A genuinely mechanical pre-write needs a `runs` step, and a `runs` step can only derive the role set from `{domain, type, flags}`. Two of the six roles have *heuristic* triggers over the diff (`security`: touches auth / sensitive data / credential / crypto; `architecture`: creates a module or crosses a layer boundary — [skills/review/SKILL.md](../../../skills/review/SKILL.md):71-72). A mechanical manifest is therefore **incomplete by construction**, and topping it up after dispatch collides with `manifest-duplicate` ([check-bench.js](../../../governance/validators/check-bench.js):114-116). Resolving that is an architecture decision beyond this feature line.

## Acceptance criteria

Minted at the brainstorm gate; ids are the correlation key consumed by [governance/acceptance/parse-criteria.js](../../../governance/acceptance/parse-criteria.js) (which reads `.aidakit/tasks/review-usage-bench-manifest/brainstorm.json` first — this section mirrors it verbatim and must stay identical).

- `usage-review-command-mentions-manifest` — The Usage block of commands/review.md explicitly states the __manifest__ requirement (write it via recordBenchManifest BEFORE the parallel fan-out) and links to step 5 of skills/review/SKILL.md — a reader who only opens the command already learns the requirement exists, without needing to open the skill.
- `skill-review-gets-copypaste-example` — Step 5 of skills/review/SKILL.md gains a minimal copy-paste example (manifest -> parallel Agent calls -> recordBench per role with dispatched_at/returned_at), citing governance/ledgers/ledger.js and governance/validators/check-bench.js as the mechanical source of truth. It lives there only — single source.
- `consequence-of-skipping-is-named` — Both documentation points (the command's Usage and the skill's step 5) explicitly describe the CONSEQUENCE of skipping the manifest: check_review_bench back-edges the flow and forces a full extra bench round — the why-it-matters, not just the what-to-do.
- `no-mechanical-write-this-change` — This change does NOT implement 'the skill writes the manifest itself' as a deterministic mechanism: it touches no code under governance/ and adds no flow step. The change is purely documentational.
- `mechanical-writer-registered-as-debit` — The larger-scope option (a deterministic `runs` pre-write of the bench manifest, which requires resolving the manifest-duplicate conflict and likely its own ADR) is registered as a SEPARATE change in docs/roadmap/epics/EPIC-kit-discipline-hardening.md, with an acceptance sub-bullet naming the manifest-duplicate contract conflict as the crux.

## Exit criteria

Validator commands and mechanical gates; outputs recorded in [evidence.md](evidence.md).

- `node governance/validators/check-links.js .` → exit 0 (no new broken link; the pre-implementation baseline captured in Task 1 is authoritative — only NEW breaks fail this change).
- `node governance/validators/check-plugin-version.js .` → exit 0 with the bumped manifest (`main` was `0.9.0` at plan time — **re-read, do not assume**).
- `node governance/validators/derive-roadmap-status.js --root .` → exit 0; `review-usage-bench-manifest` derives `in-progress`, `review-bench-manifest-mechanical-writer` derives `backlog`.
- The example in step 5 is **executed verbatim** against a throwaway change-id under an `AIDAKIT_PROJECT_ROOT` scratch dir, and `check-bench.js … --bench review --outcome consensus` on the resulting ndjson → **exit 0**. A copy-paste example that does not run is a regression, not a doc.
- `git diff --stat` shows **zero** files under `governance/` and **zero** under `docs/decisions/` (mechanical proof of `no-mechanical-write-this-change`).
- The full governance suite (`governance/__tests__/*.test.mjs`) stays green — expected trivially, since no code changes; run it as the regression floor anyway.

## Unblocks

- **`review-bench-manifest-mechanical-writer`** (registered by this change as a debit on [EPIC-kit-discipline-hardening](../../roadmap/epics/EPIC-kit-discipline-hardening.md)): a deterministic `runs` pre-write of the bench manifest. Its crux — and its acceptance sub-bullet — is the `manifest-duplicate` contract conflict: a mechanically pre-written manifest can only carry the flag-derivable roles, so either the round's heuristic roles are lost or the one-manifest-per-round invariant must change, and that invariant is what makes the manifest anti-tamper. Likely needs its own ADR, mirroring [ADR-010](../../decisions/ADR-010-acceptance-leash.md)'s pattern (dedicated writer + validator, not relocated prose).
- The same doc surgery applied to [skills/implement/SKILL.md](../../../skills/implement/SKILL.md)'s `bench: "implement"` fan-out becomes a one-line follow-up once the shape here is proven; not registered by this change (the epic's feature line does not name it, and registering it would be scope the owner did not ask for — flagged here, not acted on).

## Recorded decisions and inherited open decisions

Read the [decisions index](../../decisions/README.md) and every ADR whose subject this change touches:

- [ADR-005](../../decisions/ADR-005-command-namespacing.md) (command namespacing) — **constrains the command edit.** `commands/review.md` is a *single-shot utility*, and its `## Usage` block must keep naming expected inputs + at least one copy-paste invocation example on empty/malformed `$ARGUMENTS`. The manifest line is added **inside** that contract, not in place of it.
- [ADR-002](../../decisions/ADR-002-roadmap-status-derived-from-disk.md) + [ADR-007](../../decisions/ADR-007-roadmap-status-from-shared-git.md) (roadmap status derived from disk / shared git) — **constrain the debit task.** The epic file declares intent only (feature line + acceptance sub-bullet, **never** a status field); `ROADMAP.md` is regenerated, never hand-edited. ADR-007 additionally explains why the plan must be **committed** for `in-progress` to be single-valued across worktrees.
- [ADR-010](../../decisions/ADR-010-acceptance-leash.md) (acceptance leash) — **constrains this proposal's own shape.** `## Acceptance criteria` (observable-effect promises, `- \`criterion-id\` — prose`) and `## Exit criteria` (validator commands) are separate sections and do not merge; `parse-criteria.js` reads `brainstorm.json` first, so the ids above are reproduced verbatim.
- [ADR-004](../../decisions/ADR-004-aidakit-governance-env-contract.md) + [ADR-012](../../decisions/ADR-012-aidakit-governance-session-wide.md) (`AIDAKIT_GOVERNANCE`) — **constrain the example's import path.** The copy-paste snippet resolves the ledger as `"$AIDAKIT_GOVERNANCE/ledgers/ledger.js"`, never a relative path, because the skill runs with `cwd` = the consumer repo, not the kit; ADR-012 is what makes the var present in a plain Bash tool call (not only in `runs`-step children).
- [ADR-011](../../decisions/ADR-011-runs-infra-error-routing.md) (`runs` infra-error routing) — **calibrates the consequence wording.** The back-edge documented here is the *verdict* path (`check-bench.js` exit 1 → `on_failure: review_bench`). An infra error (exit 127/126/signal) would hard-stop the flow instead, bypassing `on_failure` entirely — so the doc says "exit 1 / leash violation", never "any non-zero exit".
- [ADR-001](../../decisions/ADR-001-executable-dna-crystallization.md) (DNA crystallization) — **explains why this is prose and not a gate.** The learning did not reach the objective `deriveCandidates(threshold: 3)` trigger (`EPIC-kit-discipline-hardening` records the empty return), so it does not qualify for crystallization; the epic's own non-goal says the same.
- [ADR-003](../../decisions/ADR-003-shared-knowledge-in-docs.md) (knowledge in `docs/knowledge/`) — **read and deliberately not applied.** See [design.md](design.md) §5 for why the instruction belongs at the point of use rather than in a knowledge file (which this repo does not even have yet).
- [ADR-013](../../decisions/ADR-013-context-pack-per-change.md) (context pack per change) — read; it governs `skills/review/SKILL.md`'s Prerequisites section (line 29), which this change does **not** touch. No interaction.
- [ADR-006](../../decisions/ADR-006-flow-values-as-data.md), [ADR-008](../../decisions/ADR-008-opt-in-autonomous-pr-merge.md), [ADR-009](../../decisions/ADR-009-flow-commits-plan-early.md) — read; no constraint on a doc-only edit of the review surface.
- **No new decision is locked** and **no ADR is contradicted** → no escalation under [GOVERNANCE.md](../../../GOVERNANCE.md) §1.
- **No open-decisions log** exists in this repo; nothing inherited. The one escalation raised during the brainstorm (the epic's PREFERRED option not being structurally achievable) was **resolved by the owner** at the brainstorm gate and is discharged by the `mechanical-writer-registered-as-debit` criterion.
