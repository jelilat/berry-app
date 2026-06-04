import type { WireConnectorGender, WireConnectors } from './types'
import type { WireEndpointRef } from './mutations'
import { isBreadboardHoleRef } from './mutations'

/**
 * Breadboard holes accept male pins (female socket); part header pins are male.
 * @param ref Component terminal or breadboard hole endpoint.
 */
export function endpointConnectorGender(ref: WireEndpointRef): WireConnectorGender {
  return isBreadboardHoleRef(ref) ? 'female' : 'male'
}

/**
 * True when a jumper end can mate with an endpoint (opposite genders only).
 * @param wireEnd Connector on the wire at that endpoint.
 * @param endpointGender Gender of the breadboard hole or part pin.
 */
export function wireEndMatesEndpoint(
  wireEnd: WireConnectorGender,
  endpointGender: WireConnectorGender,
): boolean {
  return wireEnd !== endpointGender
}

/**
 * Whether wire connectors can attach to two endpoints, optionally flipped end-for-end.
 * @param from First endpoint (wire `from` / connector `start`).
 * @param to Second endpoint (wire `to` / connector `end`).
 * @param connectors Jumper template or stored wire metadata.
 * @param allowFlip When true, try swapping start/end to match drag direction.
 */
export function wireConnectorsFitEndpoints(
  from: WireEndpointRef,
  to: WireEndpointRef,
  connectors: WireConnectors,
  allowFlip = true,
): boolean {
  const fromGender = endpointConnectorGender(from)
  const toGender = endpointConnectorGender(to)
  const direct =
    wireEndMatesEndpoint(connectors.start, fromGender) &&
    wireEndMatesEndpoint(connectors.end, toGender)
  if (direct) return true
  if (!allowFlip) return false
  return (
    wireEndMatesEndpoint(connectors.end, fromGender) &&
    wireEndMatesEndpoint(connectors.start, toGender)
  )
}

/**
 * Orient jumper connectors so `start` mates with `from` and `end` with `to`.
 * @param from First endpoint.
 * @param to Second endpoint.
 * @param connectors Template from the tray (e.g. M–M, M–F).
 * @throws When no orientation mates both endpoints (same-gender connection).
 */
export function orientWireConnectorsForEndpoints(
  from: WireEndpointRef,
  to: WireEndpointRef,
  connectors: WireConnectors,
): WireConnectors {
  if (wireConnectorsFitEndpoints(from, to, connectors, false)) {
    return connectors
  }
  const flipped = { start: connectors.end, end: connectors.start }
  if (wireConnectorsFitEndpoints(from, to, flipped, false)) {
    return flipped
  }
  throw new Error(
    'Connector mismatch: use opposite ends only (male–female or female–male)',
  )
}

/**
 * Human-readable endpoint label for connection errors.
 * @param ref Wire endpoint reference.
 */
function describeEndpoint(ref: WireEndpointRef): string {
  if (isBreadboardHoleRef(ref)) {
    return 'breadboard hole'
  }
  return `pin ${ref.terminalId}`
}

/**
 * Assert jumper connectors can mate both endpoints; orients start/end to match `from`/`to`.
 * @param from First endpoint.
 * @param to Second endpoint.
 * @param connectors Wire connector metadata (required for validation).
 * @throws When genders do not mate at either end.
 */
export function assertWireConnectorsMatchEndpoints(
  from: WireEndpointRef,
  to: WireEndpointRef,
  connectors: WireConnectors,
): WireConnectors {
  try {
    return orientWireConnectorsForEndpoints(from, to, connectors)
  } catch {
    const fromGender = endpointConnectorGender(from)
    const toGender = endpointConnectorGender(to)
    const need =
      fromGender === 'female' && toGender === 'female'
        ? 'male–male (M–M)'
        : fromGender === 'male' && toGender === 'male'
          ? 'female–female (F–F)'
          : 'male–female (M–F)'
    throw new Error(
      `Cannot connect ${describeEndpoint(from)} to ${describeEndpoint(to)} with this jumper — use ${need}`,
    )
  }
}
