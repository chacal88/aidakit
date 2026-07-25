#!/usr/bin/env node
// check-runtime-bump — fails a PR range that changes the kit's RUNTIME without
// bumping the installer's version number. Sibling of check-plugin-version.js:
// that one compares the manifest against the doctrine FOOTERS at a point in
// time; this one compares a COMMIT RANGE (merge-base of the trusted base ref →
// working tree) against the manifest movement inside that same range.
// Pure Node + the git binary (same footprint as governance/pr/pr-config.js).
// Validator contract:
//   exit 0 = pass (no runtime change in range, or the manifest version rose)
//   exit 1 = findings (runtime changed, manifest did not rise) · exit 2 = usage
//   stdout = JSON { validator, ok, base, mergeBase, baseVersion, headVersion,
//                   bumped, runtime[], changed } · stderr = md
//
// WHAT IT BLOCKS: the 2026-07-25 failure mode (ADR-016). Commits that change
// hooks/pre-bash.js or governance/engine/* landed on main with plugin.json
// untouched; `claude plugin update` compares nothing but that version, answered
// "already at the latest" and copied NOTHING — every installed session kept
// running a stale hook snapshot against a newer main until someone diagnosed
// the cache and bumped 0.9.0 → 0.9.1 by hand (see PR #59's post-mortem).
//
// RUNTIME = files under hooks/ or governance/, EXCEPT any __tests__/ segment
// and *.md (docs) — tests and prose never reach an installed session, code and
// flow/hook wiring do. The base ref is the TRUSTED one shared with ADR-008's
// merge carve-out (governance/pr/pr-config.js resolveBaseRef — single owner,
// never a second copy of that resolution).
//
// Usage:
//   node check-runtime-bump.js [<root>] [--base <ref>]
//   defaults: root is the cwd; base is resolveBaseRef's answer (AIDAKIT_BASE_REF
//   → origin/HEAD → local main/master). Runs against the WORKING TREE, so it
//   catches the miss before the commit as well as on a checked-out PR head.

import { existsSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { execFileSync } from "node:child_process";
import { resolveBaseRef } from "../pr/pr-config.js";

const MANIFEST_REL = ".claude-plugin/plugin.json";
// Path prefixes that ship as installed runtime. A target repo's own hooks/ dir
// would false-positive here, which is why a repo with no plugin manifest at
// either end of the range is a usage error (exit 2), never a finding.
const RUNTIME_PREFIXES = ["hooks/", "governance/"];

/** Runs `git -C <root> <args>`, returning stdout (utf8); throws on any failure. */
function git(root, args) {
  return execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
}

/** Repo-relative path → is it installed runtime? (see RUNTIME above) */
function isRuntime(path) {
  if (!RUNTIME_PREFIXES.some((p) => path.startsWith(p))) return false;
  if (path.split("/").includes("__tests__")) return false;
  if (path.endsWith(".md")) return false;
  return true;
}

/** "0.9.1" → [0, 9, 1] (missing patch = 0). Returns null when unparseable. */
function parseVersion(raw) {
  const m = String(raw ?? "").match(/^(\d+)\.(\d+)(?:\.(\d+))?/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3] ?? 0)] : null;
}

const gt = (a, b) => {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
};

/** JSON-parses a manifest body, returning its raw `version` (undefined on any error). */
function versionOf(body) {
  if (body === null) return undefined;
  try {
    return JSON.parse(body).version;
  } catch {
    return undefined;
  }
}

function usage(msg) {
  process.stderr.write(`# check-runtime-bump\n\nUSAGE — ${msg}\n`);
  process.exit(2);
}

function main() {
  const argv = process.argv.slice(2);
  const baseIdx = argv.indexOf("--base");
  const positional = argv.filter((a, i) => !a.startsWith("--") && argv[i - 1] !== "--base");
  const root = resolve(positional[0] || ".");

  try {
    if (git(root, ["rev-parse", "--is-inside-work-tree"]).trim() !== "true") throw new Error();
  } catch {
    usage(`not a git work tree: ${root}`);
  }

  const base = baseIdx >= 0 ? argv[baseIdx + 1] : resolveBaseRef(root);
  if (!base || base.startsWith("--")) usage("no base ref resolved (pass --base <ref>, set AIDAKIT_BASE_REF, or fetch a remote with a default branch).");

  let mergeBase;
  try {
    mergeBase = git(root, ["merge-base", base, "HEAD"]).trim();
  } catch {
    usage(`no merge-base between ${base} and HEAD (bad ref, unfetched remote, or unrelated histories).`);
  }

  // The range's change set: tracked files that differ between the merge-base
  // and the WORKING TREE (committed + staged + unstaged in one read — a change
  // reverted back to the base content correctly drops out), plus untracked
  // files (a brand-new runtime module not yet `git add`ed must still count).
  const splitZ = (out) => out.split("\0").filter(Boolean);
  const changed = [
    ...new Set([
      ...splitZ(git(root, ["diff", "--name-only", "-z", mergeBase])),
      ...splitZ(git(root, ["ls-files", "--others", "--exclude-standard", "-z"])),
    ]),
  ];
  const runtime = changed.filter(isRuntime).sort();

  const treeManifest = join(root, ...MANIFEST_REL.split("/"));
  const headBody = existsSync(treeManifest) ? readFileSync(treeManifest, "utf8") : null;
  let baseBody = null;
  try {
    baseBody = git(root, ["show", `${mergeBase}:${MANIFEST_REL}`]);
  } catch {
    // absent at the merge-base — either a brand-new manifest (handled below) or
    // not a plugin repo at all (usage, right after).
  }
  if (headBody === null && baseBody === null) usage(`no ${MANIFEST_REL} at either end of the range — not a plugin repository.`);

  const baseRaw = versionOf(baseBody);
  const headRaw = versionOf(headBody);
  const baseVersion = parseVersion(baseRaw);
  const headVersion = parseVersion(headRaw);

  // "Bumped" = the number `claude plugin update` reads ROSE inside the range.
  // Introducing the manifest counts (there was nothing to compare before); an
  // unparseable base counts only if the head is parseable and actually differs
  // (the installer goes from broken to comparable). Everything else is strict
  // semver-greater on [major, minor, patch].
  let bumped;
  if (baseBody === null) bumped = headVersion !== null;
  else if (baseVersion === null) bumped = headVersion !== null && headRaw !== baseRaw;
  else bumped = headVersion !== null && gt(headVersion, baseVersion);

  const ok = runtime.length === 0 || bumped;
  const result = {
    validator: "aidakit.check-runtime-bump",
    ok,
    base,
    mergeBase,
    baseVersion: baseRaw ?? null,
    headVersion: headRaw ?? null,
    bumped,
    runtime,
    changed: changed.length,
  };
  process.stdout.write(JSON.stringify(result) + "\n");

  if (ok) {
    const why = runtime.length === 0 ? "no runtime file changed" : `manifest rose ${baseRaw ?? "(none)"} → ${headRaw}`;
    process.stderr.write(`# check-runtime-bump\n\nOK — ${why} (${base}, ${changed.length} changed file(s)).\n`);
  } else {
    process.stderr.write(
      `# check-runtime-bump\n\nFAIL — runtime changed since ${base} but ${MANIFEST_REL} did not rise ` +
        `(${baseRaw ?? "unparseable"} → ${headRaw ?? "unparseable"}).\n` +
        `\`claude plugin update\` compares only that number: without a bump it answers "already at the latest" ` +
        `and copies nothing — installed sessions keep running the OLD hooks/governance against the new main.\n` +
        `Bump "version" in ${MANIFEST_REL} in this same range.\n\n${runtime.length} runtime file(s) in the range:\n\n`
    );
    const SHOWN = 10;
    for (const f of runtime.slice(0, SHOWN)) process.stderr.write(`- ${f}\n`);
    if (runtime.length > SHOWN) process.stderr.write(`- … +${runtime.length - SHOWN} more (full list on stdout)\n`);
  }
  process.exit(ok ? 0 : 1);
}

main();
