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
