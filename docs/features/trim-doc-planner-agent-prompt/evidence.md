# Evidence — trim-doc-planner-agent-prompt

**Change ID:** `trim-doc-planner-agent-prompt`
**Date:** `2026-07-25`
**Owner:** `@chacal88`
**Phase / Package:** `n/a (agents/doc-planner.md prompt-body trim + docs/features/workflow-script-optimization/dispatch-cost.md re-measure — no mechanical surface)`
**PRD:** `n/a`
**Tech Spec:** `n/a`

> Every command below was run on the live tree during implementation; output is pasted verbatim (measure, don't recall).

## Validation Outputs

### Baseline (before any edit) — [tasks.md](tasks.md) §1

- `git rev-parse HEAD` → `7cfbb1f86c16c33f6190c1de72960abbc27d6e2a`
- `git log --oneline -1 origin/main` → `7cfbb1f dna(workflow-script-optimization): gate measured tables vs live tree (#62)`
- `git merge-base HEAD origin/main` → `7cfbb1f86c16c33f6190c1de72960abbc27d6e2a`
- HEAD == origin/main == merge-base: no drift, worktree matches the plan-time tree exactly.
- `wc -c -w agents/doc-planner.md` (before) → `    2198   15105 agents/doc-planner.md` — matches the expected `2198/15105` baseline exactly. No reconciliation needed.
- Full suite baseline (`for f in governance/__tests__/*.test.mjs; do echo "== $f"; node "$f" 2>&1 | tail -1; done`) — all 23 files green, **no pre-existing red** (including `context-pack.test.mjs`, since HEAD == merge-base == origin/main with zero drift):
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
- Cascade gates baseline, run individually:
  - `node governance/__tests__/regression-measured-body-size-tables-match-live-tree.test.mjs` → `workflow-script-optimization: 27 measured rows checked` / `54 passed, 0 failed`
  - `node governance/__tests__/agent-validator-paths.test.mjs` → `31 passed, 0 failed`
  - `node governance/__tests__/check-docs.test.mjs` → `12 passed, 0 failed`

### `bytes-reduced-measured`

- `wc -c -w agents/doc-planner.md` (after trim) → `    1962   13854 agents/doc-planner.md` — **W = 1962 words, B = 13854 bytes**
- Gate-method cross-check `node -e 'const c=require("fs").readFileSync("agents/doc-planner.md","utf8");console.log(Buffer.byteLength(c), c.split(/\s+/).filter(Boolean).length)'` → `13854 1962` — agrees with `wc` exactly (bytes first, then words; same values).
- `B < 15105`? `13854 < 15105` → **true**. Reduction: −236 words / −1251 bytes.

### `no-judgment-instruction-removed`

Frozen leash survivors, quoted verbatim from the trimmed `agents/doc-planner.md`:

- **Step 3 item schema JSON + field definitions + manifest envelope** (unchanged, byte-identical to the pre-trim file):
  ```json
  {
    "doc": "proposal",
    "path": "docs/features/<change-id>/proposal.md",
    "status": "pendente",
    "condition": "every change produces a proposal (DOCS.md §1/§4)",
    "kind": "doc",
    "owner": "@<github-handle>"
  }
  ```
  ```json
  {
    "change_id": "<change-id>" ,
    "level": "change",
    "required": [ /* items above */ ]
  }
  ```
  Field definitions (verbatim): `` `doc` — short name of the deliverable... ``, `` `path` — path relative to the root... ``, `` `status` — `pendente` (mandatory, does not yet exist) · `resolvido` (mandatory and already on disk) · `n/a` (does not apply to this change)... ``, `` `condition` — the sentence that justifies the mandatoriness or the waiver... ``, `` `kind` — `adr` | `doc` | `index`... ``, `` `owner` — the `@github-handle` responsible... ``.
- **The "`n/a` is the only waiver, always with a `condition`" rule (Step 3, frozen statement):** `` **`n/a` is the only way to waive an item — and always with a `condition`.** The validator checks the disk: a declared `status` is not enough for `resolvido`, the file has to exist. ``
- **Enums:** `` `status` — `pendente` (...) · `resolvido` (...) · `n/a` (...) `` and `` `kind` — `adr` | `doc` | `index`. ``
- **The two manifest paths:** `` `.aidakit/tasks/<change-id>/doc-manifest.json` `` and `` `.aidakit/doc-manifest-project.json` `` (Step 3, and repeated in Output-format item 1 — both occurrences byte-identical to pre-trim).
- **Decision-authority statements** (all survive, compressed prose but same judgment): "Mandatory vs. waivable — the leash's central judgment: an architecture change requires an ADR; a trivial bugfix does not..." (What you decide); "You derive EVERY path and EVERY mandatoriness rule from here — do not invent structure" (Step 0, unchanged); "Assemble the project manifest when the input carries a project identity..." (Step 2, unchanged in substance); the 3-escalations section (Escalation triggers, unchanged in substance).
- **The six GOVERNANCE §7 section headers, in order:** `## Role` · `## Protocol` · `## What you decide on your own` · `## Escalation triggers` · `## What you do NOT do` · `## Output format` — all present, same order, none removed.

### `guard-literal-survives-verbatim`

- `grep -c 'AIDAKIT_GOVERNANCE?agent-validator-paths' agents/doc-planner.md` → `1`
- `node governance/__tests__/agent-validator-paths.test.mjs` → `31 passed, 0 failed`

### `doc-manifest-contract-intact`

Fixtures built from the trimmed Step 3 schema block, written as throwaways under the scratchpad (not committed, not under the repo):

- Well-formed fixture (`doc-manifest-wellformed.json`):
  ```json
  {
    "change_id": "trim-doc-planner-agent-prompt",
    "level": "change",
    "required": [
      {
        "doc": "proposal",
        "path": "docs/features/trim-doc-planner-agent-prompt/proposal.md",
        "status": "pendente",
        "condition": "every change produces a proposal (DOCS.md §1/§4)",
        "kind": "doc",
        "owner": "@chacal88"
      }
    ]
  }
  ```
  Run: `AIDAKIT_PROJECT_ROOT="$(pwd)" node governance/validators/check-doc-manifest.js <fixture>` →
  ```
  {"validator":"aidakit.check-doc-manifest","ok":true,"change_id":"trim-doc-planner-agent-prompt","level":"change","required":1,"resolved":1,"errors":[]}
  # check-doc-manifest

  OK — 1/1 required documents resolved. Gate cleared.
  ```
  exit code: `0`

- `n/a`-without-`condition` fixture (`doc-manifest-nacond-missing.json`):
  ```json
  {
    "change_id": "trim-doc-planner-agent-prompt",
    "level": "change",
    "required": [
      {
        "doc": "spec-delta",
        "path": "docs/features/trim-doc-planner-agent-prompt/specs/does-not-exist/spec.md",
        "status": "n/a",
        "kind": "doc",
        "owner": "@chacal88"
      }
    ]
  }
  ```
  Run: `AIDAKIT_PROJECT_ROOT="$(pwd)" node governance/validators/check-doc-manifest.js <fixture>` →
  ```
  {"validator":"aidakit.check-doc-manifest","ok":false,"change_id":"trim-doc-planner-agent-prompt","level":"change","required":0,"resolved":0,"errors":[{"rule":"manifest-invalid","doc":"spec-delta","path":"docs/features/trim-doc-planner-agent-prompt/specs/does-not-exist/spec.md","message":"item \"spec-delta\" is status:\"n/a\" without a \"condition\" — a waiver requires a written justification"}]}
  # check-doc-manifest

  BLOCKED — 0/0 resolved; 1 pending:

  - item "spec-delta" is status:"n/a" without a "condition" — a waiver requires a written justification

  The flow won't advance until the list is 100%. Resolve the documents above.
  ```
  exit code: `2` (`manifest-invalid`)

- `node governance/__tests__/check-docs.test.mjs` → `12 passed, 0 failed`

### `dna-gate-green-after-remeasure`

`dispatch-cost.md` edits applied:
- Line 27 fenced row: `    2198   15105 agents/doc-planner.md` → `    1962   13854 agents/doc-planner.md`
- Line 37 total: `   20837  140150 total` → `   20601  138899 total` (verified by summing all 13 rows in Python: `sum(words)=20601`, `sum(bytes)=138899` — matches the live `wc -c -w agents/*.md` re-run exactly, diffed line by line against the pre-edit block, only the `doc-planner`/`total` rows differ)
- Line 52 ranking cell: `**45315** (15105 × 3; was 44256 before the ... drift note above)` → `**41562** (13854 × 3; was 45315 (15105×3) before trim-doc-planner-agent-prompt; was 44256 before the ... drift note above)`
- Line 68 "Reading the extremes" prose: reconciled to 13854 bytes / ~2.9% gap to `reviewer-quality`'s 13470 (down from ~12% pre-trim) / 41562 vs 26940, ~1.5× ratio; the historical PR-#54 sentence (44256→45315, "no other agent's position changes") preserved verbatim, with a new sentence appended for the trim's own re-measurement.
- New §1 dated trim note added (mirrors the line-40 drift note's shape); line 40 (the PR-#54 drift note) left untouched, byte-identical.

`node governance/__tests__/regression-measured-body-size-tables-match-live-tree.test.mjs` →
```
workflow-script-optimization: 27 measured rows checked

54 passed, 0 failed
```

### `ranking-order-preserved`

- `B × 3 = 13854 × 3 = 41562`
- `41562 > 26940` (reviewer-quality)? **true**
- `41562 > 26308` (reviewer-architecture)? **true**
- → `doc-planner` stays rank 1.
- "Largest single agent file" case: `B = 13854` vs `reviewer-quality`'s `13470` → **`B ≥ 13470` holds** (13854 ≥ 13470): `doc-planner` is still the largest single agent file. The line-68 superlative was **kept** (not reworded to `reviewer-quality`), but the gap was reconciled from ~12% down to ~2.9% (384 bytes) to reflect the measured tree honestly.

### Full suite + links + scope

Full suite after edits (identical to baseline, no new red — same 23 files, same pass counts):
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
`engine.test.mjs` (would notice any engine regression): `264 passed, 0 failed` — unchanged from baseline, no engine regression. The three cascade gates (`regression-measured-body-size-tables-match-live-tree.test.mjs`, `agent-validator-paths.test.mjs`, `check-docs.test.mjs`) are all `0 failed`, identical counts to baseline.

- `node governance/validators/check-links.js docs/features/trim-doc-planner-agent-prompt agents/doc-planner.md docs/features/workflow-script-optimization/dispatch-cost.md` →
  ```
  {"validator":"aidakit.check-links","ok":true,"files_checked":7,"errors":[]}
  # check-links

  OK — 7 file(s), no broken links.
  ```
  exit code: `0`
- `git diff --stat`:
  ```
   agents/doc-planner.md                              | 39 +++++++++++-----------
   .../workflow-script-optimization/dispatch-cost.md  | 10 +++---
   2 files changed, 25 insertions(+), 24 deletions(-)
  ```
  `git status --porcelain`:
  ```
   M agents/doc-planner.md
   M docs/features/workflow-script-optimization/dispatch-cost.md
  ?? docs/features/trim-doc-planner-agent-prompt/
  ```
  → exactly the two declared files plus this change directory. No `.js`/`.mjs`/`.yaml`, no `governance/**`.
- `git diff --exit-code $(git merge-base HEAD origin/main) -- governance/` → exit code `0` (no diff, `governance/**` byte-identical to the merge-base).

## Files Touched

| Path | Action | Note |
|---|---|---|
| `agents/doc-planner.md` | modify | body-prose trim (dedupe LIST/`n/a`/escalation restatements, drop parentheticals; frozen leash regions byte-preserved) + appended `v0.10` provenance footer. Before: `2198 words / 15105 bytes`. After: `1962 words / 13854 bytes` (−236 words / −1251 bytes). |
| `docs/features/workflow-script-optimization/dispatch-cost.md` | modify | cascade re-measure: §1 line 27 fenced row + line 37 total; §2 line 52 ranking cell + line 68 prose; new §1 dated trim note (line 40's PR-#54 drift note preserved verbatim). |
| `docs/features/trim-doc-planner-agent-prompt/{proposal,design,tasks,evidence}.md` | create | this change directory (evidence filled during execution). |
| `governance/**` | untouched | confirmed byte-identical to the merge-base (`git diff --exit-code` exit 0). |
| `docs/decisions/**`, `docs/specs/**` | untouched | no ADR, no spec delta. |

## Unresolved Deviations

None. HEAD, `origin/main` and the merge-base were identical at baseline (`7cfbb1f`), so there was no sibling-PR drift to reconcile on any row. No other doc was found needing an edit (per tasks.md §4). The "largest single agent file" superlative case that held: `B (13854) ≥ 13470`, so `doc-planner` is still the largest single agent file — the framing was kept, only the gap (~12% → ~2.9%) was reconciled to the measured tree.
