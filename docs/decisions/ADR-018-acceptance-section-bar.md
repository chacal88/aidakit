<!-- File: docs/decisions/ADR-018-acceptance-section-bar.md — global sequential numbering, never recycled. Registered in the index docs/decisions/README.md. -->
<!-- An ADR is WORM: never edit a past decision. Changed your mind → a new ADR that supersedes or amends this one. -->

# ADR-018: `evidence-section` is resolved against the SECTION, not the file — amending ADR-010's weak bar at its own review trigger

- **Status:** accepted
- **Date:** 2026-08-24
- **Amends:** [ADR-010](ADR-010-acceptance-leash.md) §Decision 2 (the weak bar), at the review trigger that decision wrote for itself.

## Context

[ADR-010](ADR-010-acceptance-leash.md) §Decision 2 fixed the acceptance-leash at a weak bar: `check-acceptance.js` verifies each `evidence.path` with `existsSync + isFile` and never re-executes anything. The decision named its own review trigger:

> *"Revisit if the weak-bar starts letting through evidence paths that reviewers repeatedly find to be trivially satisfied (a `file` kind pointing at an empty `.md`, say — which technically resolves but does not observe anything). The correct move would be a stronger `kind`-aware check (per-kind validation rules), not a re-execution — this ADR would gain an amendment naming the new bar."*

The trigger fired, in the sharpest possible form. Reported from **psim-kernel, 2026-08-18**, at the last round of a change's bench, in the gate itself:

- The manifest mapped the criterion `bench-proof-two-xpe` to `openspec/changes/<id>/evidence.md#bench-proof-two-xpe`, kind `evidence-section`.
- `check-acceptance.js` stripped the `#anchor` and asked whether `evidence.md` existed **as a file**. It did — it held the change's other nine criteria.
- The gate answered `OK — 10/10 acceptance criteria resolved. Gate cleared.`, **exit 0**.
- The section the anchor named said, in writing, `PENDENTE`, then listed all five required outputs as `**pendente**`, for both devices. The criterion was objectively not met.

Two properties make this worse than a plain miss. First, `check_acceptance` is the **last gate before the `pr` step**, and psim-kernel runs with `pr.auto_merge: true` — the step after the PR is the merge. An open acceptance criterion would have reached automatic merge on the strength of a green that examined nothing. It was stopped by a human reading the file, not by the mechanism. Second, a green **ends the question**: an absent gate leaves a reviewer looking, a gate that answers "10/10 resolved" tells them not to.

The anchor was never decorative *in intent* — the agent contract has always instructed `evidence-section` items to carry `path + #anchor` ([agents/acceptance-planner.md](../../agents/acceptance-planner.md) Step 2). It was decorative *in enforcement*: the one part of the promise that identified WHAT was proven was the one part the validator discarded.

## Decision

**1. A criterion that names a section is resolved against that section.** When `evidence.kind` is `"evidence-section"` — or when the path is a markdown file carrying an `#anchor`, whatever `kind` says — `check-acceptance.js` resolves the anchor to a real heading and reads the section body. Three new error rules, each naming the `criterion_id`, each exit 1 like every other leash finding:

| rule | fires when |
|---|---|
| `evidence-anchor-missing` | `kind: "evidence-section"` with no `#anchor` — the promise does not identify a section, so the file would resolve it for free |
| `evidence-section-missing` | no heading in the file slugifies to the anchor |
| `evidence-section-pending` | the section exists and still declares itself unfinished |

Keying the bar on the anchor as well as on `kind` closes the obvious dodge: relabelling the item `kind: "file"` while keeping `evidence.md#anchor` must not buy back the free pass.

**2. "Marked pending" is read from the vocabulary the artifacts already use, not from a new convention.** An unchecked task box (`- [ ]`); a pending word in ALL CAPS (`PENDENTE`, `PENDING`, `TODO`, `TBD` — the caps are themselves the marking); or a pending word in any case inside emphasis (`**pendente**`), which is how a per-item status is written inside a table or list. Inventing a machine marker (`<!-- acceptance: pending -->`) was rejected: the failure mode being closed is *a human wrote PENDENTE and the machine did not read it*, and a new marker only binds authors who already know about the gate.

**2b. Word boundaries are Unicode lookarounds, not `\b`.** JavaScript's `\b` is ASCII-only: it sees a boundary between `é` and `t` and reads **"todo" out of the middle of the pt-BR word "método"**. Measured while dogfooding this change in psim-kernel — the fixed gate blocked its own evidence section on the phrase `**Registro de método:**`. The markers use `(?<![\p{L}\p{N}])…(?![\p{L}\p{N}])` with the `u` flag, and the regression is pinned by a test. A marker vocabulary that fires on accented prose would have made the bar unusable in exactly the repo that reported the defect.

**3. The bar stays STATIC. ADR-010 §Decision 2 is amended, not reversed.** Nothing is re-executed; `hardening` / `aidakit:test` remain the owners of runtime verification, and a `test`/`file` criterion is still path-exists. What changes is the OBJECT of the existing check — from "the file that holds the section" to "the section" — not its strength class.

**4. Fenced blocks are excluded from marker scanning, and from heading detection.** Both directions matter and neither is a nicety. An evidence section holds captured terminal output, which routinely contains lines shaped like headings (`### 1 — comando`); reading one as a real heading truncates the section body, and the gate then judges a slice of the section while reporting on the section — the same "read the right thing in the wrong place" defect this ADR exists to close, reintroduced one level down. In the reported case the truncation would have hidden the pendency, because it sat after the captures. Symmetrically, a log line containing the word "pending" is the equipment talking, not the author declaring a status. **Declared limit:** pendency written *inside* a code fence is not seen. The alternative — scanning captures — would block sections on the content of the very evidence they exist to hold.

**5. The JSON envelope declares the rules the validator enforces (`enforces[]`).** The kit ships inside `~/.claude/plugins/`, which no target repo's `git clone` carries: a project whose delivery depends on the section bar cannot tell a fixed installation from an old one by reading its own repo. `enforces: ["evidence-path-exists", "criterion-orphan", "evidence-section-content"]` gives it a mechanical floor to assert, instead of trusting that whoever cloned also ran `claude plugin update`. This is the same class of problem [ADR-016](ADR-016-runtime-change-requires-plugin-bump.md) closed at the release edge, seen from the consumer side.

**6. The section-resolution logic is its own module, `governance/acceptance/evidence-section.js`**, beside `parse-criteria.js`, rather than inline in the validator. Same reason `parse-criteria.js` exists: markdown section resolution is a testable unit with edge cases (slugify, fences, heading levels) that deserve their own RED, and the validator stays a manifest walker.

## Consequences

- **Positive:** the anchor becomes load-bearing — a criterion mapped to a section is now answered by that section. The three new rules name the criterion, so the failure is actionable without opening the manifest. The reported case reproduces as a clean RED: on the real artifacts of the psim-kernel change, the pre-fix validator answers `OK — 10/10 … Gate cleared.` (exit 0) and the fixed one answers `BLOCKED — 9/10 resolved; 1 pending`, naming `bench-proof-two-xpe` (exit 1) — with the other five `evidence-section` criteria of the same file, all genuinely complete, still resolving.
- **Negative (accepted):** a section that legitimately discusses pendency in prose — *"this used to be PENDENTE"* — now blocks. The marker set is narrow (caps or emphasis) to keep this rare, and the failure is loud and one edit away. Fail-closed is the right side to err on for the last gate before an automatic merge.
- **Negative (accepted):** the marker vocabulary is bilingual (`pendente`, `pending`) because the kit's consumers write evidence in their own language. A third language's marker is invisible until someone adds it — the escape hatch until then is `n/a` + a written `condition`, which was always the honest way to record an unmet criterion.
- **Negative (declared):** pendency inside a code fence is not seen (Decision 4). A hyphenated compound (`TODO-like`) still reads as a marker — the boundary class is letters and digits, and widening it to punctuation would let `**pendente:**` escape.
- **Positive, measured:** the bar found a defect in itself on first contact with a real repo (Decision 2b), which is the behaviour ADR-0067 of the consuming project asks of any verification: it must be seen firing before it is believed.
- **Negative (mitigated):** a project cannot inherit this fix through its own `git clone` — the validator lives in the plugin. Mitigated by `enforces[]` (Decision 5), which lets a repo assert the floor in its own flow YAML and fail loudly against an old installation instead of silently losing the bar.

## Alternatives considered

| Option | Pros | Cons | Cost to undo |
|---|---|---|---|
| Leave the weak bar; rely on the human reading `evidence.md` | No change | That is exactly what happened — the human caught it, the mechanism did not, and the next repo may not have that human awake at the last gate | n/a |
| Require a machine marker (`<!-- acceptance: resolved -->`) per section | Unambiguous parse, no language question | Binds only authors who already know the gate exists; the failure mode is a human writing PENDENTE in the words they already use, which a new marker does not intercept | low |
| Strong bar — re-run the referenced tests | Catches broken evidence too | Rejected by ADR-010 §Decision 2 and unchanged here: duplicates `hardening`, doubles the tail cost, conflates two failure modes | medium |
| Check the section is non-empty instead of not-pending | Simpler rule | The reported section was 60 lines long and said PENDENTE in every one of them; emptiness was never the signal | low |
| Fix it as a per-project override in the consuming repo | The repo's own `git clone` carries it | The validator imports the kit's `project-root.js` and `parse-criteria.js`, so an "override" would still reach into `$AIDAKIT_GOVERNANCE` — it is not self-contained, and it forks a file every consumer needs fixed | medium |
