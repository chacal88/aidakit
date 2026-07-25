// @dna-origin-change: workflow-script-optimization
// @dna-origin-premise: environment:concurrent-worktrees-shared-origin-main
// @dna-type: regression-gate
// @dna-created-at: 2026-07-25
// @dna-trigger: ledger:errorType=concurrent-worktree-drift key=stale-measurement-after-origin-main-advance recurred 3x (deriveCandidates threshold=3; phases implement, review-bench-round-1, review-bench-round-2)
// Regression gate — measured `wc -c -w` body-size tables in an in-flight change's
// dispatch-cost.md must match the LIVE tree.
//
// Origin: workflow-script-optimization suffered the same drift class 3x in ONE
// authoring session (concurrent sibling PRs advanced origin/main mid-change):
//   1. PR #52 (80610ab) grew skills/readiness/SKILL.md after the skill-body table
//      was drafted (caught by the implementer's validation pass).
//   2. PR #55 (db4443e) archived 5 changes mid-flight, reworking finding F4's
//      orphan counts 7->4 (caught at rebase).
//   3. PR #54 (48f4731) grew agents/doc-planner.md — the TOP-RANKED cost row —
//      and the implementer's own reproduction pass missed it; review-bench
//      round 2 caught it (an error-2: recurrence after the round-1 mitigation).
// The manual "re-measure after rebase" discipline demonstrably misses files; this
// gate re-measures mechanically. Vacuously green when no change on the tree ships
// a dispatch-cost.md — it bites exactly when the drift class can occur.
//
// Covers both measured shapes dispatch-cost.md uses:
//   - fenced `wc -c -w` output rows:  `<words> <bytes> agents/<name>.md`
//   - markdown table rows:            | `skills/<x>/SKILL.md` | <words> | <bytes> |
// wc parity: words = maximal non-whitespace runs; bytes = Buffer.byteLength
// (UTF-8) — verified exact against `wc -c -w` on the origin change's own tree
// (agents/doc-planner.md 2198/15105, agents/research.md 754/5288,
// agents/tester.md 2030/12676).
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.env.AIDAKIT_PROJECT_ROOT || process.cwd();
let pass = 0, fail = 0;
const ok = (c, n) => { if (c) pass++; else { fail++; console.log(`FAIL ${n}`); } };

const FENCED_ROW_RE = /^\s*(\d+)\s+(\d+)\s+((?:agents|skills)\/[^\s`|]+\.md)\s*$/gm;
const TABLE_ROW_RE = /^\|\s*`((?:agents|skills)\/[^`]+\.md)`\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|/gm;

const featuresDir = join(ROOT, "docs", "features");
const tables = [];
if (existsSync(featuresDir)) {
  for (const change of readdirSync(featuresDir)) {
    const p = join(featuresDir, change, "dispatch-cost.md");
    if (!existsSync(p) || !statSync(p).isFile()) continue;
    const content = readFileSync(p, "utf8");
    const rows = [];
    let m;
    FENCED_ROW_RE.lastIndex = 0;
    while ((m = FENCED_ROW_RE.exec(content)) !== null) rows.push({ words: +m[1], bytes: +m[2], file: m[3] });
    TABLE_ROW_RE.lastIndex = 0;
    while ((m = TABLE_ROW_RE.exec(content)) !== null) rows.push({ words: +m[2], bytes: +m[3], file: m[1] });
    if (rows.length) tables.push({ change, rows });
  }
}

if (tables.length === 0) {
  console.log("no docs/features/*/dispatch-cost.md with measured rows — vacuously green (the gate bites only while an audit change is in flight).");
}
for (const t of tables) {
  for (const r of t.rows) {
    const p = join(ROOT, r.file);
    if (!existsSync(p)) { ok(false, `${t.change}: ${r.file} is tabled but missing from the live tree`); continue; }
    const c = readFileSync(p, "utf8");
    const bytes = Buffer.byteLength(c);
    const words = c.split(/\s+/).filter(Boolean).length;
    ok(bytes === r.bytes, `${t.change}: ${r.file} tabled ${r.bytes} bytes, live ${bytes} — stale measurement; re-run wc -c -w ${r.file} after the rebase`);
    ok(words === r.words, `${t.change}: ${r.file} tabled ${r.words} words, live ${words} — stale measurement; re-run wc -c -w ${r.file} after the rebase`);
  }
  console.log(`${t.change}: ${t.rows.length} measured rows checked`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
