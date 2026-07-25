<!-- File: docs/decisions/ADR-016-runtime-change-requires-plugin-bump.md — global sequential numbering, never recycled. Registered in the index docs/decisions/README.md. -->
<!-- An ADR is WORM: never edit a past decision. Changed your mind → a new ADR that supersedes or amends this one. -->

# ADR-016: A PR that changes installed runtime must bump `plugin.json`, enforced per-PR by the repo's first CI workflow

- **Status:** accepted
- **Date:** 2026-07-25

## Context

`claude plugin update` compares exactly one number: `version` in `.claude-plugin/plugin.json`. If a commit range changes what an installed session actually executes — `hooks/pre-bash.js`, anything under `governance/` — but leaves that number untouched, the update answers *"already at the latest"* and copies **nothing**. [PROCESS.md](../../PROCESS.md) §5 already documents this failure mode, and `check-plugin-version.js` already guards one edge of it: the manifest may never sit **behind** the highest doctrine footer.

On 2026-07-25 the other edge fired. Three live commands were blocked by a governance hook that main had already fixed: the round-6 parser fix (#48) landed on 2026-07-24, but `plugin.json` stayed at `0.9.0` until the next morning — so every `claude plugin update` in between was a no-op and installed sessions kept running a stale snapshot of the hook (post-mortem in PR #59). `check-plugin-version` could not catch this: the offending commits changed **code**, not doctrine footers, so manifest ≥ footers held throughout. The gap is a *range* property — "did runtime change between this PR's base and its head, and did the manifest rise in that same range?" — which no point-in-time scan can answer.

Two placement facts constrain where the leash can live:

1. **The incident class does not go through flows.** #34 and #48 were shipped directly from worktree sessions via branch + PR — exactly as GOVERNANCE.md §2 prescribes — so a gate step in `fast.yaml`/`full.yaml` would have caught neither. PROCESS.md §5 additionally notes that flows run inside *target* repos, where a plugin-release check is meaningless.
2. **This repository has no CI.** Today nothing runs on a PR mechanically; "the PR is the safety net" (GOVERNANCE.md §1) has meant the human reader alone. GOVERNANCE.md §4 requires a structural addition to be registered in an ADR — this document is that registration for the first `.github/workflows/` entry.

## Decision

**1. A sibling validator, `governance/validators/check-runtime-bump.js`, owns the range property.** Given a root and a base ref, it diffs the merge-base of `<base>...HEAD` against the **working tree** (committed, staged, unstaged and untracked in one read) and fails — exit 1, same 0/1/2 + JSON/stderr contract as every validator — when any **runtime** file changed while the manifest version did not rise inside the same range. Runtime = paths under `hooks/` or `governance/`, excluding any `__tests__/` segment and `*.md`: tests and prose never reach an installed session, code and flow/hook wiring do. Deletions count (a removed runtime file changes what ships); introducing the manifest inside the range counts as the strongest possible bump; a version *decrease* never counts.

**2. The base ref is the trusted one, resolved by the single owner.** The validator imports `resolveBaseRef` from [governance/pr/pr-config.js](../../governance/pr/pr-config.js) — the same `AIDAKIT_BASE_REF → origin/HEAD → local main/master` chain that ADR-008's merge carve-out trusts — rather than growing a second copy of base-ref resolution ("cut, don't copy"). An explicit `--base <ref>` flag exists for callers that already know the PR base (CI does).

**3. The repo gains its first CI workflow, `.github/workflows/pr-checks.yml`, running both version leashes on every PR to `main`.** `check-runtime-bump` with `--base origin/${GITHUB_BASE_REF}` (the range leash, this ADR) and `check-plugin-version` (the footer leash, PROCESS.md §5). A `pull_request` checkout is the merge ref, so the range checked is exactly what would land. This is the only placement that covers the incident class: flow-shipped PRs, worktree-session PRs and human PRs all pass through it, and the `aidakit:merge` skill already refuses to merge while a status check is failing or pending — so the leash composes with ADR-008's autonomous merge without a new flow step.

**4. No gate step is added to `fast.yaml`/`full.yaml`.** PROCESS.md §5's reasoning stands: flows run in target repos, where the validator exits 2 (usage) by design — a repo with no `.claude-plugin/plugin.json` at either end of the range is not a plugin repository, and a target repo's own `hooks/` directory must never trip a kit-release leash.

## Consequences

- **Positive:** the 2026-07-25 class is now mechanically impossible to merge quietly — a PR touching `hooks/` or `governance/` code goes red until `plugin.json` rises in the same PR, and the red arrives at review time instead of days later in an operator's stale session. The two leashes now cover both edges: footers can't outrun the manifest (`check-plugin-version`), and runtime can't ship under an unchanged manifest (`check-runtime-bump`). Working-tree semantics mean the same command catches the miss *before* the commit when run locally.
- **Negative (accepted):** every runtime PR must now carry a version bump, including trivial one-line fixes; concurrent runtime PRs will each bump and occasionally collide on the version line. The merge conflict is the feature — two runtime changes landing together is exactly when one release number must be chosen consciously.
- **Negative (accepted):** the kit takes its first dependency on GitHub Actions (`actions/checkout`, `actions/setup-node`). It is scoped to this repository's own PRs — nothing in the installed plugin, the flows, or target repos depends on it.
- **Negative (mitigated):** without branch protection the check cannot *hard-block* a `gh pr merge` typed by a human. Mitigated at the autonomous edge — `aidakit:merge` reads `statusCheckRollup` and refuses on failing/pending — and left advisory at the human edge, consistent with GOVERNANCE.md §1 (the human is the final gate). Enabling branch protection to make it required is a host-settings decision outside this repo's files.
- **Negative (mitigated):** the leash cannot force the *right size* of bump, only that one exists; a patch bump under a doctrine-worthy change is still possible. Mitigated by `check-plugin-version` in the same workflow: the moment a footer declares a higher doctrine version, patch-level manifests go red.

## Alternatives considered

- **Gate step in `fast.yaml`/`full.yaml`.** Rejected: would have missed the actual incident (#34/#48 never entered a flow), fires `exit 2` in every target repo without a guard, and duplicates what the CI check already gives flow PRs via `aidakit:merge`'s status-check reading.
- **Carve-in inside `hooks/pre-bash.js`** (block `git push`/`gh pr create` when the range misses a bump). Rejected: the hook runs from the **installed plugin cache** — the very artifact this incident proved can be stale — so the enforcement point would depend on the failure it polices; it also adds a git-range computation to every intercepted command.
- **Extending `check-plugin-version.js` with a range mode.** Rejected: the two checks share a topic but nothing else — different inputs (filesystem scan vs git range), different failure statements, different call sites (release step vs PR). One validator per leash keeps both contracts trivially testable; the shared piece that *does* exist (trusted base resolution) is imported from its single owner instead.
- **Auto-bumping the version instead of failing.** Rejected: a leash that edits the release number hides the release decision — PROCESS.md §5 makes the bump a conscious step with a size judgment (patch vs minor), and self-healing here would be a silent release policy.

<!-- aidakit v0.9 — ADR-016: runtime-change ⇒ plugin bump, per-PR via first CI workflow, 2026-07-25 -->
