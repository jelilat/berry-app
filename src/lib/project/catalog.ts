import type { ComponentDefinition, ComponentTypeId, WireTemplateDefinition } from './types'

export const componentCatalog: Record<ComponentTypeId, ComponentDefinition> = {
  'breadboard-full': {
    id: 'breadboard-full',
    name: 'Full breadboard',
    group: 'breadboards',
    terminals: [],
  },
  'jumper-mm': {
    id: 'jumper-mm',
    name: 'Jumper M–M',
    group: 'wires',
    terminals: [],
    wireTemplate: {
      connectors: { start: 'male', end: 'male' },
      defaultColor: 'orange',
    },
  },
  'jumper-mf': {
    id: 'jumper-mf',
    name: 'Jumper M–F',
    group: 'wires',
    terminals: [],
    wireTemplate: {
      connectors: { start: 'male', end: 'female' },
      defaultColor: 'yellow',
    },
  },
  'jumper-ff': {
    id: 'jumper-ff',
    name: 'Jumper F–F',
    group: 'wires',
    terminals: [],
    wireTemplate: {
      connectors: { start: 'female', end: 'female' },
      defaultColor: 'green',
    },
  },
  'esp32-devkit-v1': {
    id: 'esp32-devkit-v1',
    name: 'ESP32 DevKit V1',
    group: 'microcontrollers',
    terminals: [
      { id: 'EN', kind: 'gpio', label: 'EN', capabilities: ['digital', 'strapping'] },
      { id: 'VP', kind: 'analog_in', label: 'VP' },
      { id: 'VN', kind: 'analog_in', label: 'VN' },
      { id: 'IO34', kind: 'analog_in', label: 'D34', capabilities: ['adc'] },
      { id: 'IO35', kind: 'analog_in', label: 'D35', capabilities: ['adc'] },
      { id: 'IO32', kind: 'gpio', label: 'D32', capabilities: ['digital', 'pwm'] },
      { id: 'IO33', kind: 'gpio', label: 'D33', capabilities: ['digital', 'pwm'] },
      { id: 'IO25', kind: 'gpio', label: 'D25', capabilities: ['digital', 'pwm'] },
      { id: 'IO26', kind: 'gpio', label: 'D26', capabilities: ['digital', 'pwm'] },
      { id: 'IO27', kind: 'gpio', label: 'D27', capabilities: ['digital', 'pwm'] },
      { id: 'IO14', kind: 'gpio', label: 'D14', capabilities: ['digital', 'pwm', 'spi_sck'] },
      { id: 'IO12', kind: 'gpio', label: 'D12', capabilities: ['digital', 'pwm', 'spi_miso'] },
      { id: 'IO13', kind: 'gpio', label: 'D13', capabilities: ['digital', 'pwm', 'spi_mosi'] },
      { id: 'GND_L', kind: 'ground', label: 'GND' },
      { id: 'VIN', kind: 'power_in', voltage: 5, label: 'VIN' },
      { id: 'IO23', kind: 'gpio', label: 'D23', capabilities: ['digital', 'pwm', 'spi_mosi'] },
      { id: 'IO22', kind: 'gpio', label: 'D22', capabilities: ['digital', 'pwm', 'i2c_scl'] },
      { id: 'TX0', kind: 'uart_tx', label: 'TX0', capabilities: ['digital', 'pwm'] },
      { id: 'RX0', kind: 'uart_rx', label: 'RX0', capabilities: ['digital', 'pwm'] },
      { id: 'IO21', kind: 'gpio', label: 'D21', capabilities: ['digital', 'pwm', 'i2c_sda'] },
      { id: 'IO19', kind: 'gpio', label: 'D19', capabilities: ['digital', 'pwm', 'spi_miso'] },
      { id: 'IO18', kind: 'gpio', label: 'D18', capabilities: ['digital', 'pwm', 'spi_sck'] },
      { id: 'IO5', kind: 'gpio', label: 'D5', capabilities: ['digital', 'pwm', 'spi_ss'] },
      { id: 'TX2', kind: 'uart_tx', label: 'TX2', capabilities: ['digital', 'pwm'] },
      { id: 'RX2', kind: 'uart_rx', label: 'RX2', capabilities: ['digital', 'pwm'] },
      { id: 'IO4', kind: 'gpio', label: 'D4', capabilities: ['digital', 'pwm'] },
      { id: 'IO2', kind: 'gpio', label: 'D2', capabilities: ['digital', 'pwm'] },
      { id: 'IO15', kind: 'gpio', label: 'D15', capabilities: ['digital', 'pwm', 'spi_ss', 'strapping'] },
      { id: 'GND_R', kind: 'ground', label: 'GND' },
      { id: '3V3', kind: 'power_out', voltage: 3.3, label: '3V3' },
    ],
  },
  'arduino-uno': {
    id: 'arduino-uno',
    name: 'Arduino UNO',
    group: 'microcontrollers',
    terminals: [
      { id: '5V', kind: 'power_out', voltage: 5 },
      { id: '3V3', kind: 'power_out', voltage: 3.3 },
      { id: 'GND', kind: 'ground' },
      { id: 'D2', kind: 'gpio', capabilities: ['digital'] },
      { id: 'D3', kind: 'gpio', capabilities: ['digital', 'pwm'] },
      { id: 'D4', kind: 'gpio', capabilities: ['digital'] },
      { id: 'D5', kind: 'gpio', capabilities: ['digital', 'pwm'] },
      { id: 'D13', kind: 'gpio', capabilities: ['digital', 'pwm'] },
      { id: 'A4', kind: 'gpio', capabilities: ['i2c_sda'] },
      { id: 'A5', kind: 'gpio', capabilities: ['i2c_scl'] },
    ],
  },
  'led-5mm': {
    id: 'led-5mm',
    name: 'LED 5mm',
    group: 'passives',
    terminals: [
      { id: 'anode', kind: 'passive', label: '+' },
      { id: 'cathode', kind: 'passive', label: '-' },
    ],
  },
  'resistor-220': {
    id: 'resistor-220',
    name: 'Resistor 220Ω',
    group: 'passives',
    terminals: [
      { id: 'pin1', kind: 'passive' },
      { id: 'pin2', kind: 'passive' },
    ],
  },
  'resistor-1k': {
    id: 'resistor-1k',
    name: 'Resistor 1kΩ',
    group: 'passives',
    terminals: [
      { id: 'pin1', kind: 'passive' },
      { id: 'pin2', kind: 'passive' },
    ],
  },
  'resistor-2k': {
    id: 'resistor-2k',
    name: 'Resistor 2kΩ',
    group: 'passives',
    terminals: [
      { id: 'pin1', kind: 'passive' },
      { id: 'pin2', kind: 'passive' },
    ],
  },
  'push-button': {
    id: 'push-button',
    name: 'Push button',
    group: 'inputs',
    terminals: [
      { id: 'pin1', kind: 'passive' },
      { id: 'pin2', kind: 'passive' },
    ],
  },
  'hc-sr04': {
    id: 'hc-sr04',
    name: 'HC-SR04 ultrasonic',
    group: 'sensors',
    terminals: [
      { id: 'VCC', kind: 'power_in', voltage: 5 },
      { id: 'TRIG', kind: 'gpio', capabilities: ['digital'] },
      { id: 'ECHO', kind: 'gpio', capabilities: ['digital'] },
      { id: 'GND', kind: 'ground' },
    ],
  },
  'pir-motion-sensor-hc-sr501': {
    id: 'pir-motion-sensor-hc-sr501',
    name: 'HC-SR501 PIR motion sensor',
    group: 'sensors',
    terminals: [
      { id: 'VCC', kind: 'power_in', voltage: 5 },
      { id: 'OUT', kind: 'gpio', label: 'OUT', capabilities: ['digital'] },
      { id: 'GND', kind: 'ground' },
    ],
  },
  'bme280': {
    id: 'bme280',
    name: 'BME280',
    group: 'sensors',
    terminals: [
      { id: 'VCC', kind: 'power_in', voltage: 3.3 },
      { id: 'GND', kind: 'ground' },
      { id: 'SDA', kind: 'i2c_sda' },
      { id: 'SCL', kind: 'i2c_scl' },
    ],
  },
  'servo-sg90': {
    id: 'servo-sg90',
    name: 'SG90 servo',
    group: 'actuators',
    terminals: [
      { id: 'VCC', kind: 'power_in', voltage: 5 },
      { id: 'GND', kind: 'ground' },
      { id: 'SIG', kind: 'pwm' },
    ],
  },
  'lcd-1602-i2c': {
    id: 'lcd-1602-i2c',
    name: 'LCD 1602 (I2C)',
    group: 'displays',
    terminals: [
      { id: 'VCC', kind: 'power_in', voltage: 5 },
      { id: 'GND', kind: 'ground' },
      { id: 'SDA', kind: 'i2c_sda' },
      { id: 'SCL', kind: 'i2c_scl' },
    ],
  },
  'max7219-led-matrix': {
    id: 'max7219-led-matrix',
    name: 'MAX7219 LED matrix',
    group: 'displays',
    terminals: [
      { id: 'VCC', kind: 'power_in', voltage: 3.3 },
      { id: 'GND', kind: 'ground' },
      { id: 'DIN', kind: 'spi_mosi' },
      { id: 'CS', kind: 'spi_cs' },
      { id: 'CLK', kind: 'spi_sck' },
    ],
  },
}

/**
 * Create a placeholder definition for a component type Berry can display but
 * does not yet know how to wire.
 * @param type Unknown component type id from a hosted/backend project.
 */
function unsupportedComponentDefinition(type: ComponentTypeId): ComponentDefinition {
  return {
    id: type,
    name: `${type} (unsupported)`,
    group: 'unsupported',
    terminals: [],
  }
}

/**
 * Look up the catalog definition for a component type (pins, kinds, metadata).
 * @param type Catalog id (e.g. `esp32-devkit-v1`).
 */
export function getComponentDefinition(type: ComponentTypeId): ComponentDefinition {
  return componentCatalog[type] ?? unsupportedComponentDefinition(type)
}

/**
 * Return all component definitions in the catalog.
 * Useful for Studio trays and docs.
 */
export function listCatalog(): ComponentDefinition[] {
  return Object.values(componentCatalog)
}

/**
 * Whether a catalog id is a wire template (Connect tool only, not placed on bench).
 * @param type Catalog component id.
 */
export function isWireTemplate(type: ComponentTypeId): boolean {
  return componentCatalog[type]?.wireTemplate !== undefined
}

/**
 * Return wire template metadata for a jumper catalog id.
 * @param type Jumper wire catalog id.
 * @throws When the type is not a wire template.
 */
export function getWireTemplate(type: ComponentTypeId): WireTemplateDefinition {
  const template = componentCatalog[type]?.wireTemplate
  if (!template) {
    throw new Error(`${type} is not a wire template`)
  }
  return template
}
