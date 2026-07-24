#!/usr/bin/env node
// append-retry-history — RETRY-MEMORY single writer.
// Appends one record to docs/features/<change_id>/retry-history.json before a
// flow's back-edge re-dispatches its retry target, so the next round of
// aidakit:plan/aidakit:implement/aidakit:learn can read WHY the prior round
// failed instead of re-producing the same rejected output blind.
// See docs/features/retry-memory/design.md §The append helper.
//
// Pure Node, zero-dep, same shape as the other validators (check-bench.js,
// check-doc-manifest.js). Contract: exit 0 recorded/no-op · 1 invalid cause.
//
// Usage:
//   node append-retry-history.js <change_id> <target_step_id> <cause> [--flow-id <flow_id>]
//
// Behavior:
//   1. Empty change_id or empty cause (unresolved interpolation, ADR-006
//      fail-safe) → exit 0 no-op, file untouched. Same defensive pattern as
//      commit_plan in full.yaml (ADR-009) — a bookkeeping hiccup must never
//      block the retry target.
//   2. cause must match RESUME_OUTPUT_VALUE_RE — a bad cause key is a real
//      contract violation by the caller, not a soft failure: exit 1.
//   3. round = state.context.__visits[target_step_id] read from the flow's
//      persisted state (governance/engine/persistence.js's statePath — NEVER
//      string-concatenated here). Missing --flow-id or missing/unreadable
//      state file → round: null (record still written).
//   4. Read/create docs/features/<change_id>/retry-history.json, append the
//      record, write atomically (<path>.tmp then rename).
//   5. Emit JSON on stdout: {validator, ok, change_id, target_step_id, cause, round}.

import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { join, dirname } from "node:path";
import { RESUME_OUTPUT_VALUE_RE } from "../engine/resume-output.js";
import { projectRoot, statePath } from "../engine/persistence.js";

function fail(msg) {
  process.stderr.write(`append-retry-history — error: ${msg}\n`);
  process.exit(1);
}

/** @param {string[]} argv */
function parseArgs(argv) {
  const positional = [];
  let flowId;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--flow-id") flowId = argv[++i];
    else positional.push(a);
  }
  return { changeId: positional[0] ?? "", targetStepId: positional[1] ?? "", cause: positional[2] ?? "", flowId };
}

/**
 * Reads `state.context.__visits[targetStepId]` from the persisted flow state.
 * Never throws — any read/parse problem (missing flow id, missing file,
 * malformed JSON, missing key) degrades to `null` ("unknown round"), because
 * round is auxiliary bookkeeping, not load-bearing for the record itself.
 * @param {string|undefined} flowId
 * @param {string} targetStepId
 * @returns {number|null}
 */
function readRound(flowId, targetStepId) {
  if (!flowId) return null;
  const p = statePath(flowId);
  if (!existsSync(p)) return null;
  try {
    const state = JSON.parse(readFileSync(p, "utf8"));
    const visits = state?.context?.__visits?.[targetStepId];
    return typeof visits === "number" ? visits : null;
  } catch {
    return null;
  }
}

function historyPath(changeId) {
  return join(projectRoot(), "docs", "features", changeId, "retry-history.json");
}

/**
 * Reads the retry-history array. Missing/empty/malformed all degrade to []
 * (round-1 semantics for the reader side, unchanged) — never throws.
 * @param {string} path
 * @returns {object[]}
 */
function readHistory(path) {
  if (!existsSync(path)) return [];
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Atomic write: write to `<path>.tmp` then rename over `path` (POSIX atomic
 * within a filesystem) — a crash mid-write can never leave a partial file. */
function writeAtomic(path, contents) {
  mkdirSync(dirname(path), { recursive: true });
  const tmpPath = `${path}.tmp`;
  writeFileSync(tmpPath, contents, "utf8");
  renameSync(tmpPath, path);
}

function main() {
  const { changeId, targetStepId, cause, flowId } = parseArgs(process.argv.slice(2));

  if (!changeId || !cause) {
    process.stdout.write(JSON.stringify({
      validator: "append-retry-history", ok: true, change_id: changeId, target_step_id: targetStepId, cause, round: null, skipped: true,
    }) + "\n");
    process.exit(0);
  }

  if (!RESUME_OUTPUT_VALUE_RE.test(cause)) {
    fail(`cause "${cause}" is not a valid single safe token — must match RESUME_OUTPUT_VALUE_RE (${RESUME_OUTPUT_VALUE_RE.source})`);
  }

  const round = readRound(flowId, targetStepId);
  const path = historyPath(changeId);
  const history = readHistory(path);
  history.push({ round, step_id: targetStepId, cause });
  writeAtomic(path, JSON.stringify(history, null, 2) + "\n");

  process.stdout.write(JSON.stringify({
    validator: "append-retry-history", ok: true, change_id: changeId, target_step_id: targetStepId, cause, round,
  }) + "\n");
  process.exit(0);
}

main();
