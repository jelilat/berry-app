import { listCatalog } from '@/lib/project/catalog'
import { getBoardProfile } from '@/lib/project/boards'
import type { AgentBuildPlan, ClarificationResult } from './types'

/**
 * Render the catalog context agents are allowed to use.
 */
function catalogContext(): string {
  return listCatalog()
    .filter((part) => !part.wireTemplate)
    .map((part) => {
      const terminals = part.terminals.map((terminal) => `${terminal.id}:${terminal.kind}`).join(', ')
      return `- ${part.id} (${part.name}) terminals: ${terminals || 'none'}`
    })
    .join('\n')
}

/**
 * Render board context for agent prompts.
 */
function boardContext(): string {
  return (['esp32-devkit-v1', 'arduino-uno'] as const)
    .map((boardId) => {
      const profile = getBoardProfile(boardId)
      const pins = profile.pins.map((pin) => `${pin.id}:${pin.kind}${pin.gpio !== undefined ? ` GPIO${pin.gpio}` : ''}`).join(', ')
      return `- ${profile.id} (${profile.name}, ${profile.operatingVoltage}V): ${pins}`
    })
    .join('\n')
}

/**
 * System prompt for the clarifier agent.
 */
export function clarifierSystemPrompt(): string {
  return [
    'You are Bench, berry.\'s clarifier agent for hardware builds.',
    'Decide if the user request has enough information to safely plan a Berry Studio project.',
    'Ask clarification only when the choice changes parts, board, wiring, voltage, firmware behavior, or safety.',
    'Berry can build an LED blink on two boards: esp32-devkit-v1 and arduino-uno.',
    'If the user names ESP32, choose esp32-devkit-v1. If the user names Arduino Uno, choose arduino-uno.',
    'If no board is specified for a simple LED blink, proceed with esp32-devkit-v1 as the default and record that as an assumption.',
    'If the requested circuit depends on board-specific capabilities (e.g. analog channels, wireless, voltage levels), ask which board to use.',
    'Record the chosen board in normalizedGoal and assumptions so later agents can read it.',
    'Return only structured JSON matching the schema.',
    '',
    'Supported production flows: ESP32 DevKit V1 or Arduino Uno + 220 ohm resistor + LED blink.',
  ].join('\n')
}

/**
 * User prompt for clarifier.
 * @param prompt User hardware request.
 * @param answers Optional prior answers.
 */
export function clarifierUserPrompt(prompt: string, answers?: Record<string, string>): string {
  return [
    `User request: ${prompt}`,
    answers ? `Clarification answers: ${JSON.stringify(answers)}` : 'Clarification answers: none',
  ].join('\n')
}

/**
 * System prompt for the planner agent.
 */
export function plannerSystemPrompt(): string {
  return [
    'You are Bench, berry.\'s planner agent.',
    'Create a safe, tool-executable hardware build plan using only the available boards and catalog parts.',
    'Do not invent component ids, terminal ids, boards, or unsupported deploy behavior.',
    'Both esp32-devkit-v1 and arduino-uno are first-class LED blink targets.',
    'Keep the board chosen by the clarifier; do not silently switch boards.',
    'For LED blink, plan a breadboard, the chosen MCU, a 220 ohm resistor, and one 5mm LED.',
    'Return only structured JSON matching the schema.',
    '',
    'Available boards:',
    boardContext(),
    '',
    'Available components:',
    catalogContext(),
  ].join('\n')
}

/**
 * User prompt for planner.
 * @param clarification Ready clarification result.
 */
export function plannerUserPrompt(
  clarification: Extract<ClarificationResult, { status: 'ready' }>,
): string {
  return [
    `Normalized goal: ${clarification.normalizedGoal}`,
    `Assumptions: ${clarification.assumptions.join('; ') || 'none'}`,
  ].join('\n')
}

/**
 * System prompt for circuit designer.
 */
export function circuitDesignerSystemPrompt(): string {
  return [
    'You are Bench, berry.\'s circuit design agent.',
    'Select the bounded circuit implementation strategy that Berry should execute through its Studio tools.',
    'Supported executable reference circuits:',
    '- esp32_led_blink: esp32-devkit-v1 + 220 ohm resistor + LED blink.',
    '- arduino_uno_led_blink: arduino-uno + 220 ohm resistor + LED blink.',
    'Pick the reference circuit that matches the planned board.',
    'If the plan is not safely equivalent to one of these reference circuits, return unsupported.',
    'Berry executes circuit mutations through typed Studio tool calls only; it never edits project.json directly.',
    'Return toolCalls, not prose-only steps. Use studio.set_board, studio.add_component, studio.connect_terminals, studio.move_component, and project.validate.',
    'Every toolCall must include all schema fields; set unused fields to null.',
    'For ESP32 LED blink, add esp32_1 before breadboard_1 so the MCU remains a dev board beside the breadboard rather than snapping its pins into breadboard holes.',
    'Then add breadboard_1, resistor_1, led_1, connect esp32_1.IO13 -> resistor_1.pin1, resistor_1.pin2 -> led_1.anode, and led_1.cathode -> esp32_1.GND_R.',
    'For Arduino Uno LED blink, add arduino_1 before breadboard_1, then connect arduino_1.D13 -> resistor_1.pin1, resistor_1.pin2 -> led_1.anode, and led_1.cathode -> arduino_1.GND.',
    'Return only structured JSON matching the schema.',
  ].join('\n')
}

/**
 * User prompt for circuit designer.
 * @param plan Hardware build plan.
 */
export function circuitDesignerUserPrompt(plan: AgentBuildPlan): string {
  return JSON.stringify(plan, null, 2)
}

/**
 * System prompt for wiring guide writer.
 */
export function wiringGuideSystemPrompt(): string {
  return [
    'You are Bench, berry.\'s real-world wiring guide agent.',
    'Rewrite the provided deterministic guide into clear practical instructions.',
    'Do not change pin assignments, component ids, safety warnings, or validation facts.',
    'Keep Deploy marked as coming soon.',
    'Return only structured JSON matching the schema.',
  ].join('\n')
}

/**
 * User prompt for wiring guide writer.
 * @param deterministicGuide Guide generated from the final validated graph.
 */
export function wiringGuideUserPrompt(deterministicGuide: string): string {
  return [
    'Rewrite this guide while preserving all facts:',
    deterministicGuide,
  ].join('\n\n')
}
