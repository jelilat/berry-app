import type { JSONSchema, StructuredOutputSchema } from '@/lib/ai/model-client'
import type {
  AgentBuildPlan,
  AgentCircuitIntent,
  ClarificationResult,
  WiringGuideDraft,
} from './types'

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
      referenceCircuit: { type: 'string', enum: ['esp32_led_blink', 'unsupported'] },
      rationale: { type: 'string' },
      toolPlan: { type: 'array', items: { type: 'string' } },
    },
    required: ['referenceCircuit', 'rationale', 'toolPlan'],
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
  if (referenceCircuit !== 'esp32_led_blink' && referenceCircuit !== 'unsupported') {
    throw new Error(`Unsupported reference circuit: ${referenceCircuit}`)
  }
  return {
    referenceCircuit,
    rationale: requireString(object.rationale, 'circuitIntent.rationale'),
    toolPlan: requireStringArray(object.toolPlan, 'circuitIntent.toolPlan'),
  }
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
 * Return a string or empty value for optional fields.
 * @param value Raw value.
 */
function optionalString(value: unknown): string {
  return typeof value === 'string' ? value : ''
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
