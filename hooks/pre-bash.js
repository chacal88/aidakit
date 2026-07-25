#!/usr/bin/env node
/**
 * aidakit — PreToolUse/Bash hook (execution governance, GOVERNANCE.md §4)
 * Blocks destructive git/shell commands. Philosophy: when in doubt, allow.
 * Conscious bypass: prefix the command with AIDAKIT_BYPASS=1 — the bypass is
 * logged to .claude/.cache/aidakit-bypass.log for retroactive review.
 * Contract: exit 0 = allow; exit 2 = block (message on stderr). Fail-open.
 *
 * EXCEPTION — the `gh pr merge` rule (ADR-008): a project may opt in to
 * autonomous merge via `pr.auto_merge: true`, ALREADY COMMITTED on the repo's
 * trusted base branch (governance/pr/pr-config.js — never the working
 * tree, so a PR can't grant itself the opt-in via its own diff). This ONE
 * rule is FAIL-CLOSED — the deliberate inverse of this hook's general
 * fail-open default: it permits ONLY a recognized-safe literal `gh pr merge
 * <safe-args>` shape (real shell tokenization, then an allowlist — see
 * analyzeMergeCommand below), and blocks forbidden flags (--admin/
 * --admin=.../--no-verify) AND any ambiguous/unrecognized/obfuscated shell
 * construct (ADR-008 §Decision 4 enumerates the hardened classes: quoting/
 * escaping, brace grouping, reserved words, a command-wrapper prefix before
 * the invocation (round 4: `command`/`env`/`builtin`/`exec`/`nice`/`nohup`/
 * `command -p`/...), eval/sh -c/bash -c with the payload INLINE in the
 * visible command text, and variable/command-substitution indirection that
 * obfuscates "gh" itself). That forbidden-flag/ambiguity check is NOT the
 * AIDAKIT_BYPASS path either — it runs BEFORE the bypass check and a bypass
 * can never rescue it (round-2 fix; see analyzeMergeCommand).
 *
 * HONEST LIMIT (owner-accepted residual, ADR-008 §Consequences — round 3,
 * expanded round 4, do not overclaim): this is a guardrail against honest/
 * accidental misuse, NOT a security boundary against a hostile actor. A
 * pre-bash hook cannot sandbox a malicious or prompt-injected in-process
 * agent — such an agent can always obfuscate shell beyond this parser's
 * understanding, skip `gh` entirely and call the host's merge API directly,
 * or hide the payload INSIDE A FILE/STDIN that this hook never reads
 * (`source ./evil.sh`, `. ./evil.sh`, `bash ./evil.sh`, `sh < evil.sh` — the
 * outer command text carries no "gh"/"merge" substring at all when the
 * payload lives in the sourced file, so the trigger never even fires; this
 * hook does NOT claim to catch these, and inspecting file/stdin contents
 * would mean blocking all script execution, which is not this hook's job).
 * Every one of these is a pre-existing property shared by every rule in this
 * file; none is specific to this one carve-out. The PRIMARY controls against
 * a hostile actor are (a) the aidakit:merge skill's own discipline (only
 * ever invokes a plain `gh pr merge`, never a forbidden flag) and (b) the
 * base-branch opt-in itself (governance/pr/pr-config.js) — this hook is
 * defense-in-depth on top of those, not the security boundary.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const RULES = [
  {
    re: /git\s+push\b[^|;&]*?(?:--force(?!-with-lease)\b|\s-f\b)/,
    msg: 'git push --force/-f is forbidden (use --force-with-lease off main, or ask the human).',
  },
  {
    re: /git\s+push\b[^|;&]*--force-with-lease[^|;&]*\s(?:origin\s+)?(?:main|master)\b/,
    msg: 'force-push to main/master is forbidden even with --force-with-lease.',
  },
  {
    re: /git\s+commit\b[^|;&]*(?:--no-verify\b|\s-n\b)/,
    msg: 'git commit --no-verify is forbidden. Hook failed? Fix it and make a NEW COMMIT (never --amend after a failure).',
  },
  {
    re: /git\s+add\s+(?:-A\b|--all\b|\.(?:\s|$))/,
    msg: 'git add -A/--all/. is forbidden — staging is always nominal, file by file.',
  },
  {
    re: /git\s+reset\s+--hard\b/,
    msg: 'git reset --hard discards work. If the human explicitly asked for it, use the bypass.',
  },
  {
    re: /git\s+clean\s+-[a-zA-Z]*f/,
    msg: 'git clean -f deletes untracked files. If the human explicitly asked for it, use the bypass.',
  },
  {
    re: /git\s+branch\s+-D\b/,
    msg: 'git branch -D force-deletes an unmerged branch. Use -d, or bypass with the human\'s explicit request.',
  },
  {
    re: /git\s+checkout\s+--\s+\./,
    msg: 'git checkout -- . discards all local changes. If the human explicitly asked for it, use the bypass.',
  },
  {
    // Round-3 fix: the trigger is a PREDICATE (isSubjectToMergeRule, defined
    // below — hoisted, safe to reference here), not a fixed "gh pr merge"
    // adjacency regex — see isSubjectToMergeRule's doc comment for why.
    test: (command) => isSubjectToMergeRule(command),
    msg: 'Merging a PR is NEVER the agent\'s job by default (GOVERNANCE.md §1, rule 1). ' +
      'Opt-in exception: a project declaring pr.auto_merge: true, ALREADY COMMITTED on its base branch ' +
      '(ADR-008), may allow it — never with --admin/--admin=true/--no-verify, which stay blocked regardless. ' +
      'Otherwise: deliver the PR URL and stop — the human merges.',
    mergeCarveOut: true,
  },
  {
    re: /rm\s+-[a-zA-Z]*r[a-zA-Z]*f[a-zA-Z]*\s+(?:\/|~\/?|\$HOME)(?:\s|$)/,
    msg: 'rm -rf on a root/home path is forbidden, no bypass.',
    noBypass: true,
  },
];

function readStdin() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

// ── gh-pr-merge carve-out: real shell tokenization + an ALLOWLIST ──────────
// (round-2 fix — security veto: a raw-string substring scan for --admin/
// --no-verify is defeated by quote-splicing (`--adm''in`) or a bare backslash
// escape (`--adm\in`): bash collapses both to the literal token `--admin`
// before `gh` ever sees it, but the OLD raw-string regex never did that
// collapsing, so it never matched. Fix: tokenize with real shell-word
// semantics first, THEN compare fully-resolved tokens against an allowlist of
// safe `gh pr merge` shapes — never a blocklist substring match on raw text.)

/**
 * Minimal, deliberately narrow shell-word tokenizer. Splits `command` into
 * top-level SIMPLE COMMANDS (boundaries: unquoted `;` `&` `|` `&&` `||` and
 * newlines) and resolves each word's real shell value — single/double quotes
 * and backslash escapes collapse exactly like a real shell would, so
 * `--adm''in` and `--adm\in` both become the ONE token `--admin` before any
 * flag comparison happens.
 *
 * Deliberately conservative: any construct this doesn't fully reason about —
 * variable expansion (`$...`), command/process substitution (`$(...)`,
 * `` `...` ``, `<(...)`), subshells/brace groups (`(...)`, `{...}`),
 * INPUT redirection (`<`), or an unterminated quote/escape — marks the WHOLE
 * parse `ambiguous`. The caller fail-closes on `ambiguous` (never guesses
 * what an obfuscated or dynamic command might resolve to at runtime — this is
 * also how a statically-visible variable indirection like `gh pr merge
 * $FLAG`, or an obfuscated `gh` itself like `$(echo gh) pr merge --admin` or
 * `` `echo gh` pr merge --admin ``, get blocked: `$`/`` ` `` make the whole
 * command ambiguous, so it never reaches the allowlist check at all).
 *
 * A CLEAN tokenization is still not the whole story — see
 * hasSemanticAmbiguity below for the word-level checks (reserved words,
 * eval/sh -c/bash -c with an INLINE payload) this character-level pass can't
 * see. `source`/`.` are deliberately NOT among those checks — see this
 * file's header for why (they take a filename, not inline text; see the
 * honest residual disclosure there).
 *
 * Round-6 fix (false-block, reproduced live): OUTPUT redirection (`>`, `>>`,
 * `>|`, `N>`, `N>&M`, `&>`) is PARSED as structure and dropped, no longer
 * treated as ambiguity. Rationale — an output redirection is plumbing, not
 * content: it cannot change a single byte of what the program receives in
 * argv or on stdin, so it carries none of the argument-injection risk that
 * makes `$(...)`/eval/xargs ambiguous. Treating it as ambiguity false-blocked
 * the kit's OWN documented read-only mergeability query (`gh pr view --json
 * mergeable,mergeStateStatus,... 2>&1`, skills/merge/SKILL.md §Process step
 * 2): the JSON FIELD NAMES `mergeable`/`mergeStateStatus` satisfy the
 * deliberately broad gh+merge trigger (isSubjectToMergeRule), and the
 * redirect then killed the parse before `mergeInvocationFound: false` could
 * let the read-only command through. Dropping the operator and its target
 * word neither hides nor introduces an invocation — `gh pr merge --admin
 * 2>/dev/null` still tokenizes to the `--admin` the allowlist rejects (locked
 * by the round-6 tests). INPUT redirection (`<`) deliberately STAYS
 * ambiguous: it feeds external content INTO the command, the same
 * stdin-injection class as the round-5 xargs bypass.
 * @param {string} command
 * @returns {{commands: string[][], ambiguous: boolean}}
 */
function splitShellCommands(command) {
  const commands = [];
  let tokens = [];
  let word = '';
  let wordStarted = false;
  let ambiguous = false;
  let pendingRedirectTarget = false; // the next word is a redirection target, not an argument

  const flushWord = () => {
    if (wordStarted) {
      // A word consumed as an output-redirection TARGET (`> out`, the `1` of
      // `2>&1`) is filesystem/fd plumbing, never an argument to the program.
      if (pendingRedirectTarget) pendingRedirectTarget = false;
      else tokens.push(word);
      word = '';
      wordStarted = false;
    }
  };
  const flushCommand = () => {
    flushWord();
    // A redirection with no target (`gh pr merge >`) is a syntax error we
    // refuse to guess about — fail-closed, like any other unparseable input.
    if (pendingRedirectTarget) { ambiguous = true; return; }
    if (tokens.length) commands.push(tokens);
    tokens = [];
  };
  /** Consumes an output-redirection operator whose first char is at `i` and
   * arms the next word to be discarded as its target. */
  const startOutputRedirect = () => {
    // `2>&1`: an all-digit word immediately before `>` is the operator's fd
    // prefix, not an argument (POSIX shell word rules).
    if (wordStarted && /^[0-9]+$/.test(word)) { word = ''; wordStarted = false; }
    flushWord();
    i++; // the `>` itself
    if (command[i] === '>' || command[i] === '|' || command[i] === '&') i++; // `>>`, `>|`, `>&`
    pendingRedirectTarget = true;
  };

  let i = 0;
  const n = command.length;
  while (i < n && !ambiguous) {
    const c = command[i];

    if (c === "'") {
      wordStarted = true;
      let j = i + 1;
      let closed = false;
      while (j < n) {
        if (command[j] === "'") { closed = true; break; }
        word += command[j];
        j++;
      }
      if (!closed) { ambiguous = true; break; }
      i = j + 1;
      continue;
    }

    if (c === '"') {
      wordStarted = true;
      let j = i + 1;
      let closed = false;
      while (j < n) {
        const cj = command[j];
        if (cj === '"') { closed = true; break; }
        if (cj === '$' || cj === '`') { ambiguous = true; break; }
        if (cj === '\\' && j + 1 < n && /["\\$`]/.test(command[j + 1])) {
          word += command[j + 1];
          j += 2;
          continue;
        }
        word += cj;
        j++;
      }
      if (ambiguous) break;
      if (!closed) { ambiguous = true; break; }
      i = j + 1;
      continue;
    }

    if (c === '\\') {
      if (i + 1 >= n) { ambiguous = true; break; } // trailing backslash, nothing to escape
      wordStarted = true;
      word += command[i + 1];
      i += 2;
      continue;
    }

    // Output redirection is structure, not ambiguity — see the doc comment
    // above. `<` is NOT here: input redirection stays ambiguous below.
    if (c === '>') { startOutputRedirect(); continue; }

    if (c === '$' || c === '`' || c === '(' || c === ')' || c === '<' || c === '{' || c === '}') {
      ambiguous = true;
      break;
    }

    if (c === ';' || c === '\n') { flushCommand(); i++; continue; }
    if (c === '&') {
      if (command[i + 1] === '&') { flushCommand(); i += 2; continue; }
      // `&>` / `&>>` — both streams to a file; still pure output plumbing.
      if (command[i + 1] === '>') { flushWord(); i++; startOutputRedirect(); continue; }
      flushCommand(); i++; continue; // background operator — also a command boundary
    }
    if (c === '|') {
      if (command[i + 1] === '|') { flushCommand(); i += 2; continue; }
      flushCommand(); i++; continue; // pipe — also a command boundary
    }
    if (c === ' ' || c === '\t') { flushWord(); i++; continue; }

    wordStarted = true;
    word += c;
    i++;
  }

  if (!ambiguous) flushCommand();
  return { commands, ambiguous };
}

// Allowlist of `gh pr merge` argument shapes considered SAFE under the
// opt-in: the merge-method flags the aidakit:merge skill actually uses, plus
// at most one positional target (PR number / URL / branch-ish token, never
// starting with `-`). Anything else — --admin, --admin=..., --no-verify,
// --body, an unrecognized flag, a second positional, an empty/unresolved
// token — is REJECTED. Allowlist, not a blocklist: unrecognized is unsafe by
// default, never "assume fine". (`gh pr merge` has no `--force` flag — it is
// not part of this allowlist or of the forbidden-flag examples above.)
const SAFE_MERGE_FLAG_RE = /^--(merge|squash|rebase|delete-branch|auto)$/;
const SAFE_MERGE_TARGET_RE = /^[A-Za-z0-9][A-Za-z0-9._/:-]*$/;

/** @param {string[]} args — the tokens AFTER "gh" "pr" "merge" @returns {boolean} */
function isSafeGhPrMergeArgs(args) {
  let targetSeen = false;
  for (const tok of args) {
    if (SAFE_MERGE_FLAG_RE.test(tok)) continue;
    if (!targetSeen && SAFE_MERGE_TARGET_RE.test(tok)) { targetSeen = true; continue; }
    return false;
  }
  return true;
}

// A simple command may be prefixed by one or more `NAME=value` shell
// assignments (e.g. `AIDAKIT_BYPASS=1 gh pr merge --admin` — the same shape
// this hook's OWN bypass syntax uses): those set env vars for that one
// invocation and are not the program name. Strip them before looking for
// "gh"/"pr"/"merge" — otherwise a leading assignment hides the invocation
// from isGhPrMergeInvocation entirely, and `--admin` slips through unseen
// (round-2 regression caught by the AIDAKIT_BYPASS test cases below).
const ENV_ASSIGNMENT_RE = /^[A-Za-z_][A-Za-z0-9_]*=/;
function stripLeadingAssignments(tokens) {
  let i = 0;
  while (i < tokens.length && ENV_ASSIGNMENT_RE.test(tokens[i])) i++;
  return tokens.slice(i);
}

// Round-4 fix (security regression): a benign leading command WRAPPER
// (`command`, `env`, `builtin`, `exec`, `nice`, `nohup`, `command -p`, ...)
// still actually runs `gh pr merge` — it just moves it off tokens[0]. Round
// 3's positional check (tokens[0..2] only) missed this: `command gh pr merge
// --admin` reported "no invocation found" and sailed through, a real
// regression against the OLD raw-substring rule (which matched anywhere in
// the text and DID block these). Fix: scan for the `gh` binary ANYWHERE in
// the token list — works for any wrapper without enumerating them.
//
// Round-5 fixes (security veto — three PLAIN-TEXT, non-obfuscated bypasses
// confirmed live against the real gh binary; the round-4 detector simply
// didn't understand real gh CLI grammar):
//   Fix 1 — a PATH-QUALIFIED gh binary (`/opt/homebrew/bin/gh`, `./gh`,
//     `bin/gh`) is still genuinely `gh`; matching the literal token `'gh'`
//     missed all of these. Fixed: match the token's BASENAME (path.posix.
//     basename, POSIX shell semantics regardless of host OS), not the raw
//     token string.
//   Fix 2 — a documented, standard gh GLOBAL FLAG before the subcommand
//     (`gh -R owner/repo pr merge --admin`, `gh --repo owner/repo pr merge
//     --admin`) puts a token between `gh` and `pr`, defeating a strict
//     three-consecutive-token match. This is normal gh usage, not
//     obfuscation. Fixed: after locating the `gh` token, the pr+merge pair
//     is looked for ANYWHERE after it in the same simple command (not
//     necessarily adjacent to `gh`) — deliberately not replicating gh's full
//     flag grammar (which flags take a value, fragile to keep in sync);
//     `pr` and `merge` THEMSELVES stay strictly adjacent, which is specific
//     enough that unrelated gh usage does not produce that exact two-word
//     sequence by accident (confirmed against 5 innocent-mention regression
//     cases — see the test suite).
// A quoted mention like `echo "run gh pr merge"` never matches either fix:
// the quoted text collapses to ONE token (see splitShellCommands), never
// separate tokens at all, so innocent mentions are unaffected.
/** @param {string} tok @returns {string} the POSIX basename of `tok` (shell
 * commands are always POSIX, regardless of the host OS this hook runs on). */
function ghTokenBasename(tok) {
  return path.posix.basename(tok);
}

/** @param {string[]} tokens @returns {string[]|null} the args right after a
 * `gh` binary token (by basename, anywhere in `tokens`) followed later by
 * the adjacent `pr`/`merge` subcommand pair, or null if none is found. */
function findGhPrMergeArgs(tokens) {
  for (let i = 0; i < tokens.length; i++) {
    if (ghTokenBasename(tokens[i]) !== 'gh') continue;
    for (let j = i + 1; j + 1 < tokens.length; j++) {
      if (tokens[j] === 'pr' && tokens[j + 1] === 'merge') {
        return tokens.slice(j + 2);
      }
    }
  }
  return null;
}

// Round-3 fix (security veto, live-demonstrated bypasses): a CLEAN
// character-level tokenization is not enough — a simple command can still
// hide/reinterpret its real content via shell reserved words (control-flow
// keywords split a command's positional shape: `if true; then gh pr merge
// --admin; fi` puts "gh" at tokens[1], never tokens[0], so a naive positional
// check misses it) or a leading command that RE-PARSES its own argument as
// shell (`eval 'gh pr merge --admin'`, `sh -c '...'`, `bash -c '...'`) — any
// of these could hide an arbitrary `gh pr merge --admin` we have no way to
// see into. Any occurrence, anywhere in the parsed command set, marks the
// WHOLE analysis ambiguous.
//
// Round-4 honesty fix (quality + tester finding): `source`/`.` were DROPPED
// from this set — they don't actually provide the protection the round-3
// docs implied. `source`/`.` take a FILENAME, not an inline string to
// evaluate (unlike `eval`/`sh -c`/`bash -c`), so `source ./evil.sh` never
// carries "gh"/"merge" in the visible command text at all — the trigger
// (isSubjectToMergeRule below) never even fires for the realistic attack, so
// treating "source"/"." as a hardened class was a false completeness claim.
// This is now disclosed as part of the accepted residual (see this file's
// header) rather than claimed as caught — see design.md/ADR-008 for the
// full honest accounting.
const RESERVED_WORDS = new Set([
  'if', 'then', 'elif', 'else', 'fi', 'for', 'while', 'until', 'do', 'done',
  'case', 'esac', 'select', 'function', 'in', 'time', '!',
]);
const REINTERPRETING_LEADERS = new Set(['eval']);

// Round-5 fix 3 (security veto, live-demonstrated bypass against the real gh
// binary): `printf 'pr\nmerge\n--admin\n' | xargs gh` reaches real gh with
// `pr merge --admin` — the command TEXT contains "gh"/"merge" substrings (so
// the trigger fires) but the actual merge args arrive via stdin through
// xargs, invisible to the tokenizer. xargs is a generic argument-injection
// primitive (its entire purpose is building a command line from external
// input) — not a benign wrapper like `env`/`nice`. Treated the same as
// `eval`: as the leader of ANY simple command in the parsed pipeline (a
// pipeline naturally decomposes into separate simple commands at each `|`,
// so `commands.some(hasSemanticAmbiguity)` below already checks "anywhere in
// the pipeline" for free), it marks the whole analysis ambiguous.
const ARG_INJECTION_LEADERS = new Set(['xargs']);

/** @param {string[]} tokens — one simple command's RAW tokens (not yet
 * assignment-stripped) @returns {boolean} */
function hasSemanticAmbiguity(tokens) {
  if (tokens.some((t) => RESERVED_WORDS.has(t))) return true;
  const stripped = stripLeadingAssignments(tokens);
  const lead = stripped[0];
  if (lead && (REINTERPRETING_LEADERS.has(lead) || ARG_INJECTION_LEADERS.has(lead))) return true;
  if ((lead === 'sh' || lead === 'bash') && stripped[1] === '-c') return true;
  return false;
}

// Round-3 fix (security veto): the merge rule's TRIGGER no longer relies
// solely on the raw-substring "gh pr merge" adjacency — that missed every
// payload that obfuscates "gh" itself (`$(echo gh) pr merge --admin`,
// `gh${IFS}pr${IFS}merge --admin`, `X=gh; $X pr merge --admin`, ...): none of
// those contain the literal substring "gh pr merge", so the OLD trigger
// regex never even dispatched them to analyzeMergeCommand for tokenizing.
// New predicate: the raw text contains BOTH "gh" and "merge" as substrings,
// case-insensitive, in either order — broad enough to catch every
// obfuscation above (once dispatched, the existing $/`` ` ``/`{`/reserved-
// word/eval checks catch the rest), narrow enough that unrelated commands
// (`git merge $branch` — no "gh" substring; `gh pr view $PR`, `gh pr list |
// grep x` — no "merge" substring) never reach this rule at all. Any command
// that DOES match this broad trigger but turns out, after clean tokenization,
// to contain no actual `gh pr merge` invocation is let through unaffected —
// see analyzeMergeCommand's `mergeInvocationFound` below.
function isSubjectToMergeRule(command) {
  return /gh/i.test(command) && /merge/i.test(command);
}

/**
 * Analyzes the FULL raw command for the gh-pr-merge carve-out: real
 * tokenization (never substring matching) plus the semantic-ambiguity checks
 * above, followed by the allowlist check on EVERY `gh pr merge` invocation
 * found (there may be more than one, chained, possibly prefixed by env
 * assignments).
 *
 * `forbidden: true` means "never allow this through — not the config
 * carve-out, not AIDAKIT_BYPASS" (round-2 fix C): an unparseable/ambiguous
 * command is itself `forbidden`, fail-closed, WITHOUT needing to prove a
 * `gh pr merge` invocation is actually inside it (we can't see into an
 * ambiguous construct, so we can't rule one out either).
 *
 * `mergeInvocationFound: false` (only meaningful when `forbidden` is false)
 * means the command matched the broad trigger but, after a clean tokenization,
 * contains no actual `gh pr merge` invocation at all (e.g. an unrelated
 * command that merely shares the "gh"/"merge" substrings) — the caller must
 * let it fall through as if this rule never matched, not fall into the
 * default-deny path for a merge attempt that was never really there.
 *
 * `reason` (only meaningful when `forbidden`) says WHICH condition actually
 * fired, so the block message can name it instead of reciting every
 * possibility — round-6 fix: an operator whose read-only `gh pr view` was
 * blocked for AMBIGUITY read the old `--admin/--no-verify` wording as a claim
 * that their command contained one of those flags.
 * @param {string} command
 * @returns {{forbidden: boolean, mergeInvocationFound: boolean, reason?: 'ambiguous'|'forbidden-args'}}
 */
function analyzeMergeCommand(command) {
  const { commands, ambiguous } = splitShellCommands(command);
  if (ambiguous || commands.some(hasSemanticAmbiguity)) {
    // conservative: can't disprove an invocation is hiding inside
    return { forbidden: true, mergeInvocationFound: true, reason: 'ambiguous' };
  }
  let mergeInvocationFound = false;
  for (const rawTokens of commands) {
    const tokens = stripLeadingAssignments(rawTokens);
    const args = findGhPrMergeArgs(tokens);
    if (args !== null) {
      mergeInvocationFound = true;
      if (!isSafeGhPrMergeArgs(args)) {
        return { forbidden: true, mergeInvocationFound: true, reason: 'forbidden-args' };
      }
    }
  }
  return { forbidden: false, mergeInvocationFound };
}

/**
 * The gh-pr-merge carve-out's CONFIG half: allowed only when the repo's
 * TRUSTED BASE BRANCH declares pr.auto_merge: true (governance/pr/
 * pr-config.js's autoMergeEnabled — single-source with the merge_route flow
 * gate, never the working tree). Fail-closed: any import/read error → false.
 * @param {string} cwd
 * @returns {Promise<boolean>}
 */
async function isAutoMergeConfigured(cwd) {
  try {
    const { autoMergeEnabled } = await import('../governance/pr/pr-config.js');
    return autoMergeEnabled(cwd) === true;
  } catch {
    return false; // fail-closed: a broken import/read must not grant the exception
  }
}

async function main() {
  let event;
  try {
    event = JSON.parse(readStdin());
  } catch {
    process.exit(0); // fail-open: a broken hook must not block work
  }
  const command = event && event.tool_input && event.tool_input.command;
  if (typeof command !== 'string' || command.length === 0) process.exit(0);

  const bypass = /(?:^|\s)AIDAKIT_BYPASS=1\b/.test(command);

  for (const rule of RULES) {
    const triggered = rule.test ? rule.test(command) : rule.re.test(command);
    if (!triggered) continue;

    if (rule.mergeCarveOut) {
      const analysis = analyzeMergeCommand(command);
      if (analysis.forbidden) {
        // Round-2 fix C: a forbidden flag (or an ambiguous/unparseable shell
        // construct) on gh pr merge is NEVER allowed through — this check
        // runs BEFORE the bypass check below and short-circuits with its own
        // exit, so AIDAKIT_BYPASS cannot rescue it either.
        //
        // Round-6 fix: the two conditions get DISTINCT messages. The old
        // single message named --admin/--no-verify in both cases, so an
        // operator blocked for ambiguity on a read-only command reasonably
        // read it as "the hook thinks I passed --admin".
        process.stderr.write(
          analysis.reason === 'forbidden-args'
            ? '[aidakit governance] BLOCKED: this command invokes `gh pr merge` with an argument outside the ' +
                'allowlist — a forbidden flag (--admin/--admin=.../--no-verify), an unrecognized flag, or a second ' +
                'positional. NEVER allowed — not via pr.auto_merge: true, not via AIDAKIT_BYPASS (ADR-008). Use a ' +
                'plain `gh pr merge` (optionally --merge/--squash/--rebase/--delete-branch/--auto and ONE PR ' +
                'number/branch), or merge on the host UI.\n' +
                'Reference: GOVERNANCE.md of the aidakit plugin, section 4.\n'
            : '[aidakit governance] BLOCKED (ambiguous construct, NOT a forbidden flag): this command mentions ' +
                'both "gh" and "merge", and contains a shell construct this hook cannot resolve statically — ' +
                'variable or command substitution ($VAR, $(...), `...`), a subshell/brace group, a shell reserved ' +
                'word, eval/sh -c/bash -c, xargs, or an INPUT redirection (<). It is blocked fail-closed because ' +
                'an unreadable construct cannot be proven NOT to hide a `gh pr merge --admin` (ADR-008) — no ' +
                'forbidden flag has to be present for this to fire.\n' +
                'If this is a READ-ONLY query (e.g. `gh pr view --json mergeable,mergeStateStatus`), it reached ' +
                'this rule only because a JSON field name contains the "merge" substring: re-run it with LITERAL ' +
                'values instead of variables/substitutions. Pipes (|) and output redirections (2>&1, >, >>) are ' +
                'fine and do not trigger this.\n' +
                'Reference: GOVERNANCE.md of the aidakit plugin, section 4.\n'
        );
        process.exit(2);
      }
      if (!analysis.mergeInvocationFound) continue; // the broad trigger matched, but this isn't a gh-pr-merge attempt at all — not this rule's business
      const allowed = await isAutoMergeConfigured(event.cwd || process.cwd());
      if (allowed) continue; // opted in on the base branch, no forbidden flags — proceed as if the rule never matched
    }

    if (bypass && !rule.noBypass) {
      try {
        const dir = path.join(event.cwd || process.cwd(), '.claude', '.cache');
        fs.mkdirSync(dir, { recursive: true });
        fs.appendFileSync(
          path.join(dir, 'aidakit-bypass.log'),
          `${new Date().toISOString()}\t${command.replace(/\n/g, ' ')}\n`
        );
      } catch {
        // the bypass log is best-effort; it must not block
      }
      process.exit(0);
    }
    process.stderr.write(
      `[aidakit governance] BLOCKED: ${rule.msg}\n` +
        (rule.noBypass
          ? 'This rule has no bypass.\n'
          : 'Conscious bypass (will be logged): prefix with AIDAKIT_BYPASS=1 — only with the human\'s explicit request.\n') +
        'Reference: GOVERNANCE.md of the aidakit plugin, section 4.\n'
    );
    process.exit(2);
  }
  process.exit(0);
}

main();
