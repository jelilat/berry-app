import { describe, expect, it } from 'vitest'
import {
  hostedAgentProjectErrorMessage,
  normalizeHostedAgentRunJson,
} from './proxy-response'

/**
 * Build a minimal hosted terminal run payload with a project graph.
 * @param project Project payload to embed in the run result.
 */
function hostedRunWithProject(project: unknown): unknown {
  return {
    runId: 'agent_123',
    status: 'completed',
    result: {
      ok: true,
      status: 'completed',
      state: {
        runId: 'agent_123',
        userPrompt: 'Blink an LED',
        clarification: {
          status: 'ready',
          normalizedGoal: 'Blink an LED',
          assumptions: [],
        },
        project,
        firmwareFiles: {},
        validationResults: [],
        timeline: [],
      },
    },
  }
}

describe('normalizeHostedAgentRunJson', () => {
  it('normalizes a valid hosted project before Studio receives it', () => {
    const normalized = normalizeHostedAgentRunJson(
      hostedRunWithProject({
        version: 1,
        board: 'esp32-devkit-v1',
        metadata: { name: 'Valid hosted project' },
        components: [
          {
            id: 'breadboard_1',
            type: 'breadboard-full',
            transform: { position: { x: 0, y: 0, z: 0 } },
            placement: { sites: {} },
          },
        ],
        nets: [],
        wires: [],
      }),
    ) as { result: { state: { project: { components: Array<{ placement?: unknown }> } } } }

    expect(normalized.result.state.project.components[0].placement).toBeUndefined()
  })

  it('normalizes a partial workflow state before Studio visualizes it mid-run', () => {
    const normalized = normalizeHostedAgentRunJson({
      runId: 'agent_123',
      status: 'running',
      state: {
        runId: 'agent_123',
        userPrompt: 'Blink an LED',
        clarification: {
          status: 'ready',
          normalizedGoal: 'Blink an LED',
          assumptions: [],
        },
        circuitIntent: {
          referenceCircuit: 'esp32_led_blink',
          rationale: 'Use the supported ESP32 LED reference circuit.',
          toolPlan: [],
          toolCalls: [],
        },
        project: {
          version: 1,
          board: 'esp32-devkit-v1',
          metadata: { name: 'Partial hosted project' },
          components: [
            {
              id: 'breadboard_1',
              type: 'breadboard-full',
              transform: { position: { x: 0, y: 0, z: 0 } },
              placement: { sites: {} },
            },
          ],
          nets: [],
          wires: [],
        },
        firmwareFiles: {},
        validationResults: [],
        timeline: [],
      },
    }) as { state: { project: { components: Array<{ placement?: unknown }> } } }

    expect(normalized.state.project.components[0].placement).toBeUndefined()
  })

  it('normalizes a partial result before Studio visualizes it mid-run', () => {
    const partialResult = hostedRunWithProject({
      version: 1,
      board: 'esp32-devkit-v1',
      metadata: { name: 'Partial result project' },
      components: [
        {
          id: 'breadboard_1',
          type: 'breadboard-full',
          transform: { position: { x: 0, y: 0, z: 0 } },
          placement: { sites: {} },
        },
      ],
      nets: [],
      wires: [],
    }) as { result: unknown }

    const normalized = normalizeHostedAgentRunJson({
      runId: 'agent_123',
      status: 'running',
      partialResult: partialResult.result,
    }) as { partialResult: { state: { project: { components: Array<{ placement?: unknown }> } } } }

    expect(normalized.partialResult.state.project.components[0].placement).toBeUndefined()
  })

  it('rejects hosted projects with placements referencing a missing breadboard parent', () => {
    expect(() =>
      normalizeHostedAgentRunJson(
        hostedRunWithProject({
          version: 1,
          board: 'esp32-devkit-v1',
          metadata: { name: 'Invalid hosted project' },
          components: [
            {
              id: 'led_1',
              type: 'led-5mm',
              parent: 'breadboard_1',
              transform: { position: { x: 0, y: 0, z: 0 } },
              placement: {
                sites: {
                  anode: { kind: 'hole', block: 'top', row: 'a', column: 1 },
                  cathode: { kind: 'hole', block: 'top', row: 'a', column: 2 },
                },
              },
            },
          ],
          nets: [],
          wires: [],
        }),
      ),
    ).toThrow('Component led_1 references unknown parent breadboard_1')
  })

  it('accepts hosted PIR projects with HC-SR501 terminal placements', () => {
    const normalized = normalizeHostedAgentRunJson(
      hostedRunWithProject({
        version: 1,
        board: 'esp32-devkit-v1',
        metadata: { name: 'PIR hosted project' },
        components: [
          {
            id: 'breadboard_1',
            type: 'breadboard-full',
            transform: { position: { x: 0, y: 0, z: 0 } },
          },
          {
            id: 'pir_1',
            type: 'pir-motion-sensor-hc-sr501',
            parent: 'breadboard_1',
            transform: { position: { x: 0, y: 0, z: 0 } },
            placement: {
              sites: {
                VCC: { kind: 'hole', block: 'top', row: 'a', column: 5 },
                OUT: { kind: 'hole', block: 'top', row: 'a', column: 6 },
                GND: { kind: 'hole', block: 'top', row: 'a', column: 7 },
              },
            },
          },
        ],
        nets: [],
        wires: [],
      }),
    ) as { result: { state: { project: { components: Array<{ type: string; placement?: unknown }> } } } }

    expect(normalized.result.state.project.components[1]).toMatchObject({
      type: 'pir-motion-sensor-hc-sr501',
      placement: {
        sites: {
          VCC: { column: 5 },
          OUT: { column: 6 },
          GND: { column: 7 },
        },
      },
    })
  })
})

describe('hostedAgentProjectErrorMessage', () => {
  it('formats project parse failures for the proxy response', () => {
    let caught: unknown
    try {
      normalizeHostedAgentRunJson(
        hostedRunWithProject({
          version: 1,
          board: 'esp32-devkit-v1',
          metadata: { name: 'Invalid hosted project' },
          components: [
            {
              id: 'led_1',
              type: 'led-5mm',
              transform: { position: { x: 0, y: 0, z: 0 } },
              placement: {
                sites: {
                  anode: { kind: 'hole', block: 'top', row: 'a', column: 1 },
                },
              },
            },
          ],
          nets: [],
          wires: [],
        }),
      )
    } catch (error) {
      caught = error
    }

    expect(hostedAgentProjectErrorMessage(caught)).toBe(
      'Agent API returned invalid project: Component led_1 has placement but parent is not a breadboard',
    )
  })
})
