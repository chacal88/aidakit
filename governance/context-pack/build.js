#!/usr/bin/env node
// governance/context-pack/build.js — deterministic build/verify/rebuild for `.context-pack.md` (ADR-010).
//
// Placement note (design.md §"The new flow phase"): this file lives under
// `governance/`, NOT `skills/`, so it is reachable from a flow's `runs` step
// through the `$AIDAKIT_GOVERNANCE` env var per ADR-004 — `skills/` is a
// sibling of `governance/`, not a child, so a `skills/context-pack/build.js`
// script would not be callable from a `runs` step's command line.
// `skills/context-pack/SKILL.md` is the human/agent-facing contract that
// documents this script; this file is the mechanical implementation.
//
// Determinism (byte-stability, ADR-010 §Decision-3): the build reads ONLY the
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

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, dirname, join } from "node:path";
import { execFileSync } from "node:child_process";
import { findProjectRoot } from "../engine/project-root.js";

const REQUIRED_SECTIONS = ["identity", "decisions", "ADRs", "specs", "code-map-pointers", "DoD"];

function fail(msg) { process.stderr.write(`context-pack build — error: ${msg}\n`); process.exit(2); }

function sha256Buf(buf) { return createHash("sha256").update(buf).digest("hex"); }
function sha256Text(text) { return sha256Buf(Buffer.from(text, "utf8")); }

function resolveRoot(explicitRoot) {
  if (explicitRoot) return resolve(explicitRoot);
  if (process.env.AIDAKIT_PROJECT_ROOT) return resolve(process.env.AIDAKIT_PROJECT_ROOT);
  return findProjectRoot(process.cwd());
}

function readIfExists(absPath) {
  return existsSync(absPath) ? readFileSync(absPath, "utf8") : "";
}

// ── source discovery ─────────────────────────────────────────────────────

const ADR_LINK_RE = /docs\/decisions\/(ADR-\d+-[a-z0-9-]+\.md)/g;
const SPEC_LINK_RE = /docs\/specs\/[^\s)`\]]+\.md/g;
const OPENSPEC_LINK_RE = /openspec\/specs\/[^\s)`\]]+\/spec\.md/g;

/** Scans the change's own proposal/design/tasks text for every ADR/spec
 * citation (the same citations reviewers already look for) and returns the
 * de-duplicated, repo-relative path list. Never globs the repo — only reads
 * links present in the three named files. */
function discoverCitedPaths(texts) {
  const found = new Set();
  for (const text of texts) {
    for (const m of text.matchAll(ADR_LINK_RE)) found.add(`docs/decisions/${m[1]}`);
    for (const m of text.matchAll(SPEC_LINK_RE)) found.add(m[0]);
    for (const m of text.matchAll(OPENSPEC_LINK_RE)) found.add(m[0]);
  }
  return [...found];
}

// ── mechanical distillation helpers (pure text extraction, no wall-clock) ──

function extractField(text, label) {
  const re = new RegExp("\\*\\*" + label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ":\\*\\*\\s*`([^`]*)`");
  const m = re.exec(text);
  return m ? m[1] : "";
}

/** Text of a `## <name>` section (until the next `## `), or "" if absent. */
function sectionBody(text, name) {
  const re = new RegExp(`^##\\s+${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "m");
  const m = re.exec(text);
  if (!m) return "";
  const start = m.index + m[0].length;
  const rest = text.slice(start);
  const next = /^##\s+/m.exec(rest);
  return next ? rest.slice(0, next.index) : rest;
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

/** Every `- \`path\`` bullet inside a named `### ` subsection (used to lift
 * the create/modify path list out of design.md's File-structure section). */
function bulletPathsInSubsection(text, subsectionHeadingRe) {
  const m = subsectionHeadingRe.exec(text);
  if (!m) return [];
  const rest = text.slice(m.index + m[0].length);
  const next = /^##\s+/m.exec(rest); // stop at the next level-2 heading
  const scoped = next ? rest.slice(0, next.index) : rest;
  const out = [];
  for (const bm of scoped.matchAll(/^-\s*`([^`]+)`/gm)) out.push(bm[1]);
  return [...new Set(out)];
}

function extractSuccessCriteria(proposalText) {
  const body = sectionBody(proposalText, "Success criteria");
  const out = [];
  for (const line of body.split(/\r?\n/)) {
    const m = /^\s*\d+\.\s+(.+)$/.exec(line);
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
  const summary = firstSentence(sectionBody(proposalText, "Problem"));
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

function renderAdrs(adrPaths) {
  if (adrPaths.length === 0) return "- (no ADRs cited)";
  return [...adrPaths]
    .sort()
    .map((p) => {
      const m = /ADR-(\d+)-([a-z0-9-]+)\.md$/.exec(p);
      const label = m ? `ADR-${m[1]}` : p;
      return `- [${label}](${p}) — cited in this change's plan`;
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
  const criteria = extractSuccessCriteria(proposalText);
  if (criteria.length === 0) return "- (no success criteria found)";
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
  const changeDir = join("docs", "features", changeId);
  const proposalRel = join(changeDir, "proposal.md");
  const designRel = join(changeDir, "design.md");
  const tasksRel = join(changeDir, "tasks.md");

  const proposalText = readIfExists(resolve(root, proposalRel));
  const designText = readIfExists(resolve(root, designRel));
  const tasksText = readIfExists(resolve(root, tasksRel));

  const alwaysOn = [proposalRel, designRel, tasksRel].filter((rel) => existsSync(resolve(root, rel)));
  const cited = discoverCitedPaths([proposalText, designText, tasksText]).filter((rel) => existsSync(resolve(root, rel)));

  const allPaths = [...new Set([...alwaysOn, ...cited])].map((p) => p.split("\\").join("/")); // POSIX-normalize on any platform
  const sources = allPaths.map((rel) => ({ path: rel, sha256: sha256Buf(readFileSync(resolve(root, rel))) }));

  const adrPaths = allPaths.filter((p) => /^docs\/decisions\/ADR-\d+-/.test(p));
  const specPaths = allPaths.filter((p) => /^docs\/specs\//.test(p) || /^openspec\/specs\//.test(p));

  const sections = [
    ["identity", renderIdentity(proposalText)],
    ["decisions", renderDecisions(designText)],
    ["ADRs", renderAdrs(adrPaths)],
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

function packPathFor(root, changeId) {
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
