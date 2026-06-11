import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadBerryProjectFromJson } from '@/lib/project/io'
import { buildProjectPinMap, resolveBoardArduinoPin } from './pin-map'
import { generateFirmwareFromProject } from './generate'

/**
 * Load the ESP32 LED blink example project fixture.
 */
function loadEsp32LedBlinkExample() {
  const filePath = path.join(process.cwd(), 'examples', 'esp32-led-blink.project.json')
  return loadBerryProjectFromJson(readFileSync(filePath, 'utf8'))
}

describe('resolveBoardArduinoPin', () => {
  it('maps ESP32 IO13 to Arduino pin 13', () => {
    expect(resolveBoardArduinoPin('esp32-devkit-v1', 'IO13')).toBe(13)
  })

  it('maps Arduino UNO D13 to pin 13', () => {
    expect(resolveBoardArduinoPin('arduino-uno', 'D13')).toBe(13)
  })
})

describe('buildProjectPinMap', () => {
  it('maps the LED blink example to GPIO 13', () => {
    const project = loadEsp32LedBlinkExample()
    const pinMap = buildProjectPinMap(project)

    expect(pinMap.mcuComponentId).toBe('esp32_1')
    expect(pinMap.leds).toHaveLength(1)
    expect(pinMap.leds[0]?.componentId).toBe('led_1')
    expect(pinMap.leds[0]?.gpio.arduinoPin).toBe(13)
    expect(pinMap.leds[0]?.gpio.boardTerminalId).toBe('IO13')
  })
})

describe('generateFirmwareFromProject', () => {
  it('generates a blink sketch for the LED example', () => {
    const project = loadEsp32LedBlinkExample()
    const result = generateFirmwareFromProject(project)

    expect(result.ok).toBe(true)
    expect(result.source).toContain('constexpr int LED_1_PIN = 13')
    expect(result.source).toContain('digitalWrite(LED_1_PIN, HIGH)')
    expect(result.notes.some((note) => note.includes('Mapped 1 LED'))).toBe(true)
  })
})
