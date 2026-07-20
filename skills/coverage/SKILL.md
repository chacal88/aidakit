---
name: coverage
description: Analyzes the test coverage of every testable surface in the current repo. Use when the user asks for "coverage", "test coverage", "coverage report", "coverage gap", "test quality", "which files need more tests", "untested code", or wants to verify the coverage target before a PR, merge, or release. Generates a per-surface coverage report, identifies files below the 80% target (85% for critical paths, per the aidakit:test tiers), and suggests concrete tests to improve coverage.
---

# aidakit:coverage — Test coverage analysis

> Analyzes the test coverage of every surface of the target repo and delivers actionable guidance to reach and hold the 80%+ target.

## When to use (and when not)

**Use when:**
- The user asks for coverage, a coverage report, test gaps, test quality, or a list of untested files/code.
- You need to verify the coverage target before a PR, merge, or release.
- A new feature needs guidance on which tests to add and in what order.

**Do not use when:**
- The goal is to run the suites and understand the test tiers/commands → use aidakit:test.
- The goal is to debug a test failure → use aidakit:systematic-debugging.

## Prerequisites

- Access to the target repo and the installed dependencies to run the test runners.
- **Never assume a surface has coverage configured** — check its config first.
- If the repo documents its test commands (CLAUDE.md, README, contribution guide), **prefer those commands over guessing**.

## Process

### 0. Discover the target repo's surfaces

Do NOT assume a fixed project layout. Before anything else, discover which testable surfaces the repo has:

1. **Detect the layout**: look for monorepo markers (`package.json` with `workspaces`, `pnpm-workspace.yaml`, `turbo.json`, `lerna.json`, top-level directories like `apps/`, `packages/`, `projects/`, `services/`) or a single-package repo.
2. **Detect the test runner per surface**: look for `jest.config.*`, `vitest.config.*`, `pytest.ini` / `pyproject.toml` (`[tool.pytest]`), `go.mod`, `Cargo.toml`, etc., and coverage scripts in each `package.json` (`test:cov`, `test -- --coverage`, `coverage`).
3. **Build the surface table** and confirm it in your output:

| Surface | Runner | Coverage command | Report location |
|---------|--------|------------------|-----------------|
| (discovered) | (Jest / Vitest / pytest / ...) | (from package scripts or docs) | (coverage/ dir, .coverage, etc.) |

### 1. Collect the coverage reports

For each discovered surface, run its coverage command (e.g., `npm run test:cov`, `npx vitest run --coverage`, `pytest --cov=src`) and locate the report. Common formats:

| Runner | Report | Format |
|--------|--------|--------|
| Jest | `coverage/coverage-final.json`, `coverage/lcov.info` | JSON + LCOV |
| Vitest | `coverage/` (check the coverage setup in `vitest.config.*`) | JSON v8/istanbul + HTML |
| Coverage.py | `.coverage` database, `coverage.xml`, `htmlcov/` | SQLite / XML / HTML |

Don't assume the surface has coverage configured — check the config first. In Vitest, coverage may need to be enabled:

```typescript
test: {
  coverage: {
    provider: 'v8',
    reporter: ['text', 'json', 'html'],
    exclude: ['node_modules/', 'tests/']
  }
}
```

### 2. Interpret the coverage data

**Jest/Vitest — `coverage-final.json`**, per-file structure: `statementMap`/`fnMap`/`branchMap` plus the counters `s` (statements), `f` (functions), `b` (branches), where a count of 0 = not covered. Per-file coverage:

```
Covered lines = count(s[i] > 0 for all i)
Total lines = len(s)
% lines = (Covered lines / Total lines) * 100
```

Same logic for functions (`f`) and branches (`b`). `lcov.info` is also human-readable text if the JSON is missing.

**Coverage.py** — parse via Python:

```python
from coverage import Coverage
cov = Coverage()
cov.load()
cov.get_data().lines.items()  # {path: [line_numbers]}
```

Or the XML report:

```python
import xml.etree.ElementTree as ET
tree = ET.parse('coverage.xml')
for cls in tree.findall('.//class'):
    line_rate = float(cls.get('line-rate', 0))
```

For other runners, use the machine-readable report they emit (LCOV is the most portable) and apply the same calculation.

### 3. Identify gaps

For each surface:
- Files below the 80% target
- Uncovered functions/lines
- Complex branches without a test
- Missing integration-test coverage

### 4. Suggest improvements

For the 5 files that most need coverage:
- Specific test patterns (unit, integration, edge case)
- Example test code (not complete — enough to get started), **mirroring the target repo's existing test patterns**: before suggesting, read the `*.spec` / `*.test` / `test_*` files closest to the file with the gap and follow their conventions (mock style, fixtures, assertion library)
- Estimated effort
- Priority (by impact + complexity)

### Targets and thresholds

**Project target: 80%+** per surface (unless the repo documents a different target — check CLAUDE.md or the repo's recorded decisions in `docs/decisions/`, index in `docs/decisions/README.md`, per DOCS.md).

| Metric | Target | Yellow (Watch) | Red (Action) |
|--------|--------|----------------|--------------|
| **Overall per surface** | 80%+ | 75–79% | <75% |
| **Per file** | 80%+ | 60–79% | <60% |
| **Critical files** | 85%+ | 75–84% | <75% |

### File tier system (by architectural role, not by path)

Classify each file by its role in the target repo:

**Tier 1 — Test heavy (target 90%+)**
- Core business logic (services, use cases, domain logic)
- API boundaries (controllers, route handlers, resolvers)
- Auth/authorization (guards, middleware, policies)
- Critical user-facing business flows (payment, checkout, signup, forms with validation)
- External-integration adapters and retry/backoff logic
- Queue/messaging consumers

**Tier 2 — Test moderate (target 80%+)**
- Data layer (repositories, DAOs, models)
- DTOs/schemas with complex validation
- Utilities, helpers, API client functions
- Infrastructure services (email, queue producers)

**Tier 3 — Light coverage (target 70%+)**
- Module declarations/wiring, layout/composition components
- Constants, type definitions (interfaces, enums)
- Page wrappers, static content, boilerplate

**Always exclude:**
- Bootstrap/entrypoint files (e.g., `main.ts`, `index.ts` wiring)
- Framework wiring files (e.g., `*.module.ts`)
- The test files themselves and test-setup files
- Dependency and build directories (`node_modules/`, `.next/`, `dist/`, `venv/`, `__pycache__/`)
- Framework config files

### Test suggestions by pattern

**Error cases first (the most common coverage gap).** Error paths are what most services fail to test. Generic form (adapt names and style to the target repo):

```typescript
// Service error paths (Jest/Vitest)
it('should throw NotFoundException when the entity is not found', async () => {
  repo.findOne.mockResolvedValue(null);
  await expect(service.getById('999')).rejects.toThrow(NotFoundException);
});

it('should handle persistence errors gracefully', async () => {
  repo.find.mockRejectedValue(new Error('DB error'));
  await expect(service.list()).rejects.toThrow();
});
```

```typescript
// UI form error states (Testing Library)
it('should show API error message when submission fails', async () => {
  vi.mocked(api.submit).mockRejectedValue(new Error('Server error'));
  await user.click(screen.getByRole('button', { name: /submit/i }));
  expect(screen.getByText(/server error/i)).toBeInTheDocument();
});
```

```python
# Retry/timeout logic (pytest)
@pytest.mark.asyncio
async def test_adapter_retries_on_timeout():
    with patch('asyncio.sleep'):  # speeds the test up
        result = await adapter.sync_with_timeout()
        assert result.retry_count == 3
```

**Edge cases — always cover:**
- Empty input (empty list, null fields, empty string)
- Boundary values (min/max, first/last)
- Invalid input (wrong type, out of range)
- Concurrent operations (race conditions)
- State transitions (e.g., PENDING → PROCESSING → DONE)
- Rollback scenarios (transaction failure, cleanup)

**Suggestion checklist:**
- [ ] Include happy path (main flow)
- [ ] Include error cases (exceptions, invalid input)
- [ ] Include edge cases (boundary values, empty collections)
- [ ] Include state transitions (if applicable)
- [ ] Mock external dependencies (database, API, browser)
- [ ] Use descriptive test names
- [ ] Keep setup minimal (arrange-act-assert)
- [ ] Test one behavior per test
- [ ] Use fixtures/factories for repeated setup

### Report interpretation

**High coverage ≠ good tests.** Red flags of low-quality coverage:
- **High % but many untested branches** → the tests don't exercise error paths
- **High % but slow tests** → too many integration tests; missing unit tests
- **High % but hard-to-read tests** → undocumented tests, complex setup
- **High % but dependent on test data** → brittle tests, tied to specific database state

**Characteristics of good coverage:**
- Tests exercise the happy path AND the error cases
- Fast (unit tests dominate, E2E tests are spot uses)
- Clear intent (the test name describes the what and the why)
- Minimal setup (focused mocks, no over-mocking)
- Isolated (one test per behavior)

### Common problems and solutions

| Problem | Solution |
|---------|----------|
| **Tests can't find modules** | Check that the runner config's aliases (`moduleNameMapper` / `resolve.alias`) match the `tsconfig.json` paths |
| **Coverage report shows 0%** | Ensure the tests actually run; check for failures in the test command's output |
| **External API calls in tests** | Mock (`jest.mock()` / `vi.mock()` / `unittest.mock`) or use test doubles; avoid real HTTP calls |
| **Slow database tests** | Use an in-memory database (e.g., mongodb-memory-server, SQLite in-memory) for isolation |
| **No coverage output** | Ensure the runner config has coverage enabled; may need an explicit coverage flag |
| **Integration tests time out** | Increase the runner timeout (e.g., `pytest.ini` or `@pytest.mark.timeout(30)`) |

### Progress tracking

1. **Document the current state** as a WORKING artifact of the change in `docs/features/<change-id>/` (per DOCS.md; avoid a loose manual snapshot — DOCS.md mandates pointing to living sources):
   - Coverage % per surface
   - Top 3 gaps identified
   - Next areas of focus

2. **Update the before/after in the PRs**:
   ```
   ## Coverage impact
   - <Surface A>: 73% → 78% (+5%)
   - <Surface B>: 65% → 70% (+5%)
   ```

### Integration with the flow

1. **Before the PR**: run this skill to check gaps before the push
2. **Feature implementation**: use the suggestions to test new code as you write it
3. **Code review**: reference the coverage gaps when asking for tests to be added
4. **Pre-commit**: if the repo has a pre-commit checklist (CLAUDE.md or similar), the coverage check belongs to it
5. **Release preparation**: verify all surfaces ≥ 80% before merging into the main branch (the merge itself is always the human's — GOVERNANCE.md §1)

## Outputs

The main report is delivered in the conversation, in this format:

```
# Test coverage analysis

## Overall summary
- <Surface A>: X% (lines: A/B)
- <Surface B>: Y% (lines: C/D)
- **Average: Avg%** [status: On target / Below target]

## Below target (<80%)
**<Surface A> (N files)**
- file1: X% (M uncovered functions, L missing branches)
- file2: Y% (description of the gaps)

## Top files to test
**1. <file> (<Surface>) — X% coverage**
- Missing: specific features/branches
- Effort: X–Y hours (Low/Medium/High)
- Priority: High/Medium/Low (by impact)
- Suggested tests:
  ```lang
  example test code
  ```

[repeat 4 more]

## Improvement strategy
**Phase 1 (Immediate — <1 day):**
- [Action items with time estimates]
- Expected improvement: X% → Y%

**Phase 2 (Next sprint):**
- [Action items]
- Expected improvement: A% → B%

## Next steps
1. [Step 1]
2. [Step 2]
3. [Step 3]
```

If persisted, the report is a WORKING artifact of the change → `docs/features/<change-id>/` (per DOCS.md; in repos with OpenSpec, `openspec/changes/<change-id>/`). The coverage before/after goes in the PR body.

## Gates and guardrails

- **Blocking thresholds**: a surface in the red band (<75% overall, <60% per file, <75% on a critical file) requires action before the release; the release target is all surfaces ≥ 80%.
- **A recorded target wins**: if the repo has a different target recorded in an ADR (`docs/decisions/`), it prevails over the 80% default. Changing that target is superseding an ADR → the agent proposes a new draft ADR and the human decides (GOVERNANCE.md §1, escalation 2).
- **Merge is the human's**: this skill informs readiness; it never merges (GOVERNANCE.md §1, escalation 1). All ensuing work (new tests, coverage config) goes via a short branch + PR (GOVERNANCE.md §2).
- **Don't assume coverage is configured**: check each surface's config before running.
- **Outputs to avoid**:
  - Don't dump raw JSON
  - Don't list every file (hundreds) — summarize and prioritize
  - Don't suggest tests without examples
  - Don't ignore files below 50% (they need tests too)
  - Don't assume a surface has coverage configured (check the config first)
- **Do**: give actionable next steps, include test-code examples, prioritize by impact, explain the time estimates, and reference the target repo's code style.

## Related

- **Test tiers and commands**: aidakit:test
- **Debug test failures**: aidakit:systematic-debugging
- **Phased improvement plans**: for a multi-session test-improvement effort, hand the gap list to the aidakit:planner agent

<!-- aidakit v0.2 — generalized from the mx package (representante-digital) on 2026-07-17 — translated to EN -->
