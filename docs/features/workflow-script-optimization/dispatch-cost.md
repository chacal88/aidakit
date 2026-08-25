# Dispatch cost — workflow-script-optimization

**Change ID:** `workflow-script-optimization`
**Measured at commit:** `fa580e5`
**Date:** `2026-07-25`

> The second half of the [`inventory.md`](inventory.md) artifact — see that file's own header for the split rationale. `inventory.md` is the entry point; this file carries the measured cost tables it links to.

**Ranking metric:** `body_bytes × happy_path_dispatches` — the agent's prompt body size (bytes, `wc -c`) times how many times it fires on one clean traversal with no back-edge taken. This is a **lower bound**, not an estimate: back-edges multiply real dispatches, and a single bench/fan-out visit can fire multiple agents at once. It says nothing about output tokens, cache behavior, or wall-clock — those are read off the telemetry (§3), not modeled here. Bytes are never converted to tokens (criterion `no-fabricated-token-numbers` — a bytes→tokens factor would be an estimate).

**The `observed` hole, stated plainly:** this run (`full-260725-642b02`) is a `full` traversal, so `fast`, `design` and `docs-onboarding` have **no observed data at all** on this tree — those columns read `n/a (not exercised by this run)`, never `0` and never an inferred value. The ranking below is therefore **empirically grounded for `full`** and **structurally grounded (`static`/`happy-path`) for the other three flows** — the four flow columns are not comparable to each other on the `observed` axis. Measuring the other three flows means running three more real flows, a separate change, not a paragraph.

**Second-order agents have no individually-metered `observed` cell, in any flow, ever.** `.aidakit/tasks/<id>/.telemetry.jsonl` records one line per `resume` call, and the `subagent` field is the **flow's own `invoke_target`** (a first-order name) — never the underlying second-order agent a skill dispatches internally. So `aidakit:planner`, `aidakit:adr-reviewer`, `aidakit:reviewer-quality`, `aidakit:reviewer-security`, `aidakit:reviewer-architecture`, `aidakit:tester`, `aidakit:implementer` and `aidakit:research` read `n/a (not individually metered)` in every `observed` cell regardless of which flow ran — this is a structural property of what `governance/engine/steps/invoke.js`'s resume handler logs, not a hole in this particular run.

---

## §1 — Body size (source data)

```bash
wc -c -w agents/*.md
```

```
    1384    9655 agents/acceptance-planner.md
     983    6474 agents/adr-reviewer.md
    1544   10635 agents/brainstorm.md
    1962   13854 agents/doc-planner.md
    1791   11532 agents/implementer.md
    1834   12564 agents/orchestrator.md
    1902   12766 agents/planner.md
     754    5288 agents/research.md
    1931   13154 agents/reviewer-architecture.md
    1820   12441 agents/reviewer-quality.md
    1592   10786 agents/reviewer-security.md
    1129    7573 agents/spec-reviewer.md
    2030   12676 agents/tester.md
   20656  139398 total
```

**Re-medição 2026-08-24 (`agents/acceptance-planner.md`).** O guard
`regression-measured-body-size-tables-match-live-tree` disparou quando a change
`acceptance-evidence-section-content` (ADR-018) acrescentou ao contrato do agente a
regra da âncora obrigatória em `evidence-section`: tabela 1264 palavras / 8826 bytes,
árvore viva 1384 / 9655 (+120 / +829). A linha e o `total` acima foram re-medidos com
`wc -c -w agents/*.md` e colados verbatim; nenhum outro arquivo mudou. O ranking do §2
não muda de ordem — o agente segue o menor corpo da lista.

**Drift note (`agents/doc-planner.md`, caught in review-bench round 2, the same drift class round 1 caught for `skills/readiness/SKILL.md` — see §4's note below):** the plan-time/first-draft figure (2161 words / 14752 bytes) is stale. `48f4731` (PR #54, "fix(doc-leash): align condicao→condition and make waiver justification mechanical") — an ancestor of the `6af0e7a` base this change's second rebase landed on — changed `agents/doc-planner.md` (25 lines) before this table's first draft, and the file was never re-measured after that rebase pulled it in. Re-measured this pass: **2198 words / 15105 bytes** (+37 words / +353 bytes). The 13-file total moves from 20800/139797 to **20837 words / 140150 bytes**. The other 12 `agents/*.md` files are byte-identical to the first-draft measurement, re-confirmed this pass (`wc -c -w agents/*.md`, diffed line by line against the table above). Bytes and words are both recorded; neither is converted to tokens.

**Trim note (`agents/doc-planner.md`, `trim-doc-planner-agent-prompt`, 2026-07-25):** the change de-duplicated the 3–4× restatements of the same doctrine across the body (the LIST/`n/a`/escalation echoes) and dropped long parentheticals, with the frozen leash regions (Step 3 schema + envelope, the two manifest paths, the `status`/`kind` enums, the Output-format step-5 guard sentence) byte-preserved. Re-measured this pass: **1962 words / 13854 bytes** (−236 words / −1251 bytes from the 2198/15105 figure above). The 13-file total moves from 20837/140150 to **20601 words / 138899 bytes**. The other 12 `agents/*.md` files are unchanged (re-confirmed via `wc -c -w agents/*.md`, diffed line by line). §2's ranking cell and "Reading the extremes" prose were re-measured in the same commit; `doc-planner` remains rank 1 (`13854 × 3 = 41562` > `reviewer-quality`'s `26940`).

**Trim note (`agents/reviewer-quality.md`, `trim-reviewer-quality-agent-prompt`, 2026-07-27):** the change de-duplicated the 3–4× restatements of the same doctrine across the body (the Role/blockquote, `## ADVERSARIAL posture`, `LGTM`-invalid, `file:line`/severity and escalation echoes) and dropped long rhetorical parentheticals, with the frozen leash regions (the 4 phase headers + judgment checks, the `## Severities` table, the `## Output format` verdict block, and the Step 0.5 context-pack block) byte-preserved in meaning. Re-measured this pass: **1820 words / 12441 bytes** (−173 words / −1029 bytes from the 1993/13470 figure above). The 13-file total moves from 20601/138899 to **20428 words / 137870 bytes**. The other 12 `agents/*.md` files are unchanged (re-confirmed via `wc -c -w agents/*.md`, diffed line by line, and by direct sum: 20428/137870). §2's ranking cell, table row order and "Reading the extremes" prose were re-measured/re-sorted in the same commit: `reviewer-quality`'s rank drops from 2 to 6 (`12441 × 2 = 24882`, which falls below `reviewer-architecture` (26308), `planner` (25532), `tester` (25352) and `orchestrator` (25128), landing just above `implementer` (≥23064)); `reviewer-architecture` becomes the new rank 2 and the new second-largest single agent file. `doc-planner` remains rank 1 (`13854 × 3 = 41562` > `reviewer-architecture`'s `26308`).

## §2 — Agent dispatch-frequency table

**`static`** — number of steps naming the target, one command per flow YAML: `grep -oE 'invoke_target: [a-z:-]+' governance/flows/<f>.yaml | sort | uniq -c`. Only the 5 first-order agents can have a non-zero `static` cell (a `grep` over a flow YAML can never see a second-order dispatch — that's the whole point of §3a/§3b in `inventory.md`); the other 8 read `0` in all four columns, not `n/a` (a `grep` that finds nothing legitimately returns 0, this is not a hole).

**`happy-path`** — 4 separate graph walks (one per flow) along `on_success`/`on_result`, no back-edge taken, first step to `done`; second-order roles counted from the bench's/fan-out's declared role set. `aidakit:implementer`'s cell is `≥1 (change-dependent fan-out)`: a single-surface change dispatches it once, a multi-surface change dispatches it once **per surface** in the same message (`skills/implement/SKILL.md` §"Multi-surface change (parallel)") — the exact count depends on how many surfaces the change touches, which is not knowable from the flow YAML alone; `1` is used for the ranking column as the honest **lower bound**. `aidakit:reviewer-security` and `aidakit:reviewer-architecture` are flag-conditional (summoned only when the classification matches) — their happy-path cells assume the flag fires, consistent with the ranking's own lower-bound framing, and are footnoted `(cond.)`.

**`observed`** — `full` only, `.aidakit/tasks/workflow-script-optimization/.telemetry.jsonl`, grouped by `subagent`. **Captured as a PREFIX at authoring time** (2026-07-25, mid-`implement`, 8 lines on disk — see §3): only the 5 first-order/`both` agents can have a non-`n/a` cell in principle, and of those, `doc-planner` and `acceptance-planner` read `0 (prefix: not yet reached — document/acceptance run after learn)` because this run has not reached those steps yet, not because they cost nothing (contrast `classify`'s genuine zero-cost re-entry, F3).

| Agent | Tier | static (full / fast / design / docs-onboarding) | happy-path (full / fast / design / docs-onboarding) | Σ happy-path (4 flows) | observed (full, prefix) | observed (fast / design / docs-onboarding) | Ranking (bytes × Σ happy-path) |
|---|---|---|---|---|---|---|---|
| `aidakit:doc-planner` | agent | 1 / 1 / 0 / 1 | 1 / 1 / 0 / 1 | 3 | 0 (prefix: not yet reached) | n/a (not exercised) | **41562** (13854 × 3; was 45315 (15105×3) before trim-doc-planner-agent-prompt; was 44256 before the `agents/doc-planner.md` drift note above) |
| `aidakit:reviewer-architecture` | agent (2nd-order) | 0 / 0 / 0 / 0 | 1 (cond.) / 1 (cond.) / 0 / 0 | 2 | n/a (not individually metered) | n/a (not individually metered) | **26308** |
| `aidakit:planner` | agent (2nd-order) | 0 / 0 / 0 / 0 | 1 / 1 / 0 / 0 | 2 | n/a (not individually metered) | n/a (not individually metered) | **25532** |
| `aidakit:tester` | agent (2nd-order) | 0 / 0 / 0 / 0 | 1 / 1 / 0 / 0 | 2 | n/a (not individually metered) | n/a (not individually metered) | **25352** |
| `aidakit:orchestrator` | agent | 1 / 1 / 0 / 0 | 1 / 1 / 0 / 0 | 2 | 1 | n/a (not exercised) | **25128** |
| `aidakit:reviewer-quality` | agent (2nd-order) | 0 / 0 / 0 / 0 | 1 / 1 / 0 / 0 | 2 | n/a (not individually metered) | n/a (not individually metered) | **24882** (12441 × 2; was 26940 (13470×2) before trim-reviewer-quality-agent-prompt) |
| `aidakit:implementer` | agent (2nd-order) | 0 / 0 / 0 / 0 | ≥1 / ≥1 / 0 / 0 | ≥2 (lower bound: 2) | n/a (not individually metered) | n/a (not individually metered) | **≥23064** |
| `aidakit:spec-reviewer` | agent | 1 / 0 / 0 / 0 | 2 / 1 / 0 / 0 | 3 | 2 | n/a (not exercised) | **22719** |
| `aidakit:reviewer-security` | agent (2nd-order) | 0 / 0 / 0 / 0 | 1 (cond.) / 1 (cond.) / 0 / 0 | 2 | n/a (not individually metered) | n/a (not individually metered) | **21572** |
| `aidakit:acceptance-planner` | agent | 1 / 1 / 0 / 0 | 1 / 1 / 0 / 0 | 2 | 0 (prefix: not yet reached) | n/a (not exercised) | **16254** |
| `aidakit:adr-reviewer` | agent (2nd-order) | 0 / 0 / 0 / 0 | 1 / 1 / 0 / 0 | 2 | n/a (not individually metered) | n/a (not individually metered) | **12948** |
| `aidakit:brainstorm` | both | 1 / 0 / 0 / 0 | 1 / 0 / 0 / 0 | 1 | 1 | n/a (not exercised) | **10635** |
| `aidakit:research` | agent (2nd-order) | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 | n/a (not individually metered) | n/a (not individually metered) | **0** |

**Reading the extremes, not smoothing them:**

- `aidakit:doc-planner` ranks first not primarily because its body is the largest single agent file (13854 bytes, post-trim — `reviewer-architecture`'s 13154 is the next largest, a ~5.1% gap), but because it is *also* the only agent with a non-zero `static` count in **three** of the four flows (`full`, `fast`, `docs-onboarding`) — it is genuinely the most-reused first-order agent body in the kit's own flow graph, and the ranking gap to `reviewer-architecture` (41562 vs 26308, a lower-bound ratio of ~1.58×) is driven more by that reuse than by the body-size difference alone. **Ranking order is unaffected by the drift note above** — `doc-planner` was already ranked first before the re-measurement (44256) and remains first after it (45315); no other agent's position changes. **Nor by the `trim-doc-planner-agent-prompt` trim** — the further re-measurement (41562) leaves `doc-planner` first still; no other agent's position changes. **Nor by the `trim-reviewer-quality-agent-prompt` trim** — `reviewer-quality`'s rank drops from 2 to 6 (24882, below `reviewer-architecture`/`planner`/`tester`/`orchestrator`), and `reviewer-architecture` becomes the new rank 2; `doc-planner` stays first throughout.
- `aidakit:research` ranks last at a clean `0`, not because its body is small (5288 bytes, the second-smallest), but because the ranking metric structurally cannot see it: it never sits on any flow's happy path (§3b of `inventory.md`). A `0` ranking here is an artifact of the metric's blind spot for ad hoc/discretionary dispatch, not a claim that `research` is free to run.
- **`observed` vs `happy-path`, where they already diverge on `full`:** this run's `aidakit:spec-reviewer` observed count (2) already matches its `full` happy-path count (2) numerically, but for a **different reason** — the happy-path "2" comes from `critic` (1) + the review bench's base role (1), while this run's actual 2 dispatches are **both from `critic`** (round 1 `revise`, round 2 `ok` — the `record_critic_cause`→`specify` back-edge in `inventory.md` §2, consumed once this session per `retry-history.json`'s round-1 entry, `cause: "plan-citations-and-methodology-not-yet-measure-dont-recall-clean"`). The review bench has not run yet in this prefix. A coincidental numeric match is not the same claim as a structural one — recorded here explicitly rather than smoothed into "observed matches happy-path."
- `aidakit:plan` (a skill, not in this agent table — see §3) shows the clearest observed/happy-path gap: happy-path predicts 1 dispatch of the `specify`/`plan` step in a clean traversal; this run observed **2** (`.telemetry.jsonl` has two `aidakit:plan` rows), directly because of the same `critic`-revise back-edge above. The gap is the back-edge, named, not smoothed.

## §3 — Raw telemetry this table's `observed` column is grounded in

Same source as `evidence.md`'s `## Raw dispatch telemetry` section, re-quoted here for the ranking table's own traceability. Captured 2026-07-25, mid-`implement` (this dispatch), **8 lines — a prefix, not a total**:

```bash
cat .aidakit/tasks/workflow-script-optimization/.telemetry.jsonl
```

```
{"ts":"2026-07-25T12:53:26.287Z","subagent":"aidakit:orchestrator","cache_creation":62356,"cache_read":125910,"output_tokens":3747,"pack_size":0,"duration_ms":53425,"pack_rebuilt":false}
{"ts":"2026-07-25T12:53:46.862Z","subagent":"aidakit:identify-domain","cache_creation":0,"cache_read":0,"output_tokens":0,"pack_size":0,"duration_ms":0,"pack_rebuilt":false}
{"ts":"2026-07-25T12:54:01.225Z","subagent":"aidakit:brainstorm","cache_creation":397550,"cache_read":1377529,"output_tokens":44539,"pack_size":0,"duration_ms":331959,"pack_rebuilt":false}
{"ts":"2026-07-25T13:12:18.208Z","subagent":"aidakit:plan","cache_creation":491909,"cache_read":10705539,"output_tokens":73767,"pack_size":0,"duration_ms":1015840,"pack_rebuilt":false}
{"ts":"2026-07-25T13:20:50.440Z","subagent":"aidakit:spec-reviewer","cache_creation":294882,"cache_read":4985828,"output_tokens":36776,"pack_size":0,"duration_ms":475619,"pack_rebuilt":false}
{"ts":"2026-07-25T13:27:52.984Z","subagent":"aidakit:plan","cache_creation":446233,"cache_read":11386314,"output_tokens":24322,"pack_size":0,"duration_ms":375005,"pack_rebuilt":false}
{"ts":"2026-07-25T13:31:51.814Z","subagent":"aidakit:spec-reviewer","cache_creation":649237,"cache_read":3646729,"output_tokens":5388,"pack_size":0,"duration_ms":134332,"pack_rebuilt":false}
{"ts":"2026-07-25T13:38:24.251Z","subagent":"aidakit:readiness","cache_creation":321216,"cache_read":2654668,"output_tokens":19822,"pack_size":0,"duration_ms":260598,"pack_rebuilt":false}
```

Grouped by `subagent` (what `rollup.js`'s per-subagent table computes — `node governance/telemetry/rollup.js --change-id workflow-script-optimization` → `{"ok":true,"changeId":"workflow-script-optimization","dispatches":8}`): `aidakit:orchestrator` ×1, `aidakit:identify-domain` ×1 (all-zero — F3), `aidakit:brainstorm` ×1, `aidakit:plan` ×2, `aidakit:spec-reviewer` ×2, `aidakit:readiness` ×1.

## §4 — Skill-body table (14 skill-only dispatchers — separate, not merged)

```bash
wc -c -w skills/identify-domain/SKILL.md skills/plan/SKILL.md skills/readiness/SKILL.md skills/implement/SKILL.md skills/review/SKILL.md skills/test/SKILL.md skills/learn/SKILL.md skills/ship/SKILL.md skills/merge/SKILL.md skills/docs/SKILL.md skills/design-business/SKILL.md skills/design-modeling/SKILL.md skills/design-architecture/SKILL.md skills/design-implementation/SKILL.md
```

| Skill | words | bytes |
|---|---|---|
| `skills/identify-domain/SKILL.md` | 490 | 3409 |
| `skills/plan/SKILL.md` | 2194 | 15541 |
| `skills/readiness/SKILL.md` | 3465 | 23776 |
| `skills/implement/SKILL.md` | 1765 | 12846 |
| `skills/review/SKILL.md` | 3325 | 24334 |
| `skills/test/SKILL.md` | 1836 | 12908 |
| `skills/learn/SKILL.md` | 1738 | 12535 |
| `skills/ship/SKILL.md` | 770 | 5359 |
| `skills/merge/SKILL.md` | 1004 | 7130 |
| `skills/docs/SKILL.md` | 1791 | 11966 |
| `skills/design-business/SKILL.md` | 1716 | 11097 |
| `skills/design-modeling/SKILL.md` | 1449 | 9459 |
| `skills/design-architecture/SKILL.md` | 1675 | 11309 |
| `skills/design-implementation/SKILL.md` | 1825 | 11966 |
| **total** | **25043** | **173635** |

**Drift note:** `skills/readiness/SKILL.md` grew by 361 words / 2511 bytes between this file's first draft and this validation pass — the mandatory rebase onto `origin/main` (§ below, and `inventory.md` F4) pulled in `80610ab` (PR #52), which added "Process §14" (17 lines) to that exact file. The number above is the post-rebase measurement, re-run at validation time; the pre-rebase figure is not shown anywhere in this file (never shipped, corrected before authoring finished). **Re-measured again** (per-flow-commands, 2026-07-27): six more rows shifted (`plan`, `review`, `learn`, `design-business`, `design-architecture`, `design-implementation` SKILL.md) after the flow-build → `/aidakit:flow-fast`/`/aidakit:flow-full` cross-reference migration touched their prose — the same concurrent-worktree drift class this file's own regression gate (`governance/__tests__/regression-measured-body-size-tables-match-live-tree.test.mjs`) exists to catch; re-measured via `wc -c -w` against the live tree, not recalled.

**Why this is not merged into §2's agent ranking:** a skill's body loads into the **caller's own context** (it is read, not dispatched, when the flow's `invoke` step pauses for Claude to act on it); an agent's body starts a **fresh isolated context** via the `Agent` tool. Averaging a number that measures "how much of my own context this consumes" with a number that measures "how much a brand-new context starts with" would produce a figure that means nothing about either cost. `skills/review/SKILL.md` (24334 bytes) is the largest skill body on this tree — larger than every single `agents/*.md` file — precisely because it carries the whole bench-dispatch protocol (manifest-first, copy-paste `recordBench` shape, the seven `check-bench.js` invariants) inline, in the caller's context, rather than delegating that protocol to an isolated agent.

## §5 — Trim candidates handed to `inventory.md` §5

Per this file's own ranking, `aidakit:doc-planner` is the top-ranked agent body. It was handed to [`inventory.md`](inventory.md) §5's five-slot admission test as the illustrative trim candidate and **rejected** there (slot 2 — Predicate, and slot 4 — Precedent mirrored: a byte trim does not replace a judgment call with a deterministic check, and no existing leash shape describes pure compression). Prompt-trim/dispatch-cost Features are still registered on the roadmap (`docs/roadmap/epics/EPIC-context-caching.md`) citing this file's ranking rows directly — they are real follow-up work, just not admitted through the leash-conversion gate. See `inventory.md` §5's rejected table for the full reasoning.
