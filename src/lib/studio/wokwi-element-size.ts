/**
 * Read the native SVG coordinate size from a mounted Wokwi custom element.
 * Falls back to catalog metadata when shadow DOM is not ready.
 * @param element Mounted Wokwi web component.
 * @param fallbackW Native width from {@link WokwiPartVisual}.
 * @param fallbackH Native height from {@link WokwiPartVisual}.
 */
export function wokwiElementNativeSize(
  element: HTMLElement,
  fallbackW: number,
  fallbackH: number,
): { width: number; height: number } {
  const svg = element.shadowRoot?.querySelector('svg')
  if (!svg) return { width: fallbackW, height: fallbackH }

  const viewBox = svg.getAttribute('viewBox')
  if (viewBox) {
    const parts = viewBox.trim().split(/[\s,]+/).map(Number)
    if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
      return { width: parts[2], height: parts[3] }
    }
  }

  const width = parseSvgLength(svg.getAttribute('width'))
  const height = parseSvgLength(svg.getAttribute('height'))
  if (width && height) return { width, height }

  return { width: fallbackW, height: fallbackH }
}

/**
 * Parse an SVG length attribute (supports bare numbers and simple mm suffix).
 * @param raw Raw SVG length string.
 */
function parseSvgLength(raw: string | null): number {
  if (!raw) return 0
  const n = parseFloat(raw.replace(/mm$/, ''))
  return Number.isFinite(n) ? n : 0
}
