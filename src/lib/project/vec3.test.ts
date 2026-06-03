import { describe, expect, it } from 'vitest'
import {
  flattenWirePoints,
  ORIGIN,
  position2d,
  transform2d,
  vec3,
  xy,
} from './vec3'

describe('vec3 helpers', () => {
  it('ORIGIN is zero', () => {
    expect(ORIGIN).toEqual({ x: 0, y: 0, z: 0 })
  })

  it('position2d defaults z to 0', () => {
    expect(position2d(3, 4)).toEqual({ x: 3, y: 4, z: 0 })
    expect(position2d(1, 2, 5)).toEqual({ x: 1, y: 2, z: 5 })
  })

  it('xy drops z', () => {
    expect(xy({ x: 10, y: 20, z: 99 })).toEqual({ x: 10, y: 20 })
  })

  it('vec3 builds explicit coordinates', () => {
    expect(vec3(1, 2, 3)).toEqual({ x: 1, y: 2, z: 3 })
  })

  it('transform2d places on z=0 plane with z rotation', () => {
    expect(transform2d(5, 6)).toEqual({
      position: { x: 5, y: 6, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: 1,
    })
    expect(transform2d(0, 0, 45).rotation).toEqual({ x: 0, y: 0, z: 45 })
  })

  it('flattenWirePoints fills missing z with 0', () => {
    const points = [
      { x: 1, y: 2, z: 3 },
      { x: 4, y: 5, z: undefined as unknown as number },
    ]
    expect(flattenWirePoints(points)).toEqual([
      { x: 1, y: 2, z: 3 },
      { x: 4, y: 5, z: 0 },
    ])
  })
})
