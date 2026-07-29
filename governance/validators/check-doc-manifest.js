#!/usr/bin/env node
// check-doc-manifest — THE DOCUMENTATION LEASH (the owner's idea).
// Reads a manifest of required documents and checks that every "required" item
// is resolved: the file exists and (if it's an ADR) passes the format check. Exit 0 only if
// the list is 100%. It's the `runs` step that LOCKS the flow's gate — the doc doesn't get
// lost because the engine won't advance unless this validator passes.
// Pure Node, zero-dep. Contract: exit 0 pass · 1 incomplete · 2 usage/error.
//
// Usage: node check-doc-manifest.js <path-to-manifest.json>
//
// Manifest format (doc-manifest.json):
//   {
//     "change_id": "feature-x" | "PROJECT",
//     "level": "change" | "project",
//     "required": [
//       { "doc": "proposal", "path": "docs/features/feature-x/proposal.md",
//         "status": "pending"|"resolved"|"n/a", "condition": "mandatory on n/a",
//         "kind": "adr"|"doc"|"index" }
//     ]
//   }
// An "n/a" item (does not apply to this change) is skipped, but ONLY when it carries
// a "condition" — an "n/a" without one is a manifest-invalid error, exit 2 (fail-closed:
// silence is not a waiver; same semantics as check-acceptance.js per ADR-010). A
// "pending"/"resolved" requires that the file EXISTS — the declared status isn't enough;
// the validator checks the disk (the truth is the file, not the field). A kind:"adr"
// item also goes through check-adr-format.

import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve, dirname, isAbsolute } from "node:path";
import { execFileSync } from "node:child_process";
import { findProjectRoot } from "../engine/project-root.js";

function fail(msg) { process.stderr.write(`check-doc-manifest — error: ${msg}\n`); process.exit(2); }

function main() {
  const argv = process.argv.slice(2);
  const jsonOnly = argv.includes("--json");
  const manifestPath = argv.find((a) => !a.startsWith("--"));
  if (!manifestPath) fail("usage: check-doc-manifest <manifest.json>");
  if (!existsSync(manifestPath)) fail(`manifest not found: ${manifestPath}`);

  let manifest;
  try { manifest = JSON.parse(readFileSync(manifestPath, "utf8")); }
  catch (e) { fail(`invalid manifest JSON: ${e.message}`); }
  if (!Array.isArray(manifest.required)) fail("manifest without a 'required' list");

  // Manifest paths are relative to the PROJECT ROOT. We discover the root by
  // walking up from the manifest until we find .aidakit/ or using AIDAKIT_PROJECT_ROOT.
  const root = process.env.AIDAKIT_PROJECT_ROOT
    ? resolve(process.env.AIDAKIT_PROJECT_ROOT)
    : findProjectRoot(dirname(resolve(manifestPath)));

  const errors = [];
  let requiredCount = 0, resolvedCount = 0;
  let manifestInvalid = false;
  const adrValidator = new URL("./check-adr-format.js", import.meta.url).pathname;

  for (const item of manifest.required) {
    if (item.status === "n/a") {
      if (!item.condition) {
        manifestInvalid = true;
        errors.push({ rule: "manifest-invalid", doc: item.doc ?? null, path: item.path ?? null,
          message: `item "${item.doc}" is status:"n/a" without a "condition" — a waiver requires a written justification` });
      }
      continue;
    }
    requiredCount++;
    const abs = isAbsolute(item.path) ? item.path : resolve(root, item.path);
    if (!existsSync(abs) || !statSync(abs).isFile()) {
      errors.push({ rule: "doc-missing", doc: item.doc, path: item.path,
        message: `required document missing: ${item.doc} (${item.path})${item.condition ? ` [${item.condition}]` : ""}` });
      continue;
    }
    // It exists. If it's an ADR, validate the format too.
    if (item.kind === "adr") {
      try {
        execFileSync("node", [adrValidator, "--json", abs], { encoding: "utf8" });
      } catch (e) {
        errors.push({ rule: "adr-format", doc: item.doc, path: item.path,
          message: `required ADR exists but fails the format check: ${item.path}` });
        continue;
      }
    }
    resolvedCount++;
  }

  const result = {
    validator: "aidakit.check-doc-manifest",
    ok: errors.length === 0,
    change_id: manifest.change_id ?? null,
    level: manifest.level ?? null,
    required: requiredCount,
    resolved: resolvedCount,
    errors,
  };
  process.stdout.write(JSON.stringify(result) + "\n");
  if (!jsonOnly) {
    if (errors.length === 0) {
      process.stderr.write(`# check-doc-manifest\n\nOK — ${resolvedCount}/${requiredCount} required documents resolved. Gate cleared.\n`);
    } else {
      process.stderr.write(`# check-doc-manifest\n\nBLOCKED — ${resolvedCount}/${requiredCount} resolved; ${errors.length} pending:\n\n`);
      for (const e of errors) process.stderr.write(`- ${e.message}\n`);
      process.stderr.write(`\nThe flow won't advance until the list is 100%. Resolve the documents above.\n`);
    }
  }
  if (manifestInvalid) process.exit(2);
  process.exit(errors.length === 0 ? 0 : 1);
}

main();
