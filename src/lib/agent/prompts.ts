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
    'For an ESP32 blinking LED request, proceed with assumptions instead of asking.',
    'Return only structured JSON matching the schema.',
    '',
    'Supported first production flow: ESP32 DevKit V1 + 220 ohm resistor + LED blink.',
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
    'For the current production slice, prefer the ESP32 LED blink reference circuit when compatible.',
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
    'Current supported executable reference circuit: esp32_led_blink.',
    'If the plan is not safely equivalent to ESP32 DevKit V1 + resistor + LED blink, return unsupported.',
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
