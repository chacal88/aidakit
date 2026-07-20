#!/usr/bin/env node
/**
 * aidakit — PreToolUse/Bash hook (execution governance, GOVERNANCE.md §4)
 * Blocks destructive git/shell commands. Philosophy: when in doubt, allow.
 * Conscious bypass: prefix the command with AIDAKIT_BYPASS=1 — the bypass is
 * logged to .claude/.cache/aidakit-bypass.log for retroactive review.
 * Contract: exit 0 = allow; exit 2 = block (message on stderr). Fail-open.
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
    re: /gh\s+pr\s+merge\b/,
    msg: 'Merging a PR is NEVER the agent\'s job (GOVERNANCE.md §1). Deliver the PR URL and stop — the human merges.',
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

function main() {
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
    if (!rule.re.test(command)) continue;
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
