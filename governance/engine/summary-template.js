// Per-step narrative template renderer + cap (flow-step-summaries).
// Pure, zero-dep, no I/O — see docs/features/flow-step-summaries/design.md
// §Template rendering and §Cap enforcement for the full rationale.
//
// Substitution grammar: single-brace `{key}` — deliberately NOT the engine's
// existing `${…}` interpolation (interpolate.js), which resolves against a
// broader surface (inputs.*, other steps' context). A summary template is
// already scoped to ONE step's context[step.id] bag, so `{key}` stays
// unambiguous and reads like a one-line human-readable string.

const KEY_RE = /\{([A-Za-z_][A-Za-z0-9_]*)\}/g;

/** Maximum rendered length of a persisted summary entry (state.summaries[i].text). */
export const MAX_SUMMARY_CHARS = 200;

/**
 * Renders a `{key}`-substitution template against a flat bag of values.
 * Unset (undefined/null) keys render as a visible `<unset:key>` marker —
 * never throws, so a template typo is caught on the first run instead of
 * crashing the flow. Any value substituted is newline-collapsed so the
 * rendered text stays on one line ahead of the 200-char cap logic.
 *
 * @param {string} template        e.g. "resolved change_id={change_id}"
 * @param {Object.<string,unknown>} bag  the step's context[step.id] object
 * @returns {string}               the rendered text, with unset keys shown as <unset:key>
 */
export function renderSummary(template, bag) {
  return String(template).replace(KEY_RE, (_, key) => {
    const v = bag[key];
    if (v === undefined || v === null) return `<unset:${key}>`;
    return String(v).replace(/[\r\n]+/g, " ");
  });
}

/**
 * Graceful-truncates rendered text to MAX_SUMMARY_CHARS, collapsing any
 * newline to a space first (belt-and-braces: renderSummary already collapses
 * newlines in interpolated VALUES, but the literal template text itself — or
 * a caller that skips renderSummary — may still carry one). Truncation keeps
 * the ellipsis as the last character so state.summaries[i].text.length is
 * NEVER greater than MAX_SUMMARY_CHARS.
 *
 * @param {string} text
 * @returns {string}
 */
export function capSummary(text) {
  const single = String(text).replace(/[\r\n]+/g, " ");
  if (single.length <= MAX_SUMMARY_CHARS) return single;
  return single.slice(0, MAX_SUMMARY_CHARS - 1) + "…";
}
