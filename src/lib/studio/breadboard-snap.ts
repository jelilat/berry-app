import { getComponentDefinition } from '@/lib/project/catalog'
import {
  componentSceneDimensions,
  terminalScenePositionFromRel,
} from '@/lib/project/terminal-layout'
import type { BerryProject, ComponentInstance, ComponentTypeId } from '@/lib/project/types'
import {
  BREADBOARD_COLUMNS,
  BREADBOARD_ROWS_BOTTOM,
  BREADBOARD_ROWS_TOP,
  breadboardHole,
  type BreadboardBlock,
  type BreadboardHoleSite,
  type BreadboardPlacement,
  type BreadboardRowId,
  type BreadboardSite,
} from '@/lib/project/breadboard'
import {
  breadboardPhysicalSiteKey,
  describeFootprintHoleConflict,
  describePlacementHoleConflict,
} from '@/lib/project/breadboard-nets'
import type { InstancePinLayout } from './pin-layout-registry'
import { catalogTerminalLayout } from './studio-terminal-layout'
import {
  holeSceneLocal,
  holeScenePosition,
  snapPositionToBreadboardHole,
} from './breadboard-layout'

const SNAP_EXIT_MARGIN_SCENE = 0.03
const BREADBOARD_HOLE_HOVER_RADIUS_SCENE = 0.0055

/** Resolved breadboard hole target for one part terminal. */
export interface BreadboardSnapCandidate {
  breadboard: ComponentInstance
  terminalId: string
  hole: BreadboardHoleSite
  distance: number
  topLeftX: number
  topLeftY: number
  placement: BreadboardPlacement | undefined
}

/** Snap evaluation including occupancy conflict for studio feedback. */
export interface BreadboardSnapEvaluation {
  /** Valid snap (holes free). */
  candidate: BreadboardSnapCandidate | null
  /** Geometric snap blocked because a hole is already used. */
  rejected: BreadboardSnapCandidate | null
  conflict: string | null
}

/**
 * Terminal id used as the snap anchor (leg that lands on the hole).
 * @param type Catalog part type.
 */
export function snapAnchorTerminalId(type: ComponentTypeId): string | null {
  const def = getComponentDefinition(type)
  if (def.terminals.length === 0) return null
  const pin1 = def.terminals.find((t) => t.id === 'pin1')
  if (pin1) return 'pin1'
  const leftHeader = def.terminals.find((t) =>
    ['VIN', 'GND_L', 'IO4', '5V', 'GND'].includes(t.id),
  )
  if (leftHeader) return leftHeader.id
  return def.terminals[0].id
}

/**
 * Position of a terminal inside the part's outer bounding box (scene units, from top-left).
 * Matches how {@link ComponentNode} centers and rotates the inner artwork.
 * @param type Catalog type.
 * @param terminalId Terminal id on the part.
 * @param rotationZ Rotation in degrees.
 */
export function terminalOffsetInOuterBox(
  type: ComponentTypeId,
  terminalId: string,
  rotationZ: number,
  layoutOverride?: InstancePinLayout,
): { x: number; y: number } {
  const rel = layoutOverride?.[terminalId] ?? catalogTerminalLayout({
    id: '__snap_probe__',
    type,
    transform: {
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: rotationZ },
    },
  })[terminalId]
  if (!rel) {
    const outer = componentSceneDimensions(type, rotationZ)
    return { x: outer.w / 2, y: outer.h / 2 }
  }
  return terminalScenePositionFromRel(0, 0, type, rel, rotationZ)
}

/**
 * Find the breadboard whose bounds contain a bench point.
 * @param project Berry project.
 * @param sceneX Bench x.
 * @param sceneY Bench y.
 */
export function findBreadboardAtPoint(
  project: BerryProject,
  sceneX: number,
  sceneY: number,
): ComponentInstance | undefined {
  return project.components.find((c) => {
    if (c.type !== 'breadboard-full') return false
    const { w, h } = componentSceneDimensions('breadboard-full', 0)
    const x = c.transform.position.x
    const y = c.transform.position.y
    return sceneX >= x && sceneX <= x + w && sceneY >= y && sceneY <= y + h
  })
}

/**
 * True when a point is still close enough to the breadboard to remain a child.
 * @param breadboard Breadboard instance.
 * @param sceneX Bench x.
 * @param sceneY Bench y.
 */
function isNearBreadboard(
  breadboard: ComponentInstance,
  sceneX: number,
  sceneY: number,
): boolean {
  const { w, h } = componentSceneDimensions('breadboard-full', 0)
  const x = breadboard.transform.position.x
  const y = breadboard.transform.position.y
  return (
    sceneX >= x - SNAP_EXIT_MARGIN_SCENE &&
    sceneX <= x + w + SNAP_EXIT_MARGIN_SCENE &&
    sceneY >= y - SNAP_EXIT_MARGIN_SCENE &&
    sceneY <= y + h + SNAP_EXIT_MARGIN_SCENE
  )
}

/**
 * Nearest main-grid hole for a terminal at a bench position.
 * @param breadboard Parent breadboard instance.
 * @param terminalX Terminal x in bench scene coordinates.
 * @param terminalY Terminal y in bench scene coordinates.
 */
function terminalSiteOnBreadboard(
  breadboard: ComponentInstance,
  terminalX: number,
  terminalY: number,
): BreadboardHoleSite {
  return snapPositionToBreadboardHole(
    breadboard.transform.position.x,
    breadboard.transform.position.y,
    terminalX,
    terminalY,
  ).hole
}

/**
 * Nearest breadboard hole to a bench point that is not already assigned in this placement.
 * @param breadboard Parent breadboard instance.
 * @param terminalX Terminal x in bench scene coordinates.
 * @param terminalY Terminal y in bench scene coordinates.
 * @param usedPhysicalKeys Hole keys already taken by other terminals on the same part.
 */
function nearestUnusedHoleOnBreadboard(
  breadboard: ComponentInstance,
  terminalX: number,
  terminalY: number,
  usedPhysicalKeys: Set<string>,
): BreadboardHoleSite {
  const bbX = breadboard.transform.position.x
  const bbY = breadboard.transform.position.y
  let best: BreadboardHoleSite | null = null
  let bestDist = Infinity

  const scan = (rows: readonly BreadboardRowId[], block: BreadboardBlock) => {
    for (const row of rows) {
      for (let column = 1; column <= BREADBOARD_COLUMNS; column++) {
        const hole = breadboardHole(row, column, block)
        const key = breadboardPhysicalSiteKey(hole)
        if (usedPhysicalKeys.has(key)) continue
        const local = holeSceneLocal(row, column)
        const d = (bbX + local.x - terminalX) ** 2 + (bbY + local.y - terminalY) ** 2
        if (d < bestDist) {
          bestDist = d
          best = hole
        }
      }
    }
  }

  scan(BREADBOARD_ROWS_TOP, 'top')
  scan(BREADBOARD_ROWS_BOTTOM, 'bottom')

  return best ?? terminalSiteOnBreadboard(breadboard, terminalX, terminalY)
}

/**
 * Build exact hole placement for every terminal after a snap has chosen top-left.
 * @param breadboard Parent breadboard instance.
 * @param instance Snapped part.
 * @param topLeftX Snapped top-left x.
 * @param topLeftY Snapped top-left y.
 */
function placementFromSnappedTerminals(
  breadboard: ComponentInstance,
  instance: ComponentInstance,
  topLeftX: number,
  topLeftY: number,
  layoutOverride?: InstancePinLayout,
): BreadboardPlacement | undefined {
  const def = getComponentDefinition(instance.type)
  if (def.terminals.length === 0) return instance.placement

  const rotationZ = instance.transform.rotation?.z ?? 0
  const layout = layoutOverride ?? catalogTerminalLayout(instance)
  const sites: Record<string, BreadboardSite> = {}
  const usedPhysicalKeys = new Set<string>()

  for (const terminal of def.terminals) {
    const rel = layout[terminal.id]
    if (!rel) continue
    const pos = terminalScenePositionFromRel(
      topLeftX,
      topLeftY,
      instance.type,
      rel,
      rotationZ,
    )
    const site = nearestUnusedHoleOnBreadboard(
      breadboard,
      pos.x,
      pos.y,
      usedPhysicalKeys,
    )
    usedPhysicalKeys.add(breadboardPhysicalSiteKey(site))
    sites[terminal.id] = site
  }

  return { sites }
}

/**
 * Snap a part on the bench to a breadboard hole using its anchor pin (not bbox center).
 * @param breadboard Breadboard instance.
 * @param instance Part to snap (parent may be unset; will use breadboard id).
 * @param topLeftX Proposed part top-left x on bench.
 * @param topLeftY Proposed part top-left y on bench.
 */
export function snapPartToBreadboardHole(
  breadboard: ComponentInstance,
  instance: ComponentInstance,
  topLeftX: number,
  topLeftY: number,
  layoutOverride?: InstancePinLayout,
): ComponentInstance {
  const rotationZ = instance.transform.rotation?.z ?? 0
  const anchorId = snapAnchorTerminalId(instance.type)
  const bbX = breadboard.transform.position.x
  const bbY = breadboard.transform.position.y

  let anchorWorldX = topLeftX + componentSceneDimensions(instance.type, rotationZ).w / 2
  let anchorWorldY = topLeftY + componentSceneDimensions(instance.type, rotationZ).h / 2

  if (anchorId) {
    const off = terminalOffsetInOuterBox(
      instance.type,
      anchorId,
      rotationZ,
      layoutOverride,
    )
    anchorWorldX = topLeftX + off.x
    anchorWorldY = topLeftY + off.y
  }

  const snapped = snapPositionToBreadboardHole(bbX, bbY, anchorWorldX, anchorWorldY)
  const outer = componentSceneDimensions(instance.type, rotationZ)
  const off = anchorId
    ? terminalOffsetInOuterBox(instance.type, anchorId, rotationZ, layoutOverride)
    : { x: outer.w / 2, y: outer.h / 2 }

  const newTopLeftX = snapped.x - off.x
  const newTopLeftY = snapped.y - off.y
  const placement = placementFromSnappedTerminals(
    breadboard,
    instance,
    newTopLeftX,
    newTopLeftY,
    layoutOverride,
  )

  return {
    ...instance,
    parent: breadboard.id,
    transform: {
      ...instance.transform,
      position: { x: newTopLeftX, y: newTopLeftY, z: 0 },
      rotation: instance.transform.rotation,
    },
    placement,
  }
}

/**
 * Whether a snapped placement would collide with another part's holes.
 * @param project Berry project.
 * @param candidate Snap target including full placement.
 * @param instanceId Part being placed (excluded from occupancy).
 */
export function breadboardSnapHasHoleConflict(
  project: BerryProject,
  candidate: BreadboardSnapCandidate,
  instanceId: string,
): string | null {
  const instance = project.components.find((c) => c.id === instanceId)
  if (instance) {
    const footprintConflict = describeFootprintHoleConflict(
      project,
      candidate.breadboard.id,
      {
        ...instance,
        parent: candidate.breadboard.id,
        transform: {
          ...instance.transform,
          position: { x: candidate.topLeftX, y: candidate.topLeftY, z: 0 },
        },
        placement: candidate.placement,
      },
      instanceId,
    )
    if (footprintConflict) return footprintConflict
  }
  if (!candidate.placement?.sites) return null
  return describePlacementHoleConflict(
    project,
    candidate.breadboard.id,
    candidate.placement,
    instanceId,
  )
}

/**
 * Resolve the nearest visible hole candidate for any terminal currently overlapping a breadboard hole.
 * Ignores hole occupancy (use {@link evaluateBreadboardSnap} for validation).
 * @param project Berry project.
 * @param instance Part being dragged or moved.
 * @param topLeftX Proposed part top-left x.
 * @param topLeftY Proposed part top-left y.
 * @param options Optional visual pin layout and hit radius.
 */
export function resolveBreadboardSnapCandidateRaw(
  project: BerryProject,
  instance: ComponentInstance,
  topLeftX: number,
  topLeftY: number,
  options?: { layout?: InstancePinLayout; radius?: number },
): BreadboardSnapCandidate | null {
  if (instance.type === 'breadboard-full') return null

  const def = getComponentDefinition(instance.type)
  if (def.terminals.length === 0) return null

  const parentBreadboard = instance.parent
    ? project.components.find((c) => c.id === instance.parent)
    : undefined
  const rotationZ = instance.transform.rotation?.z ?? 0
  const layout = options?.layout ?? catalogTerminalLayout(instance)
  const radius = options?.radius ?? BREADBOARD_HOLE_HOVER_RADIUS_SCENE
  let best: BreadboardSnapCandidate | null = null

  for (const terminal of def.terminals) {
    const rel = layout[terminal.id]
    if (!rel) continue

    const terminalPosition = terminalScenePositionFromRel(
      topLeftX,
      topLeftY,
      instance.type,
      rel,
      rotationZ,
    )
    const pointBreadboard = findBreadboardAtPoint(
      project,
      terminalPosition.x,
      terminalPosition.y,
    )
    const breadboard =
      parentBreadboard &&
      parentBreadboard.type === 'breadboard-full' &&
      isNearBreadboard(parentBreadboard, terminalPosition.x, terminalPosition.y)
        ? parentBreadboard
        : pointBreadboard

    if (!breadboard || breadboard.type !== 'breadboard-full') continue

    const snapped = snapPositionToBreadboardHole(
      breadboard.transform.position.x,
      breadboard.transform.position.y,
      terminalPosition.x,
      terminalPosition.y,
    )
    const distance = Math.hypot(
      snapped.x - terminalPosition.x,
      snapped.y - terminalPosition.y,
    )
    if (distance > radius || (best && distance >= best.distance)) continue

    const off = terminalOffsetInOuterBox(
      instance.type,
      terminal.id,
      rotationZ,
      layout,
    )
    const snappedTopLeftX = snapped.x - off.x
    const snappedTopLeftY = snapped.y - off.y
    best = {
      breadboard,
      terminalId: terminal.id,
      hole: snapped.hole,
      distance,
      topLeftX: snappedTopLeftX,
      topLeftY: snappedTopLeftY,
      placement: placementFromSnappedTerminals(
        breadboard,
        instance,
        snappedTopLeftX,
        snappedTopLeftY,
        layout,
      ),
    }
  }

  return best
}

/**
 * Nearest snap target with occupancy validation for studio drag/drop.
 * @param project Berry project.
 * @param instance Part being dragged or moved.
 * @param topLeftX Proposed part top-left x.
 * @param topLeftY Proposed part top-left y.
 * @param options Optional visual pin layout and hit radius.
 */
export function evaluateBreadboardSnap(
  project: BerryProject,
  instance: ComponentInstance,
  topLeftX: number,
  topLeftY: number,
  options?: { layout?: InstancePinLayout; radius?: number },
): BreadboardSnapEvaluation {
  const raw = resolveBreadboardSnapCandidateRaw(
    project,
    instance,
    topLeftX,
    topLeftY,
    options,
  )
  if (!raw) {
    return { candidate: null, rejected: null, conflict: null }
  }
  const conflict = breadboardSnapHasHoleConflict(project, raw, instance.id)
  if (conflict) {
    return { candidate: null, rejected: raw, conflict }
  }
  return { candidate: raw, rejected: null, conflict: null }
}

/**
 * Resolve the nearest visible hole candidate when placement holes are free.
 * @param project Berry project.
 * @param instance Part being dragged or moved.
 * @param topLeftX Proposed part top-left x.
 * @param topLeftY Proposed part top-left y.
 * @param options Optional visual pin layout and hit radius.
 */
export function resolveBreadboardSnapCandidate(
  project: BerryProject,
  instance: ComponentInstance,
  topLeftX: number,
  topLeftY: number,
  options?: { layout?: InstancePinLayout; radius?: number },
): BreadboardSnapCandidate | null {
  return evaluateBreadboardSnap(project, instance, topLeftX, topLeftY, options).candidate
}

/**
 * Resolve breadboard + snapped instance when moving a part on the bench.
 * @param project Berry project.
 * @param instance Part being moved.
 * @param topLeftX Proposed top-left x (scene, not grid-snapped).
 * @param topLeftY Proposed top-left y.
 */
export function snapInstanceOnBreadboard(
  project: BerryProject,
  instance: ComponentInstance,
  topLeftX: number,
  topLeftY: number,
  options?: { layout?: InstancePinLayout },
): ComponentInstance {
  if (instance.type === 'breadboard-full') {
    return {
      ...instance,
      parent: undefined,
      placement: undefined,
      transform: {
        ...instance.transform,
        position: { x: topLeftX, y: topLeftY, z: 0 },
      },
    }
  }

  const candidate = resolveBreadboardSnapCandidate(project, instance, topLeftX, topLeftY, {
    layout: options?.layout,
  })

  if (!candidate) {
    return {
      ...instance,
      parent: undefined,
      placement: undefined,
      transform: {
        ...instance.transform,
        position: { x: topLeftX, y: topLeftY, z: 0 },
      },
    }
  }

  return {
    ...instance,
    parent: candidate.breadboard.id,
    transform: {
      ...instance.transform,
      position: { x: candidate.topLeftX, y: candidate.topLeftY, z: 0 },
      rotation: instance.transform.rotation,
    },
    placement: candidate.placement,
  }
}

/**
 * Scene position of a placement hole for rendering overlays.
 * @param breadboard Breadboard instance.
 * @param hole Hole site.
 */
export function holeBenchPosition(
  breadboard: ComponentInstance,
  hole: BreadboardSite,
): { x: number; y: number } {
  if (hole.kind !== 'hole') {
    return {
      x: breadboard.transform.position.x,
      y: breadboard.transform.position.y,
    }
  }
  return holeScenePosition(
    breadboard.transform.position.x,
    breadboard.transform.position.y,
    hole.row,
    hole.column,
  )
}
