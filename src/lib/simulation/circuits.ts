import { buildProjectPinMap } from '@/lib/codegen/pin-map'
import type { BerryProject, BoardId } from '@/lib/project/types'

/** Supported mock simulation circuit profiles. */
export type SupportedCircuitProfile = 'esp32-led-blink' | 'arduino-uno-led-blink'

/** Boards the mock simulator can detect an LED blink circuit on. */
const SIMULATABLE_LED_BLINK_BOARDS: BoardId[] = ['esp32-devkit-v1', 'arduino-uno']

/** Maps a board id to its mock LED blink profile id. */
const LED_BLINK_PROFILE_BY_BOARD: Record<BoardId, SupportedCircuitProfile> = {
  'esp32-devkit-v1': 'esp32-led-blink',
  'arduino-uno': 'arduino-uno-led-blink',
}

/** Resolved GPIO pin for a supported blink circuit on any supported board. */
export interface LedBlinkCircuit {
  profile: SupportedCircuitProfile
  board: BoardId
  gpioPin: number
  ledComponentId: string
}

/** Resolved GPIO pin for the ESP32 LED blink circuit (kept for compatibility). */
export interface Esp32LedBlinkCircuit {
  profile: 'esp32-led-blink'
  gpioPin: number
  ledComponentId: string
}

/**
 * Detect whether the project matches a supported LED blink demo circuit.
 * Requires a supported board, its MCU on the bench, one LED driven from a GPIO
 * through the wiring graph, and a resistor.
 * @param project Parsed Berry project graph.
 */
export function detectLedBlinkCircuit(
  project: BerryProject,
): LedBlinkCircuit | null {
  if (!SIMULATABLE_LED_BLINK_BOARDS.includes(project.board)) {
    return null
  }

  const hasMcu = project.components.some((component) => component.type === project.board)
  const hasLed = project.components.some((component) => component.type === 'led-5mm')
  const hasResistor = project.components.some((component) =>
    component.type.startsWith('resistor-'),
  )

  if (!hasMcu || !hasLed || !hasResistor) {
    return null
  }

  const pinMap = buildProjectPinMap(project)
  if (pinMap.leds.length !== 1) {
    return null
  }

  const led = pinMap.leds[0]!
  return {
    profile: LED_BLINK_PROFILE_BY_BOARD[project.board],
    board: project.board,
    gpioPin: led.gpio.arduinoPin,
    ledComponentId: led.componentId,
  }
}

/**
 * Detect the ESP32 LED blink circuit specifically.
 * Thin wrapper over {@link detectLedBlinkCircuit} for existing callers/tests.
 * @param project Parsed Berry project graph.
 */
export function detectEsp32LedBlinkCircuit(
  project: BerryProject,
): Esp32LedBlinkCircuit | null {
  const circuit = detectLedBlinkCircuit(project)
  if (!circuit || circuit.board !== 'esp32-devkit-v1') {
    return null
  }
  return {
    profile: 'esp32-led-blink',
    gpioPin: circuit.gpioPin,
    ledComponentId: circuit.ledComponentId,
  }
}
