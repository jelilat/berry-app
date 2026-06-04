import { describe, expect, it } from 'vitest'
import { parseBerryProject } from '@/lib/project/io'
import { projectToFlowEdges, projectToFlowNodes } from './flow-map'

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
