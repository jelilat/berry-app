import { describe, expect, it } from 'vitest'
import { connectedTerminalKeys, isTerminalConnected, wirePinHighlight } from './connect-pins'

describe('wirePinHighlight', () => {
  const draft = {
    from: { componentId: 'esp32_1', terminalId: 'IO13' },
    startPx: { x: 0, y: 0 },
    cursorPx: { x: 1, y: 1 },
    hoverTarget: { componentId: 'led_1', terminalId: 'anode' },
    hoverTargetPx: { x: 2, y: 2 },
  }

  it('marks source and target pins during drag', () => {
    expect(wirePinHighlight('esp32_1', 'IO13', draft, draft.hoverTarget)).toBe('source')
    expect(wirePinHighlight('led_1', 'anode', draft, draft.hoverTarget)).toBe('target')
    expect(wirePinHighlight('led_1', 'cathode', draft, draft.hoverTarget)).toBe(null)
  })

  it('indexes connected terminals from project nets', () => {
    const keys = connectedTerminalKeys({
      version: 1,
      board: 'esp32-devkit-v1',
      metadata: { name: 'test' },
      components: [],
      nets: [
        {
          id: 'net_1',
          terminals: [
            { component: 'esp32_1', terminal: 'IO13' },
            { component: 'led_1', terminal: 'anode' },
          ],
        },
      ],
      wires: [],
    })

    expect(isTerminalConnected(keys, 'esp32_1', 'IO13')).toBe(true)
    expect(isTerminalConnected(keys, 'esp32_1', 'IO22')).toBe(false)
  })
})
