import { describe, expect, it } from 'vitest'
import {
  assertWireConnectorsMatchEndpoints,
  endpointConnectorGender,
  orientWireConnectorsForEndpoints,
  wireConnectorsFitEndpoints,
} from './connection-gender'

describe('endpointConnectorGender', () => {
  it('treats breadboard holes as female', () => {
    expect(
      endpointConnectorGender({
        breadboardId: 'bb_1',
        site: { kind: 'hole', block: 'top', row: 'a', column: 1 },
      }),
    ).toBe('female')
  })

  it('treats part pins as male', () => {
    expect(
      endpointConnectorGender({ componentId: 'esp32_1', terminalId: 'IO13' }),
    ).toBe('male')
  })
})

describe('wireConnectorsFitEndpoints', () => {
  const hole = {
    breadboardId: 'bb_1',
    site: { kind: 'hole' as const, block: 'top' as const, row: 'a' as const, column: 1 },
  }
  const pin = { componentId: 'esp32_1', terminalId: 'IO13' }

  it('accepts M–M between two breadboard holes', () => {
    expect(
      wireConnectorsFitEndpoints(hole, hole, { start: 'male', end: 'male' }),
    ).toBe(true)
  })

  it('accepts F–F between two pins', () => {
    expect(
      wireConnectorsFitEndpoints(pin, pin, { start: 'female', end: 'female' }),
    ).toBe(true)
  })

  it('accepts M–F between breadboard and pin in either drag order', () => {
    const mf = { start: 'male', end: 'female' }
    expect(wireConnectorsFitEndpoints(hole, pin, mf)).toBe(true)
    expect(wireConnectorsFitEndpoints(pin, hole, mf)).toBe(true)
  })

  it('rejects M–M between two pins', () => {
    expect(
      wireConnectorsFitEndpoints(pin, pin, { start: 'male', end: 'male' }),
    ).toBe(false)
  })

  it('rejects F–F between two breadboard holes', () => {
    expect(
      wireConnectorsFitEndpoints(hole, hole, { start: 'female', end: 'female' }),
    ).toBe(false)
  })
})

describe('orientWireConnectorsForEndpoints', () => {
  const hole = {
    breadboardId: 'bb_1',
    site: { kind: 'hole' as const, block: 'top' as const, row: 'a' as const, column: 1 },
  }
  const pin = { componentId: 'esp32_1', terminalId: 'IO13' }

  it('keeps M–F template when dragging from breadboard to pin', () => {
    expect(
      orientWireConnectorsForEndpoints(hole, pin, { start: 'male', end: 'female' }),
    ).toEqual({ start: 'male', end: 'female' })
  })

  it('flips M–F when dragging from pin to breadboard', () => {
    expect(
      orientWireConnectorsForEndpoints(pin, hole, { start: 'male', end: 'female' }),
    ).toEqual({ start: 'female', end: 'male' })
  })
})

describe('assertWireConnectorsMatchEndpoints', () => {
  it('throws a helpful message for pin-to-pin with M–M', () => {
    expect(() =>
      assertWireConnectorsMatchEndpoints(
        { componentId: 'a', terminalId: 'IO1' },
        { componentId: 'b', terminalId: 'IO2' },
        { start: 'male', end: 'male' },
      ),
    ).toThrow(/F–F/)
  })
})
