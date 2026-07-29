# aidakit — field guide

> A visual, browsable version of this page renders at [`docs/overview.html`](overview.html) (open it locally). This is the same content in GitHub-native Markdown.
>
> **Precedence:** this overview summarizes and points. If it diverges from the doctrine ([DOCS.md](../DOCS.md), [GOVERNANCE.md](../GOVERNANCE.md), [PROCESS.md](../PROCESS.md)) or a `SKILL.md`, the other wins and this file is corrected.

A Claude Code plugin that carries a full engineering process into any repo: guided architecture design, a spec-driven execution pipeline with human gates, document & execution doctrine enforced by an active hook, an in-repo roadmap, and shared knowledge — **no Jira, no Confluence; the truth is always the disk.**

**The one idea:** a deterministic engine does the *enforcing*, the AI does the *thinking*. Anything mechanical — validating docs, blocking dangerous git, deriving status, checking a manifest — runs as zero-dependency Node and cannot be talked out of it. Anything that needs judgment is a skill or an agent. The two halves never blur.

| | |
|---|---|
| **29** skills | **12** agents |
| **5** validators | **4** flows |
| **1** active hook | **139** tests green |

---

## 1 · The four layers

Everything in the kit belongs to one of four layers.

### Layer 1 — Architecture design · `/aidakit:flow-design`
A sequential 4-phase interview with gates: **1 Business** → **2 DDD Modeling** → **3 Architecture** (decisions become ADRs) → **4 Implementation** (hands the baton to the pipeline and emits the backlog as roadmap epics). One question at a time; each phase yields a document in `docs/design/` and only advances on explicit approval. State lives in `docs/design/STATE.md` — close the session, resume weeks later.

### Layer 2 — Execution pipeline · `/aidakit:flow-fast` · `/aidakit:flow-full`
Each change runs the canonical cycle from plan to PR. Skills delegate to agents with **separated roles** — author ≠ reviewer ≠ shipper. The kit stops at the PR URL; **the human merges.** Change artifacts live in `docs/features/<change-id>/`. One key ties it all: **change-id = branch = PR suffix = archive dir**.

### Layer 3 — Document & execution doctrine · `/aidakit:docs` · `/aidakit:governance`
- **DOCS.md** — the standardized document architecture: canonical `docs/` tree, seven inviolable rules (ADR is WORM, every dir has an index, dated archive…), a placement decision tree, WORKING → DURABLE.
- **GOVERNANCE.md** — how agents work: permissive by design with exactly 3 human escalations (merge a PR, supersede an ADR, go out of scope). Enforced by the active `pre-bash` hook.

### Layer 4 — Catalog & archive · `/aidakit:catalog`
A grouped, searchable index of everything you have — authored skills, agents, hooks, doctrine, installed official plugins, and a verified community archive loaded on demand. Ask *"do I have something for X?"* and it points you to the tool.

---

## 2 · The canonical cycle

What one change goes through, left to right. **Amber = gates** that block progress; the last step is the human's — the kit never merges.

```
build → plan → [Gate 1: readiness] → implement (TDD) → test·coverage
      → [Gate 2: review --diff] → learn → ship (→ PR URL) ┈┈ merge (human)
```

| Step | What it does |
|---|---|
| `build` | picks the next ready change (roadmap gives the order) |
| `plan` | authors proposal · design · tasks (no product code) |
| **`readiness`** | **Gate 1** — the plan package is ready? |
| `implement` | TDD: red → green → refactor |
| `test` · `coverage` | per-surface suites + gap analysis |
| **`review --diff`** | **Gate 2** — adversarial bench, PASS/FAIL |
| `learn` | consolidate + crystallize DNA + propose knowledge |
| `ship` | commit · push · PR → **stops at the URL** |
| `merge` | **the human**, on the git host |

> The plan only becomes history when the implementation has validated it. Shipped changes move to a dated `archive/` and become jurisprudence — new changes cite precedents by archive-id.

---

## 3 · Authored skills

Invoke by qualified name (e.g. `aidakit:review`) or via the `/aidakit:*` slash commands where one exists.

| Skill | What it does | Gate? |
|---|---|---|
| `design` | Start/resume the 4-phase architecture interview with gates | |
| `build` | Drive a change plan → PR; 1st step picks the next ready change | |
| `plan` | Author a plan-only change (proposal/design/tasks), no product code | |
| `spec` | Read specs with related-spec discovery, ADR linkage, validation | |
| `readiness` | Readiness review of the plan package before coding | **Gate 1** |
| `review` | Canonical pre-ship gate: parallel reviewers + structural validation | **Gate 2** |
| `test` | Per-surface test suites with a coverage report | |
| `coverage` | Cross-surface coverage-gap analysis with concrete suggestions | |
| `implement` | Dispatch a change's implementation to the isolated implementer (TDD) | |
| `ship` | Commit + push + PR (has a DNA mode); stops at the URL | |
| `reflect` | Lightweight per-phase retro (3 questions) that feeds learn | |
| `learn` | Consolidate learnings; crystallize DNA; propose promotion to knowledge | |
| `roadmap` | In-repo roadmap; `from` mode generates epics from a description | |
| `docs` | Deploy / audit / index / archive the DOCS.md document architecture | |
| `governance` | Explain / audit / onboard the GOVERNANCE.md doctrine | |
| `catalog` | Searchable index of every tool | |
| `identify-domain` | Classify a change → selects review matrix + brainstorm ammo | |
| `brainstorm` | Default-on adversarial grill BEFORE spending spec tokens | |

Plus **16 curated third-party skills** loaded on demand when a change touches their domain: `react-best-practices`, `postgresql`, `neon-postgres`, `saas-multi-tenant`, `security-threat-model`, `test-driven-development`, `systematic-debugging`, `vitest`, `ddd-strategic-design`, `multi-agent-patterns`, `advanced-evaluation`, `tool-design`, `ai-native-cli`, `context-compression`, `skill-scanner`, `postgres-best-practices`.

---

## 4 · Agents

Isolated-context subagents that receive a task, work alone, and return a verdict. Role separation is the point — the one who writes is never the one who reviews.

| Agent | Role |
|---|---|
| `orchestrator` | Picks the next ready change (reads the roadmap for priority); generates prompts; tracks progress. **Never merges.** |
| `planner` | Authors plan-only artifacts + spec deltas; cross-checks citations/paths. **Never writes product code.** |
| `implementer` | Implements task-by-task with TDD in isolated context; returns diff, marked tasks, outcome, correction events. |
| `reviewer-architecture` | Reviews structure / responsibility / boundary changes. |
| `reviewer-security` | Reviews contract / auth / sensitive-data changes (6 vuln categories + false-positive filter). |
| `reviewer-quality` | Quality + performance gate (N+1, pagination, hot-path costs). |
| `spec-reviewer` | Independent critic that audits a spec before the pre-apply gate. |
| `adr-reviewer` | Reviews ADRs for format and decision soundness. |
| `doc-planner` | Assembles the doc-manifest (the leash) — which docs a change must produce. |
| `brainstorm` | Runs the adversarial grill against the domain's ammunition. |
| `tester` | Runs and reports the per-surface test suites. |
| `research` | Scoped research that returns a structured result without bloating context. |

---

## 5 · The deterministic engine

Pure Node, zero dependencies — the "leash" the model cannot argue with. Every validator follows the same contract: `exit 0/1/2`, JSON on stdout, a human report on stderr.

| Piece | What it blocks / does | File |
|---|---|---|
| **pre-bash hook** | Blocks what GOVERNANCE §4 forbids (`push --force`, `add -A`, `reset --hard`, `gh pr merge`…). Fail-open. Bypass via `AIDAKIT_BYPASS=1` is logged. | `hooks/pre-bash.js` |
| **flow engine** | A declarative state machine running a flow as steps (invoke · runs · human_gate · loop · parallel · terminal). | `governance/engine/` |
| **check-doc-manifest** | The doc leash: a change can't pass until every required doc exists *on disk*. | `validators/check-doc-manifest.js` |
| **check-adr-format** | Enforces the 5-section ADR format & controlled status vocabulary (bilingual PT\|EN headings). | `validators/check-adr-format.js` |
| **check-links** | Every internal markdown link must resolve on disk. | `validators/check-links.js` |
| **derive-roadmap-status** | Derives each roadmap item's status from disk (features/ vs archive/ vs PR). | `validators/derive-roadmap-status.js` |
| **check-dna-freshness** | Flags a crystallized test/rule as stale when its origin ADR is superseded. | `validators/check-dna-freshness.js` |
| **check-plugin-version** | Release leash: fails when a `<!-- aidakit vX.Y -->` footer declares more than `plugin.json`, which is the only number `claude plugin update` reads. | `validators/check-plugin-version.js` |
| **check-runtime-bump** | Range leash (ADR-016): fails a PR that changes runtime (`hooks/` or `governance/`, minus `__tests__` and `*.md`) without raising `plugin.json` in the same range. Run on every PR by CI. | `validators/check-runtime-bump.js` |
| **ledgers + DNA** | Token/error ledgers; `deriveCandidates` spots an error recurring ≥3× and `writeDna` crystallizes the lesson into a regression test/rule. | `governance/ledgers/` · `dna/` |

---

## 6 · Tracking & memory — in the repo

Planning and shared knowledge without an external tool. Both live in `docs/`, versioned and PR-reviewed.

| Layer | What it is |
|---|---|
| **docs/roadmap/** | **Epic → Feature → Change** as markdown. Status is **derived from disk**, never a hand-edited field — so it can't drift like a Jira board. You create an epic by *describing* it (`aidakit:roadmap from "…"`), which interviews you and generates it. `ROADMAP.md` is generated. |
| **docs/knowledge/** | Durable shared knowledge that is neither a decision nor a how-to: `conventions`, `glossary`, `gotchas`, `context`. Filled by **promotion** — learn proposes moving a durable lesson here via PR. |
| **.aidakit/memory/** | The operational funnel: `learnings.md`, one line per lesson, read at the start of the next build. Durable entries get promoted up into `docs/knowledge/`. |

---

## 7 · How to use it

1. **Install in any repo** (see the [README](../README.md)).
2. **New project → design first.** Run `/aidakit:flow-design` and answer the 4-phase interview. It writes `docs/design/` + ADRs and, at phase 4, emits the change backlog as roadmap epics.
3. **New feature on an existing project → describe it.** Run `aidakit:roadmap from "<description>"` — it interviews you and generates the epic → features → changes.
4. **Existing repo → adopt the structure.** Run `/aidakit:docs` (init) to deploy the canonical `docs/` tree without steamrolling what's there.
5. **Execute a change.** Run `/aidakit:flow-fast` (or `/aidakit:flow-full` for architectural work) — it picks the next ready change (roadmap gives the order) and drives the cycle. You approve the gates; the kit stops at the PR URL.
6. **You merge.** Then `aidakit:docs` archives the change (it flips to *done* on the roadmap on its own) and `aidakit:learn` proposes any DNA or knowledge to promote.
7. **Check status anytime.** `aidakit:roadmap` for Now/Next/Later, `/aidakit:catalog` to find a tool, `/aidakit:governance` when a command was blocked and you want to know why.

**Configure per project** via `aidakit.config.yaml`: the content `language`, the `domains.by-path` map, and the `review.matrix` (which reviewers each flag summons). Absent → sensible defaults, English.

---

*aidakit v0.4 · Claude Code plugin · the truth is the disk*
