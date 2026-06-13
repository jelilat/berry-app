import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { DEFAULT_FIRMWARE_PATH } from '@/lib/firmware/source'
import { loadBerryProjectFromJson } from '@/lib/project/io'
import { hasValidationErrors } from '@/lib/validation'
import type { BerryModelClient, StructuredModelRequest } from '@/lib/ai/model-client'
import type { AgentReferenceCircuit } from './types'
import { runAgentWorkflow } from './workflow'

class FakeModelClient implements BerryModelClient {
  calls: string[] = []
  private readonly referenceCircuit: AgentReferenceCircuit

  /**
   * Create a fake model that can optionally disagree with the planner.
   * @param referenceCircuit Circuit reference returned by the circuit-designer role.
   */
  constructor(referenceCircuit: AgentReferenceCircuit = 'esp32_led_blink') {
    this.referenceCircuit = referenceCircuit
  }

  /**
   * Return model-like structured values for each agent role.
   * @param request Structured model request.
   */
  async callStructured<T>(request: StructuredModelRequest<T>): Promise<T> {
    this.calls.push(request.role)
    if (request.role === 'clarifier') {
      return request.schema.validate({
        status: 'ready',
        normalizedGoal: 'Model planned ESP32 blink',
        assumptions: ['Model chose the supported LED blink reference.'],
        questions: [],
      })
    }
    if (request.role === 'planner') {
      return request.schema.validate({
        goal: 'Model planned ESP32 blink',
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
          description: 'Blink from a model-authored plan.',
        },
        constraints: ['Use a resistor.'],
      })
    }
    if (request.role === 'circuit_designer') {
      return request.schema.validate({
        referenceCircuit: this.referenceCircuit,
        rationale: 'Model selected the executable reference circuit.',
        toolPlan: ['Build ESP32 LED blink reference.'],
        toolCalls:
          this.referenceCircuit === 'esp32_led_blink'
            ? [
                { tool: 'studio.set_board', board: 'esp32-devkit-v1' },
                {
                  tool: 'studio.add_component',
                  componentType: 'esp32-devkit-v1',
                  id: 'esp32_1',
                  x: -0.08,
                  y: 0.03,
                },
                {
                  tool: 'studio.add_component',
                  componentType: 'breadboard-full',
                  id: 'breadboard_1',
                  x: 0,
                  y: 0,
                },
                {
                  tool: 'studio.add_component',
                  componentType: 'resistor-220',
                  id: 'resistor_1',
                  x: 0.14,
                  y: 0.05,
                },
                {
                  tool: 'studio.add_component',
                  componentType: 'led-5mm',
                  id: 'led_1',
                  x: 0.18,
                  y: 0.05,
                },
                {
                  tool: 'studio.connect_terminals',
                  from: { componentId: 'esp32_1', terminalId: 'IO13' },
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
                  to: { componentId: 'esp32_1', terminalId: 'GND_R' },
                  color: 'black',
                },
                { tool: 'project.validate' },
              ]
            : [],
      })
    }
    if (request.role === 'wiring_guide') {
      return request.schema.validate({
        markdown:
          '# Wiring guide\n\nModel-authored guide from final graph. Deploy is coming soon. Keep the resistor in series with the LED.',
      })
    }
    return request.schema.validate(request.fallback)
  }
}

describe('runAgentWorkflow', () => {
  it('asks for clarification when the request is outside the first supported demo path', async () => {
    const result = await runAgentWorkflow({ prompt: 'Build me a temperature monitor' })

    expect(result.ok).toBe(false)
    expect(result.status).toBe('needs_clarification')
    expect(result.state.clarification.status).toBe('needs_clarification')
  })

  it('runs the scripted starter loop for a loaded non-blink project', async () => {
    const json = readFileSync(
      path.join(process.cwd(), 'examples', 'arduino-calculator.project.json'),
      'utf8',
    )
    const project = loadBerryProjectFromJson(json)
    const result = await runAgentWorkflow({
      prompt: 'Build a simple calculator with buttons and a display',
      project,
    })

    expect(result.ok).toBe(true)
    expect(result.status).toBe('completed')
    expect(result.state.project.metadata.name).toBe('Arduino calculator')
    expect(result.state.timeline.some((event) => event.agent === 'Planner')).toBe(true)
    expect(result.state.timeline.some((event) => event.agent === 'Next-step agent')).toBe(true)
    expect(result.state.buildResult).toBeUndefined()
  })

  it('builds the deterministic ESP32 LED blink workflow', async () => {
    const result = await runAgentWorkflow({ prompt: 'Build me an ESP32 blinking LED' })

    expect(result.ok).toBe(true)
    expect(result.status).toBe('completed')
    expect(result.state.project.board).toBe('esp32-devkit-v1')
    expect(result.state.circuitIntent?.referenceCircuit).toBe('esp32_led_blink')
    expect(result.state.project.components.some((component) => component.id === 'led_1')).toBe(true)
    expect(result.state.project.components.some((component) => component.id === 'resistor_1')).toBe(true)
    expect(hasValidationErrors(result.state.validationResults)).toBe(false)
    expect(result.state.firmwareFiles[DEFAULT_FIRMWARE_PATH]).toContain('LED_1_PIN')
    expect(result.state.buildResult?.ok).toBe(true)
    expect(result.state.simulationResult?.status).toBe('passed')
    expect(result.state.wiringGuide).toContain('Wiring guide')
    expect(result.state.wiringGuide).toContain('Deploy is coming soon')
    expect(result.state.timeline.some((event) => event.agent === 'Wiring guide agent')).toBe(true)
  })

  it('builds the deterministic Arduino Uno LED blink workflow', async () => {
    const result = await runAgentWorkflow({ prompt: 'Build me an Arduino Uno blinking LED' })

    expect(result.ok).toBe(true)
    expect(result.status).toBe('completed')
    expect(result.state.project.board).toBe('arduino-uno')
    expect(result.state.circuitIntent?.referenceCircuit).toBe('arduino_uno_led_blink')
    expect(result.state.project.components.some((component) => component.type === 'arduino-uno')).toBe(
      true,
    )
    expect(result.state.project.components.some((component) => component.id === 'led_1')).toBe(true)
    expect(result.state.project.components.some((component) => component.id === 'resistor_1')).toBe(true)
    expect(hasValidationErrors(result.state.validationResults)).toBe(false)
    expect(result.state.firmwareFiles[DEFAULT_FIRMWARE_PATH]).toContain('LED_1_PIN = 13')
    expect(result.state.buildResult?.ok).toBe(true)
    expect(result.state.simulationResult?.status).toBe('passed')
    expect(result.state.wiringGuide).toContain('Arduino UNO')
  })

  it('defaults an unspecified LED blink to ESP32 and records the assumption', async () => {
    const result = await runAgentWorkflow({ prompt: 'Make an LED blink' })

    expect(result.ok).toBe(true)
    expect(result.state.project.board).toBe('esp32-devkit-v1')
    expect(
      result.state.clarification.status === 'ready' &&
        result.state.clarification.assumptions.some((assumption) =>
          assumption.toLowerCase().includes('defaulting'),
        ),
    ).toBe(true)
  })

  it('uses structured model calls when a provider client is supplied', async () => {
    const client = new FakeModelClient()
    const result = await runAgentWorkflow({ prompt: 'Make the LED blink', mode: 'real' }, client)

    expect(result.ok).toBe(true)
    expect(result.state.plan?.goal).toBe('Model planned ESP32 blink')
    expect(result.state.circuitIntent?.rationale).toContain('Model selected')
    expect(result.state.timeline.some((event) => event.agent === 'studio.connect_terminals')).toBe(true)
    expect(result.state.wiringGuide).toContain('Model-authored guide')
    expect(client.calls).toEqual(['clarifier', 'planner', 'circuit_designer', 'wiring_guide'])
  })

  it('fails when a real-model circuit reference disagrees with the planned board', async () => {
    const client = new FakeModelClient('arduino_uno_led_blink')
    const result = await runAgentWorkflow({ prompt: 'Make the LED blink', mode: 'real' }, client)

    expect(result.ok).toBe(false)
    expect(result.status).toBe('failed')
    expect(result.error).toContain('does not match the planned board')
    expect(result.state.timeline.some((event) => event.title === 'Board/reference mismatch')).toBe(true)
  })
})
