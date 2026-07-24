#!/usr/bin/env node
// check-links — validates that every internal markdown link resolves (DOCS.md rule 4).
// Pure Node, zero-dep (like hooks/pre-bash.js). Validator contract:
//   exit 0 = pass · exit 1 = findings (broken links) · exit 2 = usage error
//   stdout = JSON { validator, ok, errors[] } · stderr = readable markdown report
//
// Usage:
//   node check-links.js <file-or-directory> [...]   checks the given .md files/under the dir
//   node check-links.js --json <...>                 only the JSON on stdout
//
// A link is "internal" if it doesn't start with http(s):// or mailto:. Anchors (#...) and
// query (?...) are stripped before resolving the path. A link to a directory resolves
// if the directory exists. It does NOT follow the external link (that's network — out of scope).
//
// The directory walk skips node_modules, .git*, .claude/ (nested worktree checkouts are
// other branches' files, same skip as check-plugin-version.js) and docs/archive/ (WORM
// jurisprudence — an archived doc's links reflect the tree at archive time, not today's).
// Exclusions apply to the walk only; a file passed explicitly is always checked.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, dirname, basename, join } from "node:path";

const LINK_RE = /\[[^\]]*\]\(([^)]+)\)/g;

/** Collects all .md files under the given paths (file → itself; dir → recursive). */
function collectMd(paths) {
  const out = [];
  const walk = (p) => {
    if (!existsSync(p)) return;
    const st = statSync(p);
    if (st.isDirectory()) {
      for (const name of readdirSync(p)) {
        if (name === "node_modules" || name.startsWith(".git")) continue;
        if (name === ".claude") continue; // nested worktree checkouts
        if (name === "archive" && basename(p) === "docs") continue; // WORM archive
        walk(join(p, name));
      }
    } else if (p.endsWith(".md")) {
      out.push(p);
    }
  };
  for (const p of paths) walk(resolve(p));
  return out;
}

/**
 * A file can declare itself exempt with `<!-- check-links: ignore -->` at the top
 * (e.g. a filled-in example whose links reflect ANOTHER repo, not this one). It's the
 * explicit grandfathering — the exemption stays versioned in the file itself.
 */
function isExempt(content) {
  return /<!--\s*check-links:\s*ignore\s*-->/.test(content);
}

/** Extracts internal links from a file, ignoring fenced code blocks (```). */
function internalLinks(file) {
  const content = readFileSync(file, "utf8");
  if (isExempt(content)) return [];
  const lines = content.split(/\r?\n/);
  const links = [];
  let fenced = false;
  lines.forEach((line, i) => {
    if (line.trim().startsWith("```")) { fenced = !fenced; return; }
    if (fenced) return;
    let m;
    LINK_RE.lastIndex = 0;
    while ((m = LINK_RE.exec(line)) !== null) {
      const href = m[1].split(/\s+/)[0]; // ignore the title "(...)" after a space
      if (/^(https?:|mailto:|#)/.test(href)) continue; // external or pure anchor
      // Template/example placeholders are NOT real links to resolve:
      // {{slug}}, <change-id>, ADR-NNN, ADR-016-slug (format illustration).
      if (/\{\{|\}\}|<[^>]+>|\bNNN\b|-slug\b/.test(href)) continue;
      const path = href.split("#")[0].split("?")[0];
      if (!path) continue;
      links.push({ href, path, line: i + 1 });
    }
  });
  return links;
}

function main() {
  const argv = process.argv.slice(2);
  const jsonOnly = argv.includes("--json");
  const targets = argv.filter((a) => !a.startsWith("--"));
  if (targets.length === 0) {
    process.stderr.write("usage: check-links <file-or-directory> [...]\n");
    process.exit(2);
  }
  const files = collectMd(targets);
  const errors = [];
  for (const file of files) {
    for (const { href, path, line } of internalLinks(file)) {
      const target = resolve(dirname(file), path);
      if (!existsSync(target)) {
        errors.push({ rule: "link-broken", file, line, href, message: `internal link does not resolve: ${href}` });
      }
    }
  }
  const result = { validator: "aidakit.check-links", ok: errors.length === 0, files_checked: files.length, errors };
  if (jsonOnly) {
    process.stdout.write(JSON.stringify(result) + "\n");
  } else {
    process.stdout.write(JSON.stringify(result) + "\n");
    if (errors.length === 0) {
      process.stderr.write(`# check-links\n\nOK — ${files.length} file(s), no broken links.\n`);
    } else {
      process.stderr.write(`# check-links\n\nFAIL — ${errors.length} broken link(s) in ${files.length} file(s):\n\n`);
      for (const e of errors) process.stderr.write(`- ${e.file}:${e.line} → \`${e.href}\`\n`);
    }
  }
  process.exit(errors.length === 0 ? 0 : 1);
}

main();
