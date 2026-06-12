import { describe, expect, it } from 'vitest'
import { DEFAULT_FIRMWARE_PATH } from '@/lib/firmware/source'
import { hasValidationErrors } from '@/lib/validation'
import type { BerryModelClient, StructuredModelRequest } from '@/lib/ai/model-client'
import { runAgentWorkflow } from './workflow'

class FakeModelClient implements BerryModelClient {
  calls: string[] = []

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
        referenceCircuit: 'esp32_led_blink',
        rationale: 'Model selected the executable reference circuit.',
        toolPlan: ['Build ESP32 LED blink reference.'],
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

  it('builds the deterministic ESP32 LED blink workflow', async () => {
    const result = await runAgentWorkflow({ prompt: 'Build me an ESP32 blinking LED' })

    expect(result.ok).toBe(true)
    expect(result.status).toBe('completed')
    expect(result.state.project.board).toBe('esp32-devkit-v1')
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

  it('uses structured model calls when a provider client is supplied', async () => {
    const client = new FakeModelClient()
    const result = await runAgentWorkflow({ prompt: 'Make the LED blink', mode: 'real' }, client)

    expect(result.ok).toBe(true)
    expect(result.state.plan?.goal).toBe('Model planned ESP32 blink')
    expect(result.state.circuitIntent?.rationale).toContain('Model selected')
    expect(result.state.wiringGuide).toContain('Model-authored guide')
    expect(client.calls).toEqual(['clarifier', 'planner', 'circuit_designer', 'wiring_guide'])
  })
})
