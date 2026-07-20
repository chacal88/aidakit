// ${...} interpolation used by the step executors to render command strings,
// prompts and agent input from the flow state.
// Ported 1:1 from recruit/.governance/orchestrator/steps/interpolate.ts (zero-dep).
//
// Supported expressions (resolved against the ExecutionContext):
//   ${inputs.<name>}             → state.inputs[name]
//   ${context.<path...>}         → state.context[path...]
//   ${item} / ${item.<path...>}  → loop variable (renamed via `as`)
//   ${flow_id}                   → state.flow_id
//
// Anything that does not resolve is left as-is; the caller detects it by the
// presence of a remaining `${`.

const EXPR_RE = /\$\{([^}]+)\}/g;

/**
 * @param {string} input
 * @param {import('./types.js').ExecutionContext} ctx
 * @returns {string}
 */
export function interpolateString(input, ctx) {
  return input.replace(EXPR_RE, (_, expr) => {
    const v = resolve(String(expr).trim(), ctx);
    return v === undefined ? `\${${expr}}` : String(v);
  });
}

/**
 * @param {unknown} value
 * @param {import('./types.js').ExecutionContext} ctx
 * @returns {unknown}
 */
export function interpolate(value, ctx) {
  if (typeof value === "string") return interpolateString(value, ctx);
  if (Array.isArray(value)) return value.map((v) => interpolate(v, ctx));
  if (value !== null && typeof value === "object") {
    /** @type {Object.<string,unknown>} */
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = interpolate(v, ctx);
    }
    return out;
  }
  return value;
}

/**
 * @param {string} expr
 * @param {import('./types.js').ExecutionContext} ctx
 * @returns {unknown}
 */
export function resolve(expr, ctx) {
  const parts = expr.split(".");
  const head = parts[0];
  if (head === undefined) return undefined;
  if (head === "inputs") return walk(ctx.state.inputs, parts.slice(1));
  if (head === "context") return walk(ctx.state.context, parts.slice(1));
  if (head === "flow_id") return ctx.state.flow_id;
  // Loop variables (default name "item", or whatever the loop step renamed via `as`).
  if (Object.prototype.hasOwnProperty.call(ctx.loopVars, head)) {
    return walk(ctx.loopVars[head], parts.slice(1));
  }
  return undefined;
}

/**
 * @param {unknown} start
 * @param {string[]} path
 * @returns {unknown}
 */
function walk(start, path) {
  let cursor = start;
  for (const p of path) {
    if (cursor === null || cursor === undefined) return undefined;
    if (typeof cursor !== "object") return undefined;
    cursor = /** @type {Object.<string,unknown>} */ (cursor)[p];
  }
  return cursor;
}
