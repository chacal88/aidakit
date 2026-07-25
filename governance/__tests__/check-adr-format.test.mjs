// Tests check-adr-format — locks the BILINGUAL (PT|EN) behavior of the 5 sections.
// Runs the real CLI (spawnSync) and checks the contract: exit 0/1 + JSON on stdout.
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const VALIDATOR = join(here, "..", "validators", "check-adr-format.js");
const EXAMPLE = join(here, "..", "..", "docs", "examples", "ADR-003-appointment-as-aggregate.md");
const tmp = mkdtempSync(join(tmpdir(), "adr-fmt-"));

let pass = 0, fail = 0;
function ok(c, n) { if (c) pass++; else { fail++; console.log(`FAIL ${n}`); } }

function write(rel, content) {
  const p = join(tmp, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content, "utf8");
  return p;
}
function run(...targets) {
  const res = spawnSync("node", [VALIDATOR, ...targets], { encoding: "utf8" });
  let json = {};
  try { json = JSON.parse(res.stdout.trim().split("\n").pop()); } catch { /* {} */ }
  return { code: res.status, json };
}

const HEAD = "- **Status:** accepted\n- **Date:** 2026-07-20\n";
const adrPT = (extra = "") => `# ADR-013: something\n\n${HEAD}\n## Contexto\nx\n## Decisão\nx\n## Consequências\nx\n## Alternativas consideradas\nx\n${extra}`;
const adrEN = (extra = "") => `# ADR-011: something\n\n${HEAD}\n## Context\nx\n## Decision\nx\n## Consequences\nx\n## Alternatives considered\nx\n${extra}`;

// PT passes.
write("docs/decisions/ADR-013-em-portugues.md", adrPT());
let r = run(join(tmp, "docs/decisions/ADR-013-em-portugues.md"));
ok(r.code === 0 && r.json.ok, "ADR with PT headings passes");

// EN passes (the bug we were fixing).
write("docs/decisions/ADR-011-in-english.md", adrEN());
r = run(join(tmp, "docs/decisions/ADR-011-in-english.md"));
ok(r.code === 0 && r.json.ok, "ADR with EN headings passes (bilingual)");

// A PT+EN mix also passes (independent headings).
write("docs/decisions/ADR-013-mixed.md", `# ADR-013: x\n\n${HEAD}\n## Contexto\nx\n## Decision\nx\n## Consequências\nx\n## Alternatives considered\nx\n`);
r = run(join(tmp, "docs/decisions/ADR-013-mixed.md"));
ok(r.code === 0 && r.json.ok, "ADR with mixed PT+EN headings passes");

// A missing section fails (removing Decision/Decisão).
write("docs/decisions/ADR-013-missing-decision.md", `# ADR-013: x\n\n${HEAD}\n## Context\nx\n## Consequences\nx\n## Alternatives considered\nx\n`);
r = run(join(tmp, "docs/decisions/ADR-013-missing-decision.md"));
ok(r.code === 1 && !r.json.ok, "ADR missing the Decision/Decisão section fails");
ok(r.json.errors.some((e) => e.rule === "section-decision"), "error points to section-decision");

// A status outside the vocabulary fails.
write("docs/decisions/ADR-014-bad-status.md", `# ADR-014: x\n\n- **Status:** maybe\n- **Date:** 2026-07-20\n\n## Context\nx\n## Decision\nx\n## Consequences\nx\n## Alternatives considered\nx\n`);
r = run(join(tmp, "docs/decisions/ADR-014-bad-status.md"));
ok(r.code === 1 && r.json.errors.some((e) => e.rule === "status-invalid"), "status outside the vocabulary fails");

// The kit's EXAMPLE ADR (EN headings) passes again — the regression that motivated the fix.
r = run(EXAMPLE);
ok(r.code === 0 && r.json.ok, "the kit's example ADR (EN) passes again");

// An HTML comment / filename containing the word "status" must NOT be mistaken for the
// status line (e.g. ADR-002-roadmap-status-...). Valid status → still passes.
write("docs/decisions/ADR-015-roadmap-status-derived.md", `<!-- File: docs/decisions/ADR-015-roadmap-status-derived.md — never recycled -->\n# ADR-015: x\n\n- **Status:** accepted\n- **Date:** 2026-07-20\n\n## Context\nx\n## Decision\nx\n## Consequences\nx\n## Alternatives considered\nx\n`);
r = run(join(tmp, "docs/decisions/ADR-015-roadmap-status-derived.md"));
ok(r.code === 0 && r.json.ok, "a filename/comment with 'status' is not mistaken for the status line");

console.log(`\n${pass} passed, ${fail} failed`);
rmSync(tmp, { recursive: true, force: true });
process.exit(fail ? 1 : 0);
