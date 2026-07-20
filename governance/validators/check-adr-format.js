#!/usr/bin/env node
// check-adr-format — validates that an ADR follows the 5-section format (DOCS.md §2.3):
//   Status+Date · Context · Decision · Consequences · Alternatives considered.
// Also: the ADR-NNN-slug.md file name and a valid status vocabulary.
// The headings and status vocabulary are BILINGUAL (PT|EN): the kit is EN but generates
// prose in the project's `language`, so an ADR is valid in either of the two languages.
// Pure Node, zero-dep. Contract: exit 0 pass · 1 findings · 2 usage. JSON stdout, md stderr.
//
// Usage: node check-adr-format.js <ADR-file-or-directory> [...]
//   In a directory, validates every file whose name matches ADR-\d+-*.md.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join, basename } from "node:path";

const ADR_NAME = /^ADR-\d{3,}-[a-z0-9-]+\.md$/;
// The 5 required sections (by heading, tolerant of accents and case).
// BILINGUAL (PT|EN): the kit is EN but generates prose in the project's `language`; an ADR
// is valid with the headings in either of the two languages ("status" is the same
// word in both). Each regex matches the PT or the EN form.
const SECTIONS = [
  { rule: "section-status", re: /^\s*(-\s*\*\*)?status\b/im, name: "Status" },
  { rule: "section-context", re: /^#+\s*(contexto|context)\b/im, name: "## Contexto / ## Context" },
  { rule: "section-decision", re: /^#+\s*(decis[aã]o|decision)\b/im, name: "## Decisão / ## Decision" },
  { rule: "section-consequences", re: /^#+\s*(consequ[eê]ncias|consequences)\b/im, name: "## Consequências / ## Consequences" },
  { rule: "section-alternatives", re: /^#+\s*(alternativas|alternatives)\b/im, name: "## Alternativas consideradas / ## Alternatives considered" },
];
// Controlled-vocabulary status (DOCS.md §2.2): accepts supersede/amend variations.
const STATUS_OK = /\b(aceita|accepted|proposta|proposed|superseded|supersedida|amends|emenda|deprecated)\b/i;

function collectAdrs(paths) {
  const out = [];
  const walk = (p) => {
    if (!existsSync(p)) return;
    const st = statSync(p);
    if (st.isDirectory()) {
      for (const n of readdirSync(p)) walk(join(p, n));
    } else if (ADR_NAME.test(basename(p))) {
      out.push(p);
    }
  };
  for (const p of paths) {
    const abs = resolve(p);
    // a file given directly is validated even if the name doesn't match (the user asked for it)
    if (existsSync(abs) && statSync(abs).isFile() && abs.endsWith(".md")) out.push(abs);
    else walk(abs);
  }
  return [...new Set(out)];
}

function validateAdr(file) {
  const errors = [];
  const name = basename(file);
  if (!ADR_NAME.test(name)) {
    errors.push({ rule: "name-invalid", file, message: `name does not match the ADR-NNN-slug.md pattern: ${name}` });
  }
  const content = readFileSync(file, "utf8");
  if (/<!--\s*check-adr:\s*ignore\s*-->/.test(content)) return errors.length ? errors : []; // grandfathering
  for (const s of SECTIONS) {
    if (!s.re.test(content)) errors.push({ rule: s.rule, file, message: `required section missing: ${s.name}` });
  }
  // Status present and using a valid vocabulary. Anchor on the real status marker
  // (`- **Status:**` or a `## Status` heading line), and skip HTML comments — a
  // filename in a `<!-- ... -->` banner may contain the word "status" (e.g.
  // ADR-002-roadmap-status-...) and must not be mistaken for the status line.
  const statusLine = content
    .split(/\r?\n/)
    .filter((l) => !/^\s*<!--/.test(l))
    .find((l) => /^\s*(-\s*)?\*{0,2}status\*{0,2}\s*:/i.test(l));
  if (statusLine && !STATUS_OK.test(statusLine)) {
    errors.push({ rule: "status-invalid", file, message: `status outside the controlled vocabulary: "${statusLine.trim()}"` });
  }
  return errors;
}

function main() {
  const argv = process.argv.slice(2);
  const jsonOnly = argv.includes("--json");
  const targets = argv.filter((a) => !a.startsWith("--"));
  if (targets.length === 0) { process.stderr.write("usage: check-adr-format <ADR-or-dir> [...]\n"); process.exit(2); }
  const adrs = collectAdrs(targets);
  const errors = [];
  for (const f of adrs) errors.push(...validateAdr(f));
  const result = { validator: "aidakit.check-adr-format", ok: errors.length === 0, adrs_checked: adrs.length, errors };
  process.stdout.write(JSON.stringify(result) + "\n");
  if (!jsonOnly) {
    if (errors.length === 0) process.stderr.write(`# check-adr-format\n\nOK — ${adrs.length} ADR(s), valid format.\n`);
    else {
      process.stderr.write(`# check-adr-format\n\nFAIL — ${errors.length} problem(s):\n\n`);
      for (const e of errors) process.stderr.write(`- ${basename(e.file)}: ${e.message}\n`);
    }
  }
  process.exit(errors.length === 0 ? 0 : 1);
}

main();
