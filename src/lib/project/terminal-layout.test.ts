import { describe, expect, it } from 'vitest'
import { getComponentDefinition } from './catalog'
import {
  componentSceneDimensions,
  terminalRelativeFromScenePoint,
  terminalScenePositionFromRel,
  terminalRelativePositions,
  terminalScenePosition,
} from './terminal-layout'

describe('terminalScenePositionFromRel', () => {
  it('matches CSS rotation direction for a 90 degree ESP32', () => {
    const world = terminalScenePositionFromRel(
      0,
      0,
      'esp32-devkit-v1',
      { x: 0, y: 0 },
      90,
    )
    const rotated = componentSceneDimensions('esp32-devkit-v1', 90)

    expect(world.x).toBeCloseTo(rotated.w, 5)
    expect(world.y).toBeCloseTo(0, 5)
  })
})

describe('terminalRelativeFromScenePoint', () => {
  it('round-trips with terminalScenePosition for esp32', () => {
    const type = 'esp32-devkit-v1'
    const def = getComponentDefinition(type)
    const cx = 0.1
    const cy = 0.05
    const rot = 90
    for (const term of def.terminals) {
      const relOrig = terminalRelativePositions(def.terminals, type)[term.id]
      const world = terminalScenePosition(cx, cy, type, term.id, def.terminals, rot)
      const relBack = terminalRelativeFromScenePoint(cx, cy, type, rot, world.x, world.y)
      expect(relBack).not.toBeNull()
      expect(relBack!.x).toBeCloseTo(relOrig.x, 4)
      expect(relBack!.y).toBeCloseTo(relOrig.y, 4)
    }
  })
})
