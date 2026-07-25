# Evidence — review-usage-bench-manifest

**Change ID:** `review-usage-bench-manifest`
**Date:** `2026-07-25`
**Owner:** `@chacal88`
**Phase / Package:** `n/a (doc-only surface fix on the review command + skill)`
**PRD:** `n/a`
**Tech Spec:** `n/a`

> **STUB authored during planning.** Every section below is filled during implementation with real command output — never with a summary of what was intended. The single pre-implementation entry is the plan-time probe recorded below, which is the empirical basis for [design.md](design.md) §2 and must be **re-run against the edited `SKILL.md`** at [tasks.md](tasks.md) §6 (the probe below used the plan's draft of the snippet, not the shipped one).

## Plan-time probe (2026-07-25, pre-implementation)

Run in a scratch dir with `AIDAKIT_PROJECT_ROOT` pointed at it, to verify the example's invocation form before writing it into the skill.

- **The ESM-from-Bash form works.** `node --input-type=module -e "import { recordBenchManifest } from '<gov>/ledgers/ledger.js'; …"` appended
  `{"at":"…","type":"bench-manifest","role":"__manifest__","bench":"review","round":1,"roles":["adr","spec"]}` to `.aidakit/tasks/<probe>/bench.ndjson`.
- **The naive attempt FAILS the leash.** With `dispatched_at` values fabricated *earlier* than the manifest write, `check-bench.js … --bench review --outcome consensus` returned exit 1 with `{"rule":"manifest-not-first", …}` — despite both roles reporting and the mechanical consensus matching. This is the non-obvious half of the requirement and is why the example carries the invariant explicitly.
- **Correct ordering passes.** Manifest first, `dispatched_at` after it → `{"validator":"aidakit.check-bench","ok":true,"roles_expected":["adr","spec"],"roles_reported":["adr","spec"],"mechanical_consensus":"pass","errors":[]}`, exit 0.

## Validation Outputs

_(populated during implementation — one entry per [tasks.md](tasks.md) §6 bullet, with the exact command, the exit code, and the output verbatim)_

- [ ] Baselines (§1): `check-links` / `check-plugin-version` before the edits.
- [ ] Step-5 example executed verbatim from the edited `skills/review/SKILL.md` → `check-bench.js … --outcome consensus` exit 0.
- [ ] Negative case reproduced (`manifest-not-first`), if run.
- [ ] `node governance/validators/check-links.js .` → exit code + JSON.
- [ ] `node governance/validators/check-links.js docs/features/review-usage-bench-manifest` → exit code + JSON.
- [ ] `node governance/validators/derive-roadmap-status.js --root .` → the two expected derivations (`review-usage-bench-manifest` in-progress, `review-bench-manifest-mechanical-writer` backlog).
- [ ] `node governance/validators/check-plugin-version.js .` → exit code + JSON, with the bumped manifest version named.
- [ ] `git diff --stat` proving zero paths under `governance/` and `docs/decisions/`.
- [ ] Governance suite (`governance/__tests__/*.test.mjs`) → per-suite pass/fail counts.

## Files Touched

_(populated during implementation — the exact list, created vs. modified)_

**Expected (from [design.md](design.md); correct against reality, do not copy blindly)**
- `commands/review.md` (modified)
- `skills/review/SKILL.md` (modified)
- `docs/roadmap/epics/EPIC-kit-discipline-hardening.md` (modified)
- `docs/roadmap/ROADMAP.md` (regenerated)
- `.claude-plugin/plugin.json` (version bump)
- `docs/features/review-usage-bench-manifest/{proposal,design,tasks,evidence}.md` (this package)

## Unresolved Deviations

_(populated during implementation. Write **"none"** explicitly if there are none — an empty section is not an answer. Any divergence from [design.md](design.md) §3-§6 is recorded here with its reason, including anchor drift found at [tasks.md](tasks.md) §1 and any wording tightened away from the design's literal text.)_
