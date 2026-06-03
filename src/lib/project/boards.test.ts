import { describe, expect, it } from 'vitest'
import { getBoardProfile } from './boards'

describe('board profiles', () => {
  it('getBoardProfile for esp32-devkit-v1', () => {
    const profile = getBoardProfile('esp32-devkit-v1')
    expect(profile.id).toBe('esp32-devkit-v1')
    expect(profile.operatingVoltage).toBe(3.3)
    expect(profile.i2c).toEqual({ sda: 'IO21', scl: 'IO22' })
  })

  it('getBoardProfile for arduino-uno', () => {
    const profile = getBoardProfile('arduino-uno')
    expect(profile.id).toBe('arduino-uno')
    expect(profile.operatingVoltage).toBe(5)
    expect(profile.i2c).toEqual({ sda: 'A4', scl: 'A5' })
  })
})
