// Tests the roadmap derivation — parse epics + derive status from disk + aggregate.
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
const tmp = mkdtempSync(join(tmpdir(), "roadmap-"));
process.env.AIDAKIT_PROJECT_ROOT = tmp;
const { parseEpic, deriveChangeStatus, aggregateStatus, deriveRoadmap } =
  await import("../roadmap/roadmap.js");

let pass = 0, fail = 0;
function ok(c, n) { if (c) pass++; else { fail++; console.log(`FAIL ${n}`); } }
function eq(a, b, n) { const r = JSON.stringify(a) === JSON.stringify(b); if (!r) console.log(`  ${n}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`); ok(r, n); }

function write(rel, content) {
  const p = join(tmp, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content, "utf8");
  return p;
}
function mkdir(rel) { mkdirSync(join(tmp, rel), { recursive: true }); }

// --- parseEpic ---
const epicFile = write("docs/roadmap/epics/EPIC-payments.md", [
  "# Payments system",
  "",
  "Goal: let customers pay online.",
  "",
  "- **Feature:** Checkout — changes: feature-cart, feature-checkout-ui",
  "- **Feature:** Refunds — changes: feature-refund",
  "not a feature line",
].join("\n"));
const epic = parseEpic(epicFile);
eq(epic.id, "EPIC-payments", "epic id from filename");
eq(epic.title, "Payments system", "epic title from H1");
eq(epic.features.length, 2, "2 features parsed");
eq(epic.features[0].changeIds, ["feature-cart", "feature-checkout-ui"], "feature 1 change-ids");
eq(epic.features[1].changeIds, ["feature-refund"], "feature 2 change-ids");

// --- deriveChangeStatus (each disk path) ---
const ctx = { root: tmp, prChangeIds: new Set(["feature-checkout-ui"]), branchChangeIds: new Set(["feature-cart"]) };
mkdir("docs/features/feature-cart");                       // in-flight artifact
mkdir("docs/archive/2026-07-01-feature-refund");           // archived → done
ok(deriveChangeStatus("feature-cart", ctx) === "in-progress", "artifact dir → in-progress");
ok(deriveChangeStatus("feature-checkout-ui", ctx) === "in-review", "open PR → in-review");
ok(deriveChangeStatus("feature-refund", ctx) === "done", "archived → done");
ok(deriveChangeStatus("feature-unknown", ctx) === "backlog", "nowhere → backlog");
// branch-only (no artifacts, no PR) → planned
ok(deriveChangeStatus("feature-branchonly", { root: tmp, branchChangeIds: new Set(["feature-branchonly"]) }) === "planned", "branch only → planned");

// --- aggregateStatus ---
ok(aggregateStatus([]) === "backlog", "no children → backlog");
ok(aggregateStatus(["done", "done"]) === "done", "all done → done");
ok(aggregateStatus(["done", "in-progress"]) === "in-progress", "some in-progress → in-progress");
ok(aggregateStatus(["done", "blocked"]) === "blocked", "any blocked → blocked");
ok(aggregateStatus(["backlog", "planned"]) === "planned", "some planned → planned");

// --- deriveRoadmap end-to-end (uses the epic + disk above) ---
const rm = deriveRoadmap(ctx);
eq(rm.epics.length, 1, "1 epic derived");
const checkout = rm.epics[0].features.find((f) => f.name === "Checkout");
ok(checkout.status === "in-progress", "Checkout aggregates to in-progress (cart in-progress + ui in-review)");
const refunds = rm.epics[0].features.find((f) => f.name === "Refunds");
ok(refunds.status === "done", "Refunds aggregates to done");
ok(rm.epics[0].status === "in-progress", "epic in-progress (one feature still not done)");

// empty roadmap → no epics, no crash
rmSync(join(tmp, "docs/roadmap"), { recursive: true, force: true });
eq(deriveRoadmap({ root: tmp }).epics, [], "no epics dir → []");

console.log(`\n${pass} passed, ${fail} failed`);
rmSync(tmp, { recursive: true, force: true });
process.exit(fail ? 1 : 0);
