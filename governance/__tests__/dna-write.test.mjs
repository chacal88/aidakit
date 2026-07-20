// Tests writeDna — crystallization into staging + round-trip with readDnaProvenance.
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const tmp = mkdtempSync(join(tmpdir(), "dna-write-"));
process.env.AIDAKIT_PROJECT_ROOT = tmp;
const { writeDna, readDnaProvenance, collectDna, DNA_DIR } = await import("../dna/dna.js");

let pass = 0, fail = 0;
function ok(c, n) { if (c) pass++; else { fail++; console.log(`FAIL ${n}`); } }

// Crystallizes a regression test.
const f1 = writeDna({
  changeId: "feature-appointment",
  type: "regression-gate",
  slug: "Idempotent retry must not duplicate",
  originPremise: "ADR-020",
  createdAt: "2026-07-20",
  trigger: "ledger:errorType=agent-rework recurred 3x",
  body: "import assert from 'node:assert';\nassert.ok(true);\n",
});
ok(existsSync(f1), "DNA file was written");
ok(f1.includes(join(DNA_DIR, "feature-appointment")), "lives in .aidakit/dna/<change-id>/");
ok(/regression-idempotent-retry-must-not-duplicate\.test\.mjs$/.test(f1), "kebab name + .test.mjs");

// Round-trip: the written provenance is read back correctly.
const prov = readDnaProvenance(f1);
ok(prov.missing.length === 0, "no required fields missing");
ok(prov.typeValid, "valid type");
ok(prov.meta["origin-change"] === "feature-appointment", "origin-change round-trip");
ok(prov.meta["origin-premise"] === "ADR-020", "origin-premise round-trip");
ok(prov.meta["type"] === "regression-gate", "type round-trip");
ok(readFileSync(f1, "utf8").includes("assert.ok(true)"), "body preserved");

// Crystallizes a rule (validator) — .js extension, rule- prefix.
const f2 = writeDna({
  changeId: "feature-appointment",
  type: "rule",
  slug: "no console.log in production",
  originPremise: "environment:node20",
  createdAt: "2026-07-20",
  body: "process.exit(0);\n",
});
ok(/rule-no-console-log-in-production\.js$/.test(f2), "rule becomes rule-*.js");

// collectDna finds both.
ok(collectDna(join(tmp, DNA_DIR)).length === 2, "collectDna finds the 2 DNAs");

// Error guards.
let threw = false;
try { writeDna({ changeId: "x", type: "bogus", slug: "s", originPremise: "ADR-1", createdAt: "2026-07-20", body: "" }); } catch { threw = true; }
ok(threw, "invalid type throws");
threw = false;
try { writeDna({ changeId: "x", type: "rule", slug: "s", originPremise: "", createdAt: "2026-07-20", body: "" }); } catch { threw = true; }
ok(threw, "empty originPremise throws (invalidation needs it)");
threw = false;
try { writeDna({ changeId: "x", type: "rule", slug: "s", originPremise: "ADR-1", createdAt: "", body: "" }); } catch { threw = true; }
ok(threw, "empty createdAt throws (module does not read the clock)");

console.log(`\n${pass} passed, ${fail} failed`);
rmSync(tmp, { recursive: true, force: true });
process.exit(fail ? 1 : 0);
