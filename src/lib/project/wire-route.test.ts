import { describe, expect, it } from 'vitest'
import { orthogonalWireRoute } from './wire-route'

describe('orthogonalWireRoute', () => {
  it('returns a straight segment when already aligned', () => {
    expect(orthogonalWireRoute({ x: 0, y: 0 }, { x: 5, y: 0 })).toEqual([
      { x: 0, y: 0 },
      { x: 5, y: 0 },
    ])
  })

  it('uses horizontal-first L when dx dominates', () => {
    expect(orthogonalWireRoute({ x: 0, y: 0 }, { x: 10, y: 2 })).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 2 },
    ])
  })

  it('uses vertical-first L when dy dominates', () => {
    expect(orthogonalWireRoute({ x: 0, y: 0 }, { x: 2, y: 10 })).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 10 },
      { x: 2, y: 10 },
    ])
  })
})
