// governance/engine/change-id.js — strict change_id validator, the single
// source of truth shared by every FS-write sink keyed on a change_id
// (governance/context-pack/build.js's packPathFor, governance/engine/steps/
// invoke.js's packSizeFor, governance/telemetry/append.js's telemetryPathFor).
//
// SECURITY (round-1 bench, Security veto #2): the generic
// RESUME_OUTPUT_VALUE_RE (governance/engine/resume-output.js) permits `.`,
// `/` and a leading `/` because it also has to validate branch names, paths
// and URLs for OTHER structured outputs on OTHER steps. change_id specifically
// must never carry a path segment — resuming with `change_id=/tmp/pwned` or
// `change_id=../../../../tmp/pwned` would otherwise let path.resolve() treat
// it as an absolute override or a climb past the project root at every one of
// the three FS-write sinks above (writeFileSync/appendFileSync/mkdirSync at
// an attacker-chosen location). This module is the stricter shape: one
// lowercase kebab-case segment — no `/`, no `.`, no uppercase, no underscore.

const CHANGE_ID_RE = /^[a-z0-9][a-z0-9-]*$/;

/** @param {unknown} id @returns {boolean} */
export function isValidChangeId(id) {
  return typeof id === "string" && CHANGE_ID_RE.test(id);
}

/**
 * Throws `Error("invalid change_id: <id>")` unless `id` has the strict
 * change_id shape. Call this BEFORE any resolve()/join() that incorporates
 * the value — every FS-write sink keyed on change_id guards fail-closed at
 * its own entry point; this is defense in depth, not a substitute for
 * validating at the earliest boundary (the `select` step's structured
 * output).
 * @param {unknown} id
 */
export function assertValidChangeId(id) {
  if (!isValidChangeId(id)) throw new Error(`invalid change_id: ${id}`);
}

export { CHANGE_ID_RE };
