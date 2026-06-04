import { describe, expect, it } from 'vitest'
import { catalogSceneSize, sceneSizeFromPhysicalMm } from './scene-size'

describe('catalogSceneSize', () => {
  it('keeps tiny passives large enough to edit on the 2D bench', () => {
    const physicalLed = sceneSizeFromPhysicalMm('led-5mm')
    const editableLed = catalogSceneSize('led-5mm')
    const editableResistor = catalogSceneSize('resistor-220')

    expect(editableLed.w).toBeGreaterThan(physicalLed.w)
    expect(editableLed.w).toBeGreaterThanOrEqual(0.06)
    expect(editableLed.h).toBeGreaterThanOrEqual(0.072)
    expect(editableResistor.w).toBeGreaterThanOrEqual(0.12)
    expect(editableResistor.h).toBeGreaterThanOrEqual(0.032)
  })

  it('keeps ESP32 dev boards large enough beside Arduino boards', () => {
    const esp32 = catalogSceneSize('esp32-devkit-v1')
    const arduino = catalogSceneSize('arduino-uno')

    expect(esp32.w).toBeGreaterThanOrEqual(0.12)
    expect(esp32.h).toBeGreaterThanOrEqual(0.22)
    expect(esp32.h).toBeGreaterThan(arduino.h)
  })

  it('preserves board-scale footprints for large parts', () => {
    expect(catalogSceneSize('breadboard-full')).toEqual(
      sceneSizeFromPhysicalMm('breadboard-full'),
    )
  })
})
