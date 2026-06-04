import type { BoardId, BoardProfile } from './types'

export const boardProfiles: Record<BoardId, BoardProfile> = {
  'esp32-devkit-v1': {
    id: 'esp32-devkit-v1',
    name: 'ESP32 DevKit V1',
    operatingVoltage: 3.3,
    i2c: { sda: 'IO21', scl: 'IO22' },
    pins: [
      { id: 'EN', label: 'EN', kind: 'gpio', notes: 'Enable / strapping' },
      { id: 'VP', label: 'VP', kind: 'analog_in', notes: 'ADC1_CH6' },
      { id: 'VN', label: 'VN', kind: 'analog_in', notes: 'ADC1_CH7' },
      { id: 'IO34', label: 'GPIO34', kind: 'analog_in', gpio: 34, notes: 'Input only' },
      { id: 'IO35', label: 'GPIO35', kind: 'analog_in', gpio: 35, notes: 'Input only' },
      { id: 'IO32', label: 'GPIO32', kind: 'gpio', gpio: 32, notes: 'PWM' },
      { id: 'IO33', label: 'GPIO33', kind: 'gpio', gpio: 33, notes: 'PWM' },
      { id: 'IO25', label: 'GPIO25', kind: 'gpio', gpio: 25, notes: 'PWM' },
      { id: 'IO26', label: 'GPIO26', kind: 'gpio', gpio: 26, notes: 'PWM' },
      { id: 'IO27', label: 'GPIO27', kind: 'gpio', gpio: 27, notes: 'PWM' },
      { id: 'IO14', label: 'GPIO14', kind: 'gpio', gpio: 14, notes: 'VSPI SCK' },
      { id: 'IO12', label: 'GPIO12', kind: 'gpio', gpio: 12, notes: 'VSPI MISO' },
      { id: 'IO13', label: 'GPIO13', kind: 'gpio', gpio: 13, notes: 'VSPI MOSI / PWM' },
      { id: 'GND_L', label: 'GND', kind: 'ground' },
      { id: 'VIN', label: 'VIN', kind: 'power_in' },
      { id: 'IO23', label: 'GPIO23', kind: 'gpio', gpio: 23, notes: 'HSPI MOSI' },
      { id: 'IO22', label: 'GPIO22', kind: 'gpio', gpio: 22, notes: 'I2C SCL' },
      { id: 'TX0', label: 'GPIO1', kind: 'uart_tx', gpio: 1 },
      { id: 'RX0', label: 'GPIO3', kind: 'uart_rx', gpio: 3 },
      { id: 'IO21', label: 'GPIO21', kind: 'gpio', gpio: 21, notes: 'I2C SDA' },
      { id: 'IO19', label: 'GPIO19', kind: 'gpio', gpio: 19, notes: 'HSPI MISO' },
      { id: 'IO18', label: 'GPIO18', kind: 'gpio', gpio: 18, notes: 'HSPI SCK' },
      { id: 'IO5', label: 'GPIO5', kind: 'gpio', gpio: 5, notes: 'HSPI SS' },
      { id: 'TX2', label: 'GPIO17', kind: 'uart_tx', gpio: 17 },
      { id: 'RX2', label: 'GPIO16', kind: 'uart_rx', gpio: 16 },
      { id: 'IO4', label: 'GPIO4', kind: 'gpio', gpio: 4 },
      { id: 'IO2', label: 'GPIO2', kind: 'gpio', gpio: 2, notes: 'Strapping' },
      { id: 'IO15', label: 'GPIO15', kind: 'gpio', gpio: 15, notes: 'VSPI SS / strapping' },
      { id: 'GND_R', label: 'GND', kind: 'ground' },
      { id: '3V3', label: '3.3V', kind: 'power_out' },
    ],
  },
  'arduino-uno': {
    id: 'arduino-uno',
    name: 'Arduino UNO',
    operatingVoltage: 5,
    i2c: { sda: 'A4', scl: 'A5' },
    pins: [
      { id: 'D13', label: 'D13', kind: 'gpio', gpio: 13 },
      { id: 'A4', label: 'A4', kind: 'gpio', gpio: 18, notes: 'I2C SDA' },
      { id: 'A5', label: 'A5', kind: 'gpio', gpio: 19, notes: 'I2C SCL' },
      { id: '5V', label: '5V', kind: 'power_out' },
      { id: '3V3', label: '3.3V', kind: 'power_out' },
      { id: 'GND', label: 'GND', kind: 'ground' },
    ],
  },
}

/**
 * Look up MCU board profile (pin map, voltage, default I2C pins).
 * Used when parsing projects and for future codegen.
 * @param board Board id from `project.board`.
 */
export function getBoardProfile(board: BoardId): BoardProfile {
  return boardProfiles[board]
}
