// governance/engine/project-root.js — shared "climb to .aidakit/" root finder.
//
// Generic filesystem mechanic, not domain logic: several independent callers
// need to resolve a target project's root from an arbitrary starting
// directory by climbing until a `.aidakit/` marker turns up. This is the
// SINGLE OWNER of that climb (round-3 fix, architecture finding) — before
// this, governance/validators/check-doc-manifest.js and governance/pr/
// pr-config.js each reimplemented the identical climb independently.
//
// Distinct from projectRoot() in ./persistence.js: that one only honors
// AIDAKIT_PROJECT_ROOT or falls back to process.cwd() — it does NOT climb.
// This one climbs; a caller that also wants the env-var override composes it
// on top (see governance/pr/pr-config.js's resolveRoot).

import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

const MAX_CLIMB = 20;

/**
 * Climbs from `startDir` until a `.aidakit/` marker directory is found.
 * Returns the resolved `startDir` itself (never `process.cwd()`) if no
 * marker turns up within MAX_CLIMB levels — a missing marker is not an error
 * here, just "use what we were given". Never throws.
 * @param {string} startDir
 * @returns {string}
 */
export function findProjectRoot(startDir) {
  const base = resolve(startDir || process.cwd());
  let dir = base;
  for (let i = 0; i < MAX_CLIMB; i++) {
    if (existsSync(resolve(dir, ".aidakit"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return base;
}

/**
 * The single owner of the "explicit override → AIDAKIT_PROJECT_ROOT →
 * climb from startDir" composition (round-1 bench fix, quality-important
 * finding): this exact three-step resolution was independently reimplemented
 * at 5 call sites (governance/context-pack/build.js, governance/validators/
 * check-context-pack-freshness.js inline, governance/telemetry/append.js,
 * governance/telemetry/rollup.js, governance/engine/steps/invoke.js) plus
 * governance/pr/pr-config.js's own pre-existing copy — the SAME anti-pattern
 * this file's header comment already documents as previously fixed once.
 * This is now the single owner; every caller above imports and uses this
 * function instead of reimplementing the composition.
 * @param {string} [explicitRoot] wins over everything else when provided
 * @param {string} [startDir] passed to findProjectRoot when neither the
 *   explicit override nor AIDAKIT_PROJECT_ROOT apply; defaults to
 *   process.cwd() (findProjectRoot's own default)
 * @returns {string}
 */
export function resolveProjectRoot(explicitRoot, startDir) {
  if (explicitRoot) return resolve(explicitRoot);
  if (process.env.AIDAKIT_PROJECT_ROOT) return resolve(process.env.AIDAKIT_PROJECT_ROOT);
  return findProjectRoot(startDir);
}
