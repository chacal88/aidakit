# Design — trim-doc-planner-agent-prompt

**Change ID:** `trim-doc-planner-agent-prompt`
**Date:** `2026-07-25`
**Owner:** `@chacal88`
**Phase / Package:** `n/a (agents/doc-planner.md prompt-body trim + docs/features/workflow-script-optimization/dispatch-cost.md re-measure — no mechanical surface)`
**PRD:** `n/a`
**Tech Spec:** `n/a`

> Scoped to the executable package: two files. `agents/doc-planner.md` (the trim) and [`docs/features/workflow-script-optimization/dispatch-cost.md`](../workflow-script-optimization/dispatch-cost.md) (the mandatory cascade). Line anchors below were captured at plan time (HEAD `7cfbb1f`) and may drift under a rebase — anchor edits on surrounding text, not on the numbers ([GOVERNANCE.md §8](../../../GOVERNANCE.md)).
>
> **Precedence:** if this design diverges from the frozen invariants in §"The leash", the invariants win and this file is corrected. A byte saved by weakening the leash is refused.

## The change in one line

Compress the 3–4× redundant restatements and long parentheticals in `agents/doc-planner.md`'s body so the same doctrine is stated **once, authoritatively**, then re-measure and update the gate-tracked live rows in `dispatch-cost.md`. Nothing the manifest contains changes.

## The leash (what MUST survive the trim, byte-for-byte in meaning)

These are the elements the acceptance leash and the mechanical gates protect. A candidate trim that touches any of them is dropped.

1. **The Step 3 item schema + manifest envelope.** The fenced JSON item block (`doc`, `path`, `status`, `condition`, `kind`, `owner`) and the envelope (`change_id`, `level`, `required[]`), plus the per-field definitions that follow. [`check-doc-manifest.js`](../../../governance/validators/check-doc-manifest.js) consumes these; the prompt is the source that teaches the agent to emit them. FREEZE.
2. **The "`n/a` needs a `condition`" rule.** The validator special-cases exactly one status: `status:"n/a"` is skipped **only** when it carries a `condition`; an `n/a` without one is `manifest-invalid`, exit 2 ([`check-doc-manifest.js:59-66`](../../../governance/validators/check-doc-manifest.js), DOCS.md §6(c)). Every `pendente`/`resolvido` requires the file to exist on disk. This rule is stated in Step 3 (the `status`/`condition` field definitions) — FREEZE that statement. Its *echoes* in Step 2, Step 4, `## What you decide` and `## What you do NOT do` are the compressible surface: reduce them to pointers back to Step 3, do not delete the Step 3 statement.
3. **The enum values the validator/kit read.** `status: pendente | resolvido | n/a` and `kind: adr | doc | index`. These are identifiers (fixed regardless of prose language, per Step 4's language note). FREEZE.
4. **The two manifest paths.** `.aidakit/tasks/<change-id>/doc-manifest.json` (change) and `.aidakit/doc-manifest-project.json` (project), Step 3. FREEZE.
5. **The fail-closed guard literal.** In the Output-format **step 5** next-step sentence: `: \"${AIDAKIT_GOVERNANCE?agent-validator-paths: AIDAKIT_GOVERNANCE not set — SessionStart hook missing (see docs/guides/flows.md §6)}\"`. [`agent-validator-paths.test.mjs`](../../../governance/__tests__/agent-validator-paths.test.mjs) extracts this literal from `agents/doc-planner.md` (`GUARD_RE`, the backslash-escaped form) and asserts it byte-identical across five source files, AND asserts the file has `guards.length > 0`. Cutting or editing step 5's guard breaks the suite. FREEZE the whole step-5 next-step sentence verbatim; the guard occurs exactly once today.
6. **The decision authority (invariant #3).** The agent still: decides mandatory-vs-waivable (`pendente` vs `n/a`+condition); derives every path/rule from DOCS.md; assembles the project manifest when a project identity is present; honours the 3 escalations ([GOVERNANCE.md §1](../../../GOVERNANCE.md)). The *judgment* stays; only the verbosity around it compresses.
7. **The GOVERNANCE §7 anatomy.** The six sections — `Role` · `Protocol` (with Steps 0–4) · `What you decide on your own` · `Escalation triggers` · `What you do NOT do` · `Output format` — survive in order. Compress *within* a section; remove none.

## Where the redundancy lives (the compressible surface)

The same four points recur across the body; each is stated authoritatively once and de-duplicated elsewhere. Anchored to the plan-time line numbers of `agents/doc-planner.md`:

| Redundant point | Occurs at (plan-time) | Keep the authoritative statement at | Compress the rest to |
|---|---|---|---|
| "You write the LIST, not the documents" | blockquote L10; `## Role` L14; `## Protocol` intro L18; `## What you do NOT do` L128 | `## Protocol` intro (L18) — the operational statement | a short clause in the blockquote; a pointer in `## What you do NOT do` |
| "`n/a` is the only waiver, always with a `condition`" | Step 2 L47; Step 3 `status`/`condition` L74-75 (FROZEN); Step 4 L94; `## What you decide` L110; `## What you do NOT do` L131 | Step 3 field definitions (L74-75) — **frozen** | one-line pointers ("`n/a` needs a `condition` — Step 3") in Step 2/4 and the two lists |
| "don't ship / approve / merge (escalation 1)" | Escalation triggers L122; `## What you do NOT do` L133 | Escalation triggers (L122) | a pointer, or drop from the second list |
| "don't supersede an ADR (escalation 2)" | Escalation triggers L121; `## What you do NOT do` L134 | Escalation triggers (L121) | a pointer, or drop from the second list |
| Escalation prose re-explaining GOVERNANCE §1 | L112-114 framing; L124 restatement | the role-specific triggers (L116-121, the *specific* conditions) | drop the generic "GOVERNANCE.md §1 defines exactly three actions…" framing the caller already loads; keep the concrete triggers |
| Long parenthetical asides | throughout (e.g. L10, L22, L48, L50) | the load-bearing clause | trim the parenthetical to its essential token or drop |

**`## Role` (L12-14)** restates the blockquote and Step 2; GOVERNANCE §7 asks for "Role (one sentence)". Reduce to one crisp sentence naming what the agent authors (the doc-manifest = the doc-leash's list) — the judgment is unchanged, the paragraph shrinks.

**Frontmatter `description:` (L3)** is a *routing* surface (the caller/orchestrator reads it to select the agent), so it is judgment-adjacent, not pure body redundancy. Treat it as **out of primary scope**: leave it intact, or trim only verbatim-duplicated tails, and only if a reviewer agrees the routing signal is unchanged. The measured ranking counts `wc -c` of the whole file, so frontmatter savings would still count — but the risk/benefit favours leaving it. Default: untouched.

## The cascade (mechanically forced by the DNA gate)

The [`regression-measured-body-size-tables-match-live-tree`](../../../governance/__tests__/regression-measured-body-size-tables-match-live-tree.test.mjs) gate parses every fenced `wc -c -w` row (`FENCED_ROW_RE`) and every skill table row (`TABLE_ROW_RE`) in each `docs/features/*/dispatch-cost.md` and asserts `Buffer.byteLength` / whitespace-split word count equal the live file. The `total` row does **not** match `FENCED_ROW_RE` (no `agents/`|`skills/` prefix), so it is NOT gate-enforced — but it is an internal sum that must stay consistent. Trimming `doc-planner.md` staleness the row at line 27 and FAILS the gate until updated.

Let `W`/`B` = the measured new words/bytes of the trimmed `agents/doc-planner.md` (from `wc -c -w`, cross-checked with the gate's own method: `node -e 'const c=require("fs").readFileSync("agents/doc-planner.md","utf8");console.log(Buffer.byteLength(c), c.split(/\s+/).filter(Boolean).length)'`). Updates to [`dispatch-cost.md`](../workflow-script-optimization/dispatch-cost.md):

| Location | Current (plan-time) | New | Invariant class |
|---|---|---|---|
| §1 fenced row, line 27 | `    2198   15105 agents/doc-planner.md` | `    <W>   <B> agents/doc-planner.md` | **gate-enforced** (must equal live tree) |
| §1 total, line 37 | `   20837  140150 total` | `   <20837−2198+W>  <140150−15105+B> total` | internal sum (recompute from the whole block, don't hand-arith blindly) |
| §2 ranking cell, line 52 | `**45315** (15105 × 3; was 44256 before … drift note above)` | `**<B×3>** (<B> × 3; was 45315 (15105×3) before trim-doc-planner-agent-prompt; was 44256 before the … drift note above)` | internal consistency w/ line 27; **preserve the 44256 history** |
| §2 "Reading the extremes", line 68 | `15105 bytes, post-drift-note`; `~12% gap` to `reviewer-quality`'s `13470`; `45315 vs 26940, ~1.7×`; "remains first after it (45315)" | reconcile the live figures to `B`/`B×3` and the recomputed gap/ratio; **preserve the 44256 / PR-#54 historical sentence** as the record of that earlier event | internal consistency + WORM history |

**New dated trim note in §1** (mirror the line-40 drift note's shape, do not rewrite line 40): record that `trim-doc-planner-agent-prompt` reduced `agents/doc-planner.md` from `2198 words / 15105 bytes` to `<W> / <B>` (−`<2198−W>` words / −`<15105−B>` bytes) by removing redundant prose; the fenced row, total, and §2 ranking cell/prose were re-measured in the same commit; `doc-planner` remains rank 1 (`<B×3>` > `reviewer-quality`'s 26940).

### Two arithmetic checks the implementer runs with the measured `B` (not assumed)

- **Ranking order (rank 1 preserved):** `B × 3 > 26940` ⟺ `B > 8980`. A redundancy-only trim of a 15105-byte file stays far above 8980, but the plan does not assume it — evidence records `B×3` and the comparison. Also confirm `B×3` clears the third-ranked `reviewer-architecture` (26308 ⟺ `B > 8769`); 8980 is the binding threshold.
- **"Largest single agent file" prose (body-size superlative, distinct from the ranking):** line 68 calls `doc-planner` "the largest single agent file (15105 bytes)" and `reviewer-quality` (13470) "the next largest". If the measured `B < 13470`, `doc-planner` is **no longer** the largest file and that sentence must be reworded — while the *ranking* stays 1 (driven by the 3× reuse, not body size, exactly as line 68 already explains). The implementer edits the prose to whichever the measurement shows; it is not knowable until the trim is done. This is the measure-don't-recall discipline applied to prose.

## Verifying the contract survived (without running the LLM agent)

The agent's manifest-emitting behavior can't be unit-tested deterministically, but the *contract it teaches* can be smoke-tested. Build a fixture `doc-manifest.json` **directly from the trimmed Step 3 schema block** (copy its shape) and run [`check-doc-manifest.js`](../../../governance/validators/check-doc-manifest.js):

- A well-formed item with all six fields, `status: pendente`, pointing at a file that exists → the validator counts it and exits 0 (with `AIDAKIT_PROJECT_ROOT` set to the worktree so path resolution is deterministic).
- An item with `status: n/a` and **no** `condition` → `manifest-invalid`, exit 2.

If the trimmed Step 3 block still describes a manifest that produces those two outcomes, the schema survived the trim. Pair it with [`check-docs.test.mjs`](../../../governance/__tests__/check-docs.test.mjs) (`0 failed`), the validator's own suite, which pins the contract from the other side.

## Alternatives considered

| Option | Why rejected |
|---|---|
| Trim the frontmatter `description:` for extra bytes | It is a routing surface the caller reads to select the agent — judgment-adjacent, not pure redundancy. The risk of degrading agent selection outweighs the marginal bytes. Left intact (§"Where the redundancy lives"). |
| Set a fixed byte target (e.g. "cut to 12000") | Would invite trimming to hit a number rather than trimming only redundancy. Acceptance is "fewer than 15105 with no judgment removed"; the number is *measured*, never targeted (proposal non-goal 5). |
| Update only the gate-enforced line 27 and skip the total / ranking / prose | Line 27 alone would pass the DNA gate but leave `dispatch-cost.md` internally contradictory (total ≠ sum, ranking cell ≠ `bytes×3`, prose ≠ row). Internal consistency is part of the cascade even where the gate doesn't reach. |
| Rewrite the line-40 drift note / edit `workflow-script-optimization`'s proposal/design/evidence | Those are that merged change's historical narrative (WORM); only `dispatch-cost.md` carries the live gate rows. Rewriting history is proposal non-goal 6. |
| Author a mechanical guard that a prompt's leash regions are byte-stable | Over-engineering for a one-file prose edit; the existing gates (DNA, `agent-validator-paths`, `check-docs`) already cover the mechanical surface, and ADR-001's `≥3×` crystallization trigger has not fired for "prompt-trim broke the leash". |

## Rollback

Single-commit, prose-only, reversible with `git revert`. No migration, no data, no schema. If a reviewer finds a compressed line dropped a judgment-bearing instruction, restore that line from the pre-trim `agents/doc-planner.md` (git history) and re-measure — the cascade update in `dispatch-cost.md` follows the new byte count mechanically. `governance/**` is untouched throughout, so no engine/validator state can be left inconsistent.

## Frozen evidence location

All validation output, before/after `wc` counts, the arithmetic checks, and the `check-doc-manifest.js` smoke run land in [`evidence.md`](evidence.md) — the single evidence file for this change. Nothing lands elsewhere.
