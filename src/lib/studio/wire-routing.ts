import type { Node } from '@xyflow/react'
import type { BerryProject, Wire, Vec3 } from '@/lib/project/types'
import type { WireEndpointRef } from '@/lib/project/mutations'
import {
  isBreadboardHoleRef,
  resolveWireTerminalRefs,
  wireHasBreadboardEndpoint,
} from '@/lib/project/mutations'
import { orthogonalWireRoute } from '@/lib/project/wire-route'
import { position2d, xy } from '@/lib/project/vec3'
import type { ComponentNodeData, WireOverlayItem } from '@/lib/studio/flow-map'
import { wireStrokeHex } from '@/lib/studio/wire-colors'
import { flowToScenePosition } from '@/lib/studio/layout'
import type { PinLayoutRegistry } from '@/lib/studio/pin-layout-registry'
import { holeBenchPosition } from '@/lib/studio/breadboard-snap'
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
  from: WireEndpointRef,
  to: WireEndpointRef,
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
  from: WireEndpointRef,
  to: WireEndpointRef,
  registry: PinLayoutRegistry,
  scale: number,
  positionOverrides?: Map<string, { x: number; y: number }>,
): { x: number; y: number }[] | null {
  const a = endpointCanvasPosition(project, from, registry, scale, positionOverrides)
  const b = endpointCanvasPosition(project, to, registry, scale, positionOverrides)
  if (!a || !b) return null
  return orthogonalWireRoute(a, b)
}

/**
 * Keep stored interior bends while pinning endpoints to visual pin/hole positions.
 * @param project Berry project.
 * @param from Start endpoint.
 * @param to End endpoint.
 * @param points Stored wire polyline in scene space.
 * @param registry Runtime Wokwi pin layouts.
 * @param scale Pixels per scene unit.
 * @param positionOverrides Optional component top-left overrides (scene units).
 */
function anchorVisualWireCanvasPoints(
  project: BerryProject,
  from: WireEndpointRef,
  to: WireEndpointRef,
  points: Vec3[],
  registry: PinLayoutRegistry,
  scale: number,
  positionOverrides?: Map<string, { x: number; y: number }>,
): { x: number; y: number }[] | null {
  const start = endpointCanvasPosition(project, from, registry, scale, positionOverrides)
  const end = endpointCanvasPosition(project, to, registry, scale, positionOverrides)
  if (!start || !end) return null
  if (points.length < 2) return orthogonalWireRoute(start, end)

  return points.map((point, index) => {
    if (index === 0) return start
    if (index === points.length - 1) return end
    return { x: point.x * scale, y: point.y * scale }
  })
}

/**
 * Scene-space wrapper for {@link anchorVisualWireCanvasPoints}.
 * @param project Berry project.
 * @param from Start endpoint.
 * @param to End endpoint.
 * @param points Stored wire polyline in scene space.
 * @param registry Runtime Wokwi pin layouts.
 * @param scale Pixels per scene unit.
 */
function anchorVisualWirePoints(
  project: BerryProject,
  from: WireEndpointRef,
  to: WireEndpointRef,
  points: Vec3[],
  registry: PinLayoutRegistry,
  scale: number,
): Vec3[] {
  const canvasPoints = anchorVisualWireCanvasPoints(
    project,
    from,
    to,
    points,
    registry,
    scale,
  )
  if (!canvasPoints) {
    throw new Error('Terminal not found for visual wire points')
  }
  return canvasPoints.map((p) => position2d(p.x / scale, p.y / scale))
}

/**
 * Canvas pixel position of a wire endpoint (component terminal or breadboard hole).
 * @param project Berry project.
 * @param ref Wire endpoint reference.
 * @param registry Runtime pin layout overrides.
 * @param scale Pixels per scene unit.
 * @param positionOverrides Optional component top-left overrides (scene units).
 */
function endpointCanvasPosition(
  project: BerryProject,
  ref: WireEndpointRef,
  registry: PinLayoutRegistry,
  scale: number,
  positionOverrides?: Map<string, { x: number; y: number }>,
): { x: number; y: number } | null {
  if (isBreadboardHoleRef(ref)) {
    const breadboard = project.components.find((c) => c.id === ref.breadboardId)
    if (!breadboard || breadboard.type !== 'breadboard-full') return null
    const override = positionOverrides?.get(ref.breadboardId)
    const board = override
      ? {
          ...breadboard,
          transform: {
            ...breadboard.transform,
            position: { x: override.x, y: override.y, z: 0 },
          },
        }
      : breadboard
    const bench = holeBenchPosition(board, ref.site)
    return { x: bench.x * scale, y: bench.y * scale }
  }
  return terminalCanvasPosition(
    project,
    ref.componentId,
    ref.terminalId,
    scale,
    registry,
    positionOverrides?.get(ref.componentId),
  )
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
    if (
      endpointOwnerId(from) !== componentId &&
      endpointOwnerId(to) !== componentId
    ) {
      return wire
    }

    const nextPoints =
      wire.route === 'manual' || wireHasBreadboardEndpoint(wire)
        ? anchorVisualWirePoints(project, from, to, wire.points, registry, scale)
        : buildVisualWirePoints(project, from, to, registry, scale)
    if (wirePointsEqual(wire.points, nextPoints)) return wire

    changed = true
    return { ...wire, points: nextPoints }
  })

  return changed ? { ...project, wires } : project
}

/**
 * Component id a wire endpoint follows when it moves (the part, or the breadboard).
 * @param ref Wire endpoint reference.
 */
function endpointOwnerId(ref: WireEndpointRef): string {
  return isBreadboardHoleRef(ref) ? ref.breadboardId : ref.componentId
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

  const points = wireOverlayCanvasPoints(
    wire,
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

/**
 * Canvas-space polyline for a wire overlay (stored bends or auto-routed).
 * @param wire Project wire record.
 * @param project Berry project.
 * @param from Resolved start endpoint.
 * @param to Resolved end endpoint.
 * @param registry Runtime pin layouts.
 * @param scale Pixels per scene unit.
 * @param positionOverrides Optional live component positions.
 */
export function wireOverlayCanvasPoints(
  wire: Wire,
  project: BerryProject,
  from: WireEndpointRef,
  to: WireEndpointRef,
  registry: PinLayoutRegistry,
  scale: number,
  positionOverrides?: Map<string, { x: number; y: number }>,
): { x: number; y: number }[] | null {
  if (wireHasBreadboardEndpoint(wire) || wire.route === 'manual') {
    return anchorVisualWireCanvasPoints(
      project,
      from,
      to,
      wire.points,
      registry,
      scale,
      positionOverrides,
    )
  }
  return buildVisualWireCanvasPoints(
    project,
    from,
    to,
    registry,
    scale,
    positionOverrides,
  )
}
