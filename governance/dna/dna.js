// aidakit executable DNA — the schema and the reading of PROVENANCE.
//
// Context (adapted GENESI concept): the kit already has ONE side of the DNA — validators
// and the hook run on their own, spend no tokens, the truth is the disk. The other is missing:
// today aidakit:learn records learning as TEXT that the AI re-reads and reinterprets
// every time. A "DNA" crystallizes that learning into an EXECUTABLE artifact (regression
// test or validator rule) that runs on its own.
//
// This module does NOT crystallize (that's learn) nor execute. It defines
// and READS the provenance metadata every DNA carries — which makes INVALIDATION
// possible: without knowing under WHAT premise a DNA was created, it never knows when
// it became obsolete (the "gene that becomes its own bug when the world changes").
//
// Pure Node, zero-dep (like the validators and hooks/pre-bash.js). No new state.

import { existsSync, readFileSync, readdirSync, statSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve, basename, dirname } from "node:path";
import { projectRoot } from "../engine/persistence.js";

// Where staged DNAs live before the dedicated PR: .aidakit/dna/<change-id>/.
// (the DNA PR promotes them from here to the definitive location).
export const DNA_DIR = ".aidakit/dna";

// DNA type vocabulary (mirrors the `action` of the aidakit:learn that generated it).
export const DNA_TYPES = ["regression-gate", "rule"];

// A DNA carries its provenance in a metadata block. For .js/.mjs artifacts
// (test/rule) the block is a header comment with `@dna-<field>: value` lines;
// this keeps the artifact executable WITHOUT an external parser dependency (zero-dep) and
// grep-readable, like the ID links in DOCS.md §2.4.
//
//   // @dna-origin-change: feature-appointment
//   // @dna-origin-premise: ADR-020
//   // @dna-type: regression-gate
//   // @dna-created-at: 2026-07-20
//   // @dna-trigger: ledger:errorType=agent-rework recurred 3x
const FIELD_RE = /@dna-([a-z-]+):\s*(.+?)\s*$/gm;

// Required fields of every DNA — without them invalidation has nothing to lean on.
export const REQUIRED_FIELDS = ["origin-change", "origin-premise", "type"];

/**
 * Reads the provenance of a DNA file. Returns { meta, missing } where `meta`
 * is the extracted field→value map and `missing` are the missing required fields.
 * @param {string} file
 * @returns {{file:string, meta:Record<string,string>, missing:string[], typeValid:boolean}}
 */
export function readDnaProvenance(file) {
  const content = readFileSync(file, "utf8");
  const meta = {};
  let m;
  FIELD_RE.lastIndex = 0;
  while ((m = FIELD_RE.exec(content)) !== null) meta[m[1]] = m[2];
  const missing = REQUIRED_FIELDS.filter((c) => !meta[c]);
  const typeValid = meta["type"] ? DNA_TYPES.includes(meta["type"]) : false;
  return { file, meta, missing, typeValid };
}

/**
 * Collects the DNA files under a path (dir → recursive; file → itself).
 * DNAs are the .js/.mjs files under .aidakit/dna/ (or passed directly).
 * @param {string} path
 * @returns {string[]}
 */
export function collectDna(path) {
  const out = [];
  const walk = (p) => {
    if (!existsSync(p)) return;
    const st = statSync(p);
    if (st.isDirectory()) {
      for (const name of readdirSync(p)) {
        if (name === "node_modules" || name.startsWith(".git")) continue;
        walk(join(p, name));
      }
    } else if (/\.(mjs|js)$/.test(basename(p))) {
      out.push(p);
    }
  };
  walk(resolve(path));
  return out;
}

/** kebab-case slug from free text (for a stable file name). */
function slugify(s) {
  return String(s)
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    .slice(0, 48) || "dna";
}

/** Builds the provenance header (// @dna-* comment) for a .js/.mjs artifact. */
function provenanceHeader(meta) {
  const lines = [
    ["origin-change", meta.originChange],
    ["origin-premise", meta.originPremise],
    ["type", meta.type],
    ["created-at", meta.createdAt],
    ["trigger", meta.trigger],
  ].filter(([, v]) => v != null && v !== "");
  return lines.map(([k, v]) => `// @dna-${k}: ${v}`).join("\n");
}

/**
 * Crystallizes a DNA into STAGING (.aidakit/dna/<change-id>/), with the provenance
 * header at the top. It does NOT apply — it only writes the candidate artifact; promotion is the
 * dedicated DNA PR (human merge). It's the "write" half that aidakit:learn calls
 * when it decides a learning is worth turning into something executable.
 *
 * `createdAt` is REQUIRED in the argument (the caller injects the date; this module does not
 * read the clock, so it stays deterministic and testable — same discipline as the engine).
 *
 * @param {{
 *   changeId:string, type:"regression-gate"|"rule", slug:string,
 *   originPremise:string, createdAt:string, trigger?:string, body:string
 * }} spec
 * @returns {string} absolute path of the written artifact.
 */
export function writeDna(spec) {
  const { changeId, type, slug, originPremise, createdAt, trigger, body } = spec;
  if (!changeId) throw new Error("writeDna: changeId required");
  if (!DNA_TYPES.includes(type)) throw new Error(`writeDna: invalid type "${type}" (use ${DNA_TYPES.join("|")})`);
  if (!originPremise) throw new Error("writeDna: originPremise required (otherwise invalidation has nothing to lean on)");
  if (!createdAt) throw new Error("writeDna: createdAt required (inject the date; the module does not read the clock)");

  // Extension by type: a regression test is .test.mjs (matches the __tests__ pattern);
  // a rule is a .js validator (exit 0/1/2 contract, same format as governance/validators/).
  const ext = type === "regression-gate" ? "test.mjs" : "js";
  const prefix = type === "regression-gate" ? "regression" : "rule";
  const name = `${prefix}-${slugify(slug)}.${ext}`;
  const dir = join(projectRoot(), DNA_DIR, changeId);
  const file = join(dir, name);

  const header = provenanceHeader({ originChange: changeId, originPremise, type, createdAt, trigger });
  const content = `${header}\n${body.startsWith("\n") ? body.slice(1) : body}${body.endsWith("\n") ? "" : "\n"}`;
  mkdirSync(dir, { recursive: true });
  writeFileSync(file, content, "utf8");
  return file;
}
