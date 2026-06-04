import { describe, expect, it } from 'vitest'
import { pinLayoutInContainer, wokwiFitTransform } from './wokwi-pin-position'

describe('wokwiFitTransform', () => {
  it('letterboxes wide art in a square container', () => {
    const t = wokwiFitTransform(100, 100, 200, 100)
    expect(t.scale).toBe(0.5)
    expect(t.drawnW).toBe(100)
    expect(t.drawnH).toBe(50)
    expect(t.offsetX).toBe(0)
    expect(t.offsetY).toBe(25)
  })
})

describe('pinLayoutInContainer', () => {
  it('maps SVG-normalized coords into the fitted container', () => {
    const layout = pinLayoutInContainer({ p: { x: 0, y: 0 } }, 100, 100, 200, 100)
    expect(layout.p.x).toBeCloseTo(0, 5)
    expect(layout.p.y).toBeCloseTo(0.25, 5)
  })
})
