import { describe, expect, it } from 'vitest'
import { breadboardHole } from '@/lib/project/breadboard'
import { holeSceneLocal } from './breadboard-layout'
import { snapAnchorTerminalId, snapPartToBreadboardHole, terminalOffsetInOuterBox } from './breadboard-snap'

describe('terminalOffsetInOuterBox', () => {
  it('places pin1 on the left for a horizontal resistor', () => {
    const off = terminalOffsetInOuterBox('resistor-220', 'pin1', 0)
    expect(off.x).toBeLessThan(0.03)
  })
})

describe('snapPartToBreadboardHole', () => {
  it('aligns pin1 to the chosen hole, not the bbox center', () => {
    const breadboard = {
      id: 'bb',
      type: 'breadboard-full' as const,
      transform: { position: { x: 0, y: 0, z: 0 } },
    }
    const resistor = {
      id: 'r1',
      type: 'resistor-220' as const,
      parent: 'bb',
      transform: {
        position: { x: 0.1, y: 0.05, z: 0 },
        rotation: { x: 0, y: 0, z: 90 },
      },
    }
    const target = holeSceneLocal('e', 15)
    const pin1Off = terminalOffsetInOuterBox('resistor-220', 'pin1', 90)
    const topLeftX = target.x - pin1Off.x
    const topLeftY = target.y - pin1Off.y

    const snapped = snapPartToBreadboardHole(breadboard, resistor, topLeftX, topLeftY)
    const pin1Site = snapped.placement?.sites.pin1
    expect(pin1Site).toMatchObject({ kind: 'hole', row: 'e', column: 15 })
    expect(snapAnchorTerminalId('resistor-220')).toBe('pin1')
  })
})

describe('holeSceneLocal', () => {
  it('maps column 1 and 30 inside breadboard bounds', () => {
    const a = holeSceneLocal('a', 1)
    const j = holeSceneLocal('j', 30)
    expect(a.x).toBeGreaterThan(0)
    expect(j.x).toBeLessThan(0.42)
    expect(j.y).toBeLessThan(0.14)
  })
})
