import { describe, expect, it } from 'vitest'
import { breadboardHole } from './breadboard'
import {
  collectOccupiedBreadboardSites,
  describeFootprintHoleConflict,
  describePlacementHoleConflict,
  findHoleOccupancyConflicts,
  breadboardPhysicalSiteKey,
} from './breadboard-nets'
import type { BerryProject } from './types'
import { holeScenePosition } from '@/lib/studio/breadboard-layout'

function projectWithPlacements(
  placements: BerryProject['components'],
): BerryProject {
  return {
    version: 1,
    board: 'esp32-devkit-v1',
    metadata: { name: 'occupancy test' },
    components: [
      {
        id: 'breadboard_1',
        type: 'breadboard-full',
        transform: { position: { x: 0, y: 0, z: 0 } },
      },
      ...placements,
    ],
    nets: [],
    wires: [],
  }
}

describe('describePlacementHoleConflict', () => {
  it('returns null when holes are free', () => {
    const project = projectWithPlacements([
      {
        id: 'res_1',
        type: 'resistor-220',
        parent: 'breadboard_1',
        transform: { position: { x: 0.1, y: 0.1, z: 0 } },
        placement: {
          sites: {
            pin1: breadboardHole('a', 10, 'top'),
            pin2: breadboardHole('c', 10, 'top'),
          },
        },
      },
    ])

    const conflict = describePlacementHoleConflict(
      project,
      'breadboard_1',
      { sites: { pin1: breadboardHole('e', 20, 'top') } },
      'res_2',
    )
    expect(conflict).toBeNull()
  })

  it('detects a hole already used by another part', () => {
    const project = projectWithPlacements([
      {
        id: 'res_1',
        type: 'resistor-220',
        parent: 'breadboard_1',
        transform: { position: { x: 0.1, y: 0.1, z: 0 } },
        placement: {
          sites: {
            pin1: breadboardHole('a', 10, 'top'),
            pin2: breadboardHole('c', 10, 'top'),
          },
        },
      },
    ])

    const conflict = describePlacementHoleConflict(
      project,
      'breadboard_1',
      {
        sites: {
          pin1: breadboardHole('a', 10, 'top'),
          pin2: breadboardHole('j', 10, 'bottom'),
        },
      },
      'res_2',
    )
    expect(conflict).toContain('a10↑')
    expect(conflict).toContain('res_1:pin1')
  })

  it('ignores the moving part current placement', () => {
    const project = projectWithPlacements([
      {
        id: 'res_1',
        type: 'resistor-220',
        parent: 'breadboard_1',
        transform: { position: { x: 0.1, y: 0.1, z: 0 } },
        placement: {
          sites: {
            pin1: breadboardHole('a', 10, 'top'),
            pin2: breadboardHole('c', 10, 'top'),
          },
        },
      },
    ])

    const conflict = describePlacementHoleConflict(
      project,
      'breadboard_1',
      {
        sites: {
          pin1: breadboardHole('a', 10, 'top'),
          pin2: breadboardHole('c', 10, 'top'),
        },
      },
      'res_1',
    )
    expect(conflict).toBeNull()
  })

  it('treats holes covered by a component body as occupied', () => {
    const covered = breadboardHole('b', 16, 'top')
    const coveredCenter = holeScenePosition(0, 0, covered.row, covered.column)
    const project = projectWithPlacements([
      {
        id: 'esp32_1',
        type: 'esp32-devkit-v1',
        parent: 'breadboard_1',
        transform: {
          position: { x: coveredCenter.x - 0.01, y: coveredCenter.y - 0.01, z: 0 },
        },
        placement: {
          sites: {
            VIN: breadboardHole('a', 12, 'top'),
          },
        },
      },
    ])

    const occupied = collectOccupiedBreadboardSites(project, 'breadboard_1')
    const conflict = describePlacementHoleConflict(
      project,
      'breadboard_1',
      { sites: { pin1: covered } },
      'wire_probe',
    )

    expect(occupied.get(breadboardPhysicalSiteKey(covered))).toBe('esp32_1 body')
    expect(conflict).toContain('esp32_1 body')
  })

  it('rejects a candidate component footprint over occupied holes', () => {
    const occupied = breadboardHole('c', 18, 'top')
    const occupiedCenter = holeScenePosition(0, 0, occupied.row, occupied.column)
    const project = projectWithPlacements([
      {
        id: 'button_1',
        type: 'push-button',
        parent: 'breadboard_1',
        transform: {
          position: { x: occupiedCenter.x - 0.005, y: occupiedCenter.y - 0.005, z: 0 },
        },
        placement: {
          sites: {
            pin1: occupied,
          },
        },
      },
    ])
    const candidateCenter = holeScenePosition(0, 0, occupied.row, occupied.column)

    const conflict = describeFootprintHoleConflict(
      project,
      'breadboard_1',
      {
        id: 'led_1',
        type: 'led-5mm',
        parent: 'breadboard_1',
        transform: {
          position: { x: candidateCenter.x - 0.005, y: candidateCenter.y - 0.005, z: 0 },
        },
      },
      'led_1',
    )

    expect(conflict).toContain('button_1:pin1')
  })
})

describe('findHoleOccupancyConflicts', () => {
  it('lists two legs in the same hole', () => {
    const project = projectWithPlacements([
      {
        id: 'res_1',
        type: 'resistor-220',
        parent: 'breadboard_1',
        transform: { position: { x: 0.1, y: 0.1, z: 0 } },
        placement: {
          sites: {
            pin1: breadboardHole('a', 10, 'top'),
            pin2: breadboardHole('a', 10, 'top'),
          },
        },
      },
    ])

    const occupied = collectOccupiedBreadboardSites(project, 'breadboard_1')

    expect(findHoleOccupancyConflicts(project, 'breadboard_1').length).toBeGreaterThan(0)
    expect(occupied.get(breadboardPhysicalSiteKey(breadboardHole('a', 10, 'top')))).toBe(
      'res_1:pin2',
    )
  })
})
