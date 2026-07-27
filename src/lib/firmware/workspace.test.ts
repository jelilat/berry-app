import { describe, expect, it } from 'vitest'
import {
  additionalFirmwareFiles,
  createFirmwareFileContent,
  firmwareParentFolders,
  inferFirmwareFolders,
  isSafeFirmwareBuildPath,
  normalizeFirmwareSourcePath,
  validateFirmwareSourcePath,
} from './workspace'

describe('firmware workspace paths', () => {
  it('normalizes paths relative to src', () => {
    expect(normalizeFirmwareSourcePath('drivers/sensor.cpp')).toBe('src/drivers/sensor.cpp')
    expect(normalizeFirmwareSourcePath('src/include')).toBe('src/include')
  })

  it('rejects traversal and extensionless files', () => {
    expect(validateFirmwareSourcePath('../secret.cpp', 'file').ok).toBe(false)
    expect(validateFirmwareSourcePath('drivers/sensor', 'file').ok).toBe(false)
    expect(isSafeFirmwareBuildPath('/src/main.cpp')).toBe(false)
  })

  it('infers and lists nested parent folders', () => {
    expect(firmwareParentFolders('src/drivers/i2c/sensor.cpp')).toEqual([
      'src/drivers',
      'src/drivers/i2c',
    ])
    expect(
      inferFirmwareFolders({ 'src/drivers/i2c/sensor.cpp': '', 'src/main.cpp': '' }),
    ).toEqual(['src/drivers', 'src/drivers/i2c'])
  })

  it('creates useful starter content and separates additional files', () => {
    expect(createFirmwareFileContent('src/sensor.h')).toContain('#pragma once')
    expect(
      additionalFirmwareFiles({
        'src/main.cpp': 'main',
        'src/sensor.cpp': 'sensor',
        'platformio.ini': 'ini',
      }),
    ).toEqual({ 'src/sensor.cpp': 'sensor' })
  })
})
