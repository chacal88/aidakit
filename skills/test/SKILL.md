---
name: test
description: Runs focused per-surface test suites for the target repo, with a coverage report, discovering the surfaces in the repo itself. Use when validating an implementation, checking before a commit or PR, verifying the coverage threshold (≥80%), or when the user says "run the tests", "test this surface", "check coverage", "validate the tests", "run tests", "check coverage", or invokes /aidakit:test. Supports per-surface execution and the full suite. Integrates with aidakit:coverage for deep analysis and with the aidakit:orchestrator agent's parallel orchestration mode.
---

# aidakit:test — Focused per-surface tests with coverage

> Runs the test suite of any surface of the target repo and reports coverage metrics, without assuming a fixed layout.

A **surface** is any part of the repo with its own test setup (a workspace, package, or top-level directory with its own test configuration) — the skill discovers the surfaces from the repo rather than assuming a fixed list.

## When to use (and when not)

**Use aidakit:test when:**
- Testing a feature after the implementation (`/aidakit:test <surface>`)
- Validating changes on a specific surface without running everything else
- Running the full suite before the merge (`/aidakit:test all`)
- Verifying coverage after code-review feedback
- Implementation agents need to validate their own work

**Do not use aidakit:test when:**
- You need deep analysis of the coverage gaps → use aidakit:coverage
- You're orchestrating multiple agents → use the aidakit:orchestrator agent (it calls aidakit:test internally)
- You need to debug a failing test → use aidakit:systematic-debugging

## Prerequisites

- Infrastructure services the tests require running (Docker, databases, queues, other dependencies)
- Existing test files on the target surface
- A test command defined by the surface itself (`test`/`test:cov` script, pytest config, etc.) — always prefer the command the repo defines over a generic invocation

### Quick reference

Surface names come from the target repo (see step 1 of the Process). Assuming, for example, a repo with surfaces `api`, `web`, and `integration`:

```bash
# Run a surface's tests with coverage
/aidakit:test api

# Run another surface
/aidakit:test web

# Run everything (all discovered surfaces)
/aidakit:test all

# Run with coverage-threshold verification
/aidakit:test api --coverage=80

# Run showing the failures
/aidakit:test web --verbose
```

## Process

### 1. Discover surfaces and validate the environment

1. **Discover the target repo's surfaces:** look for workspaces/packages or top-level directories with their own test configuration — a `package.json` with a `test`/`test:cov` script, a `pytest.ini`/`pyproject.toml`, a `go.mod`, etc. Each of these is a surface the skill can target.
2. Verify that the required services are running (Docker, databases, queues, other dependencies).
3. Verify that test files exist on the target surface.
4. Report any missing prerequisite.

### 2. Run the tests

For each target surface, run the test command **with coverage**, using whatever the surface's own config defines. Typical examples per stack:

**Node/TypeScript surface:**
```bash
cd <surface>
npm run test:cov --silent   # or the surface's coverage script
```

**Python surface:**
```bash
cd <surface>
pytest --cov=src --tb=short   # respect the repo's pytest markers/config
```

Always prefer the script/command the repo itself defines over a generic invocation.

### 3. Parse the coverage report

Extract:
- overall coverage %
- coverage per file
- uncovered lines/branches
- list of failing tests

### 4. Report the results

**Success (≥80%):**
```
✅ <surface> tests: PASS
   Coverage: 85% (lines), 82% (branches)
   Tests: 47 passed, 0 failed, 0 skipped
   Duration: 12.3s
```

**Below threshold (<80%):**
```
⚠️ <surface> tests: WARN
   Coverage: 72% (below the 80% target)
   Tests: 45 passed, 0 failed, 0 skipped

   Coverage gaps (top 5):
   1. <Service>.<method>() — 0% coverage
   2. <Service>.<method>() — 50% coverage
   3. <Adapter>.<method>() — 30% coverage

   Recommendation: run /aidakit:coverage for detailed analysis
                   or fire a test-writer subagent to close the gaps
```

**Failure (tests don't pass):**
```
❌ <surface> tests: FAIL
   Coverage: N/A (tests failed)
   Tests: 38 passed, 2 failed, 1 skipped

   Failures:
   1. <File>.test.ts:45 — "<test name>"
      Error: <assertion error>

   2. <File>.test.ts:78 — "<test name>"
      Error: <assertion error>

   Recommendation: fix the tests and run again
                   or use aidakit:systematic-debugging to investigate
```

### 5. Suggest next steps

| Scenario | Suggestion |
|----------|------------|
| Coverage ≥80%, everything passes | Ready for PR (merge is a human gate — GOVERNANCE.md §1) |
| Coverage <80% | Run `/aidakit:coverage` for the detailed gaps, then fire a test-writer subagent |
| Failing tests | Use aidakit:systematic-debugging to investigate, or run the test directly with the surface's runner (e.g., `npm run test -- --testNamePattern="test name"`) |
| Specific file below 80% | Run `/aidakit:coverage [file]` for line-by-line analysis |
| Performance degradation | Use `/aidakit:coverage --profile` to identify slow tests |

### Examples

**Example 1 — Quick surface validation.** You implemented a new service method and want to check that the tests pass.

```bash
/aidakit:test api
```

```
✅ api tests: PASS
Coverage: 87% (lines), 84% (branches)
Tests: 52 passed, 0 failed, 0 skipped
Duration: 14.2s

Summary: api tests healthy. Ready for PR.
```

Next step: run `/aidakit:test` on the other affected surfaces.

**Example 2 — Coverage below threshold.** A surface reports 76% coverage, below the 80% target.

```bash
/aidakit:test integration --coverage=80
```

```
⚠️ integration tests: WARN
Coverage: 76% (below the 80% target)
Tests: 38 passed, 0 failed, 0 skipped

Coverage gaps (top 3):
1. adapters/<adapter>.py:45-67 — retry logic — 20% coverage
2. handlers/<handler>.py:12-34 — idempotency check — 50% coverage
3. queue/consumer.py:89-110 — error-handling path — 30% coverage

Recommendation:
Run: /aidakit:coverage integration --detailed
Then: fire a test-writer subagent to add tests on the gaps
```

Next step: run `/aidakit:coverage integration --detailed` for the line-by-line breakdown, then fire a test-writer subagent.

**Example 3 — Failing tests.** Frontend tests fail after a form refactor.

```bash
/aidakit:test web --verbose
```

```
❌ web tests: FAIL
Coverage: N/A (tests failed)
Tests: 31 passed, 3 failed, 1 skipped

Failures:

1. <Form>.test.tsx:52
   "should validate field on blur"
   Error: expect(screen.getByText("<message>")).toBeInTheDocument()
   Expected element not found.

   Diagnosis: the validation logic may have changed.
   Suggestion: check the validation rules in the component.

2. <Summary>.test.tsx:78
   "should calculate total"
   Error: expected value differs from the rendered value

   Diagnosis: incorrect calculation or outdated test expectation.
   Suggestion: check the calculation logic in the component.

3. <Modal>.test.tsx:99
   "should redirect after submit"
   Error: page.waitForURL("<route>") timed out

   Diagnosis: navigation may be broken or an async operation without await.
   Suggestion: check the navigation logic in the component.

Recommendation:
1. Fix the issues in the frontend code
2. Run again: /aidakit:test web
3. Or use aidakit:systematic-debugging to investigate the root cause
```

Next step: fix the failing tests and run `/aidakit:test web` again.

### Troubleshooting

**"No tests found"** — no test files exist on the indicated surface.
1. Check whether there are test files following the surface's convention (e.g., `ls <surface>/src/**/*.spec.ts` or `ls <surface>/tests/`)
2. Create the test files if needed
3. Run again: `/aidakit:test <surface>`

**"Database/service connection refused"** — an infrastructure dependency (database, queue, etc.) isn't running for the tests.
```bash
# If the repo has docker compose, bring the dependency up with it
docker compose -f <repo compose> up -d <service>

# Wait for startup (5–10 seconds)
sleep 10

# Run the tests again
/aidakit:test <surface>
```

**"Port already in use"** — a running dev server is blocking the test server.
1. Stop the dev server: `Ctrl+C` in the terminal
2. Or use another port (e.g., `PORT=<other> npm run test`)
3. Run again: `/aidakit:test <surface>`

**"Tests passed but coverage is wrong"** — the coverage report looks inaccurate or is missing.
1. Clear the coverage cache (e.g., `rm -rf <surface>/.nyc_output <surface>/coverage`)
2. Reinstall the dependencies
3. Run again: `/aidakit:test <surface>`
4. If it persists, run `/aidakit:coverage <surface>` for detailed inspection

## Outputs

- **A test report in chat**, in one of the three formats from step 4 (PASS / WARN / FAIL), with coverage metrics, prioritized gaps, and next steps.
- **No new document is created by default.** When the in-flight change requires recording the result (validation evidence), it goes into `docs/features/<change-id>/` as the change's evidence artifact, per DOCS.md (repos with OpenSpec: `openspec/changes/`). Do not create a loose doc outside that structure.

## Gates and guardrails

### Success criteria

- **Tests pass:** all unit, integration, and E2E tests pass.
- **Coverage ≥80%:** line AND branch coverage both ≥80%.
- **No warnings:** no type errors, lint errors, or test warnings.
- **Performance:** tests run in <30 seconds per surface.
- **Deterministic:** tests pass consistently (no flaky tests).
- **Clear failures:** when tests fail, the error messages describe the problem clearly.

### Coverage tiers

Not every line deserves the same coverage bar. Apply this triage when reporting and when deciding whether to block a commit.

**Critical paths — must stay >85%:**
- Business logic (each surface's services layer)
- Domain models (schemas/entities)
- API endpoints (controllers/routes — all GET, POST, PATCH, DELETE)
- Adapter contracts and message handlers, as required by the repo's recorded decisions (ADRs in `docs/decisions/`, authoritative index in `docs/decisions/README.md` — see DOCS.md)

**Nice-to-have — don't block for <80%:**
- UI components (manual testing via dev server is acceptable)
- Error-message strings (partial coverage OK)
- Pure utilities without branching

### Block-vs-warn policy

**Blocks commit / PR:**
- Any failing test
- Coverage <80% on critical paths
- Type-check errors (the repo's typecheck command fails)
- Strict type-checking errors on Python surfaces (e.g., `mypy --strict`), if configured
- Linter errors (whatever linter each surface configures)

**Warns but allows:**
- Critical-path coverage between 80–85% (suggest more tests)
- Complex functions with branch coverage <85% (suggest refactor + test)
- New file with no tests at all (must be flagged explicitly)

### Escalation

- Merge is NEVER the agent's: with everything green, the destination is a short branch + PR and the URL handed to the human (GOVERNANCE.md §1 and §2).
- If closing the gaps would require stepping outside the change's approved scope, stop, present the finding, and wait (GOVERNANCE.md §1, rule 3).

## Related

- **[aidakit:coverage](../coverage/SKILL.md)** — deep analysis of the coverage gaps (use after aidakit:test shows <80%). Flow: `/aidakit:test <surface>` for the quick check (coverage ≥80%?), then `/aidakit:coverage <surface>` for the deep one (which lines are uncovered? why?).
- **aidakit:orchestrator (agent)** — runs tests as part of the multi-agent orchestration; calls aidakit:test internally after the implementation agents finish:
  ```
  aidakit:orchestrator: "<feature-name>"
  # Internally:
  # 1. Fires implementation agents in parallel (one per affected surface)
  # 2. Calls /aidakit:test on each affected surface to validate
  # 3. If coverage <80%, fires a test-writer subagent
  # 4. With everything green, opens the PR and hands over the URL — merge is the human's (GOVERNANCE.md §1)
  ```
- **[aidakit:systematic-debugging](../systematic-debugging/SKILL.md)** — root-cause debugging of failing tests.
- **The target project's code-review agent** — if the project defines one, it runs `/aidakit:test` as part of validation (checkout the branch → typecheck, lint, and `/aidakit:test` of the affected surfaces → review verdict, without editing or merging — "report, don't fix", GOVERNANCE.md §3).
- **The target project's test-writer subagent** — if defined, receives the gaps to fill.

**Typical flow:** `/aidakit:test` → (if <80%) `/aidakit:coverage` → test-writer subagent → `/aidakit:test` again.

<!-- aidakit v0.2 — generalized from the mx package (representante-digital) on 2026-07-17 — translated to EN -->
