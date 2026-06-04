import type { Point2D } from '@/lib/project/wire-route'
import type { WireOverlayItem } from '@/lib/studio/flow-map'

/** Default hit radius (px) for wire selection on the canvas. */
export const WIRE_HIT_THRESHOLD_PX = 12

/**
 * Shortest distance from a point to a line segment in 2D.
 * @param px Point x.
 * @param py Point y.
 * @param ax Segment start x.
 * @param ay Segment start y.
 * @param bx Segment end x.
 * @param by Segment end y.
 */
export function distancePointToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax
  const dy = by - ay
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return Math.hypot(px - ax, py - ay)
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  const qx = ax + t * dx
  const qy = ay + t * dy
  return Math.hypot(px - qx, py - qy)
}

/**
 * True when a canvas point is within `threshold` px of a wire polyline.
 * @param point Cursor position in flow/canvas pixels.
 * @param points Wire polyline in the same space.
 * @param threshold Hit radius in pixels.
 */
export function hitTestWirePolyline(
  point: Point2D,
  points: Point2D[],
  threshold: number,
): boolean {
  if (points.length < 2) return false
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    if (
      distancePointToSegment(point.x, point.y, a.x, a.y, b.x, b.y) <= threshold
    ) {
      return true
    }
  }
  return false
}

/**
 * Return the id of the topmost wire under a canvas point, if any.
 * @param wires Wire overlay items in flow pixel space.
 * @param point Cursor position in flow pixels.
 * @param threshold Hit radius in pixels.
 */
export function findWireAtPoint(
  wires: WireOverlayItem[],
  point: Point2D,
  threshold = WIRE_HIT_THRESHOLD_PX,
): string | null {
  for (let i = wires.length - 1; i >= 0; i--) {
    const wire = wires[i]
    if (hitTestWirePolyline(point, wire.points, threshold)) return wire.id
  }
  return null
}
