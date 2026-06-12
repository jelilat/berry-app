import type { JSONSchema, StructuredOutputSchema } from '@/lib/ai/model-client'
import { parseBreadboardSite } from '@/lib/project/breadboard'
import type { BoardId, ComponentTypeId, WireColor } from '@/lib/project/types'
import type {
  AgentBuildPlan,
  AgentCircuitIntent,
  ClarificationResult,
  WiringGuideDraft,
} from './types'
import type { StudioToolCall, StudioToolEndpoint } from './tools/calls'

const COMPONENT_TYPES = [
  'breadboard-full',
  'esp32-devkit-v1',
  'arduino-uno',
  'led-5mm',
  'resistor-220',
  'resistor-1k',
  'resistor-2k',
  'push-button',
  'hc-sr04',
  'bme280',
  'servo-sg90',
  'lcd-1602-i2c',
] as const

const WIRE_COLORS = ['red', 'black', 'yellow', 'green', 'blue', 'white', 'orange'] as const

const STUDIO_TOOL_ENDPOINT_SCHEMA = {
  type: ['object', 'null'],
  additionalProperties: false,
  properties: {
    componentId: { type: ['string', 'null'] },
    terminalId: { type: ['string', 'null'] },
    breadboardId: { type: ['string', 'null'] },
    site: {
      type: ['object', 'null'],
      additionalProperties: false,
      properties: {
        kind: { type: ['string', 'null'], enum: ['hole', 'rail', null] },
        block: { type: ['string', 'null'], enum: ['top', 'bottom', null] },
        row: {
          type: ['string', 'null'],
          enum: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', null],
        },
        edge: { type: ['string', 'null'], enum: ['top', 'bottom', null] },
        polarity: { type: ['string', 'null'], enum: ['positive', 'negative', null] },
        column: { type: ['number', 'null'] },
      },
      required: ['kind', 'block', 'row', 'edge', 'polarity', 'column'],
    },
  },
  required: ['componentId', 'terminalId', 'breadboardId', 'site'],
} satisfies JSONSchema

const STUDIO_TOOL_CALL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    tool: {
      type: 'string',
      enum: [
        'studio.set_board',
        'studio.add_component',
        'studio.move_component',
        'studio.connect_terminals',
        'project.validate',
      ],
    },
    board: { type: ['string', 'null'], enum: ['esp32-devkit-v1', 'arduino-uno', null] },
    componentType: { type: ['string', 'null'], enum: [...COMPONENT_TYPES, null] },
    id: { type: ['string', 'null'] },
    x: { type: ['number', 'null'] },
    y: { type: ['number', 'null'] },
    rotationZ: { type: ['number', 'null'] },
    from: STUDIO_TOOL_ENDPOINT_SCHEMA,
    to: STUDIO_TOOL_ENDPOINT_SCHEMA,
    color: { type: ['string', 'null'], enum: [...WIRE_COLORS, null] },
  },
  required: [
    'tool',
    'board',
    'componentType',
    'id',
    'x',
    'y',
    'rotationZ',
    'from',
    'to',
    'color',
  ],
} satisfies JSONSchema

/** JSON schema for clarifier agent output. */
export const ClarificationResultStructuredSchema: StructuredOutputSchema<ClarificationResult> = {
  name: 'clarification_result',
  description: 'Whether the hardware build request is ready or needs clarification.',
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      status: { type: 'string', enum: ['ready', 'needs_clarification'] },
      normalizedGoal: { type: 'string' },
      assumptions: { type: 'array', items: { type: 'string' } },
      questions: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            id: { type: 'string' },
            question: { type: 'string' },
            reason: { type: 'string' },
            options: { type: 'array', items: { type: 'string' } },
          },
          required: ['id', 'question', 'reason', 'options'],
        },
      },
    },
    required: ['status', 'normalizedGoal', 'assumptions', 'questions'],
  },
  validate: validateClarificationResult,
}

/** JSON schema for planner agent output. */
export const AgentBuildPlanStructuredSchema: StructuredOutputSchema<AgentBuildPlan> = {
  name: 'agent_build_plan',
  description: 'A safe hardware build plan that Berry can execute through tools.',
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      goal: { type: 'string' },
      board: { type: 'string', enum: ['esp32-devkit-v1', 'arduino-uno'] },
      components: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            type: { type: 'string', enum: COMPONENT_TYPES as unknown as string[] },
            role: { type: 'string' },
          },
          required: ['type', 'role'],
        },
      },
      behavior: {
        type: 'object',
        additionalProperties: false,
        properties: {
          kind: { type: 'string', enum: ['blink', 'serial_monitor', 'custom'] },
          intervalMs: { type: ['number', 'null'] },
          description: { type: 'string' },
        },
        required: ['kind', 'intervalMs', 'description'],
      },
      constraints: { type: 'array', items: { type: 'string' } },
    },
    required: ['goal', 'board', 'components', 'behavior', 'constraints'],
  },
  validate: validateAgentBuildPlan,
}

/** JSON schema for circuit intent output. */
export const AgentCircuitIntentStructuredSchema: StructuredOutputSchema<AgentCircuitIntent> = {
  name: 'agent_circuit_intent',
  description: 'The bounded circuit implementation strategy selected by the circuit designer.',
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      referenceCircuit: {
        type: 'string',
        enum: ['esp32_led_blink', 'arduino_uno_led_blink', 'unsupported'],
      },
      rationale: { type: 'string' },
      toolPlan: { type: 'array', items: { type: 'string' } },
      toolCalls: { type: 'array', items: STUDIO_TOOL_CALL_SCHEMA },
    },
    required: ['referenceCircuit', 'rationale', 'toolPlan', 'toolCalls'],
  },
  validate: validateAgentCircuitIntent,
}

/** JSON schema for wiring guide model output. */
export const WiringGuideDraftStructuredSchema: StructuredOutputSchema<WiringGuideDraft> = {
  name: 'wiring_guide_draft',
  description: 'Human-readable wiring instructions based on the final Berry project graph.',
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      markdown: { type: 'string' },
    },
    required: ['markdown'],
  },
  validate: validateWiringGuideDraft,
}

/**
 * Cast a JSON-compatible object to a schema type.
 * @param value Raw schema object.
 */
export function asJsonSchema(value: JSONSchema): JSONSchema {
  return value
}

/**
 * Validate and normalize clarifier output.
 * @param value Raw model JSON.
 */
function validateClarificationResult(value: unknown): ClarificationResult {
  const object = requireRecord(value, 'clarification')
  const status = requireString(object.status, 'clarification.status')
  const normalizedGoal = optionalString(object.normalizedGoal)
  const assumptions = optionalStringArray(object.assumptions)
  const questionsRaw = optionalArray(object.questions)
  const questions = questionsRaw.map((question, index) => {
    const q = requireRecord(question, `clarification.questions[${index}]`)
    return {
      id: requireString(q.id, `clarification.questions[${index}].id`),
      question: requireString(q.question, `clarification.questions[${index}].question`),
      reason: requireString(q.reason, `clarification.questions[${index}].reason`),
      options: optionalStringArray(q.options),
    }
  })

  if (status === 'ready') {
    return {
      status,
      normalizedGoal: normalizedGoal || 'Hardware build',
      assumptions,
    }
  }
  if (status === 'needs_clarification') {
    if (questions.length === 0) {
      throw new Error('clarification.questions must contain at least one question')
    }
    return { status, questions }
  }
  throw new Error(`Unsupported clarification status: ${status}`)
}

/**
 * Validate and normalize planner output.
 * @param value Raw model JSON.
 */
function validateAgentBuildPlan(value: unknown): AgentBuildPlan {
  const object = requireRecord(value, 'plan')
  const behavior = requireRecord(object.behavior, 'plan.behavior')
  const components = requireArray(object.components, 'plan.components').map((component, index) => {
    const c = requireRecord(component, `plan.components[${index}]`)
    const type = requireString(c.type, `plan.components[${index}].type`)
    if (!(COMPONENT_TYPES as readonly string[]).includes(type)) {
      throw new Error(`Unsupported component type: ${type}`)
    }
    return {
      type: type as AgentBuildPlan['components'][number]['type'],
      role: requireString(c.role, `plan.components[${index}].role`),
    }
  })
  const board = requireString(object.board, 'plan.board')
  if (board !== 'esp32-devkit-v1' && board !== 'arduino-uno') {
    throw new Error(`Unsupported board: ${board}`)
  }
  const kind = requireString(behavior.kind, 'plan.behavior.kind')
  if (kind !== 'blink' && kind !== 'serial_monitor' && kind !== 'custom') {
    throw new Error(`Unsupported behavior kind: ${kind}`)
  }
  return {
    goal: requireString(object.goal, 'plan.goal'),
    board,
    components,
    behavior: {
      kind,
      intervalMs: typeof behavior.intervalMs === 'number' ? behavior.intervalMs : undefined,
      description: requireString(behavior.description, 'plan.behavior.description'),
    },
    constraints: requireStringArray(object.constraints, 'plan.constraints'),
  }
}

/**
 * Validate and normalize circuit intent.
 * @param value Raw model JSON.
 */
function validateAgentCircuitIntent(value: unknown): AgentCircuitIntent {
  const object = requireRecord(value, 'circuitIntent')
  const referenceCircuit = requireString(object.referenceCircuit, 'circuitIntent.referenceCircuit')
  if (
    referenceCircuit !== 'esp32_led_blink' &&
    referenceCircuit !== 'arduino_uno_led_blink' &&
    referenceCircuit !== 'unsupported'
  ) {
    throw new Error(`Unsupported reference circuit: ${referenceCircuit}`)
  }
  return {
    referenceCircuit,
    rationale: requireString(object.rationale, 'circuitIntent.rationale'),
    toolPlan: requireStringArray(object.toolPlan, 'circuitIntent.toolPlan'),
    toolCalls: requireArray(object.toolCalls, 'circuitIntent.toolCalls').map((call, index) =>
      validateStudioToolCall(call, `circuitIntent.toolCalls[${index}]`),
    ),
  }
}

/**
 * Validate one model-emitted Studio tool call.
 * @param value Raw tool call object.
 * @param path Error path.
 */
function validateStudioToolCall(value: unknown, path: string): StudioToolCall {
  const object = requireRecord(value, path)
  const tool = requireString(object.tool, `${path}.tool`)

  if (tool === 'studio.set_board') {
    return { tool, board: requireBoardId(object.board, `${path}.board`) }
  }
  if (tool === 'studio.add_component') {
    return {
      tool,
      componentType: requireComponentType(object.componentType, `${path}.componentType`),
      id: requireString(object.id, `${path}.id`),
      x: requireNumber(object.x, `${path}.x`),
      y: requireNumber(object.y, `${path}.y`),
      rotationZ: typeof object.rotationZ === 'number' ? object.rotationZ : undefined,
    }
  }
  if (tool === 'studio.move_component') {
    return {
      tool,
      id: requireString(object.id, `${path}.id`),
      x: requireNumber(object.x, `${path}.x`),
      y: requireNumber(object.y, `${path}.y`),
    }
  }
  if (tool === 'studio.connect_terminals') {
    return {
      tool,
      from: validateStudioEndpoint(object.from, `${path}.from`),
      to: validateStudioEndpoint(object.to, `${path}.to`),
      color: typeof object.color === 'string' ? requireWireColor(object.color, `${path}.color`) : undefined,
    }
  }
  if (tool === 'project.validate') {
    return { tool }
  }
  throw new Error(`Unsupported Studio tool: ${tool}`)
}

/**
 * Validate one tool-call endpoint.
 * @param value Raw endpoint object.
 * @param path Error path.
 */
function validateStudioEndpoint(value: unknown, path: string): StudioToolEndpoint {
  const object = requireRecord(value, path)
  const componentId = optionalStringOrNull(object.componentId)
  const terminalId = optionalStringOrNull(object.terminalId)
  const breadboardId = optionalStringOrNull(object.breadboardId)

  if (componentId && terminalId && !breadboardId) {
    return { componentId, terminalId }
  }
  if (breadboardId && !componentId && !terminalId) {
    return { breadboardId, site: parseBreadboardSite(object.site, `${path}.site`) }
  }
  throw new Error(`${path} must be either componentId+terminalId or breadboardId+site`)
}

/**
 * Require a supported board id.
 * @param value Raw value.
 * @param path Error path.
 */
function requireBoardId(value: unknown, path: string): BoardId {
  const board = requireString(value, path)
  if (board !== 'esp32-devkit-v1' && board !== 'arduino-uno') {
    throw new Error(`Unsupported board: ${board}`)
  }
  return board
}

/**
 * Require a catalog component type.
 * @param value Raw value.
 * @param path Error path.
 */
function requireComponentType(value: unknown, path: string): ComponentTypeId {
  const type = requireString(value, path)
  if (!(COMPONENT_TYPES as readonly string[]).includes(type)) {
    throw new Error(`Unsupported component type: ${type}`)
  }
  return type as ComponentTypeId
}

/**
 * Require a supported wire color.
 * @param value Raw value.
 * @param path Error path.
 */
function requireWireColor(value: unknown, path: string): WireColor {
  if (typeof value !== 'string' || !(WIRE_COLORS as readonly string[]).includes(value)) {
    throw new Error(`${path} must be a supported wire color`)
  }
  return value as WireColor
}

/**
 * Validate and normalize wiring guide output.
 * @param value Raw model JSON.
 */
function validateWiringGuideDraft(value: unknown): WiringGuideDraft {
  const object = requireRecord(value, 'wiringGuide')
  const markdown = requireString(object.markdown, 'wiringGuide.markdown').trim()
  if (markdown.length < 40) {
    throw new Error('wiringGuide.markdown is too short')
  }
  return { markdown }
}

/**
 * Require a non-array object.
 * @param value Raw value.
 * @param path Error path.
 */
function requireRecord(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${path} must be an object`)
  }
  return value as Record<string, unknown>
}

/**
 * Require a string.
 * @param value Raw value.
 * @param path Error path.
 */
function requireString(value: unknown, path: string): string {
  if (typeof value !== 'string') {
    throw new Error(`${path} must be a string`)
  }
  return value
}

/**
 * Require a number.
 * @param value Raw value.
 * @param path Error path.
 */
function requireNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${path} must be a finite number`)
  }
  return value
}

/**
 * Return a string or empty value for optional fields.
 * @param value Raw value.
 */
function optionalString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/**
 * Return a string for optional nullable fields.
 * @param value Raw value.
 */
function optionalStringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

/**
 * Require an array.
 * @param value Raw value.
 * @param path Error path.
 */
function requireArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${path} must be an array`)
  }
  return value
}

/**
 * Require an array of strings.
 * @param value Raw value.
 * @param path Error path.
 */
function requireStringArray(value: unknown, path: string): string[] {
  return requireArray(value, path).map((item, index) => requireString(item, `${path}[${index}]`))
}

/**
 * Return an array if present, otherwise an empty array.
 * @param value Raw value.
 */
function optionalArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

/**
 * Return a string array if present, otherwise an empty array.
 * @param value Raw value.
 */
function optionalStringArray(value: unknown): string[] {
  return optionalArray(value).map((item, index) => requireString(item, `array[${index}]`))
}
