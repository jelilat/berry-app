/** 2D point for wire routing (bench or pixel space). */
export interface Point2D {
  x: number
  y: number
}

/**
 * Build an orthogonal (horizontal + vertical) wire path between two points.
 * Uses an L-route: horizontal-first when |dx| >= |dy|, else vertical-first.
 * @param start Start point.
 * @param end End point.
 */
export function orthogonalWireRoute(start: Point2D, end: Point2D): Point2D[] {
  if (start.x === end.x || start.y === end.y) {
    return [start, end]
  }
  if (Math.abs(end.x - start.x) >= Math.abs(end.y - start.y)) {
    return [start, { x: end.x, y: start.y }, end]
  }
  return [start, { x: start.x, y: end.y }, end]
}
