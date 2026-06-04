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
      { id: 'VIN', kind: 'power_in', voltage: 5, label: 'VIN' },
      { id: '3V3', kind: 'power_out', voltage: 3.3, label: '3V3' },
      { id: 'GND_L', kind: 'ground', label: 'GND' },
      { id: 'GND_R', kind: 'ground', label: 'GND' },
      { id: 'IO4', kind: 'gpio', capabilities: ['digital'] },
      { id: 'IO13', kind: 'gpio', capabilities: ['digital', 'pwm'] },
      { id: 'IO18', kind: 'gpio', capabilities: ['digital', 'pwm'] },
      { id: 'IO21', kind: 'gpio', capabilities: ['digital', 'i2c_sda'] },
      { id: 'IO22', kind: 'gpio', capabilities: ['digital', 'i2c_scl'] },
      { id: 'RX2', kind: 'uart_rx', capabilities: ['digital'] },
      { id: 'TX2', kind: 'uart_tx', capabilities: ['digital'] },
      { id: 'EN', kind: 'gpio', capabilities: ['digital', 'strapping'] },
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
}

/**
 * Look up the catalog definition for a component type (pins, kinds, metadata).
 * @param type Catalog id (e.g. `esp32-devkit-v1`).
 */
export function getComponentDefinition(type: ComponentTypeId): ComponentDefinition {
  return componentCatalog[type]
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
  return componentCatalog[type].wireTemplate !== undefined
}

/**
 * Return wire template metadata for a jumper catalog id.
 * @param type Jumper wire catalog id.
 * @throws When the type is not a wire template.
 */
export function getWireTemplate(type: ComponentTypeId): WireTemplateDefinition {
  const template = componentCatalog[type].wireTemplate
  if (!template) {
    throw new Error(`${type} is not a wire template`)
  }
  return template
}
