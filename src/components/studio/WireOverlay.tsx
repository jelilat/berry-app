'use client'

import { useCallback } from 'react'
import { useViewport } from '@xyflow/react'
import type { WireOverlayItem } from '@/lib/studio/flow-map'

const WIRE_HIT_STROKE = 18
const WIRE_STROKE = 1.4
const WIRE_HOVER_STROKE = 1.8
const WIRE_SELECTED_STROKE = 2.1

/**
 * SVG wire layer above the React Flow graph (pane space + viewport transform).
 * @param wires Wire paths in flow pixel space.
 * @param selectedWireId Currently selected wire id, if any.
 * @param hoveredWireId Wire under the cursor, if any.
 * @param onWireSelect Called when the user picks a wire.
 * @param onWireHover Called when the cursor enters or leaves a wire hit area.
 */
export function WireOverlay({
  wires,
  selectedWireId,
  hoveredWireId,
  onWireSelect,
  onWireHover,
}: {
  wires: WireOverlayItem[]
  selectedWireId: string | null
  hoveredWireId: string | null
  onWireSelect: (wireId: string) => void
  onWireHover: (wireId: string | null) => void
}) {
  const { x, y, zoom } = useViewport()

  const handleWirePointerDown = useCallback(
    (wireId: string, event: React.PointerEvent<SVGPathElement>) => {
      if (event.button !== 0) return
      event.stopPropagation()
      onWireSelect(wireId)
    },
    [onWireSelect],
  )

  return (
    <div className="berry-wire-layer-host pointer-events-none absolute inset-0 overflow-visible">
      <svg className="berry-wire-layer h-full w-full overflow-visible" aria-hidden>
        <g transform={`translate(${x},${y}) scale(${zoom})`}>
          {wires.map((wire) => {
            if (wire.points.length < 2) return null
            const d = wire.points
              .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
              .join(' ')
            const start = wire.points[0]
            const end = wire.points[wire.points.length - 1]
            const angleStart = endpointAngle(wire.points, 'start')
            const angleEnd = endpointAngle(wire.points, 'end')
            const selected = wire.id === selectedWireId
            const hovered = wire.id === hoveredWireId
            const strokeColor = selected || hovered ? 'var(--accent)' : wire.color

            return (
              <g key={wire.id}>
                <path
                  d={d}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={WIRE_HIT_STROKE}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="berry-wire-hit nopan pointer-events-auto"
                  onPointerDown={(e) => handleWirePointerDown(wire.id, e)}
                  onPointerEnter={() => onWireHover(wire.id)}
                  onPointerLeave={() => onWireHover(null)}
                />
                <path
                  d={d}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={
                    selected
                      ? WIRE_SELECTED_STROKE
                      : hovered
                        ? WIRE_HOVER_STROKE
                        : WIRE_STROKE
                  }
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ pointerEvents: 'none' }}
                  opacity={selected || hovered ? 1 : 0.92}
                />
                {wire.connectors && (
                  <>
                    <WireEndCap
                      x={start.x}
                      y={start.y}
                      angle={angleStart}
                      gender={wire.connectors.start}
                      color={strokeColor}
                    />
                    <WireEndCap
                      x={end.x}
                      y={end.y}
                      angle={angleEnd}
                      gender={wire.connectors.end}
                      color={strokeColor}
                    />
                  </>
                )}
              </g>
            )
          })}
        </g>
      </svg>
    </div>
  )
}

/**
 * Compute the tangent angle (radians) at a wire polyline endpoint.
 * @param points Wire path in pixel space.
 * @param which Start or end of the polyline.
 */
function endpointAngle(
  points: { x: number; y: number }[],
  which: 'start' | 'end',
): number {
  if (points.length < 2) return 0
  const a = which === 'start' ? points[0] : points[points.length - 2]
  const b = which === 'start' ? points[1] : points[points.length - 1]
  return Math.atan2(b.y - a.y, b.x - a.x)
}

/**
 * Render a male pin or female socket cap at a wire endpoint.
 */
function WireEndCap({
  x,
  y,
  angle,
  gender,
  color,
}: {
  x: number
  y: number
  angle: number
  gender: 'male' | 'female'
  color: string
}) {
  const deg = (angle * 180) / Math.PI

  if (gender === 'male') {
    return (
      <g transform={`translate(${x},${y}) rotate(${deg})`} style={{ pointerEvents: 'none' }}>
        <line x1={-5} y1={0} x2={5} y2={0} stroke={color} strokeWidth={1.6} strokeLinecap="round" />
        <rect x={-1} y={-3} width={2} height={6} rx={0.4} fill="#c8c8c8" stroke="#888" strokeWidth={0.45} />
      </g>
    )
  }

  return (
    <g transform={`translate(${x},${y}) rotate(${deg})`} style={{ pointerEvents: 'none' }}>
      <rect x={-3} y={-4} width={6} height={8} rx={1.2} fill="#2a2a2a" stroke="#666" strokeWidth={0.65} />
      <rect x={-1.8} y={-2.8} width={3.6} height={5.6} rx={0.8} fill="#141414" />
    </g>
  )
}
