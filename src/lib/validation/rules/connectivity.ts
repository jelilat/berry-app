import type { ComponentTypeId, TerminalKind } from '@/lib/project/types'
import {
  terminalIdentityKey,
  type NetContext,
  type ResolvedTerminal,
  type ValidationContext,
} from '../context'
import type { ValidationResult } from '../types'

const ACTIVE_OUTPUT_KINDS: TerminalKind[] = ['power_out', 'gpio', 'uart_tx', 'pwm']
const INPUT_LIKE_KINDS: TerminalKind[] = [
  'power_in',
  'analog_in',
  'i2c_sda',
  'i2c_scl',
  'spi_mosi',
  'spi_sck',
  'spi_cs',
  'uart_rx',
]
const SENSOR_POWER_TYPES: ComponentTypeId[] = [
  'bme280',
  'hc-sr04',
  'pir-motion-sensor-hc-sr501',
  'servo-sg90',
  'lcd-1602-i2c',
  'max7219-led-matrix',
]

/**
 * Collect terminals electrically connected to a net, including breadboard tie merges.
 * @param ctx Validation context.
 * @param net Net under inspection.
 */
function collectConnectedTerminals(
  ctx: ValidationContext,
  net: NetContext,
): ResolvedTerminal[] {
  const seen = new Set<string>()
  const connected: ResolvedTerminal[] = []

  const add = (terminal: ResolvedTerminal) => {
    const key = terminalIdentityKey(terminal)
    if (seen.has(key)) return
    seen.add(key)
    connected.push(terminal)
  }

  for (const terminal of net.terminals) {
    add(terminal)
    if (!terminal.tieKey) continue
    const tieGroup = ctx.terminalsByTieKey.get(terminal.tieKey) ?? []
    for (const peer of tieGroup) {
      add(peer)
    }
  }

  return connected
}

/**
 * True when a terminal is a catalog-backed component pin.
 * @param terminal Resolved net terminal.
 */
function hasComponentTerminal(
  terminal: ResolvedTerminal,
): terminal is ResolvedTerminal & { componentId: string; terminalId: string } {
  return Boolean(terminal.componentId && terminal.terminalId)
}

/**
 * Compact label for validation messages.
 * @param terminal Resolved terminal metadata.
 */
function terminalLabel(terminal: ResolvedTerminal): string {
  if (terminal.componentId && terminal.terminalId) {
    return `${terminal.componentId}.${terminal.terminalId}`
  }
  if (terminal.breadboardId && terminal.tieKey) {
    return `${terminal.breadboardId}.${terminal.tieKey}`
  }
  return terminal.netId
}

/**
 * First net id from a connected group that is not a placement-only pseudo-net.
 * @param terminals Connected terminal group.
 */
function primaryNetId(terminals: ResolvedTerminal[]): string | undefined {
  const fromNet = terminals.find((t) => t.netId !== '__placement__')
  return fromNet?.netId ?? terminals[0]?.netId
}

/**
 * Whether a terminal has a capability marker such as `i2c_sda`.
 * @param terminal Resolved terminal metadata.
 * @param capability Capability id to look for.
 */
function hasCapability(terminal: ResolvedTerminal, capability: string): boolean {
  return terminal.capabilities?.includes(capability) ?? false
}

/**
 * True when a terminal can provide the requested protocol role.
 * @param terminal Resolved terminal metadata.
 * @param role Protocol capability / kind.
 */
function supportsRole(terminal: ResolvedTerminal, role: 'i2c_sda' | 'i2c_scl'): boolean {
  return terminal.kind === role || hasCapability(terminal, role)
}

/**
 * Whether a terminal is an active drive source that should not be shorted to another output.
 * @param terminal Resolved terminal metadata.
 */
function isActiveOutput(terminal: ResolvedTerminal): boolean {
  if (terminal.kind === 'gpio') {
    return (
      terminal.componentType === 'esp32-devkit-v1' ||
      terminal.componentType === 'arduino-uno'
    )
  }
  return terminal.kind !== null && ACTIVE_OUTPUT_KINDS.includes(terminal.kind)
}

/**
 * Whether a terminal kind consumes or senses a signal.
 * @param kind Catalog terminal kind.
 */
function isInputLike(kind: TerminalKind | null): boolean {
  return kind !== null && INPUT_LIKE_KINDS.includes(kind)
}

/**
 * Whether a component type is a resistor.
 * @param type Catalog component type.
 */
function isResistorType(type: ComponentTypeId | undefined): boolean {
  return type?.startsWith('resistor-') ?? false
}

/**
 * Whether a component type is a sensor/display/actuator that needs explicit VCC and GND.
 * @param type Catalog component type.
 */
function needsExplicitPower(type: ComponentTypeId): boolean {
  return SENSOR_POWER_TYPES.includes(type)
}

/**
 * Whether a terminal should count as a signal pin for unpowered-component checks.
 * @param terminal Resolved terminal metadata.
 */
function isSignalTerminal(terminal: ResolvedTerminal): boolean {
  return (
    terminal.kind === 'gpio' ||
    terminal.kind === 'analog_in' ||
    terminal.kind === 'i2c_sda' ||
    terminal.kind === 'i2c_scl' ||
    terminal.kind === 'spi_mosi' ||
    terminal.kind === 'spi_sck' ||
    terminal.kind === 'spi_cs' ||
    terminal.kind === 'uart_tx' ||
    terminal.kind === 'uart_rx' ||
    terminal.kind === 'pwm'
  )
}

/**
 * Whether a group includes a terminal connected to board or rail power.
 * @param group Connected terminal group.
 * @param expectedVoltage Required voltage when specified.
 */
function groupHasPower(group: ResolvedTerminal[], expectedVoltage?: number): boolean {
  return group.some(
    (terminal) =>
      terminal.kind === 'power_out' &&
      (expectedVoltage === undefined || terminal.voltage === expectedVoltage),
  )
}

/**
 * Whether a group includes a ground terminal.
 * @param group Connected terminal group.
 */
function groupHasGround(group: ResolvedTerminal[]): boolean {
  return group.some((terminal) => terminal.kind === 'ground')
}

/**
 * Build connected terminal groups for all real nets.
 * @param ctx Validation context.
 */
function connectedGroups(ctx: ValidationContext): ResolvedTerminal[][] {
  return ctx.nets.map((net) => collectConnectedTerminals(ctx, net))
}

/**
 * Find the connected group containing one component terminal.
 * @param groups Connected terminal groups.
 * @param componentId Component instance id.
 * @param terminalId Terminal id.
 */
function findTerminalGroup(
  groups: ResolvedTerminal[][],
  componentId: string,
  terminalId: string,
): ResolvedTerminal[] | undefined {
  return groups.find((group) =>
    group.some(
      (terminal) =>
        terminal.componentId === componentId &&
        terminal.terminalId === terminalId,
    ),
  )
}

/**
 * Check one connected group for incompatible active pin kinds.
 * @param group Connected terminal group.
 */
function checkPinKindCompatibility(group: ResolvedTerminal[]): ValidationResult[] {
  const outputs = group.filter((terminal) => isActiveOutput(terminal))
  if (outputs.length <= 1) return []

  const gpioOutputs = outputs.filter((terminal) => terminal.kind === 'gpio')
  const nonGpioOutputs = outputs.filter((terminal) => terminal.kind !== 'gpio')
  if (nonGpioOutputs.length === 0 && gpioOutputs.length <= 1) return []

  const netId = primaryNetId(group)
  return [
    {
      code: 'net.incompatible_pin_kinds',
      severity: 'error',
      message: `Active outputs share one net: ${outputs.map(terminalLabel).join(', ')}`,
      subject: netId ? { netId } : undefined,
    },
  ]
}

/**
 * Check one connected group for I2C role mismatches.
 * @param group Connected terminal group.
 */
function checkI2cPairing(group: ResolvedTerminal[]): ValidationResult[] {
  const sdaTerminals = group.filter((terminal) => terminal.kind === 'i2c_sda')
  const sclTerminals = group.filter((terminal) => terminal.kind === 'i2c_scl')
  const boardSda = group.filter(
    (terminal) => terminal.kind === 'gpio' && supportsRole(terminal, 'i2c_sda'),
  )
  const boardScl = group.filter(
    (terminal) => terminal.kind === 'gpio' && supportsRole(terminal, 'i2c_scl'),
  )
  const results: ValidationResult[] = []
  const netId = primaryNetId(group)

  if (sdaTerminals.length > 0 && boardScl.length > 0) {
    results.push({
      code: 'net.i2c_pair_mismatch',
      severity: 'error',
      message: `I2C SDA is connected to an SCL-capable pin: ${boardScl.map(terminalLabel).join(', ')}`,
      subject: netId ? { netId } : undefined,
    })
  }

  if (sclTerminals.length > 0 && boardSda.length > 0) {
    results.push({
      code: 'net.i2c_pair_mismatch',
      severity: 'error',
      message: `I2C SCL is connected to an SDA-capable pin: ${boardSda.map(terminalLabel).join(', ')}`,
      subject: netId ? { netId } : undefined,
    })
  }

  if (sdaTerminals.length > 0 && sclTerminals.length > 0) {
    results.push({
      code: 'net.i2c_pair_mismatch',
      severity: 'error',
      message: 'I2C SDA and SCL are shorted on the same net',
      subject: netId ? { netId } : undefined,
    })
  }

  return results
}

/**
 * Check one connected group for UART TX/RX direction mistakes.
 * @param group Connected terminal group.
 */
function checkUartPairing(group: ResolvedTerminal[]): ValidationResult[] {
  const tx = group.filter((terminal) => terminal.kind === 'uart_tx')
  const rx = group.filter((terminal) => terminal.kind === 'uart_rx')
  if (tx.length <= 1 && rx.length <= 1) return []
  if (tx.length === 1 && rx.length === 1) return []

  const netId = primaryNetId(group)
  return [
    {
      code: 'net.uart_pair_mismatch',
      severity: 'error',
      message: `UART pins should connect TX to RX, not same-direction pins: ${[...tx, ...rx]
        .map(terminalLabel)
        .join(', ')}`,
      subject: netId ? { netId } : undefined,
    },
  ]
}

/**
 * Check powered modules for signal pins connected before power and ground.
 * @param ctx Validation context.
 * @param groups Connected terminal groups.
 */
function checkUnpoweredComponents(
  ctx: ValidationContext,
  groups: ResolvedTerminal[][],
): ValidationResult[] {
  const results: ValidationResult[] = []

  for (const instance of ctx.project.components) {
    if (!needsExplicitPower(instance.type)) continue
    const signalGroups = groups.filter((group) =>
      group.some(
        (terminal) =>
          terminal.componentId === instance.id && isSignalTerminal(terminal),
      ),
    )
    if (signalGroups.length === 0) continue

    const vccGroup = findTerminalGroup(groups, instance.id, 'VCC')
    const gndGroup = findTerminalGroup(groups, instance.id, 'GND')
    const vccTerminal = vccGroup?.find(
      (terminal) =>
        terminal.componentId === instance.id && terminal.terminalId === 'VCC',
    )
    const missingPower = !vccGroup || !groupHasPower(vccGroup, vccTerminal?.voltage)
    const missingGround = !gndGroup || !groupHasGround(gndGroup)
    if (!missingPower && !missingGround) continue

    const subjectGroup = signalGroups[0] ?? vccGroup ?? gndGroup
    results.push({
      code: 'component.unpowered',
      severity: 'warning',
      message: `${instance.id} has signal wiring but ${[
        missingPower ? 'VCC is not tied to matching power' : '',
        missingGround ? 'GND is not tied to ground' : '',
      ]
        .filter(Boolean)
        .join(' and ')}`,
      subject: {
        componentId: instance.id,
        netId: subjectGroup ? primaryNetId(subjectGroup) : undefined,
      },
    })
  }

  return results
}

/**
 * Check obvious button-to-GPIO inputs that lack a pull-up or pull-down path.
 * @param ctx Validation context.
 * @param groups Connected terminal groups.
 */
function checkFloatingInputs(
  ctx: ValidationContext,
  groups: ResolvedTerminal[][],
): ValidationResult[] {
  const results: ValidationResult[] = []
  const reported = new Set<string>()

  for (const instance of ctx.project.components) {
    if (instance.type !== 'push-button') continue
    const pin1Group = findTerminalGroup(groups, instance.id, 'pin1')
    const pin2Group = findTerminalGroup(groups, instance.id, 'pin2')
    if (!pin1Group || !pin2Group) continue

    const groupAHasGpio = pin1Group.some((terminal) => terminal.kind === 'gpio')
    const groupBHasGpio = pin2Group.some((terminal) => terminal.kind === 'gpio')
    if (groupAHasGpio === groupBHasGpio) continue

    const referenceGroup = groupAHasGpio ? pin2Group : pin1Group
    const hasReference =
      groupHasGround(referenceGroup) ||
      groupHasPower(referenceGroup) ||
      referenceGroup.some((terminal) => isResistorType(terminal.componentType))
    if (hasReference) continue

    const gpioGroup = groupAHasGpio ? pin1Group : pin2Group
    const gpioTerminal = gpioGroup.find((terminal) => terminal.kind === 'gpio')
    const key = `${instance.id}:${gpioTerminal?.componentId}:${gpioTerminal?.terminalId}`
    if (reported.has(key)) continue
    reported.add(key)

    results.push({
      code: 'component.floating_input',
      severity: 'warning',
      message: `${terminalLabel(gpioTerminal ?? gpioGroup[0])} is wired to a button without a pull-up or pull-down reference`,
      subject: {
        componentId: gpioTerminal?.componentId,
        terminalId: gpioTerminal?.terminalId,
        netId: primaryNetId(gpioGroup),
      },
    })
  }

  return results
}

/**
 * Validate protocol pairing, pin-kind compatibility, power, and obvious floating inputs.
 * @param ctx Precomputed validation context.
 */
export function checkConnectivity(ctx: ValidationContext): ValidationResult[] {
  const groups = connectedGroups(ctx)
  const results: ValidationResult[] = []

  for (const group of groups) {
    const componentPins = group.filter(hasComponentTerminal)
    if (componentPins.length < 2) continue
    results.push(...checkPinKindCompatibility(group))
    results.push(...checkI2cPairing(group))
    results.push(...checkUartPairing(group))
  }

  results.push(...checkUnpoweredComponents(ctx, groups))
  results.push(...checkFloatingInputs(ctx, groups))
  return results
}
