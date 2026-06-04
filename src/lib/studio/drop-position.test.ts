import { describe, expect, it } from 'vitest'
import { componentDropScenePosition } from './drop-position'

describe('componentDropScenePosition', () => {
  it('centers a dropped component on the flow cursor', () => {
    const position = componentDropScenePosition('led-5mm', { x: 96, y: 96 }, 640)

    expect(position.x).toBeCloseTo(0.12, 5)
    expect(position.y).toBeCloseTo(0.114, 5)
  })
})
