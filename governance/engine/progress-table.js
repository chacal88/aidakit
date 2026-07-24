// Read-only progress-table renderer for a flow run.
//
// Projects (flow.steps, loaded FlowState) → a plain-text table block. Reads
// only data the engine already persists (step.id, state.step_history[].step_id,
// state.current_step, state.pause.step_id, state.status) — no engine change,
// no I/O, zero-dep. See docs/features/flow-run-progress-table/design.md for
// the full derivation rationale.
//
// Row content is deliberately id + status marker ONLY — never step.description
// or any per-step outcome/result narrative (theme-3 boundary).

const TERMINAL_STATUSES = new Set(["completed", "aborted", "failed"]);

/**
 * @param {import('./types.js').Step[]} steps  flow.steps (top-level, declared order)
 * @param {import('./types.js').FlowState} state
 * @returns {string}  the whole table block (trailing newline included)
 */
export function renderProgressTable(steps, state) {
  const doneSet = new Set(state.step_history.map((h) => h.step_id));
  const isTerminal = TERMINAL_STATUSES.has(state.status);
  // Gated on non-terminal status: current_step is NEVER cleared by the engine
  // on a terminal run (engine.js:161-168), so a naive read would falsely mark
  // the terminal step `current` on a finished flow (violates criterion 1).
  const currentId = isTerminal ? null : (state.pause ? state.pause.step_id : state.current_step);

  const header = `Flow: ${state.flow_name} · ${state.flow_id} · ${state.status}${state.outcome ? `/${state.outcome}` : ""}`;
  const rows = steps.map((step) => {
    const marker = markerFor(step, currentId, doneSet);
    const gutter = marker === "current" ? " > " : "   ";
    return `${gutter}${marker.padEnd(7)}  ${step.id}`;
  });
  return [header, ...rows].join("\n") + "\n";
}

/** Precedence: current wins over done, done wins over pending. */
function markerFor(step, currentId, doneSet) {
  if (currentId != null && step.id === currentId) return "current";
  if (doneSet.has(step.id)) return "done";
  return "pending";
}
