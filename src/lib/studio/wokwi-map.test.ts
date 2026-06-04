import { describe, expect, it } from 'vitest'
import { catalogTerminalLayout } from '@/lib/studio/studio-terminal-layout'
import { parseBerryProject } from '@/lib/project/io'
import { PinLayoutRegistry } from '@/lib/studio/pin-layout-registry'
import { wokwiBaselinePinLayout } from '@/lib/studio/wokwi-map'
import { pinLayoutInContainer } from '@/lib/studio/wokwi-pin-position'
import { SCENE_SCALE } from '@/lib/studio/constants'
import { catalogSceneSize } from '@/lib/studio/scene-size'
import { getWokwiVisual } from '@/lib/studio/wokwi-map'

describe('wokwiBaselinePinLayout', () => {
  it('places ESP32 3V3 on the bottom-right and EN on the top-left', () => {
    const layout = wokwiBaselinePinLayout('esp32-devkit-v1', ['3V3', 'EN'])
    expect(layout).not.toBeNull()
    const threeV = layout!['3V3']
    expect(layout!.EN.x).toBeLessThan(0.1)
    expect(layout!.EN.y).toBeLessThan(0.2)
    expect(threeV.x).toBeGreaterThan(0.9)
    expect(threeV.y).toBeGreaterThan(0.75)
  })
})

describe('catalogTerminalLayout', () => {
  it('letterboxes Wokwi pin coords into the larger bench ESP32 box', () => {
    const project = parseBerryProject({
      version: 1,
      board: 'esp32-devkit-v1',
      metadata: { name: 't' },
      components: [
        {
          id: 'esp32_1',
          type: 'esp32-devkit-v1',
          transform: { position: { x: 0, y: 0, z: 0 } },
        },
      ],
      nets: [],
      wires: [],
    })
    const layout = catalogTerminalLayout(project.components[0])
    const native = wokwiBaselinePinLayout('esp32-devkit-v1', ['EN', '3V3'])!
    const visual = getWokwiVisual('esp32-devkit-v1')!
    const scene = catalogSceneSize('esp32-devkit-v1')
    const expected = pinLayoutInContainer(
      native,
      scene.w * SCENE_SCALE,
      scene.h * SCENE_SCALE,
      visual.nativeWidth,
      visual.nativeHeight,
    )
    expect(layout.EN).toEqual(expected.EN)
    expect(layout['3V3']).toEqual(expected['3V3'])
    expect(layout.EN.x).not.toBeCloseTo(native.EN.x, 2)
  })
})

describe('PinLayoutRegistry.mergeCatalogBaseline', () => {
  it('does not overwrite Wokwi pin coordinates', () => {
    const registry = new PinLayoutRegistry()
    registry.merge('esp32_1', { EN: { x: 0.05, y: 0.12 }, '3V3': { x: 0.95, y: 0.79 } })
    registry.mergeCatalogBaseline('esp32_1', {
      EN: { x: 0.92, y: 0.5 },
      '3V3': { x: 0.92, y: 0.6 },
      IO13: { x: 0.02, y: 0.5 },
    })
    expect(registry.get('esp32_1')).toEqual({
      EN: { x: 0.05, y: 0.12 },
      '3V3': { x: 0.95, y: 0.79 },
      IO13: { x: 0.02, y: 0.5 },
    })
  })
})
