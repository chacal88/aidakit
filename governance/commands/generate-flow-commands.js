#!/usr/bin/env node
// governance/commands/generate-flow-commands.js — the generator + thin CLI (ADR-017;
// docs/features/per-flow-commands/design.md §2, §4, §7).
//
// Renders one commands/flow-<name>.md per flow YAML through the ONE template
// (render-flow-command.js), in two source/target modes:
//   --mode kit      governance/flows/*.yaml      -> commands/flow-<name>.md      (committed)
//   --mode consumer <root>/.aidakit/flows/*.yaml -> <root>/.claude/commands/flow-<name>.md
// consumer is the fail-closed default (the installed-user case; design.md §4).
//
// Reuse, don't re-parse ("cut, don't copy", ADR-016): flows load through the engine's
// own parseFlowFile (governance/engine/parser.js -> yaml-min.js) — no second YAML reader.
//
// Validator-shaped contract, mirroring governance/validators/*.js:
//   exit 0 = every flow written/unchanged · exit 1 = one or more refusals (collision or
//   sentinel-less target) · exit 2 = usage/IO error. JSON summary on stdout, md report on
//   stderr. Thin CLI guarded by the same import.meta.url pattern as the validators.

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { parseFlowFile } from "../engine/parser.js";
import { resolveProjectRoot } from "../engine/project-root.js";
import { renderFlowCommand, derivePositionalKey, deriveHasRegister, SENTINEL_PREFIX } from "./render-flow-command.js";

const HERE = dirname(fileURLToPath(import.meta.url)); // governance/commands
// The KIT's own plugin root — two levels up from this file — regardless of which target
// project `root` the generator is writing into (consumer mode). The doctrine footer/
// sentinel version always reflects the INSTALLED PLUGIN's version, never the consumer
// project's own (a consumer project has no .claude-plugin/plugin.json of its own).
const PLUGIN_ROOT = resolve(HERE, "..", "..");

// A project flow named after a shipped built-in would shadow it — refused in consumer mode.
const BUILTIN_NAMES = new Set(["fast", "full", "design"]);

// Security boundary (review round-2 SECURITY VETO — fail-closed, at the boundary where
// untrusted `.aidakit/flows/` names enter, BOTH modes). `flow.flow` and every declared input
// `name` are spliced UNESCAPED into (a) the sentinel `<!-- aidakit:generated flow=<name> ... -->`
// and (b) the literal `cli.js` bash lines the rendered command tells the operator/agent to run.
// A name outside this strict slug charset could break out of the sentinel comment (prompt
// injection via `-->`) or inject shell metacharacters (`;`/`|`/space) into the printed bash
// line. Refused BEFORE rendering — never sanitized/escaped after the fact.
export const FLOW_NAME_RE = /^[a-z][a-z0-9-]*$/;
export const INPUT_NAME_RE = /^[a-z][a-z0-9_-]*$/;

/**
 * Index of the first declared input that is NOT a valid `{name: <slug>}` shape, or -1 when
 * every input is clean. Fail-closed on TYPE first, THEN charset (review round-3
 * TYPE-CONFUSION finding): the ORIGINAL guard only applied `INPUT_NAME_RE` when
 * `typeof i.name === "string"`, so a non-string `name` (array/object/number/null — e.g. a
 * YAML block list under `name:`) SKIPPED validation entirely and reached `renderFlowCommand`
 * unescaped. Rejects EVERY non-conforming shape, never merely skips past one.
 *
 * Returns an INDEX rather than the offending input itself, on purpose: the offending input
 * can be falsy on its own (a bare `null` entry inside `inputs:` is a legal YAML shape — see
 * yaml-min.js), and a falsy return from `.find()` would be indistinguishable from "nothing
 * invalid found" at the call site — the exact same bug class this fix exists to close.
 * @param {{inputs?: Array<unknown>}} flow
 * @returns {number}
 */
function firstInvalidInputIndex(flow) {
  const inputs = Array.isArray(flow.inputs) ? flow.inputs : [];
  return inputs.findIndex((i) => !(i && typeof i.name === "string" && INPUT_NAME_RE.test(i.name)));
}

/**
 * Reads the doctrine version (major.minor, e.g. "0.11") from a plugin.json — always the
 * KIT's own manifest by default (PLUGIN_ROOT), single-sourced with check-plugin-version.js's
 * footer format. `pluginRoot` is overridable for tests only.
 * @param {string} [pluginRoot]
 * @returns {string}
 */
export function footerVersionFromPluginJson(pluginRoot = PLUGIN_ROOT) {
  const manifestPath = join(pluginRoot, ".claude-plugin", "plugin.json");
  const raw = JSON.parse(readFileSync(manifestPath, "utf8")).version;
  const m = /^(\d+)\.(\d+)/.exec(String(raw ?? ""));
  if (!m) throw new Error(`plugin.json has no parseable version: ${JSON.stringify(raw)} (${manifestPath})`);
  return `${m[1]}.${m[2]}`;
}

/**
 * Derives the template's `meta` from a parsed flow + the source path it came from.
 * @param {import('../engine/types.js').Flow} flow
 * @param {{footerVersion: string, sentinelSource: string}} opts
 */
export function metaFrom(flow, { footerVersion, sentinelSource }) {
  return {
    flowName: flow.flow,
    description: flow.description,
    inputs: Array.isArray(flow.inputs) ? flow.inputs : [],
    positionalKey: derivePositionalKey(flow),
    hasRegister: deriveHasRegister(flow),
    sentinelSource,
    footerVersion,
  };
}

/** Source/target directory pair + collision set for a given mode, rooted at `root`. */
function resolveModePaths(mode, root) {
  if (mode === "kit") {
    return { sourceDir: join(root, "governance", "flows"), targetDir: join(root, "commands"), collisionSet: new Set() };
  }
  if (mode === "consumer") {
    return { sourceDir: join(root, ".aidakit", "flows"), targetDir: join(root, ".claude", "commands"), collisionSet: BUILTIN_NAMES };
  }
  throw new Error(`unknown mode: ${JSON.stringify(mode)} (expected "kit" or "consumer")`);
}

function toPosix(p) {
  return p.split(sep).join("/");
}

/**
 * Runs the generator over every `*.yaml` in the resolved source directory. Never throws on
 * a per-flow problem — each flow refuses/skips/writes independently (design.md §7); only a
 * structural problem (bad mode, unreadable plugin.json) throws.
 * @param {{mode?: "kit"|"consumer", root?: string}} [opts]
 * @returns {{ok: boolean, footerVersion: string, results: Array<{name:string, action:string, reason?:string, path?:string}>}}
 */
export function runGenerate({ mode = "consumer", root = process.cwd() } = {}) {
  const { sourceDir, targetDir, collisionSet } = resolveModePaths(mode, root);
  const footerVersion = footerVersionFromPluginJson();
  const results = [];

  if (!existsSync(sourceDir)) return { ok: true, footerVersion, results };

  const files = readdirSync(sourceDir)
    .filter((f) => f.endsWith(".yaml"))
    .sort();

  for (const file of files) {
    const sourcePath = join(sourceDir, file);
    const loadResult = parseFlowFile(sourcePath);
    if (loadResult.errors.length) {
      results.push({
        name: file.replace(/\.yaml$/, ""),
        action: "refused",
        reason: `invalid flow YAML: ${loadResult.errors.map((e) => e.message).join("; ")}`,
      });
      continue;
    }
    const flow = loadResult.flow;
    const name = flow.flow;

    // Security boundary — refuse BEFORE deriving/rendering anything from an untrusted name
    // (both modes; see FLOW_NAME_RE/INPUT_NAME_RE above). TYPE first, then charset (review
    // round-3 TYPE-CONFUSION finding): `parseFlowFile`'s own shape validation already
    // guarantees `flow.flow` is a string (`validateFlowShape`'s `typeof d.flow !== "string"`
    // check, governance/engine/parser.js), so this `typeof` guard is unreachable via THIS
    // call path today (confirmed: flow-command-generation.test.mjs §11.5) — kept anyway as
    // belt-and-suspenders (`runGenerate`/`metaFrom` are exported and could be driven by a
    // hand-built `flow` object bypassing `parseFlowFile` entirely), and so a non-string
    // `name` can never coerce through `RegExp#test` (which stringifies its argument instead
    // of refusing it).
    if (typeof name !== "string" || !FLOW_NAME_RE.test(name)) {
      results.push({ name, action: "refused", reason: `invalid flow name: ${JSON.stringify(name)} (must be a string matching ${FLOW_NAME_RE})` });
      continue;
    }
    const badInputIdx = firstInvalidInputIndex(flow);
    if (badInputIdx !== -1) {
      const badInput = flow.inputs[badInputIdx];
      results.push({
        name,
        action: "refused",
        reason: `invalid input at inputs[${badInputIdx}]: ${JSON.stringify(badInput)} (must have a string 'name' matching ${INPUT_NAME_RE})`,
      });
      continue;
    }

    // emit_flow_command:false is a deliberate, symmetric opt-out — honored in BOTH modes
    // (design.md §8; a consumer flow can decline a generated shortcut same as a built-in).
    if (flow.emit_flow_command === false) {
      results.push({ name, action: "skipped", reason: "emit_flow_command:false" });
      continue;
    }
    if (mode === "consumer" && collisionSet.has(name)) {
      results.push({ name, action: "refused", reason: "collides with a shipped built-in command; rename the project flow" });
      continue;
    }

    const targetPath = join(targetDir, `flow-${name}.md`);
    const sentinelSource = toPosix(relative(root, sourcePath));
    const rendered = renderFlowCommand(metaFrom(flow, { footerVersion, sentinelSource }));
    const relTarget = toPosix(relative(root, targetPath));

    if (existsSync(targetPath)) {
      // Single read serves both the header/sentinel check and the byte-equality compare
      // (review round-2 ARCHITECTURE nit — avoids reading the whole target file twice).
      const existing = readFileSync(targetPath, "utf8");
      const hasSentinel = existing.split(/\r?\n/).slice(0, 6).some((l) => l.startsWith(SENTINEL_PREFIX));
      if (!hasSentinel) {
        results.push({ name, action: "refused", reason: "hand-authored (no sentinel in header region) — left untouched", path: relTarget });
        continue;
      }
      if (existing === rendered) {
        results.push({ name, action: "unchanged", path: relTarget });
        continue;
      }
      mkdirSync(dirname(targetPath), { recursive: true });
      writeFileSync(targetPath, rendered, "utf8");
      results.push({ name, action: "updated", path: relTarget });
    } else {
      mkdirSync(dirname(targetPath), { recursive: true });
      writeFileSync(targetPath, rendered, "utf8");
      results.push({ name, action: "created", path: relTarget });
    }
  }

  const ok = results.every((r) => r.action !== "refused");
  return { ok, footerVersion, results };
}

function usage(msg) {
  process.stderr.write(`# generate-flow-commands\n\nUSAGE — ${msg}\n`);
  process.exit(2);
}

function main() {
  const argv = process.argv.slice(2);
  const modeIdx = argv.indexOf("--mode");
  const mode = modeIdx >= 0 ? argv[modeIdx + 1] : "consumer";
  if (mode !== "kit" && mode !== "consumer") usage(`--mode must be "kit" or "consumer" (got ${JSON.stringify(mode)})`);
  const positional = argv.filter((a, i) => !a.startsWith("--") && argv[i - 1] !== "--mode");
  const root = resolve(positional[0] || resolveProjectRoot());

  let result;
  try {
    result = runGenerate({ mode, root });
  } catch (err) {
    usage(err.message);
    return;
  }

  const summary = { validator: "aidakit.generate-flow-commands", ok: result.ok, mode, root, footerVersion: result.footerVersion, results: result.results };
  process.stdout.write(JSON.stringify(summary) + "\n");

  if (result.ok) {
    process.stderr.write(`# generate-flow-commands\n\nOK — ${result.results.length} flow(s) processed (${mode} mode).\n\n`);
    for (const r of result.results) process.stderr.write(`- ${r.name}: ${r.action}${r.reason ? ` (${r.reason})` : ""}\n`);
  } else {
    const refused = result.results.filter((r) => r.action === "refused");
    process.stderr.write(`# generate-flow-commands\n\nFAIL — ${refused.length} refusal(s):\n\n`);
    for (const r of refused) process.stderr.write(`- ${r.name}: ${r.reason}\n`);
  }
  process.exit(result.ok ? 0 : 1);
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main();
}
