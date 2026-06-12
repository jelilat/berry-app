import { describe, expect, it } from 'vitest'
import { buildProjectPinMap } from '@/lib/codegen/pin-map'
import { generateFirmwareFromProject } from '@/lib/codegen/generate'
import { hasValidationErrors, validate } from '@/lib/validation'
import {
  studioCreateArduinoUnoLedBlinkProject,
  studioCreateEsp32LedBlinkProject,
} from './studio'

describe('studioCreateArduinoUnoLedBlinkProject', () => {
  it('produces an arduino-uno project with no validation errors', () => {
    const { project } = studioCreateArduinoUnoLedBlinkProject()

    expect(project.board).toBe('arduino-uno')
    expect(project.components.some((component) => component.type === 'arduino-uno')).toBe(true)
    expect(project.components.some((component) => component.type === 'resistor-220')).toBe(true)
    expect(project.components.some((component) => component.type === 'led-5mm')).toBe(true)
    expect(hasValidationErrors(validate(project))).toBe(false)
  })

  it('keeps all coordinates 2D-native with z = 0', () => {
    const { project } = studioCreateArduinoUnoLedBlinkProject()

    for (const component of project.components) {
      expect(component.transform.position.z).toBe(0)
    }
    for (const wire of project.wires) {
      for (const point of wire.points) {
        expect(point.z).toBe(0)
      }
    }
  })

  it('maps the LED to Arduino digital pin 13 in codegen', () => {
    const { project } = studioCreateArduinoUnoLedBlinkProject()
    const pinMap = buildProjectPinMap(project)

    expect(pinMap.leds).toHaveLength(1)
    expect(pinMap.leds[0]?.gpio.boardTerminalId).toBe('D13')
    expect(pinMap.leds[0]?.gpio.arduinoPin).toBe(13)

    const codegen = generateFirmwareFromProject(project)
    expect(codegen.ok).toBe(true)
    expect(codegen.source).toContain('LED_1_PIN = 13')
    expect(codegen.source).toContain('digitalWrite(LED_1_PIN, HIGH)')
  })
})

describe('studioCreateEsp32LedBlinkProject', () => {
  it('still produces a clean ESP32 reference circuit', () => {
    const { project } = studioCreateEsp32LedBlinkProject()

    expect(project.board).toBe('esp32-devkit-v1')
    expect(hasValidationErrors(validate(project))).toBe(false)
  })
})
