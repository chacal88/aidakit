// Tests configurable-pr-automation: the single-source config reader
// (governance/pr/pr-config.js), its CLI wrapper (check-pr-automation.js),
// the merge_route/auto_merge tail rewiring in BOTH flows (full/fast), and the
// hooks/pre-bash.js gh-pr-merge carve-out. Pure Node, no framework — mirrors
// governance/__tests__/engine.test.mjs.
//
// ROUND 2 (post-review fixes): pr.auto_merge is read from the repo's TRUSTED
// BASE BRANCH via git — never the working tree (Fix B, self-grant
// prevention) — so every fixture below is a REAL git repo, not a plain
// directory with a loose config file. The hook's --admin/--no-verify guard
// now tokenizes the command with real shell-word semantics instead of
// substring-matching the raw string (Fix A), and that forbidden-flag check
// runs BEFORE (and independent of) AIDAKIT_BYPASS (Fix C).
//
// Ordering matters in this file (see the anti-drift note in design.md):
// sections A/B/D use per-scenario ISOLATED project roots and must run BEFORE
// section C sets the process-wide AIDAKIT_PROJECT_ROOT env var the flow
// engine needs — once that's set, pr-config.js's resolveRoot() (which honors
// that same env var, single-source) would otherwise short-circuit every
// isolated-root scenario back to the shared flow-engine tmp dir.

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync, execFileSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const GOVERNANCE = join(here, "..");
const REPO_ROOT = join(GOVERNANCE, "..");
const VALIDATOR = join(GOVERNANCE, "validators", "check-pr-automation.js");
const HOOK = join(REPO_ROOT, "hooks", "pre-bash.js");

let pass = 0, fail = 0;
function ok(cond, name) { if (cond) pass++; else { fail++; console.log(`FAIL ${name}`); } }
function eq(a, b, name) { const r = JSON.stringify(a) === JSON.stringify(b); if (!r) console.log(`  ${name}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); ok(r, name); }

// ── git fixture helpers (Fix B: config must be COMMITTED on a base ref) ────

const GIT_OPTS = (cwd) => ({ cwd, stdio: ["ignore", "ignore", "ignore"] });

/** `git init` + identity + an initial (possibly empty) commit on a NAMED
 * branch — deterministic regardless of the host's `init.defaultBranch`. */
function initGitRepo(root, branch = "main") {
  execFileSync("git", ["init", "-q"], GIT_OPTS(root));
  execFileSync("git", ["symbolic-ref", "HEAD", `refs/heads/${branch}`], GIT_OPTS(root));
  execFileSync("git", ["config", "user.email", "aidakit-test@example.com"], GIT_OPTS(root));
  execFileSync("git", ["config", "user.name", "aidakit test"], GIT_OPTS(root));
  execFileSync("git", ["config", "commit.gpgsign", "false"], GIT_OPTS(root));
  execFileSync("git", ["commit", "-q", "-m", "init", "--allow-empty"], GIT_OPTS(root));
}

/** Writes + commits aidakit.config.yaml on the CURRENT branch. */
function commitConfig(root, yamlText) {
  writeFileSync(join(root, "aidakit.config.yaml"), yamlText, "utf8");
  execFileSync("git", ["add", "aidakit.config.yaml"], GIT_OPTS(root));
  execFileSync("git", ["commit", "-q", "-m", "config"], GIT_OPTS(root));
}

/** A plain (non-git) isolated project root — only for the "not a git repo"
 * fail-closed scenarios; every other fixture below is a real git repo. */
function mkPlainProjectRoot(prefix = "pr-automation-plain-") {
  const root = mkdtempSync(join(tmpdir(), prefix));
  mkdirSync(join(root, ".aidakit"), { recursive: true });
  return root;
}

/** The STANDARD fixture: a git repo with a `.aidakit/` marker, `baseConfig`
 * (if given) written+committed on `branch` (default "main"). No feature
 * branch — base IS the working tree's current branch, which is fine for
 * every scenario except the dedicated self-grant tests below. */
function mkGitProjectRoot({ baseConfig, branch = "main" } = {}) {
  const root = mkdtempSync(join(tmpdir(), "pr-automation-git-"));
  mkdirSync(join(root, ".aidakit"), { recursive: true });
  initGitRepo(root, branch);
  if (baseConfig !== undefined) commitConfig(root, baseConfig);
  return root;
}

/** The SELF-GRANT fixture (Fix B's core scenario): a git repo whose BASE
 * branch ("main") has `baseConfig` (may be absent/false), then checks out a
 * "feature" branch (models the PR's own branch) and adds `pr.auto_merge:
 * true` there — either left UNCOMMITTED (the PR's own dirty working tree) or
 * COMMITTED on the feature branch (the PR's own HEAD commit). Neither must
 * grant the opt-in — only the BASE branch's committed config counts. */
function mkSelfGrantProjectRoot({ baseConfig, featureConfigUncommitted, featureConfigCommitted } = {}) {
  const root = mkGitProjectRoot({ baseConfig });
  execFileSync("git", ["checkout", "-q", "-b", "feature"], GIT_OPTS(root));
  if (featureConfigCommitted !== undefined) commitConfig(root, featureConfigCommitted);
  else if (featureConfigUncommitted !== undefined) writeFileSync(join(root, "aidakit.config.yaml"), featureConfigUncommitted, "utf8");
  return root;
}

const CONFIG_TRUE = "pr:\n  auto_merge: true\n";
const CONFIG_FALSE = "pr:\n  auto_merge: false\n";
const CONFIG_MALFORMED_FLOW_STYLE = "pr: {auto_merge: true}\n"; // yaml-min throws on flow-style collections
const CONFIG_AMBIGUOUS_STRING = 'pr:\n  auto_merge: "true"\n'; // parses to the STRING "true", not boolean true
const CONFIG_AMBIGUOUS_YESNO = "pr:\n  auto_merge: yes\n"; // "yes" is not a recognized boolean literal
const CONFIG_NO_PR_BLOCK = "language: en\ndomains:\n  by-path:\n    core:\n      - \"src/**\"\n"; // Fix E: realistic upgrade path, no pr: key at all

// process.env.AIDAKIT_PROJECT_ROOT/AIDAKIT_BASE_REF must stay UNSET for
// sections A/B/D (isolated roots resolved purely from startDir/cwd/git) —
// clear them defensively in case the ambient shell leaked one in.
delete process.env.AIDAKIT_PROJECT_ROOT;
delete process.env.AIDAKIT_BASE_REF;
const baseEnv = { ...process.env };
delete baseEnv.AIDAKIT_PROJECT_ROOT;
delete baseEnv.AIDAKIT_BASE_REF;

// ══════════════════════════════════════════════════════════════════════════
// Section A — the reader: governance/pr/pr-config.js
// ══════════════════════════════════════════════════════════════════════════
{
  const { resolveRoot, resolveBaseRef, autoMergeEnabled } = await import("../pr/pr-config.js");

  // Absent config / absent `pr:` block → fail-closed, false.
  {
    const root = mkGitProjectRoot({});
    ok(autoMergeEnabled(root) === false, "reader: no aidakit.config.yaml on the base → false (fail-closed)");
  }

  // Fix E: config PRESENT with other real content, but no `pr:` key at all —
  // the realistic upgrade path (a project with an existing config that
  // simply hasn't adopted pr.auto_merge yet).
  {
    const root = mkGitProjectRoot({ baseConfig: CONFIG_NO_PR_BLOCK });
    ok(autoMergeEnabled(root) === false, "reader: config present with other keys but no pr: block → false");
  }

  // `pr.auto_merge: true`, COMMITTED on the base branch → true.
  {
    const root = mkGitProjectRoot({ baseConfig: CONFIG_TRUE });
    ok(autoMergeEnabled(root) === true, "reader: pr.auto_merge: true on the base branch → true");
  }

  // `pr.auto_merge: false` explicit → false.
  {
    const root = mkGitProjectRoot({ baseConfig: CONFIG_FALSE });
    ok(autoMergeEnabled(root) === false, "reader: pr.auto_merge: false → false");
  }

  // Malformed config (flow-style YAML the mini-parser rejects) → false, never throws.
  {
    const root = mkGitProjectRoot({ baseConfig: CONFIG_MALFORMED_FLOW_STYLE });
    let threw = false;
    let result;
    try { result = autoMergeEnabled(root); } catch { threw = true; }
    ok(!threw, "reader: malformed YAML never throws (fail-closed, not fail-crash)");
    ok(result === false, "reader: malformed YAML → false (fail-closed)");
  }

  // Ambiguous non-boolean values → false (strict `=== true` only).
  {
    const rootStr = mkGitProjectRoot({ baseConfig: CONFIG_AMBIGUOUS_STRING });
    ok(autoMergeEnabled(rootStr) === false, "reader: auto_merge as a quoted string \"true\" → false (strict boolean)");

    const rootYesNo = mkGitProjectRoot({ baseConfig: CONFIG_AMBIGUOUS_YESNO });
    ok(autoMergeEnabled(rootYesNo) === false, "reader: auto_merge: yes → false (not a recognized boolean literal)");
  }

  // Root resolution from a subdirectory: climbs to the same root a call from
  // the root itself would resolve, and autoMergeEnabled agrees from either
  // place (git commands always target the resolved ROOT, not the subdir).
  {
    const root = mkGitProjectRoot({ baseConfig: CONFIG_TRUE });
    const sub = join(root, "sub", "deeper");
    mkdirSync(sub, { recursive: true });
    eq(resolveRoot(sub), resolveRoot(root), "reader: resolveRoot from a subdir resolves the same root");
    eq(autoMergeEnabled(sub), autoMergeEnabled(root), "reader: autoMergeEnabled from a subdir matches the root's decision");
    ok(autoMergeEnabled(sub) === true, "reader: subdir decision is true (config is real)");
  }

  // AIDAKIT_PROJECT_ROOT env var takes precedence over startDir (single-source
  // with persistence.js's projectRoot() precedence rule).
  {
    const envRoot = mkGitProjectRoot({ baseConfig: CONFIG_TRUE });
    const otherRoot = mkGitProjectRoot({ baseConfig: CONFIG_FALSE });
    process.env.AIDAKIT_PROJECT_ROOT = envRoot;
    try {
      eq(resolveRoot(otherRoot), resolve(envRoot), "reader: AIDAKIT_PROJECT_ROOT overrides startDir in resolveRoot");
      ok(autoMergeEnabled(otherRoot) === true, "reader: AIDAKIT_PROJECT_ROOT overrides startDir in autoMergeEnabled");
    } finally {
      delete process.env.AIDAKIT_PROJECT_ROOT;
    }
  }

  // Fix E: resolveRoot's terminal fallback (no .aidakit/ found within the
  // climb bound, AIDAKIT_PROJECT_ROOT unset) → returns resolved startDir.
  // Built 25 levels deep inside our OWN fixture so the 20-level climb bound
  // (MAX_CLIMB) never escapes this synthetic, guaranteed-.aidakit-free tree
  // into the real machine's ancestry — deterministic regardless of host.
  {
    const plainRoot = mkdtempSync(join(tmpdir(), "pr-automation-noaidakit-"));
    const segments = Array.from({ length: 25 }, (_, i) => `lvl${i}`);
    const deepDir = join(plainRoot, ...segments);
    mkdirSync(deepDir, { recursive: true });
    ok(!process.env.AIDAKIT_PROJECT_ROOT, "reader: AIDAKIT_PROJECT_ROOT is unset for this assertion");
    eq(resolveRoot(deepDir), resolve(deepDir), "reader: resolveRoot falls back to startDir when no .aidakit/ is found within the climb bound");
  }

  // ── Fix B: the SELF-GRANT prevention — the reason config now reads from
  // the base branch instead of the working tree ──────────────────────────
  {
    // Base lacks pr.auto_merge; the "PR" (feature branch) adds it UNCOMMITTED
    // in its own working tree — must stay DISABLED (never read the working tree).
    const root = mkSelfGrantProjectRoot({ featureConfigUncommitted: CONFIG_TRUE });
    ok(autoMergeEnabled(root) === false, "reader SELF-GRANT: base lacks auto_merge; feature branch's UNCOMMITTED working-tree config is ignored → false");
  }
  {
    // Same, but the PR COMMITTED the opt-in on its own feature branch HEAD —
    // still must not count; only the BASE ref's committed config counts.
    const root = mkSelfGrantProjectRoot({ featureConfigCommitted: CONFIG_TRUE });
    ok(autoMergeEnabled(root) === false, "reader SELF-GRANT: base lacks auto_merge; feature branch's COMMITTED config is ignored → false");
  }
  {
    // Base has auto_merge:false; feature branch escalates to true, uncommitted.
    const root = mkSelfGrantProjectRoot({ baseConfig: CONFIG_FALSE, featureConfigUncommitted: CONFIG_TRUE });
    ok(autoMergeEnabled(root) === false, "reader SELF-GRANT: base has auto_merge:false; feature branch cannot escalate it → false");
  }
  {
    // The LEGITIMATE case: base already has auto_merge:true (a prior, already-
    // merged decision) — a later feature branch (with no config change of its
    // own) still reads it as enabled. "Thereafter PRs auto-merge."
    const root = mkSelfGrantProjectRoot({ baseConfig: CONFIG_TRUE });
    ok(autoMergeEnabled(root) === true, "reader SELF-GRANT: base ALREADY has auto_merge:true → enabled for later feature branches too");
  }

  // ── base-ref resolution edge cases (resolveBaseRef) ─────────────────────
  {
    // Not a git repo at all → fail-closed.
    const root = mkPlainProjectRoot();
    eq(resolveBaseRef(root), null, "resolveBaseRef: not a git repo → null");
    ok(autoMergeEnabled(root) === false, "reader: not a git repo → false (fail-closed)");
  }
  {
    // A git repo whose only branch is neither "main" nor "master", no remote,
    // no override → base ref unresolvable → fail-closed, even if THAT branch
    // itself carries pr.auto_merge: true (there is no trusted anchor for it).
    const root = mkGitProjectRoot({ baseConfig: CONFIG_TRUE, branch: "trunk" });
    eq(resolveBaseRef(root), null, "resolveBaseRef: no main/master/origin/override → null (unresolvable)");
    ok(autoMergeEnabled(root) === false, "reader: unresolvable base ref → false (fail-closed), even with a non-standard branch carrying auto_merge:true");
  }
  {
    // AIDAKIT_BASE_REF explicit override resolves even a non-standard branch name.
    const root = mkGitProjectRoot({ baseConfig: CONFIG_TRUE, branch: "trunk" });
    process.env.AIDAKIT_BASE_REF = "trunk";
    try {
      eq(resolveBaseRef(root), "trunk", "resolveBaseRef: AIDAKIT_BASE_REF override is honored verbatim");
      ok(autoMergeEnabled(root) === true, "reader: AIDAKIT_BASE_REF override resolves a non-standard branch");
    } finally {
      delete process.env.AIDAKIT_BASE_REF;
    }
  }
  {
    // "master" fallback (when "main" doesn't exist).
    const root = mkGitProjectRoot({ baseConfig: CONFIG_TRUE, branch: "master" });
    eq(resolveBaseRef(root), "master", "resolveBaseRef: falls back to a local master branch");
    ok(autoMergeEnabled(root) === true, "reader: master-branch fallback resolves the config");
  }
  {
    // origin/HEAD resolution: a bare "remote" repo whose default branch is a
    // NON-standard name ("trunk") — proves resolution goes through
    // origin/HEAD itself, not just the main/master fallback (the clone's
    // local branch is ALSO named "trunk" here, so main/master fallback would
    // fail on its own; only origin/HEAD resolves this). Round-3 correctness
    // fix: the resolved ref is the REMOTE-TRACKING ref ("origin/trunk"), kept
    // verbatim — never collapsed to the bare local branch name (a diverged
    // local branch of the same name must never be able to shadow it; see the
    // dedicated origin-vs-local-divergence precedence test further below).
    const remote = mkdtempSync(join(tmpdir(), "pr-automation-bare-"));
    execFileSync("git", ["init", "-q", "--bare"], GIT_OPTS(remote));
    const seed = mkGitProjectRoot({ baseConfig: CONFIG_TRUE, branch: "trunk" });
    execFileSync("git", ["push", "-q", remote, "trunk"], GIT_OPTS(seed));
    execFileSync("git", ["symbolic-ref", "HEAD", "refs/heads/trunk"], GIT_OPTS(remote));
    const clone = mkdtempSync(join(tmpdir(), "pr-automation-clone-"));
    execFileSync("git", ["clone", "-q", remote, clone], { stdio: ["ignore", "ignore", "ignore"] });
    mkdirSync(join(clone, ".aidakit"), { recursive: true });
    eq(resolveBaseRef(clone), "origin/trunk", "resolveBaseRef: resolves via origin/HEAD, kept as the remote-tracking ref (never stripped to the bare local branch name)");
    ok(autoMergeEnabled(clone) === true, "reader: origin/HEAD-resolved base branch's committed config is read");
  }

  // Fix 4 (tester-suggested, round 3): PRECEDENCE — a repo with BOTH a local
  // "main" and a resolvable origin/HEAD, carrying DIFFERENT pr.auto_merge
  // values, must resolve via origin/HEAD, never the local branch. This is the
  // scenario the round-3 correctness fix (keeping the remote-tracking ref
  // instead of the bare branch name) exists to protect: a locally-checked-out
  // branch (e.g. a PR's own branch, if it happened to be named "main") must
  // never be able to shadow what origin actually has.
  {
    const remote = mkdtempSync(join(tmpdir(), "pr-automation-bare-main-"));
    execFileSync("git", ["init", "-q", "--bare"], GIT_OPTS(remote));
    const seed = mkGitProjectRoot({ baseConfig: CONFIG_TRUE, branch: "main" });
    execFileSync("git", ["push", "-q", remote, "main"], GIT_OPTS(seed));
    execFileSync("git", ["symbolic-ref", "HEAD", "refs/heads/main"], GIT_OPTS(remote));
    const clone = mkdtempSync(join(tmpdir(), "pr-automation-clone-main-"));
    execFileSync("git", ["clone", "-q", remote, clone], { stdio: ["ignore", "ignore", "ignore"] });
    mkdirSync(join(clone, ".aidakit"), { recursive: true });
    // Diverge the LOCAL main from origin/main: commit auto_merge:false locally, never pushed.
    writeFileSync(join(clone, "aidakit.config.yaml"), CONFIG_FALSE, "utf8");
    execFileSync("git", ["add", "aidakit.config.yaml"], GIT_OPTS(clone));
    execFileSync("git", ["commit", "-q", "-m", "locally diverge to false"], GIT_OPTS(clone));
    eq(resolveBaseRef(clone), "origin/main", "resolveBaseRef precedence: origin/HEAD wins even when a local branch of the same name exists");
    ok(autoMergeEnabled(clone) === true, "reader precedence: reads origin/main's TRUE, ignores the diverged local main's FALSE — origin/HEAD wins");
  }
}

// ══════════════════════════════════════════════════════════════════════════
// Section B — the CLI wrapper: governance/validators/check-pr-automation.js
// ══════════════════════════════════════════════════════════════════════════
{
  function runValidator(args, { cwd, env } = {}) {
    const res = spawnSync("node", [VALIDATOR, ...args], { cwd, env: env ?? baseEnv, encoding: "utf8" });
    let json = null;
    try { json = JSON.parse(res.stdout.trim().split("\n").pop()); } catch { /* leave null */ }
    return { code: res.status, json, stdout: res.stdout, stderr: res.stderr };
  }

  // No config → exit 1 (fail-closed for the manual path).
  {
    const root = mkGitProjectRoot({});
    const r = runValidator(["--field", "auto_merge"], { cwd: root });
    eq(r.code, 1, "CLI: no config → exit 1");
    ok(r.json && r.json.ok === false, "CLI: JSON reports ok:false");
    ok(r.json && typeof r.json.validator === "string", "CLI: JSON carries the validator name (contract)");
  }

  // auto_merge: true, committed on the base branch → exit 0.
  {
    const root = mkGitProjectRoot({ baseConfig: CONFIG_TRUE });
    const r = runValidator(["--field", "auto_merge"], { cwd: root });
    eq(r.code, 0, "CLI: pr.auto_merge: true on the base branch → exit 0");
    ok(r.json && r.json.ok === true, "CLI: JSON reports ok:true");
  }

  // auto_merge: false → exit 1.
  {
    const root = mkGitProjectRoot({ baseConfig: CONFIG_FALSE });
    const r = runValidator(["--field", "auto_merge"], { cwd: root });
    eq(r.code, 1, "CLI: pr.auto_merge: false → exit 1");
  }

  // Malformed config → exit != 0, NEVER exit 0.
  {
    const root = mkGitProjectRoot({ baseConfig: CONFIG_MALFORMED_FLOW_STYLE });
    const r = runValidator(["--field", "auto_merge"], { cwd: root });
    ok(r.code !== 0, "CLI: malformed config never exits 0 (fail-closed)");
  }

  // --field missing/invalid → exit 2 (usage), JSON still on stdout.
  {
    const root = mkGitProjectRoot({});
    let r = runValidator([], { cwd: root });
    eq(r.code, 2, "CLI: missing --field → exit 2 (usage)");
    ok(r.json && typeof r.json.validator === "string", "CLI: usage error still emits contract JSON on stdout");

    r = runValidator(["--field", "not_a_real_field"], { cwd: root });
    eq(r.code, 2, "CLI: unknown --field value → exit 2 (usage)");
  }

  // Root resolution from a subdirectory (via cwd) matches the root's decision —
  // same single-source resolveRoot the reader and the hook use.
  {
    const root = mkGitProjectRoot({ baseConfig: CONFIG_TRUE });
    const sub = join(root, "nested");
    mkdirSync(sub, { recursive: true });
    const rRoot = runValidator(["--field", "auto_merge"], { cwd: root });
    const rSub = runValidator(["--field", "auto_merge"], { cwd: sub });
    eq(rSub.code, rRoot.code, "CLI: decision from a subdirectory matches the root's decision");
    eq(rSub.code, 0, "CLI: subdirectory decision is exit 0 (config is real)");
  }

  // AIDAKIT_PROJECT_ROOT env overrides cwd (single-source with the reader).
  {
    const envRoot = mkGitProjectRoot({ baseConfig: CONFIG_TRUE });
    const cwdRoot = mkGitProjectRoot({ baseConfig: CONFIG_FALSE });
    const r = runValidator(["--field", "auto_merge"], { cwd: cwdRoot, env: { ...baseEnv, AIDAKIT_PROJECT_ROOT: envRoot } });
    eq(r.code, 0, "CLI: AIDAKIT_PROJECT_ROOT env overrides cwd");
  }

  // Fix B via the CLI: the self-grant case is disabled end-to-end too.
  {
    const root = mkSelfGrantProjectRoot({ featureConfigUncommitted: CONFIG_TRUE });
    const r = runValidator(["--field", "auto_merge"], { cwd: root });
    eq(r.code, 1, "CLI SELF-GRANT: feature branch's uncommitted auto_merge:true is ignored → exit 1");
  }
}

// ══════════════════════════════════════════════════════════════════════════
// Section D — the hook carve-out: hooks/pre-bash.js
// ══════════════════════════════════════════════════════════════════════════
{
  function runHook(command, cwd, extraEnv) {
    const payload = JSON.stringify({ tool_input: { command }, cwd });
    const res = spawnSync("node", [HOOK], { cwd, env: { ...baseEnv, ...extraEnv }, input: payload, encoding: "utf8" });
    return { code: res.status, stderr: res.stderr };
  }

  // No config → gh pr merge stays blocked (exit 2), same as today.
  {
    const root = mkGitProjectRoot({});
    const r = runHook("gh pr merge", root);
    eq(r.code, 2, "hook: gh pr merge blocked by default (no config)");
  }

  // pr.auto_merge: true, COMMITTED on the base branch → allowed (exit 0).
  {
    const root = mkGitProjectRoot({ baseConfig: CONFIG_TRUE });
    const r = runHook("gh pr merge", root);
    eq(r.code, 0, "hook: gh pr merge allowed with pr.auto_merge: true on the base branch");
  }

  // Run from a SUBDIRECTORY of that same root → same decision (single-source
  // root resolution, matches the reader — no ADR-reviewer subdir mismatch).
  {
    const root = mkGitProjectRoot({ baseConfig: CONFIG_TRUE });
    const sub = join(root, "packages", "app");
    mkdirSync(sub, { recursive: true });
    const r = runHook("gh pr merge", sub);
    eq(r.code, 0, "hook: gh pr merge allowed from a subdirectory (root resolves the same as the reader)");
  }

  // Fix B via the hook: the self-grant case stays blocked.
  {
    const root = mkSelfGrantProjectRoot({ featureConfigUncommitted: CONFIG_TRUE });
    const r = runHook("gh pr merge", root);
    eq(r.code, 2, "hook SELF-GRANT: a PR's own uncommitted aidakit.config.yaml cannot grant itself the carve-out");
  }

  // ── Fix A: forbidden flags survive quote-splicing / backslash escaping / chaining ──
  {
    const root = mkGitProjectRoot({ baseConfig: CONFIG_TRUE });
    const forbidden = [
      "gh pr merge --admin",
      "gh pr merge --admin=true",
      "gh pr merge --no-verify",
      "foo && gh pr merge --admin",
      "gh pr merge --admin ; bar",
      "gh pr merge --adm''in", // quote-splicing: bash collapses this to --admin
      "gh pr merge --adm\\in", // backslash escape: bash collapses this to --admin
      "gh pr merge --no-ver''ify", // quote-splicing on --no-verify
      "echo hi && gh pr merge --adm''in", // chained + quote-spliced
    ];
    for (const cmd of forbidden) {
      const r = runHook(cmd, root);
      eq(r.code, 2, `hook Fix A: blocked even with auto_merge:true — "${cmd}"`);
    }
  }

  // Statically-visible variable indirection → ambiguous → blocked (fail-closed).
  {
    const root = mkGitProjectRoot({ baseConfig: CONFIG_TRUE });
    const indirections = [
      "gh pr merge $ADMIN_FLAG",
      "FLAG=--admin && gh pr merge $FLAG",
      "gh pr merge `echo --admin`",
      "gh pr merge $(echo --admin)",
    ];
    for (const cmd of indirections) {
      const r = runHook(cmd, root);
      eq(r.code, 2, `hook Fix A: variable/command-substitution indirection blocked (ambiguous, fail-closed) — "${cmd}"`);
    }
  }

  // A SAFE gh pr merge shape (target + a recognized merge-method flag) is
  // still allowed under the opt-in — the allowlist isn't overly strict.
  {
    const root = mkGitProjectRoot({ baseConfig: CONFIG_TRUE });
    const r = runHook("gh pr merge 42 --merge", root);
    eq(r.code, 0, "hook Fix A: a recognized safe shape (target + --merge) is still allowed under the opt-in");
  }
  {
    const root = mkGitProjectRoot({ baseConfig: CONFIG_TRUE });
    const r = runHook("gh pr merge 42 --squash --delete-branch", root);
    eq(r.code, 0, "hook: another recognized safe shape (target + --squash + --delete-branch) is allowed under the opt-in");
  }

  // ── Round 3 (Fix 2, security veto): demonstrated live bypasses of the
  // round-2 tokenizer, closed via a broadened TRIGGER predicate (raw text
  // contains BOTH "gh" and "merge", case-insensitive — no longer just the
  // literal "gh pr merge" adjacency) plus new ambiguity detection (brace
  // grouping, shell reserved words, command-reinterpreting leaders: eval/
  // sh -c/bash -c — "source"/"." were DROPPED from this set in round 4,
  // see the honesty fix below). Every payload below must block even with
  // pr.auto_merge: true committed on the base. ──
  {
    const root = mkGitProjectRoot({ baseConfig: CONFIG_TRUE });
    const bypasses = [
      "{ gh pr merge --admin; }", // brace grouping
      "{ gh pr merge --no-verify; }",
      "if true; then gh pr merge --admin; fi", // reserved words hide the invocation's positional shape
      "eval 'gh pr merge --admin'", // eval re-parses its argument as shell
      "X=gh; $X pr merge --admin", // the "gh" trigger token itself obfuscated via a variable
      "gh${IFS}pr${IFS}merge --admin", // $IFS-based word-splitting obfuscation
      "$(echo gh) pr merge --admin", // command substitution obfuscating "gh"
      "`echo gh` pr merge --admin", // backtick substitution obfuscating "gh"
    ];
    for (const cmd of bypasses) {
      const r = runHook(cmd, root);
      eq(r.code, 2, `hook round 3 (Fix 2): live-demonstrated bypass now blocked — "${cmd}"`);
    }
  }

  // The broadened (gh + merge substring) trigger must NOT false-block
  // unrelated commands that merely share those substrings incidentally.
  {
    const root = mkGitProjectRoot({ baseConfig: CONFIG_TRUE });
    const unrelated = [
      "git merge $branch", // no "gh" substring at all (git != gh)
      "gh pr view $PR", // "gh" present, but no "merge" substring
      "gh pr list | grep x", // "gh" present, but no "merge" substring
    ];
    for (const cmd of unrelated) {
      const r = runHook(cmd, root);
      eq(r.code, 0, `hook round 3 (Fix 2): unrelated command NOT falsely blocked by the broadened trigger — "${cmd}"`);
    }
  }

  // Round 3 (Fix 4, tester-suggested): allowlist edges.
  {
    const root = mkGitProjectRoot({ baseConfig: CONFIG_TRUE });
    let r = runHook("gh pr merge 42 --merge && gh pr merge --admin", root);
    eq(r.code, 2, "hook: chained safe-then-unsafe invocation blocked (any unsafe invocation in the chain blocks the whole command)");

    r = runHook("gh pr merge 1 2", root);
    eq(r.code, 2, "hook: a second positional argument (double target) is rejected by the allowlist");

    r = runHook("gh pr merge -42", root);
    eq(r.code, 2, "hook: a leading-dash target (-42) is rejected — the allowlist target pattern never starts with '-'");
  }

  // ── Round 4 (Fix 1, security regression): a recognized command-wrapper
  // prefix before "gh pr merge" must not defeat detection. Round-3's
  // isGhPrMergeInvocation only checked tokens[0..2] — command gh pr merge
  // --admin (tokens[0]="command") slipped through as "no invocation found",
  // even though it genuinely IS one (the OLD raw-substring rule caught these;
  // this closes the regression). Fixed by scanning for "gh" "pr" "merge" as
  // three CONSECUTIVE tokens ANYWHERE in a simple command's token list, not
  // only at the start — so it works for any wrapper (command/env/builtin/
  // exec/nice/nohup/`command -p`/...) without needing to enumerate wrappers. ──
  {
    const rootNoConfig = mkGitProjectRoot({});
    const rootAutoMerge = mkGitProjectRoot({ baseConfig: CONFIG_TRUE });
    const wrapped = [
      "command gh pr merge --admin",
      "env gh pr merge --admin",
      "builtin gh pr merge --admin",
      "exec gh pr merge --admin",
      "nice gh pr merge --admin",
      "nohup gh pr merge --admin",
      "command -p gh pr merge --admin",
    ];
    for (const cmd of wrapped) {
      const rNo = runHook(cmd, rootNoConfig);
      eq(rNo.code, 2, `hook round 4 (Fix 1): wrapper-prefixed forbidden-flag invocation blocked, no config — "${cmd}"`);
      const rYes = runHook(cmd, rootAutoMerge);
      eq(rYes.code, 2, `hook round 4 (Fix 1): wrapper-prefixed forbidden-flag invocation blocked, WITH pr.auto_merge:true — "${cmd}"`);
    }
  }

  // Round 4 (Fix 1): the wider "anywhere in the token stream" scan must NOT
  // false-block genuinely innocent mentions — "gh pr merge" as a SUBSTRING
  // inside a quoted argument (one token, not three separate consecutive
  // tokens) is never mistaken for a real invocation.
  {
    const root = mkGitProjectRoot({});
    const innocent = [
      'git commit -m "add gh pr merge automation"',
      'echo "run gh pr merge"',
      "git merge $branch",
      "gh pr view $PR",
      "gh pr list | grep merge",
    ];
    for (const cmd of innocent) {
      const r = runHook(cmd, root);
      eq(r.code, 0, `hook round 4 (Fix 1): innocent mention NOT falsely blocked — "${cmd}"`);
    }
  }

  // ── Round 4 (Fix 2, honesty): the tester found the eval/sh -c/bash -c
  // "inline re-interpreting leader" branch had NO test — a mutation deleting
  // it stayed green. These lock it in. (source/./bash <file>/sh <file> are
  // NOT tested as blocked here — they genuinely aren't caught, and are now
  // disclosed as an accepted residual rather than claimed as hardened; see
  // hooks/pre-bash.js's header, ADR-008 §Decision 4, design.md.) ──
  {
    const root = mkGitProjectRoot({ baseConfig: CONFIG_TRUE });
    const inlineReinterpret = [
      "eval 'gh pr merge --admin'",
      "sh -c 'gh pr merge --admin'",
      "bash -c 'gh pr merge --admin'",
    ];
    for (const cmd of inlineReinterpret) {
      const r = runHook(cmd, root);
      eq(r.code, 2, `hook round 4 (Fix 2): inline re-interpreting leader with a visible payload blocked — "${cmd}"`);
    }
  }

  // ── Round 5 (security veto, blocking): three reachable PLAIN-TEXT
  // (non-obfuscated) bypasses of the real gh CLI grammar — confirmed live
  // against the real installed gh binary. All three are standard,
  // undisguised gh invocation forms the round-4 detector failed to
  // recognize, letting them fall through to ALLOW (even without opt-in). ──

  // Fix 1: a path-qualified gh binary. `tokens[i] === 'gh'` (exact string)
  // misses any of these — the binary is still genuinely `gh`, just invoked
  // by a path. Fixed by matching the BASENAME of the token, not the token
  // itself.
  {
    const rootNoConfig = mkGitProjectRoot({});
    const rootAutoMerge = mkGitProjectRoot({ baseConfig: CONFIG_TRUE });
    const pathQualified = [
      "/opt/homebrew/bin/gh pr merge --admin",
      "./gh pr merge --admin",
      "bin/gh pr merge --admin",
    ];
    for (const cmd of pathQualified) {
      const rNo = runHook(cmd, rootNoConfig);
      eq(rNo.code, 2, `hook round 5 (Fix 1): path-qualified gh binary blocked, no config — "${cmd}"`);
      const rYes = runHook(cmd, rootAutoMerge);
      eq(rYes.code, 2, `hook round 5 (Fix 1): path-qualified gh binary blocked, WITH pr.auto_merge:true — "${cmd}"`);
    }
  }

  // Fix 2: a documented, standard gh global flag (-R/--repo) BEFORE the
  // subcommand — not obfuscation, just normal gh usage — puts a token
  // between "gh" and "pr", defeating the round-4 strict-adjacency scan.
  // Fixed: after finding a gh binary token (by basename), the scan for the
  // "pr"+"merge" pair tolerates arbitrary tokens between "gh" and "pr" (the
  // global-flag region), while "pr" and "merge" themselves stay strictly
  // adjacent (still specific enough not to false-match unrelated usage).
  {
    const rootAutoMerge = mkGitProjectRoot({ baseConfig: CONFIG_TRUE });
    const globalFlag = ["gh -R o/r pr merge --admin", "gh --repo o/r pr merge --admin"];
    for (const cmd of globalFlag) {
      const r = runHook(cmd, rootAutoMerge);
      eq(r.code, 2, `hook round 5 (Fix 2): global flag between gh and the subcommand still detected and blocked — "${cmd}"`);
    }
    // A SAFE invocation with the same global-flag shape (no forbidden flag)
    // must still be ALLOWED under the opt-in — the fix isn't a blanket block.
    const rSafe = runHook("gh -R o/r pr merge", rootAutoMerge);
    eq(rSafe.code, 0, "hook round 5 (Fix 2): gh -R o/r pr merge (no forbidden flag) allowed under the opt-in");
  }

  // Re-confirm the 5 innocent mentions from round 4 are STILL not falsely
  // blocked by the widened (gh-to-pr gap tolerant) scan.
  {
    const root = mkGitProjectRoot({});
    const innocent = [
      'git commit -m "add gh pr merge automation"',
      'echo "run gh pr merge"',
      "git merge $branch",
      "gh pr view $PR",
      "gh pr list | grep merge",
    ];
    for (const cmd of innocent) {
      const r = runHook(cmd, root);
      eq(r.code, 0, `hook round 5 (Fix 2 regression check): innocent mention still NOT falsely blocked — "${cmd}"`);
    }
  }

  // Fix 3: argument injection via xargs — the merge args arrive from stdin,
  // invisible to the tokenizer, even though the command TEXT itself (which
  // does contain "gh" and "merge" substrings, tripping the trigger) looks
  // innocuous. Treated as a generic argument-injection primitive: xargs as a
  // simple command's leader marks the whole analysis ambiguous (same
  // treatment as eval), regardless of whether it's the first command in the
  // pipeline or after a pipe.
  {
    const rootAutoMerge = mkGitProjectRoot({ baseConfig: CONFIG_TRUE });
    const r = runHook("printf 'pr\\nmerge\\n--admin\\n' | xargs gh", rootAutoMerge);
    eq(r.code, 2, "hook round 5 (Fix 3): xargs argument injection blocked (ambiguous, fail-closed)");
  }

  // Combined forms (wrapper + path-qualified + global-flag), generalizing
  // the basename/gap-tolerant/xargs-ambiguity fixes together.
  {
    const rootAutoMerge = mkGitProjectRoot({ baseConfig: CONFIG_TRUE });
    const combined = [
      "command /opt/homebrew/bin/gh pr merge --admin", // wrapper + path
      "env /opt/homebrew/bin/gh -R o/r pr merge --admin", // wrapper + path + global flag
      "nohup ./gh --repo o/r pr merge --admin", // wrapper + relative path + global flag
    ];
    for (const cmd of combined) {
      const r = runHook(cmd, rootAutoMerge);
      eq(r.code, 2, `hook round 5: combined wrapper+path+global-flag form blocked — "${cmd}"`);
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // Round 6 (FALSE-BLOCK fix, reproduced live in flow fast-260725-9cfd01):
  // an OUTPUT redirection made the whole parse ambiguous, so the kit's OWN
  // documented read-only mergeability query — skills/merge/SKILL.md §Process
  // step 2, `gh pr view --json mergeable,mergeStateStatus,reviewDecision,
  // statusCheckRollup` — was BLOCKED the moment an operator appended `2>&1`
  // or `> file`. It reaches this rule at all because the JSON FIELD NAMES
  // `mergeable`/`mergeStateStatus` satisfy the deliberately broad gh+merge
  // trigger; the redirect then killed the parse before the
  // `mergeInvocationFound: false` fall-through could let it go.
  //
  // Fix: output redirection is PARSED (operator + target word dropped)
  // instead of marking the parse ambiguous. It is pure plumbing — it cannot
  // change a byte of argv or stdin — so it carries none of the injection
  // risk of $(...)/eval/xargs. INPUT redirection (`<`) deliberately stays
  // ambiguous (stdin-injection class, same as the round-5 xargs bypass).
  // ══════════════════════════════════════════════════════════════════════

  // The read-only query must be ALLOWED with a redirect and with a pipe —
  // and regardless of pr.auto_merge, since this rule is not its business.
  {
    const rootNoConfig = mkGitProjectRoot({});
    const rootAutoMerge = mkGitProjectRoot({ baseConfig: CONFIG_TRUE });
    const readOnly = [
      // the exact command from the live repro
      "gh pr view 44 --json number,mergeable,mergeStateStatus,reviewDecision,statusCheckRollup,baseRefName 2>&1",
      // the exact command SKILL.md §Process step 2 prescribes, piped
      "gh pr view --json mergeable,mergeStateStatus,reviewDecision,statusCheckRollup | jq .",
      "gh pr view 44 --json mergeable,mergeStateStatus | tail -1",
      "gh pr view 44 --json mergeable > /tmp/pr.json",
      "gh pr view 44 --json mergeable >> /tmp/pr.json",
      "gh pr view 44 --json mergeable 1>/tmp/out 2>&1", // explicit fd prefixes
      "gh pr view 44 --json mergeable &> /tmp/pr.json", // both streams
      "gh pr view 44 --json mergeable 2>/dev/null | jq -r '.mergeable'", // redirect + pipe
    ];
    for (const cmd of readOnly) {
      const rNo = runHook(cmd, rootNoConfig);
      eq(rNo.code, 0, `hook round 6: read-only gh pr view allowed, no config — "${cmd}"`);
      const rYes = runHook(cmd, rootAutoMerge);
      eq(rYes.code, 0, `hook round 6: read-only gh pr view allowed, WITH pr.auto_merge:true — "${cmd}"`);
    }
  }

  // A redirection must NOT become a laundering channel: every forbidden /
  // obfuscated payload stays blocked when a redirect is appended to it.
  {
    const rootAutoMerge = mkGitProjectRoot({ baseConfig: CONFIG_TRUE });
    const stillBlocked = [
      "gh pr merge --admin 2>/dev/null",
      "gh pr merge --admin > /dev/null",
      "gh pr merge --admin >out 2>&1",
      "gh pr merge --no-verify &>/dev/null",
      "gh pr merge --adm''in 2>&1", // quote-splicing survives the redirect parse
      "command /opt/homebrew/bin/gh pr merge --admin 2>&1", // wrapper + path + redirect
      "gh pr view 44 --json mergeable 2>&1 && gh pr merge --admin", // read-only THEN a real merge
      "gh pr merge 1 2 2>&1", // double positional still rejected (the `2` isn't eaten as an fd)
      "printf 'pr\\nmerge\\n--admin\\n' | xargs gh 2>&1", // xargs stdin injection + redirect
      "gh${IFS}pr${IFS}merge --admin 2>&1", // $IFS obfuscation + redirect
      "eval 'gh pr merge --admin' 2>&1", // inline re-interpreting leader + redirect
      "gh pr merge $(echo --admin) 2>&1", // command substitution + redirect
      "gh pr merge --merge >", // dangling redirect (syntax error) → ambiguous, fail-closed
      "gh pr merge --merge < payload", // INPUT redirection stays ambiguous (stdin-injection class)
    ];
    for (const cmd of stillBlocked) {
      const r = runHook(cmd, rootAutoMerge);
      eq(r.code, 2, `hook round 6: redirect is no laundering channel — still blocked: "${cmd}"`);
    }
  }

  // The redirect parse must not break the ALLOW path either: a safe shape
  // with a redirect stays allowed under the opt-in, and stays blocked
  // without it (the redirect target is never counted as a positional).
  {
    const rootAutoMerge = mkGitProjectRoot({ baseConfig: CONFIG_TRUE });
    const rootNoConfig = mkGitProjectRoot({});
    eq(runHook("gh pr merge 42 --merge 2>&1", rootAutoMerge).code, 0,
      "hook round 6: safe shape + redirect still allowed under the opt-in");
    eq(runHook("gh pr merge 42 --squash > /tmp/merge.log", rootAutoMerge).code, 0,
      "hook round 6: safe shape + output redirect to a file still allowed under the opt-in");
    eq(runHook("gh pr merge 42 --merge 2>&1", rootNoConfig).code, 2,
      "hook round 6: safe shape + redirect still blocked WITHOUT the opt-in");
  }

  // Round 6 (message): the block message must name the condition that
  // actually fired. The old single message cited --admin/--no-verify even
  // when nothing of the sort was present, so an ambiguity block on a
  // read-only command read as a security accusation about a `view`.
  {
    const root = mkGitProjectRoot({});
    const amb = runHook('gh pr view "$PR" --json mergeable,mergeStateStatus', root);
    eq(amb.code, 2, "hook round 6: an unresolvable $VAR still blocks fail-closed (documented, not silently allowed)");
    ok(/ambiguous construct, NOT a forbidden flag/.test(amb.stderr),
      "hook round 6: the ambiguity block names ambiguity, not a forbidden flag");
    ok(!/BLOCKED: this command invokes/.test(amb.stderr),
      "hook round 6: the ambiguity block does NOT claim a gh pr merge invocation was found");

    const flag = runHook("gh pr merge --admin", root);
    eq(flag.code, 2, "hook round 6: --admin still blocked");
    ok(/outside the allowlist/.test(flag.stderr),
      "hook round 6: the forbidden-flag block names the allowlist violation");
    ok(!/ambiguous construct/.test(flag.stderr),
      "hook round 6: the forbidden-flag block does NOT blame ambiguity");
  }

  // ── Fix C: --admin/--no-verify stay blocked even under AIDAKIT_BYPASS ──
  {
    const rootNoConfig = mkGitProjectRoot({});
    let r = runHook("AIDAKIT_BYPASS=1 gh pr merge --admin", rootNoConfig);
    eq(r.code, 2, "hook Fix C: AIDAKIT_BYPASS cannot rescue --admin (no config)");

    const rootAutoMerge = mkGitProjectRoot({ baseConfig: CONFIG_TRUE });
    r = runHook("AIDAKIT_BYPASS=1 gh pr merge --admin", rootAutoMerge);
    eq(r.code, 2, "hook Fix C: AIDAKIT_BYPASS cannot rescue --admin (with pr.auto_merge: true)");

    // Plain gh pr merge (no forbidden flag) still respects the existing bypass.
    r = runHook("AIDAKIT_BYPASS=1 gh pr merge", rootNoConfig);
    eq(r.code, 0, "hook Fix C: AIDAKIT_BYPASS still works for a PLAIN gh pr merge (bypass intact)");
  }

  // Malformed config → fail-closed, blocked.
  {
    const root = mkGitProjectRoot({ baseConfig: CONFIG_MALFORMED_FLOW_STYLE });
    const r = runHook("gh pr merge", root);
    eq(r.code, 2, "hook: malformed config → blocked (fail-closed)");
  }

  // Regression: a non-merge command is unaffected by the carve-out, config or not.
  {
    const root = mkGitProjectRoot({ baseConfig: CONFIG_TRUE });
    const r = runHook("git status", root);
    eq(r.code, 0, "hook: unrelated command (git status) is unaffected");
  }

  // Regression: the carve-out is scoped to gh pr merge — other guardrails (e.g.
  // git push --force) stay blocked even with pr.auto_merge: true.
  {
    const root = mkGitProjectRoot({ baseConfig: CONFIG_TRUE });
    const r = runHook("git push --force origin feature-branch", root);
    eq(r.code, 2, "hook: git push --force still blocked (carve-out doesn't leak to other rules)");
  }
}

// ══════════════════════════════════════════════════════════════════════════
// Section C — flow routing: governance/flows/full.yaml and fast.yaml
// From here on, AIDAKIT_PROJECT_ROOT is set process-wide for the flow engine
// (mirrors engine.test.mjs) — no isolated-root assertion may run after this.
// ══════════════════════════════════════════════════════════════════════════
const tmp = mkdtempSync(join(tmpdir(), "pr-automation-flow-"));
process.env.AIDAKIT_PROJECT_ROOT = tmp;
initGitRepo(tmp, "main"); // Fix B: config must live in a real git repo, committed on the base

const { startFlow, resumeFlow } = await import("../engine/engine.js");
const { loadFlow } = await import("../engine/parser.js");
const { loadState } = await import("../engine/persistence.js");

function manifestPathFor(request) { return join(tmp, ".aidakit", "tasks", request, "doc-manifest.json"); }
function seedSatisfiedManifest(request) {
  const p = manifestPathFor(request);
  mkdirSync(join(p, ".."), { recursive: true });
  writeFileSync(p, JSON.stringify({ change_id: request, level: "change", required: [] }));
}
// THE ACCEPTANCE (GOAL) LEASH: both flows now gate check_docs → acceptance →
// check_acceptance → pr (acceptance-leash change). Seed a satisfied
// acceptance-manifest alongside the doc-manifest so these pr-automation
// scenarios (unrelated to the acceptance-leash) pass through it untouched.
function acceptanceManifestPathFor(request) { return join(tmp, ".aidakit", "tasks", request, "acceptance-manifest.json"); }
function seedSatisfiedAcceptanceManifest(request) {
  const p = acceptanceManifestPathFor(request);
  mkdirSync(join(p, ".."), { recursive: true });
  writeFileSync(p, JSON.stringify({
    change_id: request, level: "change",
    required: [{ criterion_id: "seed", criterion: "test seed", evidence: { kind: "file", path: "README.md" }, status: "n/a", condition: "pr-automation test seed — no live criteria to verify in this drive" }],
  }));
}
function benchPathFor(request) { return join(tmp, ".aidakit", "tasks", request, "bench.ndjson"); }
function seedSatisfiedBench(request, { round = 1, pass = true } = {}) {
  const p = benchPathFor(request);
  mkdirSync(join(p, ".."), { recursive: true });
  const hh = String(round).padStart(2, "0");
  const verdict = pass ? "pass" : "fail";
  const lines = [
    { bench: "review", round, role: "__manifest__", roles: ["adr-reviewer", "spec-reviewer"], at: `2026-07-17T${hh}:00:00.000Z` },
    { bench: "review", round, role: "adr-reviewer", verdict: "pass", dispatched_at: `2026-07-17T${hh}:00:01.000Z`, returned_at: `2026-07-17T${hh}:00:05.000Z` },
    { bench: "review", round, role: "spec-reviewer", verdict, dispatched_at: `2026-07-17T${hh}:00:02.000Z`, returned_at: `2026-07-17T${hh}:00:06.000Z` },
  ];
  writeFileSync(p, lines.map((l) => JSON.stringify(l)).join("\n") + "\n");
}
function selectAnswer(changeId) { return { outcome: "success", output: { change_id: changeId } }; }
function resumeWith(state, flow, answer) {
  const resumeValue = typeof answer === "string" ? answer : answer.outcome;
  const resumeOutput = typeof answer === "string" ? undefined : answer.output;
  return resumeFlow({ state, flow, resumeValue, resumeOutput });
}
function driveDry(flowName, inputs, answers) {
  const { flow } = loadFlow(flowName);
  let res = startFlow({ flow, inputs, startedBy: "test" });
  const visited = [];
  let guard = 0;
  while (res.state.status === "paused" && guard++ < 50) {
    const p = res.state.pause;
    visited.push(p.step_id);
    const answer = answers[p.step_id];
    if (answer === undefined) throw new Error(`no answer for pause "${p.step_id}"`);
    res = resumeWith(loadState(res.state.flow_id), flow, answer);
  }
  return { res, visited };
}

// ── LOAD assertion: both flows parse, and the new step ids resolve ──
{
  for (const name of ["full", "fast"]) {
    const { flow, errors } = loadFlow(name);
    eq(errors, [], `flow ${name}: loads with no parse/validation errors`);
    const ids = flow.steps.map((s) => s.id);
    ok(ids.includes("merge_route"), `flow ${name}: declares the merge_route gate`);
    ok(ids.includes("auto_merge"), `flow ${name}: declares the auto_merge action`);
    ok(ids.includes("merge") && ids.includes("done") && ids.includes("aborted"), `flow ${name}: merge/done/aborted still present`);
    const pr = flow.steps.find((s) => s.id === "pr");
    eq(pr && pr.on_success, "merge_route", `flow ${name}: pr.on_success now routes to merge_route`);
    const mergeRoute = flow.steps.find((s) => s.id === "merge_route");
    if (mergeRoute) {
      eq(mergeRoute.type, "runs", `flow ${name}: merge_route is a runs (deterministic) step`);
      eq(mergeRoute.on_success, "auto_merge", `flow ${name}: merge_route on_success → auto_merge`);
      eq(mergeRoute.on_failure, "merge", `flow ${name}: merge_route on_failure → merge (fallback, default path)`);
    } else {
      ok(false, `flow ${name}: merge_route step exists`);
    }
    const autoMerge = flow.steps.find((s) => s.id === "auto_merge");
    if (autoMerge) {
      eq(autoMerge.type, "invoke", `flow ${name}: auto_merge is an invoke step`);
      eq(autoMerge.invoke_target, "aidakit:merge", `flow ${name}: auto_merge invokes aidakit:merge`);
      eq(autoMerge.on_result, { merged: "done", blocked: "merge", failure: "merge" }, `flow ${name}: auto_merge routes merged→done, blocked/failure→merge`);
    } else {
      ok(false, `flow ${name}: auto_merge step exists`);
    }
  }
}

// ── Default path (no aidakit.config.yaml committed on the flow's project
// root's base branch): byte-identical to today's tail in BOTH flows — the
// extra merge_route hop is invisible in the pause order. ──
{
  const request = "pr-automation-fast-default";
  seedSatisfiedManifest(request);
  seedSatisfiedAcceptanceManifest(request);
  seedSatisfiedBench(request);
  const { res, visited } = driveDry("fast", { request }, {
    select: selectAnswer(request), plan: "success", readiness: "approved", implement: "success", review: "pass",
    document: "success", acceptance: "success", pr: "success", merge: "merged",
  });
  eq(visited, ["select", "plan", "readiness", "implement", "review", "document", "acceptance", "pr", "merge"],
    "fast: default path (no config) pause order is byte-identical to today (plus the acceptance-leash)");
  eq(res.state.status, "completed", "fast: default path completes");
  const mergeRouteRun = res.state.step_history.filter((h) => h.step_id === "merge_route").pop();
  ok(mergeRouteRun && mergeRouteRun.result === "failure" && mergeRouteRun.output.exit_code !== 0,
    "fast: merge_route exits non-zero with no config (routes to the human merge gate)");
}
{
  const request = "pr-automation-full-default";
  seedSatisfiedManifest(request);
  seedSatisfiedAcceptanceManifest(request);
  seedSatisfiedBench(request);
  const { res, visited } = driveDry("full", { request }, {
    select: selectAnswer(request), classify: "success", brainstorm: "done", specify: "success", critic: "ok",
    pre_apply: "yes", readiness: "approved", implement: "success", review_bench: "consensus", hardening: "success",
    learn: "success", document: "success", acceptance: "success", pr: "success", merge: "merged",
  });
  eq(visited,
    ["select", "classify", "brainstorm", "specify", "critic", "pre_apply", "readiness", "implement", "review_bench", "hardening", "learn", "document", "acceptance", "pr", "merge"],
    "full: default path (no config) pause order is byte-identical to today (plus the acceptance-leash)");
  eq(res.state.status, "completed", "full: default path completes");
  const mergeRouteRun = res.state.step_history.filter((h) => h.step_id === "merge_route").pop();
  ok(mergeRouteRun && mergeRouteRun.result === "failure" && mergeRouteRun.output.exit_code !== 0,
    "full: merge_route exits non-zero with no config (routes to the human merge gate)");
}

// ── auto_merge path: the project's BASE branch ("main", the only branch in
// this fixture) now has pr.auto_merge: true COMMITTED — the legitimate,
// already-merged opt-in Fix B requires. ──
commitConfig(tmp, CONFIG_TRUE);

{
  const request = "pr-automation-fast-auto-merged";
  seedSatisfiedManifest(request);
  seedSatisfiedAcceptanceManifest(request);
  seedSatisfiedBench(request);
  const { res, visited } = driveDry("fast", { request }, {
    select: selectAnswer(request), plan: "success", readiness: "approved", implement: "success", review: "pass",
    document: "success", acceptance: "success", pr: "success", auto_merge: "merged",
  });
  eq(visited, ["select", "plan", "readiness", "implement", "review", "document", "acceptance", "pr", "auto_merge"],
    "fast: auto_merge path (merged) reaches auto_merge instead of merge, never pauses at merge");
  eq(res.state.status, "completed", "fast: auto_merge merged → flow completes");
  const mergeRouteRun = res.state.step_history.filter((h) => h.step_id === "merge_route").pop();
  ok(mergeRouteRun && mergeRouteRun.result === "success" && mergeRouteRun.output.exit_code === 0,
    "fast: merge_route exits 0 with pr.auto_merge: true committed on the base branch");
}
{
  const request = "pr-automation-fast-auto-blocked";
  seedSatisfiedManifest(request);
  seedSatisfiedAcceptanceManifest(request);
  seedSatisfiedBench(request);
  const { res, visited } = driveDry("fast", { request }, {
    select: selectAnswer(request), plan: "success", readiness: "approved", implement: "success", review: "pass",
    document: "success", acceptance: "success", pr: "success", auto_merge: "blocked", merge: "merged",
  });
  eq(visited, ["select", "plan", "readiness", "implement", "review", "document", "acceptance", "pr", "auto_merge", "merge"],
    "fast: auto_merge path (blocked) falls back explicitly to the human merge gate");
  eq(res.state.status, "completed", "fast: auto_merge blocked → fallback → human merges → completes");
}
{
  const request = "pr-automation-full-auto-merged";
  seedSatisfiedManifest(request);
  seedSatisfiedAcceptanceManifest(request);
  seedSatisfiedBench(request);
  const { res, visited } = driveDry("full", { request }, {
    select: selectAnswer(request), classify: "success", brainstorm: "done", specify: "success", critic: "ok",
    pre_apply: "yes", readiness: "approved", implement: "success", review_bench: "consensus", hardening: "success",
    learn: "success", document: "success", acceptance: "success", pr: "success", auto_merge: "merged",
  });
  eq(visited,
    ["select", "classify", "brainstorm", "specify", "critic", "pre_apply", "readiness", "implement", "review_bench", "hardening", "learn", "document", "acceptance", "pr", "auto_merge"],
    "full: auto_merge path (merged) reaches auto_merge instead of merge");
  eq(res.state.status, "completed", "full: auto_merge merged → flow completes");
}
{
  const request = "pr-automation-full-auto-failure";
  seedSatisfiedManifest(request);
  seedSatisfiedAcceptanceManifest(request);
  seedSatisfiedBench(request);
  const { res, visited } = driveDry("full", { request }, {
    select: selectAnswer(request), classify: "success", brainstorm: "done", specify: "success", critic: "ok",
    pre_apply: "yes", readiness: "approved", implement: "success", review_bench: "consensus", hardening: "success",
    learn: "success", document: "success", acceptance: "success", pr: "success", auto_merge: "failure", merge: "merged",
  });
  eq(visited,
    ["select", "classify", "brainstorm", "specify", "critic", "pre_apply", "readiness", "implement", "review_bench", "hardening", "learn", "document", "acceptance", "pr", "auto_merge", "merge"],
    "full: auto_merge path (failure) falls back explicitly to the human merge gate too");
  eq(res.state.status, "completed", "full: auto_merge failure → fallback → human merges → completes");
}

console.log(`\n${pass} passed, ${fail} failed`);
rmSync(tmp, { recursive: true, force: true });
process.exit(fail ? 1 : 0);
