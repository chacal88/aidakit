#!/usr/bin/env node
// check-bench — THE PARALLELISM LEASH.
// Reads a bench.ndjson trail (governance/ledgers/ledger.js) and mechanically
// verifies that a "bench" dispatch (a named group of independent subagents
// fired in the SAME message — the review bench, implement's per-surface
// fan-out, or any future one) actually happened as claimed:
//
//   0. A __manifest__ record (recordBenchManifest) declares the roles expected
//      this round, and it is the round's EARLIEST record — proof it was
//      written BEFORE any subagent was dispatched, so the caller couldn't
//      shrink the manifest after seeing a role fail.
//   1. Every role in that manifest reported exactly one verdict in the round.
//   2. The mechanical consensus derived from the roles' verdicts matches the
//      outcome the caller says it reported to the flow engine (no silent
//      mismatch between what the bench actually said and what got relayed).
//   3. The roles' dispatch/return windows genuinely OVERLAP — proof that the
//      subagents ran concurrently, not sequentially dressed up as a bench.
//
// Pure Node, zero-dep. Contract: exit 0 pass · 1 leash violation · 2 usage/error.
//
// Usage:
//   node check-bench.js <path-to-bench.ndjson> --bench <name>
//     [--roles r1,r2,...] [--round N] [--outcome pass|fail] [--json]
//
// --roles is normally OMITTED: the expected roles come from the round's own
// __manifest__ record (the single source of truth — see recordBenchManifest
// in governance/ledgers/ledger.js). Pass --roles only to override/bypass a
// missing manifest (e.g. legacy benches that predate the manifest record).
//
// bench.ndjson record shapes:
//   manifest: { type:"bench-manifest", bench, round, role:"__manifest__", roles:[...] }
//   verdict:  { type:"bench", bench, round, role, agent, verdict_raw,
//               verdict:"pass"|"fail", dispatched_at, returned_at }
//
// Without --round, the validator uses the highest round number present for
// the given bench. Without --outcome, step 2 (consensus-vs-reported-outcome)
// is skipped — useful for callers that only need presence + overlap checked.

import { existsSync, readFileSync } from "node:fs";

function fail(msg) { process.stderr.write(`check-bench — error: ${msg}\n`); process.exit(2); }

function parseArgs(argv) {
  const opts = { roles: null, json: false };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") opts.json = true;
    else if (a === "--bench") opts.bench = argv[++i];
    else if (a === "--roles") opts.roles = (argv[++i] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    else if (a === "--round") opts.round = Number(argv[++i]);
    else if (a === "--outcome") opts.outcome = argv[++i];
    else if (!a.startsWith("--")) positional.push(a);
  }
  opts.ledgerPath = positional[0];
  return opts;
}

function readNdjson(path) {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => { try { return JSON.parse(l); } catch { return null; } })
    .filter(Boolean);
}

/** Two [start,end] windows overlap if start1 < end2 AND start2 < end1. */
function windowsOverlap(a, b) {
  return a.start < b.end && b.start < a.end;
}

/**
 * A round is "genuinely parallel" if every record's dispatch/return window
 * overlaps at least one other record's window — a purely sequential dispatch
 * (each role starting only after the previous one returned) has NO overlapping
 * pair at all.
 */
function hasOverlap(records) {
  const windows = records
    .filter((r) => r.dispatched_at && r.returned_at)
    .map((r) => ({ role: r.role, start: Date.parse(r.dispatched_at), end: Date.parse(r.returned_at) }))
    .filter((w) => Number.isFinite(w.start) && Number.isFinite(w.end));
  if (windows.length < 2) return { checked: false, overlap: true };
  for (let i = 0; i < windows.length; i++) {
    for (let j = i + 1; j < windows.length; j++) {
      if (windowsOverlap(windows[i], windows[j])) return { checked: true, overlap: true };
    }
  }
  return { checked: true, overlap: false };
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.ledgerPath) fail("usage: check-bench <bench.ndjson> --bench <name> [--roles r1,r2,...] [--round N] [--outcome pass|fail]");
  if (!opts.bench) fail("--bench <name> is required (which bench to check, e.g. 'review', 'implement')");

  const all = readNdjson(opts.ledgerPath).filter((r) => r.bench === opts.bench);
  const errors = [];

  const round = opts.round ?? Math.max(0, ...all.map((r) => r.round ?? 0));
  const records = all.filter((r) => (r.round ?? 0) === round);
  const manifestRecords = records.filter((r) => r.role === "__manifest__");
  const roleRecords = records.filter((r) => r.role !== "__manifest__");

  // 0. Manifest — the source of truth for which roles are expected, unless
  //    the caller explicitly overrode it with --roles.
  let expectedRoles = opts.roles;
  if (expectedRoles === null) {
    if (manifestRecords.length === 0) {
      errors.push({ rule: "manifest-missing", message: `bench "${opts.bench}" round ${round}: no __manifest__ record found — the caller must record the expected roles BEFORE dispatching (recordBenchManifest), or pass --roles explicitly` });
      expectedRoles = [];
    } else {
      if (manifestRecords.length > 1) {
        errors.push({ rule: "manifest-duplicate", message: `bench "${opts.bench}" round ${round}: more than one __manifest__ record — the manifest must be written exactly once, before dispatch` });
      }
      const manifest = manifestRecords[0];
      expectedRoles = Array.isArray(manifest.roles) ? manifest.roles : [];
      // The manifest must be the round's EARLIEST record — proof it was
      // written before any subagent returned (i.e., before results were known).
      const manifestTime = Date.parse(manifest.at ?? manifest.dispatched_at ?? "");
      const earlierRoleRecord = roleRecords.find((r) => {
        const t = Date.parse(r.dispatched_at ?? r.at ?? "");
        return Number.isFinite(t) && Number.isFinite(manifestTime) && t < manifestTime;
      });
      if (earlierRoleRecord) {
        errors.push({ rule: "manifest-not-first", message: `bench "${opts.bench}" round ${round}: role "${earlierRoleRecord.role}" was dispatched before the __manifest__ record was written — the manifest must be committed BEFORE any dispatch` });
      }
    }
  }

  // 1. Presence — every expected role reported exactly once this round.
  const byRole = new Map();
  for (const r of roleRecords) {
    if (byRole.has(r.role)) errors.push({ rule: "role-duplicate", role: r.role, message: `role "${r.role}" reported more than once in round ${round}` });
    byRole.set(r.role, r);
  }
  for (const role of expectedRoles) {
    if (!byRole.has(role)) errors.push({ rule: "role-missing", role, message: `expected role "${role}" did not report in round ${round} — bench "${opts.bench}" is incomplete` });
  }

  // 2. Consensus — mechanical PASS/FAIL derived from the roles' own verdicts,
  //    compared against what the caller says it reported to the engine. The
  //    caller may report in the bench's own pass/fail vocabulary or in a
  //    flow-level vocabulary (e.g. consensus/rejected, approved/needs-revision) —
  //    normalize both to pass/fail before comparing.
  const verdicts = [...byRole.values()].map((r) => r.verdict);
  const mechanicalConsensus = verdicts.length > 0 && verdicts.every((v) => v === "pass") ? "pass" : "fail";
  const PASS_ALIASES = new Set(["pass", "consensus", "approved", "success"]);
  const FAIL_ALIASES = new Set(["fail", "rejected", "needs-revision", "blocked", "failure"]);
  const normalizedOutcome = opts.outcome === undefined ? undefined
    : PASS_ALIASES.has(opts.outcome) ? "pass"
    : FAIL_ALIASES.has(opts.outcome) ? "fail"
    : opts.outcome; // unrecognized value passes through so it still surfaces a mismatch
  if (normalizedOutcome !== undefined && normalizedOutcome !== mechanicalConsensus) {
    errors.push({
      rule: "consensus-mismatch",
      reported: opts.outcome,
      mechanical: mechanicalConsensus,
      message: `reported outcome "${opts.outcome}" does not match the mechanical consensus "${mechanicalConsensus}" derived from bench.ndjson (round ${round})`,
    });
  }

  // 3. Real parallelism — dispatch/return windows must overlap.
  const overlapCheck = hasOverlap(roleRecords);
  if (overlapCheck.checked && !overlapCheck.overlap) {
    errors.push({
      rule: "not-parallel",
      message: `bench "${opts.bench}" round ${round}: no two roles' dispatch windows overlap — this looks like a sequential dispatch, not a real parallel bench`,
    });
  }

  const result = {
    validator: "aidakit.check-bench",
    ok: errors.length === 0,
    bench: opts.bench,
    round,
    roles_expected: expectedRoles,
    roles_reported: [...byRole.keys()],
    mechanical_consensus: verdicts.length ? mechanicalConsensus : null,
    errors,
  };
  process.stdout.write(JSON.stringify(result) + "\n");
  if (!opts.json) {
    if (errors.length === 0) {
      process.stderr.write(`# check-bench\n\nOK — bench "${opts.bench}" round ${round}: ${byRole.size}/${expectedRoles.length} roles reported, consensus "${mechanicalConsensus}", dispatch genuinely parallel. Gate cleared.\n`);
    } else {
      process.stderr.write(`# check-bench\n\nBLOCKED — bench "${opts.bench}" round ${round}:\n\n`);
      for (const e of errors) process.stderr.write(`- ${e.message}\n`);
      process.stderr.write(`\nThe flow won't advance until the bench dispatch is complete, consistent, and genuinely parallel.\n`);
    }
  }
  process.exit(errors.length === 0 ? 0 : 1);
}

main();
