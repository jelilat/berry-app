import { describe, expect, it } from 'vitest'
import { createEmptyProject } from '@/lib/project/mutations'
import { hasValidationErrors } from '@/lib/validation'
import { executeStudioToolCalls } from './executor'
import type { StudioToolCall } from './calls'

/**
 * Build a breadboard-free base project plus the calls that add an MCU.
 * Avoiding a breadboard keeps placement out of the way so the test focuses on
 * the executor contract rather than hole-snapping geometry.
 */
function baseProjectWithMcu(): StudioToolCall[] {
  return [
    { tool: 'studio.set_board', board: 'esp32-devkit-v1' },
    { tool: 'studio.add_component', componentType: 'esp32-devkit-v1', id: 'esp32_1', x: 0.1, y: 0.1 },
  ]
}

describe('executeStudioToolCalls', () => {
  it('applies a valid LED blink batch and validates the final graph', () => {
    const calls: StudioToolCall[] = [
      ...baseProjectWithMcu(),
      { tool: 'studio.add_component', componentType: 'resistor-220', id: 'resistor_1', x: 0.3, y: 0.2 },
      { tool: 'studio.add_component', componentType: 'led-5mm', id: 'led_1', x: 0.5, y: 0.3 },
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

    const result = executeStudioToolCalls(createEmptyProject(), calls)

    expect(result.ok).toBe(true)
    expect(result.error).toBeUndefined()
    expect(result.project.components.some((component) => component.id === 'led_1')).toBe(true)
    expect(hasValidationErrors(result.validation)).toBe(false)
    // Validation runs after the batch regardless of explicit project.validate calls.
    expect(Array.isArray(result.validation)).toBe(true)
    expect(result.log.some((entry) => entry.tool === 'project.validate')).toBe(true)
  })

  it('rejects an unknown component type', () => {
    const calls = [
      ...baseProjectWithMcu(),
      { tool: 'studio.add_component', componentType: 'not-a-real-part', id: 'x_1', x: 0.3, y: 0.2 },
    ] as unknown as StudioToolCall[]

    const result = executeStudioToolCalls(createEmptyProject(), calls)

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe('unknown_component_type')
  })

  it('rejects an unknown component id when connecting terminals', () => {
    const calls: StudioToolCall[] = [
      ...baseProjectWithMcu(),
      {
        tool: 'studio.connect_terminals',
        from: { componentId: 'ghost_1', terminalId: 'IO13' },
        to: { componentId: 'esp32_1', terminalId: 'GND_R' },
      },
    ]

    const result = executeStudioToolCalls(createEmptyProject(), calls)

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe('invalid_endpoint')
  })

  it('rejects an unknown terminal id when connecting terminals', () => {
    const calls: StudioToolCall[] = [
      ...baseProjectWithMcu(),
      {
        tool: 'studio.connect_terminals',
        from: { componentId: 'esp32_1', terminalId: 'NOT_A_PIN' },
        to: { componentId: 'esp32_1', terminalId: 'GND_R' },
      },
    ]

    const result = executeStudioToolCalls(createEmptyProject(), calls)

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe('invalid_endpoint')
  })

  it('rejects moving an unknown component', () => {
    const calls: StudioToolCall[] = [
      ...baseProjectWithMcu(),
      { tool: 'studio.move_component', id: 'ghost_1', x: 0.5, y: 0.5 },
    ]

    const result = executeStudioToolCalls(createEmptyProject(), calls)

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe('mutation_failed')
  })
})
