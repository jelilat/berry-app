/**
 * TODO(fix snapping): Breadboard hole snap is still flaky in Studio.
 * - Align snap grid with BreadboardArt / Wokwi skins (bbox vs real pin positions).
 * - Per-part snap anchors (ESP32 row of headers, not single pin).
 * - Snap during drag preview, click-to-pick hole, power rails.
 * - Stable behavior when `parent` is auto-assigned vs manual JSON placement.
 */

import { getComponentDefinition } from '@/lib/project/catalog'
import {
  COMPONENT_SCENE_SIZE,
  componentSceneDimensions,
  terminalRelativePositions,
} from '@/lib/project/terminal-layout'
import type { BerryProject, ComponentInstance, ComponentTypeId } from '@/lib/project/types'
import type { BreadboardHoleSite } from '@/lib/project/breadboard'
import { placementForInstanceAtHole } from '@/lib/project/breadboard-placement'
import { holeScenePosition, snapPositionToBreadboardHole } from './breadboard-layout'

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
): { x: number; y: number } {
  const base = COMPONENT_SCENE_SIZE[type]
  const outer = componentSceneDimensions(type, rotationZ)
  const def = getComponentDefinition(type)
  const rel = terminalRelativePositions(def.terminals, type)[terminalId]
  if (!rel) return { x: outer.w / 2, y: outer.h / 2 }

  const innerLeft = (outer.w - base.w) / 2
  const innerTop = (outer.h - base.h) / 2
  const lx = innerLeft + rel.x * base.w
  const ly = innerTop + rel.y * base.h
  const cx = outer.w / 2
  const cy = outer.h / 2
  const dx = lx - cx
  const dy = ly - cy
  const rad = (-rotationZ * Math.PI) / 180
  return {
    x: cx + dx * Math.cos(rad) - dy * Math.sin(rad),
    y: cy + dx * Math.sin(rad) + dy * Math.cos(rad),
  }
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
): ComponentInstance {
  const rotationZ = instance.transform.rotation?.z ?? 0
  const anchorId = snapAnchorTerminalId(instance.type)
  const bbX = breadboard.transform.position.x
  const bbY = breadboard.transform.position.y

  let anchorWorldX = topLeftX + componentSceneDimensions(instance.type, rotationZ).w / 2
  let anchorWorldY = topLeftY + componentSceneDimensions(instance.type, rotationZ).h / 2

  if (anchorId) {
    const off = terminalOffsetInOuterBox(instance.type, anchorId, rotationZ)
    anchorWorldX = topLeftX + off.x
    anchorWorldY = topLeftY + off.y
  }

  const snapped = snapPositionToBreadboardHole(bbX, bbY, anchorWorldX, anchorWorldY)
  const outer = componentSceneDimensions(instance.type, rotationZ)
  const off = anchorId
    ? terminalOffsetInOuterBox(instance.type, anchorId, rotationZ)
    : { x: outer.w / 2, y: outer.h / 2 }

  const newTopLeftX = snapped.x - off.x
  const newTopLeftY = snapped.y - off.y
  const placement = placementForInstanceAtHole(instance, snapped.hole)

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
): ComponentInstance {
  const breadboard =
    (instance.parent
      ? project.components.find((c) => c.id === instance.parent)
      : undefined) ?? findBreadboardAtPoint(project, topLeftX, topLeftY)

  if (!breadboard || breadboard.type !== 'breadboard-full') {
    return instance
  }

  return snapPartToBreadboardHole(breadboard, instance, topLeftX, topLeftY)
}

/**
 * Scene position of a placement hole for rendering overlays.
 * @param breadboard Breadboard instance.
 * @param hole Hole site.
 */
export function holeBenchPosition(
  breadboard: ComponentInstance,
  hole: BreadboardHoleSite,
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
