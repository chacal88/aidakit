// Tests check-runtime-bump — locks the range leash: runtime changed since the
// base ⇒ plugin.json must have risen in the same range (ADR-016, the
// 2026-07-25 stale-plugin-cache incident). Runs the real CLI (spawnSync)
// against throwaway git repos and checks the contract: exit 0/1/2 + JSON.
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const VALIDATOR = join(here, "..", "validators", "check-runtime-bump.js");

let pass = 0, fail = 0;
function ok(c, n) { if (c) pass++; else { fail++; console.log(`FAIL ${n}`); } }

// The validator resolves the base via resolveBaseRef (AIDAKIT_BASE_REF →
// origin/HEAD → local main/master); the throwaway repos have no remote, so the
// local `main` fallback is the path under test. Env is stripped of AIDAKIT_*
// so the host session cannot leak an override into the repos built here.
const cleanEnv = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("AIDAKIT_")));

function sh(cwd, cmd, args) {
  const res = spawnSync(cmd, args, { cwd, encoding: "utf8", env: cleanEnv });
  if (res.status !== 0) throw new Error(`${cmd} ${args.join(" ")} failed in ${cwd}: ${res.stderr}`);
  return res.stdout;
}
const git = (cwd, ...args) => sh(cwd, "git", args);

function write(repo, rel, content) {
  const p = join(repo, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content, "utf8");
}

const manifest = (v) => JSON.stringify({ name: "aidakit", version: v }) + "\n";

/** Fresh repo: `main` holds the initial commit, `work` is checked out. */
function makeRepo(files) {
  const repo = mkdtempSync(join(tmpdir(), "runtime-bump-"));
  git(repo, "init", "-q", "-b", "main");
  git(repo, "config", "user.email", "t@t");
  git(repo, "config", "user.name", "t");
  for (const [rel, content] of Object.entries(files)) write(repo, rel, content);
  git(repo, "add", "-A");
  git(repo, "commit", "-q", "-m", "base");
  git(repo, "checkout", "-q", "-b", "work");
  return repo;
}

const BASE_FILES = {
  ".claude-plugin/plugin.json": manifest("0.1.0"),
  "governance/engine/e.js": "export const x = 1;\n",
  "governance/__tests__/t.mjs": "// test\n",
  "governance/README.md": "# doc\n",
  "hooks/pre.js": "// hook\n",
  "docs/x.md": "# outside runtime\n",
};

function run(repo, ...extra) {
  const res = spawnSync("node", [VALIDATOR, repo, ...extra], { encoding: "utf8", env: cleanEnv });
  let json = {};
  try { json = JSON.parse(res.stdout.trim().split("\n").pop()); } catch { /* {} */ }
  return { code: res.status, json, stderr: res.stderr };
}

// --- clean range passes ---
let repo = makeRepo(BASE_FILES);
let r = run(repo);
ok(r.code === 0 && r.json.ok && r.json.runtime.length === 0, "no change in range passes");
ok(r.json.validator === "aidakit.check-runtime-bump" && r.json.base === "main", "JSON contract: validator name + resolved base");
ok(r.json.baseVersion === "0.1.0" && r.json.headVersion === "0.1.0" && r.json.bumped === false, "JSON contract: versions read at both ends");

// --- committed runtime change without a bump fails; the bump heals it ---
write(repo, "governance/engine/e.js", "export const x = 2;\n");
git(repo, "add", "-A");
git(repo, "commit", "-q", "-m", "runtime change");
r = run(repo);
ok(r.code === 1 && !r.json.ok, "committed governance/ change without a bump fails");
ok(r.json.runtime.includes("governance/engine/e.js") && r.json.bumped === false, "finding names the runtime file");
ok(/claude plugin update/.test(r.stderr), "stderr explains the installer no-op");

write(repo, ".claude-plugin/plugin.json", manifest("0.1.1"));
git(repo, "add", "-A");
git(repo, "commit", "-q", "-m", "bump");
r = run(repo);
ok(r.code === 0 && r.json.ok && r.json.bumped && r.json.headVersion === "0.1.1", "same range with a bump passes");

// --- a DECREASE is not a bump ---
write(repo, ".claude-plugin/plugin.json", manifest("0.0.9"));
git(repo, "add", "-A");
git(repo, "commit", "-q", "-m", "downgrade");
r = run(repo);
ok(r.code === 1 && r.json.bumped === false, "a version decrease does not count as a bump");
rmSync(repo, { recursive: true, force: true });

// --- exclusions: __tests__, *.md, and files outside hooks|governance ---
repo = makeRepo(BASE_FILES);
write(repo, "governance/__tests__/t.mjs", "// edited test\n");
write(repo, "governance/README.md", "# edited doc\n");
write(repo, "docs/x.md", "# edited outside\n");
write(repo, "skills/s.md", "new skill doc\n");
git(repo, "add", "-A");
git(repo, "commit", "-q", "-m", "non-runtime only");
r = run(repo);
ok(r.code === 0 && r.json.ok && r.json.runtime.length === 0 && r.json.changed === 4, "__tests__/, *.md and non-runtime paths are excluded");

// --- pre-commit coverage: unstaged edit + untracked new runtime file ---
write(repo, "hooks/pre.js", "// edited, not committed\n");
r = run(repo);
ok(r.code === 1 && r.json.runtime.includes("hooks/pre.js"), "uncommitted working-tree hook edit is caught");
git(repo, "checkout", "-q", "--", "hooks/pre.js");
write(repo, "governance/engine/new.js", "export const y = 1;\n");
r = run(repo);
ok(r.code === 1 && r.json.runtime.includes("governance/engine/new.js"), "untracked new runtime file is caught");
write(repo, ".claude-plugin/plugin.json", manifest("0.2.0"));
r = run(repo);
ok(r.code === 0 && r.json.bumped, "an uncommitted bump in the working tree already releases the leash");

// --- deleted runtime file counts as a runtime change ---
git(repo, "checkout", "-q", "--", ".");
sh(repo, "rm", [join(repo, "governance/engine/new.js")]);
git(repo, "rm", "-q", "governance/engine/e.js");
git(repo, "commit", "-q", "-m", "delete runtime");
r = run(repo);
ok(r.code === 1 && r.json.runtime.includes("governance/engine/e.js"), "deleting a runtime file requires a bump too");

// --- --base override wins over resolution ---
git(repo, "branch", "-q", "other", "main");
r = run(repo, "--base", "other");
ok(r.code === 1 && r.json.base === "other", "--base <ref> overrides the resolved base");
rmSync(repo, { recursive: true, force: true });

// --- manifest introduced inside the range = the strongest bump ---
repo = makeRepo({ "governance/engine/e.js": "export const x = 1;\n" });
write(repo, "governance/engine/e.js", "export const x = 2;\n");
write(repo, ".claude-plugin/plugin.json", manifest("0.1.0"));
git(repo, "add", "-A");
git(repo, "commit", "-q", "-m", "introduce manifest");
r = run(repo);
ok(r.code === 0 && r.json.ok && r.json.bumped && r.json.baseVersion === null, "introducing plugin.json in the range counts as bumped");
rmSync(repo, { recursive: true, force: true });

// --- usage errors: not a plugin repo, not a git tree ---
repo = makeRepo({ "governance/engine/e.js": "export const x = 1;\n" });
write(repo, "governance/engine/e.js", "export const x = 2;\n");
r = run(repo);
ok(r.code === 2, "no plugin.json at either end of the range is a usage error (target repo)");
rmSync(repo, { recursive: true, force: true });

const plain = mkdtempSync(join(tmpdir(), "runtime-bump-plain-"));
r = run(plain);
ok(r.code === 2, "a non-git directory is a usage error");
rmSync(plain, { recursive: true, force: true });

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
