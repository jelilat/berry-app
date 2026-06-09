import { sitesShareTie } from '@/lib/project/breadboard'
import { getComponentDefinition } from '@/lib/project/catalog'
import {
  collectBreadboardTieKeys,
  resolveNetEndpoint,
} from '@/lib/project/breadboard-nets'
import type {
  BerryProject,
  ComponentTypeId,
  Net,
  TerminalKind,
} from '@/lib/project/types'
import type { BreadboardSite } from '@/lib/project/breadboard'

/** One net terminal with catalog metadata and breadboard tie resolution. */
export interface ResolvedTerminal {
  netId: string
  componentId?: string
  terminalId?: string
  breadboardId?: string
  site?: BreadboardSite
  tieKey: string | null
  componentType?: ComponentTypeId
  kind: TerminalKind | null
  voltage?: number
  capabilities?: string[]
}

/** Resolved terminals grouped under one electrical net. */
export interface NetContext {
  netId: string
  terminals: ResolvedTerminal[]
}

/** Precomputed graph data shared by validation rules. */
export interface ValidationContext {
  project: BerryProject
  nets: NetContext[]
  /** Breadboard tie key → terminals that share that copper strip. */
  terminalsByTieKey: Map<string, ResolvedTerminal[]>
}

/**
 * Resolve catalog metadata for a component terminal id.
 * @param componentType Catalog component type.
 * @param terminalId Terminal id from the net or placement.
 */
function resolveCatalogTerminal(
  componentType: ComponentTypeId,
  terminalId: string,
): Pick<ResolvedTerminal, 'kind' | 'voltage' | 'capabilities' | 'componentType'> {
  const def = getComponentDefinition(componentType)
  const terminal = def.terminals.find((t) => t.id === terminalId)
  return {
    componentType,
    kind: terminal?.kind ?? null,
    voltage: terminal?.voltage,
    capabilities: terminal?.capabilities,
  }
}

/**
 * Build a {@link ResolvedTerminal} from a net entry and optional instance type.
 * @param netId Parent net id.
 * @param componentType Catalog type when the endpoint is a placed part pin.
 * @param endpoint Resolved breadboard / component endpoint.
 */
function toResolvedTerminal(
  netId: string,
  componentType: ComponentTypeId | undefined,
  endpoint: ReturnType<typeof resolveNetEndpoint>,
): ResolvedTerminal {
  const base: ResolvedTerminal = {
    netId,
    componentId: endpoint.componentId,
    terminalId: endpoint.terminalId,
    breadboardId: endpoint.breadboardId,
    site: endpoint.site,
    tieKey: endpoint.tieKey,
    kind: null,
  }

  if (componentType && endpoint.terminalId) {
    return { ...base, ...resolveCatalogTerminal(componentType, endpoint.terminalId) }
  }

  return base
}

/**
 * True when two resolved terminals share breadboard copper (tie group).
 * @param a First terminal.
 * @param b Second terminal.
 */
function terminalsShareTie(a: ResolvedTerminal, b: ResolvedTerminal): boolean {
  if (a.tieKey && b.tieKey && a.tieKey === b.tieKey) return true
  if (a.site && b.site) return sitesShareTie(a.site, b.site)
  return false
}

/**
 * Index resolved terminals by breadboard tie key for tie-merged connectivity checks.
 * @param terminals All resolved terminals across nets.
 */
function indexTerminalsByTieKey(
  terminals: ResolvedTerminal[],
): Map<string, ResolvedTerminal[]> {
  const byTie = new Map<string, ResolvedTerminal[]>()

  for (const terminal of terminals) {
    if (!terminal.tieKey) continue
    const list = byTie.get(terminal.tieKey) ?? []
    list.push(terminal)
    byTie.set(terminal.tieKey, list)
  }

  return byTie
}

/**
 * Resolve net terminals to catalog metadata and breadboard tie groups.
 * @param project Berry project to validate.
 */
export function buildValidationContext(project: BerryProject): ValidationContext {
  const instanceType = new Map(
    project.components.map((c) => [c.id, c.type] as const),
  )

  const nets: NetContext[] = project.nets.map((net: Net) => {
    const terminals = net.terminals.map((endpoint) => {
      const resolved = resolveNetEndpoint(project, endpoint)
      const componentType = resolved.componentId
        ? instanceType.get(resolved.componentId)
        : undefined
      return toResolvedTerminal(net.id, componentType, resolved)
    })
    return { netId: net.id, terminals }
  })

  const allTerminals = nets.flatMap((n) => n.terminals)

  const terminalsByTieKey = indexTerminalsByTieKey(allTerminals)

  for (const bb of project.components.filter((c) => c.type === 'breadboard-full')) {
    const tieMap = collectBreadboardTieKeys(project, bb.id)
    for (const [tieKey, endpoints] of tieMap) {
      const existing = terminalsByTieKey.get(tieKey) ?? []
      const seen = new Set(
        existing.map((t) => terminalIdentityKey(t)),
      )

      for (const ep of endpoints) {
        if (!ep.componentId || !ep.terminalId) continue
        const componentType = instanceType.get(ep.componentId)
        const resolved = toResolvedTerminal('__placement__', componentType, ep)
        const key = terminalIdentityKey(resolved)
        if (seen.has(key)) continue
        const sharesTie = existing.some((t) => terminalsShareTie(t, resolved))
        if (existing.length > 0 && !sharesTie) continue
        seen.add(key)
        existing.push(resolved)
      }

      if (existing.length > 0) {
        terminalsByTieKey.set(tieKey, existing)
      }
    }
  }

  return { project, nets, terminalsByTieKey }
}

/**
 * Stable identity for deduplicating terminals in tie-group indexes.
 * @param terminal Resolved terminal reference.
 */
export function terminalIdentityKey(terminal: ResolvedTerminal): string {
  if (terminal.componentId && terminal.terminalId) {
    return `${terminal.componentId}:${terminal.terminalId}`
  }
  if (terminal.breadboardId && terminal.tieKey) {
    return `bb:${terminal.breadboardId}:${terminal.tieKey}`
  }
  return `orphan:${terminal.netId}`
}
