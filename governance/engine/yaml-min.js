// Mini YAML parser (zero-dep) for the aidakit flows.
//
// Why it exists: the kit is installable without `npm install` (like the
// pre-bash.js hook). Adding the `yaml` dep would force every target project to
// install node_modules into the plugin folder — friction against "lightweight
// and optional". Node 22 has no native YAML.
//
// Supported scope (the subset the flows use):
//   - maps nested by indentation (2 spaces per level, consistent)
//   - lists with "- " (of scalars OR of maps)
//   - scalars: string, number, boolean, null
//   - quoted strings ("..." and '...') with basic escapes inside double quotes
//   - literal `|` and folded `>` blocks (with `-` chomping)
//   - comments with # (outside quotes) and blank lines
//   - document-start `---` (ignored)
//
// Does NOT support: anchors/aliases, tags, flow-style collections
// ({a: 1}, [1, 2]), multi-line keys. The aidakit flows don't need this; a
// flow-style value throws a clear error (with its line) instead of being
// silently mis-read as a string — write block lists ("- item") and block maps.
//
// KNOWN LIMITATIONS (write the flows within them):
//   - Indent with SPACES, never tabs (2 spaces per level is the convention).
//   - A list item with an inline map uses "- " (one space after the dash): "- id: a".
//     Wide spacing ("-   id: a") is not supported — use "- id: a".
//   - A value with a legitimate '#' (e.g. "fixes #42") is preserved; to add a
//     comment at the END of a value line, quote the value.

/**
 * @param {string} text
 * @returns {unknown}
 */
export function parse(text) {
  const rawLines = text.split(/\r?\n/);
  // Pre-process: strip full-line comments and blank lines, keeping indentation.
  // Literal blocks are handled in the main loop.
  const lines = [];
  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    if (line.trim() === "---") continue; // doc start
    lines.push({ raw: line, n: i + 1 });
  }
  const { value } = parseBlock(lines, 0, 0);
  return value;
}

function indentOf(s) {
  const m = /^(\s*)/.exec(s);
  return m ? m[1].length : 0;
}
function isBlank(s) {
  return s.trim() === "" || s.trim().startsWith("#");
}

/**
 * Parses a block starting at `start`, with minimum indentation `minIndent`.
 * Returns {value, next} where next is the index of the next unconsumed line.
 */
function parseBlock(lines, start, minIndent) {
  // Skip blank lines.
  let i = start;
  while (i < lines.length && isBlank(lines[i].raw)) i++;
  if (i >= lines.length) return { value: null, next: i };

  const first = lines[i].raw;
  const ind = indentOf(first);
  if (ind < minIndent) return { value: null, next: start };

  const isList = /^\s*-(\s|$)/.test(first);
  if (isList) return parseList(lines, i, ind);
  return parseMap(lines, i, ind);
}

function parseList(lines, start, indent) {
  const arr = [];
  let i = start;
  while (i < lines.length) {
    if (isBlank(lines[i].raw)) { i++; continue; }
    const ind = indentOf(lines[i].raw);
    if (ind < indent) break;
    if (ind > indent) throw yerr(lines[i], "unexpected indentation in list item");
    const m = /^(\s*)-(\s+(.*))?$/.exec(lines[i].raw);
    if (!m) break; // no longer a list item at this level
    const after = m[3];
    if (after === undefined || after.trim() === "") {
      // Item is a block nested on the following lines.
      const { value, next } = parseBlock(lines, i + 1, indent + 1);
      arr.push(value);
      i = next;
    } else if (/^[^:#]+:(\s|$)/.test(after) || after.includes(": ")) {
      // Item is an inline map on the same line as "-": "- key: value".
      // Rewrite the line as a map start with virtual indentation and parse the
      // map from here (including more-indented sibling lines).
      const childIndent = indent + 2;
      const rewritten = [{ raw: " ".repeat(childIndent) + after, n: lines[i].n }];
      let j = i + 1;
      while (j < lines.length && (isBlank(lines[j].raw) || indentOf(lines[j].raw) >= childIndent)) {
        rewritten.push(lines[j]);
        j++;
      }
      const { value } = parseMap(rewritten, 0, childIndent);
      arr.push(value);
      i = j;
    } else {
      arr.push(parseScalar(after.trim(), lines[i]));
      i++;
    }
  }
  return { value: arr, next: i };
}

function parseMap(lines, start, indent) {
  const obj = {};
  let i = start;
  while (i < lines.length) {
    if (isBlank(lines[i].raw)) { i++; continue; }
    const ind = indentOf(lines[i].raw);
    if (ind < indent) break;
    if (ind > indent) throw yerr(lines[i], "unexpected indentation in map");
    const line = lines[i].raw.slice(indent);
    if (line.startsWith("- ")) break; // it's a list, not a map
    const km = /^([^:]+):(\s(.*))?$/.exec(line);
    if (!km) throw yerr(lines[i], "invalid map line (expected 'key: value')");
    const key = km[1].trim();
    const rest = km[3];
    if (rest !== undefined && rest.trim() === "|" || rest !== undefined && /^\|-?$/.test(rest.trim()) || rest !== undefined && /^>-?$/.test(rest.trim())) {
      const { value, next } = parseBlockScalar(lines, i + 1, indent, rest.trim());
      obj[key] = value;
      i = next;
    } else if (rest === undefined || rest.trim() === "") {
      // Value is a nested block.
      const { value, next } = parseBlock(lines, i + 1, indent + 1);
      obj[key] = value;
      i = next;
    } else {
      obj[key] = parseScalar(rest.trim(), lines[i]);
      i++;
    }
  }
  return { value: obj, next: i };
}

function parseBlockScalar(lines, start, parentIndent, marker) {
  const fold = marker.startsWith(">");
  const chompStrip = marker.endsWith("-");
  const out = [];
  let i = start;
  let blockIndent = null;
  while (i < lines.length) {
    const raw = lines[i].raw;
    if (raw.trim() === "") { out.push(""); i++; continue; }
    const ind = indentOf(raw);
    if (ind <= parentIndent) break;
    if (blockIndent === null) blockIndent = ind;
    out.push(raw.slice(blockIndent));
    i++;
  }
  // Drop trailing blank lines for chomping.
  while (out.length && out[out.length - 1] === "") out.pop();
  let text = fold ? out.join(" ") : out.join("\n");
  if (!chompStrip) text += "\n";
  return { value: text, next: i };
}

function parseScalar(s, line) {
  if (s === "" ) return null;
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    const inner = s.slice(1, -1);
    if (s[0] === '"') return inner.replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    return inner;
  }
  // Flow-style collections ([a, b], {a: 1}) are out of scope (see the header).
  // Fail loudly instead of returning the literal "[a, b]" string — a silent
  // wrong value is worse than a clear error. Use block lists ("- a") / block
  // maps instead. A value that legitimately needs brackets must be quoted.
  if ((s.startsWith("[") && s.endsWith("]")) || (s.startsWith("{") && s.endsWith("}"))) {
    const err = "flow-style collections are not supported — use a block list (\"- item\") or block map, or quote the value if it is literal text";
    throw line ? yerr(line, err) : new Error(`yaml: ${err}`);
  }
  // We do NOT strip an inline " #" comment from unquoted values: flow prompts
  // and descriptions are free text and use legitimate '#' (markdown headers,
  // issue refs like #42). FULL-LINE comments are already handled by isBlank().
  // For a comment at the end of a value line, the author uses quotes.
  if (s === "true") return true;
  if (s === "false") return false;
  if (s === "null" || s === "~") return null;
  if (/^-?\d+$/.test(s)) return parseInt(s, 10);
  if (/^-?\d+\.\d+$/.test(s)) return parseFloat(s);
  return s;
}

function yerr(line, msg) {
  return new Error(`yaml: line ${line.n}: ${msg}`);
}
