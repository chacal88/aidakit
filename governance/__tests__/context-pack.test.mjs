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

import { mkdtempSync, rmSync, existsSync, mkdirSync, writeFileSync, readFileSync, appendFileSync, copyFileSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

const { buildPackContent, packPathFor } = await import("../context-pack/build.js");
const { loadFlow } = await import("../engine/parser.js");
const { packSizeFor } = await import("../engine/steps/invoke.js");
const { appendTelemetry, telemetryPathFor } = await import("../telemetry/append.js");
function findStep(flow, id) { return flow.steps.find((s) => s.id === id); }

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

// ── Round-1 bench fix A: path traversal via sources[].path (Security veto #1) ──
// A committed pack with an absolute or traversal-escaping sources[N].path
// turns the freshness validator into a local file existence + hash oracle —
// no code execution needed, just a crafted frontmatter block.

// FixA-i: an absolute path in sources[].path → exit 1 with source-entry-invalid.
{
  const { root } = makeFreshnessProject();
  const packPath = join(root, "docs", "features", "fixture-change", ".context-pack.md");
  writeFileSync(packPath, goodPack([{ path: "/etc/passwd", sha256: sha256("whatever") }]));
  const r = run(freshVal, [packPath], { AIDAKIT_PROJECT_ROOT: root });
  ok(r.code === 1 && r.json && r.json.errors.some((e) => e.rule === "source-entry-invalid" && /absolute/.test(e.message)),
    "§freshness-rejects-absolute-source-path: absolute path in sources[] → exit 1 source-entry-invalid");
}

// FixA-ii: a `../../../../etc/passwd` traversal in sources[].path → exit 1 with source-entry-invalid.
{
  const { root } = makeFreshnessProject();
  const packPath = join(root, "docs", "features", "fixture-change", ".context-pack.md");
  writeFileSync(packPath, goodPack([{ path: "../../../../../../etc/passwd", sha256: sha256("whatever") }]));
  const r = run(freshVal, [packPath], { AIDAKIT_PROJECT_ROOT: root });
  ok(r.code === 1 && r.json && r.json.errors.some((e) => e.rule === "source-entry-invalid" && /escapes/.test(e.message)),
    "§freshness-rejects-traversal-source-path: ../../../../etc/passwd in sources[] → exit 1 source-entry-invalid");
}

// FixA-iii: plain repo-relative path → still exit 0 (regression guard alongside N3a-i above).
{
  const { root, packPath } = makeFreshnessProject();
  const r = run(freshVal, [packPath], { AIDAKIT_PROJECT_ROOT: root });
  ok(r.code === 0 && r.json && r.json.ok,
    "§freshness-accepts-plain-relative-path: plain repo-relative sources[] path is unaffected by the traversal guard");
}

// ── Round-2 bench fix: symlinked sources[].path bypasses the traversal
// guard (Security veto, round 2) — Fix A validates the STRING shape of
// sources[N].path only; a relative path that resolves (via a committed
// symlink) to a target outside the repo sails through both string checks
// and the validator follows the link, reads the real target, and echoes
// its sha256 in the source-diverged message. Policy: no symlinks allowed
// in sources[] at all (lstat-reject) — a context pack is a documentation
// artifact and symlinked doc files are not a normal repo pattern.

// FixB-i: sources[].path is a relative path that is itself a symlink
// pointing OUTSIDE the repo root → exit 1 source-entry-invalid, and the
// validator must NEVER read/hash the real target (no source-diverged).
{
  const { root } = makeFreshnessProject();
  const outsideTarget = join(mkdtempSync(join(tmpdir(), "context-pack-freshness-outside-")), "attacker-target.txt");
  writeFileSync(outsideTarget, "attacker-controlled content\n");
  const linkPath = join(root, "docs", "features", "fixture-change", "evil-link");
  symlinkSync(outsideTarget, linkPath);
  const packPath = join(root, "docs", "features", "fixture-change", ".context-pack.md");
  writeFileSync(packPath, goodPack([{ path: "docs/features/fixture-change/evil-link", sha256: "deadbeef" }]));
  const r = run(freshVal, [packPath], { AIDAKIT_PROJECT_ROOT: root });
  ok(r.code === 1 && r.json && r.json.errors.some((e) => e.rule === "source-entry-invalid" && e.path === "docs/features/fixture-change/evil-link"),
    "§freshness-symlink-to-outside-repo-rejected: symlinked source pointing outside root → exit 1 source-entry-invalid");
  ok(r.json && !r.json.errors.some((e) => e.rule === "source-diverged"),
    "§freshness-symlink-to-outside-repo-rejected: never reads/hashes the symlink target (no source-diverged leak)");
}

// FixB-ii: sources[].path is a relative path that is a symlink pointing at
// another file INSIDE the repo root → still exit 1 source-entry-invalid
// (policy is "no symlinks in sources[]" full stop, not just an outside-root
// check — locks the lstat-reject policy regardless of target location).
{
  const { root, designPath } = makeFreshnessProject();
  const linkPath = join(root, "docs", "features", "fixture-change", "inside-link");
  symlinkSync(designPath, linkPath);
  const packPath = join(root, "docs", "features", "fixture-change", ".context-pack.md");
  writeFileSync(packPath, goodPack([{ path: "docs/features/fixture-change/inside-link", sha256: sha256(readFileSync(designPath, "utf8")) }]));
  const r = run(freshVal, [packPath], { AIDAKIT_PROJECT_ROOT: root });
  ok(r.code === 1 && r.json && r.json.errors.some((e) => e.rule === "source-entry-invalid" && e.path === "docs/features/fixture-change/inside-link"),
    "§freshness-symlink-to-inside-repo-rejected: symlinked source pointing inside root is still rejected (no symlinks in sources[] policy)");
}

// ── Round-3 bench fix: symlinked ANCESTOR DIRECTORY bypasses the round-2
// lstat-reject (Security veto, round 3) — round-2's fix only inspected the
// LEAF path component with lstat; POSIX path resolution follows symlinks for
// every path segment except the final one, so a symlinked INTERMEDIATE
// directory silently redirects the whole subtree outside root while the
// leaf itself is an ordinary file (lstat(leaf).isSymbolicLink() === false).
// Policy: reject any symlink ANYWHERE in the path chain, leaf or ancestor,
// via realpathSync-compare — never read/hash through it.

// FixC-i: sources[].path traverses through a symlinked ANCESTOR DIRECTORY to
// reach a regular (non-symlink) file OUTSIDE the repo root → exit 1
// source-entry-invalid, and the validator must NEVER read/hash the real
// target (no source-diverged) — this is the exact round-3 PoC.
{
  const { root } = makeFreshnessProject();
  const outsideDir = mkdtempSync(join(tmpdir(), "context-pack-freshness-outsidedir-"));
  const outsideFile = join(outsideDir, "secret.txt");
  writeFileSync(outsideFile, "attacker-controlled content via ancestor symlink\n");
  const assetsLink = join(root, "docs", "features", "fixture-change", "assets");
  symlinkSync(outsideDir, assetsLink); // symlinked DIR, not a symlinked leaf
  const packPath = join(root, "docs", "features", "fixture-change", ".context-pack.md");
  writeFileSync(packPath, goodPack([{ path: "docs/features/fixture-change/assets/secret.txt", sha256: "deadbeef" }]));
  const r = run(freshVal, [packPath], { AIDAKIT_PROJECT_ROOT: root });
  ok(r.code === 1 && r.json && r.json.errors.some((e) => e.rule === "source-entry-invalid" && e.path === "docs/features/fixture-change/assets/secret.txt"),
    "§freshness-symlink-in-ancestor-dir-rejected: source path through a symlinked ancestor dir → exit 1 source-entry-invalid");
  ok(r.json && !r.json.errors.some((e) => e.rule === "source-diverged"),
    "§freshness-symlink-in-ancestor-dir-rejected: never reads/hashes the target through the symlinked ancestor (no source-diverged leak)");
}

// ── Round-1 bench fix B: change_id sanitization at FS-write sinks
//    (Security veto #2) — direct unit tests of each of the three sinks in
//    isolation (defense-in-depth alongside the resume-boundary tightening
//    exercised later, in §7d-f, once the CLI helpers exist). ──────────────

function changeIdSinkThrows(root, changeId) {
  let threw = 0;
  try { packPathFor(root, changeId); } catch (e) { if (/invalid change_id/.test(e.message)) threw++; }
  try { packSizeFor(changeId); } catch (e) { if (/invalid change_id/.test(e.message)) threw++; }
  try { telemetryPathFor(changeId, root); } catch (e) { if (/invalid change_id/.test(e.message)) threw++; }
  return threw;
}

// FixB-i: `..` → all three sinks throw "invalid change_id".
{
  const root = mkdtempSync(join(tmpdir(), "change-id-sink-dotdot-"));
  mkdirSync(join(root, ".aidakit"), { recursive: true });
  ok(changeIdSinkThrows(root, "..") === 3, "§change-id-sinks-reject-dotdot: packPathFor/packSizeFor/telemetryPathFor all throw invalid change_id for \"..\"");
}

// FixB-ii: `/tmp/pwned` (absolute path) → all three sinks throw "invalid change_id".
{
  const root = mkdtempSync(join(tmpdir(), "change-id-sink-abs-"));
  mkdirSync(join(root, ".aidakit"), { recursive: true });
  ok(changeIdSinkThrows(root, "/tmp/pwned") === 3, "§change-id-sinks-reject-absolute: packPathFor/packSizeFor/telemetryPathFor all throw invalid change_id for \"/tmp/pwned\"");
}

// FixB-iii: `valid-id-1` (plain kebab-case) → all three sinks work.
{
  const root = mkdtempSync(join(tmpdir(), "change-id-sink-valid-"));
  mkdirSync(join(root, ".aidakit"), { recursive: true });
  let worked = true;
  try { packPathFor(root, "valid-id-1"); } catch { worked = false; }
  try { packSizeFor("valid-id-1"); } catch { worked = false; }
  try { telemetryPathFor("valid-id-1", root); } catch { worked = false; }
  ok(worked, "§change-id-sinks-accept-valid: a plain kebab-case change_id works at all three sinks");
}

// FixB-iv: `Invalid_ID` (underscore/uppercase) → all three sinks throw too — not just path-shaped attacks.
{
  const root = mkdtempSync(join(tmpdir(), "change-id-sink-shape-"));
  mkdirSync(join(root, ".aidakit"), { recursive: true });
  ok(changeIdSinkThrows(root, "Invalid_ID") === 3, "§change-id-sinks-reject-bad-shape: underscore/uppercase change_id rejected at all three sinks");
}

// ── §4 governance/context-pack/build.js (deterministic build/verify/rebuild) ──

function makeBuildProject(changeId = "fixture-build-change") {
  const root = mkdtempSync(join(tmpdir(), "context-pack-build-"));
  const changeDir = join(root, "docs", "features", changeId);
  mkdirSync(changeDir, { recursive: true });
  mkdirSync(join(root, "docs", "decisions"), { recursive: true });
  mkdirSync(join(root, ".aidakit"), { recursive: true });

  writeFileSync(join(root, "docs", "decisions", "ADR-004-example.md"), "# ADR-004: Example\n\n- **Status:** accepted\n");
  // Round-1 bench fix D fixture: a SECOND ADR, cited only via a RELATIVE
  // markdown link (never the literal "docs/decisions/..." substring) — this
  // is the shape the whole repo actually uses and the shape the old
  // ADR_LINK_RE missed entirely.
  writeFileSync(join(root, "docs", "decisions", "ADR-006-flow-values-as-data.md"), "# ADR-006: Flow values as data\n\n- **Status:** accepted\n");

  const proposal = [
    `# Proposal — ${changeId}`,
    "",
    `**Change ID:** \`${changeId}\``,
    "**Date:** `2026-07-24`",
    "**Owner:** `@fixture`",
    "**Phase / Package:** `fixture phase`",
    "",
    "## Problem",
    "",
    "The dispatchers re-read durable context every time. This wastes tokens.",
    "",
    "## Success criteria",
    "",
    "1. The pack exists.",
    "2. The pack validates.",
    "",
    "## References",
    "",
    "- [ADR-004](docs/decisions/ADR-004-example.md) — the cited ADR.",
    "",
  ].join("\n");

  const design = [
    `# Design — ${changeId}`,
    "",
    "## Architecture",
    "",
    "### The pack format",
    "",
    "Frontmatter plus six sections.",
    "",
    "### The build script",
    "",
    "Deterministic, zero-dep.",
    "",
    "## Concrete implementation plan",
    "",
    "### File structure — create / modify / delete",
    "",
    "**CREATE**",
    "",
    "- `governance/context-pack/build.js` — the build script.",
    "- `skills/context-pack/SKILL.md` — the skill contract.",
    "",
    "**MODIFY**",
    "",
    "- `governance/flows/full.yaml` — insert the phase.",
    // Round-1 bench fix C fixture: a bullet with SEVERAL backtick tokens —
    // the old single `.exec` per line silently dropped everything after the
    // first token on a line like this.
    "- `agents/adr-reviewer.md`, `agents/spec-reviewer.md`, `agents/tester.md` — extend the protocol.",
    "",
    // Round-1 bench fix C fixture: a `### ` subsection inside the SAME `## `
    // parent, with backticks that must NOT be captured as file-structure
    // pointers — the old stop rule (`/^##\s+/m`, level-2 only) swept this in.
    "### Assumptions",
    "",
    "- The telemetry directory `.aidakit/` is gitignored; consult `aidakit:learn` for the rollup step.",
    "",
    "## Dependencies",
    "",
    "- [ADR-006](../../decisions/ADR-006-flow-values-as-data.md) — cited via a relative link, the shape the rest of the repo uses.",
    "",
  ].join("\n");

  const tasks = `# Tasks — ${changeId}\n\n- [ ] N1. Do the thing.\n`;

  writeFileSync(join(changeDir, "proposal.md"), proposal);
  writeFileSync(join(changeDir, "design.md"), design);
  writeFileSync(join(changeDir, "tasks.md"), tasks);

  return { root, changeDir, changeId };
}

// N4a-i: build twice from identical sources → byte-identical output.
{
  const { root, changeId } = makeBuildProject();
  const p1 = buildPackContent({ root, changeId }).content;
  const p2 = buildPackContent({ root, changeId }).content;
  ok(p1 === p2 && p1.length > 0, "§build-deterministic-twice: build called twice from identical sources → byte-identical");
}

// N4a-ii-a: wall-clock fuzz — different SOURCE_DATE_EPOCH / real-time gap between builds; no effect.
{
  const { root, changeId } = makeBuildProject();
  const before = buildPackContent({ root, changeId }).content;
  process.env.SOURCE_DATE_EPOCH = "0";
  const afterEpoch0 = buildPackContent({ root, changeId }).content;
  process.env.SOURCE_DATE_EPOCH = String(Math.floor(Date.now() / 1000));
  const afterEpochNow = buildPackContent({ root, changeId }).content;
  delete process.env.SOURCE_DATE_EPOCH;
  ok(before === afterEpoch0 && before === afterEpochNow, "§build-deterministic-under-host-fuzz (wall-clock): SOURCE_DATE_EPOCH never leaks into output");
}

// N4a-ii-b: PID fuzz — build in-process vs. build in a spawned subprocess → byte-identical.
{
  const { root, changeId } = makeBuildProject();
  const inProcess = buildPackContent({ root, changeId }).content;
  const target = join(root, "docs", "features", changeId, ".context-pack.md");
  execFileSync("node", [buildJs, "--change-id", changeId, "--root", root], { encoding: "utf8" });
  const subprocess = readFileSync(target, "utf8");
  ok(inProcess === subprocess, "§build-deterministic-under-host-fuzz (PID): in-process build === subprocess build");
}

// N4a-ii-c: tmp-cwd fuzz — identical source tree copied into two different absolute paths → byte-identical output.
{
  const { root: rootA, changeId } = makeBuildProject("fuzz-cwd-change");
  const rootB = mkdtempSync(join(tmpdir(), "context-pack-build-copy-"));
  copyFileSync(join(rootA, "docs", "features", changeId, "proposal.md"), (() => { mkdirSync(join(rootB, "docs", "features", changeId), { recursive: true }); return join(rootB, "docs", "features", changeId, "proposal.md"); })());
  copyFileSync(join(rootA, "docs", "features", changeId, "design.md"), join(rootB, "docs", "features", changeId, "design.md"));
  copyFileSync(join(rootA, "docs", "features", changeId, "tasks.md"), join(rootB, "docs", "features", changeId, "tasks.md"));
  mkdirSync(join(rootB, "docs", "decisions"), { recursive: true });
  copyFileSync(join(rootA, "docs", "decisions", "ADR-004-example.md"), join(rootB, "docs", "decisions", "ADR-004-example.md"));
  copyFileSync(join(rootA, "docs", "decisions", "ADR-006-flow-values-as-data.md"), join(rootB, "docs", "decisions", "ADR-006-flow-values-as-data.md"));
  const contentA = buildPackContent({ root: rootA, changeId }).content;
  const contentB = buildPackContent({ root: rootB, changeId }).content;
  ok(contentA === contentB && rootA !== rootB, "§build-deterministic-under-host-fuzz (tmp-cwd): different absolute roots, identical relative tree → byte-identical");
  rmSync(rootB, { recursive: true, force: true });
}

// N4a-iii: sources[] in the output is path-sorted regardless of discovery order.
{
  const { root, changeId } = makeBuildProject();
  const { content } = buildPackContent({ root, changeId });
  const m = /sources:\n([\s\S]*?)\n---/.exec(content);
  ok(!!m, "§build-sources-path-sorted: frontmatter has a sources: block");
  const pathsInOutput = [...content.matchAll(/^\s{2}- path: (.+)$/gm)].map((mm) => mm[1]);
  const expectedSorted = [...pathsInOutput].sort();
  ok(JSON.stringify(pathsInOutput) === JSON.stringify(expectedSorted), "§build-sources-path-sorted: sources[] in output is path-sorted lexicographically");
}

// N4a-iv: mutate a source, rebuild → that source's sha256 AND the top hash both change.
{
  const { root, changeId, changeDir } = makeBuildProject();
  const before = buildPackContent({ root, changeId }).content;
  writeFileSync(join(changeDir, "design.md"), readFileSync(join(changeDir, "design.md"), "utf8") + "\n\n### A new decision\n\nAdded after the fact.\n");
  const after = buildPackContent({ root, changeId }).content;
  const beforeTop = /built_at_source_hash: (\S+)/.exec(before)[1];
  const afterTop = /built_at_source_hash: (\S+)/.exec(after)[1];
  ok(before !== after && beforeTop !== afterTop, "§build-rebuild-refreshes-hashes: mutated source → sources[].sha256 and built_at_source_hash both change");
}

// REGRESSION (found during dogfood, N10): check-links.js resolves a markdown
// link relative to the FILE's own directory (docs/features/<id>/), not the
// repo root — so an ADR link rendered as a bare repo-relative href would be
// reported broken. The ADRs section must emit a pack-relative link.
{
  const { root, changeId } = makeBuildProject("link-relative-change");
  const { content } = buildPackContent({ root, changeId });
  const packPath = join(root, "docs", "features", changeId, ".context-pack.md");
  writeFileSync(packPath, content);
  const r = run(join(GOV, "validators", "check-links.js"), [packPath]);
  ok(r.code === 0 && r.json.ok, "§build-adr-links-resolve-from-pack-location: check-links.js sees no broken links in the built pack");
}

// N4a-v: verify returns non-zero if EITHER validator fails (byte-stability OR freshness).
// (build.js's own subcommand token must come FIRST — it is not a validator, so it
// does not take the shared `--json`-prefixed `run()` helper's argument shape.)
function runBuildCli(args) {
  try {
    const out = execFileSync("node", [buildJs, ...args], { encoding: "utf8" });
    return { code: 0, json: JSON.parse(out.trim().split("\n").pop()) };
  } catch (e) {
    const out = (e.stdout || "").trim();
    return { code: e.status, json: out ? JSON.parse(out.split("\n").pop()) : null };
  }
}
{
  const { root, changeId, changeDir } = makeBuildProject("verify-change");
  runBuildCli(["build", "--change-id", changeId, "--root", root]);
  const okResult = runBuildCli(["verify", "--change-id", changeId, "--root", root]);
  ok(okResult.code === 0 && okResult.json.ok, "§verify-wraps-both-validators: fresh + well-formed pack → verify exit 0");

  writeFileSync(join(changeDir, "design.md"), readFileSync(join(changeDir, "design.md"), "utf8") + "\nmutated after build\n");
  const staleResult = runBuildCli(["verify", "--change-id", changeId, "--root", root]);
  ok(staleResult.code !== 0 && staleResult.json && staleResult.json.ok === false,
    "§verify-wraps-both-validators: stale pack (freshness fails) → verify non-zero");
}

// ── Round-1 bench fix F: content-correctness assertions on buildPackContent
//    (tester critical #2 — this test shape would have caught Fix C's and Fix
//    D's bugs at authoring time) ──────────────────────────────────────────

// FixF-i: identity section contains the fixture's declared owner/date/phase.
{
  const { root, changeId } = makeBuildProject("content-correctness-identity");
  const { content } = buildPackContent({ root, changeId });
  const identity = content.split("## identity")[1].split("## decisions")[0];
  ok(/owner: @fixture/.test(identity), "§build-content-identity: identity section contains owner: @fixture");
  ok(/date: 2026-07-24/.test(identity), "§build-content-identity: identity section contains the fixture's declared date");
  ok(/phase: fixture phase/.test(identity), "§build-content-identity: identity section contains the fixture's declared phase");
}

// FixF-ii: decisions section has one line per ### heading under design.md's ## Architecture.
{
  const { root, changeId } = makeBuildProject("content-correctness-decisions");
  const { content } = buildPackContent({ root, changeId });
  const decisions = content.split("## decisions")[1].split("## ADRs")[0];
  ok(/The pack format/.test(decisions) && /The build script/.test(decisions),
    "§build-content-decisions: decisions section lists both ### headings from design.md's Architecture section");
}

// FixF-iii / Fix C regression: code-map-pointers contains every CREATE/MODIFY
// path — including every token off a multi-backtick bullet — and excludes
// backtick tokens from a `### Assumptions` subsection nested in the same
// `## ` parent.
{
  const { root, changeId } = makeBuildProject("content-correctness-pointers");
  const { content } = buildPackContent({ root, changeId });
  const pointers = content.split("## code-map-pointers")[1].split("## DoD")[0];
  for (const p of ["governance/context-pack/build.js", "skills/context-pack/SKILL.md", "governance/flows/full.yaml", "agents/adr-reviewer.md", "agents/spec-reviewer.md", "agents/tester.md"]) {
    ok(pointers.includes(p), `§build-content-pointers-multi-backtick: code-map-pointers includes ${p} (multi-backtick bullet)`);
  }
  ok(!/\.aidakit\//.test(pointers), "§build-content-pointers-excludes-assumptions: code-map-pointers does not capture .aidakit/ from the Assumptions subsection");
  ok(!/aidakit:learn/.test(pointers), "§build-content-pointers-excludes-assumptions: code-map-pointers does not capture the aidakit:learn skill id from the Assumptions subsection");
}

// FixF-iv / Fix D regression: ADRs section contains ADR-006, cited ONLY via a
// relative markdown link (`[ADR-006](../../decisions/ADR-006-....md)`).
{
  const { root, changeId } = makeBuildProject("content-correctness-adrs");
  const { content } = buildPackContent({ root, changeId });
  const adrs = content.split("## ADRs")[1].split("## specs")[0];
  ok(/\[ADR-004\]/.test(adrs), "§build-content-adrs-relative-link: ADRs section lists ADR-004 (literal-path citation)");
  ok(/\[ADR-006\]/.test(adrs), "§build-content-adrs-relative-link: ADRs section lists ADR-006 (relative-path citation)");
}

// ── §5 flow phase `context_pack` in full.yaml / fast.yaml ────────────────

// N5a-i: full.yaml — context_pack step exists, type runs, wired between readiness and implement.
{
  const { flow, errors } = loadFlow("full");
  ok(errors.length === 0, "full.yaml parses without errors");
  const readiness = findStep(flow, "readiness");
  const ctxPack = findStep(flow, "context_pack");
  ok(!!ctxPack && ctxPack.type === "runs", "§flow-full-phase-inserted: context_pack step exists with type: runs");
  ok(readiness && readiness.on_result && readiness.on_result.approved === "context_pack",
    "§flow-full-phase-inserted: readiness.on_result.approved === context_pack");
  ok(ctxPack && ctxPack.on_success === "implement" && ctxPack.on_failure === "implement",
    "§flow-full-phase-inserted: context_pack routes both on_success and on_failure to implement");
}

// N5a-ii: fast.yaml — same shape.
{
  const { flow, errors } = loadFlow("fast");
  ok(errors.length === 0, "fast.yaml parses without errors");
  const readiness = findStep(flow, "readiness");
  const ctxPack = findStep(flow, "context_pack");
  ok(!!ctxPack && ctxPack.type === "runs", "§flow-fast-phase-inserted: context_pack step exists with type: runs");
  ok(readiness && readiness.on_result && readiness.on_result.approved === "context_pack",
    "§flow-fast-phase-inserted: readiness.on_result.approved === context_pack");
  ok(ctxPack && ctxPack.on_success === "implement" && ctxPack.on_failure === "implement",
    "§flow-fast-phase-inserted: context_pack routes both on_success and on_failure to implement");
}

// N5a-iii: the command references BOTH the freshness validator AND the build script, double-quoted.
for (const flowName of ["full", "fast"]) {
  const { flow } = loadFlow(flowName);
  const ctxPack = findStep(flow, "context_pack");
  const cmd = ctxPack ? ctxPack.command : "";
  ok(/"\$AIDAKIT_GOVERNANCE\/validators\/check-context-pack-freshness\.js"/.test(cmd),
    `§flow-phase-uses-governance-env (${flowName}): command double-quotes $AIDAKIT_GOVERNANCE/validators/check-context-pack-freshness.js`);
  ok(/"\$AIDAKIT_GOVERNANCE\/context-pack\/build\.js"/.test(cmd),
    `§flow-phase-uses-governance-env (${flowName}): command double-quotes $AIDAKIT_GOVERNANCE/context-pack/build.js`);
}

// N5a-iv: the command interpolates ${context.select.change_id} inside double quotes.
for (const flowName of ["full", "fast"]) {
  const { flow } = loadFlow(flowName);
  const ctxPack = findStep(flow, "context_pack");
  const cmd = ctxPack ? ctxPack.command : "";
  ok(/"[^"]*\$\{context\.select\.change_id\}[^"]*"/.test(cmd),
    `§flow-phase-interpolates-change-id (${flowName}): \${context.select.change_id} appears inside double quotes`);
}

// N5a-v: pre-existing back-edges into `implement` are left unchanged.
{
  const { flow } = loadFlow("full");
  ok(findStep(flow, "check_implement_bench").on_failure === "implement", "§flow-back-edges-unchanged (full): check_implement_bench.on_failure === implement");
  ok(findStep(flow, "check_review_bench").on_failure === "review_bench", "§flow-back-edges-unchanged (full): check_review_bench.on_failure === review_bench (unchanged)");
  ok(findStep(flow, "bench_outcome").on_failure === "implement", "§flow-back-edges-unchanged (full): bench_outcome.on_failure === implement");
  ok(findStep(flow, "hardening").on_failure === "implement", "§flow-back-edges-unchanged (full): hardening.on_failure === implement");
}
{
  const { flow } = loadFlow("fast");
  ok(findStep(flow, "check_implement_bench").on_failure === "implement", "§flow-back-edges-unchanged (fast): check_implement_bench.on_failure === implement");
  ok(findStep(flow, "review_outcome").on_failure === "implement", "§flow-back-edges-unchanged (fast): review_outcome.on_failure === implement");
}

// ── §6 dispatcher/reviewer wiring (read-if-present, freshness upstream) ──

const REPO = new URL("../..", import.meta.url).pathname;
const DISPATCHER_FILES = [
  "agents/adr-reviewer.md",
  "agents/spec-reviewer.md",
  "agents/reviewer-quality.md",
  "agents/reviewer-security.md",
  "agents/reviewer-architecture.md",
  "agents/tester.md",
  "agents/implementer.md",
  "skills/implement/SKILL.md",
  "skills/review/SKILL.md",
  "skills/ship/SKILL.md",
];

for (const rel of DISPATCHER_FILES) {
  const text = readFileSync(join(REPO, rel), "utf8");
  ok(/context pack/i.test(text) && /\.context-pack\.md/.test(text),
    `§dispatcher-reads-pack-when-present (${rel}): mentions "context pack" and the .context-pack.md path`);
  ok(/fall.?back.*raw|absent.*proposal|pack.*absent/is.test(text),
    `§dispatcher-falls-back-when-absent (${rel}): has an explicit fallback-when-absent clause`);
  ok(!/check-context-pack-freshness/.test(text),
    `§dispatcher-does-not-invoke-freshness-validator (${rel}): never shells out to check-context-pack-freshness.js`);
}

// ── Round-1 bench fix C+D: dogfood-pack regression (real repo docs) ─────
// Rebuilds the ACTUAL context-pack-l1 dogfood pack (not a fixture) and
// asserts it now lists all 10 dispatcher files from design.md's MODIFY
// bullets (7 agents + 3 skills, previously dropped by the multi-backtick
// bug, Fix C) and ADR-006 + ADR-009 (previously dropped by the relative-link
// bug, Fix D — design.md's own Dependencies section cites both).
{
  const { content } = buildPackContent({ root: REPO, changeId: "context-pack-l1" });
  const pointers = content.split("## code-map-pointers")[1].split("## DoD")[0];
  for (const rel of DISPATCHER_FILES) {
    ok(pointers.includes(rel), `§dogfood-regression-code-map-pointers: code-map-pointers includes ${rel}`);
  }
  const adrs = content.split("## ADRs")[1].split("## specs")[0];
  ok(/\[ADR-006\]/.test(adrs), "§dogfood-regression-adrs: ADRs section lists ADR-006 (design.md Dependencies, relative link)");
  ok(/\[ADR-009\]/.test(adrs), "§dogfood-regression-adrs: ADRs section lists ADR-009 (design.md Dependencies, relative link)");
}

// ── §7 telemetry: JSONL append helper ─────────────────────────────────────
// (appendTelemetry/telemetryPathFor imported at the top of this file.)

// N7a-i: every appended line parses as JSON and carries the seven declared fields + ts.
{
  const root = mkdtempSync(join(tmpdir(), "telemetry-"));
  mkdirSync(join(root, ".aidakit"), { recursive: true });
  const changeId = "telemetry-change";
  for (const subagent of ["aidakit:reviewer-quality", "aidakit:reviewer-security", "aidakit:tester"]) {
    appendTelemetry({ root, changeId, subagent, cache_creation: 100, cache_read: 200, output_tokens: 50, pack_size: 300, duration_ms: 400, pack_rebuilt: false });
  }
  const path = telemetryPathFor(changeId, root);
  const lines = readFileSync(path, "utf8").trim().split("\n");
  ok(lines.length === 3, "§telemetry-lines-valid-json: three dispatches → three lines");
  const REQUIRED = ["ts", "subagent", "cache_creation", "cache_read", "output_tokens", "pack_size", "duration_ms", "pack_rebuilt"];
  ok(lines.every((l) => {
    const parsed = JSON.parse(l); // throws (test fails loudly) if a line isn't valid JSON
    return REQUIRED.every((k) => k in parsed);
  }), "§telemetry-lines-valid-json: every line parses as JSON and carries the seven fields + ts");
}

// N7a-ii: append-only — a fourth dispatch does not truncate/rewrite the prior three.
{
  const root = mkdtempSync(join(tmpdir(), "telemetry-append-"));
  mkdirSync(join(root, ".aidakit"), { recursive: true });
  const changeId = "telemetry-append-change";
  appendTelemetry({ root, changeId, subagent: "aidakit:tester", cache_read: 1 });
  appendTelemetry({ root, changeId, subagent: "aidakit:adr-reviewer", cache_read: 2 });
  appendTelemetry({ root, changeId, subagent: "aidakit:spec-reviewer", cache_read: 3 });
  appendTelemetry({ root, changeId, subagent: "aidakit:reviewer-architecture", cache_read: 4 });
  const path = telemetryPathFor(changeId, root);
  const lines = readFileSync(path, "utf8").trim().split("\n").map((l) => JSON.parse(l));
  ok(lines.length === 4 && lines.map((l) => l.subagent).join(",") === "aidakit:tester,aidakit:adr-reviewer,aidakit:spec-reviewer,aidakit:reviewer-architecture",
    "§telemetry-append-only: four dispatches → four lines, original order, no rewrite");
}

// N7a-iii: `.aidakit/` is gitignored (line 1), so `.aidakit/tasks/<id>/.telemetry.jsonl` is transitively ignored.
{
  const gitignore = readFileSync(join(REPO, ".gitignore"), "utf8");
  const firstLine = gitignore.split(/\r?\n/).find((l) => l.trim() !== "" && !l.trim().startsWith("#"));
  ok(firstLine === ".aidakit/", "§telemetry-gitignored: .gitignore's first non-comment line is .aidakit/");
}

// ── §7d-f telemetry: engine resume-kwargs extension (live write-site) ────

const cliJs = join(GOV, "cli.js");

function runCli(args, root) {
  try {
    const out = execFileSync("node", [cliJs, ...args], { encoding: "utf8", env: { ...process.env, AIDAKIT_PROJECT_ROOT: root } });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status, out: (e.stdout || "") + (e.stderr || "") };
  }
}

function startFastToSelect(root) {
  mkdirSync(root, { recursive: true });
  const startOut = runCli(["start", "fast", "request=telemetry probe"], root).out;
  const m = /\[(fast-\S+)\]/.exec(startOut);
  if (!m) throw new Error(`could not find flow_id in start output:\n${startOut}`);
  return m[1];
}

function telemetryFileFor(root, changeId) {
  return join(root, ".aidakit", "tasks", changeId, ".telemetry.jsonl");
}

// N7d-i: resume with the full telemetry kwarg set parses without error; a malformed
// kwarg errors out BEFORE any state is touched (the flow stays paused at `select`).
{
  const root = mkdtempSync(join(tmpdir(), "telemetry-resume-"));
  const flowId = startFastToSelect(root);
  const r = runCli(["resume", flowId, "success", "change_id=telemetry-cli-change",
    "--tokens-cache-read=18320", "--tokens-cache-creation=1240", "--tokens-output=512",
    "--duration-ms=11530", "--pack-rebuilt=false"], root);
  ok(r.code === 0, "§resume-parses-telemetry-kwargs: full kwarg set parses without error");

  // A second, independent flow: a malformed kwarg must error BEFORE any state changes.
  const flowId2 = startFastToSelect(root);
  const bad = runCli(["resume", flowId2, "success", "change_id=x", "--duration-ms=not-a-number"], root);
  ok(bad.code !== 0, "§resume-parses-telemetry-kwargs: malformed kwarg (non-integer) → usage error");
  const statusAfter = runCli(["status", flowId2], root).out;
  ok(/paused at: select/.test(statusAfter), "§resume-parses-telemetry-kwargs: malformed kwarg leaves the flow still paused at select (state untouched)");
}

// Round-1 bench fix B (boundary tightening): the `select` step's own resume
// boundary rejects a path-shaped change_id BEFORE it ever reaches a sink —
// the flow re-pauses at `select` instead of crashing or persisting the bad
// value (same doctrine as the invalid-outcome re-pause above). The generic
// RESUME_OUTPUT_VALUE_RE alone would have ACCEPTED "../../../../tmp/pwned"
// (it permits "." and "/"), so this exercises the change_id-specific check
// added in governance/engine/steps/invoke.js.
{
  const root = mkdtempSync(join(tmpdir(), "change-id-boundary-"));
  const flowId = startFastToSelect(root);
  const r = runCli(["resume", flowId, "success", "change_id=../../../../tmp/pwned"], root);
  ok(r.code === 0, "§change-id-boundary-repauses: resume with a traversal change_id does not crash the CLI");
  const status = runCli(["status", flowId], root).out;
  ok(/paused at: select/.test(status), "§change-id-boundary-repauses: flow re-pauses at select instead of persisting the traversal change_id");

  const flowId2 = startFastToSelect(root);
  const r2 = runCli(["resume", flowId2, "success", "change_id=Invalid_ID"], root);
  ok(r2.code === 0, "§change-id-boundary-repauses: resume with an underscore/uppercase change_id does not crash the CLI");
  const status2 = runCli(["status", flowId2], root).out;
  ok(/paused at: select/.test(status2), "§change-id-boundary-repauses: flow re-pauses at select for a shape-invalid change_id too");
}

// N7d-ii: the resume handler forwards the kwargs to governance/telemetry/append.js —
// one JSONL line appended with subagent=step.invoke_target, pack_size from the
// on-disk pack (0 here — absent), and a ts field.
{
  const root = mkdtempSync(join(tmpdir(), "telemetry-forward-"));
  const changeId = "telemetry-forward-change";
  const flowId = startFastToSelect(root);
  runCli(["resume", flowId, "success", `change_id=${changeId}`,
    "--tokens-cache-read=100", "--tokens-cache-creation=50", "--tokens-output=20",
    "--duration-ms=999", "--pack-rebuilt=true"], root);
  const telemetryPath = telemetryFileFor(root, changeId);
  ok(existsSync(telemetryPath), "§invoke-forwards-kwargs-to-helper: telemetry JSONL was written");
  const line = JSON.parse(readFileSync(telemetryPath, "utf8").trim().split("\n")[0]);
  ok(line.subagent === "aidakit:orchestrator", "§invoke-forwards-kwargs-to-helper: subagent derived from step.invoke_target");
  ok(line.pack_size === 0, "§invoke-forwards-kwargs-to-helper: pack_size is 0 (no pack on disk for this change)");
  ok(line.cache_read === 100 && line.cache_creation === 50 && line.duration_ms === 999 && line.pack_rebuilt === true,
    "§invoke-forwards-kwargs-to-helper: numeric/boolean fields forwarded correctly");
  // Round-1 bench fix E (tester critical #1): output_tokens was parsed off
  // --tokens-output but silently dropped before ever reaching the JSONL
  // record — assert it is now forwarded end-to-end.
  ok(line.output_tokens === 20, "§invoke-forwards-kwargs-to-helper: output_tokens (--tokens-output=20) is forwarded correctly");
  ok(typeof line.ts === "string" && /^\d{4}-\d{2}-\d{2}T/.test(line.ts), "§invoke-forwards-kwargs-to-helper: ts is a real ISO-8601 timestamp");
}

// N7d-iii: resume WITHOUT telemetry kwargs → no telemetry line written; flow proceeds unaffected.
{
  const root = mkdtempSync(join(tmpdir(), "telemetry-none-"));
  const changeId = "telemetry-none-change";
  const flowId = startFastToSelect(root);
  const r = runCli(["resume", flowId, "success", `change_id=${changeId}`], root);
  ok(r.code === 0, "§resume-without-kwargs-writes-nothing: plain resume (no telemetry) still succeeds");
  ok(!existsSync(telemetryFileFor(root, changeId)), "§resume-without-kwargs-writes-nothing: no telemetry file is created");
}

// N7d-iv: the full engine test suite (which drives invoke.js through many resume
// paths) stays green — no code change to the test file itself.
{
  const out = execFileSync("node", [join(GOV, "__tests__", "engine.test.mjs")], { encoding: "utf8" });
  ok(/149 passed, 0 failed/.test(out) || /passed, 0 failed/.test(out),
    "§engine-test-still-green: governance/__tests__/engine.test.mjs still green after the additive extension");
}

// ── §8 aidakit:learn rollup into evidence.md ──────────────────────────────

const rollupJs = join(GOV, "telemetry", "rollup.js");

function makeLearnProject(changeId = "learn-rollup-change") {
  const root = mkdtempSync(join(tmpdir(), "learn-rollup-"));
  mkdirSync(join(root, "docs", "features", changeId), { recursive: true });
  mkdirSync(join(root, ".aidakit", "tasks", changeId), { recursive: true });
  writeFileSync(join(root, "docs", "features", changeId, "evidence.md"),
    "# Evidence\n\n## Validation Outputs\n\n<!-- stub -->\n\n## Context-pack telemetry rollup\n\n<!-- Written by aidakit:learn at end-of-run. -->\n\n## Coverage report\n\n<!-- stub -->\n");
  return { root, changeId };
}

function writeSyntheticTelemetry(root, changeId, entries) {
  const p = join(root, ".aidakit", "tasks", changeId, ".telemetry.jsonl");
  writeFileSync(p, entries.map((e) => JSON.stringify(e)).join("\n") + "\n");
  return p;
}

function runRollupCli(args) {
  const out = execFileSync("node", [rollupJs, ...args], { encoding: "utf8" });
  return out;
}

// N8a-i: rollup written with totals, mean pack_size, sums, rebuild count, per-subagent table.
{
  const { root, changeId } = makeLearnProject();
  writeSyntheticTelemetry(root, changeId, [
    { ts: "2026-07-25T10:00:00Z", subagent: "aidakit:reviewer-quality", cache_creation: 100, cache_read: 1000, pack_size: 200, duration_ms: 500, pack_rebuilt: false },
    { ts: "2026-07-25T10:05:00Z", subagent: "aidakit:reviewer-security", cache_creation: 50, cache_read: 500, pack_size: 400, duration_ms: 300, pack_rebuilt: true },
    { ts: "2026-07-25T10:10:00Z", subagent: "aidakit:reviewer-quality", cache_creation: 150, cache_read: 1500, pack_size: 300, duration_ms: 600, pack_rebuilt: false },
  ]);
  runRollupCli(["--change-id", changeId, "--root", root]);
  const evidence = readFileSync(join(root, "docs", "features", changeId, "evidence.md"), "utf8");
  ok(/## Context-pack telemetry rollup/.test(evidence), "§learn-rollup-written: section header present");
  ok(/Total dispatches:\s*3/.test(evidence), "§learn-rollup-written: total dispatches = 3");
  ok(/Sum cache_read:\s*3000/.test(evidence), "§learn-rollup-written: sum cache_read = 3000");
  ok(/Sum cache_creation:\s*300/.test(evidence), "§learn-rollup-written: sum cache_creation = 300");
  ok(/Pack rebuilds:\s*1/.test(evidence), "§learn-rollup-written: pack rebuilds = 1");
  ok(/aidakit:reviewer-quality/.test(evidence) && /aidakit:reviewer-security/.test(evidence), "§learn-rollup-written: per-subagent table lists both subagents");
}

// N8a-ii: running learn's rollup twice REPLACES the section, never duplicates it.
{
  const { root, changeId } = makeLearnProject("learn-rollup-idempotent");
  writeSyntheticTelemetry(root, changeId, [
    { ts: "2026-07-25T10:00:00Z", subagent: "aidakit:tester", cache_creation: 10, cache_read: 20, pack_size: 30, duration_ms: 40, pack_rebuilt: false },
  ]);
  runRollupCli(["--change-id", changeId, "--root", root]);
  runRollupCli(["--change-id", changeId, "--root", root]);
  const evidence = readFileSync(join(root, "docs", "features", changeId, "evidence.md"), "utf8");
  const occurrences = (evidence.match(/## Context-pack telemetry rollup/g) || []).length;
  ok(occurrences === 1, "§learn-rollup-idempotent: running twice → exactly one section header, not duplicated");
  ok(/## Coverage report/.test(evidence), "§learn-rollup-idempotent: the following section (Coverage report) survives the replace");
}

// N8b-i: absent/empty telemetry → the literal "No telemetry captured for this run." with the header retained.
{
  const { root, changeId } = makeLearnProject("learn-rollup-empty");
  // No .telemetry.jsonl file at all.
  runRollupCli(["--change-id", changeId, "--root", root]);
  const evidence = readFileSync(join(root, "docs", "features", changeId, "evidence.md"), "utf8");
  ok(/## Context-pack telemetry rollup/.test(evidence), "§learn-rollup-empty-or-absent: section header retained even with no telemetry");
  ok(/No telemetry captured for this run\./.test(evidence), "§learn-rollup-empty-or-absent: exact literal message when telemetry is absent");
}

// ── §9 ADR-010 conformance ────────────────────────────────────────────────

// N9a-i: ADR-010 passes the format check.
{
  const adrPath = join(REPO, "docs", "decisions", "ADR-010-context-pack-per-change.md");
  const adrVal = join(GOV, "validators", "check-adr-format.js");
  const r = run(adrVal, [adrPath]);
  ok(r.code === 0 && r.json.ok, "§adr-010-passes-format: check-adr-format.js exits 0 on ADR-010");
}

// N9a-ii: ADR-010 is indexed in docs/decisions/README.md (ID table row + thematic bucket mention).
{
  const readme = readFileSync(join(REPO, "docs", "decisions", "README.md"), "utf8");
  ok(/\[ADR-010\]\(ADR-010-context-pack-per-change\.md\)/.test(readme), "§adr-010-indexed: ADR-010 row present in the index table");
  ok((readme.match(/ADR-010/g) || []).length >= 2, "§adr-010-indexed: ADR-010 mentioned in both the ID table and a thematic bucket");
}

console.log(`\n${pass} passed, ${fail} failed`);
rmSync(tmp, { recursive: true, force: true });
process.exit(fail ? 1 : 0);
