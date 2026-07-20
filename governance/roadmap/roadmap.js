// aidakit roadmap — parse the declared intent (epics → features → changes) and
// DERIVE each item's status from the disk. No hand-written status: the roadmap
// never lies, same discipline as the doc leash (the truth is the disk).
//
// The declared file (an epic) says only WHAT we want and HOW it groups — the
// status comes from reality: is the change-id an in-flight artifact, does it have
// a PR, is it archived? Epics/features aggregate the status of their changes.
//
// Pure Node, zero-dep (like the validators). No new state; a pure read + derive.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve, basename } from "node:path";
import { projectRoot } from "../engine/persistence.js";

// Where the declared roadmap lives.
export const ROADMAP_DIR = "docs/roadmap";
export const EPICS_DIR = "docs/roadmap/epics";

// The derived status vocabulary. Ordered weakest → strongest for aggregation.
export const STATUSES = ["backlog", "planned", "in-progress", "in-review", "done", "blocked"];

// An epic file is EPIC-<slug>.md (uppercase prefix, key visible in the name).
const EPIC_NAME = /^EPIC-[a-z0-9-]+\.md$/;

// A feature line inside an epic declares its changes by change-id. Format (markdown):
//   - **Feature:** <name> — changes: <id1>, <id2>
// The change-ids are the single key (§2.7): change-id = branch = PR suffix = archive dir.
const FEATURE_RE = /^\s*[-*]\s*\*\*Feature:\*\*\s*(.+?)\s*(?:—|--|-)\s*changes:\s*(.+?)\s*$/i;

/**
 * Derives the status of ONE change-id from the disk (and optional git signal).
 * The order of checks is strongest-evidence-first:
 *   archived                          → done
 *   has an open PR / branch (gitInfo) → in-review
 *   in-flight artifact dir exists     → in-progress
 *   declared but no artifact anywhere → backlog
 * @param {string} changeId
 * @param {{root:string, prChangeIds?:Set<string>, branchChangeIds?:Set<string>}} ctx
 * @returns {"done"|"in-review"|"in-progress"|"backlog"}
 */
export function deriveChangeStatus(changeId, ctx) {
  const { root, prChangeIds, branchChangeIds } = ctx;
  // Archived: docs/archive/YYYY-MM-DD-<change-id>/ OR openspec/changes/archive/<change-id>/.
  if (isArchived(root, changeId)) return "done";
  // Open PR for this change-id → in-review (a merged PR would already show as archived).
  if (prChangeIds && prChangeIds.has(changeId)) return "in-review";
  // In-flight artifact dir: docs/features/<id>/ or openspec/changes/<id>/.
  if (hasInFlightArtifacts(root, changeId)) return "in-progress";
  // A branch exists but no artifacts yet → planned (work started, not documented).
  if (branchChangeIds && branchChangeIds.has(changeId)) return "planned";
  return "backlog";
}

function hasInFlightArtifacts(root, changeId) {
  return existsSync(join(root, "docs", "features", changeId)) ||
    existsSync(join(root, "openspec", "changes", changeId));
}

function isArchived(root, changeId) {
  // docs/archive/<YYYY-MM-DD>-<change-id>/  (the archive dir carries the date + id)
  const docsArchive = join(root, "docs", "archive");
  if (existsSync(docsArchive)) {
    for (const name of safeReaddir(docsArchive)) {
      if (name.endsWith(`-${changeId}`) || name === changeId) return true;
    }
  }
  // openspec/changes/archive/<change-id>/
  const openspecArchive = join(root, "openspec", "changes", "archive");
  if (existsSync(openspecArchive)) {
    for (const name of safeReaddir(openspecArchive)) {
      if (name === changeId || name.endsWith(`-${changeId}`)) return true;
    }
  }
  return false;
}

function safeReaddir(p) {
  try { return readdirSync(p); } catch { return []; }
}

/**
 * Aggregates a set of change statuses into the parent (feature/epic) status.
 * Rules (in order): no changes → backlog; any blocked → blocked; all done → done;
 * any in-review/in-progress → in-progress; else the strongest present.
 * @param {string[]} childStatuses
 * @returns {string}
 */
export function aggregateStatus(childStatuses) {
  if (!childStatuses.length) return "backlog";
  if (childStatuses.includes("blocked")) return "blocked";
  if (childStatuses.every((s) => s === "done")) return "done";
  if (childStatuses.some((s) => s === "in-review" || s === "in-progress")) return "in-progress";
  if (childStatuses.some((s) => s === "planned")) return "planned";
  return "backlog";
}

/** Parses one EPIC-*.md file into { id, title, features:[{name, changeIds:[]}] }. */
export function parseEpic(file) {
  const content = readFileSync(file, "utf8");
  const id = basename(file).replace(/\.md$/, "");
  const titleLine = content.split(/\r?\n/).find((l) => /^#\s+/.test(l)) || "";
  const title = titleLine.replace(/^#\s+/, "").trim() || id;
  const features = [];
  for (const line of content.split(/\r?\n/)) {
    const m = FEATURE_RE.exec(line);
    if (!m) continue;
    const name = m[1].trim();
    const changeIds = m[2].split(",").map((s) => s.trim()).filter(Boolean);
    features.push({ name, changeIds });
  }
  return { id, title, file, features };
}

/** Collects all epic files under docs/roadmap/epics/. */
export function collectEpics(root = projectRoot()) {
  const dir = join(root, EPICS_DIR);
  if (!existsSync(dir)) return [];
  return safeReaddir(dir)
    .filter((n) => EPIC_NAME.test(n))
    .map((n) => join(dir, n));
}

/**
 * Builds the full derived roadmap: every epic with its features, each feature with
 * its changes and derived statuses, aggregated up to the epic. Pure read.
 * @param {{root?:string, prChangeIds?:Set<string>, branchChangeIds?:Set<string>}} [opts]
 * @returns {{epics:Array, generatedFromDisk:boolean}}
 */
export function deriveRoadmap(opts = {}) {
  const root = opts.root || projectRoot();
  const ctx = { root, prChangeIds: opts.prChangeIds, branchChangeIds: opts.branchChangeIds };
  const epics = collectEpics(root).map((file) => {
    const epic = parseEpic(file);
    const features = epic.features.map((f) => {
      const changes = f.changeIds.map((id) => ({ id, status: deriveChangeStatus(id, ctx) }));
      return { name: f.name, changes, status: aggregateStatus(changes.map((c) => c.status)) };
    });
    return { id: epic.id, title: epic.title, file: epic.file, features, status: aggregateStatus(features.map((f) => f.status)) };
  });
  return { epics, generatedFromDisk: true };
}
