import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadBerryProjectFromJson } from '@/lib/project/io'
import type { BerryProject } from '@/lib/project/types'
import { hasValidationErrors, validate } from './validate'

/**
 * Load the ESP32 LED blink example project from the repo examples folder.
 */
function loadEsp32LedBlinkExample(): BerryProject {
  const filePath = path.join(
    process.cwd(),
    'examples',
    'esp32-led-blink.project.json',
  )
  return loadBerryProjectFromJson(readFileSync(filePath, 'utf8'))
}

/**
 * Minimal project with GPIO wired straight to an LED anode (no resistor).
 */
function ledDirectToGpioProject(): BerryProject {
  return loadBerryProjectFromJson(
    JSON.stringify({
      version: 1,
      board: 'esp32-devkit-v1',
      metadata: { name: 'LED direct GPIO' },
      components: [
        {
          id: 'esp32_1',
          type: 'esp32-devkit-v1',
          transform: { position: { x: 0, y: 0, z: 0 } },
        },
        {
          id: 'led_1',
          type: 'led-5mm',
          transform: { position: { x: 1, y: 0, z: 0 } },
        },
      ],
      nets: [
        {
          id: 'net_gpio_led',
          terminals: [
            { component: 'esp32_1', terminal: 'IO13' },
            { component: 'led_1', terminal: 'anode' },
          ],
        },
      ],
      wires: [
        {
          id: 'wire_1',
          net: 'net_gpio_led',
          color: 'yellow',
          points: [
            { x: 0, y: 0, z: 0 },
            { x: 1, y: 0, z: 0 },
          ],
        },
      ],
    }),
  )
}

describe('validate', () => {
  it('passes esp32-led-blink example without errors or LED warnings', () => {
    const project = loadEsp32LedBlinkExample()
    const results = validate(project)

    expect(hasValidationErrors(results)).toBe(false)
    expect(results.some((r) => r.code === 'component.led_no_resistor')).toBe(false)
  })

  it('warns when LED anode is wired directly to GPIO without a resistor', () => {
    const project = ledDirectToGpioProject()
    const results = validate(project)

    const ledWarnings = results.filter((r) => r.code === 'component.led_no_resistor')
    expect(ledWarnings).toHaveLength(1)
    expect(ledWarnings[0]?.severity).toBe('warning')
    expect(ledWarnings[0]?.subject).toMatchObject({
      componentId: 'led_1',
      terminalId: 'anode',
      netId: 'net_gpio_led',
    })
  })
})
