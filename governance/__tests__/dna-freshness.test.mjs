// Tests check-dna-freshness — DNA goes stale when its source ADR is superseded.
// Runs the real CLI (spawnSync) and checks the contract: exit 0/1 + JSON on stdout.
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const VALIDATOR = join(here, "..", "validators", "check-dna-freshness.js");
const tmp = mkdtempSync(join(tmpdir(), "dna-fresh-"));

let pass = 0, fail = 0;
function ok(c, n) { if (c) pass++; else { fail++; console.log(`FAIL ${n}`); } }

function write(rel, content) {
  const p = join(tmp, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content, "utf8");
  return p;
}

// Well-formed DNA pointing at an ADR — the ADR status decides fresh vs. stale.
function dna(originPremise) {
  return [
    "// @dna-origin-change: feature-x",
    `// @dna-origin-premise: ${originPremise}`,
    "// @dna-type: regression-gate",
    "// @dna-created-at: 2026-07-20",
    "// @dna-trigger: ledger:errorType=agent-rework recurred 3x",
    "export const stub = true;",
  ].join("\n");
}
function adr(id, status) {
  return `# ${id} — something\n\n- **Status**: ${status} · 2026-07-01\n\n## Context\nx\n## Decision\nx\n## Consequences\nx\n## Alternatives considered\nx\n`;
}

function run() {
  const res = spawnSync("node", [VALIDATOR, join(tmp, ".aidakit/dna"), "--adrs", join(tmp, "docs/decisions")], { encoding: "utf8" });
  let json = {};
  try { json = JSON.parse(res.stdout.trim().split("\n").pop()); } catch { /* leave {} */ }
  return { code: res.status, json };
}

// Scenario 1: fresh DNA (accepted ADR) → exit 0.
write(".aidakit/dna/feature-x/regression-a.test.mjs", dna("ADR-020"));
write("docs/decisions/ADR-020-retry.md", adr("ADR-020", "accepted"));
let r = run();
ok(r.code === 0, "accepted ADR → exit 0 (fresh)");
ok(r.json.ok === true && r.json.stale.length === 0, "no stale when the ADR is alive");

// Scenario 2: the ADR becomes superseded → the same DNA goes stale, exit 1.
write("docs/decisions/ADR-020-retry.md", adr("ADR-020", "superseded by ADR-031"));
r = run();
ok(r.code === 1, "superseded ADR → exit 1 (stale)");
ok(r.json.stale.length === 1 && r.json.stale[0].premise === "ADR-020", "points to the stale DNA and its premise");

// Scenario 3: malformed DNA (no provenance) → flagged as malformed, exit 1.
write(".aidakit/dna/feature-x/sem-meta.js", "export const nada = 1;\n");
r = run();
ok(r.code === 1, "DNA without provenance → exit 1");
ok(r.json.malformed.length === 1, "flags the malformed one");

// Scenario 4: empty DNA dir → exit 0 (nothing to validate).
rmSync(join(tmp, ".aidakit/dna"), { recursive: true, force: true });
mkdirSync(join(tmp, ".aidakit/dna"), { recursive: true });
r = run();
ok(r.code === 0, "no DNA → exit 0");

console.log(`\n${pass} passed, ${fail} failed`);
rmSync(tmp, { recursive: true, force: true });
process.exit(fail ? 1 : 0);
