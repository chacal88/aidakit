// evidence-section — resolves an `evidence.md#anchor` promise to the SECTION it
// names, and reads whether that section is still marked pending.
//
// WHY THIS MODULE EXISTS. `check-acceptance.js` used to verify an
// `evidence-section` criterion by stripping the `#anchor` and confirming the
// FILE existed. The file always exists — it holds every other criterion of the
// change — so the anchor was decorative and the gate answered about the wrong
// object. Reported from psim-kernel (2026-08-18): a change closed
// `OK — 10/10 acceptance criteria resolved. Gate cleared.` while the section the
// manifest pointed at said, in writing, `PENDENTE`, line by line, for both
// devices. It was the last gate before the PR, in a repo with `pr.auto_merge`
// enabled. The merge was stopped by a human reading the file, not by the gate.
//
// The bar this module raises is still static (no test is re-executed — ADR-010
// §Decision 2 stands): the section SHALL exist, and SHALL NOT be marked pending.
//
// Pure Node, zero-dep. No I/O — the caller reads the file and passes the text.

/** Fence delimiters that open/close a verbatim block (``` or ~~~, 3+). */
const FENCE = /^\s{0,3}(`{3,}|~{3,})/;

/** ATX heading: `### Title`. Setext headings are not used by the kit's artifacts. */
const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;

/**
 * GitHub's heading→anchor slug, reduced to what the kit's artifacts actually
 * use: inline code, emphasis and links are unwrapped, punctuation dropped,
 * spaces become hyphens. `### \`bench-proof-two-xpe\`` → `bench-proof-two-xpe`.
 */
export function slugifyHeading(text) {
  return String(text)
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[`*_~]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-");
}

/**
 * Splits markdown into lines tagged with whether they sit inside a fenced block.
 * Fence-awareness is not optional here: a captured terminal session pasted into
 * an evidence section routinely contains lines that LOOK like headings
 * (`### 1 — comando`), and reading one as a real heading would truncate the
 * section body — the gate would then judge a slice of the section, not the
 * section.
 */
function tagFences(markdown) {
  const out = [];
  let fence = null;
  for (const line of String(markdown).split("\n")) {
    const m = FENCE.exec(line);
    if (fence === null && m) {
      fence = m[1][0];
      out.push({ line, fenced: true });
      continue;
    }
    if (fence !== null && m && m[1][0] === fence) {
      fence = null;
      out.push({ line, fenced: true });
      continue;
    }
    out.push({ line, fenced: fence !== null });
  }
  return out;
}

/**
 * Finds the section a slug names and returns its body — the lines after the
 * heading, up to the next heading of the SAME OR HIGHER level (a deeper
 * subsection belongs to the section, so it is included and judged with it).
 * Returns null when no heading matches the slug.
 */
export function findSection(markdown, anchor) {
  const wanted = String(anchor).trim().toLowerCase();
  const lines = tagFences(markdown);
  let start = -1;
  let level = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].fenced) continue;
    const m = HEADING.exec(lines[i].line);
    if (!m) continue;
    if (start === -1) {
      if (slugifyHeading(m[2]) === wanted) {
        start = i;
        level = m[1].length;
      }
      continue;
    }
    if (m[1].length <= level) {
      return { heading: lines[start].line, lines: lines.slice(start + 1, i) };
    }
  }
  if (start === -1) return null;
  return { heading: lines[start].line, lines: lines.slice(start + 1) };
}

/** Words that declare an unfinished promise, in the artifacts' two languages. */
const PENDING_WORD = /\b(pendentes?|pending|todo|tbd)\b/i;
/** An unchecked task box — `- [ ]`, `* [ ]`, `+ [ ]`. */
const UNCHECKED_BOX = /^\s*[-*+]\s+\[\s\]\s*/;
/** Emphasis spans: **bold**, __bold__, *italic*, _italic_. */
const EMPHASIS = /\*\*([^*\n]+)\*\*|__([^_\n]+)__|\*([^*\n]+)\*|_([^_\n]+)_/g;

/**
 * Reads whether a section body still declares itself unfinished. Returns the
 * first marker found ({ marker, line }) or null.
 *
 * Three markers, all of them conventions the artifacts already use:
 *   1. an unchecked task box `- [ ]`;
 *   2. a pending word in ALL CAPS (`PENDENTE`, `PENDING`, `TODO`, `TBD`) —
 *      the caps ARE the marking;
 *   3. a pending word in any case inside emphasis (`**pendente**`), which is
 *      how a per-item status is written in a table or list.
 *
 * DECLARED LIMIT: fenced blocks are not scanned. They hold captured output —
 * a log line containing the word "pending" is the equipment talking, not the
 * author declaring a status. The price is that pendency hidden inside a code
 * fence is not seen; the alternative (scanning captures) would block sections
 * on the content of the very evidence they exist to hold.
 */
export function findPendingMarker(sectionLines) {
  for (const { line, fenced } of sectionLines) {
    if (fenced) continue;
    if (UNCHECKED_BOX.test(line)) return { marker: "unchecked-box", line: line.trim() };
    const caps = /\b(PENDENTES?|PENDING|TODO|TBD)\b/.exec(line);
    if (caps) return { marker: caps[1], line: line.trim() };
    EMPHASIS.lastIndex = 0;
    let m;
    while ((m = EMPHASIS.exec(line)) !== null) {
      const inner = m[1] ?? m[2] ?? m[3] ?? m[4] ?? "";
      const hit = PENDING_WORD.exec(inner);
      if (hit) return { marker: hit[1], line: line.trim() };
    }
  }
  return null;
}
