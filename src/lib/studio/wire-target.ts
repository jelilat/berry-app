import type { BerryProject } from '@/lib/project/types'
import type { TerminalSelection } from '@/lib/studio/flow-map'
import type { PinLayoutRegistry } from '@/lib/studio/pin-layout-registry'
import { terminalCanvasPosition } from '@/lib/studio/studio-terminal-layout'

/** Maximum flow-space distance from cursor to pin for snap-assisted wiring. */
export const WIRE_TARGET_SNAP_RADIUS_PX = 30

/** Resolved terminal drop target and its flow-space position. */
export interface WireTargetHit {
  target: TerminalSelection
  positionPx: { x: number; y: number }
  distancePx: number
}

/**
 * Find the nearest terminal to a flow-space cursor point.
 * @param project Berry project containing placed components.
 * @param cursorPx Cursor position in React Flow canvas coordinates.
 * @param scale Pixels per scene unit.
 * @param registry Runtime pin layout registry.
 * @param options Optional source to ignore and snap radius.
 */
export function nearestWireTarget(
  project: BerryProject,
  cursorPx: { x: number; y: number },
  scale: number,
  registry: PinLayoutRegistry,
  options?: {
    ignore?: TerminalSelection
    ignoreComponentId?: string
    ignoreTerminalKeys?: Set<string>
    radiusPx?: number
  },
): WireTargetHit | null {
  const radiusPx = options?.radiusPx ?? WIRE_TARGET_SNAP_RADIUS_PX
  let best: WireTargetHit | null = null

  for (const component of project.components) {
    if (component.id === options?.ignoreComponentId) continue
    const layout = registry.get(component.id)
    if (!layout) continue

    for (const terminalId of Object.keys(layout)) {
      if (
        options?.ignore?.componentId === component.id &&
        options.ignore.terminalId === terminalId
      ) {
        continue
      }
      if (options?.ignoreTerminalKeys?.has(`${component.id}:${terminalId}`)) {
        continue
      }

      const positionPx = terminalCanvasPosition(
        project,
        component.id,
        terminalId,
        scale,
        registry,
      )
      if (!positionPx) continue

      const distancePx = Math.hypot(
        cursorPx.x - positionPx.x,
        cursorPx.y - positionPx.y,
      )
      if (distancePx > radiusPx) continue
      if (!best || distancePx < best.distancePx) {
        best = {
          target: { componentId: component.id, terminalId },
          positionPx,
          distancePx,
        }
      }
    }
  }

  return best
}
