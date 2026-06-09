import type { ComponentTypeId, TerminalKind } from '@/lib/project/types'
import {
  terminalIdentityKey,
  type NetContext,
  type ResolvedTerminal,
  type ValidationContext,
} from '../context'
import type { ValidationResult } from '../types'

/** Breadth-first search state while walking the terminal graph. */
interface WalkState {
  key: string
  hasResistor: boolean
}

/**
 * True when the terminal can source current into an LED anode without a resistor.
 * @param kind Catalog terminal kind.
 */
function isLedDriveSourceKind(kind: TerminalKind | null): boolean {
  return kind === 'gpio' || kind === 'power_out'
}

/**
 * True when a catalog type is a discrete resistor.
 * @param type Component catalog id.
 */
function isResistorType(type: ComponentTypeId | undefined): boolean {
  return type?.startsWith('resistor-') ?? false
}

/**
 * Other terminals on the same part that share internal copper.
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
 * Collect terminals electrically connected to a net, including breadboard tie merges.
 * @param ctx Validation context.
 * @param net Net under inspection.
 */
function collectConnectedTerminals(
  ctx: ValidationContext,
  net: NetContext,
): ResolvedTerminal[] {
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
    const tieGroup = ctx.terminalsByTieKey.get(terminal.tieKey) ?? []
    for (const peer of tieGroup) {
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
  const terminalByKey = new Map<string, ResolvedTerminal>()

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
    const key = terminalIdentityKey(terminal)
    if (!terminal.componentId || !terminal.terminalId) return
    terminalByKey.set(key, terminal)
    ensureNode(key)

    for (const peerId of internalTerminalPeers(terminal.componentType, terminal.terminalId)) {
      link(key, `${terminal.componentId}:${peerId}`)
    }
  }

  for (const net of ctx.nets) {
    const connected = collectConnectedTerminals(ctx, net)
    for (const terminal of connected) {
      register(terminal)
    }
    const keys = connected
      .map(terminalIdentityKey)
      .filter((key) => key.includes(':'))
    for (let i = 0; i < keys.length; i += 1) {
      for (let j = i + 1; j < keys.length; j += 1) {
        link(keys[i], keys[j])
      }
    }
  }

  for (const group of ctx.terminalsByTieKey.values()) {
    const keys = group
      .map(terminalIdentityKey)
      .filter((key) => key.includes(':'))
    for (const terminal of group) {
      register(terminal)
    }
    for (let i = 0; i < keys.length; i += 1) {
      for (let j = i + 1; j < keys.length; j += 1) {
        link(keys[i], keys[j])
      }
    }
  }

  return adjacency
}

/**
 * Look up resolved metadata for a `componentId:terminalId` graph key.
 * @param ctx Validation context.
 * @param key Terminal graph key.
 */
function lookupTerminal(
  ctx: ValidationContext,
  key: string,
): ResolvedTerminal | undefined {
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
 * Warn when a 5 mm LED anode reaches GPIO or power without a series resistor.
 * Walks nets and breadboard tie groups from the anode.
 * @param ctx Precomputed validation context.
 */
export function checkComponents(ctx: ValidationContext): ValidationResult[] {
  const results: ValidationResult[] = []
  const adjacency = buildTerminalAdjacency(ctx)
  const warnedLeds = new Set<string>()

  for (const instance of ctx.project.components) {
    if (instance.type !== 'led-5mm') continue

    const startKey = `${instance.id}:anode`
    if (!adjacency.has(startKey)) continue

    const queue: WalkState[] = [{ key: startKey, hasResistor: false }]
    const visited = new Set<string>()

    while (queue.length > 0) {
      const { key, hasResistor } = queue.shift()!
      if (visited.has(`${key}:${hasResistor}`)) continue
      visited.add(`${key}:${hasResistor}`)

      const terminal = lookupTerminal(ctx, key)
      const onResistor =
        hasResistor || isResistorType(terminal?.componentType)

      if (
        key !== startKey &&
        terminal &&
        isLedDriveSourceKind(terminal.kind)
      ) {
        if (!onResistor && !warnedLeds.has(instance.id)) {
          warnedLeds.add(instance.id)
          results.push({
            code: 'component.led_no_resistor',
            severity: 'warning',
            message:
              'LED anode is driven directly from GPIO or power without a series resistor',
            subject: {
              componentId: instance.id,
              terminalId: 'anode',
              netId: terminal.netId !== '__placement__' ? terminal.netId : undefined,
            },
          })
        }
        continue
      }

      for (const neighbor of adjacency.get(key) ?? []) {
        queue.push({ key: neighbor, hasResistor: onResistor })
      }
    }
  }

  return results
}
