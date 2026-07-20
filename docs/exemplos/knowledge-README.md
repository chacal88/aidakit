<!-- check-links: ignore -->
<!--
  Filled-in example of a target project's docs/knowledge/README.md (the razor project).
  In a real project this file lives at docs/knowledge/README.md.
  Shows the format: an index that declares scope/anti-scope and points, never duplicates.
-->
# Knowledge — durable shared knowledge (razor)

> **Scope:** knowledge a developer needs to work here that is **neither a decision nor a how-to** — conventions, the ubiquitous glossary, known gotchas, and business context. Committed and reviewed in PRs, like everything else. **Anti-scope:** decisions with rejected alternatives live in [../decisions/](../decisions/) (ADRs); step-by-step procedures live in [../guides/](../guides/). If it's a decision or a how-to, it does **not** go here.
>
> **Precedence:** this index sequences and points, never duplicates. If a file here contradicts an ADR, the ADR wins and the file is corrected.

## The files

| File | What it holds | Not this |
|---|---|---|
| [conventions.md](conventions.md) | The "way we do it here": naming, patterns, house rules not worth an ADR | A decision with alternatives → ADR |
| [glossary.md](glossary.md) | The ubiquitous language: domain terms with one crisp definition each | A how-to → guide |
| [gotchas.md](gotchas.md) | Known traps: "careful with X because Y", surprises that cost someone an afternoon | A bug with a fix → a test/regression-gate |
| [context.md](context.md) | Business/domain context a new dev needs: why the product exists, who the users are | Market strategy → docs/business/ |

## How it fills up

Most entries arrive by **promotion**: `aidakit:learn` records an operational learning in `.aidakit/memory/learnings.md`; when a learning is durable (a recurring convention or gotcha), learn **proposes** promoting it here in a PR — the human approves. Nothing is written straight in; the PR is the proposal (same principle as the rest of the kit).

<!-- example artifact — a target project's docs/knowledge/README.md -->
