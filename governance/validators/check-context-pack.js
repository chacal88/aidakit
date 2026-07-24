#!/usr/bin/env node
// check-context-pack — byte-stability + schema validator for `.context-pack.md` (ADR-012).
// Enforces: the frontmatter has the required keys (change_id, built_at_source_hash,
// pack_version, sources[]); the six fixed sections are present, in order; no
// wall-clock timestamp, UUID/random-id or ephemeral tmp-path leaks into the pack
// (byte-stability across builds is the whole point); the pointers-only rule (no
// fenced code excerpts) holds for `code-map-pointers` and `specs`.
// Pure Node, zero-dep. Contract: exit 0 pass · 1 findings · 2 usage/error. JSON stdout + human stderr.
//
// Usage: node check-context-pack.js <path-to-.context-pack.md>

import { existsSync, readFileSync } from "node:fs";
import { parse as parseYaml } from "../engine/yaml-min.js";

const REQUIRED_SECTIONS = ["identity", "decisions", "ADRs", "specs", "code-map-pointers", "DoD"];
const REQUIRED_FRONTMATTER_KEYS = ["change_id", "built_at_source_hash", "pack_version", "sources"];

// The schema declares NO timestamp field anywhere — any ISO-8601 instant found
// (frontmatter or body) is a byte-stability violation by construction.
const ISO_TIMESTAMP_RE = /\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z\b/;
const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;
const TMP_PATH_RE = /\/tmp\/\S*/;
const FENCE_RE = /```/;

function fail(msg) { process.stderr.write(`check-context-pack — error: ${msg}\n`); process.exit(2); }

function splitFrontmatter(content) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(content);
  if (!m) return null;
  return { frontmatterText: m[1], body: m[2] };
}

/** Finds the `key:` a matched substring's line belongs to, for error messages
 * that name the offending field instead of just the pattern. */
function fieldNameForMatch(content, matchStr) {
  const idx = content.indexOf(matchStr);
  if (idx < 0) return null;
  const lineStart = content.lastIndexOf("\n", idx) + 1;
  const lineEnd = content.indexOf("\n", idx);
  const line = content.slice(lineStart, lineEnd === -1 ? content.length : lineEnd);
  const km = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/.exec(line);
  return km ? km[1] : null;
}

function extractSection(body, name) {
  const re = new RegExp(`^##\\s+${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "m");
  const m = re.exec(body);
  if (!m) return null;
  const start = m.index + m[0].length;
  const rest = body.slice(start);
  const next = /^##\s+/m.exec(rest);
  return next ? rest.slice(0, next.index) : rest;
}

function main() {
  const argv = process.argv.slice(2);
  const jsonOnly = argv.includes("--json");
  const packPath = argv.find((a) => !a.startsWith("--"));
  if (!packPath) fail("usage: check-context-pack <path-to-.context-pack.md>");
  if (!existsSync(packPath)) fail(`pack not found: ${packPath}`);

  const content = readFileSync(packPath, "utf8");
  const errors = [];
  const split = splitFrontmatter(content);

  let fm = null;
  if (!split) {
    errors.push({ rule: "frontmatter-missing", message: "pack has no --- frontmatter block" });
  } else {
    try { fm = parseYaml(split.frontmatterText); }
    catch (e) { errors.push({ rule: "frontmatter-invalid", message: `frontmatter failed to parse: ${e.message}` }); }
  }

  if (fm) {
    for (const key of REQUIRED_FRONTMATTER_KEYS) {
      if (!(key in fm)) errors.push({ rule: "frontmatter-missing-key", field: key, message: `frontmatter missing required key: ${key}` });
    }
    // An empty `sources:` key with nothing nested under it parses to `null`
    // (yaml-min has no empty-list literal) — that's a well-formed empty list,
    // not a schema violation.
    if ("sources" in fm && fm.sources !== null && !Array.isArray(fm.sources)) {
      errors.push({ rule: "sources-not-array", message: "frontmatter 'sources' must be a list (possibly empty)" });
    }
  }

  // Wall-clock / random-id / tmp-path — byte-stability violations, checked on
  // the whole file (frontmatter + body): the schema has no legitimate slot for any of them.
  const isoMatch = ISO_TIMESTAMP_RE.exec(content);
  if (isoMatch) {
    const field = fieldNameForMatch(content, isoMatch[0]);
    errors.push({
      rule: "wall-clock-forbidden",
      field,
      message: `wall-clock timestamp found${field ? ` in field "${field}"` : ""} (byte-stability violation): "${isoMatch[0]}"`,
    });
  }
  const uuidMatch = UUID_RE.exec(content);
  if (uuidMatch) {
    errors.push({ rule: "random-id-forbidden", message: `random id / UUID found (byte-stability violation): "${uuidMatch[0]}"` });
  }
  const tmpMatch = TMP_PATH_RE.exec(content);
  if (tmpMatch) {
    errors.push({ rule: "tmp-path-forbidden", message: `ephemeral tmp path found (byte-stability violation): "${tmpMatch[0].trim()}"` });
  }

  // Six fixed sections, in order.
  let body = split ? split.body : content;
  const headingRe = /^##\s+(.+?)\s*$/gm;
  const found = [];
  let hm;
  while ((hm = headingRe.exec(body))) found.push(hm[1].trim());
  for (const section of REQUIRED_SECTIONS) {
    if (!found.includes(section)) errors.push({ rule: "section-missing", section, message: `required section missing: ## ${section}` });
  }
  const foundRequired = found.filter((f) => REQUIRED_SECTIONS.includes(f));
  const expectedOrder = REQUIRED_SECTIONS.filter((s) => foundRequired.includes(s));
  if (JSON.stringify(foundRequired) !== JSON.stringify(expectedOrder)) {
    errors.push({ rule: "section-order", message: `sections out of order: found ${JSON.stringify(foundRequired)}, expected ${JSON.stringify(expectedOrder)}` });
  }

  // Pointers-only rule: no fenced code blocks under code-map-pointers or specs.
  for (const section of ["code-map-pointers", "specs"]) {
    const sectionText = extractSection(body, section);
    if (sectionText && FENCE_RE.test(sectionText)) {
      errors.push({ rule: "excerpt-forbidden", section, message: `pointers-only rule violated: fenced code block found in ## ${section}` });
    }
  }

  const result = { validator: "aidakit.check-context-pack", ok: errors.length === 0, path: packPath, errors };
  process.stdout.write(JSON.stringify(result) + "\n");
  if (!jsonOnly) {
    if (errors.length === 0) {
      process.stderr.write(`# check-context-pack\n\nOK — pack is well-formed and byte-stable.\n`);
    } else {
      process.stderr.write(`# check-context-pack\n\nFAIL — ${errors.length} problem(s):\n\n`);
      for (const e of errors) process.stderr.write(`- ${e.message}\n`);
    }
  }
  process.exit(errors.length === 0 ? 0 : 1);
}

main();
