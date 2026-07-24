#!/usr/bin/env node
/**
 * aidakit — SessionStart hook (agent-validator-paths, amends ADR-004 via ADR-012)
 *
 * Companion to governance/engine/steps/runs.js: runs.js injects
 * AIDAKIT_GOVERNANCE into the child env of every `runs` step (engine-spawned
 * processes only). This hook covers every OTHER vector — any Bash tool call
 * a direct-invocation instruction in agents/, skills/, or commands/ makes,
 * which never goes through runs.js at all.
 *
 * Mechanism (verified empirically this session — see
 * docs/features/agent-validator-paths/evidence.md §"Step 1c" for the full
 * trail): Claude Code's SessionStart/Setup/CwdChanged/FileChanged hooks are
 * spawned with a CLAUDE_ENV_FILE env var — an absolute path to a scratch
 * file. Shell text WRITTEN to that path (not printed to stdout as JSON) is
 * later prepended, `&&`-joined, ahead of every subsequent Bash tool
 * invocation in the session. There is NO hookSpecificOutput field for env
 * export on SessionStart (its schema only carries additionalContext,
 * initialUserMessage, sessionTitle, watchPaths, reloadSkills) — the
 * CLAUDE_ENV_FILE side-channel is the actual injection surface, distinct
 * from the JSON-stdout protocol the initial design sketch assumed.
 *
 * Fail-loud: if CLAUDE_PLUGIN_ROOT or CLAUDE_ENV_FILE is empty, this hook
 * writes a diagnostic to stderr and exits non-zero, leaving
 * AIDAKIT_GOVERNANCE unset — the fail-closed guard at every rewritten call
 * site then surfaces a legible error at first use instead of a
 * `Cannot find module`.
 */
'use strict';

const fs = require('fs');

const root = process.env.CLAUDE_PLUGIN_ROOT;
if (!root) {
  process.stderr.write(
    'aidakit session-start: CLAUDE_PLUGIN_ROOT is empty — AIDAKIT_GOVERNANCE not exported\n'
  );
  process.exit(1);
}

const envFile = process.env.CLAUDE_ENV_FILE;
if (!envFile) {
  process.stderr.write(
    'aidakit session-start: CLAUDE_ENV_FILE is empty — this Claude Code build does not expose ' +
      'the session-env injection surface for SessionStart hooks; AIDAKIT_GOVERNANCE not exported\n'
  );
  process.exit(1);
}

const governance = `${root}/governance`;
// Single-quote the value for the shell, escaping any embedded single quote
// the POSIX way ('\'') — the plugin cache path may contain spaces.
const quoted = `'${governance.replace(/'/g, "'\\''")}'`;

try {
  fs.appendFileSync(envFile, `export AIDAKIT_GOVERNANCE=${quoted}\n`);
} catch (err) {
  process.stderr.write(`aidakit session-start: failed to write CLAUDE_ENV_FILE: ${err.message}\n`);
  process.exit(1);
}

process.exit(0);
