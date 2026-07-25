#!/usr/bin/env node
// rewrite-links — repoints every INBOUND link of a change that is being archived.
// Pure Node, zero-dep (like check-links.js). Tool contract:
//   exit 0 = ran cleanly (0 rewrites is a legitimate result) · exit 2 = usage/ambiguity error
//   stdout = JSON { tool, ok, dry_run, change, from, to, files_changed, rewrites[] }
//   stderr = readable markdown report
//
// Usage:
//   node rewrite-links.js --change <id> [--root <dir>] [--archive-dir <name>] [--apply] [--json]
//
// WHY THIS EXISTS — DOCS.md §2 rule 6 says "a moved doc leaves a stub with the new link
// (anti-link-rot)". That mechanism is unusable for a CHANGE directory: a stub left at
// docs/features/<id>/ is exactly the evidence derive-roadmap-status.js reads as
// "in-progress" (ADR-002), so stubbing an archived change would pin it as in-flight on the
// roadmap forever. For change dirs the stub is therefore replaced by this rewrite: the
// inbound links are repointed at the real archive destination, and the old location stays
// genuinely empty so the derived status keeps telling the truth. Standalone docs (not a
// change dir) still follow rule 6 and leave a stub — this tool does not touch them.
//
// The move preserves DEPTH (docs/features/<id>/ and docs/archive/<date>-<id>/ are both
// three levels below the root), which is why a change's own outbound `../../../` links
// survive archiving untouched and only INBOUND links need repointing.
//
// The walk skips node_modules, .git*, .claude/ (nested worktree checkouts) and the archive
// itself (WORM jurisprudence — an archived doc's links reflect the tree at archive time,
// not today's; rewriting them would rewrite history). Same exclusions as check-links.js.
//
// Idempotent by construction: a rewritten link points into the archive, which no longer
// matches the docs/features/<id>/ prefix, so re-running is a no-op.

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { resolve, dirname, basename, join, relative, sep } from "node:path";

const LINK_RE = /\[[^\]]*\]\(([^)]+)\)/g;
const ARCHIVE_DIR_RE = /^\d{4}-\d{2}-\d{2}-(.+)$/;

/** Collects the .md files of the LIVING tree (the archive is excluded — it is WORM). */
function collectLivingMd(root) {
  const out = [];
  const walk = (p) => {
    if (!existsSync(p)) return;
    if (statSync(p).isDirectory()) {
      for (const name of readdirSync(p)) {
        if (name === "node_modules" || name.startsWith(".git")) continue;
        if (name === ".claude") continue; // nested worktree checkouts
        if (name === "archive" && basename(p) === "docs") continue; // WORM archive
        if (name === "archive" && basename(p) === "changes") continue; // OpenSpec WORM archive
        walk(join(p, name));
      }
    } else if (p.endsWith(".md")) {
      out.push(p);
    }
  };
  walk(resolve(root));
  return out;
}

/**
 * Detects where a change's WORKING dir and its ARCHIVE live.
 * OpenSpec repos (an openspec/ dir at the root) use openspec/changes/<id>/ →
 * openspec/changes/archive/<id>/; every other repo uses the kit layout
 * docs/features/<id>/ → docs/archive/<YYYY-MM-DD>-<id>/ (DOCS.md §1).
 */
function detectLayout(root) {
  return existsSync(resolve(root, "openspec"))
    ? { working: join("openspec", "changes"), archive: join("openspec", "changes", "archive"), dated: false }
    : { working: join("docs", "features"), archive: join("docs", "archive"), dated: true };
}

/**
 * Resolves the archive destination of a change. In the kit layout the directory carries the
 * archiving DATE (`YYYY-MM-DD-<id>`), which this tool never invents — it reads the one that
 * already exists on disk. Two dated dirs for the same id is an ambiguity a human resolves,
 * never a guess (a wrong pick would silently point every inbound link at the wrong history).
 */
function resolveArchiveDir(root, changeId, layout, override) {
  const archiveRoot = resolve(root, layout.archive);
  if (override) {
    const dir = resolve(archiveRoot, override);
    if (!existsSync(dir)) throw new Error(`--archive-dir does not exist: ${relative(root, dir)}`);
    return dir;
  }
  if (!existsSync(archiveRoot)) throw new Error(`archive root does not exist: ${layout.archive}`);
  if (!layout.dated) {
    const dir = resolve(archiveRoot, changeId);
    if (!existsSync(dir)) throw new Error(`archived change not found: ${join(layout.archive, changeId)}`);
    return dir;
  }
  const matches = readdirSync(archiveRoot).filter((name) => {
    const m = ARCHIVE_DIR_RE.exec(name);
    return m && m[1] === changeId && statSync(join(archiveRoot, name)).isDirectory();
  });
  if (matches.length === 0) {
    throw new Error(`no archived dir for change "${changeId}" under ${layout.archive}/ (expected YYYY-MM-DD-${changeId})`);
  }
  if (matches.length > 1) {
    throw new Error(`ambiguous archive for "${changeId}": ${matches.join(", ")} — pass --archive-dir to pick one`);
  }
  return resolve(archiveRoot, matches[0]);
}

/** True when `target` is the change's working dir itself or a path inside it. */
function isInside(target, dir) {
  return target === dir || target.startsWith(dir + sep);
}

/**
 * Rewrites one file's inbound links, returning the new content and what changed.
 * Fenced code blocks are skipped for the same reason check-links skips them: a link inside
 * a fence is ILLUSTRATING a format, not addressing a file, so rewriting it would corrupt an
 * example. Matches are applied right-to-left so an earlier rewrite cannot shift the offsets
 * of a later one on the same line.
 */
function rewriteFile(file, content, workingDir, archiveDir) {
  const lines = content.split(/\r?\n/);
  const rewrites = [];
  let fenced = false;
  const outLines = lines.map((line, i) => {
    if (line.trim().startsWith("```")) { fenced = !fenced; return line; }
    if (fenced) return line;
    const hits = [];
    let m;
    LINK_RE.lastIndex = 0;
    while ((m = LINK_RE.exec(line)) !== null) {
      const raw = m[1];
      const href = raw.split(/\s+/)[0]; // the title after a space is not part of the href
      if (/^(https?:|mailto:|#)/.test(href)) continue;
      const hashAt = href.search(/[#?]/);
      const path = hashAt === -1 ? href : href.slice(0, hashAt);
      const suffix = hashAt === -1 ? "" : href.slice(hashAt); // #anchor / ?query survives verbatim
      if (!path) continue;
      const target = resolve(dirname(file), path);
      if (!isInside(target, workingDir)) continue;
      const rest = target === workingDir ? "" : target.slice(workingDir.length + 1);
      const dest = rest ? join(archiveDir, rest) : archiveDir;
      let next = relative(dirname(file), dest).split(sep).join("/");
      if (!next.startsWith(".")) next = `./${next}`;
      // Offset of the href inside the line: match start + "[text](" prefix length.
      const hrefStart = m.index + m[0].length - 1 - raw.length;
      hits.push({ start: hrefStart, len: path.length, from: href, to: next + suffix, next });
    }
    if (hits.length === 0) return line;
    let out = line;
    for (const h of hits.reverse()) out = out.slice(0, h.start) + h.next + out.slice(h.start + h.len);
    for (const h of hits) rewrites.push({ file, line: i + 1, from: h.from, to: h.to });
    return out;
  });
  return { content: outLines.join("\n"), rewrites: rewrites.reverse() };
}

function main() {
  const argv = process.argv.slice(2);
  const flag = (name) => {
    const i = argv.indexOf(name);
    return i === -1 ? null : argv[i + 1];
  };
  const jsonOnly = argv.includes("--json");
  const apply = argv.includes("--apply");
  const root = resolve(flag("--root") || ".");
  const changeId = flag("--change");
  if (!changeId || changeId.startsWith("--")) {
    process.stderr.write("usage: rewrite-links --change <id> [--root <dir>] [--archive-dir <name>] [--apply] [--json]\n");
    process.exit(2);
  }

  const layout = detectLayout(root);
  let archiveDir;
  try {
    archiveDir = resolveArchiveDir(root, changeId, layout, flag("--archive-dir"));
  } catch (e) {
    process.stderr.write(`rewrite-links: ${e.message}\n`);
    process.exit(2);
  }
  const workingDir = resolve(root, layout.working, changeId);

  const allRewrites = [];
  const changedFiles = new Set();
  for (const file of collectLivingMd(root)) {
    const before = readFileSync(file, "utf8");
    const { content, rewrites } = rewriteFile(file, before, workingDir, archiveDir);
    if (rewrites.length === 0) continue;
    allRewrites.push(...rewrites.map((r) => ({ ...r, file: relative(root, r.file) })));
    changedFiles.add(relative(root, file));
    if (apply && content !== before) writeFileSync(file, content);
  }

  const result = {
    tool: "aidakit.rewrite-links",
    ok: true,
    dry_run: !apply,
    change: changeId,
    from: relative(root, workingDir).split(sep).join("/"),
    to: relative(root, archiveDir).split(sep).join("/"),
    files_changed: changedFiles.size,
    rewrites: allRewrites,
  };
  process.stdout.write(JSON.stringify(result) + "\n");
  if (!jsonOnly) {
    const mode = apply ? "APPLIED" : "DRY-RUN (pass --apply to write)";
    process.stderr.write(`# rewrite-links — ${changeId}\n\n${mode} — ${allRewrites.length} link(s) in ${changedFiles.size} file(s)\n`);
    process.stderr.write(`\n${result.from}/ → ${result.to}/\n\n`);
    for (const r of allRewrites) process.stderr.write(`- ${r.file}:${r.line} → \`${r.from}\` ⇒ \`${r.to}\`\n`);
  }
  process.exit(0);
}

main();
