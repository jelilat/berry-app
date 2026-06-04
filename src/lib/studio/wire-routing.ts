import type { Node } from '@xyflow/react'
import type { BerryProject, Wire, Vec3 } from '@/lib/project/types'
import type { TerminalRef } from '@/lib/project/mutations'
import { resolveWireTerminalRefs } from '@/lib/project/mutations'
import { orthogonalWireRoute } from '@/lib/project/wire-route'
import { position2d, xy } from '@/lib/project/vec3'
import type { ComponentNodeData, WireOverlayItem } from '@/lib/studio/flow-map'
import { wireStrokeHex } from '@/lib/studio/wire-colors'
import { flowToScenePosition } from '@/lib/studio/layout'
import type { PinLayoutRegistry } from '@/lib/studio/pin-layout-registry'
import { terminalCanvasPosition } from '@/lib/studio/studio-terminal-layout'

/**
 * Scene positions that differ from the project (e.g. a part mid-drag on the canvas).
 * @param project Berry project with persisted transforms.
 * @param nodes Live React Flow nodes.
 * @param scale Pixels per scene unit.
 */
export function scenePositionOverridesFromNodes(
  project: BerryProject,
  nodes: Node<ComponentNodeData>[],
  scale: number,
): Map<string, { x: number; y: number }> {
  const overrides = new Map<string, { x: number; y: number }>()
  for (const node of nodes) {
    const inst = project.components.find((c) => c.id === node.id)
    if (!inst) continue
    const stored = xy(inst.transform.position)
    const live = flowToScenePosition(node.position.x, node.position.y, scale)
    const eps = 1e-6
    if (
      Math.abs(stored.x - live.x) > eps ||
      Math.abs(stored.y - live.y) > eps
    ) {
      overrides.set(node.id, live)
    }
  }
  return overrides
}

/**
 * Build a wire polyline in scene space using Wokwi-accurate pin layouts.
 * @param project Berry project.
 * @param from Start terminal.
 * @param to End terminal.
 * @param registry Runtime pin layout overrides.
 * @param positionOverrides Optional component top-left overrides (scene units).
 */
export function buildVisualWirePoints(
  project: BerryProject,
  from: TerminalRef,
  to: TerminalRef,
  registry: PinLayoutRegistry,
  scale: number,
  positionOverrides?: Map<string, { x: number; y: number }>,
): Vec3[] {
  const points = buildVisualWireCanvasPoints(
    project,
    from,
    to,
    registry,
    scale,
    positionOverrides,
  )
  if (!points) {
    throw new Error('Terminal not found for visual wire points')
  }
  return points.map((p) => position2d(p.x / scale, p.y / scale))
}

/**
 * Build a wire polyline in canvas pixels (same space as pin handles and wire drag).
 * @param project Berry project.
 * @param from Start terminal.
 * @param to End terminal.
 * @param registry Runtime pin layout overrides.
 * @param scale Pixels per scene unit.
 * @param positionOverrides Optional component top-left overrides (scene units).
 */
export function buildVisualWireCanvasPoints(
  project: BerryProject,
  from: TerminalRef,
  to: TerminalRef,
  registry: PinLayoutRegistry,
  scale: number,
  positionOverrides?: Map<string, { x: number; y: number }>,
): { x: number; y: number }[] | null {
  const a = terminalCanvasPosition(
    project,
    from.componentId,
    from.terminalId,
    scale,
    registry,
    positionOverrides?.get(from.componentId),
  )
  const b = terminalCanvasPosition(
    project,
    to.componentId,
    to.terminalId,
    scale,
    registry,
    positionOverrides?.get(to.componentId),
  )
  if (!a || !b) return null
  return orthogonalWireRoute(a, b)
}

/**
 * Reroute wires attached to a component using visual pin layouts.
 * @param project Project after the component transform changed.
 * @param componentId Moved component id.
 * @param registry Runtime Wokwi pin layouts.
 */
export function rerouteWiresVisual(
  project: BerryProject,
  componentId: string,
  registry: PinLayoutRegistry,
  scale: number,
): BerryProject {
  let changed = false
  const wires = project.wires.map((wire) => {
    const endpoints = resolveWireTerminalRefs(project, wire)
    if (!endpoints) return wire
    const [from, to] = endpoints
    if (from.componentId !== componentId && to.componentId !== componentId) {
      return wire
    }

    const nextPoints = buildVisualWirePoints(project, from, to, registry, scale)
    if (wirePointsEqual(wire.points, nextPoints)) return wire

    changed = true
    return { ...wire, points: nextPoints }
  })

  return changed ? { ...project, wires } : project
}

/**
 * Compare two wire polylines for equality within a small epsilon.
 * @param a First polyline.
 * @param b Second polyline.
 */
function wirePointsEqual(
  a: { x: number; y: number; z: number }[],
  b: { x: number; y: number; z: number }[],
): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (
      Math.abs(a[i].x - b[i].x) > 1e-5 ||
      Math.abs(a[i].y - b[i].y) > 1e-5 ||
      Math.abs(a[i].z - b[i].z) > 1e-5
    ) {
      return false
    }
  }
  return true
}

/**
 * Map project wires to overlay polylines, honoring live drag positions when given.
 * @param project Berry project.
 * @param registry Runtime Wokwi pin layouts.
 * @param scale Pixels per scene unit.
 * @param positionOverrides Optional component top-left overrides (scene units).
 */
export function projectToLiveWireOverlay(
  project: BerryProject,
  registry: PinLayoutRegistry,
  scale: number,
  positionOverrides?: Map<string, { x: number; y: number }>,
): WireOverlayItem[] {
  return project.wires.flatMap((wire) => {
    const item = wireToOverlayItem(wire, project, registry, scale, positionOverrides)
    return item ? [item] : []
  })
}

/**
 * Build one SVG overlay segment for a wire using visual terminal positions.
 * @param wire Project wire record.
 * @param project Berry project.
 * @param registry Runtime pin layouts.
 * @param scale Pixels per scene unit.
 * @param positionOverrides Optional live component positions.
 */
function wireToOverlayItem(
  wire: Wire,
  project: BerryProject,
  registry: PinLayoutRegistry,
  scale: number,
  positionOverrides?: Map<string, { x: number; y: number }>,
): WireOverlayItem | null {
  const endpoints = resolveWireTerminalRefs(project, wire)
  if (!endpoints) return null
  const [from, to] = endpoints

  const points = buildVisualWireCanvasPoints(
    project,
    from,
    to,
    registry,
    scale,
    positionOverrides,
  )
  if (!points) return null

  return {
    id: wire.id,
    color: wireStrokeHex(wire.color ?? 'yellow'),
    connectors: wire.connectors,
    points,
  }
}
