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

/**
 * Build a small ESP32 project from component instances and terminal-pair nets.
 * @param name Project name.
 * @param components Component instances.
 * @param pairs Terminal pairs to connect as individual nets.
 */
function projectWithPairs(
  name: string,
  components: BerryProject['components'],
  pairs: Array<[
    { component: string; terminal: string },
    { component: string; terminal: string },
  ]>,
): BerryProject {
  return loadBerryProjectFromJson(
    JSON.stringify({
      version: 1,
      board: 'esp32-devkit-v1',
      metadata: { name },
      components,
      nets: pairs.map(([a, b], index) => ({
        id: `net_${index + 1}`,
        terminals: [a, b],
      })),
      wires: pairs.map(([a, b], index) => ({
        id: `wire_${index + 1}`,
        net: `net_${index + 1}`,
        color: 'yellow',
        from: { component: a.component, terminal: a.terminal },
        to: { component: b.component, terminal: b.terminal },
        points: [
          { x: index, y: 0, z: 0 },
          { x: index + 1, y: 0, z: 0 },
        ],
      })),
    }),
  )
}

/**
 * Common ESP32 component instance for validation scenarios.
 */
function esp32Instance(): BerryProject['components'][number] {
  return {
    id: 'esp32_1',
    type: 'esp32-devkit-v1',
    transform: { position: { x: 0, y: 0, z: 0 } },
  }
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

  it('errors when I2C SDA is wired to an SCL-capable board pin', () => {
    const project = projectWithPairs(
      'Swapped I2C',
      [
        esp32Instance(),
        {
          id: 'bme_1',
          type: 'bme280',
          transform: { position: { x: 1, y: 0, z: 0 } },
        },
      ],
      [[
        { component: 'bme_1', terminal: 'SDA' },
        { component: 'esp32_1', terminal: 'IO22' },
      ]],
    )

    const results = validate(project)

    expect(results.some((r) => r.code === 'net.i2c_pair_mismatch')).toBe(true)
    expect(hasValidationErrors(results)).toBe(true)
  })

  it('errors when UART pins are connected in the same direction', () => {
    const project = projectWithPairs(
      'Same UART direction',
      [esp32Instance()],
      [[
        { component: 'esp32_1', terminal: 'TX0' },
        { component: 'esp32_1', terminal: 'TX2' },
      ]],
    )

    const results = validate(project)

    expect(results.some((r) => r.code === 'net.uart_pair_mismatch')).toBe(true)
    expect(hasValidationErrors(results)).toBe(true)
  })

  it('warns when a sensor has signal wiring without power and ground', () => {
    const project = projectWithPairs(
      'Unpowered BME280',
      [
        esp32Instance(),
        {
          id: 'bme_1',
          type: 'bme280',
          transform: { position: { x: 1, y: 0, z: 0 } },
        },
      ],
      [[
        { component: 'bme_1', terminal: 'SDA' },
        { component: 'esp32_1', terminal: 'IO21' },
      ]],
    )

    const results = validate(project)
    const warning = results.find((r) => r.code === 'component.unpowered')

    expect(warning?.severity).toBe('warning')
    expect(warning?.subject).toMatchObject({ componentId: 'bme_1' })
  })

  it('does not warn for a powered BME280 on the default ESP32 I2C pins', () => {
    const project = projectWithPairs(
      'Powered BME280',
      [
        esp32Instance(),
        {
          id: 'bme_1',
          type: 'bme280',
          transform: { position: { x: 1, y: 0, z: 0 } },
        },
      ],
      [
        [
          { component: 'bme_1', terminal: 'SDA' },
          { component: 'esp32_1', terminal: 'IO21' },
        ],
        [
          { component: 'bme_1', terminal: 'SCL' },
          { component: 'esp32_1', terminal: 'IO22' },
        ],
        [
          { component: 'bme_1', terminal: 'VCC' },
          { component: 'esp32_1', terminal: '3V3' },
        ],
        [
          { component: 'bme_1', terminal: 'GND' },
          { component: 'esp32_1', terminal: 'GND_R' },
        ],
      ],
    )

    const results = validate(project)

    expect(results.some((r) => r.code === 'component.unpowered')).toBe(false)
    expect(hasValidationErrors(results)).toBe(false)
  })

  it('allows a powered PIR sensor output to feed an ESP32 GPIO input', () => {
    const project = projectWithPairs(
      'Powered PIR sensor',
      [
        esp32Instance(),
        {
          id: 'pir_1',
          type: 'pir-motion-sensor-hc-sr501',
          transform: { position: { x: 1, y: 0, z: 0 } },
        },
      ],
      [
        [
          { component: 'pir_1', terminal: 'OUT' },
          { component: 'esp32_1', terminal: 'IO27' },
        ],
        [
          { component: 'pir_1', terminal: 'VCC' },
          { component: 'esp32_1', terminal: 'VIN' },
        ],
        [
          { component: 'pir_1', terminal: 'GND' },
          { component: 'esp32_1', terminal: 'GND_R' },
        ],
      ],
    )

    const results = validate(project)

    expect(results.some((r) => r.code === 'net.incompatible_pin_kinds')).toBe(false)
    expect(results.some((r) => r.code === 'component.unpowered')).toBe(false)
    expect(hasValidationErrors(results)).toBe(false)
  })

  it('warns when a button input has no pull-up or pull-down reference', () => {
    const project = projectWithPairs(
      'Floating button',
      [
        esp32Instance(),
        {
          id: 'button_1',
          type: 'push-button',
          transform: { position: { x: 1, y: 0, z: 0 } },
        },
        {
          id: 'led_1',
          type: 'led-5mm',
          transform: { position: { x: 2, y: 0, z: 0 } },
        },
      ],
      [
        [
          { component: 'button_1', terminal: 'pin1' },
          { component: 'esp32_1', terminal: 'IO13' },
        ],
        [
          { component: 'button_1', terminal: 'pin2' },
          { component: 'led_1', terminal: 'anode' },
        ],
      ],
    )

    const results = validate(project)
    const warning = results.find((r) => r.code === 'component.floating_input')

    expect(warning?.severity).toBe('warning')
    expect(warning?.subject).toMatchObject({
      componentId: 'esp32_1',
      terminalId: 'IO13',
    })
  })

  it('errors when active outputs share one net', () => {
    const project = projectWithPairs(
      'Output conflict',
      [esp32Instance()],
      [[
        { component: 'esp32_1', terminal: 'TX0' },
        { component: 'esp32_1', terminal: 'IO13' },
      ]],
    )

    const results = validate(project)

    expect(results.some((r) => r.code === 'net.incompatible_pin_kinds')).toBe(true)
    expect(hasValidationErrors(results)).toBe(true)
  })
})
