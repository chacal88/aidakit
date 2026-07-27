// governance/commands/render-flow-command.js — the ONE template for every generated
// commands/flow-<name>.md (ADR-017; docs/features/per-flow-commands/design.md §3).
//
// Pure, no IO: renderFlowCommand(meta) -> string is a deterministic function of `meta` —
// the SAME meta always renders to the SAME bytes. That purity is the whole invariant the
// byte-drift test rests on: re-running the generator over the same flow YAML must produce
// exactly the committed command file, or the test fails.
//
// No per-flow special-casing lives here beyond the two YAML-derived switches
// (positionalKey, hasRegister — design.md §5-§6). Everything else (the narrative, the
// example, the verb list) is driven off `meta`, never off `meta.flowName === "..."`.

const GUARD =
  ': "${AIDAKIT_GOVERNANCE?agent-validator-paths: AIDAKIT_GOVERNANCE not set — SessionStart hook missing (see docs/guides/flows.md §6)}"';

// flow_id shape, single-sourced from governance/engine/persistence.js#newFlowId
// ("<name>-<YYMMDD>-<hex>"): a trailing "-<6 digits>-<1..6 hex>". Emitted VERBATIM into
// every generated command body (design.md §3.4) so any weakening of the rule trips the
// byte-drift test — never re-typed or paraphrased at the call site.
export const FLOW_ID_RE_SOURCE = "^[a-z][a-z0-9-]*-[0-9]{6}-[0-9a-f]{1,6}$";
export const FLOW_ID_RE = new RegExp(FLOW_ID_RE_SOURCE);

export const SENTINEL_PREFIX = "<!-- aidakit:generated ";

// Defense-in-depth guards (review round-3 SECOND SECURITY VETO, TYPE-CONFUSION bypass) —
// VALUE-duplicated from FLOW_NAME_RE/INPUT_NAME_RE in generate-flow-commands.js, never
// imported. This module is deliberately dependency-free ("pure, no IO" above) so it can be
// unit-tested/called directly; the generator refuses a non-conforming flow/input name
// BEFORE ever calling renderFlowCommand (generate-flow-commands.js's own FLOW_NAME_RE/
// INPUT_NAME_RE checks), so these are a LAST-LINE assertion, not the primary validation —
// they exist so the template itself can never emit an unvalidated value into a `cli.js` bash
// line, the sentinel comment, or the body prose — for EVERY interpolated field (flowName,
// positionalKey, sentinelSource, and every required input name) — even if renderFlowCommand
// is called directly, bypassing the generator entirely.
const FLOW_NAME_LIKE_RE = /^[a-z][a-z0-9-]*$/;
const INPUT_NAME_LIKE_RE = /^[a-z][a-z0-9_-]*$/;
// sentinelSource is the one NON-name field spliced UNESCAPED into output — into the
// `<!-- aidakit:generated ... source=<sentinelSource> -->` sentinel comment ONLY, never a bash
// line. Through the real pipeline it is always `toPosix(relative(root, sourcePath))`, a
// relative POSIX path to a `.yaml` flow file; this charset accepts exactly that shape and
// refuses anything that could break out of the comment (`-->`, `<!--`, whitespace, newlines).
// Worst case if reached is prose/markdown injection into agent-read text (the same tier as the
// unguarded `description`), never a bash reach — hence a path-safe charset, not the tighter
// slug the names use.
const SENTINEL_SOURCE_LIKE_RE = /^[A-Za-z0-9._/-]+$/;

/**
 * positionalKey = the first REQUIRED input's name — never a `flowName === "fast"` table
 * (design.md §5). `undefined` when the flow declares no required input (legal: the
 * template then emits a start form with no positional payload).
 *
 * Contract: by the time this is called through the normal `runGenerate` pipeline, the
 * chosen input's `name` is ALREADY a validated, conforming string — `generate-flow-
 * commands.js`'s `firstInvalidInputIndex()` fail-closed-refuses any flow carrying a
 * non-conforming input `name` (array/object/number/null) before `metaFrom`/this function is
 * ever reached (review round-3 TYPE-CONFUSION finding). This function itself performs no
 * type/charset check — it is a pure lookup — so `renderFlowCommand` carries its own
 * defense-in-depth THROW guard on `positionalKey` for the case where this value reaches it
 * by some other path (e.g. a hand-built `flow` object bypassing the generator entirely).
 * @param {{inputs?: Array<{name:string, required?: boolean}>}} flow
 * @returns {string|undefined}
 */
export function derivePositionalKey(flow) {
  const inputs = Array.isArray(flow?.inputs) ? flow.inputs : [];
  return inputs.find((i) => i && i.required === true)?.name;
}

/**
 * hasRegister = true iff the flow declares an input whose `values` enum contains
 * "register" (design.md §6) — data-driven, never a `flowName === "fast"` special case.
 * @param {{inputs?: Array<{values?: unknown}>}} flow
 * @returns {boolean}
 */
export function deriveHasRegister(flow) {
  const inputs = Array.isArray(flow?.inputs) ? flow.inputs : [];
  return inputs.some((i) => Array.isArray(i?.values) && i.values.includes("register"));
}

/** Extra required inputs beyond the positional one (design.md §5, the multi-required edge). */
function extraRequiredInputs(flow, positionalKey) {
  const inputs = Array.isArray(flow?.inputs) ? flow.inputs : [];
  return inputs.filter((i) => i && i.required === true && i.name !== positionalKey);
}

/** Double-quotes a YAML scalar safely, regardless of embedded ":" / '"' / "\\". */
function yamlQuote(s) {
  return `"${String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

const cliCall = (cmd) => `${GUARD}; node "$AIDAKIT_GOVERNANCE/cli.js" ${cmd}`;

/**
 * @param {{
 *   flowName: string,
 *   description: string,
 *   inputs?: Array<{name:string, required?:boolean, values?: unknown[]}>,
 *   positionalKey?: string,
 *   hasRegister: boolean,
 *   sentinelSource: string,
 *   footerVersion: string,
 * }} meta
 * @returns {string}
 */
export function renderFlowCommand(meta) {
  const { flowName, description, inputs = [], positionalKey, hasRegister, sentinelSource, footerVersion } = meta;

  // Fail-closed, TYPE first then charset (review round-3): `flowName` is spliced unescaped
  // into the sentinel comment AND every `cli.js` bash line below; `positionalKey` (when
  // present) is spliced unescaped into the SAME bash lines
  // (`start <flow> <key>="$ARGUMENTS"`); `sentinelSource` is spliced unescaped into the
  // sentinel comment (comment surface only, never a bash line). THROW instead of silently
  // interpolating — see the FLOW_NAME_LIKE_RE/INPUT_NAME_LIKE_RE/SENTINEL_SOURCE_LIKE_RE
  // comment above for why this duplicates rather than imports the generator's charset.
  if (typeof flowName !== "string" || !FLOW_NAME_LIKE_RE.test(flowName)) {
    throw new Error(
      `renderFlowCommand: flowName must be a string matching ${FLOW_NAME_LIKE_RE} (got ${JSON.stringify(flowName)}) — refusing to interpolate an unvalidated value into a bash line/sentinel`,
    );
  }
  if (positionalKey !== undefined && !(typeof positionalKey === "string" && INPUT_NAME_LIKE_RE.test(positionalKey))) {
    throw new Error(
      `renderFlowCommand: positionalKey must be undefined or a string matching ${INPUT_NAME_LIKE_RE} (got ${JSON.stringify(positionalKey)}) — refusing to interpolate an unvalidated value into a bash line`,
    );
  }
  if (typeof sentinelSource !== "string" || !SENTINEL_SOURCE_LIKE_RE.test(sentinelSource)) {
    throw new Error(
      `renderFlowCommand: sentinelSource must be a string matching ${SENTINEL_SOURCE_LIKE_RE} (got ${JSON.stringify(sentinelSource)}) — refusing to interpolate an unvalidated value into the sentinel comment`,
    );
  }

  const firstLine = String(description ?? "").split(/\r?\n/)[0].trim();
  const frontmatterDescription = yamlQuote(`Flow orchestrator — ${firstLine}`);

  const extraRequired = extraRequiredInputs({ inputs }, positionalKey);
  // Same fail-closed posture for the one remaining interpolated surface: every extra-required
  // input `name` is spliced backtick-wrapped into the body-prose note below. TYPE first, then
  // charset — a non-conforming name can never reach agent-read prose even on a direct call
  // (through the real pipeline `firstInvalidInputIndex` already refuses these upstream).
  const badExtra = extraRequired.find((i) => !(typeof i.name === "string" && INPUT_NAME_LIKE_RE.test(i.name)));
  if (badExtra) {
    throw new Error(
      `renderFlowCommand: required input name must be a string matching ${INPUT_NAME_LIKE_RE} (got ${JSON.stringify(badExtra.name)}) — refusing to interpolate an unvalidated value into the command body`,
    );
  }
  const extraRequiredNote =
    extraRequired.length > 0
      ? ` Also requires, as explicit \`key=value\` tokens after the implicit payload: ${extraRequired.map((i) => `\`${i.name}\``).join(", ")}.`
      : "";

  const freeformToken = positionalKey ? `<free-form ${positionalKey}>` : "(none — this flow takes no free-form request)";
  const example1 = positionalKey ? `/aidakit:flow-${flowName} <${positionalKey}>` : `/aidakit:flow-${flowName}`;

  const reservedVerbs = ["resume", "status", "abort", "list", ...(hasRegister ? ["register"] : [])]
    .map((v) => `\`${v}\``)
    .join(", ");

  const expectedInputs = [
    `${freeformToken} (implicit — no verb needed)`,
    "`resume <flow_id> <outcome> [key=value ...]`",
    "`status <flow_id>`",
    "`abort <flow_id>`",
    "`list`",
    ...(hasRegister ? [`\`register "<free-form request>"\``] : []),
  ].join(" · ");

  const startCommand = positionalKey ? `start ${flowName} ${positionalKey}="$ARGUMENTS"` : `start ${flowName}`;
  const startBulletLabel = positionalKey ? freeformToken : "(implicit start, no verb needed)";
  const startBulletNote = positionalKey
    ? `starts the \`${flowName}\` flow with the bare \`$ARGUMENTS\` as \`${positionalKey}\`.${extraRequiredNote}`
    : `starts the \`${flowName}\` flow; it takes no free-form request.${extraRequiredNote}`;

  const registerBlock = hasRegister
    ? [
        "",
        '**`register "<free-form request>"`** — defer the request as a debit, no plan/implement now. For "just remember this for later" instead of building it now:',
        "",
        '1. **Pre-check for an already-parked flow**: scan `.aidakit/flows/state/*.json` for a `paused` flow whose `pause.step_id === "parked"` and whose `inputs.request` already names the same change. If found, resume it instead of double-parking — report its `flow_id` and stop.',
        "2. **Dispatch `aidakit:roadmap` in `register` mode** on the free-form request — it mints the kebab-case change-id, refuses a collision (asks you if the id or `docs/features/<id>/` already exists), writes the feature line + acceptance sub-bullet, and regenerates `ROADMAP.md`. Obtain the minted change-id back.",
        `3. **Start the flow in register mode, keyed to the minted id — never the raw sentence**: \`${cliCall(`start ${flowName} request=<change-id> mode=register`)}\`. The flow parks at a named human_gate (\`pause.step_id: "parked"\`) without dispatching \`select\`/\`plan\`/\`implement\` — \`check_registered\` mechanically refuses to park anything the roadmap doesn't declare.`,
        "4. **Report** the `flow_id` and the change-id, and stop.",
        "",
        `**Resuming a parked debit:** \`${cliCall("resume <flow_id> plan")}\` continues into planning (the flow proceeds into \`select\`, with the roadmap's feature line + acceptance sub-bullet as context — no re-explanation needed); \`${cliCall("resume <flow_id> discard")}\` aborts the parked flow (the roadmap entry stays declared, at \`backlog\`).`,
        "",
        "**Boundary — when NOT to use `register`:** a request too rich to fit a feature line + a one-line acceptance sub-bullet is not a debit — start the flow directly with the bare request (or `aidakit:roadmap from` for a bigger backlog), don't park it.",
      ].join("\n")
    : "";

  const lines = [
    "---",
    `description: ${frontmatterDescription}`,
    "---",
    `${SENTINEL_PREFIX}flow=${flowName} template=${footerVersion} source=${sentinelSource} -->`,
    // The refuse-on-empty guard only makes sense when the flow has a required positional
    // payload (design.md §5). A flow with no required input has a legal empty-`$ARGUMENTS`
    // start (design.md §5's "not a refusal — a legal flow") — demanding a non-empty
    // `$ARGUMENTS` there would contradict that and silently swallow a genuine bare start.
    ...(positionalKey ? ["First, inspect `$ARGUMENTS`. If it is empty, do NOT guess or proceed — print the Usage block verbatim and stop."] : []),
    "",
    "## Usage",
    `**This is a flow orchestrator command.** It drives the \`${flowName}\` flow via the engine (\`node "$AIDAKIT_GOVERNANCE/cli.js"\`).`,
    "",
    `**Expected inputs:** ${expectedInputs}`,
    "",
    `**Reserved verbs:** ${reservedVerbs}. Anything else — including a bare free-form request — is read as the start payload (see "Implicit start" below).`,
    "",
    "**Examples (copy-paste):**",
    `- \`${example1}\``,
    `- \`/aidakit:flow-${flowName} status <flow_id>\``,
    "",
    `Human interface to the \`${flowName}\` flow (the engine in \`governance/\`, which does NOT get renamed). Translate the user's request into the engine's CLI and run it via Bash. **Every command below is self-guarding**: each one chains the fail-closed check (\`${GUARD}\`) ahead of the \`node\` call, so running any single bullet in isolation — not just the first one in a session — still fails loud if the \`SessionStart\` hook (see [ADR-012](../docs/decisions/ADR-012-aidakit-governance-session-wide.md), \`docs/guides/flows.md\` §6) is missing or broken, instead of a silent relative-path fallback.`,
    "",
    "## What this flow does",
    "",
    String(description ?? "").replace(/\s+$/, ""),
    "",
    "## Implicit start — the default verb",
    "",
    "Bare `$ARGUMENTS` starts the flow directly — no `start`/`<flow>`/`<key>=` typed — UNLESS it matches one of the reserved verbs below, checked in this exact order:",
    "",
    `1. **\`resume\` / \`status\` / \`abort\`** — recognized only when the 1st token is exactly that verb AND the 2nd token is flow_id-shaped: it matches \`${FLOW_ID_RE_SOURCE}\` (e.g. \`full-260727-ec4472\`). If the 2nd token is absent or doesn't match, the WHOLE \`$ARGUMENTS\` falls through to start.`,
    "2. **`list`** — recognized only when `$ARGUMENTS` is EXACTLY the sole token `list` (nothing after it). `list all invoices` is NOT the list verb — it starts a flow with that payload.",
    ...(hasRegister
      ? ["3. **`register`** — recognized when the 1st token is exactly `register`; the REST of `$ARGUMENTS` is the free-form request (register takes free-form text, not a flow_id)."]
      : []),
    `${hasRegister ? "4" : "3"}. **Otherwise** — the ENTIRE \`$ARGUMENTS\` is the start payload.`,
    "",
    `**Inversion of control:** when the flow pauses on an \`invoke\` step, the CLI prints the dispatch (which skill/subagent to run). Run it (via the named \`aidakit:*\` skill/agent), obtain the outcome, and resume with \`resume\`. When it pauses on a \`human_gate\`/\`human_handoff\`, present the prompt to the user and wait for their answer before resuming. Never invent an outcome — an invalid outcome re-pauses the gate.`,
    "",
    `- ${startBulletLabel} → \`${cliCall(startCommand)}\` (${startBulletNote})`,
    `- \`resume <flow_id> <outcome> [key=value ...]\` → \`${cliCall("resume <flow_id> <outcome> [key=value ...]")}\` (resumes a paused flow; the \`key=value\` tokens carry the step's declared structured outputs when the paused step requires them)`,
    `- \`status <flow_id>\` → \`${cliCall("status <flow_id>")}\``,
    `- \`abort <flow_id>\` → \`${cliCall("abort <flow_id>")}\``,
    `- \`list\` → \`${cliCall("list")}\` (available flows: the plugin defaults + those in the repo's \`.aidakit/flows/\`)`,
    registerBlock,
    "",
    "Full guide: `docs/guides/flows.md`. Engine source of truth: `governance/README.md`. Authority and gates doctrine: `GOVERNANCE.md` at the plugin root.",
    "",
    "User request: $ARGUMENTS",
    "",
    `<!-- aidakit v${footerVersion} — flow-${flowName}: generated per-flow command (governance/commands/generate-flow-commands.js, ADR-017) -->`,
  ];

  return lines.filter((l, i) => !(l === "" && lines[i - 1] === "")).join("\n") + "\n";
}
