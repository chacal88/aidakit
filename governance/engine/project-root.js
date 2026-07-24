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
