// @dna-origin-change: review-usage-bench-manifest
// @dna-origin-premise: ADR-010
// @dna-type: regression-gate
// @dna-created-at: 2026-07-25
// @dna-trigger: deriveCandidates(threshold:3) → retry-cause/bench-veto ×4 in phase implement; the recurring sub-class across rounds 4-6 was a stale pasted `git diff --stat` in evidence.md, flagged three separate times by the ADR bench role
// Regression gate — evidence.md's pasted `git diff --stat` block must match the live diff.
//
// Premise: an evidence file that pastes a command's output is a snapshot of a
// moving substrate. Every subsequent edit to the change invalidates it, and the
// staleness is invisible to every validator in the kit — it is caught, if at all,
// by a human reviewer re-running the command by hand. In the originating flow that
// cost four review-bench rounds: the block went stale, was re-captured, went stale
// again from the re-capture itself, and was flagged three separate times.
//
// This gate makes the check mechanical. Run it against a change package before
// the ship step.
//
// Exit contract (same as governance/validators/): 0 pass · 1 finding · 2 usage.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const changeId = process.argv[2];
if (!changeId) {
  process.stderr.write("usage: check-evidence-stat.js <change-id>\n");
  process.exit(2);
}

const evidencePath = join("docs", "features", changeId, "evidence.md");
if (!existsSync(evidencePath)) {
  process.stdout.write(JSON.stringify({ gate: "evidence-stat-freshness", ok: true, skipped: "no evidence.md" }) + "\n");
  process.exit(0);
}

const evidence = readFileSync(evidencePath, "utf8");

// A pasted stat block is a fenced region whose last line matches git's summary
// line ("N files changed, ..."). Find every such block; each one is a claim.
const blocks = [...evidence.matchAll(/```[a-z]*\n([\s\S]*?)```/g)]
  .map((m) => m[1].trimEnd())
  .filter((b) => /^\s*\d+ files? changed(,|$)/m.test(b));

if (blocks.length === 0) {
  process.stdout.write(JSON.stringify({ gate: "evidence-stat-freshness", ok: true, blocks: 0 }) + "\n");
  process.exit(0);
}

const live = execFileSync("git", ["diff", "HEAD", "--stat"], { encoding: "utf8" }).trimEnd();
const norm = (s) => s.split("\n").map((l) => l.trimEnd()).filter(Boolean).join("\n");

const stale = blocks.filter((b) => norm(b) !== norm(live));

const result = {
  gate: "evidence-stat-freshness",
  ok: stale.length === 0,
  change_id: changeId,
  blocks: blocks.length,
  stale: stale.length,
  errors: stale.map(() => ({
    rule: "evidence-stat-stale",
    file: evidencePath,
    message:
      "a pasted `git diff --stat` block no longer matches the live diff — re-capture it (note that re-capturing changes the diff, so iterate to a fixpoint)",
  })),
};

process.stdout.write(JSON.stringify(result) + "\n");
if (!result.ok) {
  process.stderr.write(
    `\n# evidence-stat-freshness\n\nFAIL — ${stale.length}/${blocks.length} pasted stat block(s) in ${evidencePath} are stale.\nRe-capture from \`git diff HEAD --stat\` and iterate until stable.\n`,
  );
  process.exit(1);
}
process.stderr.write(`\n# evidence-stat-freshness\n\nOK — ${blocks.length} pasted stat block(s) match the live diff.\n`);
process.exit(0);
