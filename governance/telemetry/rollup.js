#!/usr/bin/env node
// governance/telemetry/rollup.js — aggregates a change's `.telemetry.jsonl`
// into a rollup section written IDEMPOTENTLY into `evidence.md`
// (aidakit:learn §4.5, ADR-013 §Decision-7). The JSONL itself is ephemeral
// (gitignored, per-run); this rollup is the durable record that survives
// once the worktree is cleaned.
//
// Placement note: co-located with governance/telemetry/append.js (the
// writer this reads back) rather than a new top-level directory — the two
// files own the same concern (the telemetry JSONL's shape) from opposite
// ends (write vs. aggregate-and-read).
//
// Zero-dep. Usage: node rollup.js --change-id <id> [--root <path>]

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { resolveProjectRoot } from "../engine/project-root.js";
import { telemetryPathFor } from "./append.js";

const SECTION_HEADING = "## Context-pack telemetry rollup";

/**
 * @param {string} text raw contents of a `.telemetry.jsonl` file
 * @returns {Array<Object>}
 */
export function parseTelemetryLines(text) {
  return text
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "")
    .map((l) => JSON.parse(l));
}

/**
 * @param {Array<Object>} entries parsed telemetry lines
 * @returns {null|{totalDispatches:number, meanPackSize:number, sumCacheRead:number, sumCacheCreation:number, rebuilds:number, perSubagent:Array<{subagent:string, dispatches:number, meanCacheRead:number, meanPackSize:number}>}}
 */
export function computeRollup(entries) {
  if (!entries || entries.length === 0) return null;

  const total = entries.length;
  const sumPackSize = entries.reduce((s, e) => s + (e.pack_size || 0), 0);
  const sumCacheRead = entries.reduce((s, e) => s + (e.cache_read || 0), 0);
  const sumCacheCreation = entries.reduce((s, e) => s + (e.cache_creation || 0), 0);
  const rebuilds = entries.filter((e) => e.pack_rebuilt === true).length;

  const bySubagent = new Map();
  for (const e of entries) {
    const key = e.subagent || "(unknown)";
    if (!bySubagent.has(key)) bySubagent.set(key, []);
    bySubagent.get(key).push(e);
  }
  const perSubagent = [...bySubagent.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([subagent, rows]) => {
      const n = rows.length;
      const meanCacheRead = Math.round(rows.reduce((s, r) => s + (r.cache_read || 0), 0) / n);
      const meanPackSize = Math.round(rows.reduce((s, r) => s + (r.pack_size || 0), 0) / n);
      return { subagent, dispatches: n, meanCacheRead, meanPackSize };
    });

  return {
    totalDispatches: total,
    meanPackSize: Math.round(sumPackSize / total),
    sumCacheRead,
    sumCacheCreation,
    rebuilds,
    perSubagent,
  };
}

/**
 * @param {null|ReturnType<typeof computeRollup>} rollup
 * @returns {string} the rendered `## Context-pack telemetry rollup` section, including its heading
 */
export function renderRollupSection(rollup) {
  if (!rollup) {
    return `${SECTION_HEADING}\n\nNo telemetry captured for this run.\n`;
  }
  const lines = [
    SECTION_HEADING,
    "",
    `- Total dispatches: ${rollup.totalDispatches}`,
    `- Mean pack_size: ${rollup.meanPackSize} bytes`,
    `- Sum cache_read: ${rollup.sumCacheRead} tokens`,
    `- Sum cache_creation: ${rollup.sumCacheCreation} tokens`,
    `- Pack rebuilds: ${rollup.rebuilds}`,
    "",
    "| subagent | dispatches | mean cache_read | mean pack_size |",
    "|---|---|---|---|",
    ...rollup.perSubagent.map((r) => `| ${r.subagent} | ${r.dispatches} | ${r.meanCacheRead} | ${r.meanPackSize} |`),
    "",
  ];
  return lines.join("\n");
}

/**
 * Idempotently replaces the `## Context-pack telemetry rollup` section (from
 * its heading up to the next `## ` heading or EOF) with freshly rendered
 * content. Appends the section at the end when it doesn't exist yet.
 * @param {string} evidencePath
 * @param {null|ReturnType<typeof computeRollup>} rollup
 */
export function writeRollupIntoEvidence(evidencePath, rollup) {
  const existing = existsSync(evidencePath) ? readFileSync(evidencePath, "utf8") : "";
  const rendered = renderRollupSection(rollup);
  const headingRe = /^## Context-pack telemetry rollup\s*$/m;
  const m = headingRe.exec(existing);

  let next;
  if (!m) {
    next = existing.replace(/\s*$/, "\n\n") + rendered;
  } else {
    const start = m.index;
    const rest = existing.slice(start + m[0].length);
    const nextHeadingMatch = /^##\s+/m.exec(rest);
    const end = nextHeadingMatch ? start + m[0].length + nextHeadingMatch.index : existing.length;
    next = existing.slice(0, start) + rendered + "\n" + existing.slice(end);
  }
  writeFileSync(evidencePath, next);
  return evidencePath;
}

// ── CLI ──────────────────────────────────────────────────────────────────

function resolveRoot(explicitRoot) {
  return resolveProjectRoot(explicitRoot, process.cwd());
}

function parseArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const m = /^--([a-z-]+)$/.exec(argv[i]);
    if (m) {
      opts[m[1]] = argv[i + 1];
      i++;
    }
  }
  return opts;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const changeId = opts["change-id"];
  if (!changeId) {
    process.stderr.write("usage: rollup.js --change-id <id> [--root <path>]\n");
    process.exit(2);
  }
  const root = resolveRoot(opts.root);
  const telemetryPath = telemetryPathFor(changeId, root);
  const entries = existsSync(telemetryPath) ? parseTelemetryLines(readFileSync(telemetryPath, "utf8")) : [];
  const rollup = computeRollup(entries);

  const evidencePath = resolve(root, "docs", "features", changeId, "evidence.md");
  mkdirSync(dirname(evidencePath), { recursive: true });
  writeRollupIntoEvidence(evidencePath, rollup);

  process.stdout.write(JSON.stringify({ ok: true, changeId, dispatches: rollup ? rollup.totalDispatches : 0 }) + "\n");
}

if (import.meta.url === `file://${process.argv[1]}`) main();
