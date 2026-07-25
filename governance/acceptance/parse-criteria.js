// governance/acceptance/parse-criteria.js — shared parser for acceptance criteria.
// Normalizes EITHER source into the same [{ id, criterion, source }] shape the
// aidakit:acceptance-planner agent consumes:
//
//   - `.aidakit/tasks/<change-id>/brainstorm.json`'s `acceptance_criteria[]` (full flow).
//     Accepts BOTH the legacy shape (array of plain-prose strings) and the new
//     canonical shape (array of `{ id, criterion }`) — see design.md §Brainstorm
//     output schema formalization.
//   - `docs/features/<change-id>/proposal.md`'s `## Acceptance criteria` section
//     (fast flow, no brainstorm step). A Markdown bullet list of either
//     `- \`criterion-id\` — prose` or plain `- prose`.
//
// Precedence: brainstorm.json first; proposal.md only when brainstorm.json is
// absent or its acceptance_criteria list is empty/missing. Pure Node, zero-dep.

import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const EXPLICIT_BULLET_RE = /^-\s+`([a-z0-9-]+)`\s+—\s+(.+)$/;
const PLAIN_BULLET_RE = /^-\s+(.+)$/;

/** kebab-case slug of the first `words` words of `text`. */
function slugify(text, words = 6) {
  return text
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, words)
    .join(" ")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

/** Returns a slug unique within `seen`, appending -2, -3, ... on collision.
 * Intentional collision safety: if two items declare the SAME explicit id
 * verbatim, the second one is silently rewritten (e.g. "c1" -> "c1-2") rather
 * than rejected — the manifest schema requires unique criterion_ids and a
 * silent rewrite is cheaper than a hard failure for what is almost always an
 * authoring slip, not a meaningful collision. */
function dedupeSlug(base, seen) {
  let candidate = base;
  let n = 2;
  while (seen.has(candidate)) {
    candidate = `${base}-${n}`;
    n++;
  }
  seen.add(candidate);
  return candidate;
}

/** Reads .aidakit/tasks/<change-id>/brainstorm.json, if present and non-empty. */
function fromBrainstorm(brainstormPath) {
  let raw;
  try {
    raw = JSON.parse(readFileSync(brainstormPath, "utf8"));
  } catch {
    return null;
  }
  if (raw === null || typeof raw !== "object") return null;
  const list = raw.acceptance_criteria;
  if (!Array.isArray(list) || list.length === 0) return null;

  const seen = new Set();
  const criteria = list.map((item, index) => {
    // Blank/whitespace-only/punctuation-only prose strips to an empty slug —
    // fall back to a stable positional id (`criterion-<index>`) rather than
    // emitting "" or a dash-only id ("-2", "-3") from dedupeSlug's collision
    // suffix on an empty base.
    if (typeof item === "string") {
      const base = slugify(item) || `criterion-${index}`;
      return { id: dedupeSlug(base, seen), criterion: item, source: "brainstorm" };
    }
    const base = item.id || slugify(item.criterion) || `criterion-${index}`;
    return { id: dedupeSlug(base, seen), criterion: item.criterion, source: "brainstorm" };
  });
  return { criteria };
}

/** Reads docs/features/<change-id>/proposal.md's `## Acceptance criteria` section. */
function fromProposal(proposalPath) {
  if (!existsSync(proposalPath)) return null;
  const lines = readFileSync(proposalPath, "utf8").split(/\r?\n/);
  const headingIdx = lines.findIndex((l) => /^#+\s*Acceptance criteria\s*$/i.test(l.trim()));
  if (headingIdx === -1) return null;

  const seen = new Set();
  const criteria = [];
  let bulletIndex = 0;
  for (let i = headingIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^#+\s/.test(line)) break; // next section — stop
    const explicit = line.match(EXPLICIT_BULLET_RE);
    if (explicit) {
      criteria.push({ id: dedupeSlug(explicit[1], seen), criterion: explicit[2].trim(), source: "plan" });
      bulletIndex++;
      continue;
    }
    const plain = line.match(PLAIN_BULLET_RE);
    if (plain) {
      const criterion = plain[1].trim();
      // Same empty-slug fallback as fromBrainstorm() above — blank/punctuation-only
      // bullet prose falls back to a positional id instead of an empty/dash-only slug.
      const base = slugify(criterion) || `criterion-${bulletIndex}`;
      criteria.push({ id: dedupeSlug(base, seen), criterion, source: "plan" });
      bulletIndex++;
    }
  }
  if (criteria.length === 0) return null;
  return { criteria };
}

/**
 * @param {{ change_id: string, root: string }} args
 * @returns {{ criteria: Array<{id:string, criterion:string, source:"brainstorm"|"plan"}>, source_path: string|null }}
 */
export function parseCriteria({ change_id, root }) {
  const brainstormPath = join(root, ".aidakit", "tasks", change_id, "brainstorm.json");
  if (existsSync(brainstormPath)) {
    const result = fromBrainstorm(brainstormPath);
    if (result) return { ...result, source_path: relative(root, brainstormPath) };
  }

  const proposalPath = join(root, "docs", "features", change_id, "proposal.md");
  const result = fromProposal(proposalPath);
  if (result) return { ...result, source_path: relative(root, proposalPath) };

  return { criteria: [], source_path: null };
}
