# Design — review-usage-bench-manifest

**Change ID:** `review-usage-bench-manifest`
**Date:** `2026-07-25`
**Owner:** `@chacal88`
**Phase / Package:** `n/a (doc-only surface fix on the review command + skill; classification: domain=product, type=feature, flags=[], confirmed)`
**PRD:** `n/a`
**Tech Spec:** `n/a`

> Scope of this design: **two file edits, one roadmap line, one version bump.** Everything below is prose placement and wording. Nothing here authorizes a code change; the `no-mechanical-write-this-change` criterion is the hard boundary and `git diff --stat` is its mechanical proof (see [tasks.md](tasks.md) §5).

## 1. The mechanical contract being documented (source of truth, re-verified at plan time)

The doc must describe this and nothing more. Every claim below was re-read against live code, not inherited from the epic's prose:

| Claim | Anchor | Verified |
|---|---|---|
| `recordBenchManifest(changeId, {bench, round, roles[]})` appends `{at, type:"bench-manifest", role:"__manifest__", …}` to `.aidakit/tasks/<change-id>/bench.ndjson` | [governance/ledgers/ledger.js](../../../governance/ledgers/ledger.js):69-71 | yes |
| `recordBench(changeId, rec)` appends `{type:"bench", …rec}` — the per-role record, carrying the role's own `dispatched_at`/`returned_at`, **not** the ledger-write time | [governance/ledgers/ledger.js](../../../governance/ledgers/ledger.js):55-57 (+ the doc comment at :46-54) | yes |
| The ledger writes under `projectRoot()` (`AIDAKIT_PROJECT_ROOT`, else cwd) — so the call needs no path argument in a normal flow run | `ledger.js`:23-25 → `engine/persistence.js` | yes |
| `manifest-missing` fires when the round has no `__manifest__` record and `--roles` was not passed | [governance/validators/check-bench.js](../../../governance/validators/check-bench.js):110-112 | yes |
| `manifest-duplicate` fires on a **second** `__manifest__` in the same round | `check-bench.js`:114-116 | yes |
| `manifest-not-first` fires when any role record's `dispatched_at` (fallback `at`) is **earlier** than the manifest's `at` | `check-bench.js`:119-128 | yes — reproduced live, see §2 |
| `role-missing` compares the manifest's `roles[]` against role records **by exact string** | `check-bench.js`:138-140 | yes |
| Round defaults to `Math.max(...rounds)` when `--round` is absent | `check-bench.js`:101 | yes |
| The flow wiring: `review_bench` (`type: invoke`) → `check_review_bench` (`type: runs`), `on_failure: review_bench` | [governance/flows/full.yaml](../../../governance/flows/full.yaml):249-274 (mirrored in `fast.yaml`) | yes |

**Canonical role vocabulary** (what real rounds have used, and what the example must therefore use — from `.aidakit/tasks/context-pack-l1/bench.ndjson`, the most recent live bench): `adr-reviewer`, `spec-reviewer`, `reviewer-quality`, `reviewer-security`, `reviewer-architecture`, `tester` — i.e. the `subagent_type` minus the `aidakit:` prefix. This is a **convention, not a validated enum**: `check-bench.js` only requires that the manifest string and the `recordBench` string match byte-for-byte. The doc states it as the convention and states the byte-match as the rule.

## 2. The example, executed before it was written

The snippet below was **run** at plan time (scratch dir, `AIDAKIT_PROJECT_ROOT` pointed at it) and its ndjson passed `check-bench.js … --bench review --outcome consensus` with exit 0. Two findings from that run are load-bearing for the wording:

1. **The ESM-from-Bash form works and is the only ergonomic one.** `node --input-type=module -e "import { … } from '$AIDAKIT_GOVERNANCE/ledgers/ledger.js'; …"` — a plain `node -e` fails on the `import` statement, which is exactly the friction that makes a caller skip the write.
2. **A naive first attempt FAILS the leash.** Fabricating `dispatched_at` values that predate the manifest write produced `manifest-not-first` (exit 1) even though all six roles reported and the consensus matched. The example must therefore say *explicitly* that `dispatched_at` is a real timestamp taken **after** the manifest write, not a backfilled round number. This is the non-obvious half of the requirement and the reason a prose-only "write it, THEN dispatch" is insufficient.

## 3. Edit 1 — `commands/review.md` (the requirement + the consequence + the link)

**File:** `commands/review.md`. **Insertion point:** inside `## Usage`, immediately **after** the `**Examples (copy-paste):**` bullet list (currently line 15) and **before** the `Invoke this plugin's ...` paragraph (currently line 17). Rationale: the ADR-005 contract for a utility command is *expected inputs → copy-paste example → what it dispatches*; the manifest note is a precondition of the dispatch, so it belongs between the example and the dispatch paragraph. Adding it **before** the examples would push the copy-paste invocation below the fold and weaken the [ADR-005](../../decisions/ADR-005-command-namespacing.md) guarantee.

**Text to insert** (final wording; the implementer may tighten prose but must keep every named token — `recordBenchManifest`, `__manifest__`, `bench.ndjson`, `check_review_bench`, and the link):

```md
**Before the fan-out — the bench manifest is not optional.** Before dispatching any reviewer agent, the caller writes a `__manifest__` record — the full list of roles the round commits to — to `.aidakit/tasks/<change-id>/bench.ndjson` via `recordBenchManifest` (`governance/ledgers/ledger.js`). Skip it and the leash `check_review_bench` (`governance/validators/check-bench.js`) fails with `manifest-missing` and back-edges the flow to `review_bench`: **the entire bench re-runs**, every role, one full extra round of subagent cost. Copy-paste shape (manifest → parallel `Agent` calls → `recordBench` per role): step 5 of [the review skill](../skills/review/SKILL.md).
```

Constraints on this edit:

- **One relative link, resolving from `commands/`:** `../skills/review/SKILL.md`. Matches the existing link convention in `commands/flow-build.md`:18 (`../docs/decisions/ADR-012-…`). [DOCS.md](../../../DOCS.md) §2 rule 4 asks for the target's identity visible in the link text — here the identity is the skill, named in the text.
- **No example is copied here** ([DOCS.md](../../../DOCS.md) §2 rule 1): the command carries the *requirement + consequence + pointer*, the skill carries the *shape*. Any implementation that pastes the snippet into both files fails review.
- **The `$ARGUMENTS` guard at lines 5-6 and the `description:` frontmatter are untouched** — the empty-arguments behavior contracted by ADR-005 does not change.
- **Footer:** append a new provenance line after the existing two (the file's convention is *append, never rewrite*): `<!-- aidakit v0.9 — review-usage-bench-manifest: bench manifest requirement + consequence surfaced in Usage, 2026-07-25 -->`.

## 4. Edit 2 — `skills/review/SKILL.md` step 5 (the single copy-paste example)

**File:** `skills/review/SKILL.md`. **Two touch points, one of which is a pointer:**

**(a) Forward pointer** — in the existing paragraph at line 62 (`**Before dispatching anyone, write the bench manifest** …`), append to its last sentence so it reads `Write it, THEN dispatch — copy-paste shape at the end of this step.` No other change to that paragraph; it already carries the requirement, the record shape, and the anti-shrink rationale.

**(b) The example block** — inserted at the **end of step 5**, after the "All summoned agents run in parallel, in a single message" paragraph (currently line 76) and before step 6's heading. Placement rationale: the example needs the role list, which the matrix table (lines 66-74) defines; putting it before the table would forward-reference the vocabulary it depends on.

**Block to insert** (structure is binding; prose may be tightened, the three invariants and both fenced commands may not be dropped):

````md
   **Copy-paste dispatch shape.** The mechanical source of truth is [ledger.js](../../governance/ledgers/ledger.js) (what gets written) and [check-bench.js](../../governance/validators/check-bench.js) (what gets checked); this is the minimal sequence that satisfies both.

   1. **Write the manifest first** — before any `Agent` call:

   ```bash
   node --input-type=module -e "
   import { recordBenchManifest } from '$AIDAKIT_GOVERNANCE/ledgers/ledger.js';
   recordBenchManifest('<change-id>', { bench: 'review', round: 1,
     roles: ['adr-reviewer','spec-reviewer','reviewer-quality','reviewer-security','reviewer-architecture','tester'] });
   "
   ```

   2. **Then dispatch** — one `Agent` call per manifested role, all in the SAME message. Note the wall-clock time you fire them and the time each returns; those are the `dispatched_at`/`returned_at` below.

   3. **Record each verdict as it returns** (one call per role, or one batched script):

   ```bash
   node --input-type=module -e "
   import { recordBench } from '$AIDAKIT_GOVERNANCE/ledgers/ledger.js';
   recordBench('<change-id>', { bench: 'review', round: 1, role: 'adr-reviewer',
     agent: 'aidakit:adr-reviewer', verdict_raw: 'Status: APPROVED', verdict: 'pass',
     dispatched_at: '<ISO — when you fired the Agent call for this role>',
     returned_at:   '<ISO — when it returned>' });
   "
   ```

   **Three invariants the leash actually enforces** (each is a `check-bench.js` rule, not a style note):

   - **Role strings match byte-for-byte** between the manifest's `roles[]` and each `recordBench` `role` — the convention is the `subagent_type` minus the `aidakit:` prefix. A rename between the two lists surfaces as `role-missing`, indistinguishable from a role that never ran.
   - **Every `dispatched_at` is later than the manifest write.** The manifest must be the round's earliest record; a backfilled or rounded-down timestamp trips `manifest-not-first` even when all roles reported and the consensus was right.
   - **Exactly one manifest per round.** You cannot top one up after seeing a verdict — a second `__manifest__` in the same round is `manifest-duplicate`. Re-summoning only the failed roles (step 8) is a **new round**: `round: 2`, a fresh manifest listing only those roles, written before that round's dispatch.

   **If you skip the manifest:** `check-bench.js` exits 1 with `manifest-missing`, `check_review_bench` back-edges to `review_bench` ([governance/flows/full.yaml](../../governance/flows/full.yaml)), and the **whole bench re-runs** — every role re-dispatched, one full extra round of subagent cost, for a record that takes one line.
````

Constraints on this edit:

- **Indentation:** the block is nested inside numbered step 5, so it carries the 3-space continuation indent the surrounding step-5 paragraphs already use. Fenced blocks inside a numbered item must keep that indent or the list breaks.
- **Links resolve from `skills/review/`:** `../../governance/…` (already the convention at lines 62 and 87). `check-links` skips fenced blocks, so the `$AIDAKIT_GOVERNANCE` path inside the ```bash fences is not link-checked — the prose links outside the fences are.
- **`$AIDAKIT_GOVERNANCE`, never a relative import** ([ADR-004](../../decisions/ADR-004-aidakit-governance-env-contract.md), [ADR-012](../../decisions/ADR-012-aidakit-governance-session-wide.md)): the skill runs with `cwd` = the consumer repo; a relative path to the kit's `governance/` would not resolve there. ADR-012 is what makes the var present in a direct Bash tool call, not only in `runs`-step children.
- **Quoting footgun — no apostrophe inside the single-quoted JS strings.** The whole snippet is a double-quoted Bash argument containing single-quoted JS literals; a placeholder like `when you fired this role's Agent call` closes the JS string and breaks the command. Placeholders are phrased apostrophe-free (as written above). Verify by running it, not by reading it (see [tasks.md](tasks.md) §5).
- **Exit-1 wording, not "non-zero"** ([ADR-011](../../decisions/ADR-011-runs-infra-error-routing.md)): an infra error (127/126/signal) hard-stops the flow and bypasses `on_failure` entirely. Saying "any non-zero exit back-edges" would be false.
- **Nothing else in the file changes** — the matrix, the Prerequisites context-pack paragraph ([ADR-013](../../decisions/ADR-013-context-pack-per-change.md), line 29), the `recordBench` schema at lines 87-93 and the Gates section at line 115 all stay as they are. In particular the lines 87-93 schema is **not** deleted in favor of the example: it is the normative field list, the example is the invocation.
- **Footer:** append `<!-- aidakit v0.9 — review-usage-bench-manifest: copy-paste manifest → dispatch → recordBench shape in step 5, 2026-07-25 -->` after the existing footer line.

## 5. Edit 3 — the debit, `review-bench-manifest-mechanical-writer`

**Change-id collision check** (mandatory before writing — the `register` discipline of [skills/roadmap/SKILL.md](../../../skills/roadmap/SKILL.md) step 2): verified at plan time that `review-bench-manifest-mechanical-writer` appears in **no** epic `changes:` list, has **no** `docs/features/<id>/` dir and **no** `docs/archive/*-<id>/` dir. Re-verify mechanically at implementation ([tasks.md](tasks.md) §4) with `findDeclaredChange` from [governance/roadmap/roadmap.js](../../../governance/roadmap/roadmap.js):153 — do not trust this line alone.

**File:** `docs/roadmap/epics/EPIC-kit-discipline-hardening.md`. **Insertion point:** in `## Features`, immediately after the existing `review-usage-bench-manifest` feature bullet (lines 9-10) — the debit is that feature's direct successor and reads best adjacent to it.

**Language:** the epic's existing bullets are pt-BR. The new bullet **matches the surrounding file** (in-file consistency wins over the repo default for an append into a legacy-language doc; the change artifacts themselves are EN per [DOCS.md](../../../DOCS.md) §5, and the repo's `aidakit.config.yaml` declares no `language`, i.e. `en`). Same call the [command-grouping-and-inputs](../../archive/2026-07-24-command-grouping-and-inputs/tasks.md) Task 0 made.

**Bullet to insert** (the acceptance sub-bullet MUST name the `manifest-duplicate` conflict as the crux — that is the literal wording of criterion `mechanical-writer-registered-as-debit`):

```md
- **Feature:** `aidakit:review` grava o bench manifest mecanicamente — changes: review-bench-manifest-mechanical-writer
  - Aceite: o manifest do bench de review passa a ser escrito por um passo `runs` determinístico ANTES do `review_bench` (`type: invoke`), eliminando a chance do caller esquecer. **O nó do problema é o contrato `manifest-duplicate`** (`governance/validators/check-bench.js:114-116`): um manifest pré-escrito mecanicamente só consegue derivar os papéis que saem de `{domain,type,flags}` — `security` e `architecture` têm gatilhos heurísticos sobre o diff (auth/dado sensível/credencial/cripto; cria módulo ou cruza fronteira de camada), então o manifest nasce incompleto, e completá-lo depois do dispatch colide com a regra de um-manifest-por-round, que é justamente o que torna o manifest anti-tamper. Resolver isso é decisão de arquitetura (relaxar a regra com uma noção de manifest "aberto" vs. derivar os papéis heurísticos por outro meio) e provavelmente pede ADR própria, espelhando o padrão da ADR-010 (agente dedicado + validator, não prosa realocada). Pino: o novo passo aparece em `governance/flows/full.yaml` e `fast.yaml`, e `governance/__tests__/check-bench.test.mjs` cobre o round em que o manifest é escrito mecanicamente.
```

Constraints:

- **No status field anywhere** ([ADR-002](../../decisions/ADR-002-roadmap-status-derived-from-disk.md)) — the epic declares intent only. `review-bench-manifest-mechanical-writer` will derive `backlog` (declared, nothing on disk) automatically.
- **`ROADMAP.md` is regenerated, never hand-edited** (ADR-002; the file's own header says so). Regeneration is `derive-roadmap-status.js` + writing its view back, i.e. the `regen` mode of [aidakit:roadmap](../../../skills/roadmap/SKILL.md).
- **`docs/roadmap/README.md` gets no edit** — it indexes *epics*, and `EPIC-kit-discipline-hardening` is already listed (line 15).
- **The epic's `## Não-goals` are not edited.** "Não bundlar os 4 em um PR só" already covers the new fifth item by construction.

## 6. Delivery — the footer/manifest numbering trap

`.claude-plugin/plugin.json` is `0.9.0` on `main` at plan time. **Re-read it at implementation start; the constraint is relative to the live manifest, not to this number** ([PROCESS.md](../../../PROCESS.md) §5). Two rules bind:

- `check-plugin-version.js` requires manifest ≥ the highest `<!-- aidakit vX.Y -->` footer in the tree. The two footers added by §3-§4 declare `v0.9`, so `0.9.0` alone already satisfies the validator — **the validator is not the reason to bump**.
- The reason to bump is delivery: `claude plugin update` compares nothing but the manifest version. `commands/review.md` and `skills/review/SKILL.md` are plugin-shipped files; without a bump strictly above `main`'s version, the update no-ops and the doc fix reaches nobody. Recommended: **`0.9.1`** (patch — doc-only, no behavior change).

## 7. Alternatives considered

| Alternative | Why rejected |
|---|---|
| **`aidakit:review` writes the manifest itself** (the epic's "PREFERRED") | `review_bench` is `type: invoke` (`full.yaml:249-250`) — the skill *is* the model's instructions, so "the skill writes it" and "the doc tells the model to write it" are the same mechanism with different prose. A genuinely mechanical write needs a `runs` step, which cannot derive the heuristic roles and collides with `manifest-duplicate`. Owner-settled at the brainstorm gate; registered as a debit (§5) instead. |
| **A `runs` step that pre-writes only the flag-derivable roles, topped up by the skill** | Direct `manifest-duplicate` violation (`check-bench.js`:114-116). Softening that rule removes the anti-tamper property the whole leash rests on — an architecture decision outside this feature line ([GOVERNANCE.md](../../../GOVERNANCE.md) §1, escalation 3). |
| **Put the example in `commands/review.md` too** (a reader may only open the command) | Two copies drift; [DOCS.md](../../../DOCS.md) §2 rule 1 puts content in one place and has the other point at it. Mitigated by making the command's line carry the *consequence*, which is the part that motivates opening the link. |
| **Put the shape in `governance/README.md` §"Real parallelism"** | That section is the architectural narrative of the bench primitive, read by someone learning the engine — not by an agent mid-dispatch. The instruction belongs at the point of use. It already points at `check-bench.js`'s header for the ndjson contract and needs no edit. |
| **Record it in `docs/knowledge/gotchas.md`** ([ADR-003](../../decisions/ADR-003-shared-knowledge-in-docs.md)) | ADR-003's own boundary: `knowledge/` holds what is neither a decision nor a how-to. This *is* a how-to, executed by an agent that will never open a knowledge file. This repo also has no `docs/knowledge/` yet, so it would mean creating a folder to hide an instruction from its reader. |
| **A new validator/test pinning the doc** (e.g. grep the skill for `recordBenchManifest`) | Adds code under `governance/`, directly violating `no-mechanical-write-this-change`; the epic reserves the `check-bench.test.mjs` pin for the route the owner did not choose. The exit criterion "the example is executed verbatim and clears `check-bench.js`" gives the same assurance without new code. |
| **Fix `skills/implement/SKILL.md` in the same pass** | Same footgun, but the epic's feature line names only `aidakit:review`; widening in silence is [GOVERNANCE.md](../../../GOVERNANCE.md) §1 escalation 3. Named in the proposal's Unblocks, not acted on. |

## 8. Rollback

Trivial and total: `git revert` of the single commit restores four files (`commands/review.md`, `skills/review/SKILL.md`, `docs/roadmap/epics/EPIC-kit-discipline-hardening.md`, `docs/roadmap/ROADMAP.md`) plus the manifest version. No state, no migration, no consumer contract — nothing reads these files programmatically except `check-links` and `check-plugin-version`, both of which pass on the pre-change tree by construction. Reverting the manifest bump below a published version is the only nuance: prefer a forward `0.9.2` re-bump over rewriting `0.9.1` if the revert lands after users have updated.

## 9. Evidence

Fixed location: [`docs/features/review-usage-bench-manifest/evidence.md`](evidence.md). Naming conventions frozen: change-id `review-usage-bench-manifest`, branch `claude/review-bench-manifest-cff1c2` (already cut), debit change-id `review-bench-manifest-mechanical-writer`, doctrine footer version `v0.9` on both touched kit files.
