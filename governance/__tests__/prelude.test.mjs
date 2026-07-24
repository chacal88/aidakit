// Table test for the Node infra-detect prelude, in isolation — no engine, no
// flow, just `node --require <prelude> -e <script>` (child_process.spawnSync
// directly). Proves behavior#12 (runs-error-routing): the prelude re-raises
// EVERY uncaughtException that is NOT a module-resolution failure, untouched
// (Node's normal exit code, no `aidakit-prelude:` stderr line), and remaps
// ONLY the module-resolution shapes to the reserved sentinel exit 250. A
// widened guard (e.g. matching on message text, or on any `.code`) would
// silently reclassify legitimate crashes as infra — that regresses here.

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const preludePath = join(here, "..", "engine", "prelude", "infra-detect.cjs");

let pass = 0, fail = 0;
function ok(cond, name) { if (cond) pass++; else { fail++; console.log(`FAIL ${name}`); } }

function run(args) {
  return spawnSync("node", args, { encoding: "utf8" });
}

// (a) A TypeError thrown by the child (no .code) — not our shape — must be
// re-raised untouched: `install()`'s `throw err;` re-enters Node's OWN
// uncaught-exception machinery (re-throwing from inside an
// 'uncaughtException' listener), which Node exits with its documented code 7
// ("Internal Exception Handler Run-Time Failure") — empirically verified
// deterministic on this runtime. The exact code is Node's, not ours; the
// safeguard this pins is that it is NEVER the 250 sentinel and NEVER prints
// the aidakit-prelude: line — a widened isModuleResolutionFailure guard that
// started matching TypeErrors would flip both.
{
  const res = run(["--require", preludePath, "-e", "throw new TypeError('x')"]);
  ok(res.status !== 250, `13a: TypeError does NOT exit with the 250 sentinel (Node's own exit path instead) — got ${res.status}`);
  ok(res.status === 7, `13a: TypeError exits with Node's documented re-throw-in-handler code 7 — got ${res.status}`);
  ok(res.stderr.includes("TypeError"), "13a: stderr contains the TypeError");
  ok(!res.stderr.includes("aidakit-prelude:"), "13a: stderr does NOT contain the aidakit-prelude: line");
}

// (b) A plain Error with no `.code` at all — same re-raise contract.
{
  const res = run(["--require", preludePath, "-e", "throw new Error('x')"]);
  ok(res.status !== 250, `13b: plain Error does NOT exit with the 250 sentinel (Node's own exit path instead) — got ${res.status}`);
  ok(res.status === 7, `13b: plain Error exits with Node's documented re-throw-in-handler code 7 — got ${res.status}`);
  ok(!res.stderr.includes("aidakit-prelude:"), "13b: stderr does NOT contain the aidakit-prelude: line");
}

// (c) An unguarded top-level require() of a missing module — the actual
// module-resolution failure shape — IS remapped to exit 250 with the
// aidakit-prelude: line naming MODULE_NOT_FOUND.
{
  const res = run(["--require", preludePath, "-e", "require('./absent-module')"]);
  ok(res.status === 250, `13c: require() of a missing module exits 250 (the reserved sentinel) — got ${res.status}`);
  ok(res.stderr.includes("aidakit-prelude: infra error: MODULE_NOT_FOUND:"), "13c: stderr contains the aidakit-prelude: infra error: MODULE_NOT_FOUND: line");
}

// (d-sanity) Idempotency (behavior#10), as literally requested: the prelude
// required TWICE via NODE_OPTIONS/--require (as could happen if a validator's
// own NODE_OPTIONS already carries it and runs.js appends another --require)
// still exits 250 with exactly one aidakit-prelude: line. NOTE (verified
// empirically): Node's own require() cache already dedupes two --require
// flags pointing at the IDENTICAL resolved path — install() only runs once
// regardless of the Symbol guard — so this case alone does NOT exercise the
// guard. It is kept as a behavioral sanity check; (d) below is the real acid
// test for the guard itself.
{
  const res = run([
    "--require", preludePath,
    "--require", preludePath,
    "-e", "throw Object.assign(new Error('x'), {code:'MODULE_NOT_FOUND'})",
  ]);
  ok(res.status === 250, `13d-sanity: double-required (same path) prelude still exits 250 — got ${res.status}`);
  const preludeLines = res.stderr.split("\n").filter((l) => l.includes("aidakit-prelude:"));
  ok(preludeLines.length === 1, `13d-sanity: exactly ONE aidakit-prelude: line in stderr — got ${preludeLines.length}`);
}

// (d) The REAL acid test for the Symbol.for('aidakit.infra-detect.installed')
// guard: force install() to run a second time by clearing the module from
// require.cache and requiring it again (this is what genuinely happens if
// the prelude is loaded via two DIFFERENT code paths that Node's cache
// cannot unify — --require dedupe alone, per (d-sanity), can't surface a
// missing guard). Without the guard, the second install() call registers a
// SECOND 'uncaughtException' listener — listenerCount goes to 2. With the
// guard, the second call returns early — listenerCount stays at 1.
{
  const res = run(["-e", `
    const p = ${JSON.stringify(preludePath)};
    require(p);
    delete require.cache[require.resolve(p)];
    require(p);
    console.log(process.listenerCount("uncaughtException"));
  `]);
  ok(res.status === 0, `13d: the double-require-via-cache-clear probe itself exits 0 — got ${res.status}, stderr: ${res.stderr}`);
  ok(res.stdout.trim() === "1", `13d: exactly ONE uncaughtException listener installed after requiring the prelude twice (idempotent install) — got "${res.stdout.trim()}"`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
