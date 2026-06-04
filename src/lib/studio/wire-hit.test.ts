import { describe, expect, it } from 'vitest'
import { distancePointToSegment, hitTestWirePolyline } from './wire-hit'

describe('wire-hit', () => {
  it('measures distance to a segment', () => {
    expect(distancePointToSegment(0, 1, 0, 0, 4, 0)).toBeCloseTo(1, 5)
    expect(distancePointToSegment(2, 0, 0, 0, 4, 0)).toBeCloseTo(0, 5)
  })

  it('hits orthogonal polylines within threshold', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ]
    expect(hitTestWirePolyline({ x: 5, y: 1 }, points, 4)).toBe(true)
    expect(hitTestWirePolyline({ x: 50, y: 50 }, points, 4)).toBe(false)
  })
})
