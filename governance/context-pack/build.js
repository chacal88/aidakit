#!/usr/bin/env node
// governance/context-pack/build.js — deterministic build/verify/rebuild for `.context-pack.md` (ADR-013).
//
// Placement note (design.md §"The new flow phase"): this file lives under
// `governance/`, NOT `skills/`, so it is reachable from a flow's `runs` step
// through the `$AIDAKIT_GOVERNANCE` env var per ADR-004 — `skills/` is a
// sibling of `governance/`, not a child, so a `skills/context-pack/build.js`
// script would not be callable from a `runs` step's command line.
// `skills/context-pack/SKILL.md` is the human/agent-facing contract that
// documents this script; this file is the mechanical implementation.
//
// Determinism (byte-stability, ADR-013 §Decision-3): the build reads ONLY the
// bytes of the change's own proposal.md/design.md/tasks.md and the ADRs/specs
// they cite — no Date.now(), no process.pid, no random ids, no absolute
// cwd-derived paths ever reach the output. `sources[]` paths are stored
// REPO-RELATIVE, so building the exact same source tree from two different
// absolute working directories produces byte-identical packs.
//
// Zero-dep. Pure Node. Subcommands:
//   build            — (re)compute the pack for --change-id, write it, overwrite if present.
//   rebuild          — alias for `build` (build is already idempotent/deterministic; kept as
//                      a distinct, explicit verb for the "force refresh" mental model).
//   verify           — runs both validators (byte-stability + freshness) against the pack;
//                      exits non-zero if EITHER fails.
//
// Usage:
//   node build.js [build|rebuild|verify] --change-id <id> [--root <path>]
// (no subcommand token defaults to "build" — the shape the flow's `runs` step invokes)

import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, dirname, join, relative } from "node:path";
import { execFileSync } from "node:child_process";
import { resolveProjectRoot } from "../engine/project-root.js";
import { assertValidChangeId } from "../engine/change-id.js";
import { parseAcceptanceCriteriaText } from "../acceptance/parse-criteria.js";
import { changeDirFor } from "../engine/change-dir.js";

const REQUIRED_SECTIONS = ["identity", "decisions", "ADRs", "specs", "code-map-pointers", "DoD"];

function fail(msg) { process.stderr.write(`context-pack build — error: ${msg}\n`); process.exit(2); }

function sha256Buf(buf) { return createHash("sha256").update(buf).digest("hex"); }
function sha256Text(text) { return sha256Buf(Buffer.from(text, "utf8")); }

function resolveRoot(explicitRoot) {
  return resolveProjectRoot(explicitRoot, process.cwd());
}

function readIfExists(absPath) {
  return existsSync(absPath) ? readFileSync(absPath, "utf8") : "";
}

// ── repo mode ────────────────────────────────────────────────────────────

/** Where the change's own plan artifacts live — `openspec/changes/<id>/` or
 * `docs/features/<id>/`, by repo mode. Owned by governance/engine/change-dir.js
 * since the acceptance cross-check needed the same answer; re-exported here
 * because this module published it first.
 *
 * The PACK ITSELF does not move: it stays at
 * `docs/features/<id>/.context-pack.md` in BOTH modes. Both flows' `context_pack`
 * step hardcodes that path in its freshness check (ADR-013 §Decision-5) and
 * linkFromPack() computes every ADR href against it — writing the pack anywhere
 * else would leave the freshness check pointed at a file that never exists,
 * silently rebuilding the pack on every flow run. */
export { changeDirFor } from "../engine/change-dir.js";

/** In OpenSpec mode, the change's own spec deltas
 * (`openspec/changes/<id>/specs/<capability>/spec.md`) plus, for each, the main
 * spec it amends (`openspec/specs/<capability>/spec.md`) when that exists.
 *
 * The deltas are the change's spec DELIVERABLE — as first-class as its
 * proposal/design/tasks — and they are the reason a `## specs` section derived
 * only from markdown links comes back empty in an OpenSpec repo: an OpenSpec
 * change carries its capabilities as sibling directories, not as
 * `openspec/specs/…` hrefs in the prose.
 *
 * Scoped strictly to the change's own directory listing — never a repo-wide
 * glob (ADR-013 §Decision-4) — and explicitly sorted, because readdirSync order
 * is filesystem-dependent and the build must be byte-stable. Returns [] in kit
 * mode, where `<changeDir>/specs/` does not exist. */
function openspecSpecPaths(root, changeDir) {
  const deltasRel = join(changeDir, "specs");
  if (!existsSync(resolve(root, deltasRel))) return [];
  const out = [];
  for (const capability of readdirSync(resolve(root, deltasRel)).sort()) {
    const deltaRel = join(deltasRel, capability, "spec.md");
    if (!existsSync(resolve(root, deltaRel))) continue; // a stray file, not a capability dir
    out.push(deltaRel);
    const mainRel = join("openspec", "specs", capability, "spec.md");
    if (existsSync(resolve(root, mainRel))) out.push(mainRel);
  }
  return out;
}

// ── source discovery ─────────────────────────────────────────────────────

// Round-1 bench fix (Spec NEEDS-REVISION): the earlier ADR_LINK_RE required
// the literal substring "docs/decisions/" immediately before the filename,
// so it missed every relative markdown link the rest of the repo actually
// uses (`../../decisions/ADR-006-....md`, `[ADR-009](../../decisions/
// ADR-009-....md)`, etc.) — the dogfood pack silently dropped ADR-006 and
// ADR-009 even though design.md's own Dependencies section cites both.
// Matching just the basename (`ADR-NNN-slug.md`) sidesteps the whole
// "how many `../` precede this" problem — every ADR lives at
// docs/decisions/ by repo convention, so discoverCitedPaths can always
// reconstruct the canonical repo-relative path from the basename alone,
// however the citing link was actually spelled.
const ADR_LINK_RE = /(ADR-\d+-[a-z0-9-]+\.md)/g;
// Specs/OpenSpec specs don't have a fixed basename convention (any capability
// name is valid), so the fix here instead tolerates an arbitrary relative
// prefix (`../`, nested dirs) before the literal `docs/specs/` /
// `openspec/specs/` anchor, and captures ONLY the anchor onward — never the
// leading `../` noise — so the extracted string is still a valid
// repo-relative path.
const SPEC_LINK_RE = /(?:\.\.\/|[a-z0-9_-]+\/)*(docs\/specs\/[^\s)`\]]+\.md)/g;
const OPENSPEC_LINK_RE = /(?:\.\.\/|[a-z0-9_-]+\/)*(openspec\/specs\/[^\s)`\]]+\/spec\.md)/g;

/** Scans the change's own proposal/design/tasks text for every ADR/spec
 * citation (the same citations reviewers already look for) and returns the
 * de-duplicated, repo-relative path list. Never globs the repo — only reads
 * links present in the three named files. */
function discoverCitedPaths(texts) {
  const found = new Set();
  for (const text of texts) {
    for (const m of text.matchAll(ADR_LINK_RE)) found.add(`docs/decisions/${m[1]}`);
    for (const m of text.matchAll(SPEC_LINK_RE)) found.add(m[1]);
    for (const m of text.matchAll(OPENSPEC_LINK_RE)) found.add(m[1]);
  }
  return [...found];
}

// ── mechanical distillation helpers (pure text extraction, no wall-clock) ──

function extractField(text, label) {
  const re = new RegExp("\\*\\*" + label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ":\\*\\*\\s*`([^`]*)`");
  const m = re.exec(text);
  return m ? m[1] : "";
}

/** Text of a `## <name>` section (until the next `## `), or "" if absent.
 * Case-insensitive on the heading text: real proposals in this repo carry both
 * `## Success criteria` and `## Success Criteria`, and a case-sensitive match
 * silently returned "" for the latter. */
function sectionBody(text, name) {
  const re = new RegExp(`^##\\s+${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "mi");
  const m = re.exec(text);
  if (!m) return "";
  const start = m.index + m[0].length;
  const rest = text.slice(start);
  const next = /^##\s+/m.exec(rest);
  return next ? rest.slice(0, next.index) : rest;
}

/** Body of the first section among `names` (preference order) that exists AND
 * is non-empty — the mechanism behind "read the mandated heading, tolerate the
 * legacy one". A present-but-empty heading falls through to the next candidate
 * rather than shadowing it. */
function firstSectionBody(text, names) {
  for (const name of names) {
    const body = sectionBody(text, name);
    if (body.trim()) return body;
  }
  return "";
}

function firstSentence(text) {
  const flat = text.replace(/\r?\n+/g, " ").replace(/\s+/g, " ").trim();
  if (!flat) return "";
  const m = /^(.+?\.)(\s|$)/.exec(flat);
  return (m ? m[1] : flat).trim();
}

/** Level-3 (`### `) headings inside a `## <parent>` section, with the 1-based
 * line number in `text` where each heading appears. */
function headingsInSection(text, parentSection) {
  const lines = text.split(/\r?\n/);
  const parentRe = new RegExp(`^##\\s+${parentSection.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`);
  let inSection = false;
  const out = [];
  lines.forEach((line, idx) => {
    if (parentRe.test(line)) { inSection = true; return; }
    if (inSection && /^##\s+/.test(line) && !/^###/.test(line)) { inSection = false; return; }
    if (inSection && /^###\s+/.test(line)) out.push({ text: line.replace(/^###\s+/, "").trim(), line: idx + 1 });
  });
  return out;
}

/** Round-1 bench fix (quality-blocking): rejects backtick tokens that are not
 * plausible file paths — a bare directory reference (`.aidakit/`, trailing
 * slash, no filename) or a skill id (`aidakit:learn`, colon-delimited, no
 * path separator at all). Kept permissive on everything else: any token
 * containing a `/`, or ending in one of the extensions this repo's tracked
 * artifacts actually use. */
function looksLikeFilePath(token) {
  if (token.includes(":")) return false;
  if (token.endsWith("/")) return false;
  return token.includes("/") || /\.(md|js|mjs|yaml|yml|ts)$/.test(token);
}

/** Every backtick-quoted, path-shaped token on a `- ` bullet line inside a
 * named `### ` subsection (used to lift the create/modify path list out of
 * design.md's File-structure section).
 *
 * Round-1 bench fix (quality-blocking, dogfood-found): (a) a bullet can list
 * SEVERAL backtick tokens on one line (`- CREATE: \`a.md\`, \`b.md\``) — the
 * old single `.exec` per line kept only the first, silently dropping the
 * rest; matchAll now collects every token. (b) the old stop condition only
 * matched a `##` (level-2) heading, so the sweep also ingested `### 3-point
 * estimate` / `### Effort breakdown` / `### Assumptions` — now stops at the
 * first heading of level 2 OR 3. */
function bulletPathsInSubsection(text, subsectionHeadingRe) {
  const m = subsectionHeadingRe.exec(text);
  if (!m) return [];
  const rest = text.slice(m.index + m[0].length);
  const next = /^###?\s+/m.exec(rest); // stop at the next level-2 OR level-3 heading
  const scoped = next ? rest.slice(0, next.index) : rest;
  const out = [];
  for (const line of scoped.split(/\r?\n/)) {
    if (!/^-\s/.test(line)) continue;
    for (const bm of line.matchAll(/`([^`]+)`/g)) {
      if (looksLikeFilePath(bm[1])) out.push(bm[1]);
    }
  }
  return [...new Set(out)];
}

// Heading names, in preference order: the one the kit MANDATES first, the
// legacy name it replaced as a tolerated fallback. Both derivations below used
// to name ONLY the legacy heading, so every conforming change built a pack with
// an empty `summary` and a placeholder `DoD` — the two things ADR-013 created
// the pack to carry into each dispatch.

// `## Why` is what skills/plan/SKILL.md emits and what every non-archived
// proposal in this repo carries; `## Problem` is the legacy name (still used by
// the context-pack-l1 proposal that introduced this builder).
const SUMMARY_SECTIONS = ["Why", "Problem"];

// The DoD's mandated source is `## Acceptance criteria` (ADR-010 §Decision-3),
// parsed by its single owner — see extractDoD. These are the LEGACY fallbacks
// only. `## Exit criteria` is deliberately absent: ADR-010 §Decision-3 keeps
// validator commands (Exit) and observable-effect promises (Acceptance) as
// separate sections that "do not merge", so folding Exit in here would put
// shell invocations under the pack's `## DoD`.
const LEGACY_DOD_SECTIONS = ["Success criteria"];

/** The DoD lines for the pack.
 *
 * Primary source: `## Acceptance criteria`, the section ADR-010 §Decision-3
 * makes mandatory for fast-flow changes — parsed through
 * `parseAcceptanceCriteriaText`, the single owner of that grammar, so the
 * accepted bullet shapes cannot drift between the acceptance leash and the pack.
 *
 * Deliberately proposal.md-ONLY, which is why this calls the text-level parser
 * instead of `parseCriteria()`: that entry point prefers
 * `.aidakit/tasks/<id>/brainstorm.json`, but `.aidakit/` is gitignored, so a
 * DoD derived from it could never appear in the pack's `sources[]` — it would
 * be invisible to the freshness validator and would differ between machines
 * building the same commit. Both are byte-stability violations (ADR-013
 * §Decision-1 and §Decision-4).
 *
 * Fallback: the legacy `## Success criteria` list, accepting numbered `1.` as
 * well as `-`/`*` bullets so an in-flight change written either way still
 * yields a DoD. */
function extractDoD(proposalText) {
  const mandated = parseAcceptanceCriteriaText(proposalText);
  if (mandated.length > 0) return mandated.map((c) => c.criterion);

  const body = firstSectionBody(proposalText, LEGACY_DOD_SECTIONS);
  const out = [];
  for (const line of body.split(/\r?\n/)) {
    const m = /^\s*(?:\d+\.|[-*])\s+(.+)$/.exec(line);
    if (m) out.push(m[1].trim());
  }
  return out;
}

// ── the six sections ─────────────────────────────────────────────────────

function renderIdentity(proposalText) {
  const changeId = extractField(proposalText, "Change ID");
  const date = extractField(proposalText, "Date");
  const owner = extractField(proposalText, "Owner");
  const phase = extractField(proposalText, "Phase / Package");
  const summary = firstSentence(firstSectionBody(proposalText, SUMMARY_SECTIONS));
  const lines = [
    `- change_id: ${changeId}`,
    `- date: ${date}`,
    `- owner: ${owner}`,
    `- phase: ${phase}`,
    `- summary: ${summary}`,
  ];
  return lines.join("\n");
}

function renderDecisions(designText) {
  const headings = headingsInSection(designText, "Architecture");
  if (headings.length === 0) return "- design.md:1 — see the Architecture section";
  return headings.map((h) => `- design.md:${h.line} — ${h.text}`).join("\n");
}

/** check-links.js resolves a markdown link relative to the FILE's own
 * directory, not the repo root — the pack lives at
 * docs/features/<changeId>/.context-pack.md, so a bare repo-relative href
 * (e.g. "docs/decisions/ADR-004-....md") would resolve to a nonexistent
 * nested path from there. Compute the link relative to the pack's own dir. */
function linkFromPack(changeId, repoRelativeTarget) {
  const packDir = join("docs", "features", changeId);
  return relative(packDir, repoRelativeTarget).split("\\").join("/");
}

function renderAdrs(adrPaths, changeId) {
  if (adrPaths.length === 0) return "- (no ADRs cited)";
  return [...adrPaths]
    .sort()
    .map((p) => {
      const m = /ADR-(\d+)-([a-z0-9-]+)\.md$/.exec(p);
      const label = m ? `ADR-${m[1]}` : p;
      return `- [${label}](${linkFromPack(changeId, p)}) — cited in this change's plan`;
    })
    .join("\n");
}

function renderSpecs(specPaths) {
  if (specPaths.length === 0) return "- (no capability specs cited)";
  return [...specPaths].sort().map((p) => `- ${p}`).join("\n");
}

function renderCodeMapPointers(designText) {
  const paths = bulletPathsInSubsection(designText, /^###\s+File structure.*$/m);
  if (paths.length === 0) return "- (no file-structure entries found)";
  return [...paths].sort().map((p) => `- ${p}`).join("\n");
}

function renderDoD(proposalText) {
  const criteria = extractDoD(proposalText);
  if (criteria.length === 0) return "- (no acceptance criteria found)";
  return criteria.map((c) => `- ${c}`).join("\n");
}

// ── frontmatter ──────────────────────────────────────────────────────────

function computeTopHash(sources) {
  const sorted = [...sources].sort((a, b) => a.path.localeCompare(b.path));
  const canon = sorted.map((s) => `${s.path}:${s.sha256}`).join("\n");
  return sha256Text(canon);
}

function renderFrontmatter(changeId, sources) {
  const sorted = [...sources].sort((a, b) => a.path.localeCompare(b.path));
  const lines = ["---", `change_id: ${changeId}`, `built_at_source_hash: ${computeTopHash(sources)}`, "pack_version: 1", "sources:"];
  for (const s of sorted) {
    lines.push(`  - path: ${s.path}`);
    lines.push(`    sha256: ${s.sha256}`);
  }
  lines.push("---", "");
  return lines.join("\n");
}

// ── the pure build function (importable — no disk write, no CLI parsing) ──

/**
 * @param {{root:string, changeId:string}} opts
 * @returns {{content:string, sources:Array<{path:string,sha256:string}>}}
 */
export function buildPackContent({ root, changeId }) {
  const changeDir = changeDirFor(root, changeId);
  const proposalRel = join(changeDir, "proposal.md");
  const designRel = join(changeDir, "design.md");
  const tasksRel = join(changeDir, "tasks.md");

  const proposalText = readIfExists(resolve(root, proposalRel));
  const designText = readIfExists(resolve(root, designRel));
  const tasksText = readIfExists(resolve(root, tasksRel));

  const alwaysOn = [proposalRel, designRel, tasksRel, ...openspecSpecPaths(root, changeDir)].filter((rel) => existsSync(resolve(root, rel)));
  const cited = discoverCitedPaths([proposalText, designText, tasksText]).filter((rel) => existsSync(resolve(root, rel)));

  const allPaths = [...new Set([...alwaysOn, ...cited])].map((p) => p.split("\\").join("/")); // POSIX-normalize on any platform
  const sources = allPaths.map((rel) => ({ path: rel, sha256: sha256Buf(readFileSync(resolve(root, rel))) }));

  const adrPaths = allPaths.filter((p) => /^docs\/decisions\/ADR-\d+-/.test(p));
  const specPaths = allPaths.filter(
    (p) => /^docs\/specs\//.test(p) || /^openspec\/specs\//.test(p) || /^openspec\/changes\/[^/]+\/specs\//.test(p),
  );

  const sections = [
    ["identity", renderIdentity(proposalText)],
    ["decisions", renderDecisions(designText)],
    ["ADRs", renderAdrs(adrPaths, changeId)],
    ["specs", renderSpecs(specPaths)],
    ["code-map-pointers", renderCodeMapPointers(designText)],
    ["DoD", renderDoD(proposalText)],
  ];

  const body = sections.map(([name, content]) => `## ${name}\n\n${content}\n`).join("\n");
  const content = renderFrontmatter(changeId, sources) + "\n" + body;
  return { content, sources };
}

// ── CLI ──────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const known = new Set(["build", "rebuild", "verify"]);
  let subcommand = "build";
  const rest = [...argv];
  if (rest[0] && known.has(rest[0])) subcommand = rest.shift();
  const opts = {};
  for (let i = 0; i < rest.length; i++) {
    const tok = rest[i];
    const eqForm = /^--([a-z-]+)=(.*)$/.exec(tok);
    if (eqForm) { opts[eqForm[1]] = eqForm[2]; continue; }
    const flagForm = /^--([a-z-]+)$/.exec(tok);
    if (flagForm) {
      const next = rest[i + 1];
      if (next !== undefined && !/^--/.test(next)) { opts[flagForm[1]] = next; i++; }
      else opts[flagForm[1]] = true;
    }
  }
  return { subcommand, opts };
}

/** Round-1 bench fix (Security veto #2): change_id reaches this FS-write
 * sink from a resume's `change_id=<value>` structured output, which the
 * generic RESUME_OUTPUT_VALUE_RE permits to contain `.` and `/` (and even a
 * leading `/`) — `change_id=/tmp/pwned` or `change_id=../../../../tmp/pwned`
 * would otherwise let resolve() write outside the project root. Guard
 * fail-closed BEFORE any resolve()/join() — see governance/engine/
 * change-id.js for the shared strict shape. Exported for direct unit testing
 * of this sink in isolation (defense-in-depth from the resume boundary
 * check in governance/engine/steps/invoke.js). */
export function packPathFor(root, changeId) {
  assertValidChangeId(changeId);
  return resolve(root, "docs", "features", changeId, ".context-pack.md");
}

function cmdBuild(root, changeId) {
  const { content } = buildPackContent({ root, changeId });
  const target = packPathFor(root, changeId);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
  return target;
}

function cmdVerify(root, changeId) {
  const target = packPathFor(root, changeId);
  const validatorsDir = new URL("../validators/", import.meta.url).pathname;
  const results = [];
  for (const validator of ["check-context-pack.js", "check-context-pack-freshness.js"]) {
    try {
      execFileSync("node", [join(validatorsDir, validator), "--json", target], { encoding: "utf8" });
      results.push({ validator, ok: true });
    } catch (e) {
      results.push({ validator, ok: false, status: e.status });
    }
  }
  return results;
}

function main() {
  const { subcommand, opts } = parseArgs(process.argv.slice(2));
  const changeId = opts["change-id"];
  if (!changeId || changeId === true) fail("usage: build.js [build|rebuild|verify] --change-id <id> [--root <path>]");
  const root = resolveRoot(opts.root === true ? undefined : opts.root);

  if (subcommand === "build" || subcommand === "rebuild") {
    const target = cmdBuild(root, changeId);
    process.stdout.write(JSON.stringify({ ok: true, subcommand, path: target }) + "\n");
    process.exit(0);
  }
  if (subcommand === "verify") {
    const results = cmdVerify(root, changeId);
    const ok = results.every((r) => r.ok);
    process.stdout.write(JSON.stringify({ ok, subcommand, results }) + "\n");
    process.exit(ok ? 0 : 1);
  }
  fail(`unknown subcommand: ${subcommand}`);
}

// Only run the CLI when invoked directly (importers get the pure functions).
if (import.meta.url === `file://${process.argv[1]}`) main();
