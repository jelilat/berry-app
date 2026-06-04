import { describe, expect, it } from 'vitest'
import { breadboardHole } from '@/lib/project/breadboard'
import {
  connectedTerminalKeys,
  isBreadboardEndpointOccupied,
  isTerminalConnected,
  terminalBreadboardEndpoint,
  terminalOccupiesBreadboardEndpoint,
  wirePinHighlight,
} from './connect-pins'

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

  it('resolves a placed pin to its breadboard hole', () => {
    const project = {
      version: 1 as const,
      board: 'esp32-devkit-v1' as const,
      metadata: { name: 'test' },
      components: [
        {
          id: 'breadboard_1',
          type: 'breadboard-full' as const,
          transform: { position: { x: 0, y: 0, z: 0 } },
        },
        {
          id: 'led_1',
          type: 'led-5mm' as const,
          parent: 'breadboard_1',
          transform: { position: { x: 0.1, y: 0.1, z: 0 } },
          placement: {
            sites: {
              anode: breadboardHole('a', 12),
            },
          },
        },
      ],
      nets: [],
      wires: [],
    }
    const endpoint = {
      breadboardId: 'breadboard_1',
      site: breadboardHole('a', 12),
    }

    expect(terminalBreadboardEndpoint(project, 'led_1', 'anode')).toEqual(endpoint)
    expect(
      terminalOccupiesBreadboardEndpoint(project, 'led_1', 'anode', endpoint),
    ).toBe(true)
    expect(
      terminalOccupiesBreadboardEndpoint(project, 'led_1', 'anode', {
        breadboardId: 'breadboard_1',
        site: breadboardHole('a', 13),
      }),
    ).toBe(false)
  })

  it('marks placed pins unavailable and their holes occupied', () => {
    const project = {
      version: 1 as const,
      board: 'esp32-devkit-v1' as const,
      metadata: { name: 'test' },
      components: [
        {
          id: 'breadboard_1',
          type: 'breadboard-full' as const,
          transform: { position: { x: 0, y: 0, z: 0 } },
        },
        {
          id: 'button_1',
          type: 'push-button' as const,
          parent: 'breadboard_1',
          transform: { position: { x: 0.1, y: 0.1, z: 0 } },
          placement: {
            sites: {
              pin1: breadboardHole('e', 20),
            },
          },
        },
      ],
      nets: [],
      wires: [],
    }

    const keys = connectedTerminalKeys(project)

    expect(isTerminalConnected(keys, 'button_1', 'pin1')).toBe(true)
    expect(
      isBreadboardEndpointOccupied(project, {
        breadboardId: 'breadboard_1',
        site: breadboardHole('e', 20),
      }),
    ).toBe(true)
    expect(
      isBreadboardEndpointOccupied(project, {
        breadboardId: 'breadboard_1',
        site: breadboardHole('e', 21),
      }),
    ).toBe(false)
  })
})
