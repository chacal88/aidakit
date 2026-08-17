// governance/engine/change-dir.js — where a change's PLAN lives, resolved by
// repo mode. The single owner of that answer, shared by every reader of a
// change's proposal/design/tasks (governance/context-pack/build.js's
// buildPackContent, governance/acceptance/parse-criteria.js's parseCriteria).
//
// The two modes are the two supported layouts: OpenSpec repos keep a change
// under `openspec/changes/<id>/` (with its spec deltas under
// `specs/<capability>/spec.md`), kit-mode repos under `docs/features/<id>/`
// per DOCS.md. Reading only the kit-mode path in an OpenSpec repo finds
// nothing, and every consumer degrades SILENTLY rather than failing: the pack
// built empty (PR #75) and the acceptance cross-check reported
// `parsed_criteria: 0`, so 'criterion-orphan' could never fire. Both were
// reported from psim-kernel; both are the same missing branch, which is why
// the branch now lives in one module instead of two.
//
// Detection is presence-of-directory, the same signal
// governance/roadmap/roadmap.js already uses to locate an in-flight change —
// no config key, no CLI flag, nothing a repo can get out of sync with. An
// ARCHIVED change resolves to neither (OpenSpec promotes it to
// `openspec/changes/archive/<YYYY-MM-DD>-<id>/`): the leashes run while the
// change is in flight, and a post-archive read is a diagnostic, not a gate.

import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * Project-root-relative directory holding `<change-id>`'s plan.
 * @param {string} root project root (absolute)
 * @param {string} changeId
 * @returns {string} relative path — `openspec/changes/<id>` or `docs/features/<id>`
 */
export function changeDirFor(root, changeId) {
  const openspecDir = join("openspec", "changes", changeId);
  return existsSync(resolve(root, openspecDir)) ? openspecDir : join("docs", "features", changeId);
}
