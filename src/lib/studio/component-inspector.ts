import { formatBreadboardSite } from '@/lib/project/breadboard'
import { getComponentDefinition } from '@/lib/project/catalog'
import { COMPONENT_GROUP_LABELS } from '@/lib/project/catalog-groups'
import {
  componentSceneDimensions,
  normalizeRotationZ,
} from '@/lib/project/terminal-layout'
import type { BerryProject, ComponentGroup, ComponentTypeId, TerminalKind } from '@/lib/project/types'
import { SCENE_SCALE } from './constants'
import { getPhysicalDimensionsMm } from './physical-dimensions'

/** One peer on the same electrical net as a pin. */
export interface PinNetPeer {
  componentId: string
  componentName: string
  componentType: ComponentTypeId
  terminalId: string
  terminalLabel: string
}

/** Pin row for the inspector table. */
export interface ComponentPinRow {
  terminalId: string
  label: string
  kind: TerminalKind
  displayKind: string
  hole: string | null
  netId: string | null
  peers: PinNetPeer[]
  wireIds: string[]
}

/** View model for the selected component inspector panel. */
export interface ComponentInspectorModel {
  instanceId: string
  typeId: ComponentTypeId
  name: string
  groupLabel: string
  groupBadge: string
  physicalMm: { width: number; height: number; depth: number }
  sceneSize: { w: number; h: number }
  positionScene: { x: number; y: number }
  positionCanvasPx: { x: number; y: number }
  rotationZ: number
  parentId: string | null
  pins: ComponentPinRow[]
  connectedPinCount: number
}

/**
 * Map terminal kind to a short inspector label (matches bench vocabulary).
 * @param kind Catalog terminal kind.
 */
export function terminalKindLabel(kind: TerminalKind): string {
  switch (kind) {
    case 'gpio':
      return 'bidirectional'
    case 'analog_in':
      return 'analog'
    case 'power_in':
      return 'power_in'
    case 'power_out':
      return 'power_out'
    case 'ground':
      return 'ground'
    case 'i2c_sda':
      return 'i2c_sda'
    case 'i2c_scl':
      return 'i2c_scl'
    case 'uart_tx':
      return 'uart_tx'
    case 'uart_rx':
      return 'uart_rx'
    case 'pwm':
      return 'pwm'
    default:
      return kind
  }
}

/**
 * Short badge for tray group (e.g. microcontrollers → MCU).
 * @param group Catalog tray group.
 */
export function groupBadgeLabel(group: ComponentGroup): string {
  switch (group) {
    case 'microcontrollers':
      return 'MCU'
    case 'breadboards':
      return 'Board'
    case 'sensors':
      return 'Sensor'
    case 'displays':
      return 'Display'
    case 'inputs':
      return 'Input'
    case 'actuators':
      return 'Actuator'
    case 'passives':
      return 'Passive'
    default:
      return 'Part'
  }
}

/**
 * Build inspector data for a placed component, including net and wire membership per pin.
 * @param project Current Berry project graph.
 * @param componentId Selected instance id.
 */
export function buildComponentInspectorModel(
  project: BerryProject,
  componentId: string,
): ComponentInspectorModel | null {
  const instance = project.components.find((c) => c.id === componentId)
  if (!instance) return null

  const def = getComponentDefinition(instance.type)
  const rotationZ = normalizeRotationZ(instance.transform.rotation?.z ?? 0)
  const sceneSize = componentSceneDimensions(instance.type, rotationZ)
  const physical = getPhysicalDimensionsMm(instance.type)
  const px = instance.transform.position.x * SCENE_SCALE
  const py = instance.transform.position.y * SCENE_SCALE

  const pins: ComponentPinRow[] = def.terminals.map((term) => {
    const net = project.nets.find((n) =>
      n.terminals.some((t) => t.component === componentId && t.terminal === term.id),
    )
    const peers: PinNetPeer[] = []
    if (net) {
      for (const leg of net.terminals) {
        if (!leg.component || !leg.terminal) continue
        if (leg.component === componentId && leg.terminal === term.id) continue
        const peerInst = project.components.find((c) => c.id === leg.component)
        if (!peerInst) continue
        const peerDef = getComponentDefinition(peerInst.type)
        const peerTerm = peerDef.terminals.find((t) => t.id === leg.terminal)
        peers.push({
          componentId: leg.component,
          componentName: peerInst.id,
          componentType: peerInst.type,
          terminalId: leg.terminal,
          terminalLabel: peerTerm?.label ?? leg.terminal,
        })
      }
    }

    const wireIds = net
      ? project.wires.filter((w) => w.net === net.id).map((w) => w.id)
      : []

    const site = instance.placement?.sites?.[term.id]

    return {
      terminalId: term.id,
      label: term.label ?? term.id,
      kind: term.kind,
      displayKind: terminalKindLabel(term.kind),
      hole: site ? formatBreadboardSite(site) : null,
      netId: net?.id ?? null,
      peers,
      wireIds,
    }
  })

  const connectedPinCount = pins.filter((p) => p.netId !== null).length

  return {
    instanceId: instance.id,
    typeId: instance.type,
    name: def.name,
    groupLabel: COMPONENT_GROUP_LABELS[def.group],
    groupBadge: groupBadgeLabel(def.group),
    physicalMm: physical,
    sceneSize,
    positionScene: {
      x: instance.transform.position.x,
      y: instance.transform.position.y,
    },
    positionCanvasPx: { x: px, y: py },
    rotationZ,
    parentId: instance.parent ?? null,
    pins,
    connectedPinCount,
  }
}

/**
 * Format scene position for display (centimeters on the bench).
 * @param value Scene coordinate.
 */
export function formatSceneCoordinate(value: number): string {
  const cm = value * 100
  return cm.toFixed(1)
}

/**
 * Format canvas pixel position for display.
 * @param value Pixel coordinate.
 */
export function formatCanvasCoordinate(value: number): string {
  return value.toFixed(1)
}
