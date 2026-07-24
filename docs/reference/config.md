# Reference — aidakit.config.yaml

> **Precedence:** this reference summarizes and points. If it diverges from the linked skill, doctrine ([DOCS.md](../../DOCS.md), [GOVERNANCE.md](../../GOVERNANCE.md), [PROCESS.md](../../PROCESS.md)), each field's consumer `SKILL.md`, or the commented [aidakit.config.example.yaml](../../aidakit.config.example.yaml), **the other wins and this file is corrected**.
>
> Examples use the canonical **razor** project (a scheduling SaaS for barbershops; NestJS + React + PostgreSQL/Neon + Prisma).

`aidakit.config.yaml` is the per-project configuration file the plugin reads. It lives at the **root of the target project** (the repo the kit operates on), never inside the kit. It lets a project choose the language of the content the kit generates and declare its domain map and review matrix.

## The file is OPTIONAL

**The kit works with no config file at all.** Every field is optional, and each has a built-in default (see the table below). Add the file only when a default does not fit your project — a non-English content language, more than one domain, or a custom reviewer matrix. Absent the file, the kit behaves as if every field held its default.

To create it, **copy the commented template** [aidakit.config.example.yaml](../../aidakit.config.example.yaml) to the root of your project as `aidakit.config.yaml` and edit it. Delete the sections you do not need — an omitted field falls back to its default.

## Fields at a glance

| Field | Purpose | Consumer | Default when absent |
|---|---|---|---|
| [`language`](#language) | Language of the CONTENT the kit generates (prose only) | every generating skill | `en` |
| [`domains`](#domains) | Domain map by path + strictness order | [aidakit:identify-domain](../../skills/identify-domain/SKILL.md) | single domain `produto` |
| [`review.matrix`](#reviewmatrix) | Classification flag → reviewer agents summoned | [aidakit:review](../../skills/review/SKILL.md) | the skill's built-in matrix |
| [`pr.auto_merge`](#prauto_merge) | Opt in the flow's merge step to an autonomous merge (ADR-008) | `merge_route` gate + `hooks/pre-bash.js` (via `governance/pr/pr-config.js`) | `false` (fail-closed — human merges) |

---

## `language`

The language of the **content the kit GENERATES** — deliverables, ADRs, interview questions, and operator prompts. The kit reads this field and produces that content directly in the declared language. A BCP-47-ish tag or a plain name; the model generates in it directly.

```yaml
language: pt-BR   # examples: en · pt-BR · es · fr
```

**Default when absent: `en`.** ([DOCS.md §5](../../DOCS.md).)

**Approach — instruction, not translation.** The kit itself is written in English. There is no translation table in the kit: the skill (in English) instructs "generate in the declared language", and the model produces the output in that language when it generates. Setting `language: pt-BR` does not translate the kit — it steers what the kit writes for this project.

**Only the readable PROSE follows `language`.** The following stay **fixed** regardless of the field, so tooling and validation keep working:

| Category | Follows `language`? | Examples |
|---|---|---|
| Human-readable prose | **yes** | deliverable body text, interview questions, operator prompts, ADR narrative |
| Identifiers | no — fixed | `aidakit:*` namespaces, file names, field/key names |
| Machine-parseable verdicts | no — fixed | `Status: APPROVED \| NEEDS-REVISION \| BLOCKED`, `verdict: approved \| rejected` (the [aidakit:review](../../skills/review/SKILL.md) validator reads these) |
| Structural headers | no — fixed | `## Context`, `### Requirement:`, `#### Scenario` in ADR/spec OpenSpec mode (structural validation reads these) |
| Classification enums | no — fixed | domain/type/flag values (`bug`, `feature`, `contract`, `ui`, …) |

A project may still record the language choice in an ADR for the record. If it does, the ADR and this field must agree — the field is what the kit reads at generation time.

---

## `domains`

Consumed by [aidakit:identify-domain](../../skills/identify-domain/SKILL.md) at step 1 of every change to classify a delivery by **where the work touches**. Maps each domain to the path globs that belong to it, and declares the strictness order (first = strictest).

```yaml
domains:
  by-path:
    core:
      - "src/core/**"
      - "packages/*/src/**"
    web:
      - "apps/web/**"
  # strictest first — a change touching multiple domains takes the strictest one
  strictness:
    - core
    - web
```

- **`by-path`** — a map of `domain-name → [glob, …]`. `identify-domain` applies the **first match by path** to name the change's domain.
- **`strictness`** — the domains in order, strictest first. When a change touches **more than one** domain, the classifier picks the **strictest** of the touched domains (fail-closed).

Two built-in behaviors do not depend on this field:

- Mechanism-only paths (`docs/`, `.aidakit/`, `scripts/`, config) → the built-in `process` domain.
- **If `domains` is omitted → the project has a single domain, `produto`.**

See the [aidakit:identify-domain](../../skills/identify-domain/SKILL.md) fail-closed algorithm for how domain, type, and flags combine.

---

## `review.matrix`

Consumed by [aidakit:review](../../skills/review/SKILL.md) at the summon step. Maps a classification **flag** (from [aidakit:identify-domain](../../skills/identify-domain/SKILL.md)) to the reviewer **agents** convened when that flag is present on the change.

```yaml
review:
  matrix:
    architecture:
      - reviewer-architecture
    contract:
      - reviewer-security
      - reviewer-architecture
    ui:
      - reviewer-quality
```

- Each key is a classification flag; each value is the list of agents summoned when that flag is set.
- **The two base reviewers always run** — `aidakit:adr-reviewer` and `aidakit:spec-reviewer` — and need **not** be listed here.
- **If `review.matrix` is omitted → the skill uses its built-in matrix** (the role×flag table in [aidakit:review](../../skills/review/SKILL.md), step 5). Declare this field only to override that table for the project.

The whole summoned bench runs in parallel, in a single turn; each agent returns exactly one machine-parseable verdict. See [aidakit:review](../../skills/review/SKILL.md) for the verdict normalization and the PASS/FAIL consensus.

---

## `pr.auto_merge`

Consumed at runtime by the flow's `merge_route` gate (`governance/validators/check-pr-automation.js`) and by the `hooks/pre-bash.js` `gh pr merge` carve-out — both read it through the same single-source helper, `governance/pr/pr-config.js`, so the two decisions never diverge. This is the **first** field the engine itself reads at runtime (every other field above is read by a generating skill, not the engine).

```yaml
pr:
  auto_merge: false   # bool — opt-in autonomous merge for the flow's merge step; gated by ADR-008
```

- **Default when absent: `false`.** No `pr:` block, or `auto_merge: false` (explicit or any non-`true` value, including a malformed config) — the flow's tail behaves exactly as it does today: the `merge` step is a `human_gate`, the human merges on the host.
- **Read from the repo's TRUSTED BASE BRANCH — never the working tree.** `pr.auto_merge` must already be **committed** on the repo's base branch (`git show <base-ref>:aidakit.config.yaml`; base resolves via `AIDAKIT_BASE_REF`, else `origin/HEAD`, else a local `main`, else `master`). A PR that adds `pr.auto_merge: true` to its own diff does **not** grant itself the opt-in — a human merges that first PR, same as today; only PRs opened **after** the field is already on the base branch see it as enabled. This is a deliberate security boundary (ADR-008): the opt-in must be a prior, already-merged decision.
- **`auto_merge: true`, once committed on the base,** opts the project's flows into the autonomous merge: the tail routes `pr → merge_route → auto_merge` (the [`aidakit:merge`](../../skills/merge/SKILL.md) skill), which checks mergeability on the host and merges via `gh pr merge` — never with `--admin`/`--no-verify` (`gh pr merge` has no `--force` flag). Any doubt or failure falls back to the same `human_gate`, reporting why.
- **Fail-closed.** Absence, `false`, the field only present on a feature/PR branch (never the base), not a git repository, an unresolvable base ref, or any read/parse error all resolve to `false` — only an explicit `pr.auto_merge: true`, committed on the base, grants the opt-in. The `gh pr merge` block the `pre-bash` hook otherwise enforces unconditionally becomes, for this ONE case, a fail-closed exception scoped to this field — see [ADR-008](../decisions/ADR-008-opt-in-autonomous-pr-merge.md) and [GOVERNANCE.md](../../GOVERNANCE.md) §1/§4.
- **Scoped, per project — never a global kit toggle.** The kit's own repository (no `aidakit.config.yaml`) is unaffected; only a project that explicitly declares the field, on its base branch, opts in.

---

## Related

- [aidakit.config.example.yaml](../../aidakit.config.example.yaml) — the commented template to copy.
- [aidakit:identify-domain](../../skills/identify-domain/SKILL.md) — consumes `domains`.
- [aidakit:review](../../skills/review/SKILL.md) — consumes `review.matrix`.
- [aidakit:merge](../../skills/merge/SKILL.md) — dispatched only when `pr.auto_merge` resolves `true`.
- [ADR-008](../decisions/ADR-008-opt-in-autonomous-pr-merge.md) — the scoped supersession this field implements.
- [DOCS.md §5](../../DOCS.md) — the language-hygiene rule (prose vs. structure) this field implements.
- [Skills reference](skills.md) · [Agents reference](agents.md) — the other lookup references. Back to the [reference index](README.md) and the [master index](../INDEX.md).

<!-- aidakit v0.3 — reference for aidakit.config.yaml (language + domains + review.matrix), created on 2026-07-20 -->
<!-- aidakit v0.8 — pr.auto_merge field (opt-in autonomous merge, ADR-008), configurable-pr-automation, 2026-07-24 -->
