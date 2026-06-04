import { describe, expect, it } from 'vitest'
import { breadboardHole } from '@/lib/project/breadboard'
import { parseBerryProject } from '@/lib/project/io'
import type { BerryProject } from '@/lib/project/types'
import { SCENE_SCALE } from './constants'
import { holeBenchPosition } from './breadboard-snap'
import { PinLayoutRegistry } from './pin-layout-registry'
import { catalogTerminalLayout, terminalCanvasPosition } from './studio-terminal-layout'
import { breadboardWireTargetAtPoint, nearestWireTarget } from './wire-target'

/**
 * Build a tiny two-part project for target selection tests.
 */
function testProject(): BerryProject {
  return parseBerryProject({
    version: 1,
    board: 'esp32-devkit-v1',
    metadata: { name: 'target test' },
    components: [
      {
        id: 'esp32_1',
        type: 'esp32-devkit-v1',
        transform: { position: { x: 0.1, y: 0.1, z: 0 } },
      },
      {
        id: 'led_1',
        type: 'led-5mm',
        transform: { position: { x: 0.35, y: 0.12, z: 0 } },
      },
    ],
    nets: [],
    wires: [],
  })
}

/**
 * Seed the registry with catalog pin positions for every placed component.
 * @param project Project to index.
 */
function registryFor(project: BerryProject): PinLayoutRegistry {
  const registry = new PinLayoutRegistry()
  for (const component of project.components) {
    registry.merge(component.id, catalogTerminalLayout(component))
  }
  return registry
}

describe('nearestWireTarget', () => {
  it('snaps to a nearby terminal inside the radius', () => {
    const project = testProject()
    const registry = registryFor(project)
    const pin = terminalCanvasPosition(
      project,
      'led_1',
      'anode',
      SCENE_SCALE,
      registry,
    )!

    const hit = nearestWireTarget(
      project,
      pin,
      SCENE_SCALE,
      registry,
      { radiusPx: 40 },
    )

    expect(hit?.target).toEqual({ componentId: 'led_1', terminalId: 'anode' })
  })

  it('ignores the source terminal while selecting a drop target', () => {
    const project = testProject()
    const registry = registryFor(project)
    const source = terminalCanvasPosition(
      project,
      'esp32_1',
      'VIN',
      SCENE_SCALE,
      registry,
    )!

    const hit = nearestWireTarget(
      project,
      source,
      SCENE_SCALE,
      registry,
      {
        ignore: { componentId: 'esp32_1', terminalId: 'VIN' },
        radiusPx: 24,
      },
    )

    expect(hit?.target).not.toEqual({ componentId: 'esp32_1', terminalId: 'VIN' })
  })

  it('can ignore every terminal on the source component', () => {
    const project = testProject()
    const registry = registryFor(project)
    const source = terminalCanvasPosition(
      project,
      'esp32_1',
      'VIN',
      SCENE_SCALE,
      registry,
    )!

    expect(
      nearestWireTarget(project, source, SCENE_SCALE, registry, {
        ignore: { componentId: 'esp32_1', terminalId: 'VIN' },
        ignoreComponentId: 'esp32_1',
        radiusPx: 80,
      }),
    ).toBeNull()
  })

  it('returns null when no terminal is close enough', () => {
    const project = testProject()
    const registry = registryFor(project)

    expect(
      nearestWireTarget(project, { x: 900, y: 900 }, SCENE_SCALE, registry),
    ).toBeNull()
  })

  it('snaps to a breadboard hole under the cursor', () => {
    const project = parseBerryProject({
      version: 1,
      board: 'esp32-devkit-v1',
      metadata: { name: 'breadboard target' },
      components: [
        {
          id: 'breadboard_1',
          type: 'breadboard-full',
          transform: { position: { x: 0.1, y: 0.1, z: 0 } },
        },
      ],
      nets: [],
      wires: [],
    })
    const breadboard = project.components[0]
    const site = breadboardHole('a', 10)
    const bench = holeBenchPosition(breadboard, site)

    const hit = breadboardWireTargetAtPoint(
      project,
      { x: bench.x * SCENE_SCALE, y: bench.y * SCENE_SCALE },
      SCENE_SCALE,
    )

    expect(hit?.target).toEqual({ breadboardId: 'breadboard_1', site })
  })
})
