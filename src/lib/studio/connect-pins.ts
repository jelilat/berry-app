import type { TerminalSelection } from '@/lib/studio/flow-map'
import type { WireDraftState } from '@/lib/studio/wire-draft'
import type { BerryProject } from '@/lib/project/types'

/**
 * Whether a pin is highlighted as the wire drag source or drop target.
 * @param instanceId Component instance id.
 * @param terminalId Terminal id on the component.
 * @param wireDraft Active wire drag.
 * @param hoverTarget Pin currently under the pointer.
 */
export function wirePinHighlight(
  instanceId: string,
  terminalId: string,
  wireDraft: WireDraftState | null,
  hoverTarget: TerminalSelection | null,
): 'source' | 'target' | null {
  if (!wireDraft) return null
  if (
    wireDraft.from.componentId === instanceId &&
    wireDraft.from.terminalId === terminalId
  ) {
    return 'source'
  }
  if (
    hoverTarget?.componentId === instanceId &&
    hoverTarget.terminalId === terminalId
  ) {
    return 'target'
  }
  return null
}

/**
 * Stable key for a component terminal.
 * @param componentId Component instance id.
 * @param terminalId Terminal id on the component.
 */
export function terminalKey(componentId: string, terminalId: string): string {
  return `${componentId}:${terminalId}`
}

/**
 * Build the set of component terminals already present on project nets.
 * @param project Berry project graph.
 */
export function connectedTerminalKeys(project: BerryProject): Set<string> {
  const keys = new Set<string>()
  for (const net of project.nets) {
    for (const terminal of net.terminals) {
      if (!terminal.component || !terminal.terminal) continue
      keys.add(terminalKey(terminal.component, terminal.terminal))
    }
  }
  return keys
}

/**
 * Whether a terminal is already part of an electrical net.
 * @param connected Existing connected terminal keys.
 * @param componentId Component instance id.
 * @param terminalId Terminal id on the component.
 */
export function isTerminalConnected(
  connected: Set<string>,
  componentId: string,
  terminalId: string,
): boolean {
  return connected.has(terminalKey(componentId, terminalId))
}
