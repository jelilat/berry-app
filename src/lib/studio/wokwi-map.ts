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
  | 'wokwi-pir-motion-sensor'
  | 'wokwi-dht22'
  | 'wokwi-photoresistor-sensor'
  | 'wokwi-ntc-temperature-sensor'
  | 'wokwi-gas-sensor'
  | 'wokwi-small-sound-sensor'
  | 'wokwi-big-sound-sensor'
  | 'wokwi-flame-sensor'
  | 'wokwi-heart-beat-sensor'
  | 'wokwi-tilt-switch'
  | 'wokwi-mpu6050'
  | 'wokwi-servo'
  | 'wokwi-lcd1602'
  | 'wokwi-lcd2004'
  | 'wokwi-ssd1306'
  | 'wokwi-ili9341'
  | 'wokwi-7segment'
  | 'wokwi-led-bar-graph'
  | 'wokwi-neopixel'
  | 'wokwi-neopixel-matrix'
  | 'wokwi-led-ring'
  | 'wokwi-rgb-led'
  | 'wokwi-buzzer'
  | 'wokwi-membrane-keypad'
  | 'wokwi-analog-joystick'
  | 'wokwi-ky-040'
  | 'wokwi-dip-switch-8'
  | 'wokwi-slide-switch'
  | 'wokwi-potentiometer'
  | 'wokwi-slide-potentiometer'
  | 'wokwi-ir-receiver'
  | 'wokwi-ir-remote'
  | 'wokwi-rotary-dialer'
  | 'wokwi-stepper-motor'
  | 'wokwi-ks2e-m-dc5'
  | 'wokwi-biaxial-stepper'
  | 'wokwi-microsd-card'
  | 'wokwi-ds1307'
  | 'wokwi-hx711'

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
    case 'pushbutton-6mm':
      return {
        tag: 'wokwi-pushbutton-6mm',
        nativeWidth: 24,
        nativeHeight: 24,
        pinMap: { pin1: '1.l', pin2: '2.l', pin3: '1.r', pin4: '2.r' },
        props: { color: 'green' },
      }
    case 'membrane-keypad-4x4':
      return {
        tag: 'wokwi-membrane-keypad',
        nativeWidth: 153,
        nativeHeight: 348,
        pinMap: { R1: 'R1', R2: 'R2', R3: 'R3', R4: 'R4', C1: 'C1', C2: 'C2', C3: 'C3', C4: 'C4' },
      }
    case 'hc-sr04':
      return {
        tag: 'wokwi-hc-sr04',
        nativeWidth: 110,
        nativeHeight: 100,
        pinMap: { VCC: 'VCC', TRIG: 'TRIG', ECHO: 'ECHO', GND: 'GND' },
      }
    case 'pir-motion-sensor-hc-sr501':
      return {
        tag: 'wokwi-pir-motion-sensor',
        nativeWidth: 90.7,
        nativeHeight: 92.4,
        pinMap: { VCC: 'VCC', OUT: 'OUT', GND: 'GND' },
      }
    case 'dht22':
      return {
        tag: 'wokwi-dht22',
        nativeWidth: 15.1,
        nativeHeight: 30.885,
        pinMap: { VCC: 'VCC', SDA: 'SDA', NC: 'NC', GND: 'GND' },
      }
    case 'photoresistor-sensor':
      return {
        tag: 'wokwi-photoresistor-sensor',
        nativeWidth: 174,
        nativeHeight: 61.5,
        pinMap: { VCC: 'VCC', GND: 'GND', DO: 'DO', AO: 'AO' },
      }
    case 'ntc-temperature-sensor':
      return {
        tag: 'wokwi-ntc-temperature-sensor',
        nativeWidth: 135.4,
        nativeHeight: 71.782,
        pinMap: { GND: 'GND', VCC: 'VCC', OUT: 'OUT' },
      }
    case 'mq2-gas-sensor':
      return {
        tag: 'wokwi-gas-sensor',
        nativeWidth: 137,
        nativeHeight: 59.5,
        pinMap: { AO: 'AOUT', DO: 'DOUT', GND: 'GND', VCC: 'VCC' },
      }
    case 'small-sound-sensor':
      return {
        tag: 'wokwi-small-sound-sensor',
        nativeWidth: 133,
        nativeHeight: 50.4,
        pinMap: { AO: 'AOUT', GND: 'GND', VCC: 'VCC', DO: 'DOUT' },
      }
    case 'big-sound-sensor':
      return {
        tag: 'wokwi-big-sound-sensor',
        nativeWidth: 140,
        nativeHeight: 50.4,
        pinMap: { AO: 'AOUT', GND: 'GND', VCC: 'VCC', DO: 'DOUT' },
      }
    case 'flame-sensor':
      return {
        tag: 'wokwi-flame-sensor',
        nativeWidth: 200,
        nativeHeight: 61.5,
        pinMap: { VCC: 'VCC', GND: 'GND', DO: 'DOUT', AO: 'AOUT' },
      }
    case 'heart-beat-sensor':
      return {
        tag: 'wokwi-heart-beat-sensor',
        nativeWidth: 88.4,
        nativeHeight: 79.2,
        pinMap: { GND: 'GND', VCC: 'VCC', OUT: 'OUT' },
      }
    case 'tilt-switch':
      return {
        tag: 'wokwi-tilt-switch',
        nativeWidth: 88.4,
        nativeHeight: 55.6,
        pinMap: { GND: 'GND', VCC: 'VCC', OUT: 'OUT' },
      }
    case 'mpu6050':
      return {
        tag: 'wokwi-mpu6050',
        nativeWidth: 81.6,
        nativeHeight: 61.2,
        pinMap: { VCC: 'VCC', GND: 'GND', SCL: 'SCL', SDA: 'SDA', XDA: 'XDA', XCL: 'XCL', AD0: 'AD0', INT: 'INT' },
      }
    case 'servo-sg90':
      return {
        tag: 'wokwi-servo',
        nativeWidth: 120,
        nativeHeight: 100,
        pinMap: { VCC: 'V+', GND: 'GND', SIG: 'PWM' },
      }
    case 'analog-joystick':
      return {
        tag: 'wokwi-analog-joystick',
        nativeWidth: 27.2,
        nativeHeight: 31.8,
        pinMap: { VCC: 'VCC', VERT: 'VERT', HORZ: 'HORZ', SEL: 'SEL', GND: 'GND' },
      }
    case 'rotary-encoder-ky-040':
      return {
        tag: 'wokwi-ky-040',
        nativeWidth: 116,
        nativeHeight: 70.4,
        pinMap: { CLK: 'CLK', DT: 'DT', SW: 'SW', '+': '+', GND: 'GND' },
      }
    case 'dip-switch-8':
      return {
        tag: 'wokwi-dip-switch-8',
        nativeWidth: 74,
        nativeHeight: 58,
        pinMap: {
          '1a': '1a',
          '2a': '2a',
          '3a': '3a',
          '4a': '4a',
          '5a': '5a',
          '6a': '6a',
          '7a': '7a',
          '8a': '8a',
          '1b': '1b',
          '2b': '2b',
          '3b': '3b',
          '4b': '4b',
          '5b': '5b',
          '6b': '6b',
          '7b': '7b',
          '8b': '8b',
        },
      }
    case 'slide-switch':
      return {
        tag: 'wokwi-slide-switch',
        nativeWidth: 8.5,
        nativeHeight: 9.23,
        pinMap: { '1': '1', '2': '2', '3': '3' },
      }
    case 'potentiometer':
      return {
        tag: 'wokwi-potentiometer',
        nativeWidth: 20,
        nativeHeight: 20,
        pinMap: { GND: 'GND', SIG: 'SIG', VCC: 'VCC' },
      }
    case 'slide-potentiometer':
      return {
        tag: 'wokwi-slide-potentiometer',
        nativeWidth: 55,
        nativeHeight: 29,
        pinMap: { VCC: 'VCC', SIG: 'SIG', GND: 'GND' },
      }
    case 'ir-receiver':
      return {
        tag: 'wokwi-ir-receiver',
        nativeWidth: 41.954,
        nativeHeight: 87.75,
        pinMap: { GND: 'GND', VCC: 'VCC', DAT: 'DAT' },
      }
    case 'ir-remote':
      return {
        tag: 'wokwi-ir-remote',
        nativeWidth: 160,
        nativeHeight: 360,
        pinMap: {},
      }
    case 'rotary-dialer':
      return {
        tag: 'wokwi-rotary-dialer',
        nativeWidth: 266,
        nativeHeight: 296,
        pinMap: { GND: 'GND', DIAL: 'DIAL', PULSE: 'PULSE' },
      }
    case 'relay-module':
      return null
    case 'ks2e-relay':
      return {
        tag: 'wokwi-ks2e-m-dc5',
        nativeWidth: 75.6,
        nativeHeight: 37.8,
        pinMap: { NO2: 'NO2', NC2: 'NC2', P2: 'P2', COIL2: 'COIL2', NO1: 'NO1', NC1: 'NC1', P1: 'P1', COIL1: 'COIL1' },
      }
    case 'stepper-motor':
      return {
        tag: 'wokwi-stepper-motor',
        nativeWidth: 166,
        nativeHeight: 184,
        pinMap: { 'A-': 'A-', 'A+': 'A+', 'B+': 'B+', 'B-': 'B-' },
      }
    case 'biaxial-stepper':
      return {
        tag: 'wokwi-biaxial-stepper',
        nativeWidth: 212,
        nativeHeight: 255,
        pinMap: { 'A1-': 'A1-', 'A1+': 'A1+', 'B1+': 'B1+', 'B1-': 'B1-', 'A2-': 'A2-', 'A2+': 'A2+', 'B2+': 'B2+', 'B2-': 'B2-' },
      }
    case 'lcd-1602-i2c':
      return {
        tag: 'wokwi-lcd1602',
        nativeWidth: 120,
        nativeHeight: 80,
        pinMap: { VCC: 'VCC', GND: 'GND', SDA: 'SDA', SCL: 'SCL' },
        props: { pins: 'i2c', screenOnly: true },
      }
    case 'lcd-2004-i2c':
      return {
        tag: 'wokwi-lcd2004',
        nativeWidth: 120,
        nativeHeight: 80,
        pinMap: { VCC: 'VCC', GND: 'GND', SDA: 'SDA', SCL: 'SCL' },
        props: { pins: 'i2c', screenOnly: true },
      }
    case 'ssd1306-oled':
      return {
        tag: 'wokwi-ssd1306',
        nativeWidth: 150,
        nativeHeight: 116,
        pinMap: { SDA: 'DATA', SCL: 'CLK', VCC: '3V3', GND: 'GND' },
      }
    case 'ili9341-tft':
      return {
        tag: 'wokwi-ili9341',
        nativeWidth: 177,
        nativeHeight: 300,
        pinMap: { VCC: 'VCC', GND: 'GND', CS: 'CS', RESET: 'RST', 'D/C': 'D/C', SDI: 'MOSI', SCK: 'SCK', LED: 'LED', SDO: 'MISO' },
      }
    case 'single-7segment':
      return {
        tag: 'wokwi-7segment',
        nativeWidth: 28,
        nativeHeight: 38,
        pinMap: { A: 'A', B: 'B', C: 'C', D: 'D', E: 'E', F: 'F', G: 'G', DP: 'DP', COM: 'COM' },
      }
    default:
      break
  }

  switch (type) {
    case 'led-bar-graph':
      return {
        tag: 'wokwi-led-bar-graph',
        nativeWidth: 10.1,
        nativeHeight: 25.5,
        pinMap: {
          A1: 'A1',
          A2: 'A2',
          A3: 'A3',
          A4: 'A4',
          A5: 'A5',
          A6: 'A6',
          A7: 'A7',
          A8: 'A8',
          A9: 'A9',
          A10: 'A10',
          C1: 'C1',
          C2: 'C2',
          C3: 'C3',
          C4: 'C4',
          C5: 'C5',
          C6: 'C6',
          C7: 'C7',
          C8: 'C8',
          C9: 'C9',
          C10: 'C10',
        },
      }
    case 'neopixel':
      return {
        tag: 'wokwi-neopixel',
        nativeWidth: 5.6631,
        nativeHeight: 5,
        pinMap: { VDD: 'VDD', DIN: 'DIN', GND: 'GND', DOUT: 'DOUT' },
      }
    case 'neopixel-matrix':
      return {
        tag: 'wokwi-neopixel-matrix',
        nativeWidth: 226,
        nativeHeight: 226,
        pinMap: { VCC: 'VCC', DIN: 'DIN', GND: 'GND', DOUT: 'DOUT' },
      }
    case 'led-ring':
      return {
        tag: 'wokwi-led-ring',
        nativeWidth: 74,
        nativeHeight: 83,
        pinMap: { VCC: 'VCC', DIN: 'DIN', GND: 'GND', DOUT: 'DOUT' },
      }
    case 'rgb-led':
      return {
        tag: 'wokwi-rgb-led',
        nativeWidth: 37.3425,
        nativeHeight: 57.5115,
        pinMap: { R: 'R', COM: 'COM', G: 'G', B: 'B' },
      }
    case 'buzzer':
      return {
        tag: 'wokwi-buzzer',
        nativeWidth: 17,
        nativeHeight: 20,
        pinMap: { '1': '1', '2': '2' },
      }
    case 'microsd-card':
      return {
        tag: 'wokwi-microsd-card',
        nativeWidth: 21.6,
        nativeHeight: 20.4,
        pinMap: { CD: 'CD', DO: 'DO', GND: 'GND', SCK: 'SCK', VCC: 'VCC', DI: 'DI', CS: 'CS' },
      }
    case 'ds1307-rtc':
      return {
        tag: 'wokwi-ds1307',
        nativeWidth: 25.8,
        nativeHeight: 22.212,
        pinMap: { GND: 'GND', '5V': '5V', SDA: 'SDA', SCL: 'SCL', SQW: 'SQW' },
      }
    case 'hx711-load-cell-amp':
      return {
        tag: 'wokwi-hx711',
        nativeWidth: 340,
        nativeHeight: 200,
        pinMap: { VCC: 'VCC', GND: 'GND', DT: 'DT', SCK: 'SCK' },
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
