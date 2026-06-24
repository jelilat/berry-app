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
  'pushbutton-6mm': {
    id: 'pushbutton-6mm',
    name: 'Pushbutton 6mm',
    group: 'inputs',
    terminals: [
      { id: 'pin1', kind: 'passive', label: '1' },
      { id: 'pin2', kind: 'passive', label: '2' },
      { id: 'pin3', kind: 'passive', label: '3' },
      { id: 'pin4', kind: 'passive', label: '4' },
    ],
  },
  'membrane-keypad-4x4': {
    id: 'membrane-keypad-4x4',
    name: '4x4 membrane keypad',
    group: 'inputs',
    terminals: [
      { id: 'R1', kind: 'gpio', capabilities: ['digital'] },
      { id: 'R2', kind: 'gpio', capabilities: ['digital'] },
      { id: 'R3', kind: 'gpio', capabilities: ['digital'] },
      { id: 'R4', kind: 'gpio', capabilities: ['digital'] },
      { id: 'C1', kind: 'gpio', capabilities: ['digital'] },
      { id: 'C2', kind: 'gpio', capabilities: ['digital'] },
      { id: 'C3', kind: 'gpio', capabilities: ['digital'] },
      { id: 'C4', kind: 'gpio', capabilities: ['digital'] },
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
  dht22: {
    id: 'dht22',
    name: 'DHT22 temperature/humidity',
    group: 'sensors',
    terminals: [
      { id: 'VCC', kind: 'power_in', voltage: 5 },
      { id: 'SDA', kind: 'gpio', label: 'DATA', capabilities: ['digital'] },
      { id: 'NC', kind: 'passive', label: 'NC' },
      { id: 'GND', kind: 'ground' },
    ],
  },
  ds18b20: {
    id: 'ds18b20',
    name: 'DS18B20 temperature probe',
    group: 'sensors',
    terminals: [
      { id: 'GND', kind: 'ground' },
      { id: 'DQ', kind: 'gpio', label: 'DQ', capabilities: ['digital', 'one_wire'] },
      { id: 'VDD', kind: 'power_in', voltage: 5, label: 'VDD' },
    ],
  },
  'photoresistor-sensor': {
    id: 'photoresistor-sensor',
    name: 'Photoresistor sensor',
    group: 'sensors',
    terminals: [
      { id: 'VCC', kind: 'power_in', voltage: 5 },
      { id: 'GND', kind: 'ground' },
      { id: 'DO', kind: 'gpio', capabilities: ['digital'] },
      { id: 'AO', kind: 'analog_in', capabilities: ['adc'] },
    ],
  },
  'ntc-temperature-sensor': {
    id: 'ntc-temperature-sensor',
    name: 'NTC temperature sensor',
    group: 'sensors',
    terminals: [
      { id: 'GND', kind: 'ground' },
      { id: 'VCC', kind: 'power_in', voltage: 5 },
      { id: 'OUT', kind: 'analog_in', capabilities: ['adc'] },
    ],
  },
  'mq2-gas-sensor': {
    id: 'mq2-gas-sensor',
    name: 'MQ-2 gas sensor',
    group: 'sensors',
    terminals: [
      { id: 'AO', kind: 'analog_in', label: 'AO', capabilities: ['adc'] },
      { id: 'DO', kind: 'gpio', label: 'DO', capabilities: ['digital'] },
      { id: 'GND', kind: 'ground' },
      { id: 'VCC', kind: 'power_in', voltage: 5 },
    ],
  },
  'small-sound-sensor': {
    id: 'small-sound-sensor',
    name: 'Small sound sensor',
    group: 'sensors',
    terminals: [
      { id: 'AO', kind: 'analog_in', label: 'AO', capabilities: ['adc'] },
      { id: 'GND', kind: 'ground' },
      { id: 'VCC', kind: 'power_in', voltage: 5 },
      { id: 'DO', kind: 'gpio', label: 'DO', capabilities: ['digital'] },
    ],
  },
  'big-sound-sensor': {
    id: 'big-sound-sensor',
    name: 'Big sound sensor',
    group: 'sensors',
    terminals: [
      { id: 'AO', kind: 'analog_in', label: 'AO', capabilities: ['adc'] },
      { id: 'GND', kind: 'ground' },
      { id: 'VCC', kind: 'power_in', voltage: 5 },
      { id: 'DO', kind: 'gpio', label: 'DO', capabilities: ['digital'] },
    ],
  },
  'flame-sensor': {
    id: 'flame-sensor',
    name: 'Flame sensor',
    group: 'sensors',
    terminals: [
      { id: 'VCC', kind: 'power_in', voltage: 5 },
      { id: 'GND', kind: 'ground' },
      { id: 'DO', kind: 'gpio', label: 'DO', capabilities: ['digital'] },
      { id: 'AO', kind: 'analog_in', label: 'AO', capabilities: ['adc'] },
    ],
  },
  'heart-beat-sensor': {
    id: 'heart-beat-sensor',
    name: 'Heartbeat sensor',
    group: 'sensors',
    terminals: [
      { id: 'GND', kind: 'ground' },
      { id: 'VCC', kind: 'power_in', voltage: 5 },
      { id: 'OUT', kind: 'gpio', capabilities: ['digital'] },
    ],
  },
  'tilt-switch': {
    id: 'tilt-switch',
    name: 'Tilt switch module',
    group: 'sensors',
    terminals: [
      { id: 'GND', kind: 'ground' },
      { id: 'VCC', kind: 'power_in', voltage: 5 },
      { id: 'OUT', kind: 'gpio', capabilities: ['digital'] },
    ],
  },
  mpu6050: {
    id: 'mpu6050',
    name: 'MPU6050 accelerometer/gyro',
    group: 'sensors',
    terminals: [
      { id: 'VCC', kind: 'power_in', voltage: 3.3 },
      { id: 'GND', kind: 'ground' },
      { id: 'SCL', kind: 'i2c_scl' },
      { id: 'SDA', kind: 'i2c_sda' },
      { id: 'XDA', kind: 'i2c_sda' },
      { id: 'XCL', kind: 'i2c_scl' },
      { id: 'AD0', kind: 'gpio', capabilities: ['digital'] },
      { id: 'INT', kind: 'gpio', capabilities: ['digital', 'interrupt'] },
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
  'analog-joystick': {
    id: 'analog-joystick',
    name: 'Analog joystick',
    group: 'inputs',
    terminals: [
      { id: 'VCC', kind: 'power_in', voltage: 5 },
      { id: 'VERT', kind: 'analog_in', capabilities: ['adc'] },
      { id: 'HORZ', kind: 'analog_in', capabilities: ['adc'] },
      { id: 'SEL', kind: 'gpio', capabilities: ['digital'] },
      { id: 'GND', kind: 'ground' },
    ],
  },
  'rotary-encoder-ky-040': {
    id: 'rotary-encoder-ky-040',
    name: 'KY-040 rotary encoder',
    group: 'inputs',
    terminals: [
      { id: 'CLK', kind: 'gpio', capabilities: ['digital', 'interrupt'] },
      { id: 'DT', kind: 'gpio', capabilities: ['digital', 'interrupt'] },
      { id: 'SW', kind: 'gpio', capabilities: ['digital'] },
      { id: '+', kind: 'power_in', voltage: 5, label: '+' },
      { id: 'GND', kind: 'ground' },
    ],
  },
  'dip-switch-8': {
    id: 'dip-switch-8',
    name: '8-position DIP switch',
    group: 'inputs',
    terminals: [
      { id: '1a', kind: 'passive' },
      { id: '2a', kind: 'passive' },
      { id: '3a', kind: 'passive' },
      { id: '4a', kind: 'passive' },
      { id: '5a', kind: 'passive' },
      { id: '6a', kind: 'passive' },
      { id: '7a', kind: 'passive' },
      { id: '8a', kind: 'passive' },
      { id: '1b', kind: 'passive' },
      { id: '2b', kind: 'passive' },
      { id: '3b', kind: 'passive' },
      { id: '4b', kind: 'passive' },
      { id: '5b', kind: 'passive' },
      { id: '6b', kind: 'passive' },
      { id: '7b', kind: 'passive' },
      { id: '8b', kind: 'passive' },
    ],
  },
  'slide-switch': {
    id: 'slide-switch',
    name: 'Slide switch',
    group: 'inputs',
    terminals: [
      { id: '1', kind: 'passive' },
      { id: '2', kind: 'passive' },
      { id: '3', kind: 'passive' },
    ],
  },
  potentiometer: {
    id: 'potentiometer',
    name: 'Potentiometer',
    group: 'inputs',
    terminals: [
      { id: 'GND', kind: 'ground' },
      { id: 'SIG', kind: 'analog_in', capabilities: ['adc'] },
      { id: 'VCC', kind: 'power_in', voltage: 5 },
    ],
  },
  'slide-potentiometer': {
    id: 'slide-potentiometer',
    name: 'Slide potentiometer',
    group: 'inputs',
    terminals: [
      { id: 'VCC', kind: 'power_in', voltage: 5 },
      { id: 'SIG', kind: 'analog_in', capabilities: ['adc'] },
      { id: 'GND', kind: 'ground' },
    ],
  },
  'ir-receiver': {
    id: 'ir-receiver',
    name: 'IR receiver',
    group: 'inputs',
    terminals: [
      { id: 'GND', kind: 'ground' },
      { id: 'VCC', kind: 'power_in', voltage: 5 },
      { id: 'DAT', kind: 'gpio', label: 'DAT', capabilities: ['digital'] },
    ],
  },
  'ir-remote': {
    id: 'ir-remote',
    name: 'IR remote',
    group: 'inputs',
    terminals: [],
  },
  'rotary-dialer': {
    id: 'rotary-dialer',
    name: 'Rotary dialer',
    group: 'inputs',
    terminals: [
      { id: 'GND', kind: 'ground' },
      { id: 'DIAL', kind: 'gpio', capabilities: ['digital'] },
      { id: 'PULSE', kind: 'gpio', capabilities: ['digital'] },
    ],
  },
  'relay-module': {
    id: 'relay-module',
    name: 'Relay module',
    group: 'actuators',
    terminals: [
      { id: 'VCC', kind: 'power_in', voltage: 5 },
      { id: 'GND', kind: 'ground' },
      { id: 'IN', kind: 'gpio', capabilities: ['digital'] },
      { id: 'COM', kind: 'passive' },
      { id: 'NO', kind: 'passive' },
      { id: 'NC', kind: 'passive' },
    ],
  },
  'ks2e-relay': {
    id: 'ks2e-relay',
    name: 'KS2E relay',
    group: 'actuators',
    terminals: [
      { id: 'NO2', kind: 'passive' },
      { id: 'NC2', kind: 'passive' },
      { id: 'P2', kind: 'passive' },
      { id: 'COIL2', kind: 'ground' },
      { id: 'NO1', kind: 'passive' },
      { id: 'NC1', kind: 'passive' },
      { id: 'P1', kind: 'passive' },
      { id: 'COIL1', kind: 'power_in', voltage: 5 },
    ],
  },
  'stepper-motor': {
    id: 'stepper-motor',
    name: 'Stepper motor',
    group: 'actuators',
    terminals: [
      { id: 'A-', kind: 'passive' },
      { id: 'A+', kind: 'passive' },
      { id: 'B+', kind: 'passive' },
      { id: 'B-', kind: 'passive' },
    ],
  },
  'a4988-stepper-driver': {
    id: 'a4988-stepper-driver',
    name: 'A4988 stepper driver',
    group: 'actuators',
    terminals: [
      { id: 'VMOT', kind: 'power_in', voltage: 12 },
      { id: 'GND_MOT', kind: 'ground', label: 'GND' },
      { id: '2B', kind: 'passive' },
      { id: '2A', kind: 'passive' },
      { id: '1A', kind: 'passive' },
      { id: '1B', kind: 'passive' },
      { id: 'VDD', kind: 'power_in', voltage: 5 },
      { id: 'GND_LOGIC', kind: 'ground', label: 'GND' },
      { id: 'STEP', kind: 'gpio', capabilities: ['digital'] },
      { id: 'DIR', kind: 'gpio', capabilities: ['digital'] },
      { id: 'ENABLE', kind: 'gpio', capabilities: ['digital'] },
      { id: 'MS1', kind: 'gpio', capabilities: ['digital'] },
      { id: 'MS2', kind: 'gpio', capabilities: ['digital'] },
      { id: 'MS3', kind: 'gpio', capabilities: ['digital'] },
      { id: 'RESET', kind: 'gpio', capabilities: ['digital'] },
      { id: 'SLEEP', kind: 'gpio', capabilities: ['digital'] },
    ],
  },
  'biaxial-stepper': {
    id: 'biaxial-stepper',
    name: 'Biaxial stepper',
    group: 'actuators',
    terminals: [
      { id: 'A1-', kind: 'passive' },
      { id: 'A1+', kind: 'passive' },
      { id: 'B1+', kind: 'passive' },
      { id: 'B1-', kind: 'passive' },
      { id: 'A2-', kind: 'passive' },
      { id: 'A2+', kind: 'passive' },
      { id: 'B2+', kind: 'passive' },
      { id: 'B2-', kind: 'passive' },
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
  'lcd-2004-i2c': {
    id: 'lcd-2004-i2c',
    name: 'LCD 2004 (I2C)',
    group: 'displays',
    terminals: [
      { id: 'VCC', kind: 'power_in', voltage: 5 },
      { id: 'GND', kind: 'ground' },
      { id: 'SDA', kind: 'i2c_sda' },
      { id: 'SCL', kind: 'i2c_scl' },
    ],
  },
  'ssd1306-oled': {
    id: 'ssd1306-oled',
    name: 'SSD1306 OLED',
    group: 'displays',
    terminals: [
      { id: 'SDA', kind: 'i2c_sda', label: 'DATA' },
      { id: 'SCL', kind: 'i2c_scl', label: 'CLK' },
      { id: 'VCC', kind: 'power_in', voltage: 3.3 },
      { id: 'GND', kind: 'ground' },
    ],
  },
  'grove-oled-sh1107': {
    id: 'grove-oled-sh1107',
    name: 'Grove OLED SH1107',
    group: 'displays',
    terminals: [
      { id: 'GND', kind: 'ground' },
      { id: 'VCC', kind: 'power_in', voltage: 3.3 },
      { id: 'SCL', kind: 'i2c_scl' },
      { id: 'SDA', kind: 'i2c_sda' },
    ],
  },
  'ili9341-tft': {
    id: 'ili9341-tft',
    name: 'ILI9341 TFT display',
    group: 'displays',
    terminals: [
      { id: 'VCC', kind: 'power_in', voltage: 3.3 },
      { id: 'GND', kind: 'ground' },
      { id: 'CS', kind: 'spi_cs' },
      { id: 'RESET', kind: 'gpio', capabilities: ['digital'] },
      { id: 'D/C', kind: 'gpio', capabilities: ['digital'] },
      { id: 'SDI', kind: 'spi_mosi', label: 'MOSI' },
      { id: 'SCK', kind: 'spi_sck' },
      { id: 'LED', kind: 'power_in', voltage: 3.3 },
      { id: 'SDO', kind: 'spi_miso', label: 'MISO' },
    ],
  },
  'nokia-5110': {
    id: 'nokia-5110',
    name: 'Nokia 5110 LCD',
    group: 'displays',
    terminals: [
      { id: 'RST', kind: 'gpio', capabilities: ['digital'] },
      { id: 'CE', kind: 'spi_cs' },
      { id: 'DC', kind: 'gpio', capabilities: ['digital'] },
      { id: 'DIN', kind: 'spi_mosi' },
      { id: 'CLK', kind: 'spi_sck' },
      { id: 'VCC', kind: 'power_in', voltage: 3.3 },
      { id: 'LIGHT', kind: 'power_in', voltage: 3.3 },
      { id: 'GND', kind: 'ground' },
    ],
  },
  'tm1637-7segment': {
    id: 'tm1637-7segment',
    name: 'TM1637 7-segment display',
    group: 'displays',
    terminals: [
      { id: 'CLK', kind: 'gpio', capabilities: ['digital'] },
      { id: 'DIO', kind: 'gpio', capabilities: ['digital'] },
      { id: 'VCC', kind: 'power_in', voltage: 5 },
      { id: 'GND', kind: 'ground' },
    ],
  },
  'single-7segment': {
    id: 'single-7segment',
    name: 'Single 7-segment display',
    group: 'displays',
    terminals: [
      { id: 'A', kind: 'passive' },
      { id: 'B', kind: 'passive' },
      { id: 'C', kind: 'passive' },
      { id: 'D', kind: 'passive' },
      { id: 'E', kind: 'passive' },
      { id: 'F', kind: 'passive' },
      { id: 'G', kind: 'passive' },
      { id: 'DP', kind: 'passive' },
      { id: 'COM', kind: 'passive' },
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
  'led-bar-graph': {
    id: 'led-bar-graph',
    name: 'LED bar graph',
    group: 'displays',
    terminals: [
      { id: 'A1', kind: 'passive' },
      { id: 'A2', kind: 'passive' },
      { id: 'A3', kind: 'passive' },
      { id: 'A4', kind: 'passive' },
      { id: 'A5', kind: 'passive' },
      { id: 'A6', kind: 'passive' },
      { id: 'A7', kind: 'passive' },
      { id: 'A8', kind: 'passive' },
      { id: 'A9', kind: 'passive' },
      { id: 'A10', kind: 'passive' },
      { id: 'C1', kind: 'passive' },
      { id: 'C2', kind: 'passive' },
      { id: 'C3', kind: 'passive' },
      { id: 'C4', kind: 'passive' },
      { id: 'C5', kind: 'passive' },
      { id: 'C6', kind: 'passive' },
      { id: 'C7', kind: 'passive' },
      { id: 'C8', kind: 'passive' },
      { id: 'C9', kind: 'passive' },
      { id: 'C10', kind: 'passive' },
    ],
  },
  neopixel: {
    id: 'neopixel',
    name: 'NeoPixel',
    group: 'displays',
    terminals: [
      { id: 'VDD', kind: 'power_in', voltage: 5 },
      { id: 'DIN', kind: 'gpio', capabilities: ['digital'] },
      { id: 'GND', kind: 'ground' },
      { id: 'DOUT', kind: 'gpio', capabilities: ['digital'] },
    ],
  },
  'neopixel-matrix': {
    id: 'neopixel-matrix',
    name: 'NeoPixel matrix',
    group: 'displays',
    terminals: [
      { id: 'VCC', kind: 'power_in', voltage: 5 },
      { id: 'DIN', kind: 'gpio', capabilities: ['digital'] },
      { id: 'GND', kind: 'ground' },
      { id: 'DOUT', kind: 'gpio', capabilities: ['digital'] },
    ],
  },
  'led-ring': {
    id: 'led-ring',
    name: 'NeoPixel ring',
    group: 'displays',
    terminals: [
      { id: 'VCC', kind: 'power_in', voltage: 5 },
      { id: 'DIN', kind: 'gpio', capabilities: ['digital'] },
      { id: 'GND', kind: 'ground' },
      { id: 'DOUT', kind: 'gpio', capabilities: ['digital'] },
    ],
  },
  'led-strip': {
    id: 'led-strip',
    name: 'NeoPixel LED strip',
    group: 'displays',
    terminals: [
      { id: 'VCC', kind: 'power_in', voltage: 5 },
      { id: 'DIN', kind: 'gpio', capabilities: ['digital'] },
      { id: 'GND', kind: 'ground' },
      { id: 'DOUT', kind: 'gpio', capabilities: ['digital'] },
    ],
  },
  'rgb-led': {
    id: 'rgb-led',
    name: 'RGB LED',
    group: 'displays',
    terminals: [
      { id: 'R', kind: 'passive' },
      { id: 'COM', kind: 'passive' },
      { id: 'G', kind: 'passive' },
      { id: 'B', kind: 'passive' },
    ],
  },
  buzzer: {
    id: 'buzzer',
    name: 'Buzzer',
    group: 'actuators',
    terminals: [
      { id: '1', kind: 'passive' },
      { id: '2', kind: 'passive' },
    ],
  },
  'microsd-card': {
    id: 'microsd-card',
    name: 'MicroSD card',
    group: 'displays',
    terminals: [
      { id: 'CD', kind: 'gpio', capabilities: ['digital'] },
      { id: 'DO', kind: 'spi_miso', label: 'MISO' },
      { id: 'GND', kind: 'ground' },
      { id: 'SCK', kind: 'spi_sck' },
      { id: 'VCC', kind: 'power_in', voltage: 3.3 },
      { id: 'DI', kind: 'spi_mosi', label: 'MOSI' },
      { id: 'CS', kind: 'spi_cs' },
    ],
  },
  'ds1307-rtc': {
    id: 'ds1307-rtc',
    name: 'DS1307 RTC',
    group: 'displays',
    terminals: [
      { id: 'GND', kind: 'ground' },
      { id: '5V', kind: 'power_in', voltage: 5 },
      { id: 'SDA', kind: 'i2c_sda' },
      { id: 'SCL', kind: 'i2c_scl' },
      { id: 'SQW', kind: 'gpio', capabilities: ['digital'] },
    ],
  },
  'hx711-load-cell-amp': {
    id: 'hx711-load-cell-amp',
    name: 'HX711 load cell amp',
    group: 'sensors',
    terminals: [
      { id: 'VCC', kind: 'power_in', voltage: 5 },
      { id: 'GND', kind: 'ground' },
      { id: 'DT', kind: 'gpio', capabilities: ['digital'] },
      { id: 'SCK', kind: 'gpio', capabilities: ['digital'] },
      { id: 'E+', kind: 'power_out', voltage: 5 },
      { id: 'E-', kind: 'ground' },
      { id: 'A-', kind: 'analog_in' },
      { id: 'A+', kind: 'analog_in' },
      { id: 'B-', kind: 'analog_in' },
      { id: 'B+', kind: 'analog_in' },
    ],
  },
  '74hc595-shift-register': {
    id: '74hc595-shift-register',
    name: '74HC595 shift register',
    group: 'passives',
    terminals: [
      { id: 'VCC', kind: 'power_in', voltage: 5 },
      { id: 'GND', kind: 'ground' },
      { id: 'DS', kind: 'gpio', capabilities: ['digital'] },
      { id: 'SHCP', kind: 'gpio', capabilities: ['digital'] },
      { id: 'STCP', kind: 'gpio', capabilities: ['digital'] },
      { id: 'OE', kind: 'gpio', capabilities: ['digital'] },
      { id: 'MR', kind: 'gpio', capabilities: ['digital'] },
      { id: 'Q0', kind: 'gpio', capabilities: ['digital'] },
      { id: 'Q1', kind: 'gpio', capabilities: ['digital'] },
      { id: 'Q2', kind: 'gpio', capabilities: ['digital'] },
      { id: 'Q3', kind: 'gpio', capabilities: ['digital'] },
      { id: 'Q4', kind: 'gpio', capabilities: ['digital'] },
      { id: 'Q5', kind: 'gpio', capabilities: ['digital'] },
      { id: 'Q6', kind: 'gpio', capabilities: ['digital'] },
      { id: 'Q7', kind: 'gpio', capabilities: ['digital'] },
      { id: 'Q7S', kind: 'gpio', capabilities: ['digital'] },
    ],
  },
  '74hc165-shift-register': {
    id: '74hc165-shift-register',
    name: '74HC165 shift register',
    group: 'passives',
    terminals: [
      { id: 'VCC', kind: 'power_in', voltage: 5 },
      { id: 'GND', kind: 'ground' },
      { id: 'DS', kind: 'gpio', capabilities: ['digital'] },
      { id: 'SHCP', kind: 'gpio', capabilities: ['digital'] },
      { id: 'STCP', kind: 'gpio', capabilities: ['digital'] },
      { id: 'CE', kind: 'gpio', capabilities: ['digital'] },
      { id: 'Q7', kind: 'gpio', capabilities: ['digital'] },
      { id: 'Q7N', kind: 'gpio', capabilities: ['digital'] },
      { id: 'D0', kind: 'gpio', capabilities: ['digital'] },
      { id: 'D1', kind: 'gpio', capabilities: ['digital'] },
      { id: 'D2', kind: 'gpio', capabilities: ['digital'] },
      { id: 'D3', kind: 'gpio', capabilities: ['digital'] },
      { id: 'D4', kind: 'gpio', capabilities: ['digital'] },
      { id: 'D5', kind: 'gpio', capabilities: ['digital'] },
      { id: 'D6', kind: 'gpio', capabilities: ['digital'] },
      { id: 'D7', kind: 'gpio', capabilities: ['digital'] },
    ],
  },
  nlsf595: {
    id: 'nlsf595',
    name: 'NLSF595 shift register',
    group: 'passives',
    terminals: [
      { id: 'VCC', kind: 'power_in', voltage: 5 },
      { id: 'GND', kind: 'ground' },
      { id: 'DS', kind: 'gpio', capabilities: ['digital'] },
      { id: 'SHCP', kind: 'gpio', capabilities: ['digital'] },
      { id: 'STCP', kind: 'gpio', capabilities: ['digital'] },
      { id: 'OE', kind: 'gpio', capabilities: ['digital'] },
      { id: 'MR', kind: 'gpio', capabilities: ['digital'] },
      { id: 'Q0', kind: 'gpio', capabilities: ['digital'] },
      { id: 'Q1', kind: 'gpio', capabilities: ['digital'] },
      { id: 'Q2', kind: 'gpio', capabilities: ['digital'] },
      { id: 'Q3', kind: 'gpio', capabilities: ['digital'] },
      { id: 'Q4', kind: 'gpio', capabilities: ['digital'] },
      { id: 'Q5', kind: 'gpio', capabilities: ['digital'] },
      { id: 'Q6', kind: 'gpio', capabilities: ['digital'] },
      { id: 'Q7', kind: 'gpio', capabilities: ['digital'] },
      { id: 'Q7S', kind: 'gpio', capabilities: ['digital'] },
    ],
  },
  'clock-generator': {
    id: 'clock-generator',
    name: 'Clock generator',
    group: 'passives',
    terminals: [
      { id: 'VCC', kind: 'power_in', voltage: 5 },
      { id: 'GND', kind: 'ground' },
      { id: 'CLK', kind: 'gpio', capabilities: ['digital', 'clock'] },
    ],
  },
  'logic-analyzer': {
    id: 'logic-analyzer',
    name: 'Logic analyzer',
    group: 'passives',
    terminals: [
      { id: 'GND', kind: 'ground' },
      { id: 'D0', kind: 'gpio', capabilities: ['digital'] },
      { id: 'D1', kind: 'gpio', capabilities: ['digital'] },
      { id: 'D2', kind: 'gpio', capabilities: ['digital'] },
      { id: 'D3', kind: 'gpio', capabilities: ['digital'] },
      { id: 'D4', kind: 'gpio', capabilities: ['digital'] },
      { id: 'D5', kind: 'gpio', capabilities: ['digital'] },
      { id: 'D6', kind: 'gpio', capabilities: ['digital'] },
      { id: 'D7', kind: 'gpio', capabilities: ['digital'] },
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
