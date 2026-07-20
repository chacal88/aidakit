// Tests deriveCandidates — the crystallization trigger (recurring error → DNA candidate).
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const tmp = mkdtempSync(join(tmpdir(), "candidates-"));
process.env.AIDAKIT_PROJECT_ROOT = tmp;
const { recordError, deriveCandidates } = await import("../ledgers/ledger.js");

let pass = 0, fail = 0;
function ok(c, n) { if (c) pass++; else { fail++; console.log(`FAIL ${n}`); } }
function eq(a, b, n) { const r = JSON.stringify(a) === JSON.stringify(b); if (!r) console.log(`  ${n}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`); ok(r, n); }

const cid = "feature-candidatos";

// An error that recurs 3x (same stable key) — should become a candidate at the default threshold.
recordError(cid, { errorType: "agent-rework", key: "impl-off-by-one", phase: "implement", mitigation: "clamp the index" });
recordError(cid, { errorType: "agent-rework", key: "impl-off-by-one", phase: "review" });
recordError(cid, { errorType: "agent-rework", key: "impl-off-by-one", phase: "implement" });
// An error that only occurs 1x — NOT a candidate.
recordError(cid, { errorType: "flaky-test", key: "timeout-net", phase: "test" });
// Error without a stable key — ignored (no way to count recurrence).
recordError(cid, { errorType: "unknown", phase: "implement" });

const cand = deriveCandidates(cid);
eq(cand.length, 1, "1 candidate at threshold=3");
eq(cand[0].key, "impl-off-by-one", "candidate is the recurring error");
eq(cand[0].count, 3, "count = 3 occurrences");
eq(cand[0].phases.sort(), ["implement", "review"], "phases deduplicated");
eq(cand[0].mitigations, ["clamp the index"], "mitigation captured once");

// A higher threshold excludes the candidate.
eq(deriveCandidates(cid, { threshold: 4 }).length, 0, "threshold=4 excludes (only 3 occurrences)");
// threshold=1 also picks up the flaky one (2 candidates), but never the key-less one.
eq(deriveCandidates(cid, { threshold: 1 }).length, 2, "threshold=1 picks recurring + flaky, ignores key-less");

// change with no errors → no candidates.
eq(deriveCandidates("empty"), [], "no errors = no candidates");

console.log(`\n${pass} passed, ${fail} failed`);
rmSync(tmp, { recursive: true, force: true });
process.exit(fail ? 1 : 0);
