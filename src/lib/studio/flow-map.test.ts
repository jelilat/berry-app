import { describe, expect, it } from 'vitest'
import { parseBerryProject } from '@/lib/project/io'
import { projectToFlowEdges, projectToFlowNodes } from './flow-map'
import { componentPixelSize } from './layout'

describe('projectToFlowNodes', () => {
  it('marks terminals that are already connected', () => {
    const project = parseBerryProject({
      version: 1,
      board: 'esp32-devkit-v1',
      metadata: { name: 'connected pins' },
      components: [
        {
          id: 'esp32_1',
          type: 'esp32-devkit-v1',
          transform: { position: { x: 0, y: 0, z: 0 } },
        },
        {
          id: 'led_1',
          type: 'led-5mm',
          transform: { position: { x: 0.2, y: 0, z: 0 } },
        },
      ],
      nets: [
        {
          id: 'net_1',
          terminals: [
            { component: 'esp32_1', terminal: 'IO13' },
            { component: 'led_1', terminal: 'anode' },
          ],
        },
      ],
      wires: [
        {
          id: 'wire_1',
          net: 'net_1',
          points: [
            { x: 0, y: 0, z: 0 },
            { x: 0.1, y: 0, z: 0 },
          ],
        },
      ],
    })

    const nodes = projectToFlowNodes(project, null)
    const esp = nodes.find((node) => node.id === 'esp32_1')!
    const led = nodes.find((node) => node.id === 'led_1')!

    expect(esp.data.connectedTerminalIds).toContain('IO13')
    expect(esp.data.connectedTerminalIds).not.toContain('IO22')
    expect(led.data.connectedTerminalIds).toEqual(['anode'])
  })

  it('stretches flexible placed parts to their edited breadboard holes', () => {
    const project = parseBerryProject({
      version: 1,
      board: 'esp32-devkit-v1',
      metadata: { name: 'resistor holes' },
      components: [
        {
          id: 'breadboard_1',
          type: 'breadboard-full',
          transform: { position: { x: 0.1, y: 0.1, z: 0 } },
        },
        {
          id: 'res_1',
          type: 'resistor-220',
          parent: 'breadboard_1',
          transform: { position: { x: 0.12, y: 0.12, z: 0 } },
          placement: {
            sites: {
              pin1: { kind: 'hole', block: 'top', row: 'a', column: 30 },
              pin2: { kind: 'hole', block: 'bottom', row: 'j', column: 30 },
            },
          },
        },
      ],
      nets: [],
      wires: [],
    })

    const resistor = projectToFlowNodes(project, null).find((node) => node.id === 'res_1')!
    const catalogSize = componentPixelSize('resistor-220', 640)

    expect(resistor.data.placementDriven).toBe(true)
    expect(resistor.data.lockRuntimePinLayout).toBe(true)
    expect(resistor.data.height).toBeGreaterThan(catalogSize.height)
    expect(resistor.data.terminalLayout.pin1.y).toBeLessThan(resistor.data.terminalLayout.pin2.y)
  })

  it('keeps placed LEDs on Wokwi geometry while pinning handles to edited holes', () => {
    const project = parseBerryProject({
      version: 1,
      board: 'esp32-devkit-v1',
      metadata: { name: 'led holes' },
      components: [
        {
          id: 'breadboard_1',
          type: 'breadboard-full',
          transform: { position: { x: 0.1, y: 0.1, z: 0 } },
        },
        {
          id: 'led_1',
          type: 'led-5mm',
          parent: 'breadboard_1',
          transform: { position: { x: 0.22, y: 0.12, z: 0 } },
          placement: {
            sites: {
              anode: { kind: 'hole', block: 'top', row: 'a', column: 46 },
              cathode: { kind: 'hole', block: 'bottom', row: 'j', column: 46 },
            },
          },
        },
      ],
      nets: [],
      wires: [],
    })

    const led = projectToFlowNodes(project, null).find((node) => node.id === 'led_1')!
    const catalogSize = componentPixelSize('led-5mm', 640)

    expect(led.data.placementDriven).toBe(false)
    expect(led.data.lockRuntimePinLayout).toBe(true)
    expect(led.data.width).toBeCloseTo(catalogSize.width, 5)
    expect(led.data.height).toBeCloseTo(catalogSize.height, 5)
    expect(led.data.terminalLayout.anode.y).toBeLessThan(led.data.terminalLayout.cathode.y)
  })

  it('keeps a breadboard-mounted ESP32 on placement-locked pin handles', () => {
    const project = parseBerryProject({
      version: 1,
      board: 'esp32-devkit-v1',
      metadata: { name: 'placed esp32' },
      components: [
        {
          id: 'breadboard_1',
          type: 'breadboard-full',
          transform: { position: { x: 0, y: 0, z: 0 } },
        },
        {
          id: 'esp32_1',
          type: 'esp32-devkit-v1',
          parent: 'breadboard_1',
          transform: {
            position: { x: 0.04, y: 0.03, z: 0 },
            rotation: { x: 0, y: 0, z: 90 },
          },
          placement: {
            sites: {
              IO13: { kind: 'hole', block: 'top', row: 'a', column: 11 },
              GND_R: { kind: 'hole', block: 'bottom', row: 'i', column: 10 },
            },
          },
        },
      ],
      nets: [],
      wires: [],
    })

    const esp = projectToFlowNodes(project, null).find((node) => node.id === 'esp32_1')!

    expect(esp.data.placementDriven).toBe(false)
    expect(esp.data.lockRuntimePinLayout).toBe(true)
  })
})

describe('projectToFlowEdges', () => {
  it('maps endpoint-backed wires to React Flow handles', () => {
    const project = parseBerryProject({
      version: 1,
      board: 'esp32-devkit-v1',
      metadata: { name: 'wire edge' },
      components: [
        {
          id: 'esp32_1',
          type: 'esp32-devkit-v1',
          transform: { position: { x: 0, y: 0, z: 0 } },
        },
        {
          id: 'led_1',
          type: 'led-5mm',
          transform: { position: { x: 0.2, y: 0, z: 0 } },
        },
      ],
      nets: [
        {
          id: 'net_1',
          terminals: [
            { component: 'esp32_1', terminal: 'IO13' },
            { component: 'led_1', terminal: 'anode' },
          ],
        },
      ],
      wires: [
        {
          id: 'wire_1',
          net: 'net_1',
          color: 'green',
          from: { component: 'esp32_1', terminal: 'IO13' },
          to: { component: 'led_1', terminal: 'anode' },
          points: [
            { x: 0, y: 0, z: 0 },
            { x: 0.1, y: 0, z: 0 },
          ],
        },
      ],
    })

    const edges = projectToFlowEdges(project)

    expect(edges).toHaveLength(1)
    expect(edges[0]).toMatchObject({
      id: 'wire_1',
      source: 'esp32_1',
      sourceHandle: 'IO13',
      target: 'led_1',
      targetHandle: 'anode',
      type: 'step',
      className: 'berry-wire-edge',
    })
    expect(edges[0].style).toMatchObject({ stroke: '#0FA886', strokeWidth: 4 })
  })

  it('falls back to the first two net terminals for older wires', () => {
    const project = parseBerryProject({
      version: 1,
      board: 'esp32-devkit-v1',
      metadata: { name: 'legacy wire edge' },
      components: [
        {
          id: 'esp32_1',
          type: 'esp32-devkit-v1',
          transform: { position: { x: 0, y: 0, z: 0 } },
        },
        {
          id: 'button_1',
          type: 'push-button',
          transform: { position: { x: 0.2, y: 0, z: 0 } },
        },
      ],
      nets: [
        {
          id: 'net_1',
          terminals: [
            { component: 'esp32_1', terminal: 'IO13' },
            { component: 'button_1', terminal: 'pin1' },
          ],
        },
      ],
      wires: [
        {
          id: 'wire_1',
          net: 'net_1',
          points: [
            { x: 0, y: 0, z: 0 },
            { x: 0.1, y: 0, z: 0 },
          ],
        },
      ],
    })

    expect(projectToFlowEdges(project)[0]).toMatchObject({
      source: 'esp32_1',
      sourceHandle: 'IO13',
      target: 'button_1',
      targetHandle: 'pin1',
    })
  })
})
