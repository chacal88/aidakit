// Tests check-adr-format and check-doc-manifest (the documentation leash).
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const tmp = mkdtempSync(join(tmpdir(), "check-docs-"));
const adrVal = new URL("../validators/check-adr-format.js", import.meta.url).pathname;
const manVal = new URL("../validators/check-doc-manifest.js", import.meta.url).pathname;

let pass = 0, fail = 0;
function ok(c, n) { if (c) pass++; else { fail++; console.log(`FAIL ${n}`); } }
function run(validator, args, env = {}) {
  try {
    const out = execFileSync("node", [validator, "--json", ...args], { encoding: "utf8", env: { ...process.env, ...env } });
    return { code: 0, json: JSON.parse(out.trim().split("\n").pop()) };
  } catch (e) {
    const out = (e.stdout || "").trim();
    return { code: e.status, json: out ? JSON.parse(out.split("\n").pop()) : null };
  }
}

// ── check-adr-format ──
// (Bilingual PT|EN coverage lives in check-adr-format.test.mjs; here we use an EN ADR.)
const goodAdr = `# ADR-001: Use Postgres

- **Status:** accepted
- **Date:** 2026-07-17

## Context
We need a database.

## Decision
Postgres.

## Consequences
- Positives: mature.
- Negatives: none — **Accepted**.

## Alternatives considered
| Option | Pros | Cons |
|---|---|---|
| Mongo | flexible | no joins |
`;
writeFileSync(join(tmp, "ADR-001-postgres.md"), goodAdr);
{
  const r = run(adrVal, [join(tmp, "ADR-001-postgres.md")]);
  ok(r.code === 0 && r.json.ok, "complete ADR → valid");
}

// ADR missing the Alternatives section.
writeFileSync(join(tmp, "ADR-002-incomplete.md"), "# ADR-002: X\n\n- **Status:** accepted\n\n## Context\nx\n\n## Decision\ny\n\n## Consequences\nz\n");
{
  const r = run(adrVal, [join(tmp, "ADR-002-incomplete.md")]);
  ok(r.code === 1 && r.json.errors.some((e) => e.rule === "section-alternatives"), "ADR without Alternatives → fails naming the section");
}

// Name outside the pattern.
writeFileSync(join(tmp, "decision.md"), goodAdr);
{
  const r = run(adrVal, [join(tmp, "decision.md")]);
  ok(r.code === 1 && r.json.errors.some((e) => e.rule === "name-invalid"), "name outside ADR-NNN-slug → fails");
}

// ── check-doc-manifest (THE LEASH) ──
const projRoot = join(tmp, "proj");
mkdirSync(join(projRoot, ".aidakit"), { recursive: true });
mkdirSync(join(projRoot, "docs", "features", "feat-x"), { recursive: true });
mkdirSync(join(projRoot, "docs", "decisions"), { recursive: true });

const manifestPath = join(projRoot, ".aidakit", "doc-manifest.json");
function writeManifest(required) {
  writeFileSync(manifestPath, JSON.stringify({ change_id: "feat-x", level: "change", required }, null, 2));
}

// (1) Manifest with missing doc → BLOCKS (exit 1).
writeManifest([
  { doc: "proposal", path: "docs/features/feat-x/proposal.md", status: "pending", kind: "doc" },
]);
{
  const r = run(manVal, [manifestPath], { AIDAKIT_PROJECT_ROOT: projRoot });
  ok(r.code === 1 && !r.json.ok, "leash: required doc absent → gate LOCKED (exit 1)");
  ok(r.json.errors[0].rule === "doc-missing", "leash: error is 'doc-missing'");
}

// (2) Create the doc → RELEASES (exit 0).
writeFileSync(join(projRoot, "docs", "features", "feat-x", "proposal.md"), "# proposal\n");
{
  const r = run(manVal, [manifestPath], { AIDAKIT_PROJECT_ROOT: projRoot });
  ok(r.code === 0 && r.json.ok && r.json.resolved === 1, "leash: doc created → gate RELEASED (exit 0)");
}

// (3) An n/a item is skipped (doesn't block).
writeManifest([
  { doc: "proposal", path: "docs/features/feat-x/proposal.md", status: "resolved", kind: "doc" },
  { doc: "ADR", path: "docs/decisions/ADR-999-x.md", status: "n/a", condition: "only if it touches architecture", kind: "adr" },
]);
{
  const r = run(manVal, [manifestPath], { AIDAKIT_PROJECT_ROOT: projRoot });
  ok(r.code === 0 && r.json.required === 1, "leash: 'n/a' item is skipped, doesn't block");
}

// (4) Required ADR that exists but is malformed → BLOCKS.
writeFileSync(join(projRoot, "docs", "decisions", "ADR-003-bad.md"), "# ADR-003\njust this, no sections\n");
writeManifest([
  { doc: "ADR", path: "docs/decisions/ADR-003-bad.md", status: "pending", kind: "adr" },
]);
{
  const r = run(manVal, [manifestPath], { AIDAKIT_PROJECT_ROOT: projRoot });
  ok(r.code === 1 && r.json.errors[0].rule === "adr-format", "leash: required ADR malformed → blocks");
}

console.log(`\n${pass} passed, ${fail} failed`);
rmSync(tmp, { recursive: true, force: true });
process.exit(fail ? 1 : 0);
