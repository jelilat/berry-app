import type { ComponentInstance } from '@/lib/project/types'

/** Z-index tier for breadboards (always below placed parts). */
export const Z_BREADBOARD = 0

/** Z-index tier for parts not attached to a parent. */
export const Z_PART = 10

/** Z-index tier for parts snapped onto a breadboard or other parent. */
export const Z_PART_ON_PARENT = 20

/**
 * Stable canvas z-index for a component instance.
 * Breadboards stay at the bottom; child parts render above their parent bench.
 * @param instance Placed component from the project graph.
 */
export function componentNodeZIndex(instance: ComponentInstance): number {
  if (instance.type === 'breadboard-full') return Z_BREADBOARD
  if (instance.parent) return Z_PART_ON_PARENT
  return Z_PART
}
