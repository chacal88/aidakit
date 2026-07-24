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
