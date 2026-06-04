import { describe, expect, it } from 'vitest'
import { parseBerryProject } from '@/lib/project/io'
import { connectTerminals, moveComponent } from '@/lib/project/mutations'
import type { BerryProject } from '@/lib/project/types'
import { PinLayoutRegistry } from '@/lib/studio/pin-layout-registry'
import {
  buildVisualWirePoints,
  rerouteWiresVisual,
  scenePositionOverridesFromNodes,
} from '@/lib/studio/wire-routing'
import { projectToFlowNodes } from '@/lib/studio/flow-map'
import { SCENE_SCALE } from '@/lib/studio/constants'
import { sceneToFlowPosition } from '@/lib/studio/layout'

function minimalProject(): BerryProject {
  return parseBerryProject({
    version: 1,
    board: 'esp32-devkit-v1',
    metadata: { name: 'test' },
    components: [
      {
        id: 'esp32_1',
        type: 'esp32-devkit-v1',
        transform: { position: { x: 0.1, y: 0.1, z: 0 } },
      },
      {
        id: 'led_1',
        type: 'led-5mm',
        transform: { position: { x: 0.3, y: 0.1, z: 0 } },
      },
    ],
    nets: [],
    wires: [],
  })
}

describe('wire-routing', () => {
  it('reroutes using Wokwi pin offsets', () => {
    const wired = connectTerminals(
      minimalProject(),
      { componentId: 'esp32_1', terminalId: 'IO13' },
      { componentId: 'led_1', terminalId: 'anode' },
    )
    const registry = new PinLayoutRegistry()
    registry.merge('led_1', { anode: { x: 0.2, y: 0.4 }, cathode: { x: 0.8, y: 0.4 } })

    const moved = moveComponent(wired, 'led_1', 0.5, 0.3, { snap: false })
    const catalogPoints = moved.wires[0].points
    const visualPoints = rerouteWiresVisual(
      moved,
      'led_1',
      registry,
      SCENE_SCALE,
    ).wires[0].points

    expect(visualPoints).not.toEqual(catalogPoints)
    expect(visualPoints.at(-1)?.x).toBeGreaterThan(0.5)
  })

  it('detects live node position overrides during drag', () => {
    const wired = connectTerminals(
      minimalProject(),
      { componentId: 'esp32_1', terminalId: 'IO13' },
      { componentId: 'led_1', terminalId: 'anode' },
    )
    const nodes = projectToFlowNodes(wired, null).map((n) =>
      n.id === 'led_1'
        ? {
            ...n,
            position: sceneToFlowPosition(0.6, 0.4, SCENE_SCALE),
          }
        : n,
    )
    const overrides = scenePositionOverridesFromNodes(wired, nodes, SCENE_SCALE)
    expect(overrides.get('led_1')).toEqual({ x: 0.6, y: 0.4 })

    const registry = new PinLayoutRegistry()
    const atRest = buildVisualWirePoints(
      wired,
      { componentId: 'esp32_1', terminalId: 'IO13' },
      { componentId: 'led_1', terminalId: 'anode' },
      registry,
      SCENE_SCALE,
    )
    const dragged = buildVisualWirePoints(
      wired,
      { componentId: 'esp32_1', terminalId: 'IO13' },
      { componentId: 'led_1', terminalId: 'anode' },
      registry,
      SCENE_SCALE,
      overrides,
    )
    expect(dragged.at(-1)!.x).toBeGreaterThan(atRest.at(-1)!.x)
  })
})
