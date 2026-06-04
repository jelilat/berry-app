import type { ComponentTypeId } from '@/lib/project/types'
import { BreadboardArt } from './BreadboardArt'

/**
 * Illustrated fallback for catalog parts without a Wokwi element.
 * @param type Berry catalog component id.
 * @param size Square preview size in pixels (tray cards).
 * @param width Optional canvas width when `variant` is canvas.
 * @param height Optional canvas height when `variant` is canvas.
 * @param variant `tray` for palette cards, `canvas` for placed parts (no chrome).
 */
export function FallbackPartArt({
  type,
  size = 72,
  width,
  height,
  variant = 'tray',
}: {
  type: ComponentTypeId
  size?: number
  width?: number
  height?: number
  variant?: 'tray' | 'canvas'
}) {
  if (type === 'breadboard-full') {
    const w = variant === 'canvas' && width ? width : size * 1.4
    const h = variant === 'canvas' && height ? height : size * 0.55
    return <BreadboardArt width={w} height={h} />
  }

  if (type === 'bme280') {
    return <ChipArt label="BME280" pins={4} size={size} />
  }

  return <GenericPartArt label={type} size={size} />
}

function ChipArt({ label, pins, size }: { label: string; pins: number; size: number }) {
  return (
    <svg width={size} height={size * 0.7} viewBox="0 0 80 56" aria-hidden>
      <rect x="12" y="8" width="56" height="40" rx="3" fill="#1a1a22" stroke="#444" strokeWidth="1" />
      <text x="40" y="32" textAnchor="middle" fill="#aaa" fontSize="9" fontFamily="monospace">
        {label}
      </text>
      {Array.from({ length: pins }).map((_, i) => (
        <rect key={i} x={8} y={14 + i * 9} width="6" height="4" fill="#c0c0c0" />
      ))}
    </svg>
  )
}

function GenericPartArt({ label, size }: { label: string; size: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-lg text-[9px] font-bold uppercase tracking-wide"
      style={{
        width: size,
        height: size * 0.7,
        background: 'linear-gradient(145deg, #f5f3ef 0%, #ebe7df 100%)',
        border: '1px solid var(--border-strong)',
        color: 'var(--text-muted)',
      }}
    >
      {label.slice(0, 8)}
    </div>
  )
}
