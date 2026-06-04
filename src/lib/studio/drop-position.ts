import type { ComponentTypeId } from '@/lib/project/types'
import { componentSceneDimensions } from '@/lib/project/terminal-layout'

/**
 * Convert a component drop point into a top-left scene position.
 * @param type Catalog component type being dropped.
 * @param flowPoint React Flow canvas point in pixels.
 * @param scale Pixels per scene unit.
 */
export function componentDropScenePosition(
  type: ComponentTypeId,
  flowPoint: { x: number; y: number },
  scale: number,
): { x: number; y: number } {
  const size = componentSceneDimensions(type, 0)
  return {
    x: flowPoint.x / scale - size.w / 2,
    y: flowPoint.y / scale - size.h / 2,
  }
}
