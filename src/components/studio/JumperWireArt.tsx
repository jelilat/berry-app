import type { WireConnectors } from '@/lib/project/types'

/**
 * Tray preview art for jumper wire catalog entries.
 * @param connectors Male/female styles at each end.
 * @param color Wire stroke color (hex or named).
 * @param width SVG width in pixels.
 * @param height SVG height in pixels.
 */
export function JumperWireArt({
  connectors,
  color,
  width = 88,
  height = 48,
}: {
  connectors: WireConnectors
  color: string
  width?: number
  height?: number
}) {
  const stroke = color.startsWith('#') ? color : `#${color}`
  const y = height / 2
  const x1 = 14
  const x2 = width - 14

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <line x1={x1} y1={y} x2={x2} y2={y} stroke={stroke} strokeWidth="4" strokeLinecap="round" />
      <WireEnd x={x1} y={y} gender={connectors.start} color={stroke} />
      <WireEnd x={x2} y={y} gender={connectors.end} color={stroke} />
    </svg>
  )
}

/**
 * Draw one jumper end connector (pin or socket).
 */
function WireEnd({
  x,
  y,
  gender,
  color,
}: {
  x: number
  y: number
  gender: 'male' | 'female'
  color: string
}) {
  if (gender === 'male') {
    return (
      <g>
        <rect x={x - 2} y={y - 5} width="4" height="10" rx="1" fill="#c8c8c8" stroke="#888" strokeWidth="0.5" />
        <line x1={x - 6} y1={y} x2={x + 6} y2={y} stroke={color} strokeWidth="3" strokeLinecap="round" />
      </g>
    )
  }

  return (
    <g>
      <rect
        x={x - 5}
        y={y - 6}
        width="10"
        height="12"
        rx="1.5"
        fill="#2a2a2a"
        stroke="#666"
        strokeWidth="1"
      />
      <rect x={x - 3} y={y - 4} width="6" height="8" rx="1" fill="#1a1a1a" />
    </g>
  )
}

/**
 * Map palette color names to hex for jumper previews.
 * @param color Wire color name from catalog.
 */
export function wirePreviewColor(color: string): string {
  const map: Record<string, string> = {
    red: '#D6336C',
    black: '#1c1917',
    yellow: '#ca8a04',
    green: '#0FA886',
    blue: '#2563eb',
    orange: '#ea580c',
    purple: '#7c3aed',
    white: '#d6d3d1',
  }
  return map[color] ?? color
}
