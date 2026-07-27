# Tasks — per-flow-commands

**Change ID:** `per-flow-commands`
**Date:** `2026-07-27`
**Owner:** `@chacal88`
**Phase / Package:** `n/a (command-surface + generator; classification: domain=process, type=feature, flags=[architecture, contract], confirmed)`
**PRD:** `n/a`
**Tech Spec:** `n/a`

> Ordered **TDD (RED → GREEN → REFACTOR)**: the drift/behavior test is written first and fails, the generator + template make it pass, then the committed built-ins are generated and the old surface removed. Each task names the acceptance id(s) from [proposal.md](proposal.md#acceptance-criteria) it advances. Do not `git rm` `flow-build.md` (Task 4) before the generator produces the replacements (Task 3) and the drift test is green (Task 2/3). And because the plugin `version` is baked into the drift-tested bytes (the sentinel `template=` token + the trailing footer, single-sourced from `.claude-plugin/plugin.json` — [design.md §11](design.md)), the built-ins are **regenerated after the Task 6 bump**: the final ordering is **bump → regenerate → Task 8 drift test**.

## 1. Setup

- [ ] Re-read the live [`.claude-plugin/plugin.json`](../../../.claude-plugin/plugin.json) `version` and the highest `aidakit vX.Y` doctrine footer in the tree — the Task 6 bump is relative to these, not to design.md's frozen `0.10.0`.
- [ ] Capture the plan-time baselines into [evidence.md](evidence.md) *before any file changes*: `node governance/validators/check-links.js .`, `node governance/validators/check-plugin-version.js .` (exit + JSON), and `grep -rnE "\baidakit:flow-build\b" --include="*.md" --include="*.yaml" --include="*.js" . | grep -vE "docs/archive|docs/features/per-flow-commands|docs/decisions/ADR-005"` (the pre-change flow-build reference inventory the Task-8 leash will drive to zero — this **includes** the three `governance/flows/design.yaml` functional-handoff hits migrated in Task 5).
- [ ] Confirm reuse targets exist and export what the generator needs: `parseFlowFile` in [`governance/engine/parser.js`](../../../governance/engine/parser.js), `parse` in [`yaml-min.js`](../../../governance/engine/yaml-min.js), and the project-root resolver in [`governance/engine/project-root.js`](../../../governance/engine/project-root.js). Do **not** add a second YAML reader (design.md §2, "cut, don't copy").

## 2. Surface Work — the drift/behavior test (RED first)

Advances: `generator-single-source-of-truth`, `generator-fail-closed-collision`, `generator-consumer-sync-command`, `adr005-conventions-preserved`, `input-key-derived-from-yaml`, `per-flow-start-shortcut`.

- [ ] Write `governance/__tests__/flow-command-generation.test.mjs` (Node table test, no framework — copy the `spawnSync`/`ok(cond,name)` shape from [`plugin-version.test.mjs`](../../../governance/__tests__/plugin-version.test.mjs)), run via `node governance/__tests__/flow-command-generation.test.mjs`. Cases per [design.md §12](design.md):
  - **Byte-drift:** for each of `{fast, full, design}`, the generator's render over `governance/flows/<name>.yaml` equals the committed `commands/flow-<name>.md` byte-for-byte.
  - **Opt-out:** kit mode does not produce `commands/flow-docs-onboarding.md`.
  - **Frontmatter parses + ADR-005 conventions:** each output starts with `---` on **line 1**, has a matching closing `---`, and the classification-led `description:` key sits **inside** that parsed frontmatter block (parse the block and read `description:` from it — **not** a bare `description:` substring match — [design.md §12](design.md); this is the assertion that catches a sentinel-above-frontmatter regression); the generated-file sentinel is the **first line after** the closing `---` (never line 1); a `## Usage` block with ≥1 copy-paste example; and the `: "${AIDAKIT_GOVERNANCE?…}"` guard on every `cli.js` bullet.
  - **Input-key + register:** `flow-design` output carries `project="$ARGUMENTS"`; `flow-fast` carries `request="$ARGUMENTS"` + the `register` block; `flow-full` carries neither `register` nor `project=`.
  - **Implicit-start disambiguation** (`per-flow-start-shortcut`, pins R1 — [design.md §3.4 + §12](design.md)): assert both layers — (1) each `flow-*.md` body contains the flow_id regex literal `^[a-z][a-z0-9-]*-[0-9]{6}-[0-9a-f]{1,6}$`, the `list`-sole-token condition, and (for `flow-fast`) the `register`-first-token condition; (2) a local classifier mirroring §3.4 resolves the seven cases: (a) `resume full-260727-ec4472 success`→resume, (b) `resume the broken thing`→start, (c) `list`→list, (d) `list all invoices`→start, (e) `flow-fast` `register a new provider`→register(request "a new provider"), (f) `status full-260727-ec4472`→status, (g) `status of the migration`→start.
  - **Consumer mode (temp dir):** `.aidakit/flows/foo.yaml` → writes sentinel'd `.claude/commands/flow-foo.md` that starts `foo`; re-run byte-identical; `.aidakit/flows/fast.yaml` → refused with reason, exit≠0, nothing written; a sentinel-less `.claude/commands/flow-bar.md` → preserved untouched.
- [ ] Run the test → it **fails** (module + built-ins absent). Record the RED run in [evidence.md](evidence.md).

## 3. Surface Work — the generator + template (GREEN)

Advances: `generator-single-source-of-truth`, `input-key-derived-from-yaml`, `full-lifecycle-self-contained`, `per-flow-start-shortcut`, `adr005-conventions-preserved`, `generator-fail-closed-collision`, `generator-consumer-sync-command`.

- [ ] Write `governance/commands/render-flow-command.js` — pure `renderFlowCommand(meta) → string`, the ONE template ([design.md §3](design.md)). Invariants: frontmatter first — `---` on line 1, classification-led `description:` inside it, closing `---` — then the generated-file sentinel as the **first body line after the closing `---`** (never line 1; [design.md §3.1](design.md)); `$ARGUMENTS` guard + `## Usage` + copy-paste example; the **verb-specific implicit-start dispatch contract of [design.md §3.4](design.md)** — `resume`/`status`/`abort` only when token 2 is flow_id-shaped (emit the regex `^[a-z][a-z0-9-]*-[0-9]{6}-[0-9a-f]{1,6}$` verbatim, single-sourced from [`persistence.js#newFlowId`](../../../governance/engine/persistence.js)), `list` only as the sole token, `register` (iff `hasRegister`) as first token with the rest as free-form request, else the whole `$ARGUMENTS` is the start payload; the `: "${AIDAKIT_GOVERNANCE?…}"` guard chained ahead of every `cli.js` bullet (ADR-012); trailing `aidakit vX.Y` footer. Lift the wrapper/`register` prose **verbatim** from today's [`flow-build.md`](../../../commands/flow-build.md)/[`flow-design.md`](../../../commands/flow-design.md).
- [ ] Implement `positionalKey` and `hasRegister` derivation from `flow.inputs` ([design.md §5–§6](design.md)) — never a `flowName ===` table. Handle the zero-/multi-required edge cases fail-closed.
- [ ] Write `governance/commands/generate-flow-commands.js` — the generator + thin CLI (validator-style `import.meta.url` guard; exit 0/1/2, JSON stdout, md stderr). Load flows via `parseFlowFile` (reuse). Implement the two `--mode` source/target pairs ([design.md §4](design.md), default `consumer`) and the sentinel/collision/idempotency algorithm ([design.md §7](design.md)).
- [ ] Add the opt-out marker `emit_flow_command: false` to [`governance/flows/docs-onboarding.yaml`](../../../governance/flows/docs-onboarding.yaml) with the single-door comment ([design.md §8](design.md)) — the only *structural* flow-YAML edit in this change (the [`design.yaml`](../../../governance/flows/design.yaml) cross-reference edit in Task 5 is prose-only, §9).
- [ ] Run `node governance/commands/generate-flow-commands.js --mode kit` to produce `commands/flow-fast.md`, `commands/flow-full.md`, `commands/flow-design.md` (committed output); run the drift test → **passes** (at the pre-bump `version` — the generator and the drift test both read `footerVersion` from `.claude-plugin/plugin.json`, so they agree). These built-ins are **regenerated at the FINAL bumped version in Task 6** — the version token is stamped from `plugin.json` ([design.md §11](design.md)). Record the GREEN run in [evidence.md](evidence.md).

## 4. Surface Work — remove `flow-build`, split fast/full, author `flow-sync`

Advances: `flow-name-command-rule`, `full-lifecycle-self-contained`, `generator-consumer-sync-command`.

- [ ] `git rm commands/flow-build.md` — no alias ([design.md §9](design.md)); verify `flow-fast.md` carries the `register` block (fast+full coverage now split) and `flow-full.md` does not.
- [ ] Hand-author `commands/flow-sync.md` — a **single-shot utility** command (classification-led `description:`, `## Usage` + copy-paste example, the `AIDAKIT_GOVERNANCE` guard) that dispatches `node "$AIDAKIT_GOVERNANCE/commands/generate-flow-commands.js" --mode consumer`. It is *not* generated (it wraps no flow — it is the generator's front; ADR-017 §group-membership legitimizes its `flow-` prefix).
- [ ] Confirm `commands/flow-build.md` no longer exists and `commands/{flow-fast,flow-full,flow-design,flow-sync}.md` all exist.

## 5. Surface Work — cross-reference migration (`flow-build` → `flow-fast`/`flow-full`)

Advances: `flow-name-command-rule`.

- [ ] Drive edits from the authoritative bare-token grep (Task 1 baseline), confirmed **per-site**, never a blanket find-replace ([design.md §9](design.md)): `/aidakit:flow-build start fast …` → `/aidakit:flow-fast …`; `start full …` → `/aidakit:flow-full …`; the generic `design → build` handoff (in the generated `flow-design.md` template source, guides, `flows.md`) → `/aidakit:flow-fast` (or `/aidakit:flow-full` for architectural changes).
- [ ] **Migrate `governance/flows/design.yaml`'s 3 live functional handoff fields ([design.md §9](design.md)) → `flow-name-command-rule`.** Repoint the flow `description:` (line 7), the `gate4` `prompt:` (line 127) and the `done` terminal `message:` (line 140), each of which currently tells the operator to run the **removed** `/aidakit:flow-build`, to **"Run `/aidakit:flow-full` (or `/aidakit:flow-fast`) to build the first change."** Prose-only: do **not** alter the `steps:`/gate options/step semantics. After this edit, no `/aidakit:flow-build` remains in `governance/flows/design.yaml` (the leash's only `.yaml` hits today).
- [ ] Repoint the guides/skills/reference prose that names `/aidakit:flow-build` (e.g. `docs/guides/*`, `skills/*`, `docs/reference/*`, `README.md`, `PROCESS.md`, `docs/OVERVIEW.md`, `docs/roadmap/epics/*`) — reconcile against the grep, not this list alone. **Two are markdown links** to the about-to-be-deleted file and MUST be repointed or `check-links.js` breaks: `skills/learn/SKILL.md:100` (`[/aidakit:flow-build](../../commands/flow-build.md)`) and `docs/reference/skills.md:175` (`[commands/flow-build.md](../../commands/flow-build.md)`) → the split commands.
- [ ] **Update `governance/__tests__/agent-validator-paths.test.mjs` `SOURCE_FILES` ([design.md §9](design.md)) → `flow-name-command-rule`.** Replace the removed `"commands/flow-build.md"` (line 51) with `"commands/flow-fast.md"` and `"commands/flow-full.md"` (both carry the ADR-012 guard on every `cli.js` bullet); this keeps the full `governance/__tests__/*.mjs` suite green (Task 8) once `flow-build.md` is `git rm`'d. Not caught by the `aidakit:flow-build` leash (it is a file-path token), so migrated by hand here.
- [ ] **Leave WORM records byte-identical:** `docs/decisions/ADR-005-command-namespacing.md` (line 21, the locked-name record ADR-017 supersedes) and `docs/decisions/ADR-012-*.md` (the historical guard-site inventory citing `commands/flow-build.md`) are **not** edited — they legitimately record the superseded name/path as history (design.md §9). The Task-8 leash excludes ADR-005 for exactly this reason.

## 6. Version bump

Advances: `plugin-version-bumped`.

- [ ] Bump `version` in [`.claude-plugin/plugin.json`](../../../.claude-plugin/plugin.json) **strictly above the live manifest on `main` at implementation start** (re-read; recommend a minor bump for a breaking rename + new surface — [design.md §11](design.md)).
- [ ] **Regenerate the built-ins AFTER the bump** — re-run `node governance/commands/generate-flow-commands.js --mode kit` so `commands/flow-{fast,full,design}.md` carry the **final** bumped `vX.Y` in **both** the sentinel `template=` token ([design.md §3.1](design.md)) and the trailing `aidakit vX.Y` footer ([§3.6](design.md)) — both read from `plugin.json` `version`, the single source ([design.md §11](design.md)). Dependency order is unambiguous: **bump (previous bullet) → regenerate (this bullet) → the Task 8 byte-drift test**. Skipping the regenerate leaves the committed built-ins at the pre-bump version, so Task 8's drift test (which re-renders at the bumped `version`) fails. Verify `plugin.json version ≥` highest footer `X.Y`.

## 7. Documentation — ADR-017 + index

Advances: `adr017-extends-flow-group`.

- [ ] Author `docs/decisions/ADR-017-flow-command-generation.md` in the 5-section format ([design.md §10](design.md) skeleton) — Status `accepted`; record (a) group-membership widened to "flow mechanism family" (so `flow-sync` wears the prefix) and (b) naming shift activity-based → flow-name-based; both **supersede ADR-005** on those points; include the `flow-build` migration note. **Do NOT edit `ADR-005-command-namespacing.md`** (WORM).
- [ ] Add the ADR-017 row to [`docs/decisions/README.md`](../../decisions/README.md) (Index table + the "Command surface" thematic grouping bullet) and annotate the ADR-005 grouping/index note as "(partially superseded by ADR-017)" — an *index* edit only, ADR-005 the file stays byte-identical.

## 8. Validation (executable)

- [ ] `node governance/__tests__/flow-command-generation.test.mjs` → **exit 0** (drift + all behavior cases). **Run this AFTER Task 6's bump + regenerate**, so the committed built-ins carry the final `vX.Y` the drift test re-renders (ordering: bump → regenerate → this test). Record output in [evidence.md](evidence.md). → `generator-single-source-of-truth`, `generator-consumer-sync-command`, `generator-fail-closed-collision`, `input-key-derived-from-yaml`, `adr005-conventions-preserved`.
- [ ] `node governance/__tests__/engine.test.mjs` (and the full `governance/__tests__/*.mjs` suite) → green — the opt-out marker and reuse of `parseFlowFile` did not regress flow loading.
- [ ] `node governance/validators/check-adr-format.js docs/decisions/ADR-017-flow-command-generation.md` → **exit 0**. → `adr017-extends-flow-group`.
- [ ] `node governance/validators/check-links.js .` → **exit 0** (baseline captured Task 1; the +N delta is this change's own files; any break citing a repointed command is a failure). → cross-reference integrity.
- [ ] `node governance/validators/check-plugin-version.js .` → **exit 0** (manifest ≥ highest footer). → `plugin-version-bumped`.
- [ ] `node governance/validators/check-runtime-bump.js . --base origin/main` → **exit 0** (the generator under `governance/` changed and the manifest rose in the same range). → `plugin-version-bumped`.
- [ ] **flow-build leash (must return ZERO):** `grep -rnE "\baidakit:flow-build\b" --include="*.md" --include="*.yaml" --include="*.js" . | grep -vE "docs/archive|docs/features/per-flow-commands|docs/decisions/ADR-005"` returns **zero** hits. The three exclusions are all legitimate history: this change's own artifacts, the `docs/archive` case law, and the WORM `ADR-005` record (the locked-name record that ADR-017 supersedes — not edited). Every hit outside those — all guides/skills/reference prose **and** the three `governance/flows/design.yaml` fields (Task 5) — must be migrated; the removed `commands/flow-build.md` contributes no hit once `git rm`'d (Task 4). Any residual line is an un-migrated reference and fails the leash. Record the pre-change count (Task 1 baseline) and the post-change zero in [evidence.md](evidence.md). → `flow-name-command-rule`.
- [ ] **Absence leash:** `test ! -e commands/flow-build.md` succeeds; `ls commands/flow-{fast,full,design,sync}.md` all present. → `flow-name-command-rule`, `full-lifecycle-self-contained`.
- [ ] **Frontmatter + sentinel leash:** each of `commands/flow-{fast,full,design}.md` has `---` on line 1 (valid slash-command frontmatter) and `<!-- aidakit:generated ` as the **first line after** the frontmatter's closing `---` (in the header region, never line 1); `commands/flow-sync.md` (hand-authored) has **no** generated-sentinel in its header region. → `generator-fail-closed-collision`.
- [ ] **Usage-block leash:** `find commands -name "flow-*.md" -print0 | xargs -0 grep -L "## Usage"` returns **empty**. → `adr005-conventions-preserved`.
- [ ] **Manual (post plugin-reload, human):** `/aidakit:flow-fast <one-line request>` yields a flow paused at its first step (no `start`/`fast`/`request=` typed); `/aidakit:flow-design <text>` passes `project=<text>`. Capture the observed pause (or transcribe the deterministic dispatch the command prints) in [evidence.md](evidence.md). → `per-flow-start-shortcut`, `input-key-derived-from-yaml`.

## 9. Documentation — evidence

- [ ] Fill [evidence.md](evidence.md): `## Validation Outputs` (one entry per Exit criterion, command + output + exit code), the per-criterion evidence map (the 10 acceptance ids → the case/command that proves each), `## Files Touched` (`git status --short`), and `## Unresolved Deviations` (or "None").

## 10. Cleanup

- [ ] No stray files outside the declared scope; `git status` shows only: `governance/commands/{render-flow-command,generate-flow-commands}.js`, `governance/__tests__/flow-command-generation.test.mjs`, `governance/flows/docs-onboarding.yaml` (marker), the removed `commands/flow-build.md`, `commands/flow-{fast,full,design,sync}.md`, `docs/decisions/ADR-017-*.md` + `README.md`, `.claude-plugin/plugin.json`, the repointed prose, and this change directory.
- [ ] Confirm no `SessionStart`/other hook was added or changed (brainstorm `on-demand-not-hook`): `git diff --stat` shows nothing under `hooks/`.
