// Tests check-plugin-version — the manifest may lead the doctrine footers, never trail them.
// Runs the real CLI (spawnSync) and checks the contract: exit 0/1/2 + JSON on stdout.
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const VALIDATOR = join(here, "..", "validators", "check-plugin-version.js");
const tmp = mkdtempSync(join(tmpdir(), "plugin-version-"));

let pass = 0, fail = 0;
function ok(c, n) { if (c) pass++; else { fail++; console.log(`FAIL ${n}`); } }

function write(rel, content) {
  const p = join(tmp, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content, "utf8");
  return p;
}

const manifest = (version) => JSON.stringify({ name: "aidakit", version }, null, 2) + "\n";
const doc = (footer) => `# Title\n\nbody\n\n${footer}\n`;

function run() {
  const res = spawnSync("node", [VALIDATOR, tmp], { encoding: "utf8" });
  let json = {};
  try { json = JSON.parse(res.stdout.trim().split("\n").pop()); } catch { /* leave {} */ }
  return { code: res.status, json, err: res.stderr };
}

// Scenario 1: manifest ahead of the footers → exit 0 (not every file changes per release).
write(".claude-plugin/plugin.json", manifest("0.5.0"));
write("GOVERNANCE.md", doc("<!-- aidakit v0.3 — doctrine -->"));
let r = run();
ok(r.code === 0, "manifest ahead of the footers → exit 0");
ok(r.json.ok === true && r.json.highest === "0.3", "reports the highest footer found");

// Scenario 2: manifest exactly at the highest footer → exit 0.
write(".claude-plugin/plugin.json", manifest("0.3.0"));
r = run();
ok(r.code === 0, "manifest equal to the highest footer → exit 0");

// Scenario 3: THE REGRESSION — a footer declares more than the manifest (the 0.2.1 vs v0.4 drift).
// GOVERNANCE.md (v0.3) goes away so the only footer ahead is the one under test.
rmSync(join(tmp, "GOVERNANCE.md"), { force: true });
write(".claude-plugin/plugin.json", manifest("0.2.1"));
write("docs/OVERVIEW.md", doc("<!-- aidakit v0.4 — register mode -->"));
r = run();
ok(r.code === 1, "footer ahead of the manifest → exit 1");
ok(r.json.behind.length === 1 && r.json.behind[0].file === "docs/OVERVIEW.md", "names the file that is ahead");
ok(r.json.highest === "0.4" && r.json.manifest === "0.2.1", "reports both numbers so the bump target is obvious");
ok(/already at the latest/.test(r.err), "explains WHY it matters (silent no-op on update)");

// Scenario 4: a file exempts itself → stops counting.
write("docs/OVERVIEW.md", doc("<!-- check-plugin-version: ignore -->\n<!-- aidakit v0.4 -->"));
r = run();
ok(r.code === 0, "ignore marker exempts the file → exit 0");

// Scenario 5: nested repo copies (git worktrees under .claude/) are NOT scanned —
// they carry their own footers and their own manifest.
write(".claude/worktrees/wip/docs/OVERVIEW.md", doc("<!-- aidakit v9.9 — another tree -->"));
r = run();
ok(r.code === 0, "footers inside .claude/worktrees are ignored");

// Scenario 6: no footer anywhere → nothing to compare against, exit 0.
rmSync(join(tmp, "docs"), { recursive: true, force: true });
r = run();
ok(r.code === 0 && r.json.highest === null, "no footers → exit 0 with highest null");

// Scenario 7: manifest without a usable version → finding, not usage error.
write(".claude-plugin/plugin.json", JSON.stringify({ name: "aidakit" }) + "\n");
r = run();
ok(r.code === 1, "manifest with no version → exit 1");

// Scenario 8: no manifest at all → usage error (exit 2), distinct from a finding.
rmSync(join(tmp, ".claude-plugin"), { recursive: true, force: true });
r = run();
ok(r.code === 2, "missing manifest → exit 2 (usage)");

console.log(`\n${pass} passed, ${fail} failed`);
rmSync(tmp, { recursive: true, force: true });
process.exit(fail ? 1 : 0);
