import { getComponentDefinition } from './catalog'
import {
  breadboardTieKey,
  sitesShareTie,
  type BreadboardPlacement,
  type BreadboardSite,
} from './breadboard'
import type { BerryProject, ComponentInstance, Net, NetTerminal } from './types'

/** A terminal reference with optional breadboard hole. */
export interface ResolvedNetEndpoint {
  componentId?: string
  terminalId?: string
  breadboardId?: string
  site?: BreadboardSite
  tieKey: string | null
}

/**
 * Resolve net endpoint to a tie-group key when it sits on a breadboard.
 * @param project Berry project.
 * @param endpoint Net terminal entry.
 */
export function resolveNetEndpoint(
  project: BerryProject,
  endpoint: NetTerminal,
): ResolvedNetEndpoint {
  const inst = endpoint.component
    ? project.components.find((c) => c.id === endpoint.component)
    : undefined
  const site =
    endpoint.site ??
    (inst?.placement?.sites && endpoint.terminal
      ? inst.placement.sites[endpoint.terminal]
      : undefined)

  let tieKey: string | null = null
  if (site) tieKey = breadboardTieKey(site)

  return {
    componentId: endpoint.component,
    terminalId: endpoint.terminal,
    breadboardId: endpoint.breadboard ?? inst?.parent ?? undefined,
    site,
    tieKey,
  }
}

/**
 * Collect all breadboard tie keys used by placements and net endpoints on one board.
 * @param project Berry project.
 * @param breadboardId Breadboard instance id.
 */
export function collectBreadboardTieKeys(
  project: BerryProject,
  breadboardId: string,
): Map<string, ResolvedNetEndpoint[]> {
  const byTie = new Map<string, ResolvedNetEndpoint[]>()

  const add = (tie: string | null, ep: ResolvedNetEndpoint) => {
    if (!tie) return
    const list = byTie.get(tie) ?? []
    list.push(ep)
    byTie.set(tie, list)
  }

  for (const inst of project.components) {
    if (inst.parent !== breadboardId || !inst.placement?.sites) continue
    for (const [terminalId, site] of Object.entries(inst.placement.sites)) {
      add(breadboardTieKey(site), {
        componentId: inst.id,
        terminalId,
        breadboardId,
        site,
        tieKey: breadboardTieKey(site),
      })
    }
  }

  for (const net of project.nets) {
    for (const t of net.terminals) {
      const resolved = resolveNetEndpoint(project, t)
      if (resolved.breadboardId === breadboardId) {
        add(resolved.tieKey, resolved)
      }
    }
  }

  return byTie
}

export interface BreadboardNetConflict {
  code: 'tie_net_mismatch'
  message: string
  tieKey: string
  netIds: string[]
}

/**
 * Detect terminals that share a breadboard tie but are assigned to different nets.
 * @param project Berry project.
 */
export function findBreadboardTieNetConflicts(project: BerryProject): BreadboardNetConflict[] {
  const breadboards = project.components.filter((c) => c.type === 'breadboard-full')
  const conflicts: BreadboardNetConflict[] = []

  for (const bb of breadboards) {
    const terminalNet = new Map<string, string>()

    for (const net of project.nets) {
      for (const t of net.terminals) {
        const r = resolveNetEndpoint(project, t)
        if (r.breadboardId !== bb.id || !r.tieKey || !r.componentId) continue
        const key = `${r.componentId}:${r.terminalId}`
        terminalNet.set(key, net.id)
      }
    }

    const tieToNets = new Map<string, Set<string>>()
    for (const inst of project.components) {
      if (inst.parent !== bb.id || !inst.placement?.sites) continue
      for (const [terminalId, site] of Object.entries(inst.placement.sites)) {
        const tie = breadboardTieKey(site)
        const netId = terminalNet.get(`${inst.id}:${terminalId}`)
        if (!netId) continue
        const set = tieToNets.get(tie) ?? new Set()
        set.add(netId)
        tieToNets.set(tie, set)
      }
    }

    for (const [tieKey, netIds] of tieToNets) {
      if (netIds.size > 1) {
        conflicts.push({
          code: 'tie_net_mismatch',
          tieKey,
          netIds: [...netIds],
          message: `Breadboard tie ${tieKey} has pins on different nets: ${[...netIds].join(', ')}`,
        })
      }
    }
  }

  return conflicts
}

/**
 * True when two part terminals should be on the same net because they share a breadboard tie.
 * @param project Berry project.
 * @param a First component id.
 * @param aTerminal First terminal id.
 * @param b Second component id.
 * @param bTerminal Second terminal id.
 */
export function shareBreadboardTie(
  project: BerryProject,
  a: string,
  aTerminal: string,
  b: string,
  bTerminal: string,
): boolean {
  const siteA = getTerminalSite(project, a, aTerminal)
  const siteB = getTerminalSite(project, b, bTerminal)
  if (!siteA || !siteB) return false
  return sitesShareTie(siteA, siteB)
}

/**
 * Get breadboard site for a component terminal (placement or net override).
 */
function getTerminalSite(
  project: BerryProject,
  componentId: string,
  terminalId: string,
): BreadboardSite | undefined {
  const inst = project.components.find((c) => c.id === componentId)
  return inst?.placement?.sites?.[terminalId]
}

/**
 * List duplicate hole assignments on one breadboard (two legs in same hole).
 * @param project Berry project.
 * @param breadboardId Breadboard instance id.
 */
export function findHoleOccupancyConflicts(
  project: BerryProject,
  breadboardId: string,
): string[] {
  const holeUsers = new Map<string, string[]>()
  const key = (s: BreadboardSite) =>
    s.kind === 'hole' ? `hole:${s.block}:${s.row}:${s.column}` : breadboardTieKey(s)

  for (const inst of project.components) {
    if (inst.parent !== breadboardId || !inst.placement?.sites) continue
    for (const [terminalId, site] of Object.entries(inst.placement.sites)) {
      const k = key(site)
      const users = holeUsers.get(k) ?? []
      users.push(`${inst.id}:${terminalId}`)
      holeUsers.set(k, users)
    }
  }

  const errors: string[] = []
  for (const [hole, users] of holeUsers) {
    if (users.length > 1) {
      errors.push(`Hole ${hole} used by ${users.join(' and ')}`)
    }
  }
  return errors
}

/**
 * Validate placement terminal ids exist on the part catalog.
 * @param instance Placed component.
 */
export function validateInstancePlacement(instance: ComponentInstance): string[] {
  if (!instance.placement?.sites) return []
  const def = getComponentDefinition(instance.type)
  const valid = new Set(def.terminals.map((t) => t.id))
  const errors: string[] = []
  for (const terminalId of Object.keys(instance.placement.sites)) {
    if (!valid.has(terminalId)) {
      errors.push(`Unknown terminal ${terminalId} in placement for ${instance.id}`)
    }
  }
  return errors
}
