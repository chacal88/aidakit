// governance/__tests__/check-evidence-stat.test.mjs
//
// Pins governance/validators/check-evidence-stat.js — the DNA gate crystallized
// out of review-usage-bench-manifest, where a pasted `git diff --stat` block in
// evidence.md went stale three separate times across review rounds (including
// once from its own re-capture, since re-capturing changes the diff).
//
// Runs the validator against synthetic change packages inside a throwaway git
// repo, so the assertions are about the real exit contract (0 pass · 1 finding ·
// 2 usage), not about a mock.

import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const VALIDATOR = join(dirname(fileURLToPath(import.meta.url)), "..", "validators", "check-evidence-stat.js");

let passed = 0;
let failed = 0;

function check(label, cond) {
  if (cond) {
    passed++;
  } else {
    failed++;
    process.stderr.write(`FAIL ${label}\n`);
  }
}

/** Runs the validator in `cwd`; returns { code, json }. */
function run(cwd, args = []) {
  try {
    const stdout = execFileSync("node", [VALIDATOR, ...args], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { code: 0, json: safeParse(stdout) };
  } catch (e) {
    return { code: e.status, json: safeParse(e.stdout ?? "") };
  }
}

function safeParse(s) {
  try {
    return JSON.parse(s.trim().split("\n").pop());
  } catch {
    return null;
  }
}

/** Builds a throwaway git repo with a committed baseline, returns its path. */
function makeRepo() {
  const dir = mkdtempSync(join(tmpdir(), "aidakit-evstat-"));
  const git = (...a) => execFileSync("git", a, { cwd: dir, stdio: "ignore" });
  git("init", "-q");
  git("config", "user.email", "t@t.t");
  git("config", "user.name", "t");
  writeFileSync(join(dir, "seed.txt"), "seed\n");
  git("add", "seed.txt");
  git("commit", "-qm", "seed");
  return dir;
}

/** Writes docs/features/<id>/evidence.md containing `body`. */
function writeEvidence(repo, id, body) {
  const dir = join(repo, "docs", "features", id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "evidence.md"), body);
}

/** The live `git diff HEAD --stat` of `repo`, as the validator would read it. */
function liveStat(repo) {
  return execFileSync("git", ["diff", "HEAD", "--stat"], { cwd: repo, encoding: "utf8" }).trimEnd();
}

const repos = [];
function repo() {
  const r = makeRepo();
  repos.push(r);
  return r;
}

// §1 — usage: no change-id is exit 2, not a silent pass.
{
  const r = repo();
  const { code } = run(r, []);
  check("§1 no argument exits 2 (usage)", code === 2);
}

// §2 — a package with no evidence.md is skipped, not failed. The gate must not
//      punish a change that legitimately has no evidence file yet.
{
  const r = repo();
  const { code, json } = run(r, ["absent-change"]);
  check("§2 missing evidence.md exits 0", code === 0);
  check("§2 missing evidence.md reports skipped", json?.skipped === "no evidence.md");
}

// §3 — evidence.md with no pasted stat block at all is a pass with blocks: 0.
//      Fenced blocks that are not stat output must not be misread as claims.
{
  const r = repo();
  writeEvidence(r, "c3", "# Evidence\n\n```\nsome unrelated output\n```\n");
  const { code, json } = run(r, ["c3"]);
  check("§3 no stat block exits 0", code === 0);
  check("§3 no stat block counts 0 blocks", json?.blocks === 0);
}

// §4 — a stat block matching the live diff passes.
{
  const r = repo();
  writeFileSync(join(r, "seed.txt"), "seed\nchanged\n");
  writeEvidence(r, "c4", "placeholder");
  const stat = liveStat(r);
  writeEvidence(r, "c4", `# Evidence\n\n\`\`\`\n${stat}\n\`\`\`\n`);
  const fresh = liveStat(r); // writing evidence.md changed the diff; re-capture
  writeEvidence(r, "c4", `# Evidence\n\n\`\`\`\n${fresh}\n\`\`\`\n`);
  const { code, json } = run(r, ["c4"]);
  check("§4 in-sync stat block exits 0", code === 0);
  check("§4 in-sync stat block reports 0 stale", json?.stale === 0);
}

// §5 — the load-bearing case: a stat block that no longer matches must fail
//      with exit 1 and the `evidence-stat-stale` rule. This is the regression
//      the gate exists for.
{
  const r = repo();
  writeFileSync(join(r, "seed.txt"), "seed\nchanged\n");
  writeEvidence(r, "c5", "# Evidence\n\n```\n 1 file changed, 99 insertions(+), 99 deletions(-)\n```\n");
  const { code, json } = run(r, ["c5"]);
  check("§5 stale stat block exits 1", code === 1);
  check("§5 stale stat block reports 1 stale", json?.stale === 1);
  check("§5 stale stat block names the rule", json?.errors?.[0]?.rule === "evidence-stat-stale");
}

// §6 — every stat block is a claim: one fresh and one stale still fails.
//      A package must not launder a stale block by pasting a fresh one beside it.
{
  const r = repo();
  writeFileSync(join(r, "seed.txt"), "seed\nchanged\n");
  writeEvidence(r, "c6", "placeholder");
  const stat = liveStat(r);
  const body = `# Evidence\n\n\`\`\`\n${stat}\n\`\`\`\n\n\`\`\`\n 7 files changed, 1 insertion(+)\n\`\`\`\n`;
  writeEvidence(r, "c6", body);
  const { code, json } = run(r, ["c6"]);
  check("§6 mixed fresh+stale exits 1", code === 1);
  check("§6 mixed fresh+stale counts 2 blocks", json?.blocks === 2);
}

for (const r of repos) rmSync(r, { recursive: true, force: true });

process.stdout.write(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
