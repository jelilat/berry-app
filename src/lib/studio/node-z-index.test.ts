import { describe, expect, it } from 'vitest'
import { componentNodeZIndex, Z_BREADBOARD, Z_PART, Z_PART_ON_PARENT } from './node-z-index'

describe('componentNodeZIndex', () => {
  it('keeps breadboard below attached parts', () => {
    expect(
      componentNodeZIndex({
        id: 'bb',
        type: 'breadboard-full',
        transform: { position: { x: 0, y: 0, z: 0 } },
      }),
    ).toBe(Z_BREADBOARD)
    expect(
      componentNodeZIndex({
        id: 'esp',
        type: 'esp32-devkit-v1',
        parent: 'bb',
        transform: { position: { x: 0, y: 0, z: 0 } },
      }),
    ).toBe(Z_PART_ON_PARENT)
    expect(
      componentNodeZIndex({
        id: 'led',
        type: 'led-5mm',
        transform: { position: { x: 0, y: 0, z: 0 } },
      }),
    ).toBe(Z_PART)
    expect(Z_BREADBOARD).toBeLessThan(Z_PART)
    expect(Z_PART).toBeLessThan(Z_PART_ON_PARENT)
  })
})
