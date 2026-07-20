import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const tmp = mkdtempSync(join(tmpdir(), "ledger-"));
process.env.AIDAKIT_PROJECT_ROOT = tmp;
const { recordTokens, recordError, readLedger, deriveRework } = await import("../ledgers/ledger.js");

let pass=0, fail=0;
function ok(c,n){ if(c) pass++; else { fail++; console.log(`FAIL ${n}`); } }
function eq(a,b,n){ const r=JSON.stringify(a)===JSON.stringify(b); if(!r) console.log(`  ${n}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`); ok(r,n); }

const cid = "feature-teste";
recordTokens(cid, { phase: "implement", role: "developer", round: 1, model: "sonnet", tokens: { input: 100, output: 50, total: 150 } });
recordTokens(cid, { phase: "implement", role: "developer", round: 2, model: "sonnet", tokens: { total: 80 } }); // rework
recordTokens(cid, { phase: "review", role: "adr-reviewer", round: 1, tokens: { total: 40 } });
recordError(cid, { errorType: "agent-rework", key: "impl-off-by-one", phase: "implement", detail: "cursor errado" });

const tok = readLedger(cid, "token");
eq(tok.length, 3, "3 token records");
const err = readLedger(cid, "error");
eq(err.length, 1, "1 error record");

const d = deriveRework(cid);
eq(d.byPhase.implement, 230, "byPhase.implement sums 150+80");
eq(d.byPhase.review, 40, "byPhase.review = 40");
eq(d.byRole.developer, 230, "byRole.developer = 230");
eq(d.reworkTotal, 80, "reworkTotal = round 2 tokens");
eq(d.errorCount, 1, "errorCount = 1");

// nonexistent ledger returns []
eq(readLedger("nao-existe", "token"), [], "nonexistent ledger = []");

console.log(`\n${pass} passed, ${fail} failed`);
rmSync(tmp, { recursive: true, force: true });
process.exit(fail?1:0);
