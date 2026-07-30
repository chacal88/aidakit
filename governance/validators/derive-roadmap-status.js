#!/usr/bin/env node
// derive-roadmap-status — reads the declared roadmap (docs/roadmap/epics/EPIC-*.md)
// and DERIVES each item's status from the disk. The roadmap never lies: no status
// is hand-written; it comes from reality (in-flight artifacts, PR/branch, archive).
// Pure Node, zero-dep. Validator contract:
//   exit 0 = derived cleanly · exit 1 = declared change-id nowhere on disk (a gap) · exit 2 = usage
//   stdout = JSON { validator, ok, epics[...], orphans[] } · stderr = the Now/Next/Later view
//
// The Now/Next/Later view is rendered by governance/roadmap/render-view.js — the
// single owner of that format, shared with `--write` (which writes the same bytes
// into docs/roadmap/ROADMAP.md). There is no second copy of the format anywhere:
// what you read on stderr is what the committed file gets.
//
// It derives from the SHARED git state (ADR-007 amends ADR-002): the artifact
// dirs COMMITTED on any branch (docs/features/<id>/, docs/archive/<date>-<id>/),
// plus git/gh heuristics for open PR / branch. Worktrees share one .git, so this
// answer is single-valued no matter which working tree you run it in — a change
// planned in another worktree is visible here once committed. It degrades
// gracefully to disk-only (the local working tree) when git is unavailable — a
// change with no git signal simply falls back to the local tree, never an error.
//
// Usage:
//   node derive-roadmap-status.js [--root <dir>] [--json] [--strict] [--write]
//   --strict makes a declared change-id that exists NOWHERE on disk fail (exit 1).
//   --write  regenerates <root>/docs/roadmap/ROADMAP.md from this run's derivation
//            (the `regen` mode of skills/roadmap/SKILL.md). Opt-in: without it this
//            stays a read-only validator, which is how the flows call it.
//
// `--change <id>` (add-debit's register-mode leash): short-circuits BEFORE any
// git/gh spawn — declared-ness is pure epic parsing, no status needed. Prints
//   { validator, ok, change: { id, declared, epic, feature } }
// exit 0 declared / 1 not declared / 2 missing value. This is what the fast
// flow's `check_registered` step calls to refuse parking an id the roadmap
// does not declare (and structurally rejects a raw free-form sentence, which
// never matches a declared kebab-case change-id).

import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { deriveRoadmap, collectEpics, parseEpic, STATUSES, findDeclaredChange } from "../roadmap/roadmap.js";
import { renderRoadmapView } from "../roadmap/render-view.js";

// Where the generated view lives (docs/roadmap/ROADMAP.md, per DOCS.md §2).
const VIEW_REL = join("docs", "roadmap", "ROADMAP.md");

/** Best-effort: change-ids that have a local branch (heuristic: branch name ends with the id). */
function gitBranchChangeIds(root) {
  const res = spawnSync("git", ["-C", root, "branch", "--format=%(refname:short)"], { encoding: "utf8" });
  if (res.status !== 0 || !res.stdout) return new Set();
  const names = res.stdout.split("\n").map((s) => s.trim()).filter(Boolean);
  // A branch "feat/<id>" or "<id>" signals work; we store the trailing segment.
  return new Set(names.map((n) => n.split("/").pop()));
}

/** Best-effort via gh (if present): open-PR head branches → change-ids. Silent if gh absent. */
function ghOpenPrChangeIds(root) {
  const res = spawnSync("gh", ["pr", "list", "--state", "open", "--json", "headRefName", "-q", ".[].headRefName"], {
    cwd: root, encoding: "utf8",
  });
  if (res.status !== 0 || !res.stdout) return new Set();
  return new Set(res.stdout.split("\n").map((s) => s.trim()).filter(Boolean).map((n) => n.split("/").pop()));
}

/**
 * Reads the SHARED git state — the artifact dirs committed on ANY branch (local or
 * remote-tracking). This is what makes the derived status single-valued across
 * worktrees (ADR-007): worktrees share one .git, so a docs/features/<id>/ committed
 * on any branch is visible from EVERY working tree — not only the one that authored
 * it. The cost is O(branches), not O(worktrees): one `git ls-tree` per ref, each a
 * few ms; we never walk a worktree's filesystem. Degrades to empty sets (disk-only)
 * when git is absent or errors — never throws.
 * @returns {{gitFeatureIds:Set<string>, gitArchiveDirs:Set<string>}}
 */
function gitCommittedDirs(root) {
  const gitFeatureIds = new Set();
  const gitArchiveDirs = new Set();
  const refsRes = spawnSync(
    "git",
    ["-C", root, "for-each-ref", "--format=%(refname:short)", "refs/heads", "refs/remotes"],
    { encoding: "utf8" },
  );
  if (refsRes.status !== 0 || !refsRes.stdout) return { gitFeatureIds, gitArchiveDirs };
  const refs = refsRes.stdout
    .split("\n").map((s) => s.trim())
    .filter((r) => r && !r.endsWith("/HEAD")); // skip the symbolic origin/HEAD
  for (const ref of refs) {
    // One call lists the change-id dirs committed under both paths on this ref;
    // a path absent on the ref just yields no lines (exit 0, no error).
    const res = spawnSync(
      "git",
      ["-C", root, "ls-tree", "-d", "--name-only", ref, "docs/features/", "docs/archive/"],
      { encoding: "utf8" },
    );
    if (res.status !== 0 || !res.stdout) continue;
    for (const line of res.stdout.split("\n").map((s) => s.trim()).filter(Boolean)) {
      const base = line.split("/").pop();
      if (line.startsWith("docs/features/")) gitFeatureIds.add(base);
      else if (line.startsWith("docs/archive/")) gitArchiveDirs.add(base);
    }
  }
  return { gitFeatureIds, gitArchiveDirs };
}

function main() {
  const argv = process.argv.slice(2);
  const jsonOnly = argv.includes("--json");
  const strict = argv.includes("--strict");
  const write = argv.includes("--write");
  const rootIdx = argv.indexOf("--root");
  const root = resolve(rootIdx >= 0 ? argv[rootIdx + 1] : process.env.AIDAKIT_PROJECT_ROOT || process.cwd());

  const changeIdx = argv.indexOf("--change");
  if (changeIdx >= 0) {
    const changeId = argv[changeIdx + 1];
    if (!changeId || changeId.startsWith("--")) {
      process.stderr.write("derive-roadmap-status — error: --change requires a value\n");
      process.exit(2);
    }
    const declared = findDeclaredChange(changeId, root);
    const result = {
      validator: "aidakit.derive-roadmap-status",
      ok: !!declared,
      change: {
        id: changeId,
        declared: !!declared,
        epic: declared ? declared.epic : null,
        feature: declared ? declared.feature : null,
      },
    };
    process.stdout.write(JSON.stringify(result) + "\n");
    process.exit(declared ? 0 : 1);
  }

  const branchChangeIds = gitBranchChangeIds(root);
  const prChangeIds = ghOpenPrChangeIds(root);
  const { gitFeatureIds, gitArchiveDirs } = gitCommittedDirs(root);
  const { epics } = deriveRoadmap({ root, prChangeIds, branchChangeIds, gitFeatureIds, gitArchiveDirs });

  // Orphans: declared change-ids that resolve to "backlog" with no artifact AND no git
  // signal — i.e. pure intent. In --strict, that's a gap worth flagging.
  const orphans = [];
  for (const e of epics) {
    for (const f of e.features) {
      for (const c of f.changes) {
        if (c.status === "backlog") orphans.push({ epic: e.id, feature: f.name, change: c.id });
      }
    }
  }

  const ok = !strict || orphans.length === 0;
  const result = {
    validator: "aidakit.derive-roadmap-status",
    ok,
    epics_count: epics.length,
    epics,
    orphans,
  };
  process.stdout.write(JSON.stringify(result) + "\n");

  // No declared roadmap: nothing to render, and `--write` deliberately writes
  // NOTHING rather than clobbering the target with an empty shell. No epics also
  // means no orphans, so `--strict` has nothing to fail on here.
  if (!epics.length) {
    process.stderr.write("# roadmap\n\nNo epics declared in docs/roadmap/epics/.\n");
    process.exit(0);
  }

  // The Now/Next/Later view — the SAME bytes on stderr (human view) and in the
  // file (`--write`), because both come from render-view.js. No prose format.
  const view = renderRoadmapView(epics);
  if (write) {
    const target = join(root, VIEW_REL);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, view, "utf8");
    const items = epics.reduce((n, e) => n + e.features.reduce((m, f) => m + f.changes.length, 0), 0);
    process.stderr.write(`# derive-roadmap-status\n\nWrote ${VIEW_REL} — ${epics.length} epic(s), ${items} item(s).\n`);
  } else {
    process.stderr.write(view);
  }

  if (strict && orphans.length) process.exit(1);
  process.exit(0);
}

main();
