// YAML flow loader + shape validation (no ajv — lightweight manual validation).
// Ported from recruit/.governance/orchestrator/parser.ts, swapping ajv's
// compile() for validateFlowShape() in plain Node.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve, basename, join } from "node:path";
import { parse as parseYaml } from "./yaml-min.js";
import { projectRoot } from "./persistence.js";
import { STEP_TYPES } from "./types.js";

/**
 * Flow directories. Priority: target-project flows (.aidakit/flows/),
 * otherwise the default flows bundled with the plugin (governance/flows/).
 * @returns {string[]} list of directories to search, in priority order
 */
function flowDirs() {
  const dirs = [join(projectRoot(), ".aidakit", "flows")];
  // Plugin default flows: relative to this file.
  const here = new URL(".", import.meta.url).pathname;
  dirs.push(resolve(here, "..", "flows"));
  return dirs;
}

export function flowFilePath(name) {
  for (const dir of flowDirs()) {
    const p = resolve(dir, `${name}.yaml`);
    if (existsSync(p)) return p;
  }
  // Default: path in the plugin directory (for the error message).
  return resolve(flowDirs()[flowDirs().length - 1], `${name}.yaml`);
}

export function listFlowNames() {
  const names = new Set();
  for (const dir of flowDirs()) {
    if (!existsSync(dir)) continue;
    for (const n of readdirSync(dir)) {
      if (n.endsWith(".yaml")) names.add(n.replace(/\.yaml$/, ""));
    }
  }
  return [...names].sort();
}

/**
 * @param {string} name
 * @returns {{flow?:import('./types.js').Flow, errors:{path:string,message:string}[]}}
 */
export function loadFlow(name) {
  const path = flowFilePath(name);
  if (!existsSync(path)) return { errors: [{ path: name, message: `flow not found: ${path}` }] };
  return parseFlowFile(path);
}

export function parseFlowFile(path) {
  const raw = readFileSync(path, "utf8");
  let data;
  try {
    data = parseYaml(raw);
  } catch (err) {
    return { errors: [{ path, message: `yaml parse error: ${err.message}` }] };
  }
  // Backward-compat: normalize the legacy type "agent" → "invoke" and the field
  // "agent:" → "invoca:" before validating, so the rest of the engine only deals
  // with "invoke". Old flows keep loading without edits.
  if (data && Array.isArray(data.steps)) normalizeLegacyInvoke(data.steps);

  const shapeErrors = validateFlowShape(data);
  if (shapeErrors.length) return { errors: shapeErrors.map((m) => ({ path, message: m })) };

  const flow = data;
  // Defensive: the file name must match flow.flow.
  const expected = basename(path).replace(/\.yaml$/, "");
  if (flow.flow !== expected) {
    return { errors: [{ path, message: `flow name mismatch: file is "${expected}" but flow.flow is "${flow.flow}"` }] };
  }
  // Defensive: every step id is unique within its scope.
  const dupErrors = [];
  checkUniqueIds(flow.steps, "/", dupErrors, path);
  if (dupErrors.length) return { errors: dupErrors };

  // Defensive: every routing target (on_success/on_failure/on_result) points to
  // an existing step id. Catches a typo-broken flow at LOAD time, not at runtime
  // after human gates and wasted work.
  const targetErrors = [];
  checkRoutingTargets(flow.steps, path, targetErrors);
  if (targetErrors.length) return { errors: targetErrors };

  return { flow, errors: [] };
}

/**
 * Lightweight manual validation of the flow shape (replaces ajv).
 * @param {unknown} data
 * @returns {string[]} error messages (empty = ok)
 */
export function validateFlowShape(data) {
  const errs = [];
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return ["flow must be a top-level map"];
  }
  const d = /** @type {any} */ (data);
  if (typeof d.flow !== "string" || !d.flow) errs.push("field 'flow' (string) is required");
  if (typeof d.description !== "string") errs.push("field 'description' (string) is required");
  if (!Array.isArray(d.steps) || d.steps.length === 0) {
    errs.push("field 'steps' (non-empty list) is required");
    return errs;
  }
  validateSteps(d.steps, "steps", errs);
  return errs;
}

/**
 * Normalizes in-place the legacy type "agent" → "invoke" and the field "agent" →
 * "invoca", recursively (loop body, parallel branches). Idempotent: a step
 * already on "invoke" is left untouched.
 */
function normalizeLegacyInvoke(steps) {
  if (!Array.isArray(steps)) return;
  for (const s of steps) {
    if (s && typeof s === "object") {
      if (s.type === "agent") s.type = "invoke";
      if (s.type === "invoke" && s.invoca === undefined && typeof s.agent === "string") {
        s.invoca = s.agent;
        delete s.agent;
      }
      if (Array.isArray(s.body)) normalizeLegacyInvoke(s.body);
      if (Array.isArray(s.branches)) s.branches.forEach((b) => normalizeLegacyInvoke(b));
    }
  }
}

function validateSteps(steps, where, errs) {
  if (!Array.isArray(steps)) { errs.push(`${where}: expected list`); return; }
  steps.forEach((s, i) => {
    const at = `${where}[${i}]`;
    if (s === null || typeof s !== "object") { errs.push(`${at}: step must be a map`); return; }
    if (typeof s.id !== "string" || !s.id) errs.push(`${at}: 'id' (string) is required`);
    if (!STEP_TYPES.includes(s.type)) errs.push(`${at}: invalid 'type' "${s.type}" (expected ${STEP_TYPES.join("|")})`);
    // Per-type validation of the required fields.
    if (s.type === "invoke" && typeof s.invoca !== "string") errs.push(`${at}: invoke step requires 'invoca' (string — the skill/agent to dispatch)`);
    if (s.type === "runs" && typeof s.command !== "string") errs.push(`${at}: runs step requires 'command' (string)`);
    if ((s.type === "human_handoff" || s.type === "human_gate") && typeof s.prompt !== "string") errs.push(`${at}: step ${s.type} requires 'prompt' (string)`);
    if (s.type === "human_gate" && !Array.isArray(s.options)) errs.push(`${at}: human_gate step requires 'options' (list)`);
    if (s.type === "loop") {
      if (typeof s.over !== "string") errs.push(`${at}: loop step requires 'over' (string)`);
      if (!Array.isArray(s.body)) errs.push(`${at}: loop step requires 'body' (list)`);
      else validateSteps(s.body, `${at}.body`, errs);
    }
    if (s.type === "parallel") {
      if (!Array.isArray(s.branches)) errs.push(`${at}: parallel step requires 'branches' (list of lists)`);
      else s.branches.forEach((b, bi) => validateSteps(b, `${at}.branches[${bi}]`, errs));
    }
  });
}

function checkUniqueIds(steps, scope, errors, path) {
  const seen = new Set();
  for (const s of steps) {
    if (seen.has(s.id)) errors.push({ path, message: `duplicate step id "${s.id}" in scope ${scope}` });
    seen.add(s.id);
    if (s.type === "loop") checkUniqueIds(s.body, `${scope}${s.id}/body/`, errors, path);
    else if (s.type === "parallel") s.branches.forEach((b, i) => checkUniqueIds(b, `${scope}${s.id}/branch${i}/`, errors, path));
  }
}

/** Collects every step id in the tree (top-level + loop body + branches). */
function collectIds(steps, set) {
  for (const s of steps) {
    set.add(s.id);
    if (s.type === "loop" && Array.isArray(s.body)) collectIds(s.body, set);
    else if (s.type === "parallel" && Array.isArray(s.branches)) s.branches.forEach((b) => collectIds(b, set));
  }
}

/**
 * Verifies that every routing target points to an existing id.
 * Accepts the empty marker "" (loop/parallel fallthrough) as valid.
 */
function checkRoutingTargets(steps, path, errors) {
  const ids = new Set();
  collectIds(steps, ids);
  const check = (target, at, field) => {
    if (target === undefined || target === "") return; // "" = intentional fallthrough
    if (!ids.has(target)) errors.push({ path, message: `${at}: ${field} points to a nonexistent step "${target}"` });
  };
  const walk = (list, scope) => {
    for (const s of list) {
      const at = `${scope}${s.id}`;
      check(s.on_success, at, "on_success");
      check(s.on_failure, at, "on_failure");
      if (s.on_result && typeof s.on_result === "object") {
        for (const [k, v] of Object.entries(s.on_result)) check(v, at, `on_result.${k}`);
      }
      if (s.type === "loop" && Array.isArray(s.body)) walk(s.body, `${at}/body/`);
      else if (s.type === "parallel" && Array.isArray(s.branches)) s.branches.forEach((b, i) => walk(b, `${at}/branch${i}/`));
    }
  };
  walk(steps, "");
}

/** Looks up a step by id in the step tree. Returns null if not found. */
export function findStep(steps, id) {
  for (const s of steps) {
    if (s.id === id) return s;
    if (s.type === "loop") {
      const found = findStep(s.body, id);
      if (found) return found;
    } else if (s.type === "parallel") {
      for (const branch of s.branches) {
        const found = findStep(branch, id);
        if (found) return found;
      }
    }
  }
  return null;
}
