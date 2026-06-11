import { buildProjectPinMap } from '@/lib/codegen/pin-map'
import type { BerryProject } from '@/lib/project/types'

/** Supported mock simulation circuit profiles. */
export type SupportedCircuitProfile = 'esp32-led-blink'

/** Resolved GPIO pin for a supported blink circuit. */
export interface Esp32LedBlinkCircuit {
  profile: 'esp32-led-blink'
  gpioPin: number
  ledComponentId: string
}

/**
 * Detect whether the project matches the ESP32 LED blink demo circuit.
 * Requires ESP32 devkit board, one LED on GPIO via the wiring graph, and a resistor.
 * @param project Parsed Berry project graph.
 */
export function detectEsp32LedBlinkCircuit(
  project: BerryProject,
): Esp32LedBlinkCircuit | null {
  if (project.board !== 'esp32-devkit-v1') {
    return null
  }

  const hasEsp32 = project.components.some((component) => component.type === 'esp32-devkit-v1')
  const hasLed = project.components.some((component) => component.type === 'led-5mm')
  const hasResistor = project.components.some((component) =>
    component.type.startsWith('resistor-'),
  )

  if (!hasEsp32 || !hasLed || !hasResistor) {
    return null
  }

  const pinMap = buildProjectPinMap(project)
  if (pinMap.leds.length !== 1) {
    return null
  }

  const led = pinMap.leds[0]!
  return {
    profile: 'esp32-led-blink',
    gpioPin: led.gpio.arduinoPin,
    ledComponentId: led.componentId,
  }
}
