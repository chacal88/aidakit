// Tests the canonical acceptance_criteria shape and the shared parser
// governance/acceptance/parse-criteria.js — the schema formalization the
// acceptance-leash's agent/validator pair consumes. Also carries the
// structural contract check for agents/acceptance-planner.md (§4a).
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tmp = mkdtempSync(join(tmpdir(), "brainstorm-schema-"));
let pass = 0, fail = 0;
function ok(c, n) { if (c) pass++; else { fail++; console.log(`FAIL ${n}`); } }
function eq(a, b, n) { const r = JSON.stringify(a) === JSON.stringify(b); if (!r) console.log(`  ${n}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); ok(r, n); }

const { parseCriteria } = await import("../acceptance/parse-criteria.js");

function seedBrainstorm(changeId, body) {
  const dir = join(tmp, ".aidakit", "tasks", changeId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "brainstorm.json"), JSON.stringify(body));
}
function seedProposal(changeId, body) {
  const dir = join(tmp, "docs", "features", changeId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "proposal.md"), body);
}

// ── (2a-i) Legacy shape: acceptance_criteria as an array of plain strings ──
{
  const changeId = "legacy-shape";
  seedBrainstorm(changeId, { acceptance_criteria: ["The widget renders without error", "The widget renders without error"] });
  const { criteria, source_path } = parseCriteria({ change_id: changeId, root: tmp });
  eq(criteria.length, 2, "legacy: both string criteria parsed");
  ok(criteria.every((c) => c.source === "brainstorm"), "legacy: source tagged 'brainstorm'");
  ok(criteria.every((c) => typeof c.id === "string" && c.id.length > 0), "legacy: every item gets an auto-slug id");
  ok(criteria[0].id !== criteria[1].id, "legacy: duplicate prose gets deduplicated ids");
  ok(criteria[0].criterion === "The widget renders without error", "legacy: prose preserved verbatim");
  ok(source_path.includes("brainstorm.json"), "legacy: source_path points at brainstorm.json");
}

// ── (2a-ii) New shape: acceptance_criteria as [{id, criterion}] ──
{
  const changeId = "new-shape";
  seedBrainstorm(changeId, {
    acceptance_criteria: [
      { id: "acceptance-planner-agent-exists", criterion: "New agent exists" },
      { id: "check-acceptance-validator-exists", criterion: "New validator exists" },
    ],
  });
  const { criteria } = parseCriteria({ change_id: changeId, root: tmp });
  eq(criteria, [
    { id: "acceptance-planner-agent-exists", criterion: "New agent exists", source: "brainstorm" },
    { id: "check-acceptance-validator-exists", criterion: "New validator exists", source: "brainstorm" },
  ], "new shape: explicit ids used verbatim, prose preserved, source tagged");
}

// ── (2a-iii) proposal.md ## Acceptance criteria section, brainstorm absent (fast-flow path) ──
{
  const changeId = "fast-flow-plan";
  seedProposal(changeId, `# Proposal — fast-flow-plan

## Why

Some prose.

## Acceptance criteria

- \`widget-renders\` — The widget renders without error
- The widget is keyboard-navigable

## Exit criteria

- \`node governance/__tests__/foo.test.mjs\` -> green
`);
  const { criteria, source_path } = parseCriteria({ change_id: changeId, root: tmp });
  eq(criteria.length, 2, "plan: both bullets parsed from ## Acceptance criteria");
  eq(criteria[0], { id: "widget-renders", criterion: "The widget renders without error", source: "plan" },
    "plan: explicit `id` — prose shape parsed");
  ok(criteria[1].source === "plan" && criteria[1].criterion === "The widget is keyboard-navigable",
    "plan: plain bullet (no explicit id) parsed with an auto-slug id");
  ok(!criteria.some((c) => c.criterion.includes("Exit criteria") || c.criterion.includes("foo.test.mjs")),
    "plan: section stops at the next heading (## Exit criteria excluded)");
  ok(source_path.includes("proposal.md"), "plan: source_path points at proposal.md");
}

// ── (2a-iv) Precedence: brainstorm.json wins over proposal.md when both exist ──
{
  const changeId = "precedence-check";
  seedBrainstorm(changeId, { acceptance_criteria: ["from brainstorm"] });
  seedProposal(changeId, `# Proposal\n\n## Acceptance criteria\n\n- from proposal\n`);
  const { criteria } = parseCriteria({ change_id: changeId, root: tmp });
  eq(criteria.length, 1, "precedence: only one source's criteria returned");
  eq(criteria[0].criterion, "from brainstorm", "precedence: brainstorm.json wins over proposal.md");
}

// ── (2a-v) Neither source present → empty criteria, no throw ──
{
  const { criteria, source_path } = parseCriteria({ change_id: "nothing-here", root: tmp });
  eq(criteria, [], "absent: no brainstorm, no proposal section → empty criteria array");
  eq(source_path, null, "absent: source_path is null");
}

// ── (2a-vi) Empty-slug fallback: blank/whitespace-only/punctuation-only prose
// must not produce an empty id ("") or a dash-only id ("-2", "-3") — falls
// back to a stable positional `criterion-<index>` id (bench round 1, Finding B).
{
  const changeId = "empty-slug-fallback";
  seedBrainstorm(changeId, { acceptance_criteria: ["", "   ", "!!!", "!!!"] });
  const { criteria } = parseCriteria({ change_id: changeId, root: tmp });
  eq(criteria.length, 4, "empty-slug: all four items parsed (none dropped)");
  ok(criteria.every((c) => c.id.length > 0), "empty-slug: no item has an empty id");
  ok(criteria.every((c) => !/^-/.test(c.id)), "empty-slug: no item has a dash-only id (no bare '-2'/'-3')");
  const ids = criteria.map((c) => c.id);
  eq(new Set(ids).size, 4, "empty-slug: all four ids are unique (deduplicated)");
  ok(ids.every((id) => /^criterion-\d/.test(id)), "empty-slug: ids fall back to the positional 'criterion-<index>' shape");
}

// ── (2a-vii) Empty-slug fallback on the proposal.md plain-bullet path (fast-flow) ──
{
  const changeId = "empty-slug-fallback-plan";
  seedProposal(changeId, `# Proposal\n\n## Acceptance criteria\n\n- !!!\n- ???\n`);
  const { criteria } = parseCriteria({ change_id: changeId, root: tmp });
  eq(criteria.length, 2, "empty-slug (plan): both blank/punctuation bullets parsed");
  ok(criteria.every((c) => c.id.length > 0 && !/^-/.test(c.id)), "empty-slug (plan): no empty or dash-only id");
}

// ── (2a-viii) Malformed brainstorm.json (JSON.parse throws) falls back to
// proposal.md cleanly, rather than throwing out of parseCriteria (bench round 1, Finding D4) ──
{
  const changeId = "malformed-brainstorm";
  const dir = join(tmp, ".aidakit", "tasks", changeId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "brainstorm.json"), "{ not valid json ,,,");
  seedProposal(changeId, `# Proposal\n\n## Acceptance criteria\n\n- \`from-proposal\` — parsed despite the broken brainstorm.json\n`);
  const { criteria, source_path } = parseCriteria({ change_id: changeId, root: tmp });
  eq(criteria.length, 1, "malformed brainstorm.json: falls back to proposal.md instead of throwing");
  eq(criteria[0], { id: "from-proposal", criterion: "parsed despite the broken brainstorm.json", source: "plan" },
    "malformed brainstorm.json: proposal.md content parsed correctly on fallback");
  ok(source_path.includes("proposal.md"), "malformed brainstorm.json: source_path points at proposal.md, not the broken brainstorm.json");
}

// ── (4a) Structural contract of agents/acceptance-planner.md ──
{
  const agentPath = new URL("../../agents/acceptance-planner.md", import.meta.url).pathname;
  const content = readFileSync(agentPath, "utf8");
  const frontmatter = content.split("---\n")[1] ?? "";
  ok(/^tools:\s*Read,\s*Glob,\s*Grep,\s*Write\s*$/m.test(frontmatter), "acceptance-planner: frontmatter tools is exactly 'Read, Glob, Grep, Write'");
  ok(/^model:\s*sonnet\s*$/m.test(frontmatter), "acceptance-planner: frontmatter declares model: sonnet");
  for (const section of ["## Role", "## Protocol", "## What you decide on your own", "## Escalation triggers", "## What you do NOT do", "## Output format"]) {
    ok(content.includes(section), `acceptance-planner: has mandatory anatomy section "${section}"`);
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
rmSync(tmp, { recursive: true, force: true });
process.exit(fail ? 1 : 0);
