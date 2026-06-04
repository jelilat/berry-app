'use client'

import { useMemo, type PointerEvent as ReactPointerEvent } from 'react'
import { useViewport } from '@xyflow/react'
import type { BerryProject } from '@/lib/project/types'
import {
  BREADBOARD_COLUMNS,
  BREADBOARD_ROWS_BOTTOM,
  BREADBOARD_ROWS_TOP,
  breadboardHole,
  type BreadboardHoleSite,
} from '@/lib/project/breadboard'
import type { BreadboardHoleRef } from '@/lib/project/mutations'
import { holeBenchPosition } from '@/lib/studio/breadboard-snap'
import { SCENE_SCALE } from '@/lib/studio/constants'
import { isBreadboardEndpointOccupied } from '@/lib/studio/connect-pins'

/** Live target shown on a breadboard hole while dragging a part. */
export interface BreadboardHoleHoverMarker {
  id: string
  x: number
  y: number
  /** True when the hole is blocked by another part's leg. */
  invalid?: boolean
}

/**
 * Highlights breadboard holes for the selected part's placement (snap targets).
 * @param project Current project.
 * @param selectedId Selected component instance id, if any.
 * @param hoverMarkers Live breadboard hole targets while dragging.
 */
export function BreadboardHoleOverlay({
  project,
  selectedId,
  hoverMarkers = [],
  wireStart,
  interactiveHoles = false,
  elevateForWireConnect = false,
  onHolePointerDown,
}: {
  project: BerryProject
  selectedId: string | null
  hoverMarkers?: BreadboardHoleHoverMarker[]
  wireStart?: BreadboardHoleRef | null
  /** When false, holes are visual-only so wires stay clickable (M–M tray mode enables this). */
  interactiveHoles?: boolean
  /** Raise above the wire layer while finishing a breadboard-to-breadboard connection. */
  elevateForWireConnect?: boolean
  onHolePointerDown?: (
    endpoint: BreadboardHoleRef,
    positionPx: { x: number; y: number },
    event: ReactPointerEvent<SVGCircleElement>,
  ) => void
}) {
  const { x, y, zoom } = useViewport()

  const markers = useMemo(() => {
    if (!selectedId) return []
    const inst = project.components.find((c) => c.id === selectedId)
    if (!inst) return []

    const placedParts =
      inst.type === 'breadboard-full'
        ? project.components.filter((c) => c.parent === inst.id && c.placement?.sites)
        : inst.placement?.sites && inst.parent
          ? [inst]
          : []

    return placedParts.flatMap((part) => {
      const bb = project.components.find((c) => c.id === part.parent)
      if (!bb || bb.type !== 'breadboard-full' || !part.placement?.sites) return []

      return Object.entries(part.placement.sites)
        .filter((entry): entry is [string, BreadboardHoleSite] => entry[1].kind === 'hole')
        .map(([terminalId, site]) => {
          const bench = holeBenchPosition(bb, site)
          return {
            id: `${part.id}:${terminalId}`,
            px: bench.x * SCENE_SCALE,
            py: bench.y * SCENE_SCALE,
          }
        })
    })
  }, [project, selectedId])

  const hover = hoverMarkers.map((m) => ({
    ...m,
    px: m.x * SCENE_SCALE,
    py: m.y * SCENE_SCALE,
  }))

  const holeTargets = useMemo(() => {
    if (!interactiveHoles || !onHolePointerDown) return []
    return project.components.flatMap((breadboard) => {
      if (breadboard.type !== 'breadboard-full') return []
      const rows = [...BREADBOARD_ROWS_TOP, ...BREADBOARD_ROWS_BOTTOM]
      return rows.flatMap((row) =>
        Array.from({ length: BREADBOARD_COLUMNS }, (_, index) => {
          const site = breadboardHole(row, index + 1)
          const endpoint = { breadboardId: breadboard.id, site }
          const occupied = isBreadboardEndpointOccupied(project, endpoint)
          const bench = holeBenchPosition(breadboard, site)
          return {
            id: `${breadboard.id}:${site.row}${site.column}:${site.block}`,
            endpoint,
            occupied,
            px: bench.x * SCENE_SCALE,
            py: bench.y * SCENE_SCALE,
          }
        }),
      )
    })
  }, [interactiveHoles, onHolePointerDown, project])

  if (markers.length === 0 && hover.length === 0 && holeTargets.length === 0) return null

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      style={{ zIndex: elevateForWireConnect ? 8 : 6 }}
    >
      <g transform={`translate(${x},${y}) scale(${zoom})`}>
        {hover.map((m) => (
          <circle
            key={m.id}
            cx={m.px}
            cy={m.py}
            r={4}
            fill={m.invalid ? 'rgba(214,51,108,0.9)' : 'rgba(15,168,134,0.9)'}
            stroke="rgba(255,255,255,0.9)"
            strokeWidth={1}
          />
        ))}
        {markers.map((m) => (
          <g key={m.id}>
            <circle
              cx={m.px}
              cy={m.py}
              r={1.5}
              fill="rgba(214,51,108,0.8)"
              stroke="var(--accent)"
              strokeWidth={0.5}
            />
          </g>
        ))}
        {holeTargets.map((target) => {
          const selected =
            wireStart?.breadboardId === target.endpoint.breadboardId &&
            wireStart.site.kind === 'hole' &&
            wireStart.site.block === target.endpoint.site.block &&
            wireStart.site.row === target.endpoint.site.row &&
            wireStart.site.column === target.endpoint.site.column

          return (
            <circle
              key={target.id}
              className="nopan nodrag"
              cx={target.px}
              cy={target.py}
              r={4.5}
              fill={selected ? 'rgba(214,51,108,0.78)' : 'transparent'}
              stroke={selected ? 'rgba(255,255,255,0.95)' : 'transparent'}
              strokeWidth={1}
              pointerEvents={target.occupied ? 'none' : 'all'}
              style={{ cursor: target.occupied ? 'not-allowed' : 'crosshair' }}
              onPointerDown={(event) => {
                if (target.occupied) return
                event.stopPropagation()
                onHolePointerDown?.(target.endpoint, { x: target.px, y: target.py }, event)
              }}
            />
          )
        })}
      </g>
    </svg>
  )
}
