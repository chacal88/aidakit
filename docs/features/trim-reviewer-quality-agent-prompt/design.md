# Design — trim-reviewer-quality-agent-prompt

**Change ID:** `trim-reviewer-quality-agent-prompt`
**Date:** `2026-07-27`
**Owner:** `@chacal88`
**Phase / Package:** `n/a (agents/reviewer-quality.md prompt-body trim + docs/features/workflow-script-optimization/dispatch-cost.md re-measure — no mechanical surface)`
**PRD:** `n/a`
**Tech Spec:** `n/a`

> Scoped to the executable package: two files. `agents/reviewer-quality.md` (the trim) and [`docs/features/workflow-script-optimization/dispatch-cost.md`](../workflow-script-optimization/dispatch-cost.md) (the mandatory cascade). Line anchors below were captured at plan time and may drift under a rebase — anchor edits on surrounding text, not on the numbers ([GOVERNANCE.md §8](../../../GOVERNANCE.md)).
>
> **Precedence:** if this design diverges from the frozen contract in §"The leash", the contract wins and this file is corrected. A byte saved by weakening the leash is refused.

## The change in one line

Compress the 3–4× redundant restatements and long parentheticals in `agents/reviewer-quality.md`'s body so the same doctrine is stated **once, authoritatively**, then re-measure and update the gate-tracked live rows (and the rank-dependent §2 cells/order/prose) in `dispatch-cost.md`. Nothing the structured verdict contract emits changes.

## The leash (what MUST survive the trim, byte-for-byte in meaning)

These are the elements the acceptance leash, the frozen contract handed by the flow, and the mechanical gates protect. A candidate trim that touches any of them is dropped.

1. **The 4 review phases, in order.** `### Phase 1 — Context` → `### Phase 2 — Architecture` → `### Phase 3 — Line-by-line` → `### Phase 4 — Summary & verdict`. Each phase's judgment-bearing checks stay (task×reality fidelity, layer-rule confrontation, correctness/edges/security/reuse per file, acceptance-with-real-output). Compress the rhetorical parentheticals *inside* a phase; never drop a phase or a judgment step. FREEZE the four headers and their check content.
2. **The 4 severities.** The `## Severities` table defines `[blocking]` / `[important]` / `[nit]` / `[praise]` with their Meaning and Effect. All four rows FREEZE. The clarifying note that `suggestion`/`learning` are not severities of their own (a merit-suggestion is `[nit]`) is judgment-bearing classification — keep it (may tighten prose, do not drop the rule).
3. **The verdict vocabulary and rules.** `## Output format` emits **exactly one verdict per round** with the trailing `verdict: approved | rejected`, `Status: APPROVED | NEEDS-REVISION | BLOCKED`, `Ready to merge: yes | no`, and the machine-parseable verdict rules (`1+ open [blocking] → rejected`; `open [important] without fix/contest → rejected`; `only [nit]/[praise] → approved`; the three trailing lines mandatory in every verdict; `approved` with an open blocker forbidden). This is what [`check-bench.js`](../../../governance/validators/check-bench.js) consumes at runtime (its `PASS_ALIASES`/`FAIL_ALIASES` read `approved`/`rejected`). FREEZE the verdict vocabulary, the trailing-line shape, and the rules.
4. **`file:line` on every finding.** The instruction that every finding carries a `file:line` + severity, and the Findings template lines each showing `<file:line>`. FREEZE the rule and the template shape.
5. **The Step 0.5 context-pack block (mechanically tested).** [`context-pack.test.mjs`](../../../governance/__tests__/context-pack.test.mjs) §6 (`DISPATCHER_FILES`, `agents/reviewer-quality.md`) asserts the file: (a) matches `/context pack/i` **and** `/\.context-pack\.md/`; (b) matches the fallback-when-absent regex `/fall.?back.*raw|absent.*proposal|pack.*absent/is` (today satisfied by "**If the pack is absent**, fall back to reading `proposal.md`/`design.md`/`tasks.md`…"); (c) does **not** match `/check-context-pack-freshness/`. This is reviewer-quality's analog of doc-planner's guard literal — a body region a `.test.mjs` parses. FREEZE the Step 0.5 block: keep the "context pack"/`.context-pack.md` mentions, the fallback clause, and the [ADR-004](../../decisions/ADR-004-aidakit-governance-env-contract.md)/[ADR-013](../../decisions/ADR-013-context-pack-per-change.md) links; do not introduce the string `check-context-pack-freshness`.
6. **The adversarial judgment and the decision authority.** The agent still: refutes rather than confirms; treats a bare `LGTM`/generic approval as an INVALID verdict; withdraws a finding refuted by evidence and holds one that evidence does not close; decides each finding's severity and the round's final verdict; delegates deep security to the security role; reports, does not fix. The *judgment* stays; only the verbosity around it compresses.
7. **The GOVERNANCE §7 anatomy.** The six sections — `Role` · `Protocol` (with Step 0.5 + Phases 1–4) · `What you decide on your own` · `Escalation triggers` · `What you do NOT do` · `Output format` — survive in order, plus the two extra sections `## Severities` and `## ADVERSARIAL posture`. Compress *within* a section; remove none.

## Where the redundancy lives (the compressible surface)

The same handful of points recur across the body; each is stated authoritatively once and de-duplicated elsewhere. Anchored to the plan-time line numbers of `agents/reviewer-quality.md`:

| Redundant point | Occurs at (plan-time) | Keep the authoritative statement at | Compress the rest to |
|---|---|---|---|
| "Report, don't fix" | description (frontmatter); blockquote L10; `## Role` L14; `## What you do NOT do` L100 | `## What you do NOT do` (L100) — the operational rule | a short clause in the blockquote; drop the echo from `## Role` |
| "4 phases: context → architecture → line-by-line → summary" | description; blockquote L10; `## Role` L14; `## Protocol` intro L22 | the phase headers themselves (§Protocol, FROZEN) | name the sequence once (Protocol intro); drop the parenthetical re-listing from Role/blockquote |
| "every finding carries `file:line` + severity" | `## Role` L14; `## ADVERSARIAL posture` L77; Phase 4 L55; Output format L118-121 | Output format template (L118-121) + Phase 4 (L55) | a pointer in Role/ADVERSARIAL; drop the standalone restatement |
| "`LGTM`/generic approval is INVALID" | `## ADVERSARIAL posture` L74; Output format Summary L130; verdict rules L143 | Output format verdict rules (L143) — **frozen** | a short clause in ADVERSARIAL; keep the Output-format statement |
| "push-back only with technical evidence, both ways / a finding refuted by evidence falls" | `## ADVERSARIAL posture` L75; `## What you decide on your own` L85 | `## What you decide on your own` (L85) — the decision authority | fold ADVERSARIAL's restatement into one clause |
| "reuse before new code (duplication is `[important]`)" | Phase 3 L47; `## ADVERSARIAL posture` L76 | Phase 3 line-by-line (L47) — the operational check | compress the ADVERSARIAL restatement to a pointer |
| Escalation prose re-explaining GOVERNANCE §1 | `## Escalation triggers` L90 framing; L96 "escalation 1 never reaches you"; `## What you do NOT do` L101 | the role-specific triggers L92-94 (the *specific* conditions: supersede-a-locked-decision, leaving-scope, deadlock-over-disjoint-evidence) | drop the generic "they mirror GOVERNANCE.md §1 (3 escalations)" framing the caller already loads; collapse "don't approve/merge (esc. 1)" to appear once |
| "don't emit `approved` with an open `[blocking]`" | `## What you do NOT do` L102; Output format L142; verdict rules L139 | Output format verdict rules (L139-142) — **frozen** | drop the `## What you do NOT do` echo or reduce to a pointer |
| Long parenthetical asides | throughout (e.g. L22, L28, L29, L57) | the load-bearing clause | trim the parenthetical to its essential token or drop |

**`## Role` (L12-14)** restates the blockquote and the description almost verbatim; GOVERNANCE §7 asks for "Role (one sentence)". Reduce to one crisp sentence naming what the agent does (refute the diff with `file:line`+severity findings across the 4 phases, one `approved`/`rejected` verdict per round, report don't fix) — the judgment is unchanged, the paragraph shrinks.

**`## ADVERSARIAL posture` (L71-77)** is the densest redundancy: nearly every bullet restates a point already authoritative elsewhere (LGTM-invalid → Output format; finding-falls-with-evidence → What you decide; reuse → Phase 3; file:line+severity → Output format template). Compress it to the *unique* adversarial judgment ("refute, don't confirm — 'looks good' is not analysis") plus pointers; do not delete a judgment that lives *only* here (verify each bullet has an authoritative home before compressing it away).

**Frontmatter `description:` (L3)** is a *routing* surface (the caller/orchestrator reads it to select the agent), so it is judgment-adjacent, not pure body redundancy. Treat it as **out of primary scope**: leave it intact. The measured ranking counts `wc -c` of the whole file, so frontmatter savings would still count — but the risk of degrading agent selection outweighs the marginal bytes. Default: untouched (see §Alternatives).

## The cascade (mechanically forced by the DNA gate)

The [`regression-measured-body-size-tables-match-live-tree`](../../../governance/__tests__/regression-measured-body-size-tables-match-live-tree.test.mjs) gate parses every fenced `wc -c -w` row (`FENCED_ROW_RE`) and every skill table row (`TABLE_ROW_RE`) in each `docs/features/*/dispatch-cost.md` and asserts `Buffer.byteLength` / whitespace-split word count equal the live file. The §2 agent ranking table rows are **not** matched by either regex (their first cell is an `aidakit:`-prefixed agent name, not an `agents/…​.md` path), so §2 is NOT gate-enforced — but it is internal analysis that must stay consistent with the measured row. Trimming `reviewer-quality.md` stales the row at line 33 and FAILS the gate until updated.

Let `W`/`B` = the measured new words/bytes of the trimmed `agents/reviewer-quality.md` (from `wc -c -w`, cross-checked with the gate's own method: `node -e 'const c=require("fs").readFileSync("agents/reviewer-quality.md","utf8");console.log(Buffer.byteLength(c), c.split(/\s+/).filter(Boolean).length)'`). Updates to [`dispatch-cost.md`](../workflow-script-optimization/dispatch-cost.md):

| Location | Current (plan-time) | New | Invariant class |
|---|---|---|---|
| §1 fenced row, line 33 | `    1993   13470 agents/reviewer-quality.md` | `    <W>   <B> agents/reviewer-quality.md` | **gate-enforced** (must equal live tree) |
| §1 total, line 37 | `   20601  138899 total` | `   <20601−1993+W>  <138899−13470+B> total` | internal sum (recompute from the whole block, don't hand-arith blindly) |
| §2 ranking cell, line 55 | `**26940**` | `**<B×2>** (<B> × 2; was 26940 (13470×2) before trim-reviewer-quality-agent-prompt)` | internal consistency w/ line 33 |
| §2 table row order | reviewer-quality at row 2 (rank 2) | move the reviewer-quality row to its correct descending-rank slot; leapfrogged rows shift up | internal consistency (the `Ranking` column must stay monotonically non-increasing) |
| §2 "Reading the extremes", line 70 | `reviewer-quality`'s `13470` is "the next largest", `~2.9% gap`; doc-planner "ranking gap to reviewer-quality (41562 vs 26940, ~1.5×)" | reconcile the next-largest-file claim + gap to measured `B`; reconcile doc-planner's ranking gap to the NEW rank-2 agent | internal consistency (see §"The rank-order reconciliation") |

**New dated trim note in §1** (mirror the line-42 doc-planner trim note's shape, do not rewrite lines 40 or 42): record that `trim-reviewer-quality-agent-prompt` reduced `agents/reviewer-quality.md` from `1993 words / 13470 bytes` to `<W> / <B>` (−`<1993−W>` words / −`<13470−B>` bytes) by removing redundant prose (the Role/ADVERSARIAL/LGTM/file:line/escalation restatements) with the frozen contract (4 phases, 4 severities, verdict `approved`|`rejected`, `file:line` on findings) and the Step 0.5 context-pack block byte-preserved; the fenced row, total, §2 ranking cell were re-measured and the §2 table re-sorted in the same commit; reviewer-quality's rank moved from 2 to `<new rank>` (`<B×2>`), no other agent's ranking VALUE changes.

## The rank-order reconciliation (the delicate part — unlike the doc-planner precedent)

reviewer-quality sits in a **tight cluster**. Its `Σ happy-path` is `2`, so every byte trimmed lowers its ranking by 2. The neighbours (unchanged this change):

| Agent | bytes | Σ | ranking |
|---|---|---|---|
| `reviewer-quality` (this change) | 13470 → `B` | 2 | 26940 → `B×2` |
| `reviewer-architecture` | 13154 | 2 | 26308 |
| `planner` | 12766 | 2 | 25532 |
| `tester` | 12676 | 2 | 25352 |
| `orchestrator` | 12564 | 2 | 25128 |
| `implementer` | (11532) | ≥2 | ≥23064 |
| `spec-reviewer` | 12676-ish | 3 | 22719 |

There is only **316 bytes of headroom** before reviewer-quality falls below `reviewer-architecture` (`B×2 > 26308` ⟺ `B > 13154`). A same-scale trim as the sibling (`doc-planner` lost 1251 bytes) would put `B ≈ 12200`, dropping reviewer-quality **below the whole 26308…25128 cluster** to roughly rank 7. This is expected and honest — the implementer does NOT protect a rank:

1. Measure `B`, compute `R = B × 2`.
2. Insert `R` into the sorted list of the other 12 (unchanged) ranking cells; find reviewer-quality's new slot.
3. **Move the reviewer-quality table row** to that slot (the leapfrogged rows shift up by one position). **No other cell value changes** — only reviewer-quality's ranking cell value and its row position.
4. Assert the `Ranking` column is monotonically non-increasing top-to-bottom (`ranking-recomputed-and-resorted`).

Because `reviewer-architecture` also has `Σ = 2`, the threshold for "reviewer-quality is still the second-largest *file*" (`B > 13154`) and "reviewer-quality is still rank 2" (`B×2 > 26308` ⟺ `B > 13154`) coincide. So line 70's two claims flip together:

- **If `B ≥ 13154`:** reviewer-quality stays the second-largest agent file and rank 2. Recompute the gap to `doc-planner`'s 13854 (was `~2.9%` at 13470) and the `41562 vs B×2` ratio; keep the framing.
- **If `B < 13154`:** `reviewer-architecture` (13154) becomes the second-largest agent file and the new rank 2. Reword line 70's "the next largest single agent file (`reviewer-quality`'s 13470)" to name `reviewer-architecture`, and reword doc-planner's "ranking gap to reviewer-quality (41562 vs 26940)" to "ranking gap to `reviewer-architecture` (41562 vs 26308)". The measurement decides; record which case held in [evidence.md](evidence.md). This is the measure-don't-recall discipline applied to prose.

## The version leash (no bump expected — verified)

[`check-plugin-version.js`](../../../governance/validators/check-plugin-version.js) enforces `manifest.version >= max(doctrine footers)` (the manifest may be ahead, never behind). The current highest footer across the plugin is `v0.10` (on `agents/doc-planner.md`, from the merged sibling) and the manifest is `0.10.0`. The footer this change appends to `reviewer-quality.md` is its next monotonic `v0.4` (the file's current footer is `v0.3`), which does **not** raise the plugin-wide maximum. So `check-plugin-version.js .` stays exit 0 with the manifest untouched. This is the concrete DIFFERENCE from the sibling, whose file-local footer chain (`v0.9 → v0.10`) *did* overtake the manifest and forced `0.9.2 → 0.10.0`. `check-plugin-version` is a **CI validator, not one of the `*.test.mjs`** files, so the implementer runs it explicitly; a red exit here is escalated, never fixed with a silent bump ([ADR-016](../../decisions/ADR-016-runtime-change-requires-plugin-bump.md) is orthogonal — no runtime file changes, `check-runtime-bump` stays green).

## Verifying the contract survived (without running the LLM agent)

The agent's verdict-emitting behavior can't be unit-tested deterministically, but the *contract it teaches* is verified two ways:

- **Static greps for the frozen tokens** (acceptance `frozen-contract-intact`): the four phase headers in order; the four severity rows; `verdict: approved | rejected` + the three trailing lines + the verdict rules; `file:line` occurrences. All recorded in [evidence.md](evidence.md).
- **The Step 0.5 mechanical gate** ([`context-pack.test.mjs`](../../../governance/__tests__/context-pack.test.mjs) §6): pins the context-pack block from the test side; must stay `0 failed`.
- **The runtime consumer** ([`check-bench.js`](../../../governance/validators/check-bench.js)) reads `approved`/`rejected` from a *runtime* verdict, not from this prompt file, so it cannot regress from a prose trim — but the prompt is the source that teaches the agent to emit that vocabulary, so the vocabulary is frozen (leash item 3). [`check-bench.test.mjs`](../../../governance/__tests__/check-bench.test.mjs) staying `0 failed` in the full suite confirms no incidental coupling broke.

## Alternatives considered

| Option | Why rejected |
|---|---|
| Trim the frontmatter `description:` for extra bytes | It is a routing surface the caller reads to select the agent — judgment-adjacent, not pure redundancy. The risk of degrading agent selection outweighs the marginal bytes. Left intact (§"Where the redundancy lives"). |
| Set a fixed byte target (e.g. "cut to 12000") | Would invite trimming to hit a number rather than trimming only redundancy. Acceptance is "fewer than 13470 with no judgment removed"; the number is *measured*, never targeted (proposal non-goal 6). |
| Protect reviewer-quality's rank 2 by trimming conservatively | The ranking is a *measured* artifact, not a goal to defend. Trimming only enough to stay rank 2 would leave redundancy on the table to preserve a number — the opposite of the leash. The trim removes all genuine redundancy and the table re-sorts honestly (§"The rank-order reconciliation"). |
| Update only the gate-enforced line 33 and skip the total / ranking / order / prose | Line 33 alone would pass the DNA gate but leave `dispatch-cost.md` internally contradictory (total ≠ sum, ranking cell ≠ `bytes×2`, table mis-sorted, prose ≠ row). Internal consistency is part of the cascade even where the gate doesn't reach. |
| Delete the `## ADVERSARIAL posture` section wholesale | It restates much that is authoritative elsewhere, but must be checked bullet-by-bullet: any judgment that lives *only* there (e.g. "refute, don't confirm — 'looks good' is not analysis") is kept. Wholesale deletion risks dropping a judgment-bearing instruction (proposal non-goal 1). |
| Rewrite the line-40 drift note / the line-42 doc-planner trim note / edit `workflow-script-optimization`'s proposal/design/evidence | Those are prior changes' historical narrative (WORM); only the live rows/cells/prose carry the current tree. Rewriting history is proposal non-goal 7. The line-42 note's snapshot "reviewer-quality's 26940" was true at the doc-planner-trim commit and stays as that record. |
| Author a mechanical guard that a prompt's contract regions are byte-stable | Over-engineering for a one-file prose edit; the existing gates (DNA, `context-pack.test.mjs` §6, `check-bench` suite) already cover the mechanical surface, and ADR-001's `≥3×` crystallization trigger has not fired for "prompt-trim broke the verdict contract". |

## Rollback

Single-commit, prose-only, reversible with `git revert`. No migration, no data, no schema. If a reviewer finds a compressed line dropped a judgment-bearing instruction, restore that line from the pre-trim `agents/reviewer-quality.md` (git history) and re-measure — the cascade update in `dispatch-cost.md` (row, total, ranking cell, order, prose) follows the new byte count mechanically. `governance/**` is untouched throughout, so no engine/validator state can be left inconsistent.

## Frozen evidence location

All validation output, before/after `wc` counts, the frozen-contract greps, the `context-pack.test.mjs` run, the rank/re-sort arithmetic, and the `check-plugin-version.js` run land in [`evidence.md`](evidence.md) — the single evidence file for this change. Nothing lands elsewhere.
</content>
