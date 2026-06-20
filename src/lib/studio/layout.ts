import type { ComponentTypeId } from '@/lib/project/types'
import { componentSceneDimensions, COMPONENT_SCENE_SIZE } from '@/lib/project/terminal-layout'

export {
  COMPONENT_SCENE_SIZE,
  componentSceneDimensions,
  terminalRelativePositions,
  terminalScenePosition,
} from '@/lib/project/terminal-layout'

/**
 * Scene position → React Flow top-left pixel position.
 * @param x Scene x.
 * @param y Scene y.
 * @param scale Pixels per scene unit.
 */
export function sceneToFlowPosition(
  x: number,
  y: number,
  scale: number,
): { x: number; y: number } {
  return { x: x * scale, y: y * scale }
}

/**
 * React Flow position → scene coordinates (top-left anchor).
 * @param x Flow x in pixels.
 * @param y Flow y in pixels.
 * @param scale Pixels per scene unit.
 */
export function flowToScenePosition(
  x: number,
  y: number,
  scale: number,
): { x: number; y: number } {
  return { x: x / scale, y: y / scale }
}

/**
 * Pixel size for a component node on the canvas.
 * @param type Catalog type id.
 * @param scale Pixels per scene unit.
 */
export function componentPixelSize(
  type: ComponentTypeId,
  scale: number,
  rotationZ = 0,
): { width: number; height: number } {
  const size = componentSceneDimensions(type, rotationZ)
  return { width: size.w * scale, height: size.h * scale }
}

/**
 * Unrotated pixel size (catalog footprint) for centering artwork inside the node box.
 * @param type Catalog type id.
 * @param scale Pixels per scene unit.
 */
export function componentBasePixelSize(
  type: ComponentTypeId,
  scale: number,
): { width: number; height: number } {
  const size = COMPONENT_SCENE_SIZE[type] ?? componentSceneDimensions(type)
  return { width: size.w * scale, height: size.h * scale }
}
