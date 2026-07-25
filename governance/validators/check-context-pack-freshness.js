#!/usr/bin/env node
// check-context-pack-freshness — hash-invalidation validator for `.context-pack.md` (ADR-013).
// Reads the pack's frontmatter, walks its OWN `sources[]` only, recomputes each
// file's sha256, and exits 0 iff every declared source still matches. Never
// globs the repo — a file that is not one of the pack's declared sources
// cannot invalidate it (that's the whole point of the source-scoped design;
// cross-change invalidation is L2's problem, not L1's).
//
// SEPARATE from check-doc-manifest.js by design (ADR-013 §neg-consequence):
// a stale pack must never add a `doc-missing` finding to the doc-leash.
//
// Pure Node, zero-dep. Contract: exit 0 fresh · 1 stale · 2 usage/error. JSON stdout + human stderr.
//
// Usage: node check-context-pack-freshness.js <path-to-.context-pack.md>

import { existsSync, readFileSync, statSync, lstatSync, realpathSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, dirname, isAbsolute, relative } from "node:path";
import { parse as parseYaml } from "../engine/yaml-min.js";
import { resolveProjectRoot } from "../engine/project-root.js";

function fail(msg) { process.stderr.write(`check-context-pack-freshness — error: ${msg}\n`); process.exit(2); }

function sha256(buf) { return createHash("sha256").update(buf).digest("hex"); }

function main() {
  const argv = process.argv.slice(2);
  const jsonOnly = argv.includes("--json");
  const packPath = argv.find((a) => !a.startsWith("--"));
  if (!packPath) fail("usage: check-context-pack-freshness <path-to-.context-pack.md>");
  if (!existsSync(packPath)) fail(`pack not found: ${packPath}`);

  const content = readFileSync(packPath, "utf8");
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(content);
  if (!m) fail(`pack has no --- frontmatter block: ${packPath}`);

  let fm;
  try { fm = parseYaml(m[1]); }
  catch (e) { fail(`frontmatter failed to parse: ${e.message}`); }

  const sources = Array.isArray(fm.sources) ? fm.sources : [];

  // Same convention as check-doc-manifest.js: AIDAKIT_PROJECT_ROOT wins,
  // otherwise climb from the pack's own directory (round-1 bench fix,
  // quality-important: single shared owner via resolveProjectRoot, see
  // governance/engine/project-root.js).
  const root = resolveProjectRoot(undefined, dirname(resolve(packPath)));
  // The root itself may sit behind a symlink hop that has nothing to do with
  // sources[] (e.g. macOS's /tmp -> /private/tmp, or /var -> /private/var).
  // Resolve it ONCE here so the per-source realpath compare below only ever
  // flags a symlink INSIDE the declared relative path, not host/OS plumbing
  // that a legitimate checkout can sit on.
  let realRoot;
  try { realRoot = realpathSync(root); }
  catch { realRoot = root; } // root itself unresolvable — fall through, later checks will fail closed anyway

  const errors = [];
  for (const src of sources) {
    if (!src || typeof src.path !== "string" || typeof src.sha256 !== "string") {
      errors.push({ rule: "source-entry-invalid", message: `malformed sources[] entry: ${JSON.stringify(src)}` });
      continue;
    }
    // SECURITY (round-1 bench, Security veto #1): a committed pack whose
    // sources[N].path is absolute (or escapes root via `..` traversal) turns
    // this validator into a local file existence + hash oracle — no code
    // execution needed, just a crafted frontmatter block. Reject BOTH shapes
    // as a malformed entry, before ever touching the filesystem.
    if (isAbsolute(src.path)) {
      errors.push({ rule: "source-entry-invalid", path: src.path, message: `source-entry-invalid: absolute paths are not allowed in sources[]: ${src.path}` });
      continue;
    }
    const abs = resolve(root, src.path);
    const rel = relative(root, abs);
    if (rel.startsWith("..") || isAbsolute(rel)) {
      errors.push({ rule: "source-entry-invalid", path: src.path, message: `source-entry-invalid: path escapes the project root: ${src.path}` });
      continue;
    }
    // SECURITY (round-2 bench, Security veto; superseded round-3): the
    // round-2 fix rejected a symlinked LEAF via lstat — but POSIX path
    // resolution follows symlinks for every path segment EXCEPT the final
    // one, and lstat does not change that for ancestors. A symlinked
    // INTERMEDIATE directory (e.g. docs/features/<change>/assets ->
    // /outside/dir, with sources[].path = ".../assets/secret.txt" where
    // secret.txt is an ordinary file, not a symlink) silently redirects the
    // whole subtree outside root while lstat(leaf).isSymbolicLink() is
    // false — the leaf-only check missed it entirely (round-3 finding).
    // Policy: NO symlink anywhere in the path chain, leaf OR ancestor.
    // realpathSync resolves ALL symlinks in the path per POSIX; if the
    // result differs from the expected fully-resolved path (root's own
    // realpath + the string-resolved relative path — see expectedReal
    // below), the chain contained at least one symlink hop → reject before
    // ever reading the real target, regardless of whether that target
    // exists or lives inside or outside root. This subsumes (and replaces)
    // the leaf-only lstat-reject from round 2.
    // Expected fully-resolved path IF no symlink appears anywhere inside the
    // declared relative path: root's own realpath (already resolved above)
    // plus the same relative path, string-resolved (no filesystem access).
    const expectedReal = resolve(realRoot, rel);
    let real;
    try {
      real = realpathSync(abs);
    } catch (e) {
      if (e.code === "ENOENT") {
        // Distinguish "the source path never existed" from "the source is
        // a broken symlink (or a symlink chain with a missing final
        // target)": if lstat succeeds on the leaf, something IS there
        // (just not resolvable) — that is a symlink-shaped problem, not a
        // plain missing file.
        let lst = null;
        try { lst = lstatSync(abs); } catch { /* leaf itself is missing too */ }
        if (lst) {
          errors.push({ rule: "source-entry-invalid", path: src.path, message: `source-entry-invalid: symlinks are not allowed in sources[]: ${src.path}` });
          continue;
        }
        errors.push({ rule: "source-missing", path: src.path, message: `source-missing: ${src.path}` });
        continue;
      }
      errors.push({ rule: "source-entry-invalid", path: src.path, message: `source-entry-invalid: could not resolve path: ${src.path}` });
      continue;
    }
    if (real !== expectedReal) {
      errors.push({ rule: "source-entry-invalid", path: src.path, message: `source-entry-invalid: symlinks are not allowed in sources[]: ${src.path}` });
      continue;
    }
    // Belt-and-suspenders: re-check root containment against the REAL path,
    // in case realpath ever resolved to something that matches `expectedReal`
    // textually but escaped root via a traversal we didn't anticipate.
    const relReal = relative(realRoot, real);
    if (relReal.startsWith("..") || isAbsolute(relReal)) {
      errors.push({ rule: "source-entry-invalid", path: src.path, message: `source-entry-invalid: path escapes the project root: ${src.path}` });
      continue;
    }
    let lst;
    try { lst = lstatSync(abs); }
    catch { lst = null; } // entry does not exist at all
    if (!lst || !lst.isFile()) {
      errors.push({ rule: "source-missing", path: src.path, message: `source-missing: ${src.path}` });
      continue;
    }
    const actual = sha256(readFileSync(abs));
    if (actual !== src.sha256) {
      errors.push({
        rule: "source-diverged",
        path: src.path,
        message: `source diverged: ${src.path} (expected sha256 ${src.sha256}, found ${actual})`,
      });
    }
  }

  const result = {
    validator: "aidakit.check-context-pack-freshness",
    ok: errors.length === 0,
    path: packPath,
    sources_checked: sources.length,
    errors,
  };
  process.stdout.write(JSON.stringify(result) + "\n");
  if (!jsonOnly) {
    if (errors.length === 0) {
      process.stderr.write(`# check-context-pack-freshness\n\nOK — ${sources.length} source(s) fresh.\n`);
    } else {
      process.stderr.write(`# check-context-pack-freshness\n\nSTALE — ${errors.length} problem(s):\n\n`);
      for (const e of errors) process.stderr.write(`- ${e.message}\n`);
    }
  }
  process.exit(errors.length === 0 ? 0 : 1);
}

main();
