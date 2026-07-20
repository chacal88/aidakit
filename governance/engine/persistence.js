// aidakit flow state persistence.
// Ported from recruit/.governance/orchestrator/persistence.ts, reparameterized
// for the target project's .aidakit/ base (no recruit/.governance paths).
//
// - Per-flow state in .aidakit/flows/state/<flow_id>.json (pretty JSON).
// - Append-only event log in .aidakit/flows/logs/<flow_id>.log (JSON-lines).
// - flow_id = "<name>-<YYMMDD>-<hex>".

import { mkdirSync, writeFileSync, appendFileSync, readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * Target project root. Default: cwd. Can be overridden via the
 * AIDAKIT_PROJECT_ROOT env var (useful for tests and for the CLI to point at
 * another repo).
 * @returns {string}
 */
export function projectRoot() {
  return process.env.AIDAKIT_PROJECT_ROOT
    ? resolve(process.env.AIDAKIT_PROJECT_ROOT)
    : process.cwd();
}

function stateDir() {
  return join(projectRoot(), ".aidakit", "flows", "state");
}
function logsDir() {
  return join(projectRoot(), ".aidakit", "flows", "logs");
}
function statePath(flowId) {
  return join(stateDir(), `${flowId}.json`);
}
function logPath(flowId) {
  return join(logsDir(), `${flowId}.log`);
}

/**
 * Generates a mostly-unique flow_id. Accepts an injectable entropy suffix for
 * deterministic tests (the engine can't use Math.random/Date.now directly in a
 * workflow context, but the real CLI runtime can).
 * @param {string} name
 * @param {{now?: Date, rand?: string}} [opts]
 * @returns {string}
 */
export function newFlowId(name, opts = {}) {
  const now = opts.now ?? new Date();
  const yy = String(now.getUTCFullYear()).slice(2);
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const rand = opts.rand ?? Math.random().toString(16).slice(2, 8);
  return `${name}-${yy}${mm}${dd}-${rand}`;
}

/**
 * @param {import('./types.js').FlowState} state
 */
export function saveState(state) {
  mkdirSync(stateDir(), { recursive: true });
  writeFileSync(statePath(state.flow_id), JSON.stringify(state, null, 2) + "\n", "utf8");
}

/**
 * @param {string} flowId
 * @returns {import('./types.js').FlowState|null}
 */
export function loadState(flowId) {
  const p = statePath(flowId);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8"));
}

/**
 * Appends an event to the JSON-lines log. Best-effort (never throws).
 * @param {string} flowId
 * @param {Object.<string,unknown>} event
 */
export function logEvent(flowId, event) {
  try {
    mkdirSync(logsDir(), { recursive: true });
    const line = JSON.stringify({ at: new Date().toISOString(), ...event }) + "\n";
    appendFileSync(logPath(flowId), line, "utf8");
  } catch {
    // the log is auxiliary; it doesn't block the flow.
  }
}
