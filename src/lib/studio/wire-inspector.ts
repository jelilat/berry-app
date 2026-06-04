import {
  formatBreadboardSite,
  type BreadboardSite,
} from '@/lib/project/breadboard'
import { getComponentDefinition } from '@/lib/project/catalog'
import {
  isBreadboardHoleRef,
  resolveWireTerminalRefs,
  type WireEndpointRef,
} from '@/lib/project/mutations'
import type { BerryProject, NetTerminal, WireConnectorGender } from '@/lib/project/types'
import { wireStrokeHex } from './wire-colors'

/** Display row for one wire endpoint or net member. */
export interface WireEndpointDisplay {
  label: string
  detail: string
  kind: 'component' | 'breadboard'
  holeInput: string | null
  canEditHole: boolean
}

/** Inspector view model for a selected jumper wire. */
export interface WireInspectorModel {
  wireId: string
  netId: string
  color: string
  colorHex: string
  connectors: { start: WireConnectorGender; end: WireConnectorGender } | null
  from: WireEndpointDisplay
  to: WireEndpointDisplay
  netMembers: WireEndpointDisplay[]
}

/**
 * Build inspector data for a selected visual jumper wire.
 * @param project Current Berry project graph.
 * @param wireId Selected wire id.
 */
export function buildWireInspectorModel(
  project: BerryProject,
  wireId: string,
): WireInspectorModel | null {
  const wire = project.wires.find((candidate) => candidate.id === wireId)
  if (!wire) return null

  const refs = resolveWireTerminalRefs(project, wire)
  if (!refs) return null

  const net = project.nets.find((candidate) => candidate.id === wire.net)
  const color = wire.color ?? 'yellow'

  return {
    wireId: wire.id,
    netId: wire.net,
    color,
    colorHex: wireStrokeHex(color),
    connectors: wire.connectors ?? null,
    from: endpointRefDisplay(project, refs[0], 'from'),
    to: endpointRefDisplay(project, refs[1], 'to'),
    netMembers: net?.terminals.map((terminal) => netTerminalDisplay(project, terminal)) ?? [],
  }
}

/**
 * Format a wire endpoint reference for display.
 * @param project Current Berry project graph.
 * @param endpoint Wire endpoint reference.
 */
function endpointRefDisplay(
  project: BerryProject,
  endpoint: WireEndpointRef,
  end?: 'from' | 'to',
): WireEndpointDisplay {
  if (isBreadboardHoleRef(endpoint)) {
    return breadboardEndpointDisplay(endpoint.breadboardId, endpoint.site, end)
  }

  const component = project.components.find((candidate) => candidate.id === endpoint.componentId)
  if (!component) {
    return {
      kind: 'component',
      label: `${endpoint.componentId}:${endpoint.terminalId}`,
      detail: 'Missing component',
      holeInput: null,
      canEditHole: false,
    }
  }

  const definition = getComponentDefinition(component.type)
  const terminal = definition.terminals.find((candidate) => candidate.id === endpoint.terminalId)
  const site = component.placement?.sites?.[endpoint.terminalId]

  return {
    kind: 'component',
    label: `${component.id}:${terminal?.label ?? endpoint.terminalId}`,
    detail: site
      ? `${definition.name} at ${formatBreadboardSite(site)}`
      : definition.name,
    holeInput: null,
    canEditHole: false,
  }
}

/**
 * Format a net terminal for display.
 * @param project Current Berry project graph.
 * @param terminal Net terminal entry.
 */
function netTerminalDisplay(
  project: BerryProject,
  terminal: NetTerminal,
): WireEndpointDisplay {
  if (terminal.breadboard && terminal.site) {
    return breadboardEndpointDisplay(terminal.breadboard, terminal.site)
  }
  if (terminal.component && terminal.terminal) {
    return endpointRefDisplay(project, {
      componentId: terminal.component,
      terminalId: terminal.terminal,
    })
  }
  return {
    kind: 'component',
    label: 'Unknown endpoint',
    detail: 'Invalid net terminal',
    holeInput: null,
    canEditHole: false,
  }
}

/**
 * Format a bare breadboard endpoint for display.
 * @param breadboardId Breadboard component id.
 * @param site Breadboard site.
 */
function breadboardEndpointDisplay(
  breadboardId: string,
  site: BreadboardSite,
  end?: 'from' | 'to',
): WireEndpointDisplay {
  return {
    kind: 'breadboard',
    label: `${breadboardId}:${formatBreadboardSite(site)}`,
    detail: end ? `Edit ${end} hole` : 'Breadboard hole',
    holeInput: site.kind === 'hole' ? `${site.row}${site.column}` : null,
    canEditHole: site.kind === 'hole',
  }
}
