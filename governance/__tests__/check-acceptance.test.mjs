// Tests check-acceptance.js — the ACCEPTANCE (GOAL) LEASH. Mirror of
// check-docs.test.mjs's check-doc-manifest coverage, adapted to the
// acceptance-manifest schema (design.md §Validator contract).
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const tmp = mkdtempSync(join(tmpdir(), "check-acceptance-"));
const val = new URL("../validators/check-acceptance.js", import.meta.url).pathname;

let pass = 0, fail = 0;
function ok(c, n) { if (c) pass++; else { fail++; console.log(`FAIL ${n}`); } }
function eq(a, b, n) { const r = JSON.stringify(a) === JSON.stringify(b); if (!r) console.log(`  ${n}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); ok(r, n); }
function run(args, env = {}) {
  try {
    const out = execFileSync("node", [val, "--json", ...args], { encoding: "utf8", env: { ...process.env, ...env } });
    return { code: 0, json: JSON.parse(out.trim().split("\n").pop()) };
  } catch (e) {
    const out = (e.stdout || "").trim();
    return { code: e.status, json: out ? JSON.parse(out.split("\n").pop()) : null };
  }
}

const projRoot = join(tmp, "proj");
mkdirSync(join(projRoot, ".aidakit"), { recursive: true });
mkdirSync(join(projRoot, "governance", "__tests__"), { recursive: true });
mkdirSync(join(projRoot, "docs", "features", "feat-x"), { recursive: true });

const manifestPath = join(projRoot, ".aidakit", "acceptance-manifest.json");
function writeManifest(required, extra = {}) {
  writeFileSync(manifestPath, JSON.stringify({ change_id: "feat-x", level: "change", required, ...extra }, null, 2));
}

// (1) Manifest with a missing evidence path → exit 1, error rule 'evidence-missing'.
writeManifest([
  { criterion_id: "c1", criterion: "widget renders", evidence: { kind: "test", path: "governance/__tests__/nope.test.mjs" }, status: "pending" },
]);
{
  const r = run([manifestPath], { AIDAKIT_PROJECT_ROOT: projRoot });
  ok(r.code === 1 && !r.json.ok, "leash: missing evidence path → gate LOCKED (exit 1)");
  ok(r.json.errors[0].rule === "evidence-missing", "leash: error rule is 'evidence-missing'");
  eq(r.json.errors[0].criterion_id, "c1", "leash: error names the criterion_id");
}

// (2) All evidence paths present → exit 0, resolved === required.
writeFileSync(join(projRoot, "governance", "__tests__", "nope.test.mjs"), "// exists now\n");
{
  const r = run([manifestPath], { AIDAKIT_PROJECT_ROOT: projRoot });
  ok(r.code === 0 && r.json.ok, "leash: evidence path created → gate RELEASED (exit 0)");
  eq(r.json.resolved, r.json.required, "leash: resolved === required when all clear");
}

// (3) status: n/a WITH a condition → skipped, doesn't block.
writeManifest([
  { criterion_id: "c1", criterion: "widget renders", evidence: { kind: "test", path: "governance/__tests__/nope.test.mjs" }, status: "resolved" },
  { criterion_id: "c2", criterion: "no mobile support needed", evidence: { kind: "file", path: "docs/features/feat-x/does-not-exist.md" }, status: "n/a", condition: "mobile is out of scope for this change" },
]);
{
  const r = run([manifestPath], { AIDAKIT_PROJECT_ROOT: projRoot });
  ok(r.code === 0 && r.json.ok, "leash: n/a item with condition is skipped, doesn't block");
  eq(r.json.required, 1, "leash: n/a item excluded from the required count");
}

// (4) status: n/a WITHOUT a condition → exit 2, manifest-invalid.
writeManifest([
  { criterion_id: "c2", criterion: "no mobile support needed", evidence: { kind: "file", path: "docs/features/feat-x/does-not-exist.md" }, status: "n/a" },
]);
{
  const r = run([manifestPath], { AIDAKIT_PROJECT_ROOT: projRoot });
  eq(r.code, 2, "leash: n/a WITHOUT condition → exit 2");
  ok(r.json.errors.some((e) => e.rule === "manifest-invalid"), "leash: n/a without condition is 'manifest-invalid'");
}

// (5) Evidence path with a '#anchor' suffix → anchor stripped before existsSync
// (same convention as check-links.js).
writeFileSync(join(projRoot, "docs", "features", "feat-x", "evidence.md"), "# Evidence\n\n## Some section\n");
writeManifest([
  { criterion_id: "c3", criterion: "captured in evidence.md", evidence: { kind: "evidence-section", path: "docs/features/feat-x/evidence.md#some-section" }, status: "resolved" },
]);
{
  const r = run([manifestPath], { AIDAKIT_PROJECT_ROOT: projRoot });
  ok(r.code === 0 && r.json.ok, "leash: evidence path with #anchor resolves (anchor stripped before existsSync)");
}

// (6) Manifest without a 'required' list → exit 2, manifest-invalid (matches check-doc-manifest.js:43).
writeFileSync(manifestPath, JSON.stringify({ change_id: "feat-x", level: "change" }));
{
  const r = run([manifestPath], { AIDAKIT_PROJECT_ROOT: projRoot });
  eq(r.code, 2, "leash: manifest without 'required' → exit 2");
  ok(r.json.errors.some((e) => e.rule === "manifest-invalid"), "leash: missing 'required' is 'manifest-invalid'");
}

// (6b) OPTIONAL NIT (readiness §12): required: [] (present but empty) is ALSO
// manifest-invalid — distinct from a missing 'required' key entirely (both are
// rejected, but for two different reasons the diagnostics should still name
// consistently as 'manifest-invalid').
writeManifest([]);
{
  const r = run([manifestPath], { AIDAKIT_PROJECT_ROOT: projRoot });
  eq(r.code, 2, "leash: required: [] (empty but present) → exit 2");
  ok(r.json.errors.some((e) => e.rule === "manifest-invalid"), "leash: required: [] is 'manifest-invalid' (distinct from missing key, same rule)");
}

// (7) JSON output contract.
writeManifest([
  { criterion_id: "c1", criterion: "widget renders", evidence: { kind: "test", path: "governance/__tests__/nope.test.mjs" }, status: "resolved" },
]);
{
  const r = run([manifestPath], { AIDAKIT_PROJECT_ROOT: projRoot });
  eq(r.json.validator, "aidakit.check-acceptance", "leash: validator field is 'aidakit.check-acceptance'");
  eq(r.json.change_id, "feat-x", "leash: change_id echoed");
  eq(r.json.level, "change", "leash: level echoed");
  ok(typeof r.json.required === "number" && typeof r.json.resolved === "number", "leash: required/resolved are numbers");
  ok(Array.isArray(r.json.errors), "leash: errors is an array");
}

// (8) status: "resolved" with a NON-EXISTENT evidence.path → still produces
// 'evidence-missing'. Guards the "resolved is not trusted" contract — a manifest
// item lying about being resolved must not skip validation. (bench round 1, Finding D1)
writeManifest([
  { criterion_id: "c1", criterion: "widget renders", evidence: { kind: "test", path: "governance/__tests__/does-not-exist-at-all.test.mjs" }, status: "resolved" },
]);
{
  const r = run([manifestPath], { AIDAKIT_PROJECT_ROOT: projRoot });
  ok(r.code === 1 && !r.json.ok, "leash: status:'resolved' with a non-existent path still LOCKS the gate (exit 1)");
  ok(r.json.errors.some((e) => e.rule === "evidence-missing" && e.criterion_id === "c1"),
    "leash: status:'resolved' does not bypass the 'evidence-missing' check — disk is the truth");
}

// (9) evidence.path pointing at an EXISTING DIRECTORY (not a file) → 'evidence-missing'.
// Exercises the isFile() check, distinct from mere existsSync(). (bench round 1, Finding D3)
mkdirSync(join(projRoot, "governance", "__tests__", "a-directory-not-a-file"), { recursive: true });
writeManifest([
  { criterion_id: "c1", criterion: "widget renders", evidence: { kind: "file", path: "governance/__tests__/a-directory-not-a-file" }, status: "pending" },
]);
{
  const r = run([manifestPath], { AIDAKIT_PROJECT_ROOT: projRoot });
  ok(r.code === 1 && !r.json.ok, "leash: evidence.path pointing at a directory LOCKS the gate (exit 1)");
  ok(r.json.errors.some((e) => e.rule === "evidence-missing" && e.criterion_id === "c1"),
    "leash: a directory is not a file — isFile() rejects it as 'evidence-missing'");
}

// (10) Cross-validation (bench round 1, Finding A): parse-criteria.js finds a
// criterion the manifest doesn't cover → 'criterion-orphan' (exit 1).
mkdirSync(join(projRoot, ".aidakit", "tasks", "feat-x"), { recursive: true });
writeFileSync(join(projRoot, ".aidakit", "tasks", "feat-x", "brainstorm.json"), JSON.stringify({
  acceptance_criteria: [
    { id: "c1", criterion: "widget renders" },
    { id: "orphan-criterion", criterion: "criterion with no manifest entry" },
  ],
}));
writeManifest([
  { criterion_id: "c1", criterion: "widget renders", evidence: { kind: "test", path: "governance/__tests__/nope.test.mjs" }, status: "resolved" },
]);
{
  const r = run([manifestPath], { AIDAKIT_PROJECT_ROOT: projRoot });
  ok(r.code === 1 && !r.json.ok, "leash: a parsed criterion missing from the manifest LOCKS the gate (exit 1)");
  ok(r.json.errors.some((e) => e.rule === "criterion-orphan" && e.criterion_id === "orphan-criterion"),
    "leash: error rule is 'criterion-orphan', naming the orphaned id");
  eq(r.json.parsed_criteria, 2, "leash: parsed_criteria reflects the live parser's count");
}

// (11) Cross-validation: manifest covers every parsed criterion → passes as before,
// no 'criterion-orphan' noise even though parsed_criteria is echoed.
writeManifest([
  { criterion_id: "c1", criterion: "widget renders", evidence: { kind: "test", path: "governance/__tests__/nope.test.mjs" }, status: "resolved" },
  { criterion_id: "orphan-criterion", criterion: "criterion with no manifest entry", evidence: { kind: "test", path: "governance/__tests__/nope.test.mjs" }, status: "resolved" },
]);
{
  const r = run([manifestPath], { AIDAKIT_PROJECT_ROOT: projRoot });
  ok(r.code === 0 && r.json.ok, "leash: manifest covers every parsed criterion → gate RELEASED (exit 0)");
  ok(!r.json.errors.some((e) => e.rule === "criterion-orphan"), "leash: no 'criterion-orphan' when every parsed criterion has a manifest entry");
  eq(r.json.parsed_criteria, 2, "leash: parsed_criteria echoed even on a clean pass");
}

// (12) Cross-validation source fallback: brainstorm.json absent → falls back to
// proposal.md via the SAME parser (parseCriteria), still catching drift.
rmSync(join(projRoot, ".aidakit", "tasks", "feat-x", "brainstorm.json"));
writeFileSync(join(projRoot, "docs", "features", "feat-x", "proposal.md"),
  "# Proposal\n\n## Acceptance criteria\n\n- `c1` — widget renders\n- `orphan-criterion` — criterion with no manifest entry\n");
{
  const r = run([manifestPath], { AIDAKIT_PROJECT_ROOT: projRoot });
  eq(r.json.parsed_criteria, 2, "leash: falls back to proposal.md when brainstorm.json is absent");
  ok(r.code === 0 && r.json.ok, "leash: proposal.md fallback also clears the gate when the manifest covers all parsed ids");
}

// (13) OpenSpec mode: the plan lives in `openspec/changes/<id>/proposal.md`, not
// `docs/features/<id>/`. Reported from psim-kernel, where the cross-check reported
// `parsed_criteria: 0` on a change whose proposal carries 13 criteria — the parser
// looked only at the kit-mode path, found nothing, and 'criterion-orphan' could
// never fire. Same presence-of-directory detection as context-pack's changeDirFor.
mkdirSync(join(projRoot, "openspec", "changes", "feat-x"), { recursive: true });
writeFileSync(join(projRoot, "openspec", "changes", "feat-x", "proposal.md"),
  "# Proposal\n\n## Acceptance criteria\n\n- `c1` — widget renders\n- `orphan-criterion` — criterion with no manifest entry\n- `from-openspec` — criterion only the OpenSpec plan declares\n");
{
  const r = run([manifestPath], { AIDAKIT_PROJECT_ROOT: projRoot });
  eq(r.json.parsed_criteria, 3, "leash: OpenSpec mode reads openspec/changes/<id>/proposal.md");
  ok(r.code === 1 && !r.json.ok, "leash: a criterion only the OpenSpec plan declares LOCKS the gate");
  ok(r.json.errors.some((e) => e.rule === "criterion-orphan" && e.criterion_id === "from-openspec"),
    "leash: 'criterion-orphan' fires on the OpenSpec-sourced criterion");
}

// (14) Precedence: with BOTH directories present, openspec/changes/ wins — the same
// order changeDirFor() applies, so a repo mid-migration reads one plan, not two.
{
  writeFileSync(join(projRoot, "docs", "features", "feat-x", "proposal.md"),
    "# Proposal\n\n## Acceptance criteria\n\n- `kit-mode-only` — must NOT be read when openspec/changes/<id>/ exists\n");
  const r = run([manifestPath], { AIDAKIT_PROJECT_ROOT: projRoot });
  eq(r.json.parsed_criteria, 3, "leash: openspec/changes/ wins over a co-existing docs/features/<id>/");
  ok(!r.json.errors.some((e) => e.criterion_id === "kit-mode-only"),
    "leash: the kit-mode proposal is not read in OpenSpec mode");
}

// ---------------------------------------------------------------------------
// (15)-(20) SECTION BAR (ADR-018) — an `evidence-section` criterion is resolved
// against the SECTION its anchor names, not against the file. Reported from
// psim-kernel: a change closed "OK — 10/10 acceptance criteria resolved" while
// the pointed-at section said PENDENTE in writing, because the file existed
// (it held the other nine criteria) and the anchor was never read.
// ---------------------------------------------------------------------------
const evidenceDir = join(projRoot, "openspec", "changes", "feat-x");
const evidencePath = join(evidenceDir, "evidence.md");
// One proposal, one manifest id, for every case below — the cross-check stays quiet
// so the section bar is the only thing under test.
writeFileSync(join(evidenceDir, "proposal.md"),
  "# Proposal\n\n## Acceptance criteria\n\n- `bench-proof` — the capture exists\n");
function sectionManifest(path) {
  writeManifest([
    { criterion_id: "bench-proof", criterion: "the capture exists", evidence: { kind: "evidence-section", path }, status: "resolved" },
  ]);
}

// (15) Section exists and is complete → gate RELEASED.
writeFileSync(evidencePath, "# Evidence\n\n### `bench-proof`\n\nCaptured on the bench, both devices.\n");
sectionManifest("openspec/changes/feat-x/evidence.md#bench-proof");
{
  const r = run([manifestPath], { AIDAKIT_PROJECT_ROOT: projRoot });
  ok(r.code === 0 && r.json.ok, "section: a complete section clears the gate (exit 0)");
  eq(r.json.enforces.includes("evidence-section-content"), true, "section: the envelope declares the 'evidence-section-content' rule");
}

// (16) THE REGRESSION. File exists (other sections live in it), the anchor names
// a section that is NOT there → 'evidence-section-missing', naming the criterion.
writeFileSync(evidencePath, "# Evidence\n\n### `some-other-criterion`\n\nDone.\n");
{
  const r = run([manifestPath], { AIDAKIT_PROJECT_ROOT: projRoot });
  ok(r.code === 1 && !r.json.ok, "section: an anchor with no matching heading LOCKS the gate (exit 1)");
  ok(r.json.errors.some((e) => e.rule === "evidence-section-missing" && e.criterion_id === "bench-proof"),
    "section: 'evidence-section-missing' names the criterion — the file existing is not the criterion being met");
}

// (17) Section exists but is marked pending — the three markers, one per run.
for (const [label, body] of [
  ["ALL-CAPS word", "> **PENDENTE — blocked on the human gate.**\n"],
  ["emphasised word", "1. Command that triggers the flow: **pendente**\n"],
  ["unchecked box", "- [ ] capture the 5 outputs on both devices\n"],
]) {
  writeFileSync(evidencePath, `# Evidence\n\n### \`bench-proof\`\n\n${body}`);
  const r = run([manifestPath], { AIDAKIT_PROJECT_ROOT: projRoot });
  ok(r.code === 1 && !r.json.ok, `section: a section marked pending (${label}) LOCKS the gate (exit 1)`);
  ok(r.json.errors.some((e) => e.rule === "evidence-section-pending" && e.criterion_id === "bench-proof"),
    `section: 'evidence-section-pending' names the criterion (${label})`);
}

// (18) FENCE AWARENESS. A captured terminal session inside the section contains
// lines that look like headings (`### 1 — comando`) and words that look like
// markers. Reading a fenced line as a heading would truncate the body and hide
// the pendency that follows it — which is exactly the shape of the real file.
writeFileSync(evidencePath, [
  "# Evidence", "", "### `bench-proof`", "",
  "```", "### 1 — comando", "$ curl ... # nothing pending here", "```", "",
  "#### suites", "", "- `door` on both aliases: **pendente**", "",
].join("\n"));
{
  const r = run([manifestPath], { AIDAKIT_PROJECT_ROOT: projRoot });
  ok(r.code === 1 && !r.json.ok, "section: a heading-shaped line inside a code fence does not end the section");
  ok(r.json.errors.some((e) => e.rule === "evidence-section-pending" && e.criterion_id === "bench-proof"),
    "section: pendency AFTER a fenced capture is still seen");
}

// (19) The section ends at the next heading of the same or higher level — a
// pending marker belonging to the NEXT criterion must not block this one.
writeFileSync(evidencePath, [
  "# Evidence", "", "### `bench-proof`", "", "Captured on the bench, both devices.", "",
  "### `another-criterion`", "", "- [ ] not this criterion's problem", "",
].join("\n"));
{
  const r = run([manifestPath], { AIDAKIT_PROJECT_ROOT: projRoot });
  ok(r.code === 0 && r.json.ok, "section: a pending marker in the NEXT section does not block this criterion");
}

// (20) `kind: "evidence-section"` with no anchor at all → 'evidence-anchor-missing'.
// Without this, dropping the anchor would restore the old free pass.
writeFileSync(evidencePath, "# Evidence\n\n### `bench-proof`\n\n> **PENDENTE**\n");
sectionManifest("openspec/changes/feat-x/evidence.md");
{
  const r = run([manifestPath], { AIDAKIT_PROJECT_ROOT: projRoot });
  ok(r.code === 1 && !r.json.ok, "section: evidence-section without an anchor LOCKS the gate (exit 1)");
  ok(r.json.errors.some((e) => e.rule === "evidence-anchor-missing" && e.criterion_id === "bench-proof"),
    "section: 'evidence-anchor-missing' — a section criterion must name its section");
}

// (21) The bar keys on the ANCHOR too, not only on `kind`: a markdown path with
// an anchor is a section promise whatever the kind field says (closes the dodge
// of relabelling the item `kind: "file"`).
writeManifest([
  { criterion_id: "bench-proof", criterion: "the capture exists", status: "resolved",
    evidence: { kind: "file", path: "openspec/changes/feat-x/evidence.md#bench-proof" } },
]);
{
  const r = run([manifestPath], { AIDAKIT_PROJECT_ROOT: projRoot });
  ok(r.code === 1 && !r.json.ok, "section: kind:'file' with a .md#anchor is still judged as a section");
  ok(r.json.errors.some((e) => e.rule === "evidence-section-pending" && e.criterion_id === "bench-proof"),
    "section: relabelling the kind does not buy back the free pass");
}

console.log(`\n${pass} passed, ${fail} failed`);
rmSync(tmp, { recursive: true, force: true });
process.exit(fail ? 1 : 0);
