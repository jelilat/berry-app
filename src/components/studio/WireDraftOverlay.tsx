'use client'

import { useViewport } from '@xyflow/react'
import { orthogonalWireRoute } from '@/lib/project/wire-route'

/** Minimal draft shape needed to render a live wire route. */
interface WireDraftOverlayState {
  startPx: { x: number; y: number }
  cursorPx: { x: number; y: number }
  hoverTargetPx: { x: number; y: number } | null
}

/**
 * Live wire preview while dragging from an SVG pin to a target.
 * @param draft Active wire drag state, if any.
 * @param color Stroke color for the preview line.
 */
export function WireDraftOverlay({
  draft,
  color,
}: {
  draft: WireDraftOverlayState | null
  color: string
}) {
  const { x, y, zoom } = useViewport()

  if (!draft) return null

  const end = draft.hoverTargetPx ?? draft.cursorPx
  const points = orthogonalWireRoute(draft.startPx, end)
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      style={{ zIndex: 4 }}
    >
      <g transform={`translate(${x},${y}) scale(${zoom})`}>
        <path
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={draft.hoverTargetPx ? undefined : '6 4'}
          opacity={0.92}
        />
      </g>
    </svg>
  )
}
