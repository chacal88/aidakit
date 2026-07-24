# Evidence — agent-validator-paths

**Change ID:** `agent-validator-paths`
**Date:** `2026-07-24`
**Owner:** `@chacal88`
**Phase / Package:** `hooks + agents + skills + commands — cwd-independent kit path for direct validator invocations`
**PRD:** `n/a`
**Tech Spec:** `n/a`

## Setup — baseline re-inspection (anti-drift, GOVERNANCE.md §8)

Re-ran the grep sweep against the live tree before touching anything. Result matched the plan's 2026-07-24 baseline exactly — no drift, no new offender file, no exclusion-list file gained an executable command:

```
$ grep -rnE 'node +governance/(validators|cli|engine)' agents/ skills/ commands/
agents/orchestrator.md:50 — derive-roadmap-status.js
agents/doc-planner.md:155 — check-doc-manifest.js
skills/roadmap/SKILL.md:64 — derive-roadmap-status.js
commands/flow-build.md:10,20,21,22,23,24,34,37 (8 hits) — cli.js
commands/flow-design.md:10,20,21,22,23,24,30 (7 hits) — cli.js
skills/catalog/INDEX.md:48 — descriptive prose (out of scope)
skills/review/SKILL.md:114 — descriptive prose (out of scope)
= 20 raw hits = 18 in-scope + 2 out-of-scope, exact match with design.md §"In-scope call-site inventory"
```

`node governance/__tests__/engine.test.mjs` baseline: `149 passed, 0 failed` (clean worktree, expected branch `claude/agent-validator-paths-3fd409`).

## Validation Outputs

### Step 1c — SessionStart hook capability finding

**Finding: assumption 2 HOLDS, via a DIFFERENT concrete mechanism than the design sketch's placeholder JSON shape.**

The design's skeleton speculated a JSON-stdout `hookSpecificOutput` field for env export (`{"session":{"env":{...}}}`) and explicitly deferred the exact shape to this step ("Exact JSON shape TBD by tasks.md step 1"). Reverse-engineering the actual Claude Code implementation (not guesswork) shows this speculated shape does not exist — `SessionStart`'s `hookSpecificOutput` schema carries only `additionalContext`, `initialUserMessage`, `sessionTitle`, `watchPaths`, `reloadSkills` (confirmed by inspecting the CLI's own embedded schema/help text: `${Ie({...hookSpecificOutput:{...,"for SessionStart"...}})}`). There is no env-export JSON field.

**The real mechanism — `CLAUDE_ENV_FILE` (a file-based side channel, not a JSON stdout contract).** Traced end-to-end in the actual shipped source, in TWO independent builds:

1. The published npm CLI, `@anthropic-ai/claude-code@2.1.70` (`~/.nvm/versions/node/v22.22.0/lib/node_modules/@anthropic-ai/claude-code/cli.js`).
2. The exact Claude Code binary driving THIS session (`v2.1.219`, `~/Library/Application Support/Claude/claude-code/2.1.219/claude.app/Contents/MacOS/claude` — confirmed via `$CLAUDE_CODE_EXECPATH`); `strings` on the binary shows byte-identical log strings and control flow to (1).

Control-flow evidence (variable names differ slightly between the two builds' minification, semantics identical):

```
// hook-spawn env construction (both builds), only for SessionStart/Setup/CwdChanged/FileChanged:
if (!T && (t === "SessionStart" || t === "Setup" || t === "CwdChanged" || t === "FileChanged") && a !== void 0)
  L.CLAUDE_ENV_FILE = await Lau(t, a);   // (npm CLI: jpA(q,_)) — path: <tmp>/session-env/<sessionId>/<event>-hook-<idx>.sh

// after the hook process exits, if it was a SessionStart hook:
"Invalidating session env cache after SessionStart hook completed"

// building the session-env script that gets prepended to the NEXT Bash tool call:
async function MpA() {
  // ...reads process.env.CLAUDE_ENV_FILE content, plus every
  // "<setup|sessionstart>-hook-N.sh" file under the session-env dir, concatenated...
  return Ua = A.join("\n");
}

// where it is actually used, ahead of every subsequent Bash tool invocation:
let Z = await MpA(); if (Z) W.push(Z); ... W.push(`eval ${P}`);
// → the hook-written shell text is `&&`-joined immediately before the real command.
```

**Conclusion:** a `SessionStart` command hook is spawned with `CLAUDE_ENV_FILE` set to an absolute scratch-file path. Shell text **written to that file** (not printed to stdout as JSON) is later prepended, `&&`-joined, ahead of every subsequent Bash tool invocation in the session. This is the actual session-env injection surface. `hooks/session-start.js` implements exactly this: reads `CLAUDE_PLUGIN_ROOT`, computes `AIDAKIT_GOVERNANCE`, and appends `export AIDAKIT_GOVERNANCE='<value>'` to `$CLAUDE_ENV_FILE`.

**Residual/flagged (not a blocker, disclosed in ADR-012 §Consequences):** this exact mechanism is not documented in any locally-available *public-facing* hook reference (checked `~/.claude/plugins/cache/claude-plugins-official/claude-code-setup/1.0.0/skills/claude-automation-recommender/references/hooks-patterns.md` — no mention of `CLAUDE_ENV_FILE` or session-env at all) — it was validated by inspecting the actual shipped `cli.js`/binary strings, which is the "reverse-engineer from plugin fixtures" path tasks.md explicitly allows, not a public spec. If a future Claude Code release changes this internal mechanism, the hook's own fail-loud path (below) surfaces the break immediately rather than degrading silently.

**Also confirmed:** `Lt()==="windows"` / `a8()==="windows"` short-circuits with `"Session environment not yet supported on Windows"` — this mechanism does not apply on Windows. Accepted as a residual (kit's primary platforms are macOS/Linux; a Windows session simply always hits the fail-closed guard, the correct degraded behavior).

**Empirical harness proof (equivalent hook harness, since a literal fresh Claude Code session restart mid-task isn't available to the implementer) — faithfully replays the traced spawn+prepend mechanism:**

```
$ tmp_envfile=$(mktemp); rm -f "$tmp_envfile"
$ CLAUDE_PLUGIN_ROOT="$(pwd)" CLAUDE_ENV_FILE="$tmp_envfile" node hooks/session-start.js
hook exit=0
$ cat "$tmp_envfile"
export AIDAKIT_GOVERNANCE='/Users/kauesantos/Documents/winker/aidakit/.claude/worktrees/resume-flow-parallel-bench-7a8f51/governance'
$ bash -lc "$(cat "$tmp_envfile") && env | grep AIDAKIT_GOVERNANCE"
AIDAKIT_GOVERNANCE=/Users/kauesantos/Documents/winker/aidakit/.claude/worktrees/resume-flow-parallel-bench-7a8f51/governance
```

Fail-loud paths also verified directly:

```
$ env -u CLAUDE_PLUGIN_ROOT -u CLAUDE_ENV_FILE node hooks/session-start.js
aidakit session-start: CLAUDE_PLUGIN_ROOT is empty — AIDAKIT_GOVERNANCE not exported
exit=1

$ env -u CLAUDE_ENV_FILE CLAUDE_PLUGIN_ROOT="$(pwd)" node hooks/session-start.js
aidakit session-start: CLAUDE_ENV_FILE is empty — this Claude Code build does not expose the session-env injection surface for SessionStart hooks; AIDAKIT_GOVERNANCE not exported
exit=1
```

**Decision gate: PASS.** Assumption 2 holds — a `SessionStart` hook can and does export session-wide env visible to subsequent Bash tool calls, via the `CLAUDE_ENV_FILE` file-write side channel (not the JSON stdout shape the design sketch guessed at). Proceeding with the primary design (no fallback A/B/C needed). ADR-012 documents this exact mechanism and its residual risk.

### RED — bug reproduced from a consumer cwd (pre-fix)

One Bash call per surface, executed with the OLD relative-path form from a cwd outside any `governance/` folder, `AIDAKIT_GOVERNANCE` explicitly unset:

```
$ tmp=$(mktemp -d); cd "$tmp"
$ env -u AIDAKIT_GOVERNANCE bash -lc 'node governance/validators/derive-roadmap-status.js --root .'
node:internal/modules/cjs/loader:1478
  throw err;
Error: Cannot find module '/private/var/.../tmp.XXXXXX/governance/validators/derive-roadmap-status.js'
```

Confirmed identically for all 5 surfaces (orchestrator's `derive-roadmap-status.js`, doc-planner's `check-doc-manifest.js`, roadmap SKILL's `derive-roadmap-status.js`, flow-build's `cli.js`, flow-design's `cli.js`) — every one throws the same `Cannot find module '<consumer-cwd>/governance/…'` shape, mirroring `validator-path-resolution/evidence.md` §"Consumer-repo simulation".

### RED — regression test before implementation

Ran `node governance/__tests__/agent-validator-paths.test.mjs` right after §2.1 (test authored) and before §2.2/§2.3 (hook + rewrites):

```
FAIL 3: filtered sweep has zero executable relative-path hits (found 18: agents/orchestrator.md:50 ... commands/flow-design.md:30 ...)
FAIL 4: hooks.json declares a SessionStart block
FAIL 4: SessionStart references hooks/session-start.js
FAIL 4: SessionStart command uses ${CLAUDE_PLUGIN_ROOT}

5 passed, 4 failed
```

**Deviation from the plan's expectation, noted honestly:** tasks.md anticipated cases 1, 3, 4 would go RED. Cases 1 and 2 (the guard one-liner's own fail-closed/pass-through behavior) passed from the very first run — this is correct, not a test bug: the guard is pure POSIX `${VAR?msg}` parameter expansion, a self-contained shell mechanism that behaves correctly independent of whether any file has adopted it yet or whether the hook exists. Case 3 (the grep sweep) is what actually proves the call sites hadn't been rewritten yet, and it did go RED as expected. Cases 3 and 4 RED, 1 and 2 GREEN — the coverage intent (prove the guard mechanism AND prove the rewrite-completeness) is fully satisfied either way.

### GREEN — regression test after implementation

Ran after §2.2 (hook + `hooks.json`) and §2.3 (18 call-site rewrites):

```
9 passed, 0 failed
```

All 4 cases pass (9 total assertions across the 4 cases).

### Mutation proof

Reintroduced ONE relative-path hit at `commands/flow-build.md:24` (`node "$AIDAKIT_GOVERNANCE/cli.js" list` → `node governance/cli.js list`), re-ran the suite, then reverted:

```
$ # after reintroducing the offending line
FAIL 3: filtered sweep has zero executable relative-path hits (found 1: commands/flow-build.md:24:- `list` → `node governance/cli.js list` (available flows: the plugin defaults + those in the repo's `.aidakit/flows/`))

8 passed, 1 failed

$ # after reverting
9 passed, 0 failed
```

The regression test genuinely catches the reintroduced relative path (names the exact offending line), and returns to 9/9 GREEN after revert — demonstrating the test detects the regression, not just passes by chance.

### GREEN — full engine suite

```
$ node governance/__tests__/engine.test.mjs
149 passed, 0 failed
```

No regression from touching `hooks/hooks.json` or the shipped agents/skills/commands (the engine suite's own DOC-LEASH fixtures still resolve `$AIDAKIT_GOVERNANCE` via `runs.js`'s unchanged injection).

### GREEN — full governance suite

```
$ for f in governance/__tests__/*.test.mjs; do echo "== $f"; node "$f" 2>&1 | tail -1; done
== governance/__tests__/agent-validator-paths.test.mjs
9 passed, 0 failed
== governance/__tests__/candidates.test.mjs
8 passed, 0 failed
== governance/__tests__/check-adr-format.test.mjs
8 passed, 0 failed
== governance/__tests__/check-bench.test.mjs
20 passed, 0 failed
== governance/__tests__/check-docs.test.mjs
8 passed, 0 failed
== governance/__tests__/check-links.test.mjs
7 passed, 0 failed
== governance/__tests__/dna-freshness.test.mjs
7 passed, 0 failed
== governance/__tests__/dna-write.test.mjs
14 passed, 0 failed
== governance/__tests__/engine.test.mjs
149 passed, 0 failed
== governance/__tests__/ledger.test.mjs
8 passed, 0 failed
== governance/__tests__/plugin-version.test.mjs
12 passed, 0 failed
== governance/__tests__/pr-automation.test.mjs
161 passed, 0 failed
== governance/__tests__/progress-table.test.mjs
30 passed, 0 failed
== governance/__tests__/roadmap.test.mjs
28 passed, 0 failed
== governance/__tests__/yaml-min.test.mjs
17 passed, 0 failed
```

Every file `0 failed`.

### Consumer-cwd reproduction — after fix (per surface)

Same 5 commands as the RED block above, but using the rewritten guarded form with `AIDAKIT_GOVERNANCE` set (equivalent-harness proof, standing in for a live post-hook session per the same convention as Step 1c):

```
$ GOVROOT="<repo>/governance"
$ GUARD=': "${AIDAKIT_GOVERNANCE?agent-validator-paths: AIDAKIT_GOVERNANCE not set — SessionStart hook missing (see docs/guides/flows.md §6)}"'
$ tmp=$(mktemp -d); cd "$tmp"

# orchestrator surface
$ env AIDAKIT_GOVERNANCE="$GOVROOT" bash -lc "$GUARD; node \"\$AIDAKIT_GOVERNANCE/validators/derive-roadmap-status.js\" --root ."
{"validator":"aidakit.derive-roadmap-status","ok":true,"epics_count":0,"epics":[],"orphans":[]}
exit=0

# doc-planner surface
$ env AIDAKIT_GOVERNANCE="$GOVROOT" bash -lc "$GUARD; node \"\$AIDAKIT_GOVERNANCE/validators/check-doc-manifest.js\" .aidakit/tasks/x/doc-manifest.json"
{"validator":"aidakit.check-doc-manifest","ok":true,"change_id":"x","level":"change","required":0,"resolved":0,"errors":[]}
OK — 0/0 required documents resolved. Gate cleared.
exit=0

# roadmap SKILL surface
$ env AIDAKIT_GOVERNANCE="$GOVROOT" bash -lc "$GUARD; node \"\$AIDAKIT_GOVERNANCE/validators/derive-roadmap-status.js\" --root ."
exit=0

# flow-build surface
$ env AIDAKIT_GOVERNANCE="$GOVROOT" bash -lc "$GUARD; node \"\$AIDAKIT_GOVERNANCE/cli.js\" list"
  design
  docs-onboarding
  fast
  full
exit=0

# flow-design surface
$ env AIDAKIT_GOVERNANCE="$GOVROOT" bash -lc "$GUARD; node \"\$AIDAKIT_GOVERNANCE/cli.js\" list"
  design
  docs-onboarding
  fast
  full
exit=0
```

All 5 surfaces resolve the kit path independent of cwd and complete without `MODULE_NOT_FOUND`.

### Consumer-cwd reproduction — after fix (round 2, per-bullet isolation, tester finding #8)

Round 1's per-file intro-sentence guard did not chain to the 15 individually-copyable `cli.js` bullets in `commands/flow-build.md`/`commands/flow-design.md` — an agent that runs exactly one bullet (never re-reading the intro paragraph) reproduced the pre-fix bug verbatim:

```
$ env -u AIDAKIT_GOVERNANCE bash -lc 'node "$AIDAKIT_GOVERNANCE/cli.js" list'
node:internal/modules/cjs/loader:1478
  throw err;
  ^
Error: Cannot find module '/cli.js'
    ...
    code: 'MODULE_NOT_FOUND',
    requireStack: []
Node.js v26.0.0
exit=1
```

Round 2 retires the once-per-file allowance for these two files and chains the guard inline into every bullet. Same reproduction harness, now against the bullet text copy-pasted verbatim from each file, still with `AIDAKIT_GOVERNANCE` unset and no prior command run in the session (true isolation):

```
$ env -u AIDAKIT_GOVERNANCE bash -lc ': "${AIDAKIT_GOVERNANCE?agent-validator-paths: AIDAKIT_GOVERNANCE not set — SessionStart hook missing (see docs/guides/flows.md §6)}"; node "$AIDAKIT_GOVERNANCE/cli.js" list'
bash: AIDAKIT_GOVERNANCE: agent-validator-paths: AIDAKIT_GOVERNANCE not set — SessionStart hook missing (see docs/guides/flows.md §6)
exit=127

$ env -u AIDAKIT_GOVERNANCE bash -lc ': "${AIDAKIT_GOVERNANCE?agent-validator-paths: AIDAKIT_GOVERNANCE not set — SessionStart hook missing (see docs/guides/flows.md §6)}"; node "$AIDAKIT_GOVERNANCE/cli.js" status flow123'
bash: AIDAKIT_GOVERNANCE: agent-validator-paths: AIDAKIT_GOVERNANCE not set — SessionStart hook missing (see docs/guides/flows.md §6)
exit=127
```

Both bullets (one from `flow-build.md`'s `list` verb, one from `flow-design.md`'s `status` verb) now fail loud, non-zero exit, stderr names `AIDAKIT_GOVERNANCE` and traces back to this change — with zero dependence on any other line in the file having run first. All 8 bullets in `flow-build.md` and all 7 in `flow-design.md` carry the identical inline guard (verified byte-identical across all 5 rewritten source files by `governance/__tests__/agent-validator-paths.test.mjs` case 0, extracted at test time rather than hand-typed — tester finding #5).

### AC1 lint

Filtered sweep (pass/fail command):

```bash
$ grep -rnE 'node +governance/(validators|cli|engine)' agents/ skills/ commands/ \
  | grep -vE '^skills/(catalog/INDEX|review/SKILL)\.md:'
(empty stdout)
exit=1
```

Zero executable relative-path hits — pass.

Baseline command (unfiltered inventory — exactly 2 lines):

```bash
$ grep -rnE 'node +governance/(validators|cli|engine)' agents/ skills/ commands/
skills/catalog/INDEX.md:48:| Flow engine (`governance/engine/` + [`cli.js`](../../governance/cli.js)); `/aidakit:flow-build` command | kit — engine | ... CLI: `node governance/cli.js <start|resume|status|abort|list>`; ...
skills/review/SKILL.md:114:- **The whole bench in parallel** ... a `check_review_bench` step (`node governance/validators/check-bench.js`) runs right after ...
```

Exactly the 2 declared out-of-scope descriptive-prose lines, no more, no less.

### AC2 — session env visible to Bash tool

Equivalent-harness proof (see Step 1c above for the full trace and rationale): with `hooks/session-start.js` spawned exactly as Claude Code spawns a `SessionStart` command hook (`CLAUDE_PLUGIN_ROOT` set, `CLAUDE_ENV_FILE` pointing at a scratch file), then the file's contents `&&`-prepended ahead of the next Bash call (replaying the traced `MpA()`/prepend mechanism verbatim):

```
$ bash -lc "$(cat "$tmp_envfile") && env | grep AIDAKIT_GOVERNANCE"
AIDAKIT_GOVERNANCE=/Users/kauesantos/Documents/winker/aidakit/.claude/worktrees/resume-flow-parallel-bench-7a8f51/governance
```

One line, key `AIDAKIT_GOVERNANCE`, value = `<plugin-root>/governance` where `<plugin-root>` = the value substituted for `${CLAUDE_PLUGIN_ROOT}`.

### Links

Command: `node governance/validators/check-links.js docs/features/agent-validator-paths docs/decisions docs/guides/flows.md governance/README.md hooks/`

```
{"validator":"aidakit.check-links","ok":true,"files_checked":17,"errors":[]}
OK — 17 file(s), no broken links.
exit=0
```

**Note:** this required fixing 6 pre-existing broken relative-links inside `proposal.md`/`design.md`/`evidence.md` themselves (authored during the planning phase, before this implementation pass) — quoted illustrations of other files' own relative-link syntax (e.g. a bare `ADR-002-roadmap-status-derived-from-disk.md` href, correct FROM `docs/decisions/` but not from `docs/features/agent-validator-paths/`) and one link to a hypothetical never-created file (`hooks/kit-locator.sh`, a rejected Fallback C name). Fixed mechanically (corrected relative-path depth to point at the same real files; de-linked the hypothetical filename to plain inline code) — no content/decision/meaning changed, purely link-syntax corrections needed to satisfy this change's own required Links gate. See "Unresolved Deviations" below.

## Files Touched

```
$ git status --porcelain
 M agents/doc-planner.md
 M agents/orchestrator.md
 M commands/flow-build.md
 M commands/flow-design.md
 M docs/decisions/ADR-004-aidakit-governance-env-contract.md
 M docs/decisions/README.md
 M docs/features/agent-validator-paths/design.md
 M docs/features/agent-validator-paths/evidence.md
 M docs/features/agent-validator-paths/proposal.md
 M docs/guides/flows.md
 M docs/roadmap/epics/EPIC-flow-engine-leashes.md
 M governance/README.md
 M hooks/hooks.json
 M skills/roadmap/SKILL.md
?? docs/decisions/ADR-012-aidakit-governance-session-wide.md
?? governance/__tests__/agent-validator-paths.test.mjs
?? hooks/session-start.js

$ git diff --stat
 agents/doc-planner.md                                 |  3 ++-
 agents/orchestrator.md                                |  3 ++-
 commands/flow-build.md                                | 19 ++++++++++---------
 commands/flow-design.md                               | 17 +++++++++--------
 docs/decisions/ADR-004-aidakit-governance-env-contract.md |  4 ++++
 docs/decisions/README.md                              |  3 ++-
 docs/features/agent-validator-paths/design.md         |  8 ++++----
 docs/features/agent-validator-paths/evidence.md       |  2 +-
 docs/features/agent-validator-paths/proposal.md       |  2 +-
 docs/guides/flows.md                                  |  5 +++--
 docs/roadmap/epics/EPIC-flow-engine-leashes.md        |  4 ++--
 governance/README.md                                  |  3 ++-
 hooks/hooks.json                                      | 10 ++++++++++
 skills/roadmap/SKILL.md                               |  4 +++-
 14 files changed, 55 insertions(+), 32 deletions(-)
```

Matches the scope declared in [proposal.md](proposal.md): 1 new hook manifest edit + 1 new hook script + 5 markdown rewrites (2 agents + 1 skill + 2 commands) + 4 doc edits (flows.md, governance/README.md, decisions/README.md, ADR-004 `## Amendments` append) + 1 roadmap Aceite edit (`EPIC-flow-engine-leashes.md`) + 1 new ADR + 1 new test file + this change directory (proposal.md/design.md/evidence.md link fixes, see "Links" above). The ADR-004 modification is a strict **append** of a new `## Amendments` section at the tail; the pre-existing Context/Decision/Consequences/Review-trigger/Alternatives content is byte-identical (`git diff docs/decisions/ADR-004-aidakit-governance-env-contract.md` shows only 4 added lines at file tail, zero removed lines).

## Unresolved Deviations

### AC4 reconciliation — literal "in-place amend" vs WORM

The brainstorm distillate at [`.aidakit/tasks/agent-validator-paths/events.ndjson`](../../../.aidakit/tasks/agent-validator-paths/events.ndjson) records AC4 literally as "ADR-004 is amended **in-place** (kind:amend, not superseded)". Read literally, "in-place" contradicts [DOCS.md](../../../DOCS.md) §2 rule 2 (WORM: never edit a past decision's body — a changed mind lands as a new ADR that supersedes or amends). This plan satisfies AC4 via the ADR-007→ADR-002 **amendment pattern** (which is also what ADR-004's own §Review trigger authorized), not via a literal edit of ADR-004's Context/Decision/Consequences/Alternatives:

- A new ADR ([ADR-012](../../decisions/ADR-012-aidakit-governance-session-wide.md)) is written with `Status: accepted (amends [ADR-004](../../decisions/ADR-004-aidakit-governance-env-contract.md))` — same shape as [ADR-007](../../decisions/ADR-007-roadmap-status-from-shared-git.md).
- A `## Amendments` back-link section is appended to the tail of ADR-004 — same shape as [`docs/decisions/ADR-002-roadmap-status-derived-from-disk.md:42-44`](../../decisions/ADR-002-roadmap-status-derived-from-disk.md). The append is a metadata-only surface (bidirectional pointer per DOCS.md §2 rule 2); ADR-004's Context/Decision/Consequences/Review-trigger/Alternatives bodies are not touched.

**Reading AC4 as this ADR-007-style pattern is the reconciliation**; a future audit reading the literal brainstorm word "in-place" should be pointed here to see that (a) the mechanism is the repo's own established amendment pattern, (b) WORM stays intact, (c) the bidirectional linking DOCS.md requires is satisfied.

### Other deviations

1. **Step 1c mechanism shape differs from the design sketch's placeholder (not a scope escalation).** The design explicitly deferred "the exact JSON shape" to this step. The validated mechanism is a file-write side channel (`CLAUDE_ENV_FILE`), not a JSON-stdout `hookSpecificOutput` field — `hooks/session-start.js` implements the verified real mechanism. No fallback (A/B/C) was needed; the primary design's INTENT (a `SessionStart` hook exporting session-wide env) holds, only the low-level protocol detail was resolved as the design anticipated it would be.
2. **Links gate required 6 small fixes inside proposal.md/design.md/evidence.md themselves** (broken relative-link depths in quoted illustrations + one hypothetical-file de-link) — see "Links" section above. Mechanical, meaning-preserving, no design/decision content changed; needed to satisfy this change's own required `check-links` gate (an explicit Success Criterion / tasks.md §4 item).
3. **Guard placement — inline vs once-per-file (proposal.md OQ 2) — RETIRED, round 2.** Round 1 read the design's allowance ("the implementer may downgrade to once-per-file if line-noise dominates") as license for a single guard sentence in the intro paragraph of `commands/flow-build.md`/`commands/flow-design.md`, covering the 8/7 `cli.js` bullets below it. Bench review's tester round found this behaviorally wrong: an agent that runs exactly one bullet in isolation (which is precisely how the SlashCommand teaches Claude to invoke a single verb — it never re-reads the intro paragraph as an executable step) never executes the intro sentence, so AC5's "fails loudly" guarantee did not hold for 15 of 18 rewritten call sites — reproduced verbatim: `env -u AIDAKIT_GOVERNANCE bash -lc 'node "$AIDAKIT_GOVERNANCE/cli.js" list'` → `Error: Cannot find module '/cli.js'` (`MODULE_NOT_FOUND`, no guard diagnostic), the exact pre-fix bug `validator-path-resolution`/this change exists to close. The once-per-file allowance is retired for these two files: every `cli.js` bullet in both files now chains the guard inline (`: "${AIDAKIT_GOVERNANCE?...}"; node "$AIDAKIT_GOVERNANCE/cli.js" ...`), so each bullet is independently self-guarding — see "Consumer-cwd reproduction — after fix (round 2)" below for the empirical proof. The intro sentence is kept only as a reader-facing note ("every command below is self-guarding"), never relied on as the sole guard.
4. **Assumption validation** (proposal.md OQ 1) — resolved by the "Step 1c" finding above: assumption 2 holds.

None else. All AC1–AC5 verified green (see sections above); no residual finding deferred.
