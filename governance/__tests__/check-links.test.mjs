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

// --- Archive-aware resolution (DOCS.md §2 rule 7 single key) ------------------------
// A change package is promoted wholesale to docs/archive/<date>-<change-id>/ on merge,
// breaking inbound citations in documents that cannot be repointed (ADRs are WORM).
const repo = join(tmp, "repo");
mkdirSync(join(repo, "docs", "decisions"), { recursive: true });
mkdirSync(join(repo, "docs", "features"), { recursive: true });
mkdirSync(join(repo, "docs", "archive", "2026-07-24-shipped-change"), { recursive: true });
writeFileSync(join(repo, "docs", "archive", "2026-07-24-shipped-change", "design.md"), "# design\n");
const cite = (href) => `see [design](${href}).\n`;

writeFileSync(join(repo, "docs", "decisions", "ADR-001-x.md"), cite("../features/shipped-change/design.md"));
{
  const r = run(join(repo, "docs", "decisions", "ADR-001-x.md"));
  ok(r.code === 0 && r.json.ok, "features/<id> link resolves against the dated archive");
}

// The fallback is scoped: it must not resurrect a file that never shipped.
writeFileSync(join(repo, "docs", "decisions", "ADR-002-x.md"), cite("../features/shipped-change/never-written.md"));
{
  const r = run(join(repo, "docs", "decisions", "ADR-002-x.md"));
  ok(r.code === 1 && r.json.errors.length === 1, "missing file inside an archived package still fails");
}

// ...nor invent a change that was never archived at all (a genuine typo).
writeFileSync(join(repo, "docs", "decisions", "ADR-003-x.md"), cite("../features/typo-change/design.md"));
{
  const r = run(join(repo, "docs", "decisions", "ADR-003-x.md"));
  ok(r.code === 1 && r.json.errors.length === 1, "unarchived change-id still fails (typo not masked)");
}

// Exact-match guard: `2026-07-24-archive-loop-var-resume` must NOT satisfy a citation of
// `loop-var-resume`. Both shapes coexist in this repo, so a suffix match would be wrong.
mkdirSync(join(repo, "docs", "archive", "2026-07-24-archive-loop-var-resume"), { recursive: true });
writeFileSync(join(repo, "docs", "archive", "2026-07-24-archive-loop-var-resume", "design.md"), "# other\n");
writeFileSync(join(repo, "docs", "decisions", "ADR-004-x.md"), cite("../features/loop-var-resume/design.md"));
{
  const r = run(join(repo, "docs", "decisions", "ADR-004-x.md"));
  ok(r.code === 1, "a longer change-id ending in the cited id is not a match");
}

// Ambiguity is reported, never guessed.
mkdirSync(join(repo, "docs", "archive", "2026-07-25-shipped-change"), { recursive: true });
writeFileSync(join(repo, "docs", "archive", "2026-07-25-shipped-change", "design.md"), "# dupe\n");
{
  const r = run(join(repo, "docs", "decisions", "ADR-001-x.md"));
  ok(r.code === 1, "two dated twins for one change-id → ambiguous, reported not guessed");
}

// A live change still in flight resolves literally, with no archive involved.
mkdirSync(join(repo, "docs", "features", "in-flight"), { recursive: true });
writeFileSync(join(repo, "docs", "features", "in-flight", "design.md"), "# live\n");
writeFileSync(join(repo, "docs", "decisions", "ADR-005-x.md"), cite("../features/in-flight/design.md"));
{
  const r = run(join(repo, "docs", "decisions", "ADR-005-x.md"));
  ok(r.code === 0, "in-flight change resolves literally");
}

// § Code is not an address — a link SHAPE illustrated in code is a format, not a target.

// The motivating shape: a format placeholder in an inline code span, on a prose line,
// whose href resolves to nothing. This is `skills/context-pack/SKILL.md:26` as it stood
// before #47 rewrote it to `(<path>)` to dodge the false positive — the dodge is exactly
// what this skip makes unnecessary, so the shape is pinned here as a fixture rather than
// against a live file that someone may edit around again.
writeFileSync(join(tmp, "a", "span.md"),
  "every ADR as a read-once address (`- [ADR-NNN](path) — role`).\n");
{
  const r = run(join(tmp, "a", "span.md"));
  ok(r.code === 0 && r.json.ok, "link-shaped placeholder in an inline code span is ignored");
}

// Same placeholder inside a fenced block — the emitted-format example a doc shows verbatim.
writeFileSync(join(tmp, "a", "span-fenced.md"),
  "## ADRs\n\n```markdown\n- [ADR-NNN](path) — role\n- [ADR-013](nope.md) — another\n```\n");
{
  const r = run(join(tmp, "a", "span-fenced.md"));
  ok(r.code === 0 && r.json.ok, "link-shaped placeholder in a fenced block is ignored");
}

// The skip must be surgical: a REAL broken link elsewhere on a line that also carries a
// code span is still reported (the span is blanked, not the whole line).
writeFileSync(join(tmp, "a", "span-mixed.md"),
  "the `[ADR-NNN](path)` format, see [the design](gone.md) and `x`\n");
{
  const r = run(join(tmp, "a", "span-mixed.md"));
  ok(r.code === 1 && r.json.errors.length === 1, "real broken link on a line with code spans is still caught");
  ok(r.json.errors[0]?.href === "gone.md", "the reported href is the real link, not the placeholder");
}

// A real link whose TEXT is a code span keeps being resolved (blanking the span must not
// destroy the link around it).
writeFileSync(join(tmp, "a", "span-as-text.md"), "see [`target.md`](target.md).\n");
{
  const r = run(join(tmp, "a", "span-as-text.md"));
  ok(r.code === 0, "link whose text is a code span still resolves");
}
writeFileSync(join(tmp, "a", "span-as-text-broken.md"), "see [`gone.md`](gone.md).\n");
{
  const r = run(join(tmp, "a", "span-as-text-broken.md"));
  ok(r.code === 1 && r.json.errors[0]?.href === "gone.md", "broken link whose text is a code span is caught");
}

// An unclosed backtick run is literal text, not an open span swallowing the rest of the
// line — fail-open: it may report a placeholder, it never silently skips a real link.
writeFileSync(join(tmp, "a", "span-unclosed.md"), "a stray ` tick then [x](gone.md)\n");
{
  const r = run(join(tmp, "a", "span-unclosed.md"));
  ok(r.code === 1 && r.json.errors[0]?.href === "gone.md", "unclosed backtick run is literal — link after it still checked");
}

// Double-backtick span (used when the content itself contains a backtick): a run of N is
// closed only by a run of exactly N.
writeFileSync(join(tmp, "a", "span-double.md"), "the ``[ADR-NNN](path)`` shape\n");
{
  const r = run(join(tmp, "a", "span-double.md"));
  ok(r.code === 0, "link-shaped placeholder in a double-backtick span is ignored");
}

// Smoke test on the file that motivated this, kept as a canary rather than as proof:
// since #47 it passes via the `(<path>)` placeholder heuristic too, so it would stay green
// even if the code-span skip regressed. The fixtures above are what actually pin the skip.
{
  const skill = new URL("../../skills/context-pack/SKILL.md", import.meta.url).pathname;
  const r = run(skill);
  ok(r.code === 0 && r.json.ok, "skills/context-pack/SKILL.md passes check-links");
}

console.log(`\n${pass} passed, ${fail} failed`);
rmSync(tmp, { recursive: true, force: true });
process.exit(fail ? 1 : 0);
