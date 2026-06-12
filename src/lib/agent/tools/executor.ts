import { componentCatalog } from '@/lib/project/catalog'
import { assertEndpointValid } from '@/lib/project/mutations'
import type { BerryProject, ComponentTypeId } from '@/lib/project/types'
import { hasValidationErrors, validate, type ValidationResult } from '@/lib/validation'
import {
  studioAddComponent,
  studioConnectTerminals,
  studioMoveComponent,
  studioSetBoard,
} from './studio'
import type { StudioToolCall } from './calls'

/** One executed (or rejected) tool call recorded for the timeline and tests. */
export interface StudioToolCallLogEntry {
  tool: StudioToolCall['tool']
  ok: boolean
  summary: string
}

/** Machine-readable failure from the tool-call executor. */
export interface StudioToolCallError {
  code:
    | 'unknown_tool'
    | 'unknown_component_type'
    | 'invalid_endpoint'
    | 'mutation_failed'
  message: string
  toolIndex: number
}

/** Result of applying a batch of circuit-designer tool calls. */
export interface StudioToolCallResult {
  /** True when every call applied and the final graph has no validation errors. */
  ok: boolean
  project: BerryProject
  validation: ValidationResult[]
  log: StudioToolCallLogEntry[]
  error?: StudioToolCallError
}

/**
 * Type guard for catalog component ids supplied by an untrusted model.
 * @param type Candidate component type id.
 */
function isKnownComponentType(type: string): type is ComponentTypeId {
  return Object.prototype.hasOwnProperty.call(componentCatalog, type)
}

/**
 * Apply a typed circuit-designer tool-call batch through Berry's project
 * mutation helpers, validating the final graph.
 *
 * The model is never allowed to edit raw project JSON; it can only emit the
 * structured {@link StudioToolCall} union handled here. Each mutating call goes
 * through the existing mutation layer (which rejects unknown ids and terminals),
 * and validation runs after the batch so callers can gate build/sim on a clean
 * graph.
 *
 * @param project Starting project graph.
 * @param calls Ordered tool calls to apply.
 */
export function executeStudioToolCalls(
  project: BerryProject,
  calls: StudioToolCall[],
): StudioToolCallResult {
  let current = project
  const log: StudioToolCallLogEntry[] = []

  for (let index = 0; index < calls.length; index += 1) {
    const call = calls[index]!
    try {
      switch (call.tool) {
        case 'studio.set_board': {
          const result = studioSetBoard(current, call.board)
          current = result.project
          log.push({ tool: call.tool, ok: true, summary: result.summary })
          break
        }
        case 'studio.add_component': {
          if (!isKnownComponentType(call.componentType)) {
            return rejected(current, log, {
              code: 'unknown_component_type',
              message: `Unknown component type: ${call.componentType}`,
              toolIndex: index,
            })
          }
          const result = studioAddComponent(
            current,
            call.componentType,
            call.id,
            call.x,
            call.y,
            call.rotationZ ?? 0,
          )
          current = result.project
          log.push({ tool: call.tool, ok: true, summary: result.summary })
          break
        }
        case 'studio.move_component': {
          const result = studioMoveComponent(current, call.id, call.x, call.y)
          current = result.project
          log.push({ tool: call.tool, ok: true, summary: result.summary })
          break
        }
        case 'studio.connect_terminals': {
          // Reject unknown components/terminals/breadboards before mutating.
          assertEndpointValid(current, call.from)
          assertEndpointValid(current, call.to)
          const result = studioConnectTerminals(
            current,
            call.from,
            call.to,
            call.color ?? 'yellow',
          )
          current = result.project
          log.push({ tool: call.tool, ok: true, summary: result.summary })
          break
        }
        case 'project.validate': {
          const findings = validate(current)
          log.push({
            tool: call.tool,
            ok: !hasValidationErrors(findings),
            summary: `Validation found ${findings.length} item(s).`,
          })
          break
        }
        default: {
          const unknown = call as { tool?: string }
          return rejected(current, log, {
            code: 'unknown_tool',
            message: `Unknown tool: ${unknown.tool ?? 'undefined'}`,
            toolIndex: index,
          })
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Tool call failed'
      const code: StudioToolCallError['code'] =
        call.tool === 'studio.connect_terminals' &&
        /Unknown|not on|not a breadboard|not defined/.test(message)
          ? 'invalid_endpoint'
          : 'mutation_failed'
      return rejected(current, log, { code, message, toolIndex: index })
    }
  }

  // Always validate after the batch of mutations.
  const validation = validate(current)
  return {
    ok: !hasValidationErrors(validation),
    project: current,
    validation,
    log,
  }
}

/**
 * Build a rejected executor result, validating the last good project state.
 * @param project Project graph before the failed call.
 * @param log Tool-call log accumulated so far.
 * @param error Structured failure detail.
 */
function rejected(
  project: BerryProject,
  log: StudioToolCallLogEntry[],
  error: StudioToolCallError,
): StudioToolCallResult {
  return {
    ok: false,
    project,
    validation: validate(project),
    log: [...log, { tool: errorTool(error), ok: false, summary: error.message }],
    error,
  }
}

/**
 * Best-effort tool name for a rejected-call log entry.
 * @param error Structured failure detail.
 */
function errorTool(error: StudioToolCallError): StudioToolCall['tool'] {
  return error.code === 'unknown_component_type'
    ? 'studio.add_component'
    : error.code === 'invalid_endpoint'
      ? 'studio.connect_terminals'
      : 'project.validate'
}
