// aidakit infra-detect prelude — loaded into every `runs` step's `node`
// children via `NODE_OPTIONS=--require=<this file>` (governance/engine/steps/runs.js).
//
// Remaps a Node module-resolution failure — `require()`/`require.resolve()`
// throwing MODULE_NOT_FOUND / ERR_MODULE_NOT_FOUND / a loader ENOENT — from an
// indistinguishable `process.exit(1)` (identical, structurally, to a
// validator's legitimate NO) into a reserved sentinel exit code (250) the
// engine's classifier in `runs.js` recognizes as an INFRA error, not a
// validator verdict. See ADR-010.
//
// CommonJS: Node's `--require` flag only accepts CJS modules.
//
// Only the two module-resolution shapes are remapped; every other uncaught
// exception is re-raised untouched — this prelude does not swallow arbitrary
// crashes.

(function install() {
  const marker = Symbol.for("aidakit.infra-detect.installed");
  if (globalThis[marker]) return; // idempotent — safe if required twice
  globalThis[marker] = true;

  process.on("uncaughtException", (err) => {
    const code = err && err.code;
    const isModuleResolutionFailure =
      code === "MODULE_NOT_FOUND" ||
      code === "ERR_MODULE_NOT_FOUND" ||
      (code === "ENOENT" && !!(err && err.requireStack));

    if (isModuleResolutionFailure) {
      const message = (err && err.message) || String(err);
      process.stderr.write(`aidakit-prelude: infra error: ${code}: ${message}\n`);
      process.exit(250);
    }

    throw err; // not our shape — re-raise
  });
})();
