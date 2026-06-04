import type { TerminalSelection } from '@/lib/studio/flow-map'
import type { WireDraftState } from '@/lib/studio/wire-draft'
import type { BerryProject } from '@/lib/project/types'
import {
  breadboardPhysicalSiteKey,
  collectOccupiedBreadboardSites,
} from '@/lib/project/breadboard-nets'
import {
  isBreadboardHoleRef,
  type BreadboardHoleRef,
  type WireEndpointRef,
} from '@/lib/project/mutations'

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
  if (isBreadboardHoleRef(wireDraft.from)) return null
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
 * Build the set of terminals unavailable for direct jumper wiring.
 * Terminals are unavailable when they are already on a net or physically placed
 * into a breadboard hole; use the breadboard hole itself as the wiring point.
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
  for (const component of project.components) {
    if (!component.parent || !component.placement?.sites) continue
    for (const terminalId of Object.keys(component.placement.sites)) {
      keys.add(terminalKey(component.id, terminalId))
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

/**
 * Resolve the breadboard hole occupied by a component terminal, if it is placed.
 * @param project Berry project graph.
 * @param componentId Component instance id.
 * @param terminalId Terminal id on the component.
 */
export function terminalBreadboardEndpoint(
  project: BerryProject,
  componentId: string,
  terminalId: string,
): BreadboardHoleRef | null {
  const instance = project.components.find((c) => c.id === componentId)
  const site = instance?.placement?.sites?.[terminalId]
  if (!instance?.parent || !site) return null

  const breadboard = project.components.find((c) => c.id === instance.parent)
  if (!breadboard || breadboard.type !== 'breadboard-full') return null

  return { breadboardId: breadboard.id, site }
}

/**
 * Whether a breadboard hole endpoint is the same physical hole as a placed pin.
 * @param project Berry project graph.
 * @param componentId Component instance id.
 * @param terminalId Terminal id on the component.
 * @param hole Breadboard endpoint to compare.
 */
export function terminalOccupiesBreadboardEndpoint(
  project: BerryProject,
  componentId: string,
  terminalId: string,
  hole: BreadboardHoleRef,
): boolean {
  const placed = terminalBreadboardEndpoint(project, componentId, terminalId)
  if (!placed) return false
  return (
    placed.breadboardId === hole.breadboardId &&
    breadboardPhysicalSiteKey(placed.site) === breadboardPhysicalSiteKey(hole.site)
  )
}

/**
 * Whether a breadboard hole already has a physical jumper/part lead in it.
 * @param project Berry project graph.
 * @param hole Breadboard endpoint to inspect.
 * @param options Optional wire to ignore (e.g. while moving one of its endpoints).
 */
export function isBreadboardEndpointOccupied(
  project: BerryProject,
  hole: BreadboardHoleRef,
  options?: { excludeWireId?: string },
): boolean {
  const key = breadboardPhysicalSiteKey(hole.site)
  if (collectOccupiedBreadboardSites(project, hole.breadboardId).has(key)) return true

  const endpointOccupied = (endpoint: WireEndpointRef): boolean =>
    isBreadboardHoleRef(endpoint) &&
    endpoint.breadboardId === hole.breadboardId &&
    breadboardPhysicalSiteKey(endpoint.site) === key

  for (const wire of project.wires) {
    if (options?.excludeWireId && wire.id === options.excludeWireId) continue
    if (wire.from?.breadboard && wire.from.site) {
      if (endpointOccupied({ breadboardId: wire.from.breadboard, site: wire.from.site })) {
        return true
      }
    }
    if (wire.to?.breadboard && wire.to.site) {
      if (endpointOccupied({ breadboardId: wire.to.breadboard, site: wire.to.site })) {
        return true
      }
    }
  }

  return false
}

/**
 * Whether a breadboard hole is free for a wire endpoint move.
 * @param project Berry project graph.
 * @param hole Target breadboard hole.
 * @param wireId Wire being edited (its current endpoints are ignored).
 */
export function isBreadboardHoleAvailableForWire(
  project: BerryProject,
  hole: BreadboardHoleRef,
  wireId: string,
): boolean {
  return !isBreadboardEndpointOccupied(project, hole, { excludeWireId: wireId })
}
