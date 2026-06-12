import { compileWithMock } from '@/lib/build/mock'
import { DEFAULT_FIRMWARE_PATH } from '@/lib/firmware/source'
import { generateFirmwareFromProject } from '@/lib/codegen/generate'
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
  studioCreateEsp32LedBlinkProject,
  studioCreateStarterProject,
} from './tools/studio'
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
 * Produce deterministic clarification output for the first Phase 6 slice.
 * @param input Agent run input.
 * @param modelClient Provider-neutral model client.
 */
async function clarifyGoal(
  input: AgentRunInput,
  modelClient: BerryModelClient,
): Promise<ClarificationResult> {
  const fallback: ClarificationResult = isLedBlinkPrompt(input.prompt)
    ? {
        status: 'ready',
        normalizedGoal: 'ESP32 LED blink',
        assumptions: [
          'Use ESP32 DevKit V1 as the controller.',
          'Use one 220 ohm resistor in series with the LED.',
          'Blink interval is 500 ms on and 500 ms off.',
        ],
      }
    : {
        status: 'needs_clarification',
        questions: [
          {
            id: 'reference_circuit',
            question: 'Which reference circuit should Berry build first?',
            reason: 'The current Phase 6 implementation supports the ESP32 LED blink path first.',
            options: ['ESP32 blinking LED'],
          },
        ],
      }

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
  const fallback: AgentBuildPlan = {
    goal: clarification.normalizedGoal,
    board: 'esp32-devkit-v1',
    components: [
      { type: 'breadboard-full', role: 'bench' },
      { type: 'esp32-devkit-v1', role: 'controller' },
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
    plan.board === 'esp32-devkit-v1' &&
    plan.behavior.kind === 'blink' &&
    plan.components.some((component) => component.type === 'led-5mm') &&
    plan.components.some((component) => component.type === 'resistor-220')
  const fallback: AgentCircuitIntent = hasLedBlinkParts
    ? {
        referenceCircuit: 'esp32_led_blink',
        rationale: 'The request matches the supported ESP32 LED blink reference circuit.',
        toolPlan: [
          'Set board to esp32-devkit-v1.',
          'Add ESP32 DevKit V1, breadboard, 220 ohm resistor, and LED.',
          'Connect IO13 through the resistor to the LED anode.',
          'Connect the LED cathode to GND_R.',
        ],
      }
    : {
        referenceCircuit: 'unsupported',
        rationale: 'The requested circuit is outside the currently executable AI build slice.',
        toolPlan: [],
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
 * Build the deterministic ESP32 LED blink project through Studio tool wrappers.
 * @param state Current agent run state.
 */
function designEsp32LedCircuit(state: AgentRunState): AgentRunState {
  let nextState = state
  let tool = studioCreateEsp32LedBlinkProject()
  nextState = { ...nextState, project: tool.project }
  nextState = appendTimelineEvent(nextState, 'Circuit designer', 'Created reference circuit', tool.summary)
  nextState = appendTimelineEvent(nextState, 'studio.set_board', 'Selected ESP32 target', 'Set firmware target to esp32-devkit-v1.')
  nextState = appendTimelineEvent(nextState, 'studio.add_component', 'Added current limiter', 'Added resistor-220 as resistor_1.')
  nextState = appendTimelineEvent(nextState, 'studio.add_component', 'Added LED indicator', 'Added led-5mm as led_1.')
  nextState = appendTimelineEvent(nextState, 'studio.connect_terminals', 'Connected GPIO through resistor', 'Connected esp32_1.IO13 to resistor_1.pin1.')
  nextState = appendTimelineEvent(nextState, 'studio.connect_terminals', 'Connected resistor to LED anode', 'Connected resistor_1.pin2 to led_1.anode.')
  nextState = appendTimelineEvent(nextState, 'studio.connect_terminals', 'Connected LED cathode to ground', 'Connected led_1.cathode to esp32_1.GND_R.')

  tool = studioAssertProjectGraph(nextState.project)
  nextState = { ...nextState, project: tool.project }
  return appendTimelineEvent(nextState, 'Project tools', 'Checked project graph', tool.summary, 'success')
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
    'Planned ESP32 LED blink',
    `${plan.components.length} parts, ${plan.behavior.description}`,
    'success',
  )

  try {
    const circuitIntent = await selectCircuitIntent(plan, client)
    state = { ...state, circuitIntent }
    state = appendTimelineEvent(
      state,
      'Circuit designer',
      circuitIntent.referenceCircuit === 'esp32_led_blink'
        ? 'Selected ESP32 LED reference'
        : 'Circuit unsupported',
      circuitIntent.rationale,
      circuitIntent.referenceCircuit === 'esp32_led_blink' ? 'success' : 'warning',
    )

    if (circuitIntent.referenceCircuit !== 'esp32_led_blink') {
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
                question: 'Can I build the supported ESP32 blinking LED reference circuit first?',
                reason: circuitIntent.rationale,
                options: ['ESP32 blinking LED'],
              },
            ],
          },
        },
      }
    }

    state = designEsp32LedCircuit(state)
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
