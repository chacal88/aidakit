// governance/pr/pr-config.js — SINGLE-SOURCE reader for per-project PR
// automation config (aidakit.config.yaml's `pr:` block, ADR-008).
//
// Lives in a PEER DOMAIN PACKAGE (round-3 fix, architecture finding), not in
// governance/engine/ — that directory is reserved for generic flow-execution
// mechanics; PR-automation trust-source resolution, config parsing, and git
// reads are domain logic. Mirrors the existing precedent: governance/roadmap/
// roadmap.js (← governance/validators/derive-roadmap-status.js) and
// governance/dna/dna.js (← governance/validators/check-dna-freshness.js) are
// both peer domain packages wrapped by a thin validator, and both already
// import shared engine mechanics (projectRoot()) from governance/engine/ —
// same pattern this module follows.
//
// Two independent callers consume this module and must NEVER diverge on the
// same root/decision: the `merge_route` flow gate (via
// governance/validators/check-pr-automation.js) and the hooks/pre-bash.js
// `gh pr merge` carve-out (via a dynamic `await import()` from its CJS
// main()). Both resolve the root and read the field the same way because
// both call THIS module — see design.md "Leitura de config".
//
// TRUST SOURCE (round-2 fix, security veto): pr.auto_merge is read from the
// repo's TRUSTED BASE BRANCH via `git show <base-ref>:aidakit.config.yaml` —
// NEVER from the working tree (which, for a PR-carried invocation, IS the
// PR's own diff). Reading the working tree would let a PR grant itself
// autonomous merge by adding `pr.auto_merge: true` to its own change. ADR-008
// frames the opt-in as a PRIOR, already-merged, registered decision — this is
// the code enforcing that framing, not just prose.
//
// Zero external dependency beyond the `git` binary already required elsewhere
// in this kit (derive-roadmap-status.js spawns it the same way) — node:fs/
// node:path/node:child_process plus the engine's own zero-dep yaml-min.js
// parser (no npm package). Fail-closed throughout — any absence, ambiguity,
// or read/git error resolves to `false`; only an EXPLICIT `pr.auto_merge:
// true`, ALREADY COMMITTED on the base ref, grants the opt-in.

import { execFileSync } from "node:child_process";
import { parse } from "../engine/yaml-min.js";
import { resolveProjectRoot } from "../engine/project-root.js";

/**
 * Resolves the target project's root: honors AIDAKIT_PROJECT_ROOT when set;
 * otherwise climbs from `startDir` until a `.aidakit/` marker directory is
 * found. Round-1 bench fix (quality-important, "cut don't copy"): this used
 * to be its OWN copy of the composition; it now delegates to
 * governance/engine/project-root.js's resolveProjectRoot — the single owner
 * shared by every FS-root-resolving call site in the kit (also used by
 * governance/context-pack/build.js, governance/validators/
 * check-context-pack-freshness.js, governance/telemetry/append.js,
 * governance/telemetry/rollup.js, governance/engine/steps/invoke.js).
 * @param {string} startDir
 * @returns {string}
 */
export function resolveRoot(startDir) {
  return resolveProjectRoot(undefined, startDir);
}

/** Runs `git -C <root> <args>`, returning stdout (utf8) or throwing on any
 * non-zero exit / spawn error (no git binary, not a repo, bad ref, ...). */
function git(root, args) {
  return execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
}

/** @param {string} root @returns {boolean} */
function isGitRepo(root) {
  try {
    return git(root, ["rev-parse", "--is-inside-work-tree"]).trim() === "true";
  } catch {
    return false;
  }
}

/** @param {string} root @param {string} name @returns {boolean} */
function localBranchExists(root, name) {
  try {
    git(root, ["rev-parse", "--verify", "--quiet", `refs/heads/${name}`]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolves the TRUSTED base ref whose committed aidakit.config.yaml governs
 * the opt-in (see the module header — never the working tree). Order:
 *   1. An explicit `AIDAKIT_BASE_REF` override (any typo already caught
 *      downstream by a failed `git show`, which fails closed).
 *   2. The remote's default branch, KEPT AS THE REMOTE-TRACKING REF (e.g.
 *      `origin/main`, from `git rev-parse --abbrev-ref origin/HEAD`) — round-3
 *      correctness fix: earlier drafts stripped the "origin/" prefix and
 *      returned the bare local branch name, which is WRONG — a local branch
 *      of the same name can diverge from what origin actually has (that
 *      divergence is exactly the trust boundary this function exists to
 *      protect: a locally-checked-out PR branch must never be able to shadow
 *      the remote-tracked base). Keeping the remote-tracking ref means `git
 *      show origin/main:...` always reads the last-fetched state of the
 *      REMOTE's main, never a possibly-diverged local branch of the same name.
 *   3. A local `main` branch (only reached when there's no usable remote).
 *   4. A local `master` branch.
 * Returns `null` when nothing resolves (no git repo — checked by the caller —
 * no remote, no main, no master, detached HEAD with none of the above): the
 * caller turns that into `false`, never an error.
 * @param {string} root
 * @returns {string|null}
 */
export function resolveBaseRef(root) {
  if (process.env.AIDAKIT_BASE_REF) return process.env.AIDAKIT_BASE_REF;
  try {
    const out = git(root, ["rev-parse", "--abbrev-ref", "origin/HEAD"]).trim();
    if (out && out !== "origin/HEAD") return out; // e.g. "origin/main" — kept verbatim, see the doc comment above
  } catch {
    // no remote / origin/HEAD not set — fall through to the local fallbacks
  }
  for (const candidate of ["main", "master"]) {
    if (localBranchExists(root, candidate)) return candidate;
  }
  return null;
}

/** Reads `<relPath>` as committed AT `ref` (never the working tree). Returns
 * `null` when the ref/path doesn't resolve — absent on that ref, a bad ref,
 * or any git error — the same "absent" treatment a missing file used to get.
 * @param {string} root @param {string} ref @param {string} relPath
 * @returns {string|null}
 */
function readFileAtRef(root, ref, relPath) {
  try {
    return git(root, ["show", `${ref}:${relPath}`]);
  } catch {
    return null;
  }
}

/**
 * Reads `pr.auto_merge` from the repo's TRUSTED BASE BRANCH (see the module
 * header's Trust source note — never the PR's own working tree/checked-out
 * branch). Fail-closed on every edge: not a git repo, no resolvable base ref,
 * config absent on the base, any git/read/parse error, or an ambiguous/
 * non-boolean value — all resolve to `false`. Never throws.
 * @param {string} startDir
 * @returns {boolean}
 */
export function autoMergeEnabled(startDir) {
  try {
    const root = resolveRoot(startDir);
    if (!isGitRepo(root)) return false;
    const baseRef = resolveBaseRef(root);
    if (!baseRef) return false;
    const raw = readFileAtRef(root, baseRef, "aidakit.config.yaml");
    if (raw === null) return false;
    const config = parse(raw);
    if (!config || typeof config !== "object") return false;
    const pr = config.pr;
    if (!pr || typeof pr !== "object") return false;
    return pr.auto_merge === true;
  } catch {
    return false;
  }
}
