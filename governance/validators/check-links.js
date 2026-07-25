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
//
// A link into `docs/features/<change-id>/` that misses on disk gets ONE fallback attempt
// against `docs/archive/<YYYY-MM-DD>-<change-id>/` — see resolveArchived() below.

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

const FEATURES_RE = /^(.*)\/docs\/features\/([^/]+)(?:\/(.+))?$/;

/**
 * Resolves a link into `docs/features/<change-id>/` against the dated archive, via the
 * single key of DOCS.md §2 rule 7 (change-id = branch = PR title suffix = archive dir).
 *
 * WHY this exists: on merge, a change package is promoted WHOLESALE to
 * `docs/archive/<YYYY-MM-DD>-<change-id>/` (DOCS.md §4) — no stub is left behind, because
 * presence under `docs/features/` IS the roadmap status (`derive-roadmap-status.js` reads
 * it as `in-progress`), so a stub would report a shipped change as still in flight. The
 * promotion therefore breaks every inbound citation written while the change was in
 * flight. Frozen documents cannot be repointed after the fact — an ADR is WORM (DOCS.md
 * §2 rule 2: `## Context`, `## Decision`, `## Consequences`, `### Review trigger` and
 * `## Alternatives considered` are never edited after acceptance) — so the resolution
 * belongs here, in the reader, not in a rewrite of the citing document. It is the same
 * principle the `docs/archive/` walk skip already encodes: a frozen doc's links reflect
 * the tree AT WRITING TIME, not today's.
 *
 * Deliberately strict, so this stays a rot-absorber and never a blanket amnesty:
 *  - FALLBACK ONLY — tried after the literal path misses, so a real typo still fails.
 *  - The directory must match `YYYY-MM-DD-<change-id>` EXACTLY. Prefix matching would
 *    make `2026-07-24-archive-loop-var-resume` a false hit for `loop-var-resume` — both
 *    exist in this repo today.
 *  - Ambiguous (>1 dated twin) resolves to nothing and is reported, rather than guessed.
 *  - The file inside the archived package must itself exist; a citation of a document
 *    that never shipped stays broken.
 *
 * Returns the archived target, or null when it does not apply.
 */
function resolveArchived(target) {
  const m = FEATURES_RE.exec(target);
  if (!m) return null;
  const [, prefix, changeId, rest] = m;
  const archiveDir = join(prefix, "docs", "archive");
  if (!existsSync(archiveDir)) return null;
  const escaped = changeId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const dated = new RegExp(`^\\d{4}-\\d{2}-\\d{2}-${escaped}$`);
  const hits = readdirSync(archiveDir).filter((name) => dated.test(name));
  if (hits.length !== 1) return null; // 0 = never archived · >1 = ambiguous, don't guess
  const candidate = rest ? join(archiveDir, hits[0], rest) : join(archiveDir, hits[0]);
  return existsSync(candidate) ? candidate : null;
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
      if (!existsSync(target) && !resolveArchived(target)) {
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
