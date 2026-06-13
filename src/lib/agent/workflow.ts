import { compileWithMock } from '@/lib/build/mock'
import { DEFAULT_FIRMWARE_PATH } from '@/lib/firmware/source'
import { generateFirmwareFromProject } from '@/lib/codegen/generate'
import { createEmptyProject } from '@/lib/project/mutations'
import { simulateProject } from '@/lib/simulation'
import { hasValidationErrors, validate } from '@/lib/validation'
import {
  createDefaultModelClient,
  DeterministicModelClient,
  type BerryModelClient,
} from '@/lib/ai/model-client'
import { resolveAgentModel } from '@/lib/ai/model-registry'
import { appendTimelineEvent } from './events'
import {
  AgentBuildPlanStructuredSchema,
  AgentCircuitIntentStructuredSchema,
  ClarificationResultStructuredSchema,
  WiringGuideDraftStructuredSchema,
} from './schemas'
import {
  circuitDesignerSystemPrompt,
  circuitDesignerUserPrompt,
  clarifierSystemPrompt,
  clarifierUserPrompt,
  plannerSystemPrompt,
  plannerUserPrompt,
  wiringGuideSystemPrompt,
  wiringGuideUserPrompt,
} from './prompts'
import {
  studioAssertProjectGraph,
  studioCreateArduinoUnoLedBlinkProject,
  studioCreateEsp32LedBlinkProject,
  studioCreateStarterProject,
} from './tools/studio'
import { executeStudioToolCalls } from './tools/executor'
import type { StudioToolCall } from './tools/calls'
import { getBoardProfile } from '@/lib/project/boards'
import type { BoardId } from '@/lib/project/types'
import { generateWiringGuide } from './wiring-guide'
import type {
  AgentBuildPlan,
  AgentCircuitIntent,
  AgentRunInput,
  AgentRunResult,
  AgentRunState,
  ClarificationResult,
} from './types'

/**
 * Create a simple unique run id for local agent runs.
 */
function createRunId(): string {
  return `agent_${Date.now().toString(36)}`
}

/**
 * True when the prompt asks for the first supported reference circuit.
 * @param prompt User prompt.
 */
function isLedBlinkPrompt(prompt: string): boolean {
  const normalized = prompt.toLowerCase()
  return normalized.includes('led') && (normalized.includes('blink') || normalized.includes('blinking'))
}

/**
 * Detect an explicitly requested board from free text, if any.
 * @param text User prompt or normalized goal.
 */
function detectRequestedBoard(text: string): BoardId | null {
  const normalized = text.toLowerCase()
  if (/\barduino\b|\buno\b/.test(normalized)) {
    return 'arduino-uno'
  }
  if (/\besp\s?-?32\b|devkit/.test(normalized)) {
    return 'esp32-devkit-v1'
  }
  return null
}

/**
 * Resolve the board to plan for, defaulting to ESP32 for unspecified LED blinks.
 * @param text Prompt or normalized goal to inspect.
 */
function resolveBlinkBoard(text: string): BoardId {
  return detectRequestedBoard(text) ?? 'esp32-devkit-v1'
}

/**
 * Human-readable board name for goals and timeline copy.
 * @param board Target board id.
 */
function boardName(board: BoardId): string {
  return getBoardProfile(board).name
}

/**
 * Reference circuit id matching a board for the executable LED blink slice.
 * @param board Target board id.
 */
function ledBlinkReferenceFor(board: BoardId): AgentCircuitIntent['referenceCircuit'] {
  return board === 'arduino-uno' ? 'arduino_uno_led_blink' : 'esp32_led_blink'
}

/**
 * Resolve the board implied by a supported reference circuit.
 * @param referenceCircuit Circuit reference chosen by the circuit designer.
 */
function boardForReference(
  referenceCircuit: AgentCircuitIntent['referenceCircuit'],
): BoardId | null {
  if (referenceCircuit === 'arduino_uno_led_blink') return 'arduino-uno'
  if (referenceCircuit === 'esp32_led_blink') return 'esp32-devkit-v1'
  return null
}

/**
 * Build executable Studio tool calls for the supported LED blink reference.
 * @param board Target board for the reference circuit.
 */
function ledBlinkToolCalls(board: BoardId): StudioToolCall[] {
  const isArduino = board === 'arduino-uno'
  const mcuType = isArduino ? 'arduino-uno' : 'esp32-devkit-v1'
  const mcuId = isArduino ? 'arduino_1' : 'esp32_1'
  const signalPin = isArduino ? 'D13' : 'IO13'
  const groundPin = isArduino ? 'GND' : 'GND_R'

  return [
    { tool: 'studio.set_board', board },
    { tool: 'studio.add_component', componentType: mcuType, id: mcuId, x: -0.08, y: 0.03, rotationZ: isArduino ? 0 : 90 },
    { tool: 'studio.add_component', componentType: 'breadboard-full', id: 'breadboard_1', x: 0, y: 0 },
    { tool: 'studio.add_component', componentType: 'resistor-220', id: 'resistor_1', x: 0.14, y: 0.05 },
    { tool: 'studio.add_component', componentType: 'led-5mm', id: 'led_1', x: 0.18, y: 0.05 },
    {
      tool: 'studio.connect_terminals',
      from: { componentId: mcuId, terminalId: signalPin },
      to: { componentId: 'resistor_1', terminalId: 'pin1' },
      color: 'yellow',
    },
    {
      tool: 'studio.connect_terminals',
      from: { componentId: 'resistor_1', terminalId: 'pin2' },
      to: { componentId: 'led_1', terminalId: 'anode' },
      color: 'red',
    },
    {
      tool: 'studio.connect_terminals',
      from: { componentId: 'led_1', terminalId: 'cathode' },
      to: { componentId: mcuId, terminalId: groundPin },
      color: 'black',
    },
    { tool: 'project.validate' },
  ]
}

/**
 * Build the deterministic clarification fallback for the supported LED blink slice.
 * Chooses ESP32 or Arduino Uno from the prompt and records the board assumption.
 * @param input Agent run input (prompt + optional clarification answers).
 */
function buildClarificationFallback(input: AgentRunInput): ClarificationResult {
  if (input.project && !isLedBlinkPrompt(input.prompt)) {
    return {
      status: 'ready',
      normalizedGoal: input.project.metadata.name,
      assumptions: ['Use the prepared starter graph as the first circuit draft.'],
    }
  }

  if (!isLedBlinkPrompt(input.prompt)) {
    return {
      status: 'needs_clarification',
      questions: [
        {
          id: 'reference_circuit',
          question: 'Which board should Berry build an LED blink on?',
          reason:
            'The current Phase 6 build loop can execute an LED blink on ESP32 DevKit V1 or Arduino Uno.',
          options: ['ESP32 blinking LED', 'Arduino Uno blinking LED'],
        },
      ],
    }
  }

  const requested = detectRequestedBoard([input.prompt, ...Object.values(input.answers ?? {})].join(' '))
  const board = requested ?? 'esp32-devkit-v1'
  const assumptions = [
    requested
      ? `Use ${boardName(board)} as the controller.`
      : `No board was specified; defaulting to ${boardName(board)} as the controller.`,
    'Use one 220 ohm resistor in series with the LED.',
    'Blink interval is 500 ms on and 500 ms off.',
  ]

  return {
    status: 'ready',
    normalizedGoal: `${boardName(board)} LED blink`,
    assumptions,
  }
}

/**
 * Produce deterministic clarification output for the first Phase 6 slice.
 * @param input Agent run input.
 * @param modelClient Provider-neutral model client.
 */
async function clarifyGoal(
  input: AgentRunInput,
  modelClient: BerryModelClient,
): Promise<ClarificationResult> {
  const fallback: ClarificationResult = buildClarificationFallback(input)

  return modelClient.callStructured({
    role: 'clarifier',
    model: resolveAgentModel('clarifier'),
    messages: [
      { role: 'system', content: clarifierSystemPrompt() },
      { role: 'user', content: clarifierUserPrompt(input.prompt, input.answers) },
    ],
    schema: ClarificationResultStructuredSchema,
    fallback,
  })
}

/**
 * Produce a deterministic build plan for the first supported reference circuit.
 * @param clarification Clarifier output.
 * @param modelClient Provider-neutral model client.
 */
async function planBuild(
  clarification: Extract<ClarificationResult, { status: 'ready' }>,
  modelClient: BerryModelClient,
): Promise<AgentBuildPlan> {
  const board = resolveBlinkBoard(
    [clarification.normalizedGoal, ...clarification.assumptions].join(' '),
  )
  const fallback: AgentBuildPlan = {
    goal: clarification.normalizedGoal,
    board,
    components: [
      { type: 'breadboard-full', role: 'bench' },
      { type: board, role: 'controller' },
      { type: 'resistor-220', role: 'current limiter' },
      { type: 'led-5mm', role: 'indicator' },
    ],
    behavior: {
      kind: 'blink',
      intervalMs: 500,
      description: 'Blink one LED every 500 ms.',
    },
    constraints: [
      'Use a current-limiting resistor.',
      'Use the final graph pin map for firmware.',
      'Keep Studio coordinates 2D-native with z = 0.',
    ],
  }

  return modelClient.callStructured({
    role: 'planner',
    model: resolveAgentModel('planner'),
    messages: [
      { role: 'system', content: plannerSystemPrompt() },
      { role: 'user', content: plannerUserPrompt(clarification) },
    ],
    schema: AgentBuildPlanStructuredSchema,
    fallback,
  })
}

/**
 * Ask the circuit design agent to select a bounded implementation strategy.
 * @param plan Hardware build plan.
 * @param modelClient Provider-neutral model client.
 */
async function selectCircuitIntent(
  plan: AgentBuildPlan,
  modelClient: BerryModelClient,
): Promise<AgentCircuitIntent> {
  const hasLedBlinkParts =
    (plan.board === 'esp32-devkit-v1' || plan.board === 'arduino-uno') &&
    plan.behavior.kind === 'blink' &&
    plan.components.some((component) => component.type === 'led-5mm') &&
    plan.components.some((component) => component.type === 'resistor-220')
  const isArduino = plan.board === 'arduino-uno'
  const signalPin = isArduino ? 'D13' : 'IO13'
  const groundPin = isArduino ? 'GND' : 'GND_R'
  const fallback: AgentCircuitIntent = hasLedBlinkParts
    ? {
        referenceCircuit: ledBlinkReferenceFor(plan.board),
        rationale: `The request matches the supported ${boardName(plan.board)} LED blink reference circuit.`,
        toolPlan: [
          `Set board to ${plan.board}.`,
          `Add ${boardName(plan.board)}, breadboard, 220 ohm resistor, and LED.`,
          `Connect ${signalPin} through the resistor to the LED anode.`,
          `Connect the LED cathode to ${groundPin}.`,
        ],
        toolCalls: ledBlinkToolCalls(plan.board),
      }
    : {
        referenceCircuit: 'unsupported',
        rationale: 'The requested circuit is outside the currently executable AI build slice.',
        toolPlan: [],
        toolCalls: [],
      }

  return modelClient.callStructured({
    role: 'circuit_designer',
    model: resolveAgentModel('circuit_designer'),
    messages: [
      { role: 'system', content: circuitDesignerSystemPrompt() },
      { role: 'user', content: circuitDesignerUserPrompt(plan) },
    ],
    schema: AgentCircuitIntentStructuredSchema,
    fallback,
  })
}

/**
 * Build a deterministic LED blink project for either supported board through
 * Studio tool wrappers, recording each tool call on the timeline.
 * @param state Current agent run state.
 * @param board Target board for the reference circuit.
 */
function designLedBlinkCircuit(state: AgentRunState, board: BoardId): AgentRunState {
  const isArduino = board === 'arduino-uno'
  const mcuId = isArduino ? 'arduino_1' : 'esp32_1'
  const signalPin = isArduino ? 'D13' : 'IO13'
  const groundPin = isArduino ? 'GND' : 'GND_R'

  let nextState = state
  let tool = isArduino
    ? studioCreateArduinoUnoLedBlinkProject()
    : studioCreateEsp32LedBlinkProject()
  nextState = { ...nextState, project: tool.project }
  nextState = appendTimelineEvent(nextState, 'Circuit designer', 'Created reference circuit', tool.summary)
  nextState = appendTimelineEvent(nextState, 'studio.set_board', `Selected ${boardName(board)} target`, `Set firmware target to ${board}.`)
  nextState = appendTimelineEvent(nextState, 'studio.add_component', 'Added current limiter', 'Added resistor-220 as resistor_1.')
  nextState = appendTimelineEvent(nextState, 'studio.add_component', 'Added LED indicator', 'Added led-5mm as led_1.')
  nextState = appendTimelineEvent(nextState, 'studio.connect_terminals', 'Connected GPIO through resistor', `Connected ${mcuId}.${signalPin} to resistor_1.pin1.`)
  nextState = appendTimelineEvent(nextState, 'studio.connect_terminals', 'Connected resistor to LED anode', 'Connected resistor_1.pin2 to led_1.anode.')
  nextState = appendTimelineEvent(nextState, 'studio.connect_terminals', 'Connected LED cathode to ground', `Connected led_1.cathode to ${mcuId}.${groundPin}.`)

  tool = studioAssertProjectGraph(nextState.project)
  nextState = { ...nextState, project: tool.project }
  return appendTimelineEvent(nextState, 'Project tools', 'Checked project graph', tool.summary, 'success')
}

/**
 * Execute model-authored Studio tool calls and record each tool result.
 * @param state Current agent run state.
 * @param calls Validated Studio tool calls from the circuit designer.
 */
function designCircuitFromToolCalls(
  state: AgentRunState,
  calls: StudioToolCall[],
): AgentRunState {
  const result = executeStudioToolCalls(createEmptyProject(), calls)
  let nextState: AgentRunState = {
    ...state,
    project: result.project,
    validationResults: result.validation,
  }

  for (const entry of result.log) {
    nextState = appendTimelineEvent(
      nextState,
      entry.tool,
      entry.ok ? 'Executed Studio tool' : 'Rejected Studio tool',
      entry.summary,
      entry.ok ? 'success' : 'error',
    )
  }

  if (!result.ok && result.error) {
    nextState = appendTimelineEvent(
      nextState,
      'Circuit designer',
      'Tool execution failed',
      result.error.message,
      'error',
    )
  }

  return nextState
}

/**
 * Create the initial run state.
 * @param input Agent run input.
 * @param clarification Clarifier output.
 */
function createInitialState(input: AgentRunInput, clarification: ClarificationResult): AgentRunState {
  const starter = input.project ?? studioCreateStarterProject().project
  return {
    runId: createRunId(),
    userPrompt: input.prompt,
    clarification,
    project: starter,
    firmwareFiles: {},
    validationResults: [],
    timeline: [],
  }
}

/**
 * Apply a human-readable planned project name after the design tools create a graph.
 * @param project Project graph produced by the circuit designer.
 * @param plan Build plan with the normalized user-facing goal.
 */
function applyPlannedProjectMetadata(
  project: AgentRunState['project'],
  plan: AgentBuildPlan,
): AgentRunState['project'] {
  const now = new Date().toISOString()
  return {
    ...project,
    metadata: {
      ...project.metadata,
      name: plan.goal.trim() || project.metadata.name,
      updatedAt: now,
    },
  }
}

/**
 * Return a scripted agent-loop result for an already prepared non-reference starter.
 * This mirrors the real workflow without spending model calls on starter paths.
 * @param input User prompt and current project context.
 * @param clarification Ready clarification for the review.
 */
function runScriptedStarterWorkflow(
  input: AgentRunInput,
  clarification: Extract<ClarificationResult, { status: 'ready' }>,
): AgentRunResult | null {
  if (!input.project || isLedBlinkPrompt(input.prompt)) return null

  let state = createInitialState(input, clarification)
  const validationResults = validate(state.project)
  state = { ...state, validationResults }
  state = appendTimelineEvent(
    state,
    'Clarifier',
    'Understood build goal',
    input.prompt,
    'success',
  )
  state = appendTimelineEvent(
    state,
    'Planner',
    'Selected starter architecture',
    `${state.project.components.length} placed parts on ${boardName(state.project.board)}.`,
    'success',
  )
  state = appendTimelineEvent(
    state,
    'Circuit designer',
    'Mapped component connections',
    `${state.project.nets.length} electrical nets are ready on the bench.`,
    'success',
  )
  state = appendTimelineEvent(
    state,
    'Validation agent',
    hasValidationErrors(validationResults) ? 'Circuit needs attention' : 'Circuit validation passed',
    hasValidationErrors(validationResults)
      ? validationResults.filter((result) => result.severity === 'error').map((result) => result.message).join(' ')
      : 'No blocking wiring errors.',
    hasValidationErrors(validationResults) ? 'warning' : 'success',
  )
  state = appendTimelineEvent(
    state,
    'Next-step agent',
    'Waiting for builder direction',
    'The next turn decides whether to explain, modify, or generate firmware.',
    'success',
  )

  return { ok: true, status: 'completed', state }
}

/**
 * Run the first Phase 6 multi-agent workflow slice.
 * @param input User prompt and optional existing project context.
 * @param modelClient Optional provider-neutral model client.
 */
export async function runAgentWorkflow(
  input: AgentRunInput,
  modelClient?: BerryModelClient,
): Promise<AgentRunResult> {
  const client = modelClient ?? createWorkflowModelClient(input)
  const clarification = await clarifyGoal(input, client)
  if (clarification.status === 'ready') {
    const scripted = runScriptedStarterWorkflow(input, clarification)
    if (scripted) return scripted
  }
  let state = createInitialState(input, clarification)
  state = appendTimelineEvent(state, 'Clarifier', 'Read user request', input.prompt)

  if (clarification.status === 'needs_clarification') {
    state = appendTimelineEvent(
      state,
      'Clarifier',
      'Needs clarification',
      clarification.questions.map((question) => question.question).join(' '),
      'warning',
    )
    return { ok: false, status: 'needs_clarification', state }
  }

  state = appendTimelineEvent(
    state,
    'Clarifier',
    'Proceeding with assumptions',
    clarification.assumptions.join(' '),
    'success',
  )

  const plan = await planBuild(clarification, client)
  state = { ...state, plan }
  state = appendTimelineEvent(
    state,
    'Planner',
    `Planned ${boardName(plan.board)} LED blink`,
    `${plan.components.length} parts, ${plan.behavior.description}`,
    'success',
  )

  try {
    const circuitIntent = await selectCircuitIntent(plan, client)
    state = { ...state, circuitIntent }
    const isSupportedReference =
      circuitIntent.referenceCircuit === 'esp32_led_blink' ||
      circuitIntent.referenceCircuit === 'arduino_uno_led_blink'
    state = appendTimelineEvent(
      state,
      'Circuit designer',
      isSupportedReference
        ? `Selected ${boardName(plan.board)} LED reference`
        : 'Circuit unsupported',
      circuitIntent.rationale,
      isSupportedReference ? 'success' : 'warning',
    )

    if (!isSupportedReference) {
      return {
        ok: false,
        status: 'needs_clarification',
        state: {
          ...state,
          clarification: {
            status: 'needs_clarification',
            questions: [
              {
                id: 'supported_reference',
                question: 'Which supported blinking LED reference circuit should Berry build?',
                reason: circuitIntent.rationale,
                options: ['ESP32 blinking LED', 'Arduino Uno blinking LED'],
              },
            ],
          },
        },
      }
    }

    const targetBoard = boardForReference(circuitIntent.referenceCircuit)
    if (targetBoard !== plan.board) {
      state = appendTimelineEvent(
        state,
        'Circuit designer',
        'Board/reference mismatch',
        `Planner chose ${plan.board}, but circuit designer selected ${circuitIntent.referenceCircuit}.`,
        'error',
      )
      return {
        ok: false,
        status: 'failed',
        state,
        error: 'Circuit designer selected a reference circuit that does not match the planned board.',
      }
    }

    state =
      circuitIntent.toolCalls.length > 0
        ? designCircuitFromToolCalls(state, circuitIntent.toolCalls)
        : designLedBlinkCircuit(state, targetBoard)
    state = { ...state, project: applyPlannedProjectMetadata(state.project, plan) }
    const validationResults = validate(state.project)
    state = { ...state, validationResults }

    if (hasValidationErrors(validationResults)) {
      state = appendTimelineEvent(
        state,
        'Validation agent',
        'Circuit validation failed',
        validationResults.filter((result) => result.severity === 'error').map((result) => result.message).join(' '),
        'error',
      )
      return { ok: false, status: 'failed', state, error: 'Circuit validation failed' }
    }

    state = appendTimelineEvent(state, 'Validation agent', 'Circuit validation passed', undefined, 'success')

    const codegenResult = generateFirmwareFromProject(state.project)
    const firmwareFiles = { [DEFAULT_FIRMWARE_PATH]: codegenResult.source }
    state = { ...state, codegenResult, firmwareFiles }
    state = appendTimelineEvent(
      state,
      'Firmware agent',
      'Generated firmware from pin map',
      codegenResult.notes.join(' '),
      codegenResult.ok ? 'success' : 'warning',
    )

    const buildResult = await compileWithMock({
      project: state.project,
      files: { [DEFAULT_FIRMWARE_PATH]: codegenResult.source },
    })
    state = { ...state, buildResult }

    if (!buildResult.ok || !buildResult.artifact) {
      state = appendTimelineEvent(
        state,
        'Build agent',
        'Build failed',
        buildResult.diagnostics.map((diagnostic) => diagnostic.message).join(' '),
        'error',
      )
      return { ok: false, status: 'failed', state, error: 'Build failed' }
    }

    state = appendTimelineEvent(
      state,
      'Build agent',
      'Build passed',
      `Artifact ${buildResult.artifact.firmwareHash.slice(0, 12)}…`,
      'success',
    )

    const simulationResult = simulateProject({
      project: state.project,
      artifact: { firmwareHash: buildResult.artifact.firmwareHash },
      files: { [DEFAULT_FIRMWARE_PATH]: codegenResult.source },
    })
    state = { ...state, simulationResult }

    if (simulationResult.status !== 'passed') {
      state = appendTimelineEvent(
        state,
        'Simulation agent',
        'Simulation did not pass',
        simulationResult.errors.map((error) => error.message).join(' '),
        'error',
      )
      return { ok: false, status: 'failed', state, error: 'Simulation failed' }
    }

    state = appendTimelineEvent(
      state,
      'Simulation agent',
      'Simulation passed',
      `${simulationResult.logs.length} serial/sim log lines`,
      'success',
    )

    const deterministicGuide = generateWiringGuide(state.project, codegenResult, validationResults)
    const guideDraft = await client.callStructured({
      role: 'wiring_guide',
      model: resolveAgentModel('wiring_guide'),
      messages: [
        { role: 'system', content: wiringGuideSystemPrompt() },
        { role: 'user', content: wiringGuideUserPrompt(deterministicGuide) },
      ],
      schema: WiringGuideDraftStructuredSchema,
      fallback: { markdown: deterministicGuide },
    })
    const wiringGuide = guideDraft.markdown
    state = { ...state, wiringGuide }
    state = appendTimelineEvent(
      state,
      'Wiring guide agent',
      'Generated real-world wiring guide',
      'Instructions are based on the final validated graph.',
      'success',
    )

    return { ok: true, status: 'completed', state }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Agent workflow failed'
    state = appendTimelineEvent(state, 'Agent workflow', 'Run failed', message, 'error')
    return { ok: false, status: 'failed', state, error: message }
  }
}

/**
 * Resolve the model client for one workflow input.
 * @param input Agent run input.
 */
function createWorkflowModelClient(input: AgentRunInput): BerryModelClient {
  if (input.mode === 'deterministic') {
    return new DeterministicModelClient()
  }
  return createDefaultModelClient()
}
