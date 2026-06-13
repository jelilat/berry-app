import { getComponentDefinition } from './catalog'
import {
  offsetHoleColumn,
  type BreadboardHoleSite,
  type BreadboardPlacement,
  type BreadboardSite,
} from './breadboard'
import type { ComponentInstance, ComponentTypeId } from './types'

/**
 * Infer breadboard hole sites for part terminals from anchor hole + rotation.
 * @param type Catalog part type.
 * @param anchor Primary hole under the part center.
 * @param rotationZ Rotation in degrees.
 */
export function inferPlacementFromAnchor(
  type: ComponentTypeId,
  anchor: BreadboardHoleSite,
  rotationZ = 0,
): BreadboardPlacement | null {
  const def = getComponentDefinition(type)
  const terminals = def.terminals
  if (terminals.length === 0) return null

  const rot = ((rotationZ % 360) + 360) % 360
  const sites: Record<string, BreadboardSite> = {}

  if (terminals.length === 2) {
    const [t0, t1] = terminals
    sites[t0.id] = anchor
    sites[t1.id] = offsetHoleColumn(anchor, rot === 180 || rot === 270 ? -2 : 2)
    return { sites }
  }

  sites[terminals[0].id] = anchor
  return { sites }
}

/**
 * Merge inferred placement with any existing terminal sites.
 * @param existing Prior placement, if any.
 * @param inferred Newly inferred sites.
 */
export function mergePlacement(
  existing: BreadboardPlacement | undefined,
  inferred: BreadboardPlacement,
): BreadboardPlacement {
  return {
    sites: { ...inferred.sites, ...(existing?.sites ?? {}) },
  }
}

/**
 * Update instance placement after snap/move on a breadboard.
 * @param instance Component on a breadboard.
 * @param anchorHole Nearest hole under the part.
 */
export function placementForInstanceAtHole(
  instance: ComponentInstance,
  anchorHole: BreadboardHoleSite,
): BreadboardPlacement | undefined {
  const rotationZ = instance.transform.rotation?.z ?? 0
  const inferred = inferPlacementFromAnchor(instance.type, anchorHole, rotationZ)
  if (!inferred) return instance.placement
  return mergePlacement(instance.placement, inferred)
}
