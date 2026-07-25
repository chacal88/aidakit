// Structured resume output — the channel that carries data (not just an
// outcome) from the operator-Claude back into the flow state (ADR-006).
//
// An `invoke` step may declare `outputs: {<outcome>: [key, ...]}` in the YAML.
// When the operator resumes with that outcome, the declared keys must arrive as
// `key=value` tokens after the outcome (CLI) / as `resumeOutput` (API), and are
// persisted into context[step.id] so downstream steps can interpolate
// ${context.<step>.<key>}. This closed the request-vs-change-id hole: the
// `select` step reports the resolved change-id as `change_id`, and task paths
// key on ${context.select.change_id} instead of the free-form ${inputs.request}.
//
// Values are constrained to SAFE SINGLE TOKENS because they are destined for
// interpolation into commands and paths: one line, no spaces, no shell
// metacharacters. Kebab-case ids, branch names and URLs all fit; free-form
// prose deliberately does not.

/** Keys must be plain identifiers (no leading underscore — keeps __proto__ and
 * friends out by construction; the denylist below is defense in depth). */
export const RESUME_OUTPUT_KEY_RE = /^[A-Za-z][A-Za-z0-9_]*$/;

/** Safe single token: covers change-ids, branch names, paths and URLs; forbids
 * whitespace, quotes, `$`, backticks and every other shell metacharacter. */
export const RESUME_OUTPUT_VALUE_RE = /^[A-Za-z0-9._:@/-]+$/;

/** Keys the engine owns in the context bag (or that would mutate the object
 * itself) — never writable from a resume. */
export const RESERVED_OUTPUT_KEYS = new Set([
  "outcome",
  "invoke_target",
  "__proto__",
  "constructor",
  "prototype",
]);

/**
 * Parses `key=value` tokens (the CLI resume args after the outcome) into a
 * resume output map. Throws on any malformed token — the CLI turns that into a
 * usage error BEFORE touching the persisted state, so a typo can't half-resume.
 * @param {string[]} tokens
 * @returns {Object.<string,string>}
 */
export function parseResumeOutput(tokens) {
  /** @type {Object.<string,string>} */
  const out = {};
  for (const tok of tokens) {
    const eq = tok.indexOf("=");
    if (eq <= 0) throw new Error(`invalid resume output "${tok}" (expected key=value)`);
    const k = tok.slice(0, eq);
    const v = tok.slice(eq + 1);
    if (!RESUME_OUTPUT_KEY_RE.test(k) || RESERVED_OUTPUT_KEYS.has(k)) {
      throw new Error(`invalid resume output key "${k}"`);
    }
    if (!RESUME_OUTPUT_VALUE_RE.test(v)) {
      throw new Error(`invalid resume output value for "${k}": must be a single safe token (${RESUME_OUTPUT_VALUE_RE.source})`);
    }
    out[k] = v;
  }
  return out;
}

// ── telemetry kwargs (ADR-013 §Decision-7/8 — additive, opt-in) ──────────
//
// `resume` additionally accepts `--<kwarg>=<value>` tokens carrying the
// parent dispatcher's own usage numbers for THIS dispatch (cache_read,
// cache_creation, output_tokens, wall-clock duration, whether the pack was
// rebuilt). They live in the SAME "safe single token" whitelist as the
// key=value structured outputs above: an integer for every counter, a
// `true|false` literal for `pack-rebuilt`. A malformed OR unrecognized `--`
// token is a usage error thrown BEFORE any state is touched — same
// fail-closed contract as parseResumeOutput.

/** CLI flag name → { field written into the telemetry record, value shape }. */
export const TELEMETRY_KWARG_SPECS = {
  "tokens-cache-read": { field: "cache_read", type: "int" },
  "tokens-cache-creation": { field: "cache_creation", type: "int" },
  "tokens-output": { field: "output_tokens", type: "int" },
  "duration-ms": { field: "duration_ms", type: "int" },
  "pack-rebuilt": { field: "pack_rebuilt", type: "bool" },
};

const TELEMETRY_INT_RE = /^\d+$/;
const TELEMETRY_BOOL_RE = /^(true|false)$/;

/**
 * Splits the resume CLI tokens into `{ telemetry, rest }`: every `--<kwarg>=<value>`
 * token declared in TELEMETRY_KWARG_SPECS is validated and moved into `telemetry`
 * (or throws on a malformed/unknown one); every other token is left in `rest`
 * for `parseResumeOutput`. `telemetry` is `undefined` when no telemetry kwarg
 * was supplied — the fully backward-compatible, zero-telemetry path.
 * @param {string[]} tokens
 * @returns {{telemetry: (Object.<string, number|boolean>|undefined), rest: string[]}}
 */
export function parseTelemetryKwargs(tokens) {
  /** @type {Object.<string, number|boolean>} */
  const telemetry = {};
  const rest = [];
  let sawAny = false;
  for (const tok of tokens) {
    if (!tok.startsWith("--")) { rest.push(tok); continue; }
    const eq = tok.indexOf("=");
    if (eq < 0) throw new Error(`invalid telemetry kwarg "${tok}" (expected --key=value)`);
    const key = tok.slice(2, eq);
    const value = tok.slice(eq + 1);
    const spec = TELEMETRY_KWARG_SPECS[key];
    if (!spec) throw new Error(`unknown resume kwarg "--${key}"`);
    if (spec.type === "int") {
      if (!TELEMETRY_INT_RE.test(value)) throw new Error(`invalid value for --${key}: expected a non-negative integer, got "${value}"`);
      telemetry[spec.field] = Number(value);
    } else {
      if (!TELEMETRY_BOOL_RE.test(value)) throw new Error(`invalid value for --${key}: expected true|false, got "${value}"`);
      telemetry[spec.field] = value === "true";
    }
    sawAny = true;
  }
  return { telemetry: sawAny ? telemetry : undefined, rest };
}
