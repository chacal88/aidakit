// Tests for the context-pack-l1 change (ADR-010):
//   §2  check-context-pack.js        — byte-stability / schema validator
//   §3  check-context-pack-freshness.js — hash-invalidation validator
//   §4  governance/context-pack/build.js — deterministic build/verify/rebuild
//   §5  flow phase `context_pack` in full.yaml / fast.yaml
//   §6  dispatcher/reviewer wiring (read-if-present, no freshness re-check)
//   §7  telemetry: JSONL append helper + engine resume-kwargs extension
//   §8  aidakit:learn rollup into evidence.md
//   §9  ADR-010 format + index registration
//
// Pure Node, no framework — mirrors governance/__tests__/engine.test.mjs / check-docs.test.mjs.

import { mkdtempSync, rmSync, existsSync, mkdirSync, writeFileSync, readFileSync, appendFileSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

let pass = 0, fail = 0;
function ok(c, n) { if (c) pass++; else { fail++; console.log(`FAIL ${n}`); } }

const GOV = new URL("..", import.meta.url).pathname; // governance/
const packVal = join(GOV, "validators", "check-context-pack.js");
const freshVal = join(GOV, "validators", "check-context-pack-freshness.js");
const buildJs = join(GOV, "context-pack", "build.js");
const docManifestVal = join(GOV, "validators", "check-doc-manifest.js");

function run(script, args, env = {}) {
  try {
    const out = execFileSync("node", [script, "--json", ...args], { encoding: "utf8", env: { ...process.env, ...env } });
    return { code: 0, json: JSON.parse(out.trim().split("\n").pop()) };
  } catch (e) {
    const out = (e.stdout || "").trim();
    return { code: e.status, json: out ? JSON.parse(out.split("\n").pop()) : null, stderr: e.stderr ? e.stderr.toString() : "" };
  }
}

function sha256(text) { return createHash("sha256").update(text).digest("hex"); }

// ── fixture helpers ──────────────────────────────────────────────────────

const tmp = mkdtempSync(join(tmpdir(), "context-pack-"));

/** Builds a well-formed pack body (six sections, pointers only, no wall-clock). */
function goodBody() {
  return [
    "## identity",
    "",
    "- change-id: fixture-change",
    "",
    "## decisions",
    "",
    "- design.md:10 — chose X over Y",
    "",
    "## ADRs",
    "",
    "- [ADR-004](docs/decisions/ADR-004-aidakit-governance-env-contract.md) — env contract",
    "",
    "## specs",
    "",
    "- docs/specs/example/spec.md",
    "",
    "## code-map-pointers",
    "",
    "- governance/context-pack/build.js:1-50",
    "",
    "## DoD",
    "",
    "- All ACs satisfied",
    "",
  ].join("\n");
}

/** Builds a well-formed frontmatter block from a sources[] array. */
function goodFrontmatter(sources = []) {
  const lines = ["---", "change_id: fixture-change", `built_at_source_hash: ${sha256(sources.map((s) => s.path + s.sha256).join(""))}`, "pack_version: 1", "sources:"];
  for (const s of sources) {
    lines.push(`  - path: ${s.path}`);
    lines.push(`    sha256: ${s.sha256}`);
  }
  lines.push("---", "");
  return lines.join("\n");
}

function goodPack(sources = []) {
  return goodFrontmatter(sources) + "\n" + goodBody();
}

function writePack(name, content) {
  const p = join(tmp, name);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content);
  return p;
}

// ── §2 check-context-pack.js (byte-stability / schema) ──────────────────

// N2a-i: empty sources[] → exit 0 (an empty pack is well-formed).
{
  const p = writePack("pack-empty-sources.md", goodPack([]));
  const r = run(packVal, [p]);
  ok(r.code === 0 && r.json && r.json.ok, "§pack-byte-stability-empty-sources: empty sources[] → exit 0");
}

// N2a-ii: ISO-8601 timestamp field not covered by the schema → exit 1 naming the field.
{
  const content = goodFrontmatter([]).replace("pack_version: 1", "pack_version: 1\nbuilt_at: 2026-07-25T14:03:12Z") + "\n" + goodBody();
  const p = writePack("pack-wallclock.md", content);
  const r = run(packVal, [p]);
  ok(r.code === 1 && r.json && r.json.errors.some((e) => e.rule === "wall-clock-forbidden" && /built_at/.test(e.message)),
    "§pack-byte-stability-wall-clock-rejected: ISO timestamp outside schema → exit 1 naming the field");
}

// N2a-iii: UUID / tmp-path in a body section → exit 1 naming the pattern.
{
  const body = goodBody().replace("- All ACs satisfied", "- All ACs satisfied (see /tmp/build-9f8c2b3a-1234-4abc-8def-abcdef012345/out)");
  const p = writePack("pack-randomid.md", goodFrontmatter([]) + "\n" + body);
  const r = run(packVal, [p]);
  ok(r.code === 1 && r.json && r.json.errors.some((e) => e.rule === "tmp-path-forbidden" || e.rule === "random-id-forbidden"),
    "§pack-byte-stability-random-id-rejected: UUID/tmp-path in body → exit 1 naming the pattern");
}

// N2a-iv: pack missing one of the six required sections → exit 1 naming the missing section.
{
  const body = goodBody().replace(/## DoD[\s\S]*$/, "");
  const p = writePack("pack-missing-section.md", goodFrontmatter([]) + "\n" + body);
  const r = run(packVal, [p]);
  ok(r.code === 1 && r.json && r.json.errors.some((e) => e.rule === "section-missing" && e.section === "DoD"),
    "§pack-schema-missing-section: missing ## DoD → exit 1 naming the section");
}

// N2a-v: fenced code block under code-map-pointers → exit 1 "pointers-only rule violated".
{
  const body = goodBody().replace("- governance/context-pack/build.js:1-50", "- governance/context-pack/build.js:1-50\n\n```js\nconst x = 1;\n```");
  const p = writePack("pack-excerpt.md", goodFrontmatter([]) + "\n" + body);
  const r = run(packVal, [p]);
  ok(r.code === 1 && r.json && r.json.errors.some((e) => e.rule === "excerpt-forbidden" && /pointers-only rule violated/.test(e.message)),
    "§pack-schema-excerpt-forbidden: fenced code block in code-map-pointers → exit 1 pointers-only rule violated");
}

// ── §3 check-context-pack-freshness.js (hash-invalidation) ───────────────

// Builds a project skeleton under a fresh tmp root with two source files and a
// pack that cites both, plus an unrelated third file NOT cited by the pack.
function makeFreshnessProject() {
  const root = mkdtempSync(join(tmpdir(), "context-pack-freshness-"));
  mkdirSync(join(root, "docs", "features", "fixture-change"), { recursive: true });
  const proposalPath = join(root, "docs", "features", "fixture-change", "proposal.md");
  const designPath = join(root, "docs", "features", "fixture-change", "design.md");
  const unrelatedPath = join(root, "docs", "features", "fixture-change", "unrelated.md");
  writeFileSync(proposalPath, "# proposal\ncontent A\n");
  writeFileSync(designPath, "# design\ncontent B\n");
  writeFileSync(unrelatedPath, "# unrelated\nnot cited by the pack\n");
  const sources = [
    { path: "docs/features/fixture-change/design.md", sha256: sha256(readFileSync(designPath, "utf8")) },
    { path: "docs/features/fixture-change/proposal.md", sha256: sha256(readFileSync(proposalPath, "utf8")) },
  ];
  const packPath = join(root, "docs", "features", "fixture-change", ".context-pack.md");
  writeFileSync(packPath, goodPack(sources));
  mkdirSync(join(root, ".aidakit"), { recursive: true }); // marks the project root for findProjectRoot
  return { root, packPath, proposalPath, designPath, unrelatedPath };
}

// N3a-i: every sources[N].sha256 matches the file on disk → exit 0.
{
  const { root, packPath } = makeFreshnessProject();
  const r = run(freshVal, [packPath], { AIDAKIT_PROJECT_ROOT: root });
  ok(r.code === 0 && r.json && r.json.ok, "§freshness-all-sources-match: all sources match → exit 0");
}

// N3a-ii: mutate one source file → exit 1 naming the divergent path.
{
  const { root, packPath, designPath } = makeFreshnessProject();
  writeFileSync(designPath, "# design\ncontent B — MUTATED\n");
  const r = run(freshVal, [packPath], { AIDAKIT_PROJECT_ROOT: root });
  ok(r.code === 1 && r.json && r.json.errors.some((e) => e.rule === "source-diverged" && e.path === "docs/features/fixture-change/design.md"),
    "§freshness-one-source-diverges: mutated source → exit 1 naming the divergent path");
}

// N3a-iii: delete one source file → exit 1 with source-missing naming the path.
{
  const { root, packPath, proposalPath } = makeFreshnessProject();
  rmSync(proposalPath);
  const r = run(freshVal, [packPath], { AIDAKIT_PROJECT_ROOT: root });
  ok(r.code === 1 && r.json && r.json.errors.some((e) => e.rule === "source-missing" && e.path === "docs/features/fixture-change/proposal.md"),
    "§freshness-source-missing: deleted source → exit 1 source-missing naming the path");
}

// N3a-iv: mutate a file NOT declared in sources[] → exit 0 (invalidation must never be repo-wide).
{
  const { root, packPath, unrelatedPath } = makeFreshnessProject();
  writeFileSync(unrelatedPath, "# unrelated\nMUTATED but not a declared source\n");
  const r = run(freshVal, [packPath], { AIDAKIT_PROJECT_ROOT: root });
  ok(r.code === 0 && r.json && r.json.ok, "§freshness-scope-only-declared-sources: mutating an undeclared file → still exit 0");
}

// N3a-v: pack is stale, doc-manifest is complete → freshness fails, doc-manifest passes independently.
{
  const { root, packPath, designPath } = makeFreshnessProject();
  writeFileSync(designPath, "# design\ncontent B — MUTATED\n");
  const freshResult = run(freshVal, [packPath], { AIDAKIT_PROJECT_ROOT: root });

  const manifestPath = join(root, ".aidakit", "doc-manifest.json");
  writeFileSync(manifestPath, JSON.stringify({ change_id: "fixture-change", level: "change", required: [] }));
  const docResult = run(docManifestVal, [manifestPath], { AIDAKIT_PROJECT_ROOT: root });

  ok(freshResult.code === 1 && docResult.code === 0 && docResult.json.ok,
    "§freshness-separation-from-doc-manifest: stale pack fails freshness but doc-manifest (unrelated) stays green");
}

console.log(`\n${pass} passed, ${fail} failed`);
rmSync(tmp, { recursive: true, force: true });
process.exit(fail ? 1 : 0);
