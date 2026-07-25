// Test for the archive rewrite-links tool (pure Node, no framework).
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const tool = new URL("../archive/rewrite-links.js", import.meta.url).pathname;

let pass = 0, fail = 0;
function ok(c, n) { if (c) pass++; else { fail++; console.log(`FAIL ${n}`); } }

/** Runs the tool and returns {code, json}. */
function run(...args) {
  try {
    const out = execFileSync("node", [tool, "--json", ...args], { encoding: "utf8" });
    return { code: 0, json: JSON.parse(out.trim().split("\n").pop()) };
  } catch (e) {
    const out = (e.stdout || "").trim();
    return { code: e.status, json: out ? JSON.parse(out.split("\n").pop()) : null };
  }
}

/**
 * Builds a throwaway repo with `retry-memory` ALREADY archived (the real situation: the
 * move happened, the inbound links did not follow) and returns its root.
 */
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "archive-links-"));
  mkdirSync(join(root, "docs", "archive", "2026-07-24-retry-memory"), { recursive: true });
  mkdirSync(join(root, "docs", "decisions"), { recursive: true });
  mkdirSync(join(root, "docs", "roadmap", "epics"), { recursive: true });
  mkdirSync(join(root, "skills", "implement"), { recursive: true });
  writeFileSync(join(root, "docs", "archive", "2026-07-24-retry-memory", "design.md"), "# design\n\n### Read side\n");
  writeFileSync(join(root, "docs", "archive", "2026-07-24-retry-memory", "evidence.md"), "# evidence\n");
  return root;
}

// ── §1 the core rewrite, from two different depths ────────────────────────────
{
  const root = fixture();
  const adr = join(root, "docs", "decisions", "ADR-010.md");
  const skill = join(root, "skills", "implement", "SKILL.md");
  writeFileSync(adr, "see [the design](../features/retry-memory/design.md).\n");
  writeFileSync(skill, "see [the design](../../docs/features/retry-memory/design.md).\n");

  const dry = run("--root", root, "--change", "retry-memory");
  ok(dry.code === 0 && dry.json.ok, "§1-i dry-run exits 0");
  ok(dry.json.dry_run === true, "§1-ii dry_run is the default");
  ok(dry.json.rewrites.length === 2, "§1-iii finds both inbound links");
  ok(readFileSync(adr, "utf8").includes("../features/"), "§1-iv dry-run writes NOTHING");

  const applied = run("--root", root, "--change", "retry-memory", "--apply");
  ok(applied.json.dry_run === false && applied.json.files_changed === 2, "§1-v --apply reports 2 files");
  ok(
    readFileSync(adr, "utf8").trim() === "see [the design](../archive/2026-07-24-retry-memory/design.md).",
    "§1-vi rewrites the depth-2 link (ADR)",
  );
  ok(
    readFileSync(skill, "utf8").trim() === "see [the design](../../docs/archive/2026-07-24-retry-memory/design.md).",
    "§1-vii rewrites the depth-3 link (skill) — different relative prefix, same target",
  );
}

// ── §2 anchors and queries survive verbatim ───────────────────────────────────
{
  const root = fixture();
  const f = join(root, "docs", "decisions", "ADR-010.md");
  writeFileSync(f, "[d](../features/retry-memory/design.md#read-side--how-it-works) and [e](../features/retry-memory/evidence.md?x=1)\n");
  run("--root", root, "--change", "retry-memory", "--apply");
  const out = readFileSync(f, "utf8");
  ok(out.includes("../archive/2026-07-24-retry-memory/design.md#read-side--how-it-works"), "§2-i anchor preserved verbatim");
  ok(out.includes("../archive/2026-07-24-retry-memory/evidence.md?x=1"), "§2-ii query preserved verbatim");
}

// ── §3 idempotency — the whole point of rewriting instead of stubbing ─────────
{
  const root = fixture();
  const f = join(root, "docs", "decisions", "ADR-010.md");
  writeFileSync(f, "[d](../features/retry-memory/design.md)\n");
  run("--root", root, "--change", "retry-memory", "--apply");
  const once = readFileSync(f, "utf8");
  const second = run("--root", root, "--change", "retry-memory", "--apply");
  ok(second.json.rewrites.length === 0, "§3-i second run rewrites nothing");
  ok(readFileSync(f, "utf8") === once, "§3-ii second run leaves the file byte-identical");
}

// ── §4 what must NOT be touched ───────────────────────────────────────────────
{
  const root = fixture();
  const fenced = join(root, "docs", "decisions", "ADR-011.md");
  writeFileSync(fenced, "```\n[d](../features/retry-memory/design.md)\n```\n");
  const other = join(root, "docs", "decisions", "ADR-012.md");
  writeFileSync(other, "[d](../features/some-other-change/design.md)\n");
  const archived = join(root, "docs", "archive", "2026-07-24-retry-memory", "proposal.md");
  writeFileSync(archived, "[sibling](../features/retry-memory/design.md)\n");
  const ext = join(root, "docs", "decisions", "ADR-013.md");
  writeFileSync(ext, "[x](https://example.com/features/retry-memory/design.md) and [y](#features)\n");

  const r = run("--root", root, "--change", "retry-memory", "--apply");
  ok(r.json.rewrites.length === 0, "§4-i nothing rewritten across all four traps");
  ok(readFileSync(fenced, "utf8").includes("../features/"), "§4-ii a link in a fenced block is illustration, not an address");
  ok(readFileSync(other, "utf8").includes("some-other-change"), "§4-iii another change's links are untouched");
  ok(readFileSync(archived, "utf8").includes("../features/"), "§4-iv the archive is WORM — never rewritten");
  ok(readFileSync(ext, "utf8").includes("https://example.com"), "§4-v external links and pure anchors are skipped");
}

// ── §5 two links on ONE line — right-to-left application must not corrupt ─────
{
  const root = fixture();
  const f = join(root, "docs", "decisions", "ADR-010.md");
  writeFileSync(f, "[a](../features/retry-memory/design.md) then [b](../features/retry-memory/evidence.md) end\n");
  run("--root", root, "--change", "retry-memory", "--apply");
  ok(
    readFileSync(f, "utf8").trim() ===
      "[a](../archive/2026-07-24-retry-memory/design.md) then [b](../archive/2026-07-24-retry-memory/evidence.md) end",
    "§5-i both links on one line rewritten, offsets intact",
  );
}

// ── §6 refuses to guess ───────────────────────────────────────────────────────
{
  const root = fixture();
  ok(run("--root", root, "--change", "never-archived").code === 2, "§6-i unarchived change → exit 2, no guess");
  ok(run("--root", root).code === 2, "§6-ii missing --change → exit 2 usage");

  mkdirSync(join(root, "docs", "archive", "2026-07-25-retry-memory"), { recursive: true });
  const amb = run("--root", root, "--change", "retry-memory");
  ok(amb.code === 2, "§6-iii two dated dirs for one id → exit 2, human resolves");
  ok(run("--root", root, "--change", "retry-memory", "--archive-dir", "2026-07-25-retry-memory").code === 0,
    "§6-iv --archive-dir resolves the ambiguity");
}

// ── §7 link to the change DIRECTORY itself (no trailing file) ─────────────────
{
  const root = fixture();
  const f = join(root, "docs", "decisions", "ADR-010.md");
  writeFileSync(f, "[the change](../features/retry-memory)\n");
  run("--root", root, "--change", "retry-memory", "--apply");
  ok(readFileSync(f, "utf8").trim() === "[the change](../archive/2026-07-24-retry-memory)", "§7-i bare directory link rewritten");
}

// ── §8 OpenSpec layout ────────────────────────────────────────────────────────
{
  const root = mkdtempSync(join(tmpdir(), "archive-links-os-"));
  mkdirSync(join(root, "openspec", "changes", "archive", "retry-memory"), { recursive: true });
  mkdirSync(join(root, "docs"), { recursive: true });
  writeFileSync(join(root, "openspec", "changes", "archive", "retry-memory", "design.md"), "# d\n");
  const f = join(root, "docs", "ADR-010.md");
  writeFileSync(f, "[d](../openspec/changes/retry-memory/design.md)\n");
  const r = run("--root", root, "--change", "retry-memory", "--apply");
  ok(r.code === 0 && r.json.rewrites.length === 1, "§8-i OpenSpec layout detected and rewritten");
  ok(readFileSync(f, "utf8").includes("../openspec/changes/archive/retry-memory/design.md"), "§8-ii OpenSpec archive is undated");
}

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
