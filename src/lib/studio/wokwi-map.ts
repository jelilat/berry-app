import type { ComponentTypeId } from '@/lib/project/types'
import { wokwiElementNativeSize } from '@/lib/studio/wokwi-element-size'

/** Wokwi custom-element tag for a catalog part, if one exists. */
export type WokwiTag =
  | 'wokwi-esp32-devkit-v1'
  | 'wokwi-arduino-uno'
  | 'wokwi-led'
  | 'wokwi-resistor'
  | 'wokwi-pushbutton-6mm'
  | 'wokwi-hc-sr04'
  | 'wokwi-servo'
  | 'wokwi-lcd1602'

/** Visual + pin metadata for rendering a catalog part with Wokwi Elements. */
export interface WokwiPartVisual {
  tag: WokwiTag
  /** Native SVG width used for scaling pin coordinates. */
  nativeWidth: number
  /** Native SVG height used for scaling pin coordinates. */
  nativeHeight: number
  /** berry terminal id → Wokwi pinInfo.name */
  pinMap: Record<string, string>
  /** Attributes passed to the web component. */
  props?: Record<string, string | boolean | number>
}

const RESISTOR_VALUE: Record<string, string> = {
  'resistor-220': '220',
  'resistor-1k': '1000',
  'resistor-2k': '2000',
}

/**
 * Return Wokwi visual metadata for a catalog type, or null when no element exists.
 * @param type Berry catalog component id.
 */
export function getWokwiVisual(type: ComponentTypeId): WokwiPartVisual | null {
  switch (type) {
    case 'esp32-devkit-v1':
      return {
        tag: 'wokwi-esp32-devkit-v1',
        nativeWidth: 107,
        nativeHeight: 201,
        pinMap: {
          VIN: 'VIN',
          GND_L: 'GND.2',
          IO13: 'D13',
          IO12: 'D12',
          IO14: 'D14',
          IO27: 'D27',
          IO26: 'D26',
          IO25: 'D25',
          IO33: 'D33',
          IO32: 'D32',
          IO35: 'D35',
          IO34: 'D34',
          VN: 'VN',
          VP: 'VP',
          EN: 'EN',
          '3V3': '3V3',
          GND_R: 'GND.1',
          IO15: 'D15',
          IO2: 'D2',
          IO4: 'D4',
          RX2: 'RX2',
          TX2: 'TX2',
          IO5: 'D5',
          IO18: 'D18',
          IO19: 'D19',
          IO21: 'D21',
          RX0: 'RX0',
          TX0: 'TX0',
          IO22: 'D22',
          IO23: 'D23',
        },
      }
    case 'arduino-uno':
      return {
        tag: 'wokwi-arduino-uno',
        nativeWidth: 260,
        nativeHeight: 200,
        pinMap: {
          '5V': '5V',
          '3V3': '3V3',
          GND: 'GND.1',
          D13: '13',
          A4: 'A4.2',
          A5: 'A5.2',
        },
      }
    case 'led-5mm':
      return {
        tag: 'wokwi-led',
        nativeWidth: 40,
        nativeHeight: 48,
        pinMap: { anode: 'A', cathode: 'C' },
        props: { color: 'red' },
      }
    case 'resistor-220':
    case 'resistor-1k':
    case 'resistor-2k':
      return {
        tag: 'wokwi-resistor',
        nativeWidth: 59,
        nativeHeight: 12,
        pinMap: { pin1: '1', pin2: '2' },
        props: { value: RESISTOR_VALUE[type] ?? '220' },
      }
    case 'push-button':
      return {
        tag: 'wokwi-pushbutton-6mm',
        nativeWidth: 24,
        nativeHeight: 24,
        pinMap: { pin1: '1.l', pin2: '2.l' },
        props: { color: 'green' },
      }
    case 'hc-sr04':
      return {
        tag: 'wokwi-hc-sr04',
        nativeWidth: 110,
        nativeHeight: 100,
        pinMap: { VCC: 'VCC', TRIG: 'TRIG', ECHO: 'ECHO', GND: 'GND' },
      }
    case 'servo-sg90':
      return {
        tag: 'wokwi-servo',
        nativeWidth: 120,
        nativeHeight: 100,
        pinMap: { VCC: 'V+', GND: 'GND', SIG: 'PWM' },
      }
    case 'lcd-1602-i2c':
      return {
        tag: 'wokwi-lcd1602',
        nativeWidth: 120,
        nativeHeight: 80,
        pinMap: { VCC: 'VCC', GND: 'GND', SDA: 'SDA', SCL: 'SCL' },
        props: { pins: 'i2c', screenOnly: true },
      }
    default:
      return null
  }
}

/**
 * Whether a catalog type has a Wokwi element skin.
 * @param type Berry catalog component id.
 */
export function hasWokwiVisual(type: ComponentTypeId): boolean {
  return getWokwiVisual(type) !== null
}

/**
 * Catalog pin layout (0–1) from Wokwi pinInfo metadata for boards and parts.
 * Used before a live element mounts and as a better fallback than even spacing.
 * @param type Berry catalog component id.
 * @param terminalIds Terminal ids to include.
 */
export function wokwiBaselinePinLayout(
  type: ComponentTypeId,
  terminalIds: string[],
): Record<string, { x: number; y: number }> | null {
  const visual = getWokwiVisual(type)
  if (!visual) return null

  const pinsByName = new Map(
    WOKWI_PIN_COORDS[visual.tag]?.map((p) => [p.name, p]) ?? [],
  )
  if (pinsByName.size === 0) return null

  const layout: Record<string, { x: number; y: number }> = {}
  for (const terminalId of terminalIds) {
    const wokwiName = visual.pinMap[terminalId]
    const pin = wokwiName ? pinsByName.get(wokwiName) : undefined
    if (!pin) continue
    layout[terminalId] = {
      x: pin.x / visual.nativeWidth,
      y: pin.y / visual.nativeHeight,
    }
  }
  return Object.keys(layout).length > 0 ? layout : null
}

/** Native pinInfo coordinates keyed by Wokwi element tag. */
const WOKWI_PIN_COORDS: Partial<
  Record<WokwiTag, { name: string; x: number; y: number }[]>
> = {
  'wokwi-esp32-devkit-v1': [
    { name: 'VIN', x: 5, y: 158.5 },
    { name: 'GND.2', x: 5, y: 149 },
    { name: 'D13', x: 5, y: 139.5 },
    { name: 'D12', x: 5, y: 130.4 },
    { name: 'D14', x: 5, y: 120 },
    { name: 'D27', x: 5, y: 110.8 },
    { name: 'D26', x: 5, y: 101 },
    { name: 'D25', x: 5, y: 91.3 },
    { name: 'D33', x: 5, y: 81.7 },
    { name: 'D32', x: 5, y: 72.2 },
    { name: 'D35', x: 5, y: 62.9 },
    { name: 'D34', x: 5, y: 53.1 },
    { name: 'VN', x: 5, y: 44 },
    { name: 'VP', x: 5, y: 34 },
    { name: 'EN', x: 5, y: 24 },
    { name: '3V3', x: 101.3, y: 158.5 },
    { name: 'GND.1', x: 101.3, y: 149 },
    { name: 'D15', x: 101.3, y: 139.5 },
    { name: 'D2', x: 101.3, y: 130.4 },
    { name: 'D4', x: 101.3, y: 120 },
    { name: 'RX2', x: 101.3, y: 110.8 },
    { name: 'TX2', x: 101.3, y: 101 },
    { name: 'D5', x: 101.3, y: 91.3 },
    { name: 'D18', x: 101.3, y: 81.7 },
    { name: 'D19', x: 101.3, y: 72.2 },
    { name: 'D21', x: 101.3, y: 62.9 },
    { name: 'RX0', x: 101.3, y: 53.1 },
    { name: 'TX0', x: 101.3, y: 44 },
    { name: 'D22', x: 101.3, y: 34 },
    { name: 'D23', x: 101.3, y: 24 },
  ],
  'wokwi-arduino-uno': [
    { name: '5V', x: 160, y: 191.5 },
    { name: '3.3V', x: 150, y: 191.5 },
    { name: 'GND.1', x: 115.5, y: 9 },
    { name: '13', x: 125, y: 9 },
    { name: 'A4.2', x: 97, y: 9 },
    { name: 'A5.2', x: 87, y: 9 },
  ],
  'wokwi-led': [
    { name: 'A', x: 8, y: 24 },
    { name: 'C', x: 32, y: 24 },
  ],
  'wokwi-pushbutton-6mm': [
    { name: '1.l', x: 0, y: 4.5 },
    { name: '2.l', x: 0, y: 19.5 },
    { name: '1.r', x: 24, y: 4.5 },
    { name: '2.r', x: 24, y: 19.5 },
  ],
}

/**
 * Resolve berry terminal positions (0–1) from a mounted Wokwi element's pinInfo.
 * @param element Mounted custom element exposing pinInfo.
 * @param visual Wokwi visual metadata for the part type.
 * @param terminalIds Berry terminal ids to resolve.
 */
export function pinLayoutFromWokwiElement(
  element: HTMLElement & { pinInfo?: { name: string; x: number; y: number }[] },
  visual: WokwiPartVisual,
  terminalIds: string[],
): Record<string, { x: number; y: number }> {
  const pins = element.pinInfo ?? []
  const byName = new Map(pins.map((p) => [p.name, p]))
  const { width, height } = wokwiElementNativeSize(
    element,
    visual.nativeWidth,
    visual.nativeHeight,
  )
  const layout: Record<string, { x: number; y: number }> = {}

  for (const terminalId of terminalIds) {
    const wokwiName = visual.pinMap[terminalId]
    const pin = wokwiName ? byName.get(wokwiName) : undefined
    if (!pin) continue
    layout[terminalId] = {
      x: pin.x / width,
      y: pin.y / height,
    }
  }
  return layout
}
