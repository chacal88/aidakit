// Test for the check-links validator (pure Node, no framework).
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const tmp = mkdtempSync(join(tmpdir(), "check-links-"));
const validator = new URL("../validators/check-links.js", import.meta.url).pathname;

let pass = 0, fail = 0;
function ok(c, n) { if (c) pass++; else { fail++; console.log(`FAIL ${n}`); } }

/** Runs the validator and returns {code, json}. */
function run(...args) {
  try {
    const out = execFileSync("node", [validator, "--json", ...args], { encoding: "utf8" });
    return { code: 0, json: JSON.parse(out.trim().split("\n").pop()) };
  } catch (e) {
    const out = (e.stdout || "").trim();
    return { code: e.status, json: out ? JSON.parse(out.split("\n").pop()) : null };
  }
}

// Green: link that resolves.
mkdirSync(join(tmp, "a"), { recursive: true });
writeFileSync(join(tmp, "a", "target.md"), "# target\n");
writeFileSync(join(tmp, "a", "source.md"), "see [the target](target.md).\n");
{
  const r = run(join(tmp, "a", "source.md"));
  ok(r.code === 0 && r.json.ok, "valid link → exit 0, ok:true");
}

// Red: broken link.
writeFileSync(join(tmp, "a", "broken.md"), "see [missing](does-not-exist.md).\n");
{
  const r = run(join(tmp, "a", "broken.md"));
  ok(r.code === 1 && !r.json.ok && r.json.errors.length === 1, "broken link → exit 1, 1 error");
  ok(r.json.errors[0].href === "does-not-exist.md", "error names the broken href");
}

// External and anchor don't count.
writeFileSync(join(tmp, "a", "external.md"), "[site](https://x.com) and [anchor](#sec) and [mail](mailto:a@b.c)\n");
{
  const r = run(join(tmp, "a", "external.md"));
  ok(r.code === 0, "external/anchor/mailto links are ignored");
}

// Template placeholder doesn't count.
writeFileSync(join(tmp, "a", "template.md"), "[ADR](ADR-NNN-slug.md) and [x](../decisions/ADR-001-{{slug}}.md) and [c](docs/features/<change-id>/x.md)\n");
{
  const r = run(join(tmp, "a", "template.md"));
  ok(r.code === 0, "placeholders {{}}/<>/NNN/-slug are ignored");
}

// Explicit exception: check-links: ignore.
writeFileSync(join(tmp, "a", "exempt.md"), "<!-- check-links: ignore -->\n[broken on purpose](missing.md)\n");
{
  const r = run(join(tmp, "a", "exempt.md"));
  ok(r.code === 0, "file with 'check-links: ignore' is exempted");
}

// Link inside a code block doesn't count.
writeFileSync(join(tmp, "a", "code.md"), "```\n[this](does-not-resolve.md)\n```\n");
{
  const r = run(join(tmp, "a", "code.md"));
  ok(r.code === 0, "link in a fenced code block is ignored");
}

console.log(`\n${pass} passed, ${fail} failed`);
rmSync(tmp, { recursive: true, force: true });
process.exit(fail ? 1 : 0);
