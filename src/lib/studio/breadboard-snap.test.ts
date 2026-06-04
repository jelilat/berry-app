import { describe, expect, it } from 'vitest'
import { breadboardHole } from '@/lib/project/breadboard'
import { findHoleOccupancyConflicts } from '@/lib/project/breadboard-nets'
import { parseBerryProject } from '@/lib/project/io'
import { holeSceneLocal } from './breadboard-layout'
import {
  evaluateBreadboardSnap,
  snapAnchorTerminalId,
  snapInstanceOnBreadboard,
  snapPartToBreadboardHole,
  terminalOffsetInOuterBox,
} from './breadboard-snap'

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

  it('records every microcontroller terminal on a breadboard hole', () => {
    const breadboard = {
      id: 'bb',
      type: 'breadboard-full' as const,
      transform: { position: { x: 0, y: 0, z: 0 } },
    }
    const esp32 = {
      id: 'esp32',
      type: 'esp32-devkit-v1' as const,
      parent: 'bb',
      transform: {
        position: { x: 0.07, y: 0.02, z: 0 },
        rotation: { x: 0, y: 0, z: 90 },
      },
    }
    const target = holeSceneLocal('a', 1)
    const vinOff = terminalOffsetInOuterBox('esp32-devkit-v1', 'VIN', 90)
    const snapped = snapPartToBreadboardHole(
      breadboard,
      esp32,
      target.x - vinOff.x,
      target.y - vinOff.y,
    )

    expect(snapped.placement?.sites.VIN).toMatchObject({
      kind: 'hole',
      row: 'a',
      column: 1,
    })
    const trial = parseBerryProject({
      version: 1,
      board: 'esp32-devkit-v1',
      metadata: { name: 't' },
      components: [breadboard, snapped],
      nets: [],
      wires: [],
    })
    expect(findHoleOccupancyConflicts(trial, 'bb')).toEqual([])

    expect(Object.keys(snapped.placement?.sites ?? {}).sort()).toEqual(
      [
        'EN',
        'VP',
        'VN',
        'IO34',
        'IO35',
        'IO32',
        'IO33',
        'IO25',
        'IO26',
        'IO27',
        'IO14',
        'IO12',
        'IO13',
        'GND_L',
        'VIN',
        'IO23',
        'IO22',
        'TX0',
        'RX0',
        'IO21',
        'IO19',
        'IO18',
        'IO5',
        'TX2',
        'RX2',
        'IO4',
        'IO2',
        'IO15',
        'GND_R',
        '3V3',
      ].sort(),
    )
  })
})

describe('holeSceneLocal', () => {
  it('maps column 1 and 60 inside breadboard bounds', () => {
    const a = holeSceneLocal('a', 1)
    const j = holeSceneLocal('j', 60)
    expect(a.x).toBeGreaterThan(0)
    expect(j.x).toBeLessThan(0.42)
    expect(j.y).toBeLessThan(0.14)
  })
})

describe('evaluateBreadboardSnap', () => {
  it('rejects snap when another part already uses a target hole', () => {
    const breadboard = {
      id: 'bb',
      type: 'breadboard-full' as const,
      transform: { position: { x: 0, y: 0, z: 0 } },
    }
    const occupied = {
      id: 'r1',
      type: 'resistor-220' as const,
      parent: 'bb',
      transform: {
        position: { x: 0.08, y: 0.04, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
      },
      placement: {
        sites: {
          pin1: { kind: 'hole' as const, block: 'top' as const, row: 'e' as const, column: 15 },
          pin2: { kind: 'hole' as const, block: 'top' as const, row: 'g' as const, column: 17 },
        },
      },
    }
    const incoming = {
      id: 'r2',
      type: 'resistor-220' as const,
      transform: {
        position: { x: 0.08, y: 0.04, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
      },
    }
    const project = {
      version: 1 as const,
      board: 'esp32-devkit-v1' as const,
      metadata: { name: 'snap conflict' },
      components: [breadboard, occupied],
      nets: [],
      wires: [],
    }

    const target = holeSceneLocal('e', 15)
    const pin1Off = terminalOffsetInOuterBox('resistor-220', 'pin1', 0)
    const evaluation = evaluateBreadboardSnap(
      project,
      incoming,
      target.x - pin1Off.x,
      target.y - pin1Off.y,
    )

    expect(evaluation.candidate).toBeNull()
    expect(evaluation.rejected).not.toBeNull()
    expect(evaluation.conflict).toContain('e15↑')
  })
})

describe('snapInstanceOnBreadboard', () => {
  it('does not parent a breadboard to itself when the board moves', () => {
    const breadboard = {
      id: 'bb',
      type: 'breadboard-full' as const,
      transform: { position: { x: 0, y: 0, z: 0 } },
    }
    const project = {
      version: 1 as const,
      board: 'esp32-devkit-v1' as const,
      metadata: { name: 'test' },
      components: [breadboard],
      nets: [],
      wires: [],
    }

    const snapped = snapInstanceOnBreadboard(project, breadboard, 0.02, 0.02)

    expect(snapped.parent).toBeUndefined()
    expect(snapped.placement).toBeUndefined()
    expect(snapped.transform.position).toEqual({ x: 0.02, y: 0.02, z: 0 })
  })
})
