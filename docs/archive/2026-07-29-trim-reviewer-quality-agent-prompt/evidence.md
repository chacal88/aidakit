# Evidence — trim-reviewer-quality-agent-prompt

**Change ID:** `trim-reviewer-quality-agent-prompt`
**Date:** `2026-07-27`
**Owner:** `@chacal88`
**Phase / Package:** `n/a (agents/reviewer-quality.md prompt-body trim + docs/features/workflow-script-optimization/dispatch-cost.md re-measure — no mechanical surface)`
**PRD:** `n/a`
**Tech Spec:** `n/a`

> Pre-execution stub. Every command below is run on the live tree during implementation; output is pasted verbatim (measure, don't recall). No number is recorded here that was not actually `wc`/`node`-run on the tree.

## Validation Outputs

### Byte count — before / after

| | words | bytes | source |
|---|---|---|---|
| **before** (baseline) | 1993 | 13470 | `wc -c -w agents/reviewer-quality.md`, matches [`dispatch-cost.md`](../workflow-script-optimization/dispatch-cost.md) line 33 |
| **after** (trimmed) | 1820 | 12441 | `wc -c -w agents/reviewer-quality.md` on the trimmed tree, cross-checked with `Buffer.byteLength`/split |
| **delta** | `−173` | `−1029` | `B (12441) < 13470` ✓ |

### Baseline (before any edit) — [tasks.md](tasks.md) §1

- `git rev-parse HEAD` → `b1ffa1cedaeaad8fd11c07d552232183b6644865`
- `git log --oneline -1 origin/main` → `c62b9d4 chore(docs): archive trim-doc-planner-agent-prompt — shipped in PR #64 (#65)`
- `git merge-base HEAD origin/main` → `b1ffa1cedaeaad8fd11c07d552232183b6644865` (HEAD is one doc-only archive commit behind `origin/main`; that commit only `git mv`s `docs/features/trim-doc-planner-agent-prompt/` → `docs/archive/2026-07-27-trim-doc-planner-agent-prompt/` plus `ROADMAP.md`/`EPIC-context-caching.md` — verified via `git show c62b9d4 --stat`, does not touch `agents/reviewer-quality.md` or `dispatch-cost.md`)
- `wc -c -w agents/reviewer-quality.md` (before) → `    1993   13470 agents/reviewer-quality.md` — matches expected baseline.
- Sibling-landed check: `grep -nE '1962\s+13854 agents/doc-planner\.md|1993\s+13470 agents/reviewer-quality\.md' docs/features/workflow-script-optimization/dispatch-cost.md` →
  ```
  27:    1962   13854 agents/doc-planner.md
  33:    1993   13470 agents/reviewer-quality.md
  ```
  both rows present.
- Full suite baseline (`for f in governance/__tests__/*.test.mjs; do echo "== $f"; node "$f" 2>&1 | tail -1; done`) → all 24 files green, 0 failed each:
  ```
  == governance/__tests__/agent-validator-paths.test.mjs
  31 passed, 0 failed
  == governance/__tests__/brainstorm-schema.test.mjs
  34 passed, 0 failed
  == governance/__tests__/candidates.test.mjs
  8 passed, 0 failed
  == governance/__tests__/check-acceptance.test.mjs
  31 passed, 0 failed
  == governance/__tests__/check-adr-format.test.mjs
  8 passed, 0 failed
  == governance/__tests__/check-bench.test.mjs
  20 passed, 0 failed
  == governance/__tests__/check-docs.test.mjs
  12 passed, 0 failed
  == governance/__tests__/check-evidence-stat.test.mjs
  12 passed, 0 failed
  == governance/__tests__/check-links.test.mjs
  22 passed, 0 failed
  == governance/__tests__/check-runtime-bump.test.mjs
  17 passed, 0 failed
  == governance/__tests__/context-pack.test.mjs
  155 passed, 0 failed
  == governance/__tests__/dna-freshness.test.mjs
  7 passed, 0 failed
  == governance/__tests__/dna-write.test.mjs
  14 passed, 0 failed
  == governance/__tests__/engine.test.mjs
  264 passed, 0 failed
  == governance/__tests__/ledger.test.mjs
  8 passed, 0 failed
  == governance/__tests__/plugin-version.test.mjs
  12 passed, 0 failed
  == governance/__tests__/pr-automation.test.mjs
  216 passed, 0 failed
  == governance/__tests__/prelude.test.mjs
  13 passed, 0 failed
  == governance/__tests__/progress-table.test.mjs
  30 passed, 0 failed
  == governance/__tests__/regression-measured-body-size-tables-match-live-tree.test.mjs
  54 passed, 0 failed
  == governance/__tests__/retry-memory.test.mjs
  87 passed, 0 failed
  == governance/__tests__/roadmap.test.mjs
  28 passed, 0 failed
  == governance/__tests__/step-summaries.test.mjs
  107 passed, 0 failed
  == governance/__tests__/yaml-min.test.mjs
  17 passed, 0 failed
  ```
  No pre-existing red.
- Mechanical gates baseline, run individually:
  - `node governance/__tests__/regression-measured-body-size-tables-match-live-tree.test.mjs` → `54 passed, 0 failed`
  - `node governance/__tests__/context-pack.test.mjs` → `155 passed, 0 failed`
- `node governance/validators/check-plugin-version.js .` (baseline) → exit 0:
  ```
  {"validator":"aidakit.check-plugin-version","ok":true,"manifest":"0.10.0","highest":"0.10","behind":[],"scanned":339}
  # check-plugin-version

  OK — manifest 0.10.0 covers the highest footer (v0.10), 339 file(s).
  ```
  manifest `0.10.0`, highest footer `v0.10`.

### `bytes-reduced-measured`

- `wc -c -w agents/reviewer-quality.md` (after trim) → `    1820   12441 agents/reviewer-quality.md`
- Gate-method cross-check `node -e 'const c=require("fs").readFileSync("agents/reviewer-quality.md","utf8");console.log(Buffer.byteLength(c), c.split(/\s+/).filter(Boolean).length)'` → `12441 1820` — agrees with `wc` (bytes 12441, words 1820).
- `B < 13470`? → **true**. `12441 < 13470` (−1029 bytes / −173 words).

### `frozen-contract-intact`

- `grep -nE '^### Phase [1-4]' agents/reviewer-quality.md` →
  ```
  24:### Phase 1 — Context (before opening the diff)
  34:### Phase 2 — Architecture (high-level view, before the line)
  41:### Phase 3 — Line-by-line
  53:### Phase 4 — Summary & verdict
  ```
  four headers, in order: Context → Architecture → Line-by-line → Summary & verdict. ✓
- `grep -oE '\[(blocking|important|nit|praise)\]' agents/reviewer-quality.md | sort | uniq -c` →
  ```
     8 [blocking]
     5 [important]
     5 [nit]
     3 [praise]
  ```
  all four labels present; `## Severities` table still has all four rows (verified by reading the file — unchanged, byte-for-byte).
- `grep -n 'verdict: approved | rejected' agents/reviewer-quality.md` → `127:verdict: approved | rejected` — present; the three trailing lines (`verdict:`/`Status:`/`Ready to merge:`) and the verdict rules survive (Output-format block untouched, see quote below).
- `grep -c 'file:line' agents/reviewer-quality.md` → `8` — every Findings-template line (`[blocking]`/`[important]`/`[nit]`/`[praise]`) carries `<file:line>`.
- Surviving Output-format verdict block, quoted verbatim:
  ```
  ## Quality review — <change/diff> (round N)

  **role**: reviewer-quality

  ### Findings

  - `[blocking]` <file:line> — <what breaks, 1–2 sentences> · suggestion: <one fix>
  - `[important]` <file:line> — <duplication/edge/weak test> · suggestion: <pointer>
  - `[nit]` <file:line> — <optional improvement>
  - `[praise]` <file:line> — <right pattern applied, named>

  ### Praise

  - <what is good — mandatory to name at least one item, or to say explicitly "nothing to highlight this round">

  ## Summary

  - N findings (B blocking, I important, T nit) + P praise
  - Justification: <what was analyzed and why the verdict — never "LGTM">

  verdict: approved | rejected
  Status: APPROVED | NEEDS-REVISION | BLOCKED
  Ready to merge: yes | no
  ```
  Verdict rules (1+ open blocking → rejected; open important without fix/contest → rejected; only nit/praise → approved; three trailing lines mandatory; approved with open blocker forbidden; stub/off-format verdict is a NON-verdict) — all untouched, byte-identical to the pre-trim file.

### `step-0.5-mechanical-region-survives`

- `grep -ci 'context pack' agents/reviewer-quality.md` → `1` (≥ 1 ✓)
- `grep -c '\.context-pack\.md' agents/reviewer-quality.md` → `1` (≥ 1 ✓)
- fallback clause matches `/fall.?back.*raw|absent.*proposal|pack.*absent/is` → surviving clause, quoted: "**If the pack is absent**, fall back to reading `proposal.md`/`design.md`/`tasks.md`/the cited ADRs directly, exactly as before — a missing pack never fails the dispatch." — matches (contains "absent" + "proposal" per the `absent.*proposal` alternative).
- `grep -c 'check-context-pack-freshness' agents/reviewer-quality.md` → `0` ✓
- `node governance/__tests__/context-pack.test.mjs` → `155 passed, 0 failed`. (The Step 0.5 block was left completely byte-untouched by this trim — no edit touched lines 18-20.)

### `dna-gate-green-after-remeasure`

`dispatch-cost.md` edits applied:
- Line 33 fenced row: `    1993   13470 agents/reviewer-quality.md` → `    1820   12441 agents/reviewer-quality.md`
- Line 37 total: `   20601  138899 total` → `   20428  137870 total` (verified by summing all 13 rows via `wc -c -w agents/*.md`: sum = 20428 words / 137870 bytes, matches)
- Line 55 (now line 61 after re-sort) ranking cell: `**26940**` → `**24882** (12441 × 2; was 26940 (13470×2) before trim-reviewer-quality-agent-prompt)`
- §2 table re-sorted (see `ranking-recomputed-and-resorted`)
- Line 70 (now line 72) "Reading the extremes" prose reconciled (see `extremes-prose-reconciled`)
- New §1 dated trim note added (mirrors line-42 doc-planner trim note's shape); lines 40 and 42 left untouched, byte-identical (confirmed by re-reading the file after edit — only a new paragraph was inserted at line 44, nothing rewritten above it).

`node governance/__tests__/regression-measured-body-size-tables-match-live-tree.test.mjs` → `54 passed, 0 failed` (`workflow-script-optimization: 27 measured rows checked`).

### `ranking-recomputed-and-resorted`

- `B × 2 = 12441 × 2 = 24882`
- reviewer-quality's new rank: **6** (was 2) — dropped below: `reviewer-architecture` (26308), `planner` (25532), `tester` (25352), `orchestrator` (25128). Still above `implementer` (≥23064).
- §2 `Ranking` column monotonically non-increasing after the re-sort? → **confirmed**: `41562, 26308, 25532, 25352, 25128, 24882, ≥23064(23064), 22719, 21572, 16254, 12948, 10635, 0`.
- `doc-planner` rank-1 untouched? → **confirmed** — row/cell byte-identical (`1962 13854` / `**41562**`).

### `extremes-prose-reconciled`

- Case held: **`B < 13154`** (12441 < 13154) → `reviewer-architecture` becomes the second-largest agent file and the new rank 2.
- Line 70 gap/ratio recomputed from measured `B`: gap to doc-planner's 13854 is now `reviewer-architecture` vs `doc-planner` = `(13854−13154)/13854 ≈ 5.05%` (~5.1%); ranking gap `41562 vs 26308 ≈ 1.58×` (was `41562 vs 26940 ≈ 1.54×`).
- PR-#54 / doc-planner-trim historical sentences preserved verbatim? → **confirmed** — lines 40/42 unchanged (byte-diffed against the pre-edit file); the "Ranking order is unaffected..." and "Nor by the trim-doc-planner-agent-prompt trim..." sentences inside the line-70 paragraph are also preserved verbatim; only the reviewer-quality-specific clauses were reworded, and one new sentence was appended noting this trim's own effect on the order.

### `no-plugin-bump-forced`

- `node governance/validators/check-plugin-version.js .` → exit 0:
  ```
  {"validator":"aidakit.check-plugin-version","ok":true,"manifest":"0.10.0","highest":"0.10","behind":[],"scanned":339}
  # check-plugin-version

  OK — manifest 0.10.0 covers the highest footer (v0.10), 339 file(s).
  ```
  manifest `0.10.0` covers highest footer `v0.10` (the `v0.4` footer this change appends to `reviewer-quality.md` does not raise the highest footer).
- `git diff --exit-code $(git merge-base HEAD origin/main) -- .claude-plugin/plugin.json` → exit 0 — manifest byte-identical.

### Full suite + links + scope

- Full suite after edits → all 24 files green, 0 failed each (identical to baseline, no new red):
  ```
  == governance/__tests__/agent-validator-paths.test.mjs
  31 passed, 0 failed
  == governance/__tests__/brainstorm-schema.test.mjs
  34 passed, 0 failed
  == governance/__tests__/candidates.test.mjs
  8 passed, 0 failed
  == governance/__tests__/check-acceptance.test.mjs
  31 passed, 0 failed
  == governance/__tests__/check-adr-format.test.mjs
  8 passed, 0 failed
  == governance/__tests__/check-bench.test.mjs
  20 passed, 0 failed
  == governance/__tests__/check-docs.test.mjs
  12 passed, 0 failed
  == governance/__tests__/check-evidence-stat.test.mjs
  12 passed, 0 failed
  == governance/__tests__/check-links.test.mjs
  22 passed, 0 failed
  == governance/__tests__/check-runtime-bump.test.mjs
  17 passed, 0 failed
  == governance/__tests__/context-pack.test.mjs
  155 passed, 0 failed
  == governance/__tests__/dna-freshness.test.mjs
  7 passed, 0 failed
  == governance/__tests__/dna-write.test.mjs
  14 passed, 0 failed
  == governance/__tests__/engine.test.mjs
  264 passed, 0 failed
  == governance/__tests__/ledger.test.mjs
  8 passed, 0 failed
  == governance/__tests__/plugin-version.test.mjs
  12 passed, 0 failed
  == governance/__tests__/pr-automation.test.mjs
  216 passed, 0 failed
  == governance/__tests__/prelude.test.mjs
  13 passed, 0 failed
  == governance/__tests__/progress-table.test.mjs
  30 passed, 0 failed
  == governance/__tests__/regression-measured-body-size-tables-match-live-tree.test.mjs
  54 passed, 0 failed
  == governance/__tests__/retry-memory.test.mjs
  87 passed, 0 failed
  == governance/__tests__/roadmap.test.mjs
  28 passed, 0 failed
  == governance/__tests__/step-summaries.test.mjs
  107 passed, 0 failed
  == governance/__tests__/yaml-min.test.mjs
  17 passed, 0 failed
  ```
  `engine.test.mjs` 264/0, `check-bench.test.mjs` 20/0, `regression-measured-body-size-tables-match-live-tree` 54/0, `context-pack` 155/0 — all green, unchanged from baseline.
- `node governance/validators/check-links.js docs/features/trim-reviewer-quality-agent-prompt agents/reviewer-quality.md docs/features/workflow-script-optimization/dispatch-cost.md` → exit 0: `{"validator":"aidakit.check-links","ok":true,"files_checked":7,"errors":[]}`.
- `git diff --stat` + `git status --porcelain` →
  ```
   agents/reviewer-quality.md                         | 34 ++++++++++------------
   .../workflow-script-optimization/dispatch-cost.md  | 10 ++++---
   2 files changed, 21 insertions(+), 23 deletions(-)

   M agents/reviewer-quality.md
   M docs/features/workflow-script-optimization/dispatch-cost.md
  ?? docs/features/trim-reviewer-quality-agent-prompt/
  ```
  exactly `agents/reviewer-quality.md`, `docs/features/workflow-script-optimization/dispatch-cost.md`, plus this change directory. No `governance/**`, no `.js`/`.mjs`/`.yaml`, no `.claude-plugin/plugin.json`.
- `git diff --exit-code $(git merge-base HEAD origin/main) -- governance/` → exit 0 — `governance/**` byte-identical to the merge-base.

## Files Touched

| Path | Action | Note |
|---|---|---|
| `agents/reviewer-quality.md` | modify | body-prose trim (dedupe Role/ADVERSARIAL/LGTM/`file:line`/escalation restatements, drop parentheticals; 4 phases + 4 severities + verdict vocab + Step 0.5 context-pack block byte-preserved) + appended `v0.4` provenance footer. Before: `1993 words / 13470 bytes`. After: `1820 words / 12441 bytes` (−173/−1029). |
| `docs/features/workflow-script-optimization/dispatch-cost.md` | modify | cascade re-measure: §1 line 33 fenced row (`1820/12441`) + line 37 total (`20428/137870`); §2 ranking cell (`24882`) + table re-sort (reviewer-quality rank 2→6) + "Reading the extremes" prose (reviewer-architecture becomes 2nd-largest/rank 2); new §1 dated trim note added (lines 40/42 preserved verbatim). |
| `docs/features/trim-reviewer-quality-agent-prompt/{proposal,design,tasks,evidence}.md` | create | this change directory (evidence filled during execution). |
| `.claude-plugin/plugin.json` | untouched (expected) | `v0.4` footer ≤ highest footer `v0.10`; manifest `0.10.0` covers it. Confirmed via `check-plugin-version.js .` exit 0. |
| `governance/**` | untouched | confirmed byte-identical to the merge-base (`git diff --exit-code` exit 0). |
| `docs/decisions/**`, `docs/specs/**` | untouched | no ADR, no spec delta. |

## Unresolved Deviations

**Deviation (procedural, not content): the approved plan package (`proposal.md`/`design.md`/`tasks.md`/`evidence.md`) was found on disk only in the repo's main worktree (`/Users/kauesantos/Documents/winker/aidakit/docs/features/trim-reviewer-quality-agent-prompt/`), untracked, and NOT present in this change's own dedicated worktree/branch (`claude/trim-reviewer-quality-prompt-9e278e`, worktree `.claude/worktrees/agitated-gagarin-db2671`) — only an empty-shell `.context-pack.md` (built from an empty source hash) existed there at dispatch time. This is consistent with the repo's known concurrent-worktrees-race failure mode (multiple worktrees on sibling/related changes; the planning phase for this change appears to have run against the main worktree's working directory rather than this change's own worktree). Anti-drift re-inspection (GOVERNANCE.md §8) confirmed: (a) the plan content itself is internally consistent and matches the task package's stated constraints verbatim; (b) the actual edit targets (`agents/reviewer-quality.md`, `dispatch-cost.md`) in THIS worktree are at the exact baseline the plan assumes (`1993/13470`, sibling `doc-planner` row `1962/13854`); (c) HEAD in this worktree is the merge-base with `origin/main` (one doc-only archive commit behind, verified unrelated to the touched files). Given the plan's content was unmodified and the target files matched the assumed baseline exactly, I copied the four plan files verbatim (byte-for-byte, `diff` confirmed identical) from the main worktree into this worktree's change directory rather than escalating — this is a relocation of an already-approved, unmodified artifact into the worktree that actually needs it to do the assigned job (mark `tasks.md`, fill `evidence.md`), not a re-plan or a scope change. No plan decision, task, or acceptance criterion was altered. Flagging this explicitly so the ship step / a human can confirm the main worktree's copies are cleaned up (or intentionally left, since they are untracked and harmless) and so this class of dispatch mismatch is visible for `aidakit:learn`.

No other deviation. `check-plugin-version.js` stayed green (no sibling drift on the manifest); the DNA gate flagged no non-`reviewer-quality` row (no other agent/skill drifted); the baseline byte count matched `1993/13470` exactly (no sibling drift on the trim target).
</content>
