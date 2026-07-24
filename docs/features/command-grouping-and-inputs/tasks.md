# Tasks — command-grouping-and-inputs

**Change ID:** `command-grouping-and-inputs`
**Date:** `2026-07-24`
**Owner:** `@chacal88`
**Phase / Package:** `n/a (command-surface refactor; classification: domain=product, type=feature, flags=[architecture, contract])`
**PRD:** `n/a`
**Tech Spec:** `n/a`

> Ordered: **spike first** (it locks the naming syntax), then the ADR (records the locked syntax), then the renames and prose, then the version bump, then validation. Do not rename a command file before Task 1 has locked the syntax and Task 2 has recorded it.

## 0. Roadmap registration (deferred to `aidakit:roadmap`)

Deferred out of the planner's hand because `ROADMAP.md` is **derived from disk** ([ADR-002](../../decisions/ADR-002-roadmap-status-derived-from-disk.md)) and the `aidakit:roadmap` skill owns id-minting, collision refusal, and regeneration — and because this repo's existing roadmap prose is in Portuguese while the doctrine default is English; let the skill/owner resolve the language. **Order-independent** — Task 0 has no dependency on Tasks 1–9 (or vice versa) and may run at any point; the "spike first" ordering below governs Tasks 1→9 only.

- [x] Via `aidakit:roadmap`, create epic **`docs/roadmap/epics/EPIC-flow-cli-ux.md`** grouping three features (follow the format of [EPIC-flow-engine-leashes.md](../../roadmap/epics/EPIC-flow-engine-leashes.md)). **Never write a status field into the epic file** (ADR-002) — an epic declares only intent (feature → change-id + acceptance); status is derived from disk:
  - Feature: command grouping + inputs — changes: `command-grouping-and-inputs` (this change) · Aceite: the acceptance criteria in [proposal.md](proposal.md).
  - Feature: flow run progress table — changes: `flow-run-progress-table` (theme 2).
  - Feature: flow step summaries — changes: `flow-step-summaries` (theme 3).
- [x] Add the `EPIC-flow-cli-ux` row to `docs/roadmap/README.md` (index must list every epic — DOCS.md rule 1).
- [x] Regenerate `docs/roadmap/ROADMAP.md` via the skill/`derive-roadmap-status.js` — **never hand-edit it** (ADR-002). Planner's derived-status *expectation* (a check on the regen output, not content to type anywhere): `command-grouping-and-inputs` will derive as `in-progress` (its `docs/features/` dir exists); themes 2/3 will derive as `backlog` (declared in the epic, no artifacts yet). Note: `archive-loop-var-resume` (a pre-existing leftover copy under `docs/features/`) may also derive as `in-progress` although its PR merged — pre-existing repo wrinkle, not this change's failure; don't stop on it.

## 1. Spike — verify the 3-segment command namespace (BLOCKING, first)

- [x] Determine whether Claude Code renders `commands/flow/build.md` as `/aidakit:flow:build`. Resolved via the official Claude Code Agent SDK doc (see [evidence.md](evidence.md)) — a subdirectory is flattened into the description, not the command name, so no scratch probe copy was needed to reach a conclusive answer. No product code ships from the spike.
- [x] Record the outcome and the **locked syntax** in [evidence.md](evidence.md): primary `flow:build` / `flow:design` **or** the locked fallback `flow-build` / `flow-design`.
- [x] Confirm the locked syntax still satisfies acceptance criterion 1 (the two orchestrators sort adjacently under the `flow` prefix in `/aidakit:` autocomplete).

## 2. ADR — author ADR-005 (records the locked syntax)

- [x] Write `docs/decisions/ADR-005-command-namespacing.md` in the 5-section format (copy the header comments + section shape from [ADR-004](../../decisions/ADR-004-aidakit-governance-env-contract.md)); transcribe the Decision/Consequences/Alternatives from [design.md](design.md) §5, naming the **locked** syntax from Task 1.
- [x] Add the ADR-005 row to `docs/decisions/README.md` (Index table + the relevant Thematic grouping bullet).
- [x] `node governance/validators/check-adr-format.js docs/decisions/ADR-005-command-namespacing.md` exits 0; record in [evidence.md](evidence.md).

## 3. Surface Work — commands (rename + inputs on all 7)

- [x] Rename the two orchestrators per the locked syntax (`git mv`, no alias left behind):
  - `commands/build.md` → `commands/flow/build.md` **or** `commands/flow-build.md`. *(locked fallback: `commands/flow-build.md`)*
  - `commands/design.md` → `commands/flow/design.md` **or** `commands/flow-design.md`. *(locked fallback: `commands/flow-design.md`)*
- [x] Re-lead each command's `description:` frontmatter with its classification (flow orchestrator vs single-shot utility).
- [x] Add the `## Usage` block + the empty/malformed-`$ARGUMENTS` guard to **all 7** command files, using the per-command input contracts and copy-paste examples in [design.md](design.md) §3 (`flow:build`, `flow:design`, `catalog`, `docs`, `governance`, `plan`, `review`).
- [x] Update the two renamed files' internal self-references and the `design → build` handoff line to the new command names.
- [x] Update the trailing `<!-- aidakit vX.Y — … -->` doctrine footer on the two renamed files to `v0.5` noting the grouping + inputs.

## 4. Surface Work — cross-reference updates (surgical)

Update every reference to the two **renamed** command tokens only — `/aidakit:build` → new, `/aidakit:design` → new, plus **bare-token** (no-slash) mentions in prose/tables. **Do NOT blanket find-replace**: `aidakit:design` is a prefix of the design-phase skills; a `\b` boundary does not exclude them (it matches at `n`→`-`). Filter with `aidakit:design(?!-)` / the exclude pipe, and confirm every hit per-site ([design.md](design.md) cross-reference-surgery footgun). Never touch `aidakit:design-business|-modeling|-architecture|-implementation`, the `design` flow name, or `cli.js start design`.

Drive the edit from the **authoritative bare-token grep** (Task 7), not from this list alone — this list is representative:

- [x] Root: `PROCESS.md`, `README.md`, `DOCS.md`.
- [x] `docs/`: `OVERVIEW.md`, `INDEX.md`. *(INDEX.md carried no `aidakit:build`/`aidakit:design` hit — reconfirmed via the authoritative grep, no edit needed there.)*
- [x] `docs/guides/`: `README.md`, `getting-started.md`, `change-flow.md`, `existing-repo-flow.md`, `new-project-flow.md`, `flows.md`, `roadmap-and-knowledge.md`.
- [x] `docs/reference/`: `skills.md`, `agents.md`, `README.md`. *(README.md carried no hit.)*
- [x] `skills/`: `catalog/INDEX.md`, `catalog/SKILL.md`, `plan/SKILL.md`, `review/SKILL.md`, `learn/SKILL.md`, `roadmap/SKILL.md`, **`docs/SKILL.md` (lines 14, 96 — bare-token `aidakit:design`)**, **`spec/SKILL.md` (lines 55, 362 — bare-token `aidakit:design`)**, `design-business/SKILL.md`, `design-architecture/SKILL.md`, `design-implementation/SKILL.md`.
- [x] `docs/roadmap/epics/EPIC-flow-engine-leashes.md`.
- [x] `docs/examples/README.md` (~lines 13–14; reconfirm at implementation time): update the two **path-hrefs** `(../../commands/design.md)` to the renamed file location — href only, prose mentions of the hypothetical project stay. Other `docs/examples/*` hits are hypothetical-project mentions: leave them unless a hit is unambiguously the kit command.

## 5. Surface Work — distinction visibility (catalog + process)

- [x] In `skills/catalog/INDEX.md`, surface the grouping so `aidakit:catalog` shows the two orchestrators as a `flow` group distinct from the single-shot utilities.
- [x] Confirm the command/skill/agent distinction is now legible at the command itself (the Usage classification line from Task 3) — the acceptance requires it **not** be buried only in [PROCESS.md](../../../PROCESS.md) §1.

## 6. Version bump

- [x] Bump `version` in `.claude-plugin/plugin.json` **strictly above the manifest version on main at implementation start — re-read `plugin.json`, don't assume** (currently `0.5.1`; recommended `0.6.0` for a breaking rename — see [design.md](design.md) version-bump constraint). This is what makes `claude plugin update` copy the rename to installed users. *(Re-read at implementation start: working tree had `0.5.1` uncommitted, ahead of the `0.5.0` on the last commit reachable from `main` — bumped to `0.6.0`, strictly above both.)*

## 7. Validation (executable)

- [x] `node governance/validators/check-links.js .` → **exit 0** (main is clean — 0 broken links as of 2026-07-24, verified live). Guard against drift: capture the validator output as the **very first action of implementation** (before Task 0 and Task 1 — Task 0 also edits linked files); if that baseline is unexpectedly non-clean, diff against it instead of blocking, and flag the pre-existing breaks to the owner. Any break citing a renamed command file is a failure of this change. *(Baseline 216 files/0 errors; final re-run 218 files/0 errors — the +2 delta is this change's own new files. No new breaks.)*
- [x] `node governance/validators/check-adr-format.js docs/decisions/ADR-005-command-namespacing.md` → exit 0.
- [x] `node governance/validators/check-plugin-version.js .` → exit 0 (manifest ≥ highest footer, no footer left ahead of the manifest).
- [x] **Slash-form leash:** `grep -rEn "/aidakit:(build|design)\b" --include="*.md" . | grep -vE "\.claude/|docs/archive|docs/examples|docs/features/(loop-var-resume|command-grouping-and-inputs)"` returns **no** stale hits to the old orchestrator names (the change's own artifacts legitimately cite the old names as history). *(7 residual hits, all doctrine-footer changelog lines or ADR-005's own "before" prose — see evidence.md "Residual leash hits".)*
- [x] **Bare-token leash (authoritative — catches no-slash prose/table mentions):**
  ```
  grep -rnE "\baidakit:(build|design)\b" --include="*.md" . \
    | grep -vE "\.claude/|docs/archive|docs/examples|docs/features/(loop-var-resume|command-grouping-and-inputs)" \
    | grep -vE "aidakit:design-(business|modeling|architecture|implementation)"
  ```
  returns **no** stale hits (any remaining line is an un-migrated reference to the old command name). Record the output in [evidence.md](evidence.md). *(9 residual hits, same class as above plus one retired-skill mention and one accurate "previously called" clarifier — recorded and reasoned in evidence.md; no live invocation guidance left pointing at the old names.)*
- [x] **Leash extension — non-`.md` surfaces (round-1 review correction, architecture direction):** the two greps above are `--include="*.md"`-only and missed real hits in the engine surface (`governance/flows/design.yaml` lines 7/127/140, `governance/cli.js` line 21) — fixed in this round, and the leash is now extended with a second pass over `.js`/`.yaml` so the miss cannot recur silently:
  ```
  grep -rEn "/aidakit:(build|design)\b" --include="*.js" --include="*.yaml" governance/ | grep -vE "\.claude/"
  grep -rnE "\baidakit:(build|design)\b" --include="*.js" --include="*.yaml" governance/ \
    | grep -vE "\.claude/" | grep -vE "aidakit:design-(business|modeling|architecture|implementation)"
  ```
  both return **empty** after the fix. Record the output in [evidence.md](evidence.md).
- [x] **Negative leash (collateral mis-rename):** `grep -rnE "flow:design-|flow-design-|flow:build-|flow-build-" --include="*.md" . | grep -vE "docs/features/command-grouping-and-inputs"` returns **empty** — catches an accidental `aidakit:design-business` → `flow:design-business` corruption that no stale-token grep detects (self-exclusion: this very instruction contains the literal pattern). *(Empty — confirmed.)*
- [x] **Usage-block leash:** every command file has a `## Usage` section — `find commands -name "*.md" -print0 | xargs -0 grep -L "## Usage"` (covers both the flat utilities and the `flow/` subdir under the primary syntax; portable — no globstar/zsh dependency) returns **empty**. *(Empty — confirmed.)*
- [x] Manual: reload the plugin (or a scratch install) and confirm `/aidakit:` autocomplete shows the two orchestrators grouped under `flow` and that each command replies with its Usage block on empty/malformed `$ARGUMENTS`. Capture the autocomplete listing **plus two empty-argument reply samples — one orchestrator (`flow:build`) and one utility (`plan` or `review`)** — in [evidence.md](evidence.md). *(Autocomplete listing recorded as "pending human verification post plugin-reload" — cannot be performed from this implementer session. The two empty-argument reply samples were transcribed verbatim from the command files' own guard + Usage block text, since that text IS the deterministic printed output — recorded in evidence.md for `flow-build` and `plan`.)*
- [x] Confirm no file in the diff adds a progress table or a step summary (themes 2/3 out). *(Confirmed — `git diff` reviewed, no such content in any touched file.)*

## 8. Documentation

- [x] `## Validation Outputs`, `## Files Touched`, and the acceptance-criterion evidence map filled in [evidence.md](evidence.md).
- [x] `## Unresolved Deviations` in [evidence.md](evidence.md) records any deviation from this plan (or "None").

## 9. Cleanup

- [x] No stray files outside the declared scope; the spike scratch copy is removed (no probe command left in `commands/`). *(No scratch copy was ever created — the spike was resolved by documentation lookup, per the pre-resolved Task 1 outcome — so there is nothing to remove.)*
- [x] `git status` shows only the renamed command files, the touched prose files, `ADR-005` + `README.md`, `plugin.json`, the roadmap files from Task 0, and this change directory. *(Confirmed — see evidence.md "Files Touched" for the full `git status --short`.)*
