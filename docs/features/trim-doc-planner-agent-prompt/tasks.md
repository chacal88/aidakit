# Tasks — trim-doc-planner-agent-prompt

**Change ID:** `trim-doc-planner-agent-prompt`
**Date:** `2026-07-25`
**Owner:** `@chacal88`
**Phase / Package:** `n/a (agents/doc-planner.md prompt-body trim + docs/features/workflow-script-optimization/dispatch-cost.md re-measure — no mechanical surface)`
**PRD:** `n/a`
**Tech Spec:** `n/a`

> Prose-only change. **Write no code**: no validator, no test, no engine/YAML/schema/hook edit ([proposal.md](proposal.md) non-goal 2). If any task seems to require one, STOP and escalate ([GOVERNANCE.md §1](../../../GOVERNANCE.md), escalation 3) — do not widen scope in silence.
> Order matters: §1 baselines and §2 trims BEFORE §3 re-measures (the cascade needs the trimmed byte count). Every number written into a file must come from an actual `wc`/`node` run on the tree — no recalled or estimated figures.

## 1. Setup — baseline before touching anything (GOVERNANCE.md §8)

- [x] Confirm the worktree is clean and capture `git rev-parse HEAD`, `git log --oneline -1 origin/main`, and `git merge-base HEAD origin/main` into [evidence.md](evidence.md) as the baseline.
- [x] **Baseline the byte count:** `wc -c -w agents/doc-planner.md` → expect `2198 15105` (the FROM baseline; matches [`dispatch-cost.md`](../workflow-script-optimization/dispatch-cost.md) line 27). Record verbatim. If it is NOT `2198/15105`, a sibling PR changed the file on the tree — STOP and reconcile against the drifted baseline before trimming.
- [x] **Baseline the suite BEFORE any edit:** `for f in governance/__tests__/*.test.mjs; do echo "== $f"; node "$f" 2>&1 | tail -1; done` → record the per-file tail in [evidence.md](evidence.md). Any file already red at baseline is a pre-existing condition to NAME, not to fix here (the `context-pack.test.mjs` merge-base caveat is the known candidate — record its actual state, do not recall it).
- [x] **Baseline the three cascade gates individually** (each must be green now, and again after the edits): `node governance/__tests__/regression-measured-body-size-tables-match-live-tree.test.mjs`, `node governance/__tests__/agent-validator-paths.test.mjs`, `node governance/__tests__/check-docs.test.mjs` → all `0 failed`. Record.
- [x] Read `agents/doc-planner.md` in FULL and re-locate every frozen leash region ([design.md](design.md) §"The leash") and every redundancy row ([design.md](design.md) §"Where the redundancy lives") against the LIVE line numbers — the plan-time anchors may have drifted. Anchor edits on surrounding text, not on numbers.

## 2. Surface Work — agents/doc-planner.md (the trim)

- [x] **Compress "you write the LIST, not the docs."** State it authoritatively once in the `## Protocol` intro; reduce the blockquote to a short clause and the `## What you do NOT do` bullet to a pointer. No change to *what* the agent produces.
- [x] **Compress the "`n/a` needs a `condition`" echoes.** KEEP the Step 3 `status`/`condition` field definitions VERBATIM (frozen invariant #2). Reduce the restatements in Step 2, Step 4, `## What you decide on your own`, and `## What you do NOT do` to one-line pointers back to Step 3. Do NOT delete the Step 3 statement.
- [x] **Compress the escalation duplication.** Keep the role-specific triggers in `## Escalation triggers` (the concrete conditions: missing/contradictory classification, undeterminable mode, change-id collision, waive-an-inviolable-doc, ADR-path conflict). Drop the generic "GOVERNANCE.md §1 defines exactly three actions…" framing the caller already loads, and collapse the "don't ship (esc. 1)" / "don't supersede an ADR (esc. 2)" points so each appears once (in `## Escalation triggers`), leaving pointers (or nothing) in `## What you do NOT do`.
- [x] **Trim long parentheticals and the `## Role` paragraph** to one crisp sentence naming what the agent authors (the doc-manifest = the doc-leash list). The judgment stays; the verbosity shrinks.
- [x] **FREEZE — do not touch:** the Step 3 item schema JSON + field definitions + manifest envelope; the `status` (`pendente`\|`resolvido`\|`n/a`) and `kind` (`adr`\|`doc`\|`index`) enums; the two manifest paths (`.aidakit/tasks/<change-id>/doc-manifest.json`, `.aidakit/doc-manifest-project.json`); the Step-4 language note about which tokens stay fixed; and the **entire Output-format step-5 next-step sentence** carrying the guard literal `: \"${AIDAKIT_GOVERNANCE?agent-validator-paths: AIDAKIT_GOVERNANCE not set — SessionStart hook missing (see docs/guides/flows.md §6)}\"` (byte-identical; it occurs exactly once — [`agent-validator-paths.test.mjs`](../../../governance/__tests__/agent-validator-paths.test.mjs) will fail if it is edited or removed).
- [x] **Preserve the six GOVERNANCE §7 sections in order** (`Role` · `Protocol` · `What you decide on your own` · `Escalation triggers` · `What you do NOT do` · `Output format`) — compress within, remove none. **Leave the frontmatter `description:` intact** ([design.md](design.md) §"Where the redundancy lives" — routing surface, out of scope).
- [x] Append ONE provenance footer at the tail, below the existing `v0.9` line (append, never rewrite — precedent [`GOVERNANCE.md:58-59`](../../../GOVERNANCE.md)): `<!-- aidakit vX.Y — body-prose trim (dedupe LIST/n-a/escalation restatements, drop parentheticals; leash regions frozen), trim-doc-planner-agent-prompt, 2026-07-25 -->` (pick the next version in sequence).

## 3. Surface Work — docs/features/workflow-script-optimization/dispatch-cost.md (the cascade)

- [x] **Re-measure the trimmed file:** `wc -c -w agents/doc-planner.md` AND the gate's own method `node -e 'const c=require("fs").readFileSync("agents/doc-planner.md","utf8");console.log(Buffer.byteLength(c), c.split(/\s+/).filter(Boolean).length)'` — the two must agree. Call the result `W` words / `B` bytes. Record both commands + outputs in [evidence.md](evidence.md).
- [x] **Line 27 (gate-enforced fenced row):** replace `    2198   15105 agents/doc-planner.md` with the new `    <W>   <B> agents/doc-planner.md` (preserve column alignment).
- [x] **Line 37 (`total` row):** recompute from the whole §1 block — new total words `= 20837 − 2198 + W`, new total bytes `= 140150 − 15105 + B`. Verify by summing the 13 rows, not by trusting the arithmetic blindly.
- [x] **Line 52 (§2 ranking cell):** replace `**45315** (15105 × 3; …)` with `**<B×3>** (<B> × 3; …)`, extending the historical parenthetical to record the chain — `was 45315 (15105×3) before trim-doc-planner-agent-prompt; was 44256 before the … drift note above` — **preserving the 44256 / PR-#54 history verbatim**.
- [x] **Line 68 (§2 "Reading the extremes" prose):** reconcile the live figures to `B` / `B×3` and the recomputed gap-to-`reviewer-quality` (13470) and ratio-to-26940; **preserve the historical sentence** about the PR-#54 re-measurement (44256→45315, "no other agent's position changes") as the record of that earlier event.
- [x] **Reconcile the "largest single agent file" superlative with the measured `B`:** if `B ≥ 13470`, `doc-planner` is still the largest file — keep the framing; if `B < 13470`, reword it (`reviewer-quality`'s 13470 becomes the largest file) while stating that the *ranking* stays 1, driven by the 3× reuse not body size. Decide from the measurement, record which case held in [evidence.md](evidence.md).
- [x] **Add a new dated trim note to §1** (mirror the line-40 drift note's shape; do NOT rewrite line 40): record `agents/doc-planner.md` reduced from `2198/15105` to `W/B` (−`2198−W` words / −`15105−B` bytes) by removing redundant prose, the fenced row/total/§2 cell/prose re-measured in the same commit, `doc-planner` remains rank 1 (`B×3` > 26940).
- [x] **Do NOT touch any other row** (the 12 other agent rows, the 14 skill table rows) — their files are unchanged and the DNA gate checks them against the live tree. Do NOT touch `evidence.md`/`design.md`/`proposal.md`/`inventory.md` of `workflow-script-optimization` (proposal non-goal 6).

## 4. Documentation

- [x] No other doc change is required. Roadmap status derives from disk ([ADR-002](../../decisions/ADR-002-roadmap-status-derived-from-disk.md)/[ADR-007](../../decisions/ADR-007-roadmap-status-from-shared-git.md)); the [EPIC](../../roadmap/epics/EPIC-context-caching.md) `15105`/`45315` figure is the FROM baseline — leave it. `docs/decisions/README.md`, `docs/INDEX.md`, `docs/guides/`, `README.md` — none describes the doc-planner's body prose, so none needs an edit. If the implementer finds one that does, edit it and say so in [evidence.md](evidence.md) §Unresolved Deviations.
- [x] Fill [evidence.md](evidence.md) §Files Touched.

## 5. Validation

- [x] **`bytes-reduced-measured`** — paste the before (`2198/15105`) and after (`W/B`) `wc -c -w` outputs into [evidence.md](evidence.md); confirm `B < 15105`.
- [x] **`no-judgment-instruction-removed`** — quote each frozen leash survivor from the trimmed file into [evidence.md](evidence.md): the Step 3 schema + envelope, the `n/a`-condition rule, the two enums, the two manifest paths, the decision-authority statements, the six section headers in order. A reviewer verifies survival without re-reading the diff.
- [x] **`guard-literal-survives-verbatim`** — `grep -c 'AIDAKIT_GOVERNANCE?agent-validator-paths' agents/doc-planner.md` → `1`; `node governance/__tests__/agent-validator-paths.test.mjs` → `0 failed`. Record both.
- [x] **`doc-manifest-contract-intact`** — build a fixture `doc-manifest.json` from the trimmed Step 3 block (one well-formed `pendente` item pointing at an existing file; one `n/a` item WITHOUT a `condition`) and run, with `AIDAKIT_PROJECT_ROOT` set to the worktree: `node governance/validators/check-doc-manifest.js <fixture>` on the well-formed variant → exit 0, and on the `n/a`-without-condition variant → exit 2 (`manifest-invalid`). Also `node governance/__tests__/check-docs.test.mjs` → `0 failed`. Paste outputs (the fixture is a throwaway under the scratchpad/`/tmp`, NOT committed).
- [x] **`dna-gate-green-after-remeasure`** — `node governance/__tests__/regression-measured-body-size-tables-match-live-tree.test.mjs` → `0 failed` (`27 measured rows checked`). If it flags a NON-`doc-planner` row, a sibling PR drifted the tree from the table under a rebase — STOP and reconcile per the concurrent-worktree discipline; do NOT silently rewrite another change's measured rows beyond what the live tree forces.
- [x] **`ranking-order-preserved`** — record the arithmetic in [evidence.md](evidence.md): `B × 3 = <…>` and `< 26940`? must be `>`; also `> 26308`. State which "largest single agent file" case held (`B` vs 13470).
- [x] **Full suite** — `for f in governance/__tests__/*.test.mjs; do echo "== $f"; node "$f" 2>&1 | tail -1; done` → every file `0 failed`, identical to the §1 baseline except no new red. Call out `engine.test.mjs` (would notice any engine regression — there is none) and the three cascade gates explicitly.
- [x] **Links** — `node governance/validators/check-links.js docs/features/trim-doc-planner-agent-prompt agents/doc-planner.md docs/features/workflow-script-optimization/dispatch-cost.md` → exit 0.
- [x] **Scope** — `git diff --stat` paired with `git status --porcelain`: exactly `agents/doc-planner.md`, `docs/features/workflow-script-optimization/dispatch-cost.md`, plus this change directory. No `.js`/`.mjs`/`.yaml`, no `governance/**`, no history file rewritten. `git diff --exit-code $(git merge-base HEAD origin/main) -- governance/` → exit 0.

## 6. Cleanup

- [x] [evidence.md](evidence.md) §Unresolved Deviations filled (or explicitly "None").
- [x] No stray files outside the declared scope; the throwaway fixture manifest is deleted; no `.aidakit/` artifact committed (gitignored).
- [x] Do NOT bump `.claude-plugin/plugin.json` — [ADR-016](../../decisions/ADR-016-runtime-change-requires-plugin-bump.md)/`check-runtime-bump` fires only on `hooks/` or `governance/` runtime changes; this change touches neither. (If the implementer's diff somehow touches `governance/`, that is out of scope — STOP.)
- [x] Do NOT author an ADR (none introduced, none superseded — [proposal.md](proposal.md) non-goal 3). Do NOT add a validator or test.
- [x] Do NOT commit here — the flow's `commit_plan` / ship steps own that; the PR merge is the human's ([GOVERNANCE.md §1](../../../GOVERNANCE.md), and this repo's `pr.auto_merge` carve-out per [ADR-008](../../decisions/ADR-008-opt-in-autonomous-pr-merge.md) is the ship step's business, not the planner's).
