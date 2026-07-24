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
 * Shell-safe rendering of a `runs` command (ADR-005). Each resolvable ${expr}
 * is replaced by a bash variable reference ($AIDAKIT_VAR_n) and its value is
 * handed to the child through the environment — bash expands it at runtime as
 * DATA, never re-parsing it as shell syntax. A multiline or metacharacter-laden
 * value (e.g. a free-form ${inputs.request}) can therefore never break the
 * command structure or inject commands. Repeated expressions share one var.
 * Unresolved expressions are left as-is, exactly like interpolateString.
 *
 * Caveat (flows.md §3): an engine expression inside SINGLE quotes stops
 * expanding ('${x}' renders as the literal text $AIDAKIT_VAR_n) — interpolation
 * sites in commands must be bare or double-quoted, as the shipped flows are.
 * @param {string} input
 * @param {import('./types.js').ExecutionContext} ctx
 * @returns {{command:string, vars:Object.<string,string>}}
 */
export function interpolateCommand(input, ctx) {
  /** @type {Object.<string,string>} */
  const vars = {};
  /** @type {Map<string,string>} */
  const byExpr = new Map();
  let n = 0;
  const command = input.replace(EXPR_RE, (whole, expr) => {
    const key = String(expr).trim();
    const v = resolve(key, ctx);
    if (v === undefined) return whole;
    let name = byExpr.get(key);
    if (name === undefined) {
      name = `AIDAKIT_VAR_${n++}`;
      byExpr.set(key, name);
      vars[name] = String(v);
    }
    return `$${name}`;
  });
  return { command, vars };
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
