#!/usr/bin/env node
// check-plugin-version — validates that the plugin manifest is not behind the doctrine.
// Pure Node, zero-dep (like the other validators). Validator contract:
//   exit 0 = pass (manifest >= every footer) · exit 1 = findings (manifest behind) · exit 2 = usage
//   stdout = JSON { validator, ok, manifest, highest, behind[], scanned } · stderr = md
//
// WHAT IT BLOCKS: a release that ships new doctrine under an old version number.
// The kit carries TWO numberings: every doc/agent/skill ends with a footer
// `<!-- aidakit vX.Y — ... -->` that versions the DOCTRINE, and
// `.claude-plugin/plugin.json` carries the version the INSTALLER reads. Only the
// second one matters to `claude plugin update`, which compares nothing but that
// number: if it did not go up, the update answers "already at the latest" and
// copies NOTHING — the user keeps running old skills/commands against a new
// governance/ until someone figures out they must uninstall + install.
// The two numberings drifted silently once (2026-07-23: footers already declared
// v0.4 for the register mode while the manifest sat at 0.2.1 since before the
// roteiro→design/flow→build rename), and the cost landed on whoever installed it.
//
// The rule is one-directional: the manifest may be AHEAD of the footers (not every
// file changes in a release), never BEHIND. A file exempts itself with
// `<!-- check-plugin-version: ignore -->`.
//
// Usage:
//   node check-plugin-version.js [<root>] [--manifest <path>]
//   defaults: root is the cwd, manifest is <root>/.claude-plugin/plugin.json.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join, relative } from "node:path";

// Doctrine footer: `<!-- aidakit v0.4 — ... -->`. Only major.minor is declared there.
const FOOTER = /<!--\s*aidakit\s+v(\d+)\.(\d+)/gi;
const IGNORE = /<!--\s*check-plugin-version:\s*ignore\s*-->/i;
// Nested copies of the repo (git worktrees live under .claude/) carry their own
// footers and their own manifest — scanning them would compare a tree against
// another tree's doctrine.
const SKIP_DIRS = new Set([".git", "node_modules", ".claude"]);

/** Collects every .md under root, skipping nested repo copies and deps. */
function collectMarkdown(root) {
  const files = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      if (SKIP_DIRS.has(name)) continue;
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (name.endsWith(".md")) files.push(full);
    }
  };
  if (existsSync(root)) walk(root);
  return files;
}

/** "0.2.1" | "0.4" → [major, minor]. Returns null when unparseable. */
function parseVersion(raw) {
  const m = String(raw ?? "").match(/^(\d+)\.(\d+)/);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

const gt = (a, b) => a[0] > b[0] || (a[0] === b[0] && a[1] > b[1]);
const fmt = (v) => `${v[0]}.${v[1]}`;

function main() {
  const argv = process.argv.slice(2);
  const manifestIdx = argv.indexOf("--manifest");
  const positional = argv.filter((a, i) => !a.startsWith("--") && argv[i - 1] !== "--manifest");
  const root = resolve(positional[0] || ".");
  const manifestPath = resolve(manifestIdx >= 0 ? argv[manifestIdx + 1] : join(root, ".claude-plugin/plugin.json"));

  if (!existsSync(manifestPath)) {
    process.stderr.write(`# check-plugin-version\n\nUSAGE — manifest not found: ${manifestPath}\n`);
    process.exit(2);
  }

  let declared;
  try {
    declared = JSON.parse(readFileSync(manifestPath, "utf8")).version;
  } catch (err) {
    process.stderr.write(`# check-plugin-version\n\nUSAGE — unreadable manifest ${manifestPath}: ${err.message}\n`);
    process.exit(2);
  }
  const manifest = parseVersion(declared);
  if (!manifest) {
    // A manifest with no usable version is a finding, not a usage error: the
    // installer cannot compare it, so every update silently no-ops.
    const result = { validator: "aidakit.check-plugin-version", ok: false, manifest: declared ?? null, highest: null, behind: [], scanned: 0 };
    process.stdout.write(JSON.stringify(result) + "\n");
    process.stderr.write(`# check-plugin-version\n\nFAIL — manifest has no parseable version: ${JSON.stringify(declared)}\n`);
    process.exit(1);
  }

  const files = collectMarkdown(root);
  const behind = [];
  let highest = null;

  for (const file of files) {
    const content = readFileSync(file, "utf8");
    if (IGNORE.test(content)) continue;
    for (const m of content.matchAll(FOOTER)) {
      const footer = [Number(m[1]), Number(m[2])];
      if (!highest || gt(footer, highest)) highest = footer;
      if (gt(footer, manifest)) behind.push({ file: relative(root, file), footer: fmt(footer) });
    }
  }

  const ok = behind.length === 0;
  const result = {
    validator: "aidakit.check-plugin-version",
    ok,
    manifest: declared,
    highest: highest ? fmt(highest) : null,
    behind,
    scanned: files.length,
  };
  process.stdout.write(JSON.stringify(result) + "\n");
  if (ok) {
    process.stderr.write(`# check-plugin-version\n\nOK — manifest ${declared} covers the highest footer (v${highest ? fmt(highest) : "none"}), ${files.length} file(s).\n`);
  } else {
    process.stderr.write(
      `# check-plugin-version\n\nFAIL — manifest ${declared} is BEHIND the doctrine (highest footer v${fmt(highest)}).\n` +
        `\`claude plugin update\` compares only this number: it will answer "already at the latest" and copy nothing.\n` +
        `Bump "version" in ${relative(root, manifestPath)} to at least ${fmt(highest)}.0.\n\n` +
        `${behind.length} footer(s) ahead:\n\n`
    );
    // One bump fixes every one of them, so stderr shows only the leaders and says
    // how many it held back — the full list stays on stdout for whoever needs it.
    const SHOWN = 10;
    const sorted = [...behind].sort((a, b) => b.footer.localeCompare(a.footer, undefined, { numeric: true }));
    for (const b of sorted.slice(0, SHOWN)) process.stderr.write(`- ${b.file} declares v${b.footer}\n`);
    if (sorted.length > SHOWN) process.stderr.write(`- … +${sorted.length - SHOWN} more (full list on stdout)\n`);
  }
  process.exit(ok ? 0 : 1);
}

main();
