# Design — per-flow-commands

**Change ID:** `per-flow-commands`
**Date:** `2026-07-27`
**Owner:** `@chacal88`
**Phase / Package:** `n/a (command-surface + generator; classification: domain=process, type=feature, flags=[architecture, contract], confirmed)`
**PRD:** `n/a`
**Tech Spec:** `n/a`

> Scope is the `/aidakit:*` **command surface** (`commands/*.md`) plus a new **generator** that produces it, shipped as runtime under `governance/`. The engine (`governance/engine/*`) and every flow's `steps:` graph are untouched; the only *structural* flow-YAML edit is a one-line opt-out marker on [`docs-onboarding.yaml`](../../../governance/flows/docs-onboarding.yaml) — [`design.yaml`](../../../governance/flows/design.yaml) additionally gets a prose-only 3-field cross-reference edit (§9), which changes no step behavior. This change extends [ADR-005](../../decisions/ADR-005-command-namespacing.md) on two points, recorded in the new WORM **[ADR-017](#10-adr-017--the-recorded-contract-change-required-deliverable)** (§10). Precedence: if this file diverges from ADR-005/ADR-017, the ADR wins and this file is corrected.

## 1. Shape of the change

| Before | After |
|---|---|
| `commands/flow-build.md` — drives `fast` *and* `full` (`start fast …` / `start full …`), carries `register` | **removed** |
| `commands/flow-design.md` — hand-authored | **generated** from `governance/flows/design.yaml` |
| — | `commands/flow-fast.md` — generated from `fast.yaml`, carries `register` |
| — | `commands/flow-full.md` — generated from `full.yaml` |
| — | `commands/flow-sync.md` — hand-authored single-shot utility (drives the generator in consumer mode) |
| — | `governance/commands/render-flow-command.js` — the ONE template (pure) |
| — | `governance/commands/generate-flow-commands.js` — the generator + thin CLI (IO, modes, sentinel/collision) |
| — | `governance/__tests__/flow-command-generation.test.mjs` — the byte-drift + behavior test |
| — | `docs/decisions/ADR-017-flow-command-generation.md` + README index row |

The three generated built-ins (`flow-fast`, `flow-full`, `flow-design`) are the committed output of running the generator in **kit-dev mode** over `governance/flows/*.yaml`. `flow-sync` is *not* generated (it does not wrap a flow — it *is* the generator's consumer front, so it is authored by hand and classified as a single-shot utility per ADR-005's mechanical rule).

## 2. Generator: module layout (pure template vs IO orchestration)

Two runtime modules under `governance/commands/`, split so the template is trivially unit-testable and reused by the drift test without touching the filesystem:

- **`governance/commands/render-flow-command.js`** — pure, no IO. Exports `renderFlowCommand(meta) → string`, where `meta = { flowName, description, inputs, positionalKey, hasRegister, sentinelSource, footerVersion }` (`footerVersion` originates from `.claude-plugin/plugin.json` `version`, §11 — the single source shared with the drift test, so the two can never disagree about the version token). This is **the ONE template** (§3). Given the same `meta`, it returns byte-identical output — the property the drift test rests on.
- **`governance/commands/generate-flow-commands.js`** — the generator: resolves the source/target pair from `--mode` (§4), loads each flow YAML, derives `meta`, calls `renderFlowCommand`, and performs the sentinel/collision/idempotency write algorithm (§7). Thin CLI at the bottom guarded by `if (import.meta.url === pathToFileURL(process.argv[1]).href)`, same shape as the validators in `governance/validators/`. Contract mirrors the validators: exit 0 (all flows written/unchanged), exit 1 (one or more refusals — collision or sentinel-less target), exit 2 (usage/IO error); JSON summary on stdout, human report on stderr.

**Reuse, don't re-parse (ADR-016 "cut, don't copy" discipline).** The generator loads each flow through the engine's existing [`parseFlowFile`](../../../governance/engine/parser.js) (which itself uses [`yaml-min.js`](../../../governance/engine/yaml-min.js)) rather than growing a second YAML reader. `parseFlowFile` validates flow shape *and* enforces `flow.flow === basename` — the identity the collision check keys on — and returns the whole parsed object, so `flow.flow`, `flow.description`, and `flow.inputs` are read straight off it. A malformed consumer flow is therefore refused with the engine's own error, not silently mis-rendered. (`validateFlowShape` does not police `inputs:`, so the generator reads `flow.inputs` defensively — see §5.)

## 3. The ONE template (`renderFlowCommand`) — ADR-005 conventions preserved

Every generated `flow-<name>.md` has this fixed structure. The literal wrapper prose is lifted from today's [`flow-build.md`](../../../commands/flow-build.md)/[`flow-design.md`](../../../commands/flow-design.md) so no behavior is lost; only the flow-specific tokens are interpolated from `meta`. Each of the following is a template invariant the drift test and the `adr005-conventions-preserved` criterion assert:

1. **Top-of-file layout — frontmatter first (line 1), sentinel after.** The file opens with valid slash-command frontmatter: `---` on **line 1**, a classification-led `description:` key (item 2), then a closing `---` — exactly like every existing `commands/*.md` and `agents/*.md` (all 7 shipped commands and all 17 agents lead with `---` on line 1; there is **zero** in-repo precedent for a comment before the delimiter). Standard slash-command frontmatter parsing requires `---` on line 1: a comment above it would make `description:` parse as body and silently drop the command's classification-led description from the `/aidakit:` surface. The generated-file **sentinel is the FIRST line of the command body, immediately after the closing `---` (never line 1)** — `<!-- aidakit:generated flow=<flowName> template=<footerVersion> source=<sentinelSource> -->` (`footerVersion` read from `.claude-plugin/plugin.json` `version`, the single source — §11). Machine-detectable; the write algorithm (§7) scans the **header region** (the frontmatter block + this sentinel line) for the literal prefix `<!-- aidakit:generated `. Concrete top-of-file layout:

   ```md
   ---
   description: Flow orchestrator — drives the <flowName> flow via the aidakit engine …
   ---
   <!-- aidakit:generated flow=<flowName> template=<footerVersion> source=<sentinelSource> -->
   <body…>
   ```
2. **`description:` frontmatter carrying the classification word** — `Flow orchestrator — drives the <flowName> flow via the aidakit engine …` (ADR-005: the classification survives even where the prefix is not visible). Sourced from the flow's own `description:` first line, prefixed with the classification, and living **inside** the line-1 frontmatter block (§3.1) so it parses as the command's `description:` (not as body).
3. **The `$ARGUMENTS` guard + `## Usage` block** — printed verbatim on empty/malformed input, with **at least one copy-paste example** (`/aidakit:flow-<name> <realistic request>` and one lifecycle example). Reserved verbs listed: `resume`, `status`, `abort`, `list` (+ `register` iff `hasRegister`).
4. **Implicit-start dispatch contract (§3.4 — verb-specific, fail-safe toward _start_).** The body encodes a precise first-token dispatch so a genuine build request is never silently swallowed by a lifecycle verb (this is the concrete mitigation of R1, §13). `$ARGUMENTS` is classified in this order:
   - **`resume` / `status` / `abort`** — recognized **only** when the FIRST token is exactly that verb **and** the SECOND token is _flow_id-shaped_. _flow_id-shaped_ is defined concretely from [`newFlowId`](../../../governance/engine/persistence.js) (`governance/engine/persistence.js` — the single source of the shape): format `<name>-<YYMMDD>-<hex>`, i.e. it matches the regex `^[a-z][a-z0-9-]*-[0-9]{6}-[0-9a-f]{1,6}$` (a trailing `-<6 digits>-<1..6 hex>`, e.g. `full-260727-ec4472`). If the second token is absent or not flow_id-shaped, the whole `$ARGUMENTS` is a start payload.
   - **`list`** — recognized **only** when `$ARGUMENTS` is exactly the sole token `list` (no trailing words).
   - **`register`** (emitted **iff** `hasRegister`, i.e. `flow-fast` only, §6) — recognized when the FIRST token is exactly `register`; the REST of `$ARGUMENTS` is the request payload (register takes free-form text, **not** a flow_id) and dispatches `start fast request="<rest>" mode=register`.
   - **Otherwise** — the ENTIRE `$ARGUMENTS` is the start payload, passed as `start <flowName> <positionalKey>="$ARGUMENTS"`. This is the **implicit/default verb** (`per-flow-start-shortcut`), preserving the full lifecycle (`full-lifecycle-self-contained`).

   Worked cases (pinned as tests in §12): `resume full-260727-ec4472 success` → **resume**; `resume the broken thing` → **start** (2nd token not flow_id-shaped); `list` → **list**; `list all outstanding invoices` → **start** (payload `"list all outstanding invoices"`, because `list` is not the sole token); `status full-260727-ec4472` → **status**; `status of the migration` → **start**; on `flow-fast`, `register a new payment provider` → **register** mode with request `"a new payment provider"` (the intended register path). **Accepted edge:** a genuine build request whose intent literally begins with the word `register` cannot be started through the `flow-fast` implicit-start shortcut (it is read as the register verb) — the operator uses explicit phrasing or the register block deliberately; a documented, acceptable edge, and only `flow-fast` carries `register` (so `flow-full`/`flow-design` are unaffected). The flow_id regex is single-sourced from `persistence.js#newFlowId` and is emitted verbatim into every generated command, so a weakening of the rule trips the byte-drift test (§12).
5. **Fail-closed `AIDAKIT_GOVERNANCE` guard chained ahead of every `cli.js` call** — `: "${AIDAKIT_GOVERNANCE?agent-validator-paths: AIDAKIT_GOVERNANCE not set — SessionStart hook missing (see docs/guides/flows.md §6)}"; node "$AIDAKIT_GOVERNANCE/cli.js" …` on every bullet, per the round-2 agent-validator-paths doctrine already in the built-ins ([ADR-012](../../decisions/ADR-012-aidakit-governance-session-wide.md)).
6. **Trailing doctrine footer** — `<!-- aidakit v<footerVersion> — flow-<name>: generated per-flow command … -->` (`footerVersion` read from `.claude-plugin/plugin.json` `version`, the single source shared with the drift test — §11; the versioned-surface footer `check-plugin-version.js` scans).

The template is a single function producing deterministic text — no per-flow special-casing lives in `generate-flow-commands.js`; the only two flow-shaped switches are `positionalKey` (§5) and `hasRegister` (§6), both *derived from the YAML*, never hardcoded to a flow name.

## 4. The two source/target modes

One template, two `--mode` values (explicit flag; fail-closed default is `consumer`, the installed-user case):

| Mode | Source | Target | Reserved-collision set | Emits built-ins? |
|---|---|---|---|---|
| `kit` | `governance/flows/*.yaml` | `commands/flow-<name>.md` (committed) | — (it *is* the built-in producer) | yes, minus opt-outs (§8) |
| `consumer` | `<root>/.aidakit/flows/*.yaml` | `<root>/.claude/commands/flow-<name>.md` | `{fast, full, design}` | **never** — those ship with the plugin |

- **`kit` mode** produces the committed surface and is what the drift test re-runs. It emits a command for every source flow that does *not* carry the opt-out marker (§8) → exactly `{fast, full, design}`.
- **`consumer` mode** is what `/aidakit:flow-sync` invokes. It writes to `.claude/commands/` (project-local, git-ignorable), never re-emits the plugin built-ins, and refuses a project flow whose `flow.flow` ∈ `{fast, full, design}` (§7) so a consumer cannot shadow a shipped command.
- `<root>` is resolved the same way the engine resolves it ([`governance/engine/project-root.js`](../../../governance/engine/project-root.js) / `AIDAKIT_PROJECT_ROOT`), reused not re-implemented.

## 5. Input-key derivation from `inputs:` (`input-key-derived-from-yaml`)

Each flow declares a top-level `inputs:` list of `{ name, type, required, default, values, description }`. The positional key the bare `$ARGUMENTS` maps to is:

```
positionalKey = (flow.inputs ?? []).find(i => i.required === true)?.name
```

- `fast.yaml`/`full.yaml` → first required input is `request` → `start <flow> request="$ARGUMENTS"`.
- `design.yaml` → first required input is `project` → `start design project="$ARGUMENTS"`.

Edge cases the generator handles fail-closed (they don't occur in the three built-ins but a consumer flow can hit them):

- **No required input** → `positionalKey` is undefined; the template emits a start form with no positional payload (`start <flow>`) and the Usage block states the flow takes no free-form request. Not a refusal — a legal flow.
- **Multiple required inputs** → the **first** required input becomes the positional key; the Usage block documents the remaining required inputs as explicit `key=value` tokens. (A generator that guessed how to split one free-form string across several keys would be inventing data — rejected.)

The key is **always** read from the YAML; there is no lookup table mapping `fast → request`. This is the `input-key-derived-from-yaml` invariant.

## 6. Where `register` lands (data-driven, not hardcoded to "fast")

`register` is fast's `mode=register` ([`fast.yaml`](../../../governance/flows/fast.yaml): `inputs.mode` is an `enum` with `values: [build, register]`). The template emits the `register` verb block **iff** the flow declares an input whose `values` list contains `register`:

```
hasRegister = (flow.inputs ?? []).some(i => Array.isArray(i.values) && i.values.includes("register"))
```

- `fast.yaml` → `hasRegister = true` → the `register "<free-form request>"` block (the four-step defer-a-debit prose + the parked-flow resume/discard lines) is emitted **verbatim from today's `flow-build.md`**, dispatching `start fast request=<change-id> mode=register`.
- `full.yaml`, `design.yaml`, and any generated project flow without such an input → `hasRegister = false` → no register block.

This keeps `register` on `flow-fast` only, driven by the YAML's own declaration rather than a `flowName === "fast"` special case — so a consumer flow that legitimately declares a `register` mode gets the verb too, and the built-ins that don't, don't.

## 7. Sentinel + collision + idempotency algorithm

For each source flow, the generator runs this per-file algorithm (fail-closed; a refusal on one flow does not abort the others, but any refusal makes the overall exit non-zero and is reported):

```
loadResult = parseFlowFile(sourcePath)
if loadResult.errors:                          → REFUSE(flow, "invalid flow YAML: <errors>")   # engine's own validation
name = loadResult.flow.flow
if mode == consumer and name ∈ {fast,full,design}:
                                               → REFUSE(name, "collides with a shipped built-in command; rename the project flow")
if flow carries opt-out marker (§8):           → SKIP(name, "emit_flow_command:false")          # kit mode only, not a refusal
target = <targetDir>/flow-<name>.md
rendered = renderFlowCommand(metaFrom(loadResult.flow))
if exists(target):
    header = readFirstLines(target, 6)             # header region: frontmatter block (≤5 lines) + the sentinel line after it
    if not header.any(line => line.startsWith("<!-- aidakit:generated ")):
                                               → REFUSE(target, "hand-authored (no sentinel in header region) — left untouched")
    if readFile(target) == rendered:           → REPORT(name, "unchanged")                      # idempotent no-op
    else:                                       write(target, rendered); REPORT(name, "updated")
else:                                           write(target, rendered); REPORT(name, "created")
```

- **Sentinel** — the literal `<!-- aidakit:generated flow=<name> … -->` on the **first body line, immediately after the frontmatter's closing `---`** (never line 1, which is the `---` delimiter; §3.1). The write algorithm scans the **header region** — the first 6 lines (the frontmatter block, ≤5 lines, plus the sentinel line) — and treats the target as generated iff **any** header line starts with the literal prefix `<!-- aidakit:generated `. Presence authorizes overwrite; absence anywhere in that region protects a hand-authored `flow-*.md` (`generator-fail-closed-collision`).
- **Collision** — in consumer mode a project flow named `fast`/`full`/`design` is refused with a reason (it would otherwise shadow a built-in the plugin ships). Kit mode has no collision set (it is the built-in producer).
- **Idempotency** (`generator-consumer-sync-command`) — `renderFlowCommand` is a pure function of the flow metadata + template version, so a no-change re-run renders byte-identical text; the algorithm compares bytes and reports `unchanged` (no write, no mtime/git churn). Byte-for-byte reproducibility is exactly what the drift test asserts against the committed built-ins.

## 8. `docs-onboarding` resolution — the AMBIGUOUS assumption (default (b))

The brainstorm's `docs-onboarding-scope` assumption is `AMBIGUOUS`: `governance/flows/` holds **four** YAMLs, but `docs-onboarding` is served today by the `aidakit:docs` single-shot utility skill invoked directly — **not** through the engine ([ADR-005](../../decisions/ADR-005-command-namespacing.md) §Decision classifies `docs` a utility precisely because `commands/docs.md` invokes the skill rather than driving `docs-onboarding.yaml` via `cli.js`). Option (a) would emit a `flow-docs-onboarding` command, opening a **second, engine-driven door** alongside the `docs` utility. Option (b) excludes it via a per-flow opt-out marker so `aidakit:docs` stays the single door and this change's blast radius is the three build/design flows.

**Resolved: (b).** What settled it — the owner's locked decision at the brainstorm gate (recorded in `.aidakit/tasks/per-flow-commands/brainstorm.json`, assumption `docs-onboarding-scope`, "default (b)") **plus** the ADR-005 consistency argument: ADR-005 already made `docs` the single onboarding door as a utility; auto-emitting `flow-docs-onboarding` would create a competing entry point the owner has not sanctioned and would contradict the "single door" intent. Emitting it is therefore an opt-in the owner must make deliberately, not a generator default.

**Mechanism — the opt-out marker.** Add a top-level field to `governance/flows/docs-onboarding.yaml`:

```yaml
emit_flow_command: false   # aidakit:docs is the single door for onboarding (ADR-005); no generated shortcut.
```

`validateFlowShape` ignores unknown top-level fields (it validates only `flow`/`description`/`steps`), so the marker is inert to the engine and requires no parser change. The generator's kit-mode loop emits a command for every source flow **unless** `flow.emit_flow_command === false`. This yields `{fast, full, design}` today and is future-proof: a fifth built-in flow gets a command automatically unless it opts out.

**Documented asymmetry (surfaced as a risk, §13):** `docs-onboarding` remains a real engine flow — `cli.js start docs-onboarding …` still works and `flow list` still shows it — yet ships **no** shortcut command. The opt-out marker records *why* (single-door decision) at the flow file itself.

## 9. `flow-build` removal + fast/full split + cross-reference migration

`commands/flow-build.md` is `git rm`'d — no alias (ADR-005's rejected-alias stance; the direct break is recorded in ADR-017's migration note). Its content splits by concern:

- The `start fast …` path + the entire `register`/`resume … plan|discard` prose → **`flow-fast.md`** (generated; `register` block emitted because `fast.yaml` declares the `register` mode, §6).
- The `start full …` path → **`flow-full.md`** (generated; no `register`).

**Cross-reference migration** (surgical, like [command-grouping-and-inputs](../../archive/2026-07-24-command-grouping-and-inputs/design.md) §"Cross-reference surgery"): every `/aidakit:flow-build` and bare `aidakit:flow-build` mention is repointed:

- `/aidakit:flow-build start fast …` → `/aidakit:flow-fast …` (start now implicit).
- `/aidakit:flow-build start full …` → `/aidakit:flow-full …`.
- The generic `design → build` handoff line in `flow-design.md` and the guides ("run `/aidakit:flow-build`") → **`/aidakit:flow-fast` (or `/aidakit:flow-full` for architectural changes)** — design produces a change backlog that can be built either way; the handoff names both rather than silently picking one.
- **`governance/flows/design.yaml` — a _live functional_ (engine-printed) handoff, 3 fields, NOT mere prose.** Because `flow-build` is removed by this change, the design flow currently instructs the operator to run a **deleted command** — a functional regression, not just a stale doc. Repoint all three fields verbatim in the flow YAML: the flow-level `description:` (line 7, "…the vertical changes are ready for /aidakit:flow-build."), the `gate4` human-gate `prompt:` (line 127, "…the first change is ready\n      for /aidakit:flow-build."), and the `done` terminal `message:` (line 140, "Run /aidakit:flow-build to build the first change.") → the new handoff wording **"Run `/aidakit:flow-full` (or `/aidakit:flow-fast`) to build the first change."** (full-first because the design flow's output is architectural, but naming **both** shortcuts — faithful to `flow-build` having served `fast` *and* `full`). This touches only prose fields; the `steps:` graph, gate options and step semantics are untouched — a cross-reference migration, not a behavior change to the design flow. (This is the **only** flow-YAML prose edit; the opt-out marker on `docs-onboarding.yaml`, §8, is the only structural flow-YAML edit.)
- **`governance/__tests__/agent-validator-paths.test.mjs` `SOURCE_FILES` (product-code path ref).** That test reads each listed command file to assert the ADR-012 `AIDAKIT_GOVERNANCE` guard; line 51 lists the removed `commands/flow-build.md`. Swap it for the generated `commands/flow-fast.md` and `commands/flow-full.md` (both carry the guard on every `cli.js` bullet, §3.5) so the full suite (tasks.md §8) stays green after removal. This is not caught by the `aidakit:flow-build` leash (it is a file-path token, not an `aidakit:`-prefixed invocation), so it is enumerated here explicitly.

The authoritative enumeration is a bare-token grep, confirmed per-site (never a blanket find-replace): `grep -rnE "\baidakit:flow-build\b" --include="*.md" --include="*.yaml" --include="*.js" .` minus this change's own artifacts, `docs/archive`, **and `docs/decisions/ADR-005`**. The last two are legitimate WORM/history that cite the superseded name on purpose (the archive is case law; ADR-005 records the name it *locked* and is superseded — not edited — by ADR-017), exactly parallel to why the archive is excluded. Two of the live hits are markdown **links** to the about-to-be-deleted file (`skills/learn/SKILL.md`, `docs/reference/skills.md`) — repointed so `check-links.js` stays green. Every other hit is a live invocation and migrates. The Task-list validation section (tasks.md §Validation) turns this into a leash whose post-fix result is **zero**.

## 10. ADR-017 — the recorded contract change (REQUIRED DELIVERABLE)

**`docs/decisions/ADR-017-flow-command-generation.md`** is a mandatory deliverable of this change (the `document`/`doc-planner` step will formally require it; the body may be authored at implement time). WORM: **ADR-005 is not edited** — ADR-017 supersedes it on the two named points, and `docs/decisions/README.md` records the supersession (index row + a "(§ mechanical rule / naming partially superseded by ADR-017)" note; editing the *index* is allowed — it points and is corrected — while the ADR-005 *file* stays byte-identical). 5-section format (per [ADR-016](../../decisions/ADR-016-runtime-change-requires-plugin-bump.md) shape); Status: `accepted`. Skeleton ready to transcribe:

- **Context** — ADR-005 locked the `flow-` prefix with two derived rules that this change outgrows: (1) group membership = "the command drives the engine (`cli.js start <flow>`)"; (2) the command name derived from the *activity* (`flow-build`), not the flow name. A generator that renders one command per flow YAML, plus a `flow-sync` utility that *is* the generator's front (and does **not** itself drive the engine), needs both rules widened.
- **Decision** — (a) **group-membership widened**: a command belongs to the `flow-` group iff it belongs to the **flow mechanism family** — the orchestrator shortcuts (`flow-fast`/`flow-full`/`flow-design`) *and* the flow-command generator's front (`flow-sync`) — so `/aidakit:flow-sync` legitimately wears the prefix though it generates rather than drives. (b) **naming shifts activity-based → flow-name-based**: exactly one `flow-<yamlFlowName>` command per non-opted-out flow YAML; `flow-build` is removed, its fast+full coverage split across `flow-fast`/`flow-full`, `flow-design` survives (its name already equals the flow name). Both points **supersede ADR-005** on those specifics; the mechanical-grouping *spirit* and the flat `flow-` syntax are unchanged.
- **Consequences** — Positive: the surface lines up 1:1 with the flow YAMLs; consumer flows get commands via `flow-sync` with no hand-authoring (ADR-005's extensibility contract finally has a mechanism); a generator + drift test keeps the built-ins honest. Negative *(Accepted)*: `flow-build` is a **breaking rename** for any consumer bound to that name (psim-kernel) — mitigated by the migration note (re-sync + `flow-sync`); mirrors ADR-005's own accepted direct-break. Negative *(Accepted)*: `docs-onboarding` is a real flow with no shortcut command (opt-out, §8) — a documented asymmetry, the price of keeping `docs` the single door.
- **Alternatives considered** — generic orchestrator command (rejected: owner topology decision, brainstorm Q3); bridge alias for `flow-build` (rejected: doubles the clutter ADR-005 removed); static hand-authored per-flow commands (rejected: no single source of truth, drifts from the YAML); emit `flow-docs-onboarding` too (rejected: second door, §8).
- **Migration note** — consumers pinned to `/aidakit:flow-build`: after the next plugin sync it no longer resolves; use `/aidakit:flow-fast` (fast, + `register`) or `/aidakit:flow-full` (full). Recorded here, not hidden — same posture as ADR-005's negative-consequences note.

## 11. Version bump + the two CI validators (`plugin-version-bumped`)

`.claude-plugin/plugin.json` is at `0.10.0` at plan time — **re-read at implementation start; the bump is relative to the live manifest on `main`, not this frozen number.** Two independent CI leashes bind — both must pass (they are distinct: `check-runtime-bump` fires on a runtime path change, `check-plugin-version` fires on any footer outranking the manifest):

- **`check-runtime-bump`** ([ADR-016](../../decisions/ADR-016-runtime-change-requires-plugin-bump.md)) fires because the change touches runtime under `governance/` — the generator **and** the `governance/flows/*.yaml` edits (the `docs-onboarding.yaml` opt-out marker, §8, and the `design.yaml` handoff repointing, §9; both are `.yaml`, both under the runtime prefix). `RUNTIME_PREFIXES = ["hooks/","governance/"]`, excluding `__tests__/` and `*.md`. It requires `plugin.json` `version` to rise **in the same PR range**. The drift test under `governance/__tests__/` is excluded (test segment); the committed `commands/*.md` are **not** under a runtime prefix — per `check-runtime-bump.js`, `commands/*.md` are **not** runtime (the real runtime triggers are the generator under `governance/` and the `governance/flows/*.yaml` edits), so the command files do not themselves trip this leash — they reach installed users purely via the manifest bump that `claude plugin update` reads.
- **`check-plugin-version`** requires the manifest to be **≥ the highest doctrine footer** in the tree. The regenerated command files each carry a fresh `<!-- aidakit vX.Y — … -->` footer (template invariant §3.6); the bump must be ≥ that footer's `X.Y`.

Recommendation: a **minor** bump (a breaking command rename + new generator surface) and give the generated command footers the matching `vX.Y`. The ship step picks the final number — it must be **strictly greater than the manifest on `main` at that moment**, or `claude plugin update` no-ops and the new surface reaches no one. Run `node governance/validators/check-plugin-version.js .` locally before the PR (the local suite does not run the CI `version-leashes`).

**`footerVersion` is a single source, read from `.claude-plugin/plugin.json` `version`.** Both the generator (which stamps it into the sentinel `template=` token — §3.1 — and the trailing `aidakit vX.Y` footer — §3.6) and the drift test (§12) read `footerVersion` from that one field, never a hardcoded literal, so the drift-tested bytes and the committed bytes can never disagree about the version token. This forces a **sequencing rule**: because the version is baked into the drift-tested output, the built-ins are **(re)generated AFTER the version bump** — the ship order is **bump `plugin.json` → re-run the kit-mode generator → run the byte-drift test** (tasks.md Task 6 → regenerate → Task 8). Regenerating *before* the bump would bake the stale version into the committed files, and Task 8's byte-drift test would then fail because the drift test re-renders at the now-bumped `version`. (Task 3's earlier generation + drift run is at the pre-bump `version` — consistent, since both the committed files and the test read the same field — and is superseded by the post-bump regeneration in Task 6.)

> The `vX.Y` footer belongs only in the shipped **command** files (the generator writes it), never in these WORKING change artifacts — `check-plugin-version.js` scans every `.md` for an `aidakit vX.Y` comment and does not skip code spans.

## 12. The drift test (`generator-single-source-of-truth`)

**`governance/__tests__/flow-command-generation.test.mjs`** — Node table test, no framework, same shape as [`plugin-version.test.mjs`](../../../governance/__tests__/plugin-version.test.mjs) (`spawnSync`/direct import, `ok(cond, name)` counters), run via `node governance/__tests__/flow-command-generation.test.mjs`. Assertions:

- **Byte-drift (the core gate):** for each of `{fast, full, design}`, `renderFlowCommand(metaFrom(parseFlowFile("governance/flows/<name>.yaml")))` equals, byte-for-byte, the committed `commands/flow-<name>.md`. Any drift (a hand-edit to a generated file, or a template change not re-committed) fails.
- **Opt-out honored:** kit mode does **not** produce `commands/flow-docs-onboarding.md` (marker respected, §8).
- **Frontmatter parses as valid slash-command frontmatter (the assertion that would have caught the sentinel-collision bug):** each generated output starts with `---` on **line 1**, has a matching closing `---`, and the `description:` key sits **inside** that parsed frontmatter block — parse the block and read `description:` from it, **not** a bare `description:` substring match anywhere in the file — with the classification word present in the parsed value (§3.1–3.2). The generated-file sentinel is asserted to be the **first line after** the closing `---` (never line 1). A generator that prepended the sentinel above the frontmatter (the original bug) would make `description:` parse as body and fail this assertion, even though the substring `description:` still appears.
- **ADR-005 conventions (`adr005-conventions-preserved`):** each generated output carries the classification-led `description:` (asserted via the parse above), a `## Usage` block with ≥1 copy-paste example, and the `: "${AIDAKIT_GOVERNANCE?…}"` guard on every `cli.js` bullet.
- **Input-key + register:** `flow-design` output contains `project="$ARGUMENTS"` (not `request=`); `flow-fast` contains `request="$ARGUMENTS"` and the `register` block; `flow-full` contains neither `register` nor `project=`.
- **Implicit-start disambiguation (the §3.4 contract, pins R1) — `per-flow-start-shortcut`.** Two coupled layers so the mitigation is real, not prose-only: (1) **contract-present (string assertion):** each generated `flow-*.md` body contains the flow_id regex literal `^[a-z][a-z0-9-]*-[0-9]{6}-[0-9a-f]{1,6}$`, the `list`-sole-token condition, and (for `flow-fast` only) the `register`-first-token condition — so the shipped prose carries the exact rule and any weakening trips byte-drift. (2) **rule-correct (table test):** a small classifier mirroring §3.4 (the same regex + token conditions) is exercised over these inputs and must resolve to the expected dispatch — (a) `resume full-260727-ec4472 success` → **resume**; (b) `resume the broken thing` → **start** (`request="resume the broken thing"`); (c) `list` → **list**; (d) `list all invoices` → **start**; (e) `flow-fast` `register a new provider` → **register** mode (request `"a new provider"`); (f) `status full-260727-ec4472` → **status**; (g) `status of the migration` → **start**. Layer (1) proves the template ships the rule; layer (2) proves the rule itself is unambiguous — a regression in either fails.
- **Consumer-mode behavior (temp dir):** drop `.aidakit/flows/foo.yaml` → `flow-sync` writes `.claude/commands/flow-foo.md` (sentinel present) that starts the `foo` flow; re-run → byte-identical (idempotent). Drop `.aidakit/flows/fast.yaml` → refused with a reason, exit non-zero, no file written. Pre-place a sentinel-less `.claude/commands/flow-bar.md` → preserved untouched.

## 13. Alternatives / Risks

| # | Alternative / Risk | Decision / Mitigation |
|---|---|---|
| A1 | Generic orchestrator command + flow arg (`/aidakit:flow start <x>`) | **Rejected** — owner topology decision (brainstorm Q3); each `flow-<x>` is self-contained. The repeated lifecycle prose is accepted duplication. |
| A2 | Bridge alias so `/aidakit:flow-build` keeps resolving | **Rejected** — doubles the autocomplete clutter ADR-005 removed; ADR-017 records the direct break instead. |
| A3 | Hand-author each per-flow command (no generator) | **Rejected** — no single source of truth; the command drifts from its flow YAML. The generator + drift test is the whole `generator-single-source-of-truth` value. |
| A4 | Emit `flow-docs-onboarding` too (option (a)) | **Rejected** — second, engine-driven door contradicting ADR-005's single-door `docs` utility (§8). |
| A5 | Auto-detect mode instead of `--mode` flag | **Rejected** — explicit is fail-closed and testable; auto-detect could write committed built-ins from a consumer checkout by accident. |
| R1 | Implicit-start ambiguity: a request whose first word is a reserved verb (`status …`, `resume …`, `list …`, `register …`) is mis-read as a lifecycle verb | **Mitigated (concrete)** — the verb-specific dispatch contract [§3.4](#3-the-one-template-renderflowcommand--adr-005-conventions-preserved) recognizes `resume`/`status`/`abort` only when the 2nd token is _flow_id-shaped_ (regex single-sourced from [`persistence.js#newFlowId`](../../../governance/engine/persistence.js)), `list` only as the sole token, and `register` only on `flow-fast`; every other `$ARGUMENTS` falls through to _start_. The seven disambiguation cases (a)–(g) in §12 pin the boundary in the drift/behavior test; the one residual (a `flow-fast` request literally beginning with `register`) is the documented **accepted edge** in §3.4, not an open risk. |
| R2 | `docs-onboarding` flow exists but has no command (asymmetry) | **Accepted** — the opt-out marker records the single-door rationale at the flow file; the flow stays startable via the raw CLI and visible in `flow list`. |
| R3 | Consumer `flow-sync` overwrites a file the user hand-authored | **Mitigated** — sentinel check refuses any target lacking `<!-- aidakit:generated `; hand-authored files are preserved (`generator-fail-closed-collision`). |
| R4 | New template drops an ADR-012 guard or the register prose vs today's `flow-build.md` | **Mitigated** — the wrapper prose is lifted verbatim from the current built-ins; the drift test + the ADR-005-conventions assertions (§12) catch any omission. |
| R5 | Both version leashes not satisfied (footer outruns manifest, or runtime without bump) | **Mitigated** — §11 pins both; run `check-plugin-version` and `check-runtime-bump` locally before the PR. |

## Rollback

The change is: new runtime files under `governance/commands/` + a test, a removed command file, three generated command files, one new command file, one ADR + index row, a one-line flow-YAML marker, prose repointing, and a version bump — all reversible by reverting the change's commits. A single-commit revert restores `flow-build.md` and the old surface cleanly (direct break, no half-migrated alias state). The generator and drift test leave no runtime state (they only render text).

## Conventions and evidence location

- **Naming (frozen):** command files `commands/flow-<flowName>.md`; generator modules `governance/commands/{render-flow-command,generate-flow-commands}.js`; drift test `governance/__tests__/flow-command-generation.test.mjs`; sentinel literal `<!-- aidakit:generated flow=<name> template=<vX.Y> source=<path> -->` (first body line, immediately after the frontmatter's closing `---` — §3.1, never line 1); opt-out marker `emit_flow_command: false`; ADR `docs/decisions/ADR-017-flow-command-generation.md`.
- **Style:** change artifacts (this directory) follow the [command-grouping-and-inputs](../../archive/2026-07-24-command-grouping-and-inputs/design.md) precedent — header block, terse structured prose, **no** doctrine footer (WORKING artifacts are not part of the versioned surface `check-plugin-version.js` scans).
- **Canonical validators / test (run from repo root):** `node governance/__tests__/flow-command-generation.test.mjs`, `node governance/validators/check-links.js .`, `node governance/validators/check-adr-format.js docs/decisions/ADR-017-flow-command-generation.md`, `node governance/validators/check-plugin-version.js .`, `node governance/validators/check-runtime-bump.js . --base origin/main`.
- **Evidence is recorded at the fixed location** [`docs/features/per-flow-commands/evidence.md`](evidence.md).

## Constraining ADRs

- [ADR-005](../../decisions/ADR-005-command-namespacing.md) — the locked `flow-` prefix, mechanical grouping rule, and activity-based naming this change **extends** (superseded on two points by ADR-017); read fully before authoring ADR-017.
- [ADR-016](../../decisions/ADR-016-runtime-change-requires-plugin-bump.md) — mandates the `plugin.json` bump because the generator ships under `governance/`; constrains §11.
- [ADR-012](../../decisions/ADR-012-aidakit-governance-session-wide.md) — the session-wide `AIDAKIT_GOVERNANCE` fail-closed guard the template chains ahead of every `cli.js` call (§3.5).
- [ADR-006](../../decisions/ADR-006-flow-values-as-data.md) — informs the `register` dispatch (`request=<change-id>`, never the free-form sentence) copied into `flow-fast`.
- Not constraining: ADR-001/002/003/004/007/008/009/010/011/013/014/015 — no bearing on the command surface or the generator (the engine internals they govern are untouched).
