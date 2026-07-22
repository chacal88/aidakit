#!/usr/bin/env node
// derive-roadmap-status — reads the declared roadmap (docs/roadmap/epics/EPIC-*.md)
// and DERIVES each item's status from the disk. The roadmap never lies: no status
// is hand-written; it comes from reality (in-flight artifacts, PR/branch, archive).
// Pure Node, zero-dep. Validator contract:
//   exit 0 = derived cleanly · exit 1 = declared change-id nowhere on disk (a gap) · exit 2 = usage
//   stdout = JSON { validator, ok, epics[...], orphans[] } · stderr = the Now/Next/Later view
//
// It uses git ONLY as a heuristic for "has an open PR / branch" and degrades
// gracefully to disk-only (features/ vs archive/) when git is unavailable — a
// change with no git signal simply never resolves to in-review, never an error.
//
// Usage:
//   node derive-roadmap-status.js [--root <dir>] [--json] [--strict]
//   --strict makes a declared change-id that exists NOWHERE on disk fail (exit 1).
//
// `--change <id>` (add-debit's register-mode leash): short-circuits BEFORE any
// git/gh spawn — declared-ness is pure epic parsing, no status needed. Prints
//   { validator, ok, change: { id, declared, epic, feature } }
// exit 0 declared / 1 not declared / 2 missing value. This is what the fast
// flow's `check_registered` step calls to refuse parking an id the roadmap
// does not declare (and structurally rejects a raw free-form sentence, which
// never matches a declared kebab-case change-id).

import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { deriveRoadmap, collectEpics, parseEpic, STATUSES, findDeclaredChange } from "../roadmap/roadmap.js";

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

function main() {
  const argv = process.argv.slice(2);
  const jsonOnly = argv.includes("--json");
  const strict = argv.includes("--strict");
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
  const { epics } = deriveRoadmap({ root, prChangeIds, branchChangeIds });

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

  // Human view on stderr: Now (in-progress/in-review) / Next (planned) / Later (backlog) / Done.
  writeView(epics);

  if (strict && orphans.length) process.exit(1);
  process.exit(0);
}

function writeView(epics) {
  const w = (s) => process.stderr.write(s);
  if (!epics.length) { w("# roadmap\n\nNo epics declared in docs/roadmap/epics/.\n"); return; }
  w("# roadmap (derived from disk)\n\n");
  for (const e of epics) {
    w(`## ${e.title}  —  **${e.status}**\n`);
    for (const f of e.features) {
      w(`- ${f.name} — **${f.status}**\n`);
      for (const c of f.changes) w(`  - \`${c.id}\` → ${c.status}\n`);
    }
    w("\n");
  }
}

main();
