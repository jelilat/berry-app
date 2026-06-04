import { describe, expect, it } from 'vitest'
import { componentSceneDimensions } from '@/lib/project/terminal-layout'
import { componentDropScenePosition } from './drop-position'

describe('componentDropScenePosition', () => {
  it('centers a dropped component on the flow cursor', () => {
    const position = componentDropScenePosition('led-5mm', { x: 96, y: 96 }, 640)
    const size = componentSceneDimensions('led-5mm', 0)

    expect(position.x).toBeCloseTo(96 / 640 - size.w / 2, 5)
    expect(position.y).toBeCloseTo(96 / 640 - size.h / 2, 5)
  })
})
