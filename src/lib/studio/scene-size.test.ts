import { describe, expect, it } from 'vitest'
import { catalogSceneSize, sceneSizeFromPhysicalMm } from './scene-size'

describe('catalogSceneSize', () => {
  it('keeps normal non-Wokwi parts at physical scale', () => {
    expect(catalogSceneSize('bme280')).toEqual(sceneSizeFromPhysicalMm('bme280'))
  })

  it('gives tiny loose parts a modest interaction floor', () => {
    const physicalLed = sceneSizeFromPhysicalMm('led-5mm')
    const led = catalogSceneSize('led-5mm')
    const resistor = catalogSceneSize('resistor-220')

    expect(led.w).toBeGreaterThan(physicalLed.w)
    expect(led.w).toBeCloseTo(0.028)
    expect(led.h).toBeCloseTo(0.04)
    expect(resistor.w).toBeCloseTo(0.08)
    expect(resistor.h).toBeCloseTo(0.018)
  })

  it('orients Wokwi boards to their native visual orientation without inflating them', () => {
    const esp32 = catalogSceneSize('esp32-devkit-v1')
    const arduino = catalogSceneSize('arduino-uno')
    const breadboard = catalogSceneSize('breadboard-full')

    expect(esp32.w).toBeCloseTo(sceneSizeFromPhysicalMm('esp32-devkit-v1').h)
    expect(esp32.h).toBeCloseTo(sceneSizeFromPhysicalMm('esp32-devkit-v1').w)
    expect(esp32.h).toBeLessThan(breadboard.w / 3)
    expect(arduino.w).toBeCloseTo(sceneSizeFromPhysicalMm('arduino-uno').w)
    expect(arduino.h).toBeCloseTo(sceneSizeFromPhysicalMm('arduino-uno').h)
  })

  it('preserves board-scale footprints for large parts', () => {
    expect(catalogSceneSize('breadboard-full')).toEqual(
      sceneSizeFromPhysicalMm('breadboard-full'),
    )
  })
})
