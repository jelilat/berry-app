import { getBoardProfile } from '@/lib/project/boards'
import { getComponentDefinition } from '@/lib/project/catalog'
import type { BerryProject, BoardId, ComponentTypeId } from '@/lib/project/types'
import {
  buildValidationContext,
  terminalIdentityKey,
  type ResolvedTerminal,
  type ValidationContext,
} from '@/lib/validation/context'
import type { MappedGpio, MappedLed, ProjectPinMap } from './types'

const MCU_TYPES: ComponentTypeId[] = ['esp32-devkit-v1', 'arduino-uno']
const RESISTOR_PREFIX = 'resistor-'

/**
 * Find the firmware target MCU instance on the bench.
 * @param project Berry project graph.
 */
export function findMcuComponent(project: BerryProject) {
  const byBoard = project.components.find((component) => component.type === project.board)
  if (byBoard) return byBoard
  return project.components.find((component) => MCU_TYPES.includes(component.type))
}

/**
 * Resolve the Arduino GPIO number for a board terminal id.
 * @param board Target board profile id.
 * @param terminalId Board pin id from the catalog.
 */
export function resolveBoardArduinoPin(board: BoardId, terminalId: string): number | null {
  const profile = getBoardProfile(board)
  const pin = profile.pins.find((candidate) => candidate.id === terminalId)
  if (pin?.gpio === undefined) return null
  if (pin.kind !== 'gpio' && pin.kind !== 'pwm') return null
  return pin.gpio
}

/**
 * True when a catalog type is a discrete resistor.
 * @param type Component catalog id.
 */
function isResistorType(type: ComponentTypeId | undefined): boolean {
  return type?.startsWith(RESISTOR_PREFIX) ?? false
}

/**
 * Internal copper peers for simple two-terminal passives.
 * @param type Component catalog id.
 * @param terminalId Terminal being expanded.
 */
function internalTerminalPeers(
  type: ComponentTypeId | undefined,
  terminalId: string,
): string[] {
  if (!type) return []
  if (isResistorType(type) || type === 'push-button') {
    if (terminalId === 'pin1') return ['pin2']
    if (terminalId === 'pin2') return ['pin1']
  }
  return []
}

/**
 * Collect terminals on a net including breadboard tie merges.
 * @param ctx Validation context.
 * @param netId Net to expand.
 */
function collectNetTerminals(ctx: ValidationContext, netId: string): ResolvedTerminal[] {
  const net = ctx.nets.find((candidate) => candidate.netId === netId)
  if (!net) return []

  const seen = new Set<string>()
  const connected: ResolvedTerminal[] = []

  const add = (terminal: ResolvedTerminal) => {
    const key = terminalIdentityKey(terminal)
    if (seen.has(key)) return
    seen.add(key)
    connected.push(terminal)
  }

  for (const terminal of net.terminals) {
    add(terminal)
    if (!terminal.tieKey) continue
    for (const peer of ctx.terminalsByTieKey.get(terminal.tieKey) ?? []) {
      add(peer)
    }
  }

  return connected
}

/**
 * Build an undirected adjacency list of component terminals from nets and breadboard ties.
 * @param ctx Precomputed validation context.
 */
function buildTerminalAdjacency(ctx: ValidationContext): Map<string, Set<string>> {
  const adjacency = new Map<string, Set<string>>()

  const ensureNode = (key: string) => {
    if (!adjacency.has(key)) adjacency.set(key, new Set())
  }

  const link = (a: string, b: string) => {
    if (a === b) return
    ensureNode(a)
    ensureNode(b)
    adjacency.get(a)!.add(b)
    adjacency.get(b)!.add(a)
  }

  const register = (terminal: ResolvedTerminal) => {
    if (!terminal.componentId || !terminal.terminalId) return
    const key = `${terminal.componentId}:${terminal.terminalId}`
    ensureNode(key)
    for (const peerId of internalTerminalPeers(terminal.componentType, terminal.terminalId)) {
      link(key, `${terminal.componentId}:${peerId}`)
    }
  }

  for (const net of ctx.nets) {
    const connected = collectNetTerminals(ctx, net.netId)
    for (const terminal of connected) register(terminal)
    const keys = connected
      .filter((terminal) => terminal.componentId && terminal.terminalId)
      .map((terminal) => `${terminal.componentId}:${terminal.terminalId}`)
    for (let i = 0; i < keys.length; i += 1) {
      for (let j = i + 1; j < keys.length; j += 1) {
        link(keys[i]!, keys[j]!)
      }
    }
  }

  for (const group of ctx.terminalsByTieKey.values()) {
    const keys = group
      .filter((terminal) => terminal.componentId && terminal.terminalId)
      .map((terminal) => `${terminal.componentId}:${terminal.terminalId}`)
    for (const terminal of group) register(terminal)
    for (let i = 0; i < keys.length; i += 1) {
      for (let j = i + 1; j < keys.length; j += 1) {
        link(keys[i]!, keys[j]!)
      }
    }
  }

  return adjacency
}

/**
 * Look up resolved terminal metadata for a graph key.
 * @param ctx Validation context.
 * @param key `componentId:terminalId` key.
 */
function lookupTerminal(ctx: ValidationContext, key: string): ResolvedTerminal | undefined {
  for (const net of ctx.nets) {
    for (const terminal of net.terminals) {
      if (terminalIdentityKey(terminal) === key) return terminal
    }
  }
  for (const group of ctx.terminalsByTieKey.values()) {
    for (const terminal of group) {
      if (terminalIdentityKey(terminal) === key) return terminal
    }
  }
  return undefined
}

/**
 * Find the board GPIO driving a component terminal through nets and passives.
 * @param ctx Validation context.
 * @param adjacency Terminal adjacency graph.
 * @param mcuComponentId Board MCU instance id.
 * @param board Target board profile id.
 * @param startComponentId Peripheral component id.
 * @param startTerminalId Peripheral terminal id.
 */
function findDrivingBoardGpio(
  ctx: ValidationContext,
  adjacency: Map<string, Set<string>>,
  mcuComponentId: string,
  board: BoardId,
  startComponentId: string,
  startTerminalId: string,
): MappedGpio | null {
  const startKey = `${startComponentId}:${startTerminalId}`
  if (!adjacency.has(startKey)) return null

  const queue = [startKey]
  const visited = new Set<string>([startKey])

  while (queue.length > 0) {
    const key = queue.shift()!
    const terminal = lookupTerminal(ctx, key)
    if (
      terminal?.componentId === mcuComponentId &&
      terminal.terminalId &&
      (terminal.kind === 'gpio' || terminal.kind === 'pwm')
    ) {
      const arduinoPin = resolveBoardArduinoPin(board, terminal.terminalId)
      if (arduinoPin === null) continue
      const profile = getBoardProfile(board)
      const boardPin = profile.pins.find((candidate) => candidate.id === terminal.terminalId)
      return {
        boardTerminalId: terminal.terminalId,
        boardTerminalLabel: boardPin?.label ?? terminal.terminalId,
        arduinoPin,
      }
    }

    for (const neighbor of adjacency.get(key) ?? []) {
      if (visited.has(neighbor)) continue
      visited.add(neighbor)
      queue.push(neighbor)
    }
  }

  return null
}

/**
 * Build a pin map from the wiring graph for firmware codegen.
 * @param project Berry project graph.
 */
export function buildProjectPinMap(project: BerryProject): ProjectPinMap {
  const mcu = findMcuComponent(project)
  const ctx = buildValidationContext(project)
  const adjacency = buildTerminalAdjacency(ctx)
  const leds: MappedLed[] = []

  if (mcu) {
    for (const component of project.components) {
      if (component.type !== 'led-5mm') continue
      const gpio = findDrivingBoardGpio(
        ctx,
        adjacency,
        mcu.id,
        project.board,
        component.id,
        'anode',
      )
      if (!gpio) continue
      leds.push({
        componentId: component.id,
        componentName: getComponentDefinition(component.type).name,
        gpio,
      })
    }
  }

  return {
    board: project.board,
    mcuComponentId: mcu?.id ?? '',
    mcuComponentName: mcu ? getComponentDefinition(mcu.type).name : 'Unknown MCU',
    leds,
  }
}
