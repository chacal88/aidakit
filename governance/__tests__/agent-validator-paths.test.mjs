// Tests agent-validator-paths — the session-wide AIDAKIT_GOVERNANCE contract for
// direct-invocation call sites (agents/skills/commands), the companion vector to
// `runs.js`'s child-env injection (ADR-004, broadened by ADR-012).
//
// Cases:
//   1. the fail-closed guard one-liner blocks loudly when AIDAKIT_GOVERNANCE is unset;
//   2. the same guard is a no-op (zero cost) when AIDAKIT_GOVERNANCE is set;
//   3. AC1 — the filtered grep sweep of agents/skills/commands returns zero executable hits;
//   4. hooks/hooks.json declares a SessionStart hook wired to hooks/session-start.js via
//      ${CLAUDE_PLUGIN_ROOT};
//   5. hooks/session-start.js fails loud (exit 1, stderr names the variable) when
//      CLAUDE_PLUGIN_ROOT is unset;
//   6. same, when CLAUDE_ENV_FILE is unset;
//   7. hooks/session-start.js exports AIDAKIT_GOVERNANCE byte-for-byte (quoting survives
//      an embedded space and a single quote in CLAUDE_PLUGIN_ROOT) when both are set;
//   8-9. ADR-010 → ADR-012 rename: docs/decisions/README.md and ADR-004's ## Amendments
//      back-link both point at the renamed file, never the retired ADR-010 name.
//
// The GUARD literal is never hand-typed here (round-2 fix, tester finding #5): it is
// extracted at test time from one of the 5 rewritten call-site files and every other
// file's occurrences are asserted byte-identical to it — a typo landing in only one
// file would fail this suite instead of silently shipping.
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "..", ".."); // repo root
const GOVERNANCE = join(ROOT, "governance");

let pass = 0, fail = 0;
function ok(cond, name) { if (cond) pass++; else { fail++; console.log(`FAIL ${name}`); } }

// ── Guard extraction (tester #5) ────────────────────────────────────────────
// Matches the fail-closed one-liner in either raw form (agents/skills/commands/flow-*)
// or backslash-escaped form (doc-planner.md, nested inside a quoted prose sentence).
const GUARD_RE = /: \\?"\$\{AIDAKIT_GOVERNANCE\?agent-validator-paths: AIDAKIT_GOVERNANCE not set — SessionStart hook missing \(see docs\/guides\/flows\.md §6\)\}\\?"/g;

function extractGuards(path) {
  const content = readFileSync(join(ROOT, path), "utf8");
  const matches = content.match(GUARD_RE) || [];
  return matches.map((m) => m.replace(/\\"/g, '"')); // normalize escaped quotes → literal
}

const SOURCE_FILES = [
  "agents/orchestrator.md",
  "agents/doc-planner.md",
  "skills/roadmap/SKILL.md",
  "commands/flow-fast.md",
  "commands/flow-full.md",
  "commands/flow-design.md",
];

// Extract the GUARD literal from the first source file rather than hand-typing it.
const [firstGuard] = extractGuards(SOURCE_FILES[0]);
ok(typeof firstGuard === "string" && firstGuard.length > 0, "0: GUARD literal extracted from agents/orchestrator.md");
const GUARD = firstGuard;

for (const file of SOURCE_FILES) {
  const guards = extractGuards(file);
  ok(guards.length > 0, `0: ${file} has at least one guard occurrence`);
  ok(guards.every((g) => g === GUARD), `0: ${file}'s guard occurrence(s) are byte-identical to the extracted GUARD`);
}

function runGuarded(env) {
  const cmd = `${GUARD}; node "$AIDAKIT_GOVERNANCE/validators/derive-roadmap-status.js" --root .`;
  const res = spawnSync("bash", ["-lc", cmd], { cwd: ROOT, env, encoding: "utf8" });
  return { code: res.status, stdout: res.stdout || "", stderr: res.stderr || "" };
}

// ── 1. Guard fails loud with AIDAKIT_GOVERNANCE unset ──────────────────────
{
  const env = { ...process.env };
  delete env.AIDAKIT_GOVERNANCE;
  const r = runGuarded(env);
  ok(r.code !== 0, "1: guard exits non-zero when AIDAKIT_GOVERNANCE is unset");
  ok(r.stderr.includes("AIDAKIT_GOVERNANCE not set"), "1: stderr names the unset variable");
  ok(r.stderr.includes("agent-validator-paths"), "1: stderr traces back to this change");
}

// ── 2. Guard passes silently when set ───────────────────────────────────────
{
  const env = { ...process.env, AIDAKIT_GOVERNANCE: GOVERNANCE };
  const r = runGuarded(env);
  ok(r.code === 0, "2: guard is a zero-cost no-op when AIDAKIT_GOVERNANCE is set (validator itself exits 0)");
  ok(!r.stderr.includes("AIDAKIT_GOVERNANCE not set"), "2: guard does not fire when the variable is set");
}

// ── 3. Grep discipline (AC1) — filtered sweep is empty ──────────────────────
{
  const sweep = spawnSync(
    "bash",
    ["-lc", "grep -rnE 'node +governance/(validators|cli|engine)' agents/ skills/ commands/ | grep -vE '^skills/(catalog/INDEX|review/SKILL)\\.md:'"],
    { cwd: ROOT, encoding: "utf8" }
  );
  const lines = sweep.stdout.split("\n").filter(Boolean);
  ok(lines.length === 0, `3: filtered sweep has zero executable relative-path hits (found ${lines.length}: ${lines.join(" | ")})`);
}

// ── 4. Manifest discipline — hooks.json declares SessionStart ───────────────
{
  const manifest = JSON.parse(readFileSync(join(ROOT, "hooks", "hooks.json"), "utf8"));
  const sessionStart = manifest.hooks && manifest.hooks.SessionStart;
  ok(Array.isArray(sessionStart) && sessionStart.length > 0, "4: hooks.json declares a SessionStart block");
  const commands = (sessionStart || []).flatMap((entry) => (entry.hooks || []).map((h) => h.command || ""));
  ok(commands.some((c) => c.includes("hooks/session-start.js")), "4: SessionStart references hooks/session-start.js");
  ok(commands.some((c) => c.includes("${CLAUDE_PLUGIN_ROOT}")), "4: SessionStart command uses ${CLAUDE_PLUGIN_ROOT}");
}

// ── 5. hooks/session-start.js fails loud when CLAUDE_PLUGIN_ROOT is unset ───
{
  const env = { ...process.env };
  delete env.CLAUDE_PLUGIN_ROOT;
  const res = spawnSync("node", ["hooks/session-start.js"], { cwd: ROOT, env, encoding: "utf8" });
  ok(res.status === 1, `5: exit 1 when CLAUDE_PLUGIN_ROOT is unset (got ${res.status})`);
  ok((res.stderr || "").includes("CLAUDE_PLUGIN_ROOT"), "5: stderr names CLAUDE_PLUGIN_ROOT");
}

// ── 6. hooks/session-start.js fails loud when CLAUDE_ENV_FILE is unset ──────
{
  const env = { ...process.env, CLAUDE_PLUGIN_ROOT: "/tmp" };
  delete env.CLAUDE_ENV_FILE;
  const res = spawnSync("node", ["hooks/session-start.js"], { cwd: ROOT, env, encoding: "utf8" });
  ok(res.status === 1, `6: exit 1 when CLAUDE_ENV_FILE is unset (got ${res.status})`);
  ok((res.stderr || "").includes("CLAUDE_ENV_FILE"), "6: stderr names CLAUDE_ENV_FILE");
}

// ── 7. hooks/session-start.js exports AIDAKIT_GOVERNANCE byte-for-byte ──────
// (a plugin cache path may contain a space and, in principle, a quote — the
// single-quote escaping in session-start.js must survive both intact).
{
  const pluginRoot = "/tmp/space in path'";
  const envFile = join(tmpdir(), `aidakit-agent-validator-paths-envfile-${process.pid}-${Date.now()}`);
  writeFileSync(envFile, "");
  try {
    const env = { ...process.env, CLAUDE_PLUGIN_ROOT: pluginRoot, CLAUDE_ENV_FILE: envFile };
    const res = spawnSync("node", ["hooks/session-start.js"], { cwd: ROOT, env, encoding: "utf8" });
    ok(res.status === 0, `7: exit 0 when both CLAUDE_PLUGIN_ROOT and CLAUDE_ENV_FILE are set (got ${res.status}, stderr: ${res.stderr})`);

    const sourced = spawnSync("bash", ["-lc", `source "${envFile}"; printf '%s' "$AIDAKIT_GOVERNANCE"`], { encoding: "utf8" });
    const expected = `${pluginRoot}/governance`;
    ok(sourced.stdout === expected, `7: sourced AIDAKIT_GOVERNANCE is byte-identical (expected ${JSON.stringify(expected)}, got ${JSON.stringify(sourced.stdout)})`);
  } finally {
    try { unlinkSync(envFile); } catch { /* best-effort cleanup */ }
  }
}

// ── 8-9. ADR-010 → ADR-012 rename is fully reflected (F1) ───────────────────
{
  const readme = readFileSync(join(ROOT, "docs", "decisions", "README.md"), "utf8");
  ok(readme.includes("[ADR-012](ADR-012-aidakit-governance-session-wide.md)"), "8: docs/decisions/README.md lists ADR-012");
  ok(!readme.includes("ADR-010-aidakit-governance-session-wide"), "8: docs/decisions/README.md no longer references the retired ADR-010 filename");

  const adr004 = readFileSync(join(ROOT, "docs", "decisions", "ADR-004-aidakit-governance-env-contract.md"), "utf8");
  ok(/## Amendments/.test(adr004), "9: ADR-004 has an ## Amendments section");
  ok(adr004.includes("[ADR-012](ADR-012-aidakit-governance-session-wide.md)"), "9: ADR-004's Amendments back-link points at ADR-012");
  ok(!adr004.includes("ADR-010-aidakit-governance-session-wide"), "9: ADR-004 no longer references the retired ADR-010 filename");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
