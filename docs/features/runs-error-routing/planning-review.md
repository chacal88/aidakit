# Readiness review result

## 1. Decision
- Status: APPROVED
- Confidence: high
- Ready to implement: yes

## 2. Scope validation

Classification: `correct`. Proposal names two concrete defects (router at `engine.js:223-228`; detector for `require()`-throws-exit-1) and confines the change to `governance/engine/` + one new ADR + one guides paragraph. Non-goals §36-43 explicitly close scope creep vectors (stderr heuristics, retry-on-infra, bash-validator wrapping, invoke-step changes, consumer-flow migration). Every design commitment maps back to a task; no design implementation-commitments float without a task. No supporting doc introduces unmapped scope.

## 3. Proposal review

Problem defined (proposal.md:10-19). Business/platform objective clear: the flow silently loops on infra errors instead of surfacing them. Affected capability: flow engine, no canonical spec exists — pinned by regression tests, precedent set by [validator-path-resolution](../../archive/2026-07-23-validator-path-resolution/). Impact per surface tabulated (proposal.md:49-59). Non-goals explicit (proposal.md:36-43). Risks/constraints visible: sentinel-250 collision consequence stated in ADR-011 §33 and design.md.

## 4. Design review

Design matches proposal scope. Inherited constraints respected: [ADR-004](../../decisions/ADR-004-aidakit-governance-env-contract.md) precedence philosophy explicitly reused for NODE_OPTIONS append; [ADR-009](../../decisions/ADR-009-flow-commits-plan-early.md) structural-mechanism precedent cited for Q1. Data model change (new outcome kind `"infra"`) is a single JSDoc typedef edit — task 2.11. Input/output behavior at every touch point defined with insertion snippets (design.md:80-96, 100-102). Rollout: additive at every touch point — single-commit revert restores prior behavior (design.md:161-169). Alternatives table in design.md §"Alternatives" (7 alternatives × pros/cons/undo-cost) — matches ADR-011's alternatives table, no drift. Open questions all resolved (Q1 locked, Q2 locked, Q3 answered in plan step per brainstorm delegation).

## 5. Change metadata review

Repo has no formal `metadata.md` / `.openspec.yaml` convention. Closest artifact is [classification.json](classification.json) — present and consistent (`type:bug`, `flags:[architecture, contract]`, `classification:standard`, matches roadmap epic scope). Not blocking — repo doesn't require it.

## 6. Roadmap and current-state review

Roadmap sub-bullet exists at [EPIC-flow-engine-leashes.md:21](../../roadmap/epics/EPIC-flow-engine-leashes.md) with concrete acceptance. Current-state check embedded in proposal.md §"Why" (defect #1 = engine.js:223-228; defect #2 = require-fail case never reaches res.error). Task 4.4 mandates roadmap status update after merge.

## 7. Specs review

`docs/specs/` absent in this repo. Proposal explicitly declares "no spec delta" (proposal.md:47) with cited precedent from validator-path-resolution. Behavioral contract pinned by the new §12 in `engine.test.mjs` (tasks 2.1-2.5, 2.12). Requirements use precise assertions (`state.status === "failed"`, `state.step_history[last].result === "infra_error"`, `on_failure` target NOT dispatched, `runs_infra_error` event present with specific exit_code/signal). ADR-011 §Decision uses normative "SHALL/MUST"-equivalent language throughout (§1 "always hard-stop", §2 "remapped to exit 250", §3 "keep POSIX-signal-only detection", §4 "default to validator-failure").

## 8. Tasks review

15 tasks (1.1-1.2 setup · 2.1-2.12 RED→GREEN · 3.1-3.2 flow audit · 4.1-4.5 docs · 5.1-5.6 validation · 6.1-6.4 cleanup). All `- [ ]` format. Sequenced by dependency (RED tests before implementation, GREEN implementation before re-run, docs before validation). Task 2.4 mandates the bad-cwd trigger (post round-2 revision) — no escape hatch. Task 2.10 lists three concrete engine.js edits including the `history.error` ternary extension. Every task path lands under real repo surfaces (`governance/engine/`, `governance/__tests__/`, `docs/decisions/`, `docs/features/`, `docs/guides/`, `docs/roadmap/`). No vague "define/handle/support" tasks. Acceptance criteria per test explicit (5 named assertions per §12 test). Manual repro spelled out (tasks.md:102-141) with a one-liner AND a full-engine-round-trip verification.

## 9. Omission detection

- Validation: task 2.10 last paragraph mandates `state.step_history[last].error` assertion in every §12 test. Not omitted.
- Error handling: prelude explicitly re-raises non-matched exceptions (design.md:43). Not omitted.
- Retries: locked to NONE (proposal.md non-goal #2, ADR-011 §Decision). Not omitted.
- Permissions: EACCES / exit 126 in the taxonomy (design.md:23). Not omitted.
- Side effects: `runs_infra_error` event is additive; `NODE_OPTIONS` is append not clobber. Not omitted.
- Observability: new event with `command`/`exit_code`/`signal`/`stderr` fields (design.md:120-133). Not omitted.
- Rollback: additive-at-every-point → single revert (design.md:161-169). Not omitted.
- Data consistency: no state migration needed (design.md:169). Not omitted.
- Idempotency: prelude has an idempotent install guard (task 2.7 `Symbol.for('aidakit.infra-detect.installed')`). Not omitted.
- Acceptance criteria: 5 mapped per §12 test. Not omitted.
- Test strategy: RED→GREEN with expected pre-implementation failure count (task 2.6). Not omitted.

## 10. Execution risks (top 5 failures)

1. **Prelude idempotency fails when a validator itself does `require('module-that-throws-MODULE_NOT_FOUND-in-its-own-init')`** — cause: prelude's `uncaughtException` fires on the inner require's error, remaps a legitimate validator-verdict path to sentinel 250. Impact: false-infra classification for a validator whose init deliberately probes module absence. Prevention: prelude matches `err.requireStack` presence AND parent frame — task 2.7 already scopes to `MODULE_NOT_FOUND`/`ERR_MODULE_NOT_FOUND` and `ENOENT` when `err.requireStack` present, but implementer should add an in-test case where a validator's own `try { require(x) } catch(e) {}` never reaches the handler (guarded require) → prelude does NOT fire. Add during implementation, not blocking.

2. **NODE_OPTIONS append breaks a consumer whose value contains an unquoted space** — cause: `${nodeOpts} --require=${JSON.stringify(prelude)}` concatenation with unquoted inherited `NODE_OPTIONS`. Impact: node fails to parse `--require`. Prevention: task 2.8's `JSON.stringify(AIDAKIT_PRELUDE)` handles the prelude path (which may contain spaces on macOS `/Users/…`); inherited value is trusted as pre-quoted per Node's own contract (Node parses NODE_OPTIONS as shell-like tokens). Real risk low, but flag for the implementer to add a test case with a prelude path containing a space.

3. **A shipped test that already asserts an `on_failure` target fires on a spawn-error case** — cause: design.md audit is a static grep-based read; the actual test tree may cover a case the grep missed. Impact: green suite regression on §12 land. Prevention: task 2.12 mandates a full re-run of `engine.test.mjs` after GREEN; if any pre-existing test breaks, its assertion was relying on the broken behavior — the fix is to update the assertion, not to weaken §12. Not blocking.

4. **The `state.step_history[last].error` extension leaks stderr with secrets** — cause: the stderr tail is written to disk in state.json. Impact: if a validator prints an API key during a crash, it lands on disk. Prevention: hard to mitigate structurally; `.aidakit/logs/` and `state.json` are already local-only and the tail cap is 2000 chars. Accepted risk consistent with existing `step_end` events' `output.stderr` field. No new leak surface; document only.

5. **A `runs` step with `on_failure: aborted` sees behavior change** — cause: before change, a spawn error routes to `aborted`; after change, it hard-stops and `aborted` never runs. Impact: any bookkeeping the `aborted` step did (cleanup, log flush) is skipped on infra failure. Prevention: design.md §"Backward compatibility" confirms no shipped flow uses aborted-based cleanup for infra outcomes; consumer flows that do must be documented in the flows.md paragraph (task 4.3). Cross-check during implementation.

None of these blocks release.

## 11. Mandatory fixes before implementation

None. All round-1 critic findings fixed (verified in round-2 critic re-audit); no new blockers.

## 12. Optional improvements (within scope)

- Add a §12.6 test where the validator itself does `try { require(x) } catch(e) { process.exit(1) }` — guarded require should NOT trigger the prelude, must route via `on_failure` as validator-NO. Confirms scope discipline of the prelude's `uncaughtException` handler.
- Task 2.8's env construction — when writing the JSDoc for `AIDAKIT_PRELUDE`, mention it's read-only-at-boot (like `AIDAKIT_GOVERNANCE`), to avoid confusion with the mutable `vars` env.

## 13. Explicitly out of scope

- Agent/skill Bash sessions that invoke `node` validators directly (`agents/orchestrator.md:50`, `agents/doc-planner.md:155`, `skills/roadmap/SKILL.md:64`) — tracked by `agent-validator-paths` debit in [EPIC-flow-engine-leashes](../../roadmap/epics/EPIC-flow-engine-leashes.md).
- Any `.aidakit/flows/*.yaml` (consumer flow) migration — consumers self-migrate per ADR-011's "consumer flows breaking-change surface" note.
- Any `invoke` step behavior change — no process-spawn concept.
- Stderr pattern-matching — permanently rejected in ADR-011 alternatives table.
- `on_infra_error` sibling target — deferred as additive amendment per ADR-011 §"Review trigger".

## 14. Mandatory review questions

1. Is the problem objectively defined? **Yes** — proposal.md:10-19 names two defects with line numbers and reproduction pathway.
2. Is the outcome measurable? **Yes** — 5 test assertions per §12 case, plus manual repro with expected exit code / event / history contents.
3. Are the error behaviors defined? **Yes** — design.md §"Exit-code taxonomy" tabulates every input signal → route, ambiguous case Q3 answered explicitly.
4. Are the edge cases covered? **Yes** — signal-kill, spawn-fail-with-on_failure-declared, exit 127, exit 126, require-fail-remapped, ambiguous-fallback, plus optional §12.6 for guarded-require.
5. Are the dependencies clear? **Yes** — proposal.md §"Dependencies" cites compatibility with `engine-max-visits` and `flow-request-vs-change-id`.
6. Are the contracts defined? **Yes** — new outcome kind `"infra"`, new event `runs_infra_error`, new history result `"infra_error"`, sentinel exit 250, `NODE_OPTIONS` append semantics — all named and typedef'd (task 2.11).
7. Can two developers interpret this differently? **No** — every implementation task has an insertion snippet or exact line reference.
8. Is any decision implicit rather than written? **No** — Q1/Q2/Q3 answered, sentinel choice justified, interrupt semantic decided, alternatives 7-wide, prelude injection mechanism decided.
9. Do the tasks deliver the intended outcome in full? **Yes** — RED tests cover all 5 detection cases + validator-failure preservation; GREEN edits touch all 4 planned files; docs cover ADR-011 + README index + guides paragraph + roadmap update.
10. What will be discovered too late if implementation starts now? **Nothing structural.** Execution risks §10 are catches during implementation, not late-discovery blockers.

## 15. Final conclusion

- **Can we start?** Yes.
- **What must be fixed?** Nothing — the two round-2 optional improvements (§12.6 test, JSDoc note) are nice-to-haves the implementer adds inline.
- **Main risk if ignored?** The prelude edge case (§10.1 — guarded require by a validator that legitimately probes module absence) is the only nuance implementer must attend to; the plan already scopes the prelude tightly enough to avoid it, but a §12.6 test would make the scope discipline explicit.
