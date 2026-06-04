import type { TerminalSelection } from '@/lib/studio/flow-map'
import type { TerminalRef, WireEndpointRef } from '@/lib/project/mutations'

/** In-progress drag from one pin toward another (or the cursor). */
export interface WireDraftState {
  from: WireEndpointRef
  startPx: { x: number; y: number }
  cursorPx: { x: number; y: number }
  /** Interaction mode: click-armed source or active drag. */
  mode?: 'armed' | 'dragging'
  /** Snap target pin under the pointer, if any. */
  hoverTarget: TerminalSelection | null
  /** Actual endpoint to connect on drop (pin or bare breadboard hole). */
  hoverEndpoint?: WireEndpointRef | null
  /** Canvas position of the hover target pin. */
  hoverTargetPx: { x: number; y: number } | null
}

/**
 * Parse a pin hit target from a DOM element.
 * @param el Element under the pointer.
 */
export function terminalFromPinElement(el: Element | null): TerminalSelection | null {
  const pin = el?.closest('[data-pin-target="true"]')
  if (!pin) return null
  const componentId = pin.getAttribute('data-component')
  const terminalId = pin.getAttribute('data-terminal')
  if (!componentId || !terminalId) return null
  return { componentId, terminalId }
}

/**
 * True when two terminal selections refer to the same pin.
 * @param a First terminal.
 * @param b Second terminal.
 */
export function sameTerminal(
  a: TerminalRef,
  b: TerminalSelection,
): boolean {
  return a.componentId === b.componentId && a.terminalId === b.terminalId
}
