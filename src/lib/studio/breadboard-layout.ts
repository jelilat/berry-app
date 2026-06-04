import {
  BREADBOARD_COLUMNS,
  BREADBOARD_ROWS_BOTTOM,
  BREADBOARD_ROWS_TOP,
  breadboardHole,
  type BreadboardBlock,
  type BreadboardHoleSite,
  type BreadboardRowId,
} from '@/lib/project/breadboard'
import { COMPONENT_SCENE_SIZE } from '@/lib/project/terminal-layout'

/** SVG art size for {@link BreadboardArt} (must match viewBox). */
export const BREADBOARD_ART_W = 420
export const BREADBOARD_ART_H = 140

const HOLE_ORIGIN_X = 16
const HOLE_SPACING_X = 13.2
const ROW_Y_TOP_START = 36
const ROW_Y_BOTTOM_START = 84
const ROW_SPACING_Y = 5.2

/**
 * Pixel center of a hole in breadboard art coordinates.
 * @param row Row letter.
 * @param column Column 1–30.
 */
export function holeArtCenterPx(row: BreadboardRowId, column: number): { x: number; y: number } {
  const col = column - 1
  const x = HOLE_ORIGIN_X + col * HOLE_SPACING_X
  const topIndex = BREADBOARD_ROWS_TOP.indexOf(row as (typeof BREADBOARD_ROWS_TOP)[number])
  if (topIndex >= 0) {
    return { x, y: ROW_Y_TOP_START + topIndex * ROW_SPACING_Y }
  }
  const bottomIndex = BREADBOARD_ROWS_BOTTOM.indexOf(
    row as (typeof BREADBOARD_ROWS_BOTTOM)[number],
  )
  return { x, y: ROW_Y_BOTTOM_START + bottomIndex * ROW_SPACING_Y }
}

/**
 * Hole center in scene units relative to breadboard top-left (0–w, 0–h).
 * @param row Row letter.
 * @param column Column 1–30.
 */
export function holeSceneLocal(
  row: BreadboardRowId,
  column: number,
): { x: number; y: number } {
  const { x, y } = holeArtCenterPx(row, column)
  const size = COMPONENT_SCENE_SIZE['breadboard-full']
  return {
    x: (x / BREADBOARD_ART_W) * size.w,
    y: (y / BREADBOARD_ART_H) * size.h,
  }
}

/**
 * Scene position (bench coords) for a hole on a placed breadboard instance.
 * @param breadboardX Breadboard transform x.
 * @param breadboardY Breadboard transform y.
 * @param row Row letter.
 * @param column Column 1–30.
 */
export function holeScenePosition(
  breadboardX: number,
  breadboardY: number,
  row: BreadboardRowId,
  column: number,
): { x: number; y: number } {
  const local = holeSceneLocal(row, column)
  return { x: breadboardX + local.x, y: breadboardY + local.y }
}

/**
 * Nearest main-grid hole to a local point on the breadboard (scene units from top-left).
 * @param localX X within breadboard bounding box.
 * @param localY Y within breadboard bounding box.
 */
export function nearestHoleFromSceneLocal(
  localX: number,
  localY: number,
): BreadboardHoleSite {
  const size = COMPONENT_SCENE_SIZE['breadboard-full']
  const px = (localX / size.w) * BREADBOARD_ART_W
  const py = (localY / size.h) * BREADBOARD_ART_H

  let bestRow: BreadboardRowId = 'e'
  let bestCol = 1
  let bestBlock: BreadboardBlock = 'top'
  let bestDist = Infinity

  const scan = (rows: readonly BreadboardRowId[], block: BreadboardBlock) => {
    for (const row of rows) {
      for (let col = 1; col <= BREADBOARD_COLUMNS; col++) {
        const { x, y } = holeArtCenterPx(row, col)
        const d = (x - px) ** 2 + (y - py) ** 2
        if (d < bestDist) {
          bestDist = d
          bestRow = row
          bestCol = col
          bestBlock = block
        }
      }
    }
  }

  scan(BREADBOARD_ROWS_TOP, 'top')
  scan(BREADBOARD_ROWS_BOTTOM, 'bottom')

  return breadboardHole(bestRow, bestCol, bestBlock)
}

/**
 * Snap a bench position to the nearest hole center on a breadboard.
 * @param breadboardX Breadboard instance x.
 * @param breadboardY Breadboard instance y.
 * @param sceneX Desired x on bench.
 * @param sceneY Desired y on bench.
 */
export function snapPositionToBreadboardHole(
  breadboardX: number,
  breadboardY: number,
  sceneX: number,
  sceneY: number,
): { x: number; y: number; hole: BreadboardHoleSite } {
  const localX = sceneX - breadboardX
  const localY = sceneY - breadboardY
  const hole = nearestHoleFromSceneLocal(localX, localY)
  const center = holeScenePosition(breadboardX, breadboardY, hole.row, hole.column)
  return { x: center.x, y: center.y, hole }
}
