# Design — acceptance-leash

**Change ID:** `acceptance-leash`
**Date:** `2026-07-24`
**Owner:** `@chacal88`
**Phase / Package:** `governance/ (validator + agent + flow wiring) — mechanical goal-leash on the PR gate`

## Problem shape

The doc-leash and the goal-leash are two instances of the same pattern: **an agent produces a manifest of required items, a validator checks each item against disk, and a flow step blocks the gate until the list is 100%.** The doc-leash has been running against the PR gate since `check-doc-manifest.js` shipped ([check-doc-manifest.js:1-99](../../../governance/validators/check-doc-manifest.js), wired at [full.yaml:308-316](../../../governance/flows/full.yaml), [fast.yaml:193-201](../../../governance/flows/fast.yaml)). The goal-leash — the acceptance criteria the brainstorm extracts — has no such enforcement: the criteria are prose in `proposal.md` and text in `brainstorm.json`, and nothing between "the model wrote them" and "the PR opens" checks that each one has an evidence path that actually resolves.

The load-bearing constraint: **do not duplicate `hardening`'s work.** `full.yaml` already re-runs the full test suite at `hardening` via `aidakit:test` ([full.yaml:224-232](../../../governance/flows/full.yaml)); `fast.yaml` runs `aidakit:test` inside `implement` ([fast.yaml:113-121](../../../governance/flows/fast.yaml)). A leash that re-executes tests would double the tail cost for zero signal — tests either pass at hardening or the flow does not reach the leash. The leash's real job is different: **the promise was mapped to a real artifact.** A criterion the model asserted but never wired to a test/evidence file is a lie; the validator catches the lie mechanically.

## The three-part mechanism

Mirroring the doc-leash's three-part shape:

1. **Author agent** — `aidakit:acceptance-planner` (new). Isolated context, `Write`-tool-authorized, self-contained system prompt. Consumes `{ change_id, criteria_source }` where `criteria_source` is either `brainstorm.json` (in `full`) or `proposal.md`'s `## Acceptance criteria` section (in `fast`). Reads the plan (proposal/design/tasks), maps each criterion to a concrete evidence path, writes `.aidakit/tasks/<change-id>/acceptance-manifest.json`.
2. **Validator** — `check-acceptance.js` (new). Pure Node, zero-dep. Reads the manifest, checks each required item's evidence path with `existsSync + isFile`. Same JSON output contract as `check-doc-manifest.js`. Weak-bar by decision (see §Weak-bar rationale).
3. **Flow wiring** — two new steps (`acceptance` invoke + `check_acceptance` runs) plus one escalation gate (`acceptance_escalation` human_gate) per flow. Slot: after `check_docs`, before `pr` (see §Slot decision).

## Validator contract

```
Usage: node check-acceptance.js <path-to-manifest.json>

Manifest format (acceptance-manifest.json):
  {
    "change_id": "acceptance-leash",
    "level": "change",
    "required": [
      { "criterion_id": "brainstorm-outputs-schema",
        "criterion": "aidakit:brainstorm emits acceptance_criteria[] with stable ids",
        "evidence": { "kind": "test" | "file" | "evidence-section",
                      "path": "governance/__tests__/engine.test.mjs" },
        "status": "pending" | "resolved" | "n/a",
        "condition": "why mandatory / why waived (mandatory for n/a)" }
    ]
  }

Exit codes: 0 pass · 1 incomplete · 2 usage/error

JSON output on stdout (mirrors check-doc-manifest.js):
  { "validator": "aidakit.check-acceptance",
    "ok": <bool>,
    "change_id": <string|null>,
    "level": "change" | "project",
    "required": <int>,   // items with status !== "n/a"
    "resolved": <int>,   // items whose evidence.path resolves
    "errors": [ { "rule": "evidence-missing" | "manifest-invalid",
                  "criterion_id": <string>,
                  "path": <string>,
                  "message": <string> } ] }
```

Key contract points, each borrowed verbatim from `check-doc-manifest.js`:

- **Paths are relative to the project root.** The validator discovers the root via `findProjectRoot(dirname(manifest))` (same `governance/engine/project-root.js` helper the doc-manifest validator uses since round 3 of [configurable-pr-automation](../configurable-pr-automation/proposal.md)) or `AIDAKIT_PROJECT_ROOT` env override.
- **`n/a` items are skipped**, always with a mandatory `condition`. An `n/a` without a `condition` is a manifest-invalid error, not a silent pass.
- **`status: resolved` is not trusted.** The disk is the truth; the field is descriptive. A `resolved` whose path does not exist is an `evidence-missing` error.
- **Fail-closed on manifest shape.** Missing `required` array → exit 2 with a `manifest-invalid` diagnostic. This matches `check-doc-manifest.js:43` ("manifest without a 'required' list").

### Weak-bar rationale

The brainstorm's Q3 (grilled question) resolved this: **weak bar, path-exists only, no re-execution.** Two reasons:

- **Cost:** re-running the suite here means running it twice per flow (once at `hardening`, once at `check_acceptance`). The suite is the expensive artifact; the leash is the cheap check.
- **Separation of concerns:** the leash checks *"the criterion was mapped to a real thing"*; the tests check *"the real thing still passes."* Merging them collapses the two failures — a genuinely broken test and a lying manifest become indistinguishable in the error output. Keeping them separate keeps the diagnostics readable.

The residual is intentional: an evidence file that exists but fails at runtime is caught by `hardening` (in `full`) or `implement`'s `aidakit:test` invoke (in `fast`), not here. The leash is not the test runner.

## Agent contract — `aidakit:acceptance-planner`

Mirrors [agents/doc-planner.md](../../../agents/doc-planner.md) verbatim in shape (Role · Protocol · Decisions · Escalations · Not-do · Output), differing only in the deliverable it produces.

**Frontmatter:**

```yaml
---
name: acceptance-planner
description: Agent that ASSEMBLES the acceptance-manifest of a change — the GOAL-LEASH. Maps each acceptance criterion (from brainstorm.json in full, or from proposal.md's `## Acceptance criteria` section in fast) to a concrete evidence path (test file, evidence.md section, log capture), and emits acceptance-manifest.json that check-acceptance.js verifies path-by-path — the flow ONLY ADVANCES when the list is 100%. Use at the acceptance step of a flow, after check_docs. Receives { change_id, criteria_source } and returns the manifest. Weak-bar (path-exists), no re-execution — tests remain the job of hardening/aidakit:test.
tools: Read, Glob, Grep, Write
model: sonnet
---
```

**Protocol summary** (full text authored during implement):

- **Step 0 — Detect the criteria source.** If `.aidakit/tasks/<change-id>/brainstorm.json` exists and carries `acceptance_criteria[]`, that is the source. Otherwise (fast flow), read `docs/features/<change-id>/proposal.md`'s `## Acceptance criteria` section and parse it as a bullet list.
- **Step 1 — Read the plan.** `proposal.md`, `design.md`, `tasks.md` — to know which files/tests exist or are planned.
- **Step 2 — Map each criterion to an evidence path.** The agent decides: a criterion about a validator's behavior maps to the validator's test file (`governance/__tests__/*.test.mjs`); a criterion about a flow's wiring maps to the flow YAML or an engine test §; a criterion about an artifact existing maps to the artifact path itself; a criterion about human-visible behavior maps to a captured evidence section in `evidence.md` (path + anchor). When no mapping fits cleanly, `n/a` with a written `condition` is the disciplined answer — not a fictional path.
- **Step 3 — Write the manifest.** `.aidakit/tasks/<change-id>/acceptance-manifest.json`. Envelope `{ change_id, level: "change", required: [...] }`. Every path relative to the project root.
- **Step 4 — Cross-check.** Every non-`n/a` item has an `evidence.path`; every `n/a` has a `condition`; the JSON is valid; the `required` list is not empty (a change with no criteria is a red flag — escalate rather than emit an empty manifest).

**Escalation triggers** (GOVERNANCE.md §1):

- **Escalation 3 (scope):** the criteria source is missing or empty when the change is non-trivial; the plan does not exist yet (agent invoked out of order); a criterion cannot be mapped to any evidence path even after reading the plan (means the plan does not deliver what the criterion promised).
- **Escalation 2 (ADR):** never applies — the agent does not decide policy, only mapping.
- **Escalation 1 (merge):** never reaches it.

**What it does NOT do:**

- **Does not write tests or evidence.** It records where they LIVE (or will live); filling them in is `aidakit:implement`'s job.
- **Does not run the validator.** `check-acceptance.js` is a `runs` step of the flow.
- **Does not mark `resolved` for convenience** — same discipline as `aidakit:doc-planner`.
- **Does not invent evidence paths** to make the manifest "complete." An unmappable criterion is escalated, not lied about.

## Flow wiring

### Slot decision (the one open decision from the brainstorm)

**Chosen:** `document → check_docs → acceptance → check_acceptance → pr` (acceptance runs AFTER check_docs, and re-runs every time the flow reaches it).

**One-line justification:** the acceptance-manifest may reference paths inside the documentation surface (e.g. `docs/features/<id>/evidence.md#section`), so `check_docs` must pass first to guarantee those docs actually exist on disk — running acceptance before check_docs risks blessing a manifest whose evidence targets are documents the doc-leash has not yet enforced.

**Alternative rejected: `acceptance → check_acceptance → document → check_docs → pr`.** Rejected because the doc-leash already knows how to lock the PR gate; running acceptance first means an acceptance-manifest failure could mask a doc-manifest failure by pre-empting it, and the debugging order ("fix docs, then re-run and see if acceptance still fails") is more painful. Placing acceptance after check_docs makes each leash's failure diagnostic independent.

**Re-run semantics:** acceptance re-runs every time the flow reaches the step, not conditionally on "a criterion changed." Reasoning: the same simple rule the doc-leash follows (`document` re-runs on every visit to that slot; the manifest is rewritten from the current plan). A `critic: revise → specify` back-edge that reshapes the plan naturally re-enters `acceptance` when the flow reaches the slot again; the agent reads the *current* plan and rewrites the manifest. There is no "criterion changed" detection primitive to build — the whole manifest is cheap to regenerate (JSON write over an isolated read of the plan).

### `full.yaml` delta

Between the current `check_docs` (line 308) and `pr` (line 318):

```yaml
  - id: check_docs
    type: runs
    description: |
      LEASH GATE — check-doc-manifest checks item by item and LOCKS the flow until the
      list is 100%. exit 0 (gate released) proceeds to the acceptance-leash; exit≠0
      (incomplete) goes back to document until the list closes.
    command: "node \"$AIDAKIT_GOVERNANCE/validators/check-doc-manifest.js\" \".aidakit/tasks/${context.select.change_id}/doc-manifest.json\""
    on_success: acceptance          # was: pr
    on_failure: document

  - id: acceptance
    type: invoke
    description: |
      aidakit:acceptance-planner — GOAL-LEASH author. Maps each acceptance criterion
      (from .aidakit/tasks/<id>/brainstorm.json) to a concrete evidence path (test file,
      evidence.md section, log capture) and writes acceptance-manifest.json. Re-runs on
      every visit to this slot — a plan revised earlier in the flow gets a fresh manifest.
    invoke_target: aidakit:acceptance-planner
    input:
      change_id: "${context.select.change_id}"
      criteria_source: "brainstorm"
    expects:
      - success
      - failure
    on_success: check_acceptance
    on_failure: aborted

  - id: check_acceptance
    type: runs
    description: |
      LEASH GATE — check-acceptance verifies each criterion's evidence path resolves on
      disk (weak-bar; hardening already ran the suite). exit 0 proceeds to the PR; exit≠0
      goes back to acceptance. Capped at 3 dispatches (max_visits) so a broken manifest
      cannot loop the tail; the 4th entry escalates via acceptance_escalation.
    command: "node \"$AIDAKIT_GOVERNANCE/validators/check-acceptance.js\" \".aidakit/tasks/${context.select.change_id}/acceptance-manifest.json\""
    max_visits: 3
    on_max_visits: acceptance_escalation
    on_success: pr
    on_failure: acceptance

  - id: acceptance_escalation
    type: human_gate
    description: |
      Escalation gate — the acceptance-leash could not clear in 3 rounds. The manifest at
      .aidakit/tasks/${context.select.change_id}/acceptance-manifest.json has criteria
      whose evidence paths do not resolve. Abort so you can intervene out-of-band (fix
      the missing evidence or waive the criterion with a written condition) and re-run.
    prompt: |
      "${inputs.request}": the acceptance-leash ran 3 rounds without clearing. Some
      acceptance criteria still have evidence paths that don't resolve on disk. Inspect
      the manifest at .aidakit/tasks/${context.select.change_id}/acceptance-manifest.json
      and the errors it reports. Abort to intervene?
    options:
      - abort
    on_result:
      abort: aborted

  - id: pr
    type: invoke
    # ... unchanged
```

### `fast.yaml` delta

Identical shape, criteria source is the plan (no brainstorm step in `fast`):

- `check_docs.on_success` re-routes from `pr` to `acceptance`.
- New `acceptance` invoke with `input.criteria_source: "plan"`.
- New `check_acceptance` runs with the same `max_visits: 3` + `on_max_visits: acceptance_escalation`.
- New `acceptance_escalation` human_gate.

### Why `max_visits` sits on `check_acceptance`, not on `acceptance`

The doc-leash equivalent (`check_docs` → `document`) does not carry a `max_visits` today. This change is stricter for a specific reason: the acceptance-manifest is the model's *own* map of promises-to-evidence; a broken map that never clears indicates the model is failing to reconcile its promises against the plan (either the criteria are wrong or the evidence does not exist). Three rounds of that is enough — escalate and let the human decide whether to fix the evidence or waive the criterion. Same rationale as `specify.max_visits: 3` in [engine-max-visits/design.md](../engine-max-visits/design.md).

`acceptance` (the invoke) does not need its own cap because the only way to re-enter it is through `check_acceptance.on_failure` — capping `check_acceptance` implicitly caps `acceptance` in this pair.

## Manifest schema (canonical)

```json
{
  "change_id": "acceptance-leash",
  "level": "change",
  "required": [
    {
      "criterion_id": "acceptance-planner-agent-exists",
      "criterion": "New agent aidakit:acceptance-planner exists (mirrors aidakit:doc-planner shape)",
      "evidence": {
        "kind": "file",
        "path": "agents/acceptance-planner.md"
      },
      "status": "pending",
      "condition": "brainstorm criterion 1; the file existing is the observable of the mirror shape"
    },
    {
      "criterion_id": "check-acceptance-validator-exists",
      "criterion": "check-acceptance.js exists and mirrors check-doc-manifest.js output contract",
      "evidence": {
        "kind": "test",
        "path": "governance/__tests__/check-acceptance.test.mjs"
      },
      "status": "pending",
      "condition": "brainstorm criterion 2; the test file asserts the output contract"
    }
    // ... one per criterion from brainstorm.acceptance_criteria[]
  ]
}
```

**Item field semantics:**

- `criterion_id` — stable kebab-slug the agent assigns. If `brainstorm.json` already carries `acceptance_criteria[].id`, use that verbatim; otherwise the agent derives a slug from the criterion prose.
- `criterion` — the observable-effect sentence, verbatim from the source.
- `evidence.kind` — `test` (the criterion is satisfied when a test asserts it), `file` (the criterion is satisfied when a file exists — the acceptance-planner agent file, a new ADR file, etc.), `evidence-section` (the criterion is satisfied by a captured record in `evidence.md`, path includes an anchor). The validator does not enforce `kind` semantics — it only checks the path exists — but the `kind` documents the intent for reviewers.
- `evidence.path` — relative to the project root. For `evidence-section`, the path may include a `#anchor` suffix; the validator strips the anchor for `existsSync` (same convention as `check-links.js`).
- `status` — `pending` | `resolved` | `n/a`. Descriptive; the disk is the truth (see Validator contract).
- `condition` — mandatory on `n/a`; recommended on `pending`/`resolved` to record the mapping's justification.

## Brainstorm output schema formalization

`agents/brainstorm.md` currently emits acceptance criteria as an unstructured bullet list (`agents/brainstorm.md:90-93`). This change adds a stable id to each item. The output format section gains:

```md
**Acceptance criteria (the observable effect of "done"):**
- `<criterion-id-kebab-slug>` — <criterion prose>
- `<criterion-id-kebab-slug>` — <criterion prose>
- ...
```

And the brainstorm-event trail unchanged. The `.aidakit/tasks/<id>/brainstorm.json` structured form (used by `acceptance-planner`):

```json
{
  "acceptance_criteria": [
    { "id": "acceptance-planner-agent-exists", "criterion": "..." },
    { "id": "check-acceptance-validator-exists", "criterion": "..." }
  ]
}
```

Reason: the acceptance-planner needs a stable key to correlate manifest items with source criteria across re-runs — otherwise a rewording of the prose (during plan revision) would look like a new criterion and orphan the previous manifest item. The slug is that key.

## Interaction with existing leashes

- **Doc-leash (`check_docs`)** — remains the first leash on the tail; `acceptance` runs only after `check_docs` clears. The two are independent: the doc-manifest lists documents, the acceptance-manifest lists evidence for criteria. A path may appear in both when the criterion's evidence is a document (e.g. `docs/decisions/ADR-010-acceptance-leash.md` is both a required doc AND the evidence for criterion 6); the validator does not detect nor prevent that overlap, which is fine — each leash is a check, not a definition.
- **Parallelism leash (`check_bench`)** — unrelated; different surface (multi-surface implement/review dispatch). No interaction.
- **`engine-max-visits` cap on `specify`** — independent from `check_acceptance`'s cap. The `specify_escalation` handles the "plan can't converge" case; `acceptance_escalation` handles the "plan converged but its promises can't be mapped to evidence" case. Distinct failure modes, distinct escalations.

## Backwards compatibility

- Consumer-authored flows that do NOT add the two new steps continue to work — the engine does not force any flow to include them. The default `full.yaml` and `fast.yaml` gain the steps; other flows opt in explicitly.
- Existing archived changes (no acceptance-manifest ever produced) are untouched — the leash only fires when the current flow reaches the new steps, which happens for changes started after this ships.
- `check-doc-manifest.js`'s output contract is unchanged; `check-acceptance.js` shares the shape but is a distinct binary.

## Anti-drift check (before coding)

To re-verify at the start of implement (GOVERNANCE.md §8):

- [check-doc-manifest.js:47-49](../../../governance/validators/check-doc-manifest.js) — `findProjectRoot` invocation shape (same helper `check-acceptance.js` will use). Confirmed.
- [full.yaml:308-317](../../../governance/flows/full.yaml) — `check_docs → pr` current wiring; the `on_success: pr` line is the exact edit target. Confirmed.
- [fast.yaml:193-202](../../../governance/flows/fast.yaml) — same shape in `fast`. Confirmed.
- [engine-max-visits/design.md](../engine-max-visits/design.md) §Mechanism — `max_visits` counts fresh entries only (guarded by `resumeValue === undefined`); `check_acceptance` is a `runs` step (non-pausing), so the guard is a no-op there — the counter is the total dispatch count of the `runs` step per flow_id. Confirmed.
- [agents/doc-planner.md](../../../agents/doc-planner.md) — the mirror template (Role · Protocol · Decisions · Escalations · Not-do · Output); the acceptance-planner follows the same anatomy per [GOVERNANCE.md](../../../GOVERNANCE.md) §7.
- [agents/brainstorm.md:88-101](../../../agents/brainstorm.md) — current acceptance_criteria emission shape; the slugged variant is a strict superset (adds an id, keeps the prose).

No divergence from proposal assumptions.
