import type { BoardId, BoardProfile } from './types'

export const boardProfiles: Record<BoardId, BoardProfile> = {
  'esp32-devkit-v1': {
    id: 'esp32-devkit-v1',
    name: 'ESP32 DevKit V1',
    operatingVoltage: 3.3,
    i2c: { sda: 'IO21', scl: 'IO22' },
    pins: [
      { id: 'IO4', label: 'GPIO4', kind: 'gpio', gpio: 4 },
      { id: 'IO13', label: 'GPIO13', kind: 'gpio', gpio: 13, notes: 'PWM' },
      { id: 'IO18', label: 'GPIO18', kind: 'gpio', gpio: 18, notes: 'PWM' },
      { id: 'IO21', label: 'GPIO21', kind: 'gpio', gpio: 21, notes: 'I2C SDA' },
      { id: 'IO22', label: 'GPIO22', kind: 'gpio', gpio: 22, notes: 'I2C SCL' },
      { id: 'RX2', label: 'GPIO16', kind: 'uart_rx', gpio: 16 },
      { id: 'TX2', label: 'GPIO17', kind: 'uart_tx', gpio: 17 },
      { id: '3V3', label: '3.3V', kind: 'power_out' },
      { id: 'VIN', label: 'VIN', kind: 'power_in' },
      { id: 'GND_L', label: 'GND', kind: 'ground' },
      { id: 'GND_R', label: 'GND', kind: 'ground' },
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
