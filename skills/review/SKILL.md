---
name: review
description: The canonical pre-ship review gate. Runs structural validation and, in parallel, dispatches the bench of isolated-context reviewer AGENTS (aidakit:adr-reviewer and aidakit:spec-reviewer always; aidakit:reviewer-quality, aidakit:reviewer-security, aidakit:reviewer-architecture, and aidakit:tester by classification flag) against a change — an OpenSpec change when the repo uses OpenSpec, a change under docs/features/ otherwise, or the current git diff. Aggregates the verdicts and decides PASS/FAIL consensus. Use after writing a plan, before committing implementation code, or whenever the user asks to review, audit, validate, or gate a change before shipping.
---

# aidakit:review — pre-ship review gate

> Orchestrates the bench: runs structural validation and dispatches the isolated-context reviewer AGENTS in parallel against a change (change-id or diff). This skill does not judge — it aggregates the agents' verdicts and decides PASS/FAIL consensus. The judgments come from isolated agents (one verdict per role per round), not from the main context.

## When to use (and when not)

**Use when:**

- You've just written a plan (e.g., via `aidakit:plan`) and want to gate it before implementing.
- You're about to commit implementation code and need the pre-ship check.
- The user asks to review, audit, validate, or gate a change before shipping.

**Do not use when:**

- The intent is to **fix** the findings — this skill reports, it does not fix ([GOVERNANCE.md](../../GOVERNANCE.md) §3: report, don't fix; the one who fixes is the executor or the user).
- As a substitute for the human gate: the PR merge remains always the human's ([GOVERNANCE.md](../../GOVERNANCE.md) §1).

## Prerequisites

- A git repo with the change accessible: a change-id (kebab-case) with artifacts in `docs/features/<change-id>/` (or `openspec/changes/<change-id>/` when the repo uses OpenSpec), **or** an uncommitted diff for `--diff` mode.
- The bench agents available: `aidakit:adr-reviewer` and `aidakit:spec-reviewer` (base, always); `aidakit:reviewer-quality`, `aidakit:reviewer-security`, `aidakit:reviewer-architecture`, and `aidakit:tester` (summoned by flag — see the step 5 matrix).
- Optional: the change classification ([aidakit:identify-domain](../identify-domain/SKILL.md)) — `{ domain, type, flags[] }` — which decides which flag-based roles the bench summons. Without a classification, operate by the heuristic built into the matrix (what the diff touches).
- Mandatory input: change-id **or** the `--diff` flag.
- **Context pack, read-if-present.** When `docs/features/<change-id>/.context-pack.md` exists, inject it into each dispatched role's prompt as the stable prefix of durable context (identity, decisions, ADRs, specs, code-map-pointers, DoD) — see [ADR-013](../../docs/decisions/ADR-013-context-pack-per-change.md). Freshness is guaranteed upstream by the flow's `context_pack` phase; this skill never runs the pack's freshness validator itself. **If the pack is absent**, fall back to the raw `proposal.md`/`design.md`/`tasks.md`/cited ADRs, exactly as before — a missing pack never fails the dispatch.

Invocation forms:

```
/aidakit:review <change-id>
/aidakit:review --diff
```

## Process

1. **Detect the repo's spec convention:** if an `openspec/` directory exists (or the `openspec` CLI is installed), operate in **OpenSpec mode**; otherwise, operate in **standard mode** — architecture deliverables in `docs/design/`, change artifacts in `docs/features/<change-id>/`, and canonical specs in `docs/specs/` (per [DOCS.md](../../DOCS.md)).

2. **Determine the review target** from the input. If `--diff`, first run `git diff` and `git diff --cached` to capture the surface; in `--diff` mode structural validation skips `openspec validate`.

3. **Run the structural validation yourself, BEFORE the reviewers** ([GOVERNANCE.md](../../GOVERNANCE.md) §3: mechanical validation before judgment — the content reviewers only see what already passed):

   - **OpenSpec mode**: run `openspec validate <change-id> --type change --strict --no-interactive`; verify that `.openspec.yaml` (if present) declares the schema this repo expects; verify the resolution of internal markdown links under the change directory; verify the WHEN/THEN scenarios in every `### Requirement:` block (when spec deltas exist); verify the alignment among the proposal/design/tasks/evidence headers; and verify that every task path points to surfaces that really exist in the target repo — discover them from the repo layout (e.g., its `apps/`, `packages/`, or `projects/` directories) and from the recorded decisions about layout (in `docs/decisions/`); never assume a fixed list.
   - **Standard mode**: verify the resolution of internal markdown links and the structural format of the change's markdowns under `docs/features/<change-id>/` and `docs/design/`, and verify the task paths against the repo layout as above.
   - **`--diff` mode**: verify only link resolution and structural format in the changed markdowns.

   If the structural validation FAILS, report the structural FAIL with the blocking findings and **do not fire the reviewers** — fix it and run again.

4. With the structural PASS, assemble the prompts for the two **base** reviewer agents (`aidakit:adr-reviewer` and `aidakit:spec-reviewer`, which run always). They are dispatched together with the rest of the bench — **in the single parallel message of step 5** — never sequentially. Suggested prompts:

   - `subagent_type: "aidakit:adr-reviewer"` with the prompt:
     > Review `<the change <change-id> / the current diff>` against the repo's recorded decisions in `docs/decisions/` (authoritative index: `docs/decisions/README.md`; `DECISION_INDEX.md` when present; repos not yet standardized may keep legacy layouts like `docs/adr/` or `ADR_INDEX.md`). Identify the in-scope ADRs (read the index if there is one, then each ADR whose subject the change touches). Check conformance line by line. Also check any open-decisions log the repo maintains (e.g., `OPEN_DECISIONS.md`) for an open decision the change resolves or contradicts. Report the findings with file:line references per your output format.

   - `subagent_type: "aidakit:spec-reviewer"` with the prompt:
     > Review `<the change <change-id> / the current diff>` against the repo's canonical specs (`openspec/specs/` in OpenSpec mode; otherwise `docs/specs/`, plus the change artifacts under `docs/features/<change-id>/` and the architecture deliverables under `docs/design/`). Identify the in-scope specs by domain match. Check coverage (each requirement: covered / partial / missing) and scope creep (anything in the change not derivable from a requirement). Also cross-check against the paired tech spec, if the repo maintains one. Report the findings per your output format.

5. **Summon the adversarial bench by a role×flag matrix — each role is a concrete isolated-context AGENT.** The matrix dispatches the real agents: the two base ones from step 4 run **always**; the rest come in by the classification's flag ([aidakit:identify-domain](../identify-domain/SKILL.md)). Do not summon anyone who doesn't add value (each subagent costs ~15× a chat turn; a superfluous summon is waste — GOVERNANCE.md and the aida cost doctrine).

   **Before dispatching anyone, write the bench manifest** (`recordBenchManifest` in [governance/ledgers/ledger.js](../../governance/ledgers/ledger.js)) — the full list of roles this round is committing to, appended to `.aidakit/tasks/<change-id>/bench.ndjson` as `{ bench: "review", round: N, role: "__manifest__", roles: [...] }`. This is what [check-bench.js](../../governance/validators/check-bench.js) (the PARALLELISM LEASH, wired into the flows right after this step) treats as the source of truth for who was expected — it must be the round's **earliest** record, precisely so the manifest can't be shrunk after seeing which role failed. Write it, THEN dispatch — copy-paste shape at the end of this step.

   Each role gets the `{diff}` (or the change-id) and returns ONE structured verdict — the judgment lives in the isolated agent, not here:

   | Role | Agent | Summoned when | RECEIVES → RETURNS |
   |---|---|---|---|
   | ADRs | `aidakit:adr-reviewer` | **always** | diff/change → verdict `Status: APPROVED\|NEEDS-REVISION\|BLOCKED` (conformance with locked decisions) |
   | specs | `aidakit:spec-reviewer` | **always** | diff/change → requirement-coverage + scope-creep verdict |
   | quality | `aidakit:reviewer-quality` | **always** when there's a code diff (`--diff` mode or delivered implementation) | diff + tasks/DoD → verdict with severity-tagged findings (`blocking`/`important`/`nit`/`praise`) and `verdict: approved\|rejected` |
   | security | `aidakit:reviewer-security` | flag `contract`, or the diff touches auth/sensitive data/credential/per-tenant query/crypto/config | diff → verdict `verdict: approved\|vetoed` (6 vuln categories + false-positive filter) |
   | architecture | `aidakit:reviewer-architecture` | flag `architecture` or `contract`, or the diff creates a module/new home or crosses a layer boundary | diff (+ optional design/proposal) → verdict `verdict: approved\|rejected` (right owner, boundaries, deletion test, contract→consumers) |
   | tests | `aidakit:tester` | **always** when there's a code diff; doubled focus when it touches business logic, validation, auth, or a cross-process flow | diff → verdict `Coverage verdict: PASS\|FAIL` (behavioral coverage; gaps prioritized 1-10; brittle tests) |
   | performance | — (no dedicated agent; the role is covered by the perf gate of `aidakit:reviewer-quality`, phase 2) | flag `ui`, type `migration`, or a "I optimized" claim | reinforce the perf focus in the `aidakit:reviewer-quality` prompt (N+1, pagination, `COUNT(*)` on a hot path); if and when a performance agent exists, plug it in here |

   **All summoned agents run in parallel, in a single message** — one `Agent` tool call per role in the SAME turn, never sequential. That is what keeps each judgment independent and out of the main context (per-role context isolation), and it's what the leash mechanically checks (see step 7): record each role's real `dispatched_at` (when you fired the `Agent` call) and `returned_at` (when it returned), not the ledger-write time — a sequential dispatch dressed up as a bench shows up as non-overlapping windows and the gate rejects it. The project can declare the matrix in `aidakit.config.yaml` (mapping `flag → agents`); without it, use the table above. Suggested prompts per agent: those from step 4 for the two base ones; for the rest, pass the target (`<change-id>` or "the current diff, via `git diff`/`git diff --cached`"), the change package (proposal/tasks/DoD when it exists), and the instruction to emit ONE verdict in the agent's own output format.

   **Copy-paste dispatch shape.** The mechanical source of truth is [ledger.js](../../governance/ledgers/ledger.js) (what gets written) and [check-bench.js](../../governance/validators/check-bench.js) (what gets checked); this is the minimal sequence that satisfies both.

   1. **Write the manifest first** — before any `Agent` call:

   ```bash
   : "${AIDAKIT_GOVERNANCE?agent-validator-paths: AIDAKIT_GOVERNANCE not set — SessionStart hook missing (see docs/guides/flows.md §6)}"
   node --input-type=module -e "
   import { recordBenchManifest } from '$AIDAKIT_GOVERNANCE/ledgers/ledger.js';
   recordBenchManifest(<CHANGE-ID STRING — quoted, e.g. 'review-usage-bench-manifest'>, { bench: 'review', round: <N — 1, or bumped for a re-summon>,
     roles: [<EXACTLY the roles the matrix above selected for THIS change>] });
   "
   ```

   **Every `<…>` above is deliberately unquoted, so an unsubstituted paste dies with a `SyntaxError` instead of running.** It closes exactly one failure mode — the verbatim paste — and that is worth having, because a template that runs unedited is the one a hurried caller actually ships. It does not make the block safe against a caller who edits it wrongly; see the invariants below for what the machine does and does not catch.

   The `roles[]` array is the one field you must **derive**, not copy. With every flag on it is the full six (`'adr-reviewer','spec-reviewer','reviewer-quality','reviewer-security','reviewer-architecture','tester'`); for a change with no flags and no code diff it may be just the two base roles. Manifesting a role you then don't dispatch trips `role-missing`. Under-sizing the manifest is the direction that hides: the presence check only asks whether every *expected* role reported, so a role you never listed is never missed. It is not a free pass — with no verdicts at all the mechanical consensus is `fail`, so reporting `consensus` over an empty manifest still trips `consensus-mismatch` — but the presence check alone will not catch you.

   2. **Then dispatch** — one `Agent` call per manifested role, all in the SAME message. Note the wall-clock time you fire them and the time each returns; those are the `dispatched_at`/`returned_at` below.

   3. **Record each verdict as it returns** (one call per role, or one batched script):

   ```bash
   : "${AIDAKIT_GOVERNANCE?agent-validator-paths: AIDAKIT_GOVERNANCE not set — SessionStart hook missing (see docs/guides/flows.md §6)}"
   node --input-type=module -e "
   import { recordBench } from '$AIDAKIT_GOVERNANCE/ledgers/ledger.js';
   recordBench(<CHANGE-ID STRING — quoted>, { bench: 'review', round: <N — same round as the manifest>, role: 'adr-reviewer',
     agent: 'aidakit:adr-reviewer',
     verdict_raw: <the role's OWN verdict line, quoted — e.g. 'Status: APPROVED'>,
     verdict: <'pass' or 'fail', normalized per step 7>,
     dispatched_at: <ISO STRING — when you fired the Agent call for this role>,
     returned_at:   <ISO STRING — when it returned> });
   "
   ```

   **The parallelism check is opt-out by omission — know this before you edit the block.** `dispatched_at`/`returned_at` must be real, parseable ISO strings. A value the machine cannot parse, *or a field you simply delete*, is not rejected — it is **skipped**: the overlap check drops any record it cannot read a window from, and with fewer than two usable windows left it reports "not checked" and **passes**. So a sequential bench whose timestamps were dropped rather than filled clears the genuine-parallelism gate without ever proving parallelism. Unquoting the placeholders stops the unedited paste; it does **not** stop this. Nothing at the doc layer can — closing it means teaching `check-bench.js` to treat a role record missing either timestamp as an error, which is registered as part of `review-bench-manifest-mechanical-writer`. Until then: filling these two fields honestly is on you, not on the machine.

   (For a single-role round the check is vacuous by construction — there is no second window to overlap with — and the gate still prints "dispatch genuinely parallel". Read that as "nothing contradicted it", not as proof.)

   Both snippets guard `$AIDAKIT_GOVERNANCE` with the fail-closed idiom locked by [ADR-012](../../docs/decisions/ADR-012-aidakit-governance-session-wide.md) — without it a missing `SessionStart` hook expands the variable to empty and the caller gets `ERR_MODULE_NOT_FOUND: /ledgers/ledger.js`, a diagnostic naming neither the hook nor the variable.

   **The three invariants callers trip most.** `check-bench.js` enforces seven rules in all — `manifest-missing`, `manifest-duplicate`, `manifest-not-first`, `role-missing`, `role-duplicate`, `consensus-mismatch`, `not-parallel`; its error messages are self-explaining. These three are the ones a hand-written round actually gets wrong:

   - **Role strings match byte-for-byte** between the manifest's `roles[]` and each `recordBench` `role` — the convention is the `subagent_type` minus the `aidakit:` prefix. A rename between the two lists surfaces as `role-missing`, indistinguishable from a role that never ran.
   - **Every `dispatched_at` is later than the manifest write.** The manifest must be the round's earliest record; a backfilled or rounded-down timestamp trips `manifest-not-first` even when all roles reported and the consensus was right.
   - **Exactly one manifest per round.** You cannot top one up after seeing a verdict — a second `__manifest__` in the same round is `manifest-duplicate`. Re-summoning only the failed roles (step 8) is a **new round**: `round: 2`, a fresh manifest listing only those roles, written before that round's dispatch.

   **If you skip the manifest:** `check-bench.js` exits 1 with `manifest-missing`, `check_review_bench` back-edges to the review step — `review_bench` in [full.yaml](../../governance/flows/full.yaml), `review` in [fast.yaml](../../governance/flows/fast.yaml) — and the **whole bench re-runs**: every role re-dispatched, one full extra round of subagent cost, for a record that takes one line.

6. **Adversarial posture — refute, don't confirm.** Each agent hunts for the solution's flaws in its specialty, it does not approve it (the posture belongs to the agent itself; the skill only requires and collects it). Push-back on a finding is only valid **with technical evidence** (real code/test/output that disproves it). A generic approval ("LGTM", "looks good") is an **invalid** verdict and goes back for re-emission. The quality and architecture agents name at least one good point (praise) — this avoids the hunt-only bias.

7. **Collect the verdicts — each agent emits exactly ONE per round, machine-parseable (GOVERNANCE.md §3), in the agent's own format.** There is no single format: the skill reads each role's verdict line and normalizes it to PASS/FAIL. Normalization mapping:
   - `aidakit:adr-reviewer` / `aidakit:spec-reviewer` → `Status: APPROVED` = PASS; `NEEDS-REVISION`/`BLOCKED` = FAIL.
   - `aidakit:reviewer-quality` → `verdict: approved` = PASS; `verdict: rejected` = FAIL (severities: `[blocking]` blocks; `[important]` open without rebuttal-with-evidence blocks; `[nit]`/`[praise]` don't block).
   - `aidakit:reviewer-security` → `verdict: approved` = PASS; `verdict: vetoed` = FAIL (a security veto blocks the advance); a role **declined** for lack of surface = non-blocking.
   - `aidakit:reviewer-architecture` → `verdict: approved` = PASS; `verdict: rejected` = FAIL (≥1 `blocking` finding).
   - `aidakit:tester` → `Coverage verdict: PASS` = PASS; `FAIL` (critical gaps 8-10 without a plan) = FAIL.

   Record each role's normalized verdict via `recordBench` (same [ledger.js](../../governance/ledgers/ledger.js), same `.aidakit/tasks/<change-id>/bench.ndjson`) as it returns:
   ```
   { bench: "review", round: N, role: "<role>", agent: "<subagent_type>",
     verdict_raw: "<the agent's own Status/verdict line>", verdict: "pass"|"fail",
     dispatched_at: "<ISO — when you fired this role's Agent call>",
     returned_at:   "<ISO — when this role's Agent call returned>" }
   ```
   This is the auditable trail [check-bench.js](../../governance/validators/check-bench.js) reads: an auditable record of who said what, when, and whether the dispatch was genuinely concurrent. Each agent's finding stays in the agent's own output format in the conversation (single-writer, GOVERNANCE.md §3) — the ledger only carries the normalized verdict + timing, not the findings themselves; the skill aggregates, it does not rewrite the verdicts.

8. **Aggregate and decide by consensus.** Round N: the bench of agents emits in parallel. Normalize each verdict per the step 7 map. All non-declined roles = PASS → **consensus** → PASS. Any FAIL (`rejected`/`vetoed`/`NEEDS-REVISION`/`BLOCKED`/`Coverage verdict: FAIL`) → FAIL: the author fixes and runs **round N+1**, re-summoning only the agents that failed. **Cap of 2 rounds** before escalating to the human — if it didn't converge in 2, the deadlock is a human decision, not an automatic third round. A declined role (e.g., security with no surface) counts as non-blocking. Finalize with:

   - Consensus (all PASS) → "Ready to ship."
   - Any FAIL, round < 2 → list the blockers and "Fix and run `/aidakit:review` again."
   - No convergence in 2 rounds → "Consensus deadlock — escalate to the human" with the disputed points.

## Outputs

- An aggregated report in the conversation: one section per summoned role (Structural + the bench agents that ran — ADRs, specs, quality, security, architecture, tests per the matrix), with each one's normalized verdict (PASS/FAIL) and the final consensus verdict.
- Each agent's findings in the agent's own output format; each agent writes only its own verdict (single-writer, [GOVERNANCE.md](../../GOVERNANCE.md) §3). The skill aggregates, it does not rewrite the verdicts.
- The append to `.aidakit/tasks/<change-id>/bench.ndjson` (the `__manifest__` record + 1 record per role per round) as an auditable trail — this is what backs the mechanical leash below, not just a log.
- This skill **does not create or move documents** in the repo — artifact placement follows [DOCS.md](../../DOCS.md) and is the responsibility of whoever authors the change.

## Gates and guardrails

- **Report, don't fix:** do not edit anything based on the findings — the user or the executor fixes ([GOVERNANCE.md](../../GOVERNANCE.md) §3).
- **Do not approve, do not merge, do not ship anything.** A PR merge is always the human's ([GOVERNANCE.md](../../GOVERNANCE.md) §1).
- **Do not skip a summoned role or the structural validation** (even in `--diff`, the structural runs; it just shrinks the scope). The two base reviewers (`adr-reviewer`, `spec-reviewer`) run always; the rest run when the step 5 matrix summons them.
- **The structural gates the judgment:** a failed mechanical validation blocks the WHOLE bench of agents ([GOVERNANCE.md](../../GOVERNANCE.md) §3) — do not dispatch any agent before the structural passes.
- **The whole bench in parallel** (a single turn with one `Agent` call per summoned role). Never sequentially — the parallelism is what preserves the context isolation and the independence of each judgment. **This is not just a norm — it is mechanically checked.** In any flow that reaches this skill via `governance/flows/*.yaml`, a `check_review_bench` step (`node governance/validators/check-bench.js`) runs right after and rejects the round if a manifested role never reported, if the reported consensus contradicts the ndjson's own verdicts, or if the dispatch windows don't overlap (i.e., it ran sequentially). A rejected round routes back to re-summon properly — the flow does not advance on trust alone.
- **An approval verdict with an open blocker is forbidden** or an empty/trivially broad scope ([GOVERNANCE.md](../../GOVERNANCE.md) §3).
- A finding that contradicts an ADR is not routed around silently: it becomes a proposal for a new ADR and escalates to the human ([GOVERNANCE.md](../../GOVERNANCE.md) §1, escalation 2).

## Related

- `aidakit:plan` — produces the plan this skill gates.
- `aidakit:identify-domain` — produces the classification (`flags[]`) that decides which roles the step 5 matrix summons.
- `aidakit:adr-reviewer`, `aidakit:spec-reviewer` — the base bench (always); `aidakit:reviewer-quality`, `aidakit:reviewer-security`, `aidakit:reviewer-architecture`, `aidakit:tester` — the flag-based agents dispatched here.
- `aidakit:spec` — targeted reading of the canonical specs.
- `aidakit:test` and `aidakit:coverage` — complementary code gates (the `aidakit:tester` covers the behavioral lens inside the bench).
- `/aidakit:flow-fast` / `/aidakit:flow-full` — the execution flow decides the next step after a verdict (the `aidakit:orchestrator` at the 1st step, logic previously exposed as `aidakit:orchestrator` (1st step of `/aidakit:flow-fast`/`/aidakit:flow-full`)).

<!-- aidakit v0.3 — the summon matrix dispatches the bench of concrete agents (adr/spec/quality/security/architecture/tester) in parallel; mx base + adversarial bench (codeflow/psim) 2026-07-17 — translated to EN -->
<!-- aidakit v0.9 — review-usage-bench-manifest: copy-paste manifest → dispatch → recordBench shape in step 5, 2026-07-25 -->
