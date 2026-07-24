#!/usr/bin/env node
// check-pr-automation — thin CLI wrapper over governance/pr/pr-config.js's
// autoMergeEnabled() (a peer domain package, like governance/roadmap/roadmap.js
// wrapped by derive-roadmap-status.js). This is the "command" half of the
// merge_route gate (design.md, DOCS.md §6e): a deterministic runs step that
// routes the flow's pr→merge tail toward the opt-in autonomous merge (ADR-008)
// or the human gate.
// Pure Node, zero-dep. Validator contract:
//   exit 0 = pr.auto_merge resolves true · exit 1 = false/absent/malformed
//   (fail-closed) · exit 2 = usage. stdout = JSON · stderr = md report.
//
// Usage: node check-pr-automation.js --field auto_merge
//   Startdir: AIDAKIT_PROJECT_ROOT || process.cwd() — same resolveRoot as the
//   reader and the hooks/pre-bash.js carve-out (single-source, never diverges).

import { autoMergeEnabled } from "../pr/pr-config.js";

// `auto_merge` is the only field this validator (and the config schema) define
// today — a fixed vocabulary check keeps a typo from silently exit-1'ing as if
// it were a legitimate "disabled" reading instead of a usage error.
const VALID_FIELDS = new Set(["auto_merge"]);

function main() {
  const argv = process.argv.slice(2);
  const jsonOnly = argv.includes("--json");
  const fieldIdx = argv.indexOf("--field");
  const field = fieldIdx >= 0 ? argv[fieldIdx + 1] : undefined;

  if (!field || field.startsWith("--") || !VALID_FIELDS.has(field)) {
    const result = { validator: "aidakit.check-pr-automation", ok: false, field: field ?? null, error: "usage" };
    process.stdout.write(JSON.stringify(result) + "\n");
    if (!jsonOnly) {
      process.stderr.write(
        `# check-pr-automation\n\nUSAGE — expected --field auto_merge (got: ${JSON.stringify(field ?? null)}).\n`
      );
    }
    process.exit(2);
  }

  const startDir = process.env.AIDAKIT_PROJECT_ROOT || process.cwd();
  const enabled = autoMergeEnabled(startDir);
  const result = { validator: "aidakit.check-pr-automation", ok: enabled, field, enabled };
  process.stdout.write(JSON.stringify(result) + "\n");
  if (!jsonOnly) {
    if (enabled) {
      process.stderr.write(`# check-pr-automation\n\nOK — pr.auto_merge is true.\n`);
    } else {
      process.stderr.write(
        `# check-pr-automation\n\nFAIL (fail-closed) — pr.auto_merge is not true (absent config, ` +
          `\`pr:\` block, false, or malformed all fall back to the human merge gate).\n`
      );
    }
  }
  process.exit(enabled ? 0 : 1);
}

main();
