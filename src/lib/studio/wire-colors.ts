import type { WireColor } from '@/lib/project/types'

/** Hex stroke colors for wire overlay and live preview. */
export const WIRE_STROKE_HEX: Record<WireColor | string, string> = {
  red: '#D6336C',
  black: '#1c1917',
  yellow: '#ca8a04',
  green: '#0FA886',
  blue: '#2563eb',
  orange: '#ea580c',
  purple: '#7c3aed',
  white: '#a8a29e',
}

/**
 * Resolve a wire color name to an SVG stroke hex value.
 * @param color Wire color from project JSON or wire template.
 */
export function wireStrokeHex(color?: WireColor | string): string {
  return WIRE_STROKE_HEX[color ?? 'yellow'] ?? '#ca8a04'
}
