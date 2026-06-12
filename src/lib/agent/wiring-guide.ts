import { getComponentDefinition } from '@/lib/project/catalog'
import { getBoardProfile } from '@/lib/project/boards'
import type { BerryProject } from '@/lib/project/types'
import type { ValidationResult } from '@/lib/validation'
import type { CodegenResult } from '@/lib/codegen/types'

/**
 * Find a component display name by instance id.
 * @param project Final validated project graph.
 * @param componentId Component instance id.
 */
function componentName(project: BerryProject, componentId: string): string {
  const instance = project.components.find((component) => component.id === componentId)
  if (!instance) return componentId
  return getComponentDefinition(instance.type).name
}

/**
 * Render validation warnings for the final guide.
 * @param validationResults Validation findings from the final graph.
 */
function renderValidationNotes(validationResults: ValidationResult[]): string[] {
  return validationResults
    .filter((result) => result.severity !== 'error')
    .map((result) => `- ${result.message}`)
}

/**
 * Generate real-world wiring instructions from the final validated project graph.
 * @param project Final validated project.
 * @param codegen Firmware generation result with resolved pin map.
 * @param validationResults Validation findings to include as notes.
 */
export function generateWiringGuide(
  project: BerryProject,
  codegen: CodegenResult,
  validationResults: ValidationResult[],
): string {
  const board = getBoardProfile(project.board)
  const parts = project.components.map((component) => {
    const def = getComponentDefinition(component.type)
    return `- ${def.name}${component.id ? ` (${component.id})` : ''}`
  })
  const ledLines = codegen.pinMap.leds.flatMap((led, index) => {
    const ledName = componentName(project, led.componentId)
    const label = codegen.pinMap.leds.length === 1 ? 'the LED' : `${ledName} ${index + 1}`
    return [
      `${index + 1}. Connect ${board.name} ${led.gpio.boardTerminalLabel} (${led.gpio.boardTerminalId}) to one side of the 220 ohm resistor.`,
      `${index + 2}. Connect the other side of the resistor to the anode of ${label}.`,
      `${index + 3}. Connect the cathode of ${label} to GND.`,
    ]
  })
  const validationNotes = renderValidationNotes(validationResults)

  return [
    `# Wiring guide`,
    ``,
    `## Parts`,
    ...parts,
    ``,
    `## Board`,
    `- Target: ${board.name}`,
    `- Logic voltage: ${board.operatingVoltage} V`,
    ``,
    `## Wiring`,
    `1. Place the ${board.name}, breadboard, resistor, and LED as shown in Studio.`,
    ...ledLines,
    ``,
    `## Firmware behavior`,
    `- The generated firmware configures the mapped LED GPIO as an output.`,
    `- The LED turns on for 500 ms and off for 500 ms in a loop.`,
    `- Open the serial monitor at ${project.board === 'esp32-devkit-v1' ? 115200 : 9600} baud for boot and debug output.`,
    ``,
    `## Checks before power`,
    `- Confirm the LED anode goes toward the GPIO through the resistor.`,
    `- Confirm the LED cathode goes to GND.`,
    `- Keep the resistor in series with the LED; do not wire the LED directly across GPIO and GND.`,
    ``,
    `## Validation notes`,
    validationNotes.length > 0 ? validationNotes.join('\n') : `- No validation warnings remain.`,
    ``,
    `## Deploy`,
    `- Deploy is coming soon. For now, use Build and Simulate to verify the design.`,
  ].join('\n')
}
