import type { Transform, Vec3 } from './types'

/** Default origin for scene placement (0, 0, 0). */
export const ORIGIN: Vec3 = { x: 0, y: 0, z: 0 }

/**
 * Build a 3D position for 2D Studio usage.
 * @param x Scene x.
 * @param y Scene y.
 * @param z Usually 0 until 3D view is used.
 */
export function position2d(x: number, y: number, z = 0): Vec3 {
  return { x, y, z }
}

/**
 * Project a 3D position onto the 2D plane (drop z for canvas math).
 * @param position Full xyz position from the project file.
 */
export function xy(position: Vec3): { x: number; y: number } {
  return { x: position.x, y: position.y }
}

/**
 * Create a {@link Vec3} with explicit coordinates.
 */
export function vec3(x: number, y: number, z: number): Vec3 {
  return { x, y, z }
}

/**
 * Build a component transform for 2D placement (z = 0, rotation only on z).
 * @param x Scene x.
 * @param y Scene y.
 * @param rotationZ Rotation in degrees around z (default 0).
 */
export function transform2d(x: number, y: number, rotationZ = 0): Transform {
  return {
    position: position2d(x, y),
    rotation: { x: 0, y: 0, z: rotationZ },
    scale: 1,
  }
}

/**
 * Normalize wire polyline points so z is always a number (defaults missing z to 0).
 * @param points Wire path from project JSON.
 */
export function flattenWirePoints(points: Vec3[]): Vec3[] {
  return points.map((p) => ({ x: p.x, y: p.y, z: p.z ?? 0 }))
}
