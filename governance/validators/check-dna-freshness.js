#!/usr/bin/env node
// check-dna-freshness — validates that no crystallized DNA has become STALE.
// Pure Node, zero-dep (like the other validators). Validator contract:
//   exit 0 = pass (all DNA fresh) · exit 1 = findings (stale DNA) · exit 2 = usage
//   stdout = JSON { validator, ok, checked, stale[], malformed[] } · stderr = md
//
// WHAT IT BLOCKS: a "gene that becomes its own bug when the world changes". A DNA
// (regression test or rule) was crystallized under a premise — typically an
// ADR. When that ADR is SUPERSEDED/DEPRECATED (the kit already has this vocabulary and
// the bidirectional supersede link, DOCS.md §2.2), the DNA that depended on it may have
// become obsolete: it needs human REVALIDATION before it can hold again.
// This validator connects the DNAs to the supersede graph the kit already maintains.
//
// It also flags MALFORMED DNA — without the required provenance fields there is no
// way to know which premise it depends on, so it cannot be adjudicated (§ same logic
// as check-adr-format: it exists but is out of shape → fail).
//
// Usage:
//   node check-dna-freshness.js [<dna-dir>] [--adrs <adrs-dir>] [--json]
//   defaults: dna in .aidakit/dna, adrs in docs/decisions.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join, basename } from "node:path";
import { collectDna, readDnaProvenance } from "../dna/dna.js";

// Statuses that INVALIDATE the premise (the source ADR no longer holds).
const STATUS_DEAD = /\b(superseded|supersedida|deprecated|revogad[ao])\b/i;
const ADR_NAME = /^ADR-\d{3,}-[a-z0-9-]+\.md$/;

/** Indexes the ADRs by ID (ADR-020) → { status, file }. Only the header matters. */
function indexAdrs(adrsDir) {
  const index = new Map();
  if (!existsSync(adrsDir)) return index;
  for (const name of readdirSync(adrsDir)) {
    if (!ADR_NAME.test(name)) continue;
    const id = (name.match(/^(ADR-\d{3,})/) || [])[1];
    if (!id) continue;
    const content = readFileSync(join(adrsDir, name), "utf8");
    // Status lives on the ADR's 1st status line (check-adr-format guarantees it exists).
    const statusLine = (content.match(/^\s*(-\s*\*\*)?status\b.*$/im) || [""])[0];
    index.set(id, { status: statusLine, file: join(adrsDir, name), dead: STATUS_DEAD.test(statusLine) });
  }
  return index;
}

function main() {
  const argv = process.argv.slice(2);
  const jsonOnly = argv.includes("--json");
  const adrsIdx = argv.indexOf("--adrs");
  const adrsDir = resolve(adrsIdx >= 0 ? argv[adrsIdx + 1] : "docs/decisions");
  const positional = argv.filter((a, i) => !a.startsWith("--") && argv[i - 1] !== "--adrs");
  const dnaDir = resolve(positional[0] || ".aidakit/dna");

  const files = collectDna(dnaDir);
  const adrs = indexAdrs(adrsDir);
  const stale = [];
  const malformed = [];

  for (const file of files) {
    const { meta, missing, typeValid } = readDnaProvenance(file);
    if (missing.length || !typeValid) {
      malformed.push({
        file,
        message: missing.length
          ? `DNA without provenance: missing ${missing.map((c) => `@dna-${c}`).join(", ")}`
          : `DNA with invalid @dna-type: "${meta.type}"`,
      });
      continue;
    }
    const premise = meta["origin-premise"];
    // A premise pointing to an ADR: only invalidates if the ADR is dead.
    const adrId = (premise.match(/^(ADR-\d{3,})/) || [])[1];
    if (adrId) {
      const adr = adrs.get(adrId);
      if (!adr) {
        stale.push({ file, premise, reason: `source ADR ${adrId} not found in ${adrsDir}` });
      } else if (adr.dead) {
        stale.push({ file, premise, reason: `source ADR ${adrId} is ${adr.status.trim()} — revalidate the DNA` });
      }
    }
    // Non-ADR premises (environment, version) have no supersede graph here — they fall
    // outside the scope of this gate (revalidating them is the learn/human's responsibility).
  }

  const ok = stale.length === 0 && malformed.length === 0;
  const result = { validator: "aidakit.check-dna-freshness", ok, checked: files.length, stale, malformed };
  process.stdout.write(JSON.stringify(result) + "\n");
  if (ok) {
    process.stderr.write(`# check-dna-freshness\n\nOK — ${files.length} DNA(s), all fresh.\n`);
  } else {
    process.stderr.write(`# check-dna-freshness\n\nFAIL — ${stale.length} stale, ${malformed.length} malformed in ${files.length} DNA(s):\n\n`);
    for (const s of stale) process.stderr.write(`- STALE ${basename(s.file)} → ${s.reason}\n`);
    for (const m of malformed) process.stderr.write(`- MALFORMED ${basename(m.file)} → ${m.message}\n`);
  }
  process.exit(ok ? 0 : 1);
}

main();
