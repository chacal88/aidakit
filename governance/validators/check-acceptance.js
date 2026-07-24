#!/usr/bin/env node
// check-acceptance — THE ACCEPTANCE (GOAL) LEASH. Mirror of check-doc-manifest.js.
// Reads an acceptance-manifest and checks that every "required" item's evidence
// path resolves on disk. Exit 0 only if the list is 100%. Weak-bar by decision
// (design.md §Weak-bar rationale): path-exists only, NEVER re-executes a test —
// `hardening`/`aidakit:test` already re-run the suite; this leash only checks
// that a criterion's promise was mapped to a real artifact.
// Pure Node, zero-dep. Contract: exit 0 pass · 1 incomplete · 2 usage/error.
//
// Usage: node check-acceptance.js <path-to-acceptance-manifest.json>
//
// Manifest format (acceptance-manifest.json):
//   {
//     "change_id": "acceptance-leash",
//     "level": "change",
//     "required": [
//       { "criterion_id": "brainstorm-outputs-schema",
//         "criterion": "...",
//         "evidence": { "kind": "test"|"file"|"evidence-section", "path": "..." },
//         "status": "pending"|"resolved"|"n/a",
//         "condition": "mandatory on n/a" }
//     ]
//   }
// An "n/a" item is skipped, but ONLY when it carries a "condition" — an "n/a"
// without one is a manifest-invalid error (fail-closed: silence is not a waiver).
// "status: resolved" is not trusted — the disk is the truth, same as the doc-leash.
//
// CROSS-VALIDATION (bench round 1, Finding A): this validator is the sole runtime
// consumer of governance/acceptance/parse-criteria.js. It re-parses the change's
// live source (brainstorm.json or proposal.md) and asserts every criterion the
// parser finds has a manifest entry (by id) — a "criterion-orphan" error otherwise.
// This is what makes ADR-010 §Decision 3's "single-owner" contract real: without
// it, the agent's re-derivation of the parser's slugify/dedupe logic could drift
// from the module silently.

import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve, dirname, isAbsolute } from "node:path";
import { findProjectRoot } from "../engine/project-root.js";
import { parseCriteria } from "../acceptance/parse-criteria.js";

function fail(msg) { process.stderr.write(`check-acceptance — error: ${msg}\n`); process.exit(2); }

/** Strips a trailing '#anchor' suffix — same convention as check-links.js. */
function stripAnchor(path) {
  const i = path.indexOf("#");
  return i === -1 ? path : path.slice(0, i);
}

function main() {
  const argv = process.argv.slice(2);
  const jsonOnly = argv.includes("--json");
  const manifestPath = argv.find((a) => !a.startsWith("--"));
  if (!manifestPath) fail("usage: check-acceptance <acceptance-manifest.json>");
  if (!existsSync(manifestPath)) fail(`manifest not found: ${manifestPath}`);

  let manifest;
  // NOTE (bench round 1, Finding C): this exit-2 path (bad JSON) emits only a
  // stderr message via fail() — unlike the missing/empty `required` exit-2 path
  // below, it does NOT emit a JSON envelope on stdout, because there is no valid
  // manifest object to build one from at this point. That's the deliberate
  // asymmetry between the two exit-2 twins, not an oversight.
  try { manifest = JSON.parse(readFileSync(manifestPath, "utf8")); }
  catch (e) { fail(`invalid manifest JSON: ${e.message}`); }

  const change_id = manifest.change_id ?? null;
  const level = manifest.level ?? null;

  // Fail-closed on manifest shape: missing OR empty 'required' list is invalid.
  // (An empty list is distinct in cause from a missing key, but both mean the
  // manifest cannot enforce anything — same rule, 'manifest-invalid'.)
  // NOTE (bench round 1, Finding C): this exit-2 path DOES emit a full JSON
  // envelope on stdout (unlike the bad-JSON twin above) because `manifest` is a
  // valid object here — an improvement over the twin, kept intentionally.
  if (!Array.isArray(manifest.required) || manifest.required.length === 0) {
    const result = {
      validator: "aidakit.check-acceptance",
      ok: false,
      change_id, level,
      required: 0, resolved: 0,
      errors: [{ rule: "manifest-invalid", criterion_id: null, path: null,
        message: Array.isArray(manifest.required)
          ? "manifest 'required' list is empty — a change without acceptance criteria is a red flag, not a normal case"
          : "manifest without a 'required' list" }],
    };
    process.stdout.write(JSON.stringify(result) + "\n");
    if (!jsonOnly) process.stderr.write(`# check-acceptance\n\nBLOCKED — manifest-invalid: ${result.errors[0].message}\n`);
    process.exit(2);
  }

  // Manifest paths are relative to the PROJECT ROOT — same climb as check-doc-manifest.js.
  const root = process.env.AIDAKIT_PROJECT_ROOT
    ? resolve(process.env.AIDAKIT_PROJECT_ROOT)
    : findProjectRoot(dirname(resolve(manifestPath)));

  const errors = [];
  let requiredCount = 0, resolvedCount = 0;
  let manifestInvalid = false;

  for (const item of manifest.required) {
    if (item.status === "n/a") {
      if (!item.condition) {
        manifestInvalid = true;
        errors.push({ rule: "manifest-invalid", criterion_id: item.criterion_id ?? null, path: null,
          message: `item "${item.criterion_id}" is status:"n/a" without a "condition" — a waiver requires a written justification` });
      }
      continue;
    }
    requiredCount++;
    const rawPath = item.evidence && item.evidence.path;
    if (!rawPath) {
      errors.push({ rule: "evidence-missing", criterion_id: item.criterion_id ?? null, path: rawPath ?? null,
        message: `required criterion missing an evidence.path: ${item.criterion_id}` });
      continue;
    }
    const stripped = stripAnchor(rawPath);
    const abs = isAbsolute(stripped) ? stripped : resolve(root, stripped);
    if (!existsSync(abs) || !statSync(abs).isFile()) {
      errors.push({ rule: "evidence-missing", criterion_id: item.criterion_id ?? null, path: rawPath,
        message: `evidence path missing: ${item.criterion_id} (${rawPath})${item.condition ? ` [${item.condition}]` : ""}` });
      continue;
    }
    resolvedCount++;
  }

  // CROSS-VALIDATION (bench round 1, Finding A): check-acceptance.js is the sole
  // runtime consumer of parse-criteria.js — the agent AUTHORS the manifest by
  // re-deriving the same slugify/dedupe logic under LLM judgment; this validator
  // CONFIRMS the manifest matches the parser's live extraction from the change's
  // real source (brainstorm.json in full, proposal.md in fast). A criterion the
  // parser finds but the manifest never accounted for (by id, including n/a
  // waivers) is a 'criterion-orphan' — the single-owner contract ADR-010 §Decision
  // 3 claims only holds if drift between the two is caught mechanically, here.
  const { criteria: parsedCriteria } = parseCriteria({ change_id, root });
  const manifestIds = new Set(manifest.required.map((item) => item.criterion_id).filter(Boolean));
  for (const pc of parsedCriteria) {
    if (!manifestIds.has(pc.id)) {
      errors.push({ rule: "criterion-orphan", criterion_id: pc.id, path: null,
        message: `criterion "${pc.id}" ("${pc.criterion}") is present in the source (brainstorm.json/proposal.md) but has no entry in the manifest's required[] — every parsed criterion must be accounted for (resolved, pending, or n/a with a condition)` });
    }
  }

  const result = {
    validator: "aidakit.check-acceptance",
    ok: errors.length === 0,
    change_id, level,
    required: requiredCount,
    resolved: resolvedCount,
    parsed_criteria: parsedCriteria.length,
    errors,
  };
  process.stdout.write(JSON.stringify(result) + "\n");
  if (!jsonOnly) {
    if (errors.length === 0) {
      process.stderr.write(`# check-acceptance\n\nOK — ${resolvedCount}/${requiredCount} acceptance criteria resolved. Gate cleared.\n`);
    } else {
      process.stderr.write(`# check-acceptance\n\nBLOCKED — ${resolvedCount}/${requiredCount} resolved; ${errors.length} pending:\n\n`);
      for (const e of errors) process.stderr.write(`- ${e.message}\n`);
      process.stderr.write(`\nThe flow won't advance until the list is 100%. Resolve the criteria above.\n`);
    }
  }
  if (manifestInvalid) process.exit(2);
  process.exit(errors.length === 0 ? 0 : 1);
}

main();
