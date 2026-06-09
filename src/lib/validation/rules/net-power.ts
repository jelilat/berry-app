import type { TerminalKind } from '@/lib/project/types'
import {
  terminalIdentityKey,
  type NetContext,
  type ResolvedTerminal,
  type ValidationContext,
} from '../context'
import type { ValidationResult } from '../types'

/**
 * True when the terminal kind supplies or accepts board power.
 * @param kind Catalog terminal kind.
 */
function isPowerKind(kind: TerminalKind | null): boolean {
  return kind === 'power_in' || kind === 'power_out'
}

/**
 * True when the terminal kind is a ground reference.
 * @param kind Catalog terminal kind.
 */
function isGroundKind(kind: TerminalKind | null): boolean {
  return kind === 'ground'
}

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
 * Pick a net id to attach to a finding when multiple nets share a conflict.
 * @param terminals Terminals involved in the conflict.
 */
function primaryNetId(terminals: ResolvedTerminal[]): string | undefined {
  const fromNet = terminals.find((t) => t.netId !== '__placement__')
  return fromNet?.netId ?? terminals[0]?.netId
}

/**
 * Check nets for power/ground shorts and conflicting supply voltages.
 * Accounts for breadboard tie-merged connectivity across nets.
 * @param ctx Precomputed validation context.
 */
export function checkNetPower(ctx: ValidationContext): ValidationResult[] {
  const results: ValidationResult[] = []
  const reportedPowerGround = new Set<string>()
  const reportedVoltage = new Set<string>()

  for (const net of ctx.nets) {
    const connected = collectConnectedTerminals(ctx, net)
    const powerPins = connected.filter((t) => isPowerKind(t.kind))
    const groundPins = connected.filter((t) => isGroundKind(t.kind))

    if (powerPins.length > 0 && groundPins.length > 0) {
      const groupKey = [...connected.map(terminalIdentityKey)].sort().join('|')
      if (!reportedPowerGround.has(groupKey)) {
        reportedPowerGround.add(groupKey)
        const netId = primaryNetId(connected)
        results.push({
          code: 'net.power_ground_short',
          severity: 'error',
          message: 'Power and ground are shorted on the same net',
          subject: netId ? { netId } : undefined,
        })
      }
    }

    const voltages = new Set(
      powerPins
        .map((t) => t.voltage)
        .filter((v): v is number => v !== undefined),
    )

    if (voltages.size > 1) {
      const groupKey = [...connected.map(terminalIdentityKey)].sort().join('|')
      if (!reportedVoltage.has(groupKey)) {
        reportedVoltage.add(groupKey)
        const netId = primaryNetId(connected)
        const labels = [...voltages].sort((a, b) => a - b).map((v) => `${v}V`)
        results.push({
          code: 'net.voltage_mismatch',
          severity: 'error',
          message: `Conflicting supply voltages on the same net: ${labels.join(' vs ')}`,
          subject: netId ? { netId } : undefined,
        })
      }
    }
  }

  return results
}
