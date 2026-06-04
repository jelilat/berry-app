import { describe, expect, it } from 'vitest'
import { parseBerryProject } from '@/lib/project/io'
import { buildComponentInspectorModel } from './component-inspector'

describe('buildComponentInspectorModel', () => {
  it('lists pin nets and peers for a connected MCU', () => {
    const project = parseBerryProject({
      version: 1,
      board: 'esp32-devkit-v1',
      metadata: { name: 'test' },
      components: [
        {
          id: 'esp32_1',
          type: 'esp32-devkit-v1',
          transform: { position: { x: 0.04, y: 0.03, z: 0 }, rotation: { x: 0, y: 0, z: 90 } },
        },
        {
          id: 'led_1',
          type: 'led-5mm',
          transform: { position: { x: 0.18, y: 0.05, z: 0 } },
        },
      ],
      nets: [
        {
          id: 'net_gpio_led',
          terminals: [
            { component: 'esp32_1', terminal: 'IO13' },
            { component: 'led_1', terminal: 'anode' },
          ],
        },
      ],
      wires: [{ id: 'wire_1', net: 'net_gpio_led', points: [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }] }],
    })

    const model = buildComponentInspectorModel(project, 'esp32_1')
    expect(model).not.toBeNull()
    expect(model!.rotationZ).toBe(90)
    expect(model!.positionScene.x).toBeCloseTo(0.04, 5)
    expect(model!.positionCanvasPx.x).toBeCloseTo(0.04 * 640, 5)

    const io13 = model!.pins.find((p) => p.terminalId === 'IO13')
    expect(io13?.netId).toBe('net_gpio_led')
    expect(io13?.peers).toHaveLength(1)
    expect(io13?.peers[0].componentId).toBe('led_1')
    expect(io13?.wireIds).toContain('wire_1')
    expect(model!.connectedPinCount).toBe(1)
  })
})
