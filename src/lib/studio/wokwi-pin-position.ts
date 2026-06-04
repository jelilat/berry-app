/** Scale + offset for a Wokwi SVG fitted inside a berry node box. */
export interface WokwiFitTransform {
  scale: number
  offsetX: number
  offsetY: number
  drawnW: number
  drawnH: number
}

/**
 * Compute letterbox transform when a Wokwi element is centered with `fit`.
 * @param containerW Node inner width (px).
 * @param containerH Node inner height (px).
 * @param artW Native SVG width.
 * @param artH Native SVG height.
 */
export function wokwiFitTransform(
  containerW: number,
  containerH: number,
  artW: number,
  artH: number,
): WokwiFitTransform {
  const scale = Math.min(containerW / artW, containerH / artH)
  const drawnW = artW * scale
  const drawnH = artH * scale
  return {
    scale,
    offsetX: (containerW - drawnW) / 2,
    offsetY: (containerH - drawnH) / 2,
    drawnW,
    drawnH,
  }
}

/**
 * Map pin positions (0–1 in SVG space) to 0–1 in the node container.
 * @param layout Pin layout relative to native SVG bounds.
 * @param containerW Node inner width (px).
 * @param containerH Node inner height (px).
 * @param artW Native SVG width.
 * @param artH Native SVG height.
 */
export function pinLayoutInContainer(
  layout: Record<string, { x: number; y: number }>,
  containerW: number,
  containerH: number,
  artW: number,
  artH: number,
): Record<string, { x: number; y: number }> {
  const { offsetX, offsetY, drawnW, drawnH } = wokwiFitTransform(
    containerW,
    containerH,
    artW,
    artH,
  )
  const out: Record<string, { x: number; y: number }> = {}
  for (const [id, rel] of Object.entries(layout)) {
    out[id] = {
      x: (offsetX + rel.x * drawnW) / containerW,
      y: (offsetY + rel.y * drawnH) / containerH,
    }
  }
  return out
}
