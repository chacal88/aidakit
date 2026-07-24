// Contracts for the aidakit flow engine (ported from recruit/.governance/orchestrator).
// Plain JS (ESM). Types are documented via JSDoc — the textual schema is the
// contract; there's no compile-time checking, so the parser validates the shape
// at runtime (parser.js).

/**
 * @typedef {"invoke"|"runs"|"human_handoff"|"human_gate"|"loop"|"parallel"|"terminal"} StepType
 *
 * "invoke" dispatches a SKILL or an AGENT (the `invoke_target:` field names which one).
 * The engine doesn't distinguish the two — both are isolated-context units that
 * the operator-Claude runs and reports the outcome for (inversion of control).
 * The legacy type "agent" is still accepted by the parser as a synonym for
 * "invoke", but new flows use "invoke" so as not to pretend everything is an
 * agent.
 */

/**
 * @typedef {Object} FlowInput
 * @property {string} name
 * @property {"string"|"enum"|"boolean"|"integer"|"array<string>"} type
 * @property {boolean} [required]
 * @property {unknown} [default]
 * @property {Array<string|number|boolean>} [values]
 * @property {string} [description]
 */

/**
 * Base step. Every step routes via on_result[outcome] ?? on_success ?? on_failure.
 * @typedef {Object} BaseStep
 * @property {string} id
 * @property {StepType} type
 * @property {string} [description]
 * @property {string} [on_success]
 * @property {string} [on_failure]
 * @property {Object.<string,string>} [on_result]
 */

/** @typedef {BaseStep & {type:"invoke", invoke_target:string, input?:Object.<string,unknown>, expects?:string[], outputs?:Object.<string,string[]>}} InvokeStep — dispatches the skill/agent named in `invoke_target`. `outputs` maps an outcome to the structured output keys a resume with that outcome MUST supply (safe single tokens, persisted into context[step.id] — ADR-006). */
/** @typedef {BaseStep & {type:"runs", command:string, cwd?:string, env?:Object.<string,string>}} RunsStep */
/** @typedef {BaseStep & {type:"human_handoff", prompt:string}} HumanHandoffStep */
/** @typedef {BaseStep & {type:"human_gate", prompt:string, options:string[]}} HumanGateStep */
/** @typedef {BaseStep & {type:"loop", over:string, as?:string, body:Step[], max?:number, until?:string}} LoopStep */
/** @typedef {BaseStep & {type:"parallel", branches:Step[][]}} ParallelStep */
/** @typedef {BaseStep & {type:"terminal", outcome?:"completed"|"aborted", message?:string}} TerminalStep */

/** @typedef {InvokeStep|RunsStep|HumanHandoffStep|HumanGateStep|LoopStep|ParallelStep|TerminalStep} Step */

/**
 * @typedef {Object} Flow
 * @property {string} flow
 * @property {string} description
 * @property {number} [version]
 * @property {FlowInput[]} [inputs]
 * @property {string} [entry]
 * @property {Step[]} steps
 */

/** @typedef {"running"|"paused"|"completed"|"aborted"|"failed"} FlowStatus */

/**
 * @typedef {Object} StepHistoryEntry
 * @property {string} step_id
 * @property {StepType} step_type
 * @property {string[]} path
 * @property {string} started_at
 * @property {string} [ended_at]
 * @property {string} result
 * @property {unknown} [output]
 * @property {string} [error]
 */

/**
 * Pause information. step_type distinguishes a genuine human gate from a
 * skill/agent dispatch pause (inversion of control: the engine never dispatches
 * the skill/subagent — the operator-Claude resolves it and resumes).
 * @typedef {Object} PauseInfo
 * @property {string} step_id
 * @property {"human_handoff"|"human_gate"|"invoke"} step_type
 * @property {string} prompt
 * @property {string[]} [options]
 * @property {string} [invoke_target]  name of the skill/agent to dispatch (on an "invoke" pause)
 * @property {Object.<string,unknown>} [input]
 * @property {Object.<string,string[]>} [outputs]  outcome → required structured-output keys (on an "invoke" pause)
 * @property {string[]} path
 * @property {string} paused_at
 */

/**
 * @typedef {Object} FlowState
 * @property {string} flow_id
 * @property {string} flow_name
 * @property {number} flow_version
 * @property {string} started_at
 * @property {string} started_by
 * @property {string|null} current_step
 * @property {FlowStatus} status
 * @property {Object.<string,unknown>} inputs
 * @property {Object.<string,unknown>} context   mutable bag that steps read/write
 * @property {StepHistoryEntry[]} step_history
 * @property {PauseInfo} [pause]
 * @property {"completed"|"aborted"|"failed"} [outcome]
 * @property {string} [finished_at]
 */

/**
 * Result of a step executor:
 *  - {kind:"next", outcome}   → engine routes via on_result/on_success/on_failure
 *  - {kind:"pause", pause}    → engine persists and exits
 *  - {kind:"fail", error}     → engine routes via on_failure or marks it failed
 *  - {kind:"terminal", ...}   → engine ends the flow
 * @typedef {{kind:"next",outcome:string,output?:unknown}
 *          |{kind:"pause",pause:PauseInfo,output?:unknown}
 *          |{kind:"fail",error:string,output?:unknown}
 *          |{kind:"terminal",outcome:"completed"|"aborted",message?:string}} StepOutcome
 */

/**
 * @typedef {Object} ExecutionContext
 * @property {FlowState} state
 * @property {Flow} flow
 * @property {string} [resumeValue]   resume value; consumed by a single step (single-shot)
 * @property {Object.<string,string>} [resumeOutput]   structured resume output (key=value tokens after the outcome); single-shot like resumeValue
 * @property {Object.<string,unknown>} loopVars
 * @property {string[]} path
 */

// Set of valid step types — used by the parser to validate.
// "agent" is accepted as a LEGACY synonym for "invoke" (backward-compat for old flows).
export const STEP_TYPES = /** @type {const} */ ([
  "invoke",
  "agent", // legacy — normalized to "invoke" by the parser
  "runs",
  "human_handoff",
  "human_gate",
  "loop",
  "parallel",
  "terminal",
]);

// This module is only contracts (JSDoc) + the constant above; no logic.
export {};
