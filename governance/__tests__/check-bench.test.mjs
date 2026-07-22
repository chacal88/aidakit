// Tests check-bench (THE PARALLELISM LEASH): the __manifest__ record as the
// source of truth for expected roles, presence, mechanical consensus vs. the
// reported outcome, and real-overlap detection.
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const tmp = mkdtempSync(join(tmpdir(), "check-bench-"));
const val = new URL("../validators/check-bench.js", import.meta.url).pathname;

let pass = 0, fail = 0;
function ok(c, n) { if (c) pass++; else { fail++; console.log(`FAIL ${n}`); } }
function run(args) {
  try {
    const out = execFileSync("node", [val, "--json", ...args], { encoding: "utf8" });
    return { code: 0, json: JSON.parse(out.trim().split("\n").pop()) };
  } catch (e) {
    const out = (e.stdout || "").trim();
    return { code: e.status, json: out ? JSON.parse(out.split("\n").pop()) : null };
  }
}
function writeBench(records) {
  const p = join(tmp, "bench.ndjson");
  writeFileSync(p, records.map((r) => JSON.stringify(r)).join("\n") + "\n");
  return p;
}
const manifest = (bench, round, roles, at) => ({ type: "bench-manifest", bench, round, role: "__manifest__", roles, at });

// (1) Manifest declares 2 roles, both report+pass, windows overlap → gate RELEASED.
{
  const p = writeBench([
    manifest("review", 1, ["adr-reviewer", "spec-reviewer"], "2026-07-21T09:59:00.000Z"),
    { bench: "review", round: 1, role: "adr-reviewer", verdict: "pass", dispatched_at: "2026-07-21T10:00:00.000Z", returned_at: "2026-07-21T10:02:00.000Z" },
    { bench: "review", round: 1, role: "spec-reviewer", verdict: "pass", dispatched_at: "2026-07-21T10:00:05.000Z", returned_at: "2026-07-21T10:02:10.000Z" },
  ]);
  const r = run([p, "--bench", "review", "--outcome", "pass"]);
  ok(r.code === 0 && r.json.ok, "leash: manifest + complete + consistent + overlapping → gate RELEASED (exit 0)");
  ok(r.json.mechanical_consensus === "pass", "leash: mechanical consensus is pass");
  ok(JSON.stringify(r.json.roles_expected) === JSON.stringify(["adr-reviewer", "spec-reviewer"]), "leash: roles_expected comes from the manifest");
}

// (2) No __manifest__ record and no --roles override → BLOCKS.
{
  const p = writeBench([
    { bench: "review", round: 1, role: "adr-reviewer", verdict: "pass", dispatched_at: "2026-07-21T10:00:00.000Z", returned_at: "2026-07-21T10:02:00.000Z" },
  ]);
  const r = run([p, "--bench", "review"]);
  ok(r.code === 1 && !r.json.ok, "leash: no manifest, no --roles override → gate LOCKED (exit 1)");
  ok(r.json.errors.some((e) => e.rule === "manifest-missing"), "leash: error is manifest-missing");
}

// (3) --roles override works even without a manifest (legacy/bypass path).
{
  const p = writeBench([
    { bench: "review", round: 1, role: "adr-reviewer", verdict: "pass", dispatched_at: "2026-07-21T10:00:00.000Z", returned_at: "2026-07-21T10:02:00.000Z" },
    { bench: "review", round: 1, role: "spec-reviewer", verdict: "pass", dispatched_at: "2026-07-21T10:00:05.000Z", returned_at: "2026-07-21T10:02:05.000Z" },
  ]);
  const r = run([p, "--bench", "review", "--roles", "adr-reviewer,spec-reviewer"]);
  ok(r.code === 0 && r.json.ok, "leash: --roles override bypasses the manifest requirement");
}

// (4) A role was dispatched BEFORE the manifest was written → BLOCKS
//     (the caller could have shrunk the manifest after seeing a failure).
{
  const p = writeBench([
    { bench: "review", round: 1, role: "adr-reviewer", verdict: "pass", dispatched_at: "2026-07-21T09:00:00.000Z", returned_at: "2026-07-21T09:02:00.000Z" },
    manifest("review", 1, ["adr-reviewer", "spec-reviewer"], "2026-07-21T10:00:00.000Z"),
    { bench: "review", round: 1, role: "spec-reviewer", verdict: "pass", dispatched_at: "2026-07-21T10:00:05.000Z", returned_at: "2026-07-21T10:02:05.000Z" },
  ]);
  const r = run([p, "--bench", "review"]);
  ok(r.code === 1 && !r.json.ok, "leash: role dispatched before the manifest was written → gate LOCKED");
  ok(r.json.errors.some((e) => e.rule === "manifest-not-first"), "leash: error is manifest-not-first");
}

// (5) A required role never reported → BLOCKS.
{
  const p = writeBench([
    manifest("review", 1, ["adr-reviewer", "spec-reviewer"], "2026-07-21T09:59:00.000Z"),
    { bench: "review", round: 1, role: "adr-reviewer", verdict: "pass", dispatched_at: "2026-07-21T10:00:00.000Z", returned_at: "2026-07-21T10:02:00.000Z" },
  ]);
  const r = run([p, "--bench", "review"]);
  ok(r.code === 1 && !r.json.ok, "leash: missing role → gate LOCKED (exit 1)");
  ok(r.json.errors.some((e) => e.rule === "role-missing" && e.role === "spec-reviewer"), "leash: error names the missing role");
}

// (6) Reported outcome contradicts the ndjson's own verdicts → BLOCKS.
{
  const p = writeBench([
    manifest("review", 1, ["adr-reviewer", "spec-reviewer"], "2026-07-21T09:59:00.000Z"),
    { bench: "review", round: 1, role: "adr-reviewer", verdict: "pass", dispatched_at: "2026-07-21T10:00:00.000Z", returned_at: "2026-07-21T10:02:00.000Z" },
    { bench: "review", round: 1, role: "spec-reviewer", verdict: "fail", dispatched_at: "2026-07-21T10:00:05.000Z", returned_at: "2026-07-21T10:02:10.000Z" },
  ]);
  const r = run([p, "--bench", "review", "--outcome", "pass"]);
  ok(r.code === 1 && !r.json.ok, "leash: reported 'pass' but a role failed → gate LOCKED");
  ok(r.json.errors.some((e) => e.rule === "consensus-mismatch"), "leash: error is consensus-mismatch");
  ok(r.json.mechanical_consensus === "fail", "leash: mechanical consensus correctly computed as fail");
}

// (7) Dispatch windows do NOT overlap (sequential, not parallel) → BLOCKS.
{
  const p = writeBench([
    manifest("review", 1, ["adr-reviewer", "spec-reviewer"], "2026-07-21T09:59:00.000Z"),
    { bench: "review", round: 1, role: "adr-reviewer", verdict: "pass", dispatched_at: "2026-07-21T10:00:00.000Z", returned_at: "2026-07-21T10:01:00.000Z" },
    { bench: "review", round: 1, role: "spec-reviewer", verdict: "pass", dispatched_at: "2026-07-21T10:01:05.000Z", returned_at: "2026-07-21T10:02:00.000Z" },
  ]);
  const r = run([p, "--bench", "review"]);
  ok(r.code === 1 && !r.json.ok, "leash: non-overlapping windows (sequential dispatch) → gate LOCKED");
  ok(r.json.errors.some((e) => e.rule === "not-parallel"), "leash: error is not-parallel");
}

// (8) A role reports twice in the same round → BLOCKS (duplicate).
{
  const p = writeBench([
    manifest("review", 1, ["adr-reviewer"], "2026-07-21T09:59:00.000Z"),
    { bench: "review", round: 1, role: "adr-reviewer", verdict: "pass", dispatched_at: "2026-07-21T10:00:00.000Z", returned_at: "2026-07-21T10:02:00.000Z" },
    { bench: "review", round: 1, role: "adr-reviewer", verdict: "pass", dispatched_at: "2026-07-21T10:00:01.000Z", returned_at: "2026-07-21T10:02:01.000Z" },
  ]);
  const r = run([p, "--bench", "review"]);
  ok(r.code === 1 && !r.json.ok, "leash: duplicate role report → gate LOCKED");
  ok(r.json.errors.some((e) => e.rule === "role-duplicate"), "leash: error is role-duplicate");
}

// (9) Without --round, the validator picks the HIGHEST round present.
{
  const p = writeBench([
    manifest("review", 1, ["adr-reviewer"], "2026-07-21T08:59:00.000Z"),
    { bench: "review", round: 1, role: "adr-reviewer", verdict: "fail", dispatched_at: "2026-07-21T09:00:00.000Z", returned_at: "2026-07-21T09:02:00.000Z" },
    manifest("review", 2, ["adr-reviewer", "spec-reviewer"], "2026-07-21T10:59:00.000Z"),
    { bench: "review", round: 2, role: "adr-reviewer", verdict: "pass", dispatched_at: "2026-07-21T11:00:00.000Z", returned_at: "2026-07-21T11:02:00.000Z" },
    { bench: "review", round: 2, role: "spec-reviewer", verdict: "pass", dispatched_at: "2026-07-21T11:00:05.000Z", returned_at: "2026-07-21T11:02:05.000Z" },
  ]);
  const r = run([p, "--bench", "review"]);
  ok(r.code === 0 && r.json.round === 2, "leash: no --round → defaults to the latest round (2)");
}

// (10) A single-role bench with no other record to overlap against is NOT
//      penalized (nothing to compare — checked=false path).
{
  const p = writeBench([
    manifest("implement", 1, ["surface-web"], "2026-07-21T09:59:00.000Z"),
    { bench: "implement", round: 1, role: "surface-web", verdict: "pass", dispatched_at: "2026-07-21T10:00:00.000Z", returned_at: "2026-07-21T10:05:00.000Z" },
  ]);
  const r = run([p, "--bench", "implement"]);
  ok(r.code === 0 && r.json.ok, "leash: single-role bench (nothing to overlap) → gate RELEASED");
}

// (11) A different --bench name in the same ledger file is isolated (no cross-talk).
{
  const p = writeBench([
    manifest("review", 1, ["adr-reviewer"], "2026-07-21T09:59:00.000Z"),
    { bench: "review", round: 1, role: "adr-reviewer", verdict: "fail", dispatched_at: "2026-07-21T10:00:00.000Z", returned_at: "2026-07-21T10:02:00.000Z" },
    manifest("implement", 1, ["surface-web"], "2026-07-21T09:59:00.000Z"),
    { bench: "implement", round: 1, role: "surface-web", verdict: "pass", dispatched_at: "2026-07-21T10:00:00.000Z", returned_at: "2026-07-21T10:05:00.000Z" },
  ]);
  const r = run([p, "--bench", "implement"]);
  ok(r.code === 0 && r.json.ok, "leash: unrelated bench in the same file doesn't leak in");
}

console.log(`\n${pass} passed, ${fail} failed`);
rmSync(tmp, { recursive: true, force: true });
process.exit(fail ? 1 : 0);
