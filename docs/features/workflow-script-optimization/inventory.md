# Inventory — workflow-script-optimization

**Change ID:** `workflow-script-optimization`
**Measured at commit:** `fa580e5`
**Date:** `2026-07-25`

> **Scope.** This is the entry point of a **two-file single artifact**: this file (`inventory.md` — method, the four per-flow step tables, the dispatcher register, the findings, the candidate register) and [`dispatch-cost.md`](dispatch-cost.md) (the measured agent-prompt cost table + the skill-body table). Neither is complete without the other — the split exists only because the combined content overflows [DOCS.md](../../../DOCS.md) §5's ~4-page ceiling; it is not a thematic split. Together the two files satisfy criterion `inventory-artifact-exists` (see [proposal.md](proposal.md) §Acceptance criteria).
>
> **Anti-scope.** No product code, no flow YAML edit, no agent/skill prompt edit ships in this change ([design.md](design.md) §8 — the audit-only invariant). Every number below carries the exact command (with flags and paths) that reproduces it, re-run against this tree at authoring time — never copied from [design.md](design.md) or [proposal.md](proposal.md) (criterion `no-fabricated-token-numbers`).

---

## §1 — Method

The step inventory (§2) and the dispatcher register (§3) are both derived mechanically from `governance/flows/*.yaml` and from file existence under `agents/` and `skills/`. Four reproduction commands, re-run on this tree at authoring time:

### Step count per flow

```bash
for f in full fast design docs-onboarding; do printf '%s: ' "$f"; grep -cE '^\s+- id:' governance/flows/$f.yaml; done
```

```
full: 36
fast: 23
design: 10
docs-onboarding: 9
```

### Type histogram per flow

The leading `/^  - id:/` guard is load-bearing: a bare `grep 'type:'` also catches the flow's `inputs:` block (`type: string`, `type: enum`) and inflates the count.

```bash
for f in full fast design docs-onboarding; do printf '%s: ' "$f"; \
  awk '/^  - id:/{f=1} f&&/^    type:/{print $2; f=0}' governance/flows/$f.yaml | sort | uniq -c | tr '\n' ' '; echo; done
```

```
full:    4 human_gate   15 invoke   15 runs    2 terminal
fast:    3 human_gate    9 invoke    9 runs    2 terminal
design:    4 human_gate    5 invoke    1 terminal
docs-onboarding:    1 human_gate    4 invoke    2 runs    2 terminal
```

### id/type/target/cap skeleton (example: `full`)

```bash
grep -nE '^\s+- id:|^\s+type:|^\s+invoke_target:|^\s+max_visits:|^\s+on_max_visits:' governance/flows/full.yaml
```

Used to build the `routing` column of §2 for all four flows (run once per flow file; not pasted in full here for space — every routing cell in §2 was produced this way and is independently reproducible).

### Dispatch tier: agent, skill, or both

```bash
for t in orchestrator identify-domain brainstorm plan spec-reviewer readiness implement review test learn ship doc-planner acceptance-planner merge docs design-business design-modeling design-architecture design-implementation; do
  a=""; s=""; [ -f agents/$t.md ] && a=agent; [ -f skills/$t/SKILL.md ] && s=skill; \
  printf '%-22s %s %s\n' "$t" "$a" "$s"
done
```

```
orchestrator           agent
identify-domain         skill
brainstorm             agent skill
plan                    skill
spec-reviewer          agent
readiness               skill
implement               skill
review                  skill
test                    skill
learn                   skill
ship                    skill
doc-planner            agent
acceptance-planner     agent
merge                   skill
docs                    skill
design-business         skill
design-modeling         skill
design-architecture     skill
design-implementation   skill
```

Only `brainstorm` resolves to `both` (an `agents/brainstorm.md` AND a `skills/brainstorm/SKILL.md` both exist). Every other `invoke_target` resolves to exactly one tier.

---

## §2 — The step inventory (four flows, equal depth)

One table per flow, ordered by **step count descending** — `full` (36) · `fast` (23) · `design` (10) · `docs-onboarding` (9). This order is a mechanical property of the files (`grep -cE '^\s+- id:'`) and **encodes no priority**: the owner's `all-4-equal-priority` decision (`brainstorm.json`, axis `scope-flows`) is honoured by giving every flow the identical column set, the identical judgment pass and the identical candidate treatment — `design.yaml` (5 `invoke`, 0 `runs`, 4 `human_gate`) gets the same depth as `full.yaml` despite being the smallest table.

Columns: `#` (position in the YAML) · `id` · `type` · `invoke_target` · `dispatch tier` · `command` (abbreviated executable + script, `runs` steps only) · `routing` (back-edges marked, `max_visits`/`on_max_visits` noted when declared) · `judgment` (`load-bearing` / `checklist-shaped` / `n/a (deterministic)` / `n/a (human gate)` / `n/a (terminal)` — the four-question test of §3b applied per dispatcher) · `candidate` (id from §5, or `—`).

Every judgment verdict below applies the same four questions to the same named dispatcher wherever it recurs across the four tables (design.md §3b) — a dispatcher does not get a different verdict in `fast` than in `full`.

### `full.yaml` — measured at `fa580e5` (36 steps)

| # | id | type | invoke_target | tier | command | routing | judgment | candidate |
|---|---|---|---|---|---|---|---|---|
| 1 | select | invoke | aidakit:orchestrator | agent | — | success→classify; failure→aborted | load-bearing (fails Q1 — picking/confirming the "ready" change from repo state is meaning-based) | — |
| 2 | classify | invoke | aidakit:identify-domain | skill | — | success→brainstorm; failure→aborted | load-bearing (fails Q1 — domain×type×flags classification from free text) | F1 (contract gap, not a step-shape conversion) |
| 3 | brainstorm | invoke | aidakit:brainstorm | both | — | done→specify; skipped→specify | load-bearing (fails Q1 — kept deliberately, brainstorm assumption 4) | — |
| 4 | specify | invoke | aidakit:plan | skill | — | max_visits: 3, on_max_visits: specify_escalation; success→commit_plan; failure→aborted; **re-entry target** of 2 back-edges (rows 8, 11) | load-bearing (fails Q1 — authoring proposal/design/tasks is design judgment) | — |
| 5 | specify_escalation | human_gate | — | — | — | abort→aborted | n/a (human gate — GOVERNANCE.md §1 scope escalation) | — |
| 6 | commit_plan | runs | — | — | `git add` / `git commit` (best-effort) | success→critic; failure→critic — **fail-safe pass-through**, both routes forward | n/a (deterministic) | — |
| 7 | critic | invoke | aidakit:spec-reviewer | agent | — | ok→pre_apply; revise→record_critic_cause | load-bearing (fails Q1 — kept deliberately, brainstorm assumption 4) | — |
| 8 | record_critic_cause | runs | — | — | `node append-retry-history.js` | success→specify **(back-edge)**; failure→specify **(back-edge)** — capped via row 4's `max_visits: 3` | n/a (deterministic) | — |
| 9 | pre_apply | human_gate | — | — | — | yes→readiness; no→aborted | n/a (human gate) | — |
| 10 | readiness | invoke | aidakit:readiness | skill | — | approved→context_pack; needs-revision→record_readiness_cause; blocked→aborted | load-bearing (fails Q1 — see §4 finding F5: the step's own description says "mechanical GATE 1" but the dispatched skill reviews cross-artifact consistency and "hidden architecture decisions"; [ADR-015](../../decisions/ADR-015-readiness-owns-internals-claims-gate.md) §Decision-1 locks readiness as the owner of a mandatory semantic gate) | — |
| 11 | record_readiness_cause | runs | — | — | `node append-retry-history.js` | success→specify **(back-edge)**; failure→specify **(back-edge)** — same cap as row 8 | n/a (deterministic) | — |
| 12 | context_pack | runs | — | — | `node check-context-pack-freshness.js \|\| node build.js` | success→implement; failure→implement — **fail-safe pass-through** | n/a (deterministic) | — |
| 13 | implement | invoke | aidakit:implement | skill | — | success→check_implement_bench; failure→aborted; **re-entry target** of 3 back-edges (rows 15, 19, 21) | load-bearing (fails Q1 — kept deliberately, brainstorm assumption 4) | — |
| 14 | check_implement_bench | runs | — | — | `test ! -f ... \|\| node check-bench.js --bench implement` | success→review_bench; failure→record_check_implement_cause | n/a (deterministic) | — |
| 15 | record_check_implement_cause | runs | — | — | `node append-retry-history.js` | success→implement **(back-edge, uncapped)**; failure→implement **(back-edge, uncapped)** | n/a (deterministic) | — |
| 16 | review_bench | invoke | aidakit:review | skill | — | consensus→check_review_bench; rejected→check_review_bench | load-bearing (fails Q1 — kept deliberately, brainstorm assumption 4) | — |
| 17 | check_review_bench | runs | — | — | `node check-bench.js --bench review` | success→bench_outcome; failure→review_bench **(back-edge, uncapped)** | n/a (deterministic) | — |
| 18 | bench_outcome | runs | — | — | `test "$outcome" = consensus` | success→hardening; failure→record_bench_outcome_cause | n/a (deterministic) | — |
| 19 | record_bench_outcome_cause | runs | — | — | `node append-retry-history.js` | success→implement **(back-edge, uncapped)**; failure→implement **(back-edge, uncapped)** | n/a (deterministic) | — |
| 20 | hardening | invoke | aidakit:test | skill | — | success→learn; failure→record_hardening_cause | load-bearing (fails Q1 — anti-hardcode detection and "hard DoD" assessment need test-meaning judgment beyond exit code) | hardening-split (admitted, §5) |
| 21 | record_hardening_cause | runs | — | — | `node append-retry-history.js` | success→implement **(back-edge, uncapped)**; failure→implement **(back-edge, uncapped)** | n/a (deterministic) | — |
| 22 | learn | invoke | aidakit:learn | skill | — | success→dna_gate; failure→dna_gate — **fail-safe pass-through** | load-bearing (fails Q1 — kept deliberately, brainstorm assumption 4) | — |
| 23 | dna_gate | runs | — | — | `test -d .aidakit/dna/<id> && ls -A` | success→dna_freshness; failure→document | n/a (deterministic) | — |
| 24 | dna_freshness | runs | — | — | `node check-dna-freshness.js` | success→dna_pr; failure→learn **(back-edge, uncapped)** | n/a (deterministic) | — |
| 25 | dna_pr | invoke | aidakit:ship | skill | — | success→document; failure→document — **fail-safe pass-through** | load-bearing (fails Q1 — commit-message/PR-narrative composition; see §5 rejected) | — |
| 26 | document | invoke | aidakit:doc-planner | agent | — | success→check_docs; failure→aborted | load-bearing (fails Q1 — decides mandatory-doc rigor + authors the missing docs) | — |
| 27 | check_docs | runs | — | — | `node check-doc-manifest.js` | success→acceptance; failure→document **(back-edge, uncapped)** | n/a (deterministic) | — |
| 28 | acceptance | invoke | aidakit:acceptance-planner | agent | — | success→check_acceptance; failure→aborted | load-bearing (fails Q1 — evidence-path judgment; already the writer half of the acceptance-leash pair) | — |
| 29 | check_acceptance | runs | — | — | `node check-acceptance.js` | max_visits: 3, on_max_visits: acceptance_escalation; success→pr; failure→acceptance **(back-edge, capped)** | n/a (deterministic) | — |
| 30 | acceptance_escalation | human_gate | — | — | — | abort→aborted | n/a (human gate — GOVERNANCE.md §1 scope escalation) | — |
| 31 | pr | invoke | aidakit:ship | skill | — | success→merge_route; failure→aborted | load-bearing (fails Q1 — commit-message/PR-narrative composition; see §5 rejected) | — |
| 32 | merge_route | runs | — | — | `node check-pr-automation.js --field auto_merge` | success→auto_merge; failure→merge | n/a (deterministic) — **excluded from candidacy** (escalation family, §3c hard bound) | — |
| 33 | auto_merge | invoke | aidakit:merge | skill | — | merged→done; blocked→merge; failure→merge | load-bearing-adjacent — **excluded from candidacy regardless of verdict** (§3c hard bound: touches the `merge` family) | — |
| 34 | merge | human_gate | — | — | — | merged→done; discard→aborted | n/a (human gate — GOVERNANCE.md §1 escalation 1, PR merge) | — |
| 35 | done | terminal | — | — | — | outcome: completed | n/a (terminal) | — |
| 36 | aborted | terminal | — | — | — | outcome: aborted | n/a (terminal) | — |

**Back-edges in `full.yaml` (9 total):** `record_critic_cause`→`specify`, `record_readiness_cause`→`specify` (both capped via `specify`'s `max_visits: 3` / `on_max_visits: specify_escalation`); `record_check_implement_cause`→`implement`, `record_bench_outcome_cause`→`implement`, `record_hardening_cause`→`implement` (all three uncapped); `check_review_bench`→`review_bench` (uncapped); `dna_freshness`→`learn` (uncapped); `check_docs`→`document` (uncapped); `check_acceptance`→`acceptance` (capped via `check_acceptance`'s own `max_visits: 3` / `on_max_visits: acceptance_escalation`). Per [ADR-011](../../decisions/ADR-011-runs-infra-error-routing.md), every `runs` step's `on_failure` above routes a **verdict** (exit 1); an infra error (exit 127/126/250 or a signal) hard-stops the flow instead and never reaches `on_failure`.

### `fast.yaml` — measured at `fa580e5` (23 steps)

| # | id | type | invoke_target | tier | command | routing | judgment | candidate |
|---|---|---|---|---|---|---|---|---|
| 1 | route_mode | runs | — | — | `test "$mode" = register` | success→check_registered; failure→select | n/a (deterministic) | — |
| 2 | check_registered | runs | — | — | `node derive-roadmap-status.js --change` | success→parked; failure→aborted | n/a (deterministic) | — |
| 3 | parked | human_gate | — | — | — | plan→select; discard→aborted | n/a (human gate — registration park, resumable) | — |
| 4 | select | invoke | aidakit:orchestrator | agent | — | success→plan; failure→aborted | load-bearing (fails Q1, same dispatcher as `full`'s `select`) | — |
| 5 | plan | invoke | aidakit:plan | skill | — | success→readiness; failure→aborted | load-bearing (fails Q1, same dispatcher as `full`'s `specify`) | — |
| 6 | readiness | invoke | aidakit:readiness | skill | — | approved→context_pack; needs-revision→plan **(back-edge, uncapped — no `max_visits` on `plan`, no retry-writer step in `fast`)**; blocked→aborted | load-bearing (fails Q1, see F5; [ADR-015](../../decisions/ADR-015-readiness-owns-internals-claims-gate.md) §Decision-1) | — |
| 7 | context_pack | runs | — | — | `node check-context-pack-freshness.js \|\| node build.js` | success→implement; failure→implement — **fail-safe pass-through** | n/a (deterministic) | — |
| 8 | implement | invoke | aidakit:implement | skill | — | success→check_implement_bench; failure→aborted | load-bearing (fails Q1, kept deliberately) | — |
| 9 | check_implement_bench | runs | — | — | `test ! -f ... \|\| node check-bench.js --bench implement` | success→review; failure→implement **(back-edge, uncapped)** | n/a (deterministic) | — |
| 10 | review | invoke | aidakit:review | skill | — | pass→check_review_bench; fail→check_review_bench | load-bearing (fails Q1, kept deliberately) | — |
| 11 | check_review_bench | runs | — | — | `node check-bench.js --bench review` | success→review_outcome; failure→review **(back-edge, uncapped)** | n/a (deterministic) | — |
| 12 | review_outcome | runs | — | — | `test "$outcome" = pass` | success→document; failure→implement **(back-edge, uncapped)** | n/a (deterministic) | — |
| 13 | document | invoke | aidakit:doc-planner | agent | — | success→check_docs; failure→aborted | load-bearing (fails Q1, same dispatcher as `full`) | — |
| 14 | check_docs | runs | — | — | `node check-doc-manifest.js` | success→acceptance; failure→document **(back-edge, uncapped)** | n/a (deterministic) | — |
| 15 | acceptance | invoke | aidakit:acceptance-planner | agent | — | success→check_acceptance; failure→aborted | load-bearing (fails Q1, same dispatcher as `full`) | — |
| 16 | check_acceptance | runs | — | — | `node check-acceptance.js` | max_visits: 3, on_max_visits: acceptance_escalation; success→pr; failure→acceptance **(back-edge, capped)** | n/a (deterministic) | — |
| 17 | acceptance_escalation | human_gate | — | — | — | abort→aborted | n/a (human gate — GOVERNANCE.md §1 scope escalation) | — |
| 18 | pr | invoke | aidakit:ship | skill | — | success→merge_route; failure→aborted | load-bearing (fails Q1, see §5 rejected) | — |
| 19 | merge_route | runs | — | — | `node check-pr-automation.js --field auto_merge` | success→auto_merge; failure→merge | n/a (deterministic) — **excluded from candidacy** | — |
| 20 | auto_merge | invoke | aidakit:merge | skill | — | merged→done; blocked→merge; failure→merge | **excluded from candidacy** (§3c hard bound) | — |
| 21 | merge | human_gate | — | — | — | merged→done; discard→aborted | n/a (human gate — GOVERNANCE.md §1 escalation 1) | — |
| 22 | done | terminal | — | — | — | outcome: completed | n/a (terminal) | — |
| 23 | aborted | terminal | — | — | — | outcome: aborted | n/a (terminal) | — |

**Back-edges in `fast.yaml` (6 total):** `readiness`→`plan`, `check_implement_bench`→`implement`, `check_review_bench`→`review`, `review_outcome`→`implement`, `check_docs`→`document` (all five uncapped — `fast` has no `record_*_cause` retry-memory writer steps at all, unlike `full`); `check_acceptance`→`acceptance` (capped, same shape as `full`).

### `design.yaml` — measured at `fa580e5` (10 steps)

| # | id | type | invoke_target | tier | command | routing | judgment | candidate |
|---|---|---|---|---|---|---|---|---|
| 1 | prepare | invoke | aidakit:docs | skill | — | new→phase1; resume→phase1 | load-bearing (fails Q1 — audits `docs/design/STATE.md`, decides the resume phase) | — |
| 2 | phase1 | invoke | aidakit:design-business | skill | — | success→gate1 | load-bearing (fails Q1 — interview-driven business-vision authoring) | — |
| 3 | gate1 | human_gate | — | — | — | approve→phase2; revise→phase1 **(back-edge, uncapped)** | n/a (human gate) | — |
| 4 | phase2 | invoke | aidakit:design-modeling | skill | — | success→gate2 | load-bearing (fails Q1 — DDD modeling authorship) | — |
| 5 | gate2 | human_gate | — | — | — | approve→phase3; revise→phase2 **(back-edge, uncapped)** | n/a (human gate) | — |
| 6 | phase3 | invoke | aidakit:design-architecture | skill | — | success→gate3 | load-bearing (fails Q1 — architecture + ADR authorship) | — |
| 7 | gate3 | human_gate | — | — | — | approve→phase4; revise→phase3 **(back-edge, uncapped)** | n/a (human gate) | — |
| 8 | phase4 | invoke | aidakit:design-implementation | skill | — | success→gate4 | load-bearing (fails Q1 — scaffold + risk-ordered backlog authorship) | — |
| 9 | gate4 | human_gate | — | — | — | approve→done; revise→phase4 **(back-edge, uncapped)** | n/a (human gate) | — |
| 10 | done | terminal | — | — | — | outcome: completed | n/a (terminal) | — |

**Back-edges in `design.yaml` (4 total):** every `gateN`'s `revise` route loops back to its own `phaseN`, all uncapped — no `max_visits` is declared anywhere in this flow. `design.yaml` has **no `aborted` terminal** (only `done`) and **zero `runs` steps** — every non-gate step is an `invoke`, and, notably, **none of its five `invoke_target`s resolve to `agents/*.md`** (all five are skill-only tier — see §2's tier column and §3c). This is a mechanical property of the file, not an omission by this audit.

### `docs-onboarding.yaml` — measured at `fa580e5` (9 steps)

| # | id | type | invoke_target | tier | command | routing | judgment | candidate |
|---|---|---|---|---|---|---|---|---|
| 1 | inventory | invoke | aidakit:docs | skill | — | ok→manifest; issues→manifest | load-bearing (fails Q1 — X-ray audit incl. malformatted-ADR/index-drift detection) | — |
| 2 | manifest | invoke | aidakit:doc-planner | agent | — | success→diff; failure→aborted | load-bearing (fails Q1 — target-list authorship) | — |
| 3 | diff | runs | — | — | `node check-doc-manifest.js .aidakit/doc-manifest-project.json` | success→propose; failure→propose — **fail-safe pass-through** | n/a (deterministic) | — |
| 4 | propose | invoke | aidakit:docs | skill | — | success→gate_migration; failure→aborted | load-bearing (fails Q1 — migration-map + retroactive-ADR reconstruction from code) | — |
| 5 | gate_migration | human_gate | — | — | — | approve→apply; revise→propose **(back-edge, uncapped)** | n/a (human gate — DOCS.md / GOVERNANCE.md §1 move-gate) | — |
| 6 | apply | invoke | aidakit:docs | skill | — | success→check; failure→aborted | load-bearing (fails Q1 — executes migration + writes retroactive ADRs) | — |
| 7 | check | runs | — | — | `node check-doc-manifest.js .aidakit/doc-manifest-project.json` | success→done; failure→apply **(back-edge, uncapped)** | n/a (deterministic) | — |
| 8 | done | terminal | — | — | — | outcome: completed | n/a (terminal) | — |
| 9 | aborted | terminal | — | — | — | outcome: aborted | n/a (terminal) | — |

**Back-edges in `docs-onboarding.yaml` (2 total):** `gate_migration`→`propose`, `check`→`apply`, both uncapped.

---

## §3 — Dispatcher register

`grep invoke_target governance/flows/*.yaml` only finds **first-order** dispatch. Measured on this tree, the four flows name **19 distinct targets** (union of the invoke_target lists in §2), and only **5 of the 13 `agents/*.md`** are among them. The remaining **8** never appear in a flow YAML — they reach the wire as **second-order** dispatches, fired from inside a skill's own body (§3b).

```bash
grep -ohE 'invoke_target: [a-zA-Z0-9:_-]+' governance/flows/*.yaml | sort -u | wc -l
# → 19
```

**The `-h` flag is load-bearing, not decoration.** `grep -oE` (no `-h`) given multiple file arguments prepends `filename:` to every match, so `sort -u` dedupes `(file, target)` pairs, not target names — it prints **30**, not 19 (`full.yaml`'s 14 distinct targets + `fast.yaml`'s 9 + `design.yaml`'s 5 + `docs-onboarding.yaml`'s 2, none deduped against each other because each carries a different filename prefix). Caught by re-running this exact command at authoring time per criterion `no-fabricated-token-numbers` — the flags are part of the citation for exactly this reason (§3a below).

### §3a — First-order table (targets named directly by a flow YAML)

Only 5 of the 13 `agents/*.md` appear here: **`aidakit:orchestrator`, `aidakit:brainstorm`, `aidakit:spec-reviewer`, `aidakit:doc-planner`, `aidakit:acceptance-planner`.**

| Agent | Tier | Named by | Step id(s) | Judgment (question failed) |
|---|---|---|---|---|
| `aidakit:orchestrator` | agent | `full`, `fast` | `select` | load-bearing (Q1 — meaning-based readiness assessment) |
| `aidakit:brainstorm` | both | `full` | `brainstorm` | load-bearing (Q1 — kept deliberately, brainstorm assumption 4) |
| `aidakit:spec-reviewer` | agent | `full` | `critic` | load-bearing (Q1 — kept deliberately, brainstorm assumption 4) — **dual-sourced, see note below** |
| `aidakit:doc-planner` | agent | `full`, `fast`, `docs-onboarding` | `document` (`full`/`fast`), `manifest` (`docs-onboarding`) | load-bearing (Q1 — mandatory-doc rigor decision + drafting) |
| `aidakit:acceptance-planner` | agent | `full`, `fast` | `acceptance` | load-bearing (Q1 — evidence-path judgment; writer half of the acceptance-leash) |

**`aidakit:spec-reviewer` is the one dispatcher that is genuinely BOTH first-order and second-order, and this register states that fact explicitly rather than leaving it as a [dispatch-cost.md](dispatch-cost.md) footnote.** First-order: the `critic` step's `invoke_target` names it directly (`full.yaml:129`, re-verified `grep -n 'invoke_target: aidakit:spec-reviewer' governance/flows/full.yaml` → `129`). Second-order: `skills/review/SKILL.md` step 4 names it as one of the **two base roles that run always** inside the review bench — "assemble the prompts for the two **base** reviewer agents (`aidakit:adr-reviewer` and `aidakit:spec-reviewer`, which run always)" (`skills/review/SKILL.md:52`, re-verified `grep -n 'aidakit:spec-reviewer' skills/review/SKILL.md` this pass). The two dispatches are independent events with independent verdicts (`critic`'s spec-review of the *plan*, pre-implementation; the bench's spec-review of the *diff*, pre-ship) — §2's `full` table row 7 (`critic`) and §3b's `aidakit:adr-reviewer` row's review-bench source both cite the same skill for the base-role half of this dispatcher's total frequency. `dispatch-cost.md`'s ranking table already counts both paths in its `static`/`happy-path` columns (`static: full=1` from the `critic` step's own `invoke_target` count, `happy-path: full=2` = `critic` (1) + review-bench base role (1)) — this note is what that number was always describing; it is now also stated in prose, not left implicit in a table cell.

### §3b — Second-order table (the 8 agents dispatched from inside a skill)

**Authoritative source for the review bench's roles:** the step-5 matrix in [skills/review/SKILL.md](../../../skills/review/SKILL.md) + `governance/validators/check-bench.js`'s `__manifest__` contract — the manifest is the round's declared role list, and `role-missing`/`consensus-mismatch` are what make it honest.

**Correction to the plan's own simplification.** [design.md](design.md) §3a describes the 8 second-order agents as reached via "the review bench... and the implement per-surface fan-out" — true for **6 of the 8**, but re-verified against the live tree, `aidakit:planner` and `aidakit:research` are **not** dispatched from either of those two skills:

```bash
grep -n 'aidakit:planner' skills/plan/SKILL.md | sed -n '1,3p'
# → skills/plan/SKILL.md:50:   > - Explicit instruction to invoke `aidakit:planner` (`subagent_type: "aidakit:planner"`) to author the artifacts...
grep -n 'aidakit:research' skills/spec/SKILL.md agents/orchestrator.md
# → skills/spec/SKILL.md:156:If the spec has open questions that require investigation, delegate the research to `aidakit:research`.
# → agents/orchestrator.md:120:- Adding a discovery task ... delegate the investigation itself to `aidakit:research` when it warrants one
```

- `aidakit:planner` is dispatched from **`skills/plan/SKILL.md`** — the skill packages a self-contained prompt instructing a **fresh session** to invoke `aidakit:planner` (`subagent_type: "aidakit:planner"`, `skills/plan/SKILL.md:50`). `plan` (the skill) **is** a flow-named first-order dispatcher (`invoke_target: aidakit:plan` at `specify` in `full` and `plan` in `fast`), so `planner`'s second-order path is 1:1 with those two steps' visits — it is not part of the bench or the fan-out.
- `aidakit:research` is dispatched from **`skills/spec/SKILL.md:156`** (ad hoc — `spec` is **not** named as an `invoke_target` by any flow YAML, confirmed: `grep -rn 'invoke_target: aidakit:spec\b' governance/flows/` returns nothing) **or** discretionarily from inside **`agents/orchestrator.md:120`** (the orchestrator agent itself may delegate to research "when it warrants one", entirely at its own judgment, not on any flow's happy path). `research` is therefore the one second-order agent with **no flow-reachable static count at all** — its only paths are an ad hoc `/aidakit:spec` invocation or a first-order agent's own discretion.

| Agent | Source | Role / condition | Judgment (question failed) |
|---|---|---|---|
| `aidakit:adr-reviewer` | review bench (`skills/review/SKILL.md` step 5) | role "ADRs" — summoned **always** | load-bearing (Q1 — conformance-with-decisions review) |
| `aidakit:reviewer-quality` | review bench | role "quality" — **always** when there's a code diff | load-bearing (Q1 — severity-tagged code judgment) |
| `aidakit:reviewer-security` | review bench | role "security" — flag `contract`, or diff touches auth/sensitive-data/crypto/config | load-bearing (Q1 — vulnerability judgment) |
| `aidakit:reviewer-architecture` | review bench | role "architecture" — flag `architecture`/`contract`, or diff crosses a layer boundary | load-bearing (Q1 — ownership/boundary judgment) |
| `aidakit:tester` | review bench | role "tests" — **always** when there's a code diff | load-bearing (Q1 — behavioral coverage judgment) |
| `aidakit:implementer` | implement fan-out (`skills/implement/SKILL.md`) | 1 dispatch (single-surface); **1 per surface, same message**, for a multi-surface change (§"Multi-surface change (parallel)") | load-bearing (Q1 — kept deliberately, brainstorm assumption 4) |
| `aidakit:planner` | `skills/plan/SKILL.md:50` (fresh-session instruction, **not** a bench/fan-out) | 1 dispatch per `specify`/`plan` step visit | load-bearing (Q1 — plan authorship) |
| `aidakit:research` | `skills/spec/SKILL.md:156` (ad hoc) **or** `agents/orchestrator.md:120` (discretionary) | not on any flow's happy path — 0 static, 0 happy-path across all 4 flows (see [dispatch-cost.md](dispatch-cost.md)) | load-bearing (Q1 — open-question investigation) |

**Not a 9th row — `aidakit:spec-reviewer` does not belong in this table, because it is not *only* second-order.** It is the base bench role in `skills/review/SKILL.md` step 4 (`aidakit:spec-reviewer`, always summoned — `skills/review/SKILL.md:52`) in addition to being the first-order `critic` dispatcher (§3a above). Counting it here as an 8th-plus-one would double-count against §3a's 5-agent first-order table and against the "8 second-order agents" figure this section's own header states; the dual sourcing is recorded once, in the §3a row's note, and cross-referenced from here rather than duplicated.

**Forbidden derivation — counter-example, re-verified on this tree:**

```bash
grep -roE 'aidakit:planner' skills/ commands/ | wc -l   # → 25  (occurrences, skills/+commands/)
grep -roE 'aidakit:planner' skills/ | wc -l              # → 24  (occurrences, skills/ only)
grep -rc 'aidakit:planner' skills/ | awk -F: '{s+=$2} END{print s}'   # → 23  (lines-with-a-match, summed per file)
grep -rn 'invoke_target: aidakit:planner' governance/flows/   # → (empty) — 0 dispatches by any shipped flow
```

25, 24, 23 and 0 are all correct answers to four **different** questions — mentions (two flag variants) vs. dispatches. None of them is a frequency number. A frequency number in [dispatch-cost.md](dispatch-cost.md) that came from any of the first three would be a fabricated number under criterion `no-fabricated-token-numbers`. Every table cell in this file and in `dispatch-cost.md` therefore carries the exact command **including its flags and path arguments**.

### §3c — Skill-only dispatchers table (14 skills named by the flows, no `agents/*.md` equivalent)

Per brainstorm assumption 5, the audit covers every LLM dispatch a flow triggers, not only `agents/*.md`.

| Skill | Named by | Step id(s) | Judgment (question failed) |
|---|---|---|---|
| `aidakit:identify-domain` | `full` | `classify` | load-bearing (Q1 — domain×type×flags classification) |
| `aidakit:plan` | `full` (`specify`), `fast` (`plan`) | `specify`, `plan` | load-bearing (Q1 — plan authorship, second-order dispatches `planner`) |
| `aidakit:readiness` | `full`, `fast` | `readiness` | load-bearing (Q1 — see F5; the flow's own "mechanical GATE 1" label disagrees with the skill's actual process; [ADR-015](../../decisions/ADR-015-readiness-owns-internals-claims-gate.md) §Decision-1 locks it as a semantic gate) |
| `aidakit:implement` | `full`, `fast` | `implement` | load-bearing (Q1 — kept deliberately, second-order dispatches `implementer`) |
| `aidakit:review` | `full` (`review_bench`), `fast` (`review`) | `review_bench`, `review` | load-bearing (Q1 — kept deliberately, second-order dispatches the bench) |
| `aidakit:test` | `full` | `hardening` | load-bearing (Q1 — anti-hardcode + hard-DoD judgment; see hardening-split candidate, §5) |
| `aidakit:learn` | `full` | `learn` | load-bearing (Q1 — kept deliberately, learning consolidation) |
| `aidakit:ship` | `full` (`dna_pr`, `pr`), `fast` (`pr`) | `dna_pr`, `pr` | load-bearing (Q1 — commit-message/PR-narrative composition; see §5 rejected) |
| `aidakit:merge` | `full`, `fast` | `auto_merge` | **excluded from candidacy** (§3c hard bound — touches the `merge` family) regardless of verdict |
| `aidakit:docs` | `design` (`prepare`), `docs-onboarding` (`inventory`, `propose`, `apply`) | `prepare`, `inventory`, `propose`, `apply` | load-bearing (Q1 — audits/migrates/reconstructs retroactive ADRs from code) |
| `aidakit:design-business` | `design` | `phase1` | load-bearing (Q1 — interview-driven authorship) |
| `aidakit:design-modeling` | `design` | `phase2` | load-bearing (Q1 — DDD modeling authorship) |
| `aidakit:design-architecture` | `design` | `phase3` | load-bearing (Q1 — architecture + ADR authorship) |
| `aidakit:design-implementation` | `design` | `phase4` | load-bearing (Q1 — scaffold + backlog authorship) |

**All 14 skill-only dispatchers rate load-bearing.** This is not a weak pass — it is the audit's central empirical result for §3: the kit has **already** converted everything mechanically checklist-shaped in these flows into `runs` steps (`commit_plan`, every `record_*_cause`, `context_pack`, every `check_*`, `bench_outcome`, `dna_gate`, `dna_freshness`, `merge_route`, `diff`/`check` in `docs-onboarding`). The remaining `invoke` steps are load-bearing by construction, not by an audit oversight. §5's candidate register reflects this: the low-hanging fruit is exhausted, and the two admitted candidates are a **data-contract fix** (F1) and a **partial step split** (hardening), not further whole-step conversions.

---

## §4 — Findings

Fixed shape per finding: **what · mechanical evidence (`path:line` or command + output) · leash family · routed to.**

**F1 — `classify` feeds its outcome where a domain belongs.** `governance/flows/full.yaml:61` declares `domain: "${context.classify.outcome}"` (`grep -n 'domain:' governance/flows/full.yaml` → `61`), and the `classify` step (`governance/flows/full.yaml:43`–`53`, bounded by `grep -n '  - id: classify' governance/flows/full.yaml` → `43` and `grep -n '  - id: brainstorm' governance/flows/full.yaml` → `55`) declares no `outputs:`, so `context.classify` holds only `{outcome, invoke_target}`. This run's own state file confirms the result live: `.aidakit/flows/state/full-260725-642b02.json`, `step_history[4].output.input.domain: "success"` (re-verified this authoring session — `step_history[4]` is the `brainstorm` step's own input, and `domain` there literally reads `"success"`, the `classify` step's outcome string). Family: [ADR-006](../../decisions/ADR-006-flow-values-as-data.md) §Decision-2, the same gap `flow-request-vs-change-id` closed for `select`/`change_id`. Routed to `EPIC-flow-engine-leashes`. **Not fixed here** — a flow YAML edit is exactly what `audit-only-no-flow-edits` forbids.

**F2 — the telemetry rollup discards two persisted fields.** `output_tokens` and `duration_ms` are written by `governance/telemetry/append.js` and never read by `computeRollup`/`renderRollupSection` in `governance/telemetry/rollup.js` (`grep -c "output_tokens" governance/telemetry/rollup.js` → `0`, re-verified this session). Family: kit hygiene (reader ignores what the writer emits — same shape as F5 below). Routed to `EPIC-kit-discipline-hardening` — where F4 records that the two `context-pack-heading-*` Features already sitting there are both pre-existing **and** already shipped; do not join them with a third and do not touch them.

**F3 — package-carried state makes some `invoke` steps free on re-entry.** `classify` and `brainstorm` cost 0 new LLM tokens on this run: `.aidakit/tasks/workflow-script-optimization/.telemetry.jsonl`'s `aidakit:identify-domain` row is all-zero (`cache_creation: 0, cache_read: 0, output_tokens: 0, duration_ms: 0`) because the classification/brainstorm verdict were reused from the change package. Family: observation, not defect — the strongest empirical argument in this audit that step *count* is the wrong optimization target; it constrains [dispatch-cost.md](dispatch-cost.md)'s ranking (a step free on re-entry cannot be ranked by static frequency alone). Routed to the cost table's method section, not to a Feature.

**F4 — roadmap declarations lagging shipped work is a recurring pattern, caught twice on this tree at two different dated snapshots, self-correcting between them.** `node governance/validators/derive-roadmap-status.js --root . --json`, re-run at this pass (post-rebase onto `origin/main`'s `6af0e7a`, commit `8a6ce73`), reports **4 pre-existing orphans**, `ok=true`: `post-merge-sweep`, `engine-parallel-fate`, `review-bench-manifest-mechanical-writer`, `design-claims-anchor-validator`. **None of the three ids this finding originally named as stale are orphans any more** — `context-pack-heading-alignment`, `context-pack-heading-drift` and `check-links-code-span-skip` now derive `done`, because `docs/archive/2026-07-25-context-pack-heading-alignment/`, `docs/archive/2026-07-25-context-pack-heading-drift/` and `docs/archive/2026-07-25-check-links-code-span-skip/` now exist on disk (`ls docs/archive/ | grep -E '2026-07-25'`, re-run this pass). This finding's own dated history, kept rather than silently updated in place:

- **Dated observation, 2026-07-25 ~13:50 (this change's first authoring pass, base `07ab640`):** `derive-roadmap-status.js` reported 7 orphans; 3 of them (`context-pack-heading-alignment`, `context-pack-heading-drift`, `check-links-code-span-skip`) were verified stale — declared-and-not-on-disk despite the underlying defects already being shipped (`context-pack-heading-*` by `43201d5`/PR #47; `check-links-code-span-skip` by `ec2ce7e`/PR #45). That observation is what this file originally called F4.
- **Dated correction, 2026-07-25 (concurrent, commit `db4443e`/PR #55, landed between this change's two authoring passes):** a sibling change archived all three with retroactive stubs (`chore(docs): archive 4 shipped changes — the roadmap reads done again`) — the exact fix this finding's own text said this change's bound would not let it perform. **The fix is disk-only, not prose.** Re-verified this pass: `grep -n 'Entregue' docs/roadmap/epics/EPIC-kit-discipline-hardening.md` matches exactly 3 Feature lines (`plan-gate-executor-internals-check`, `step-summaries-type-gate-tests`, `brainstorm-schema-path-literal-lock`) — `context-pack-heading-alignment`, `context-pack-heading-drift`, `check-links-code-span-skip` **and** `review-usage-bench-manifest` derive `done` purely from their archive dir's presence, with **no** trailer added to their Feature/Aceite prose at all. The deriver corroborates via disk, the reader (a human skimming the epic file) still sees a bare backlog-shaped line for 4 of the 6 now-shipped items — a milder instance of the same reader/writer gap F2 and F5 name.
- **What did NOT get fixed by that correction:** `context-pack-heading-alignment` and `context-pack-heading-drift` are still **two separate Feature lines describing the same defect** (`EPIC-kit-discipline-hardening.md:35` and `:38`, re-verified `grep -n 'changes: context-pack-heading' docs/roadmap/epics/EPIC-kit-discipline-hardening.md` this pass) — archiving both underlying change packages made both derive `done`, which is a correct status but does not merge the duplicate registration. The duplicate is still live prose, just no longer flagged as an orphan.

**The 4 current orphans were not audited** — no claim is made about `post-merge-sweep`, `engine-parallel-fate`, `review-bench-manifest-mechanical-writer` or `design-claims-anchor-validator` either way; none of them show the archived-but-still-declared shape the three above did. Family: roadmap hygiene ([ADR-002](../../decisions/ADR-002-roadmap-status-derived-from-disk.md)'s own review trigger names a declaration that outlived its delivery — the pattern F4 originally caught, and which self-corrected between this change's two authoring passes, evidence that the pattern recurs on a live roadmap independent of any one audit). **Recorded, not fixed here:** de-duplicating the two `context-pack-heading-*` lines and auditing the 4 remaining orphans is roadmap surgery this change's own bound (§8) does not permit — it is the follow-up Feature `stale-backlog-declaration-cleanup` registers (§5, rescoped below to the two things that are actually still open). Never gloss an orphan as "legitimate", "open" or "pending" — the deriver's word is "orphan" and it means declared-and-not-on-disk, nothing more (`grep -rn 'legitimate' docs/features/workflow-script-optimization/` → empty, checked this pass).

**Drift notes for `evidence.md`'s Unresolved Deviations (both dated, neither smoothed over):**

1. *2026-07-25, first rebase (`80610ab` → `07ab640`):* the orphan count moved 6→7 — a concurrent sibling PR (#52) declared a 7th Feature (`design-claims-anchor-validator`) on the same epic F2/F4 register into, landing between this change's baseline measurement and its first authoring pass.
2. *2026-07-25, second rebase (`6af0e7a` → `8a6ce73`, this pass):* the orphan count moved 7→4 — a concurrent sibling PR (#55) archived the 3 ids F4 had flagged stale, plus `review-usage-bench-manifest` and `plan-gate-executor-internals-check` moved from `in-progress` to `done` the same way. [design.md](design.md) §12's own assumptions section named this exact risk class ("no sibling worktree is editing the same three epic files... check `git branch` and `docs/archive/` for jurisprudence") — it undershot the frequency (twice in one authoring session, not zero), not the mechanism.

**F5 — the `readiness` step's own description disagrees with what it dispatches.** `governance/flows/full.yaml:168` reads `description: aidakit:readiness — mechanical GATE 1 for the plan package's readiness`, but `skills/readiness/SKILL.md` explicitly reviews cross-artifact **consistency** ("check consistency across `proposal.md`, `design.md`, `specs/**/*.md`, `tasks.md`", line 15) and screens for **"hidden architecture decisions"** (line 17) — both meaning-based, not predicates over the disk. **This is now also a locked decision, not just this audit's read:** [ADR-015](../../decisions/ADR-015-readiness-owns-internals-claims-gate.md) §Decision-1 (landed in `80610ab`, merged the day before this pass) makes `aidakit:readiness` the owner of a mandatory *semantic* gate — Process §14, "for every claim in `design.md`/`proposal.md` about an internal contract of the repo's own machinery, the reviewer re-derives the claim from live code with `Read`/`Grep`" — and states outright why `plan`/`planner` cannot own it: "`skills/plan/SKILL.md` only assembles a prompt and dispatches — it cannot gate anything from inside the flow." A step whose own governing ADR requires it to re-derive meaning from live code is load-bearing by construction; this finding no longer rests only on this audit's own four-question test, it is independently confirmed by a decision record this audit did not have to derive itself. The four-question test (§3b) still rates `readiness` load-bearing (fails Q1), the same shape as `classify`/`brainstorm`/`critic`, despite the word "mechanical" in the step's own prose — ADR-015 corroborates the verdict, it does not supersede the need for it. Family: kit hygiene / documentation accuracy — same reader-writer-disagreement shape as F2, but here the "reader" is a human skimming the flow YAML's own description, not a script. Routed to: **recorded here only** — a one-line description edit is below the threshold for its own roadmap Feature (unlike F2/F4, which are contract-shaped defects with a mechanical fix), and this change's diff must not touch `governance/flows/*.yaml` regardless (`audit-only-no-flow-edits`).

---

## §5 — Candidate register

**Escalation bound, stated above the tables (design.md §3c):** no candidate below may touch `merge_route`/`auto_merge`/`merge`, `specify_escalation`, `acceptance_escalation`, `pre_apply`, `parked`, `gate_migration`, `gate1`–`gate4`, or any `max_visits`/`on_max_visits` wiring. Every admitted candidate row below carries an explicit `touches escalation: no` column so the check is visible per row, not promised once.

### Admitted (all five slots filled)

| # | Locus | Predicate | Judgment lost | Precedent mirrored | ADR the follow-up needs | touches escalation |
|---|---|---|---|---|---|---|
| C1 | `governance/flows/full.yaml:61` (`classify`→`brainstorm`'s `domain` interpolation) — the F1 finding | `classify` declares `outputs: { success: [domain] }` and the flow resumes with `--domain <enum>`, mirroring `select`'s `change_id` output exactly | Nothing new is lost — `classify`'s own judgment (assigning the domain) is unchanged; what's fixed is the **data-passing contract** between `classify` and `brainstorm`, currently smuggling `outcome` (a control-flow string) through as `domain` (a data value) | [ADR-006](../../decisions/ADR-006-flow-values-as-data.md) §Decision-2 — the exact pattern `flow-request-vs-change-id` already shipped for `select`/`change_id` | A dedicated ADR extending ADR-006 to `classify`, defining the fail-closed resume semantics when `--domain` is absent (mirroring the `change_id` precedent's own fail-closed design) | no |
| C2 | `governance/flows/full.yaml:294` (`hardening`, `invoke_target: aidakit:test`) | Split `hardening` into a `runs` step (`<repo test command> && <coverage check> ≥ threshold`, both already mechanical — exit code + a percentage comparison) followed by a **narrower** `invoke` step scoped only to anti-hardcode/hard-DoD judgment | The suite-execution and coverage-threshold check are pure predicates today, already re-derivable from the repo's own test command and `aidakit:coverage`'s threshold; what remains genuinely load-bearing is detecting a *gamed* test (hardcoded expected value bypassing real logic) and assessing whether completion matches the acceptance bar — neither reduces to an exit code | [ADR-010](../../decisions/ADR-010-acceptance-leash.md)'s acceptance-leash shape (dedicated judgment agent as writer, deterministic script as validator) — applied here as a **new instance** of the same shape, not a fourth pattern | A dedicated ADR defining the split (which exit codes route where, and whether the narrower judgment step still blocks on a mechanical suite failure or only fires after it passes) | no |

### Rejected (deliberately excluded, with the slot that failed)

| Locus | Why considered | Failing slot | Reason |
|---|---|---|---|
| `governance/flows/full.yaml:447` / `:355` (`pr`, `dna_pr` — `invoke_target: aidakit:ship`) | `aidakit:ship`'s own guardrails (branch ≠ main, nominal staging, no-secret pattern) are described as mechanical and are **already separately enforced** by `hooks/pre-bash.js` | 4 — Precedent mirrored | What remains after the guardrails (already mechanical, already enforced elsewhere) is composing the commit message / PR narrative — the "why" of the diff. None of doc-leash/acceptance-leash/bench-leash mirror narrative composition; scripting it would produce a templated message, not a leash. Inventing a fourth leash shape for this is a decision, not an audit finding (design.md §3c). |
| `governance/flows/full.yaml:18` / `governance/flows/fast.yaml:62` (`select` — `invoke_target: aidakit:orchestrator`) | When `${inputs.request}` already carries a declared change-id, `select`'s confirm path degenerates to a check `derive-roadmap-status.js` already performs mechanically (dependency status, archive presence) | 4 — Precedent mirrored | The flow does not split `select` into "confirm-by-id" vs "pick-among-candidates" sub-steps, and picking the "first ready change" when the request is ambiguous stays genuinely load-bearing (ranking multiple mechanically-qualified candidates by fitness is a judgment call, not a predicate). No existing leash shape mirrors "auto-pick among several valid options." |
| `governance/flows/full.yaml:469` (`auto_merge`) + `:491` (`merge`) / `governance/flows/fast.yaml:287` (`auto_merge`) + `:309` (`merge`) — re-verified with `grep -nE '^\s+- id: (merge_route\|auto_merge\|merge)\s*$' governance/flows/full.yaml governance/flows/fast.yaml` at this pass, not copied from an earlier draft (`invoke_target: aidakit:merge`) | Superficially resembles a predicate ("is this PR mergeable on the host") | n/a — excluded by the **hard bound**, not evaluated on the slots | `merge`/`auto_merge`/`merge_route` are explicitly out of bounds regardless of how checklist-shaped they look (§3c hard bound, [ADR-008](../../decisions/ADR-008-opt-in-autonomous-pr-merge.md)). Recorded here only to show the bound was checked, not skipped. |
| `agents/doc-planner.md` (illustrative — the top-ranked agent in [dispatch-cost.md](dispatch-cost.md)'s ranking) | Handed to §5 per [design.md](design.md) §4's instruction that every dispatch-cost trim candidate gets the five-slot treatment before becoming a roadmap Feature | 2 — Predicate, and 4 — Precedent mirrored | A prompt trim reduces `agents/doc-planner.md`'s body bytes; it does not replace a judgment call with a deterministic predicate — the dispatcher's decision authority (what's mandatory, what content to draft) is unchanged either way. No leash shape describes byte reduction. Prompt trims are real, legitimate follow-up work — but they are a **different axis** from a leash conversion, and forcing them through this five-slot test (designed for judgment removal) is precisely why they land here rather than in the admitted table. They are still registered as roadmap Features (§ below), just not through this admission gate. |

**Non-collision check**, run before writing any candidate id anywhere in this file or in `docs/roadmap/`:

```bash
ls docs/features/ | grep -E '^(flow-request-classify-domain-contract|hardening-anti-hardcode-split)$'
ls docs/archive/ | grep -E 'flow-request-classify-domain-contract|hardening-anti-hardcode-split'
grep -rn 'flow-request-classify-domain-contract\|hardening-anti-hardcode-split' docs/roadmap/epics/
```

```
(all three commands: no output — both candidate change-ids are unclaimed on this tree)
```

C1 and C2 are registered on the roadmap under the candidate ids `flow-request-classify-domain-contract` (C1) and `hardening-anti-hardcode-split` (C2) — see [`docs/roadmap/epics/EPIC-flow-engine-leashes.md`](../../roadmap/epics/EPIC-flow-engine-leashes.md).

---

See [dispatch-cost.md](dispatch-cost.md) for the measured agent-prompt cost table (§4 of [design.md](design.md)) that ranks the trim candidates referenced above, and for the telemetry-grounded `observed` tier.
