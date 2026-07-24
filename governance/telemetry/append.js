// governance/telemetry/append.js — append-only JSONL writer for per-change
// context-pack telemetry (ADR-010 §Decision-7).
//
// Zero-dep. Resolves `.aidakit/tasks/<change_id>/.telemetry.jsonl` via
// findProjectRoot / AIDAKIT_PROJECT_ROOT — the same convention as
// check-doc-manifest.js. Always opens in APPEND mode: never rewrites,
// truncates or reorders prior lines.
//
// The telemetry file is EXEMPT from the pack's byte-stability rule (ADR-010
// §Decision-7 explicitly): `ts` is a real wall-clock timestamp, because this
// file's whole purpose is a chronological, ephemeral, gitignored per-dispatch
// log — unlike `.context-pack.md`, it is never injected as a stable prefix.
//
// Called from governance/engine/steps/invoke.js's resume handler when the
// caller supplied telemetry kwargs; never invoked by an agent/skill directly.

import { mkdirSync, appendFileSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { findProjectRoot } from "../engine/project-root.js";

/**
 * @param {string} changeId
 * @param {string} [root] explicit project root override (else AIDAKIT_PROJECT_ROOT, else climb from cwd)
 * @returns {string} absolute path to the change's telemetry JSONL
 */
export function telemetryPathFor(changeId, root) {
  const base = root
    ? resolve(root)
    : process.env.AIDAKIT_PROJECT_ROOT
      ? resolve(process.env.AIDAKIT_PROJECT_ROOT)
      : findProjectRoot(process.cwd());
  return join(base, ".aidakit", "tasks", changeId, ".telemetry.jsonl");
}

/**
 * Appends ONE JSON line for a single dispatch. Never rewrites prior content.
 * @param {{
 *   changeId: string,
 *   root?: string,
 *   subagent: string,
 *   cache_creation?: number,
 *   cache_read?: number,
 *   pack_size?: number,
 *   duration_ms?: number,
 *   pack_rebuilt?: boolean,
 *   ts?: string,
 * }} entry
 * @returns {string} the path the line was appended to
 */
export function appendTelemetry(entry) {
  const { changeId, root, ts, subagent, cache_creation, cache_read, pack_size, duration_ms, pack_rebuilt } = entry;
  if (!changeId) throw new Error("appendTelemetry: changeId is required");
  if (!subagent) throw new Error("appendTelemetry: subagent is required");

  const path = telemetryPathFor(changeId, root);
  mkdirSync(dirname(path), { recursive: true });

  const record = {
    ts: ts ?? new Date().toISOString(),
    subagent,
    cache_creation: cache_creation ?? 0,
    cache_read: cache_read ?? 0,
    pack_size: pack_size ?? 0,
    duration_ms: duration_ms ?? 0,
    pack_rebuilt: pack_rebuilt ?? false,
  };
  appendFileSync(path, JSON.stringify(record) + "\n");
  return path;
}
