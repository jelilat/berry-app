'use client'

import { useMemo } from 'react'
import { useViewport } from '@xyflow/react'
import type { BerryProject } from '@/lib/project/types'
import { formatBreadboardSite, type BreadboardHoleSite } from '@/lib/project/breadboard'
import { holeBenchPosition } from '@/lib/studio/breadboard-snap'
import { SCENE_SCALE } from '@/lib/studio/constants'

/**
 * Highlights breadboard holes for the selected part's placement (snap targets).
 * @param project Current project.
 * @param selectedId Selected component instance id, if any.
 */
export function BreadboardHoleOverlay({
  project,
  selectedId,
}: {
  project: BerryProject
  selectedId: string | null
}) {
  const { x, y, zoom } = useViewport()

  const markers = useMemo(() => {
    if (!selectedId) return []
    const inst = project.components.find((c) => c.id === selectedId)
    if (!inst?.placement?.sites || !inst.parent) return []
    const bb = project.components.find((c) => c.id === inst.parent)
    if (!bb || bb.type !== 'breadboard-full') return []

    return Object.entries(inst.placement.sites)
      .filter((entry): entry is [string, BreadboardHoleSite] => entry[1].kind === 'hole')
      .map(([terminalId, site]) => {
        const bench = holeBenchPosition(bb, site)
        return {
          terminalId,
          label: formatBreadboardSite(site),
          px: bench.x * SCENE_SCALE,
          py: bench.y * SCENE_SCALE,
        }
      })
  }, [project, selectedId])

  if (markers.length === 0) return null

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      style={{ zIndex: 3 }}
    >
      <g transform={`translate(${x},${y}) scale(${zoom})`}>
        {markers.map((m) => (
          <g key={m.terminalId}>
            <circle
              cx={m.px}
              cy={m.py}
              r={6}
              fill="rgba(214,51,108,0.25)"
              stroke="var(--accent)"
              strokeWidth={2}
            />
            <text
              x={m.px}
              y={m.py - 10}
              textAnchor="middle"
              fontSize={9}
              fontWeight="bold"
              fill="var(--accent)"
            >
              {m.label}
            </text>
          </g>
        ))}
      </g>
    </svg>
  )
}
