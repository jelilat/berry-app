import { getComponentDefinition } from './catalog'
import { validateProjectGraph } from './io'
import type {
  BerryProject,
  ComponentInstance,
  ComponentTypeId,
  Net,
  NetTerminal,
  Vec3,
  Wire,
  WireColor,
  WireConnectors,
} from './types'
import { BERRY_PROJECT_VERSION } from './types'
import { getComponentDefinition as getDef } from './catalog'
import { findBreadboardAtPoint, snapInstanceOnBreadboard } from '@/lib/studio/breadboard-snap'
import {
  componentSceneDimensions,
  normalizeRotationZ,
  terminalScenePosition,
} from './terminal-layout'
import { position2d, transform2d } from './vec3'
import { orthogonalWireRoute } from './wire-route'

/** Default snap grid for 2D Studio placement (scene units). */
export const SNAP_GRID = 0.02

/**
 * Snap a coordinate to the nearest grid step.
 * @param value Scene coordinate.
 * @param grid Grid size in scene units (default {@link SNAP_GRID}).
 */
export function snapValue(value: number, grid = SNAP_GRID): number {
  return Math.round(value / grid) * grid
}

/**
 * Generate a unique id with a prefix, avoiding collisions with existing ids.
 * @param prefix Id prefix (e.g. `led`, `net`).
 * @param existing Set of ids already in use.
 */
export function uniqueId(prefix: string, existing: Set<string>): string {
  let n = 1
  let id = `${prefix}_${n}`
  while (existing.has(id)) {
    n += 1
    id = `${prefix}_${n}`
  }
  return id
}

/**
 * Collect all entity ids used in a project (components, nets, wires).
 * @param project Berry project graph.
 */
export function collectProjectIds(project: BerryProject): Set<string> {
  const ids = new Set<string>()
  for (const c of project.components) ids.add(c.id)
  for (const n of project.nets) ids.add(n.id)
  for (const w of project.wires) ids.add(w.id)
  return ids
}

/**
 * Create an empty project with no components (ESP32 board target).
 */
export function createEmptyProject(): BerryProject {
  const now = new Date().toISOString()
  return {
    version: BERRY_PROJECT_VERSION,
    board: 'esp32-devkit-v1',
    metadata: {
      name: 'Untitled project',
      createdAt: now,
      updatedAt: now,
    },
    components: [],
    nets: [],
    wires: [],
  }
}

/**
 * Starter template: full breadboard + ESP32 devkit on the bench.
 */
export function createStarterProject(): BerryProject {
  const now = new Date().toISOString()
  return {
    version: BERRY_PROJECT_VERSION,
    board: 'esp32-devkit-v1',
    metadata: {
      name: 'New hardware project',
      description: 'Breadboard + ESP32 starter layout',
      createdAt: now,
      updatedAt: now,
    },
    components: [
      {
        id: 'breadboard_1',
        type: 'breadboard-full',
        transform: transform2d(0.1, 0.1),
      },
      {
        id: 'esp32_1',
        type: 'esp32-devkit-v1',
        parent: 'breadboard_1',
        anchor: 'center',
        transform: transform2d(0.14, 0.1, 90),
      },
    ],
    nets: [],
    wires: [],
  }
}

/**
 * Touch `metadata.updatedAt` on a project clone.
 * @param project Source project.
 */
function withUpdatedMetadata(project: BerryProject): BerryProject {
  return {
    ...project,
    metadata: {
      ...project.metadata,
      updatedAt: new Date().toISOString(),
    },
  }
}

/**
 * Add a component instance from the catalog.
 * @param project Current project.
 * @param type Catalog component type id.
 * @param options Optional id override and scene position (snapped when `snap` is true).
 */
export function addComponent(
  project: BerryProject,
  type: ComponentTypeId,
  options?: {
    id?: string
    x?: number
    y?: number
    rotationZ?: number
    parent?: string | null
    snap?: boolean
  },
): BerryProject {
  const def = getComponentDefinition(type)
  if (def.wireTemplate) {
    throw new Error(`${def.name} is a wire type — use Connect to join two pins`)
  }
  const ids = collectProjectIds(project)
  const id = options?.id ?? uniqueId(type.replace(/-/g, '_'), ids)
  if (ids.has(id)) {
    throw new Error(`Component id already exists: ${id}`)
  }

  let x = options?.x ?? 0.2
  let y = options?.y ?? 0.2
  if (options?.snap !== false) {
    x = snapValue(x)
    y = snapValue(y)
  }

  let instance: ComponentInstance = {
    id,
    type,
    transform: transform2d(x, y, options?.rotationZ ?? 0),
    parent: options?.parent ?? undefined,
  }

  if (findBreadboardAtPoint(project, x + 0.02, y + 0.02) || instance.parent) {
    instance = snapInstanceOnBreadboard(project, instance, x, y)
  }

  const next: BerryProject = {
    ...project,
    components: [...project.components, instance],
  }
  validateProjectGraph(next)
  return withUpdatedMetadata(next)
}

/**
 * Move a component to a new 2D position (updates transform.position x/y, z stays 0).
 * @param project Current project.
 * @param componentId Instance id.
 * @param x Scene x.
 * @param y Scene y.
 * @param options Optional rotation and snap-to-grid.
 */
export function moveComponent(
  project: BerryProject,
  componentId: string,
  x: number,
  y: number,
  options?: { rotationZ?: number; snap?: boolean },
): BerryProject {
  const components = project.components.map((c) => {
    if (c.id !== componentId) return c
    const rotationZ = options?.rotationZ ?? c.transform.rotation?.z ?? 0
    const snap = options?.snap !== false
    const bb = findBreadboardAtPoint(project, x, y)
    const onBreadboard = c.parent != null || bb != null

    if (snap && onBreadboard) {
      return snapInstanceOnBreadboard(
        project,
        { ...c, transform: { ...c.transform, rotation: { x: 0, y: 0, z: rotationZ } } },
        x,
        y,
      )
    }

    const px = snap ? snapValue(x) : x
    const py = snap ? snapValue(y) : y
    return {
      ...c,
      transform: {
        ...c.transform,
        position: position2d(px, py),
        rotation: { x: 0, y: 0, z: rotationZ },
      },
    }
  })

  if (!components.some((c) => c.id === componentId)) {
    throw new Error(`Unknown component: ${componentId}`)
  }

  const next: BerryProject = { ...project, components }
  validateProjectGraph(next)
  return withUpdatedMetadata(next)
}

/**
 * Rotate a component by a delta around its center (updates rotation.z and position).
 * @param project Current project.
 * @param componentId Instance id.
 * @param options Delta in degrees (default 90) and optional snap on the new position.
 */
export function rotateComponent(
  project: BerryProject,
  componentId: string,
  options?: { deltaDegrees?: number; snap?: boolean },
): BerryProject {
  const delta = options?.deltaDegrees ?? 90
  const snap = options?.snap !== false

  const components = project.components.map((c) => {
    if (c.id !== componentId) return c

    const currentRot = c.transform.rotation?.z ?? 0
    const newRot = normalizeRotationZ(currentRot + delta)
    const { w: oldW, h: oldH } = componentSceneDimensions(c.type, currentRot)
    const { w: newW, h: newH } = componentSceneDimensions(c.type, newRot)

    const cx = c.transform.position.x + oldW / 2
    const cy = c.transform.position.y + oldH / 2
    let newX = cx - newW / 2
    let newY = cy - newH / 2

    let updated: ComponentInstance = {
      ...c,
      transform: {
        ...c.transform,
        position: position2d(newX, newY),
        rotation: { x: 0, y: 0, z: newRot },
      },
    }

    if (findBreadboardAtPoint(project, cx, cy) || updated.parent) {
      return snapInstanceOnBreadboard(project, updated, newX, newY)
    }

    if (snap) {
      updated = {
        ...updated,
        transform: {
          ...updated.transform,
          position: position2d(snapValue(newX), snapValue(newY)),
        },
      }
    }
    return updated
  })

  if (!components.some((c) => c.id === componentId)) {
    throw new Error(`Unknown component: ${componentId}`)
  }

  const next: BerryProject = { ...project, components }
  validateProjectGraph(next)
  return withUpdatedMetadata(next)
}

/**
 * Build a net terminal entry, including breadboard site when placed on a board.
 * @param project Berry project.
 * @param ref Component terminal reference.
 */
function netTerminalFromRef(project: BerryProject, ref: TerminalRef): NetTerminal {
  const inst = project.components.find((c) => c.id === ref.componentId)
  const site = inst?.placement?.sites?.[ref.terminalId]
  const entry: NetTerminal = {
    component: ref.componentId,
    terminal: ref.terminalId,
  }
  if (site && inst?.parent) entry.site = site
  return entry
}

/**
 * Remove a component and any dependents, nets, and wires that reference it.
 * @param project Current project.
 * @param componentId Instance id to remove.
 */
export function removeComponent(project: BerryProject, componentId: string): BerryProject {
  const toRemove = new Set<string>()
  const queue = [componentId]
  while (queue.length > 0) {
    const id = queue.pop()!
    if (toRemove.has(id)) continue
    toRemove.add(id)
    for (const child of project.components.filter((c) => c.parent === id)) {
      queue.push(child.id)
    }
  }

  if (!toRemove.has(componentId)) {
    throw new Error(`Unknown component: ${componentId}`)
  }

  const components = project.components.filter((c) => !toRemove.has(c.id))

  let nets = project.nets
    .map((net) => ({
      ...net,
      terminals: net.terminals.filter((t) => !t.component || !toRemove.has(t.component)),
    }))
    .filter((net) => net.terminals.length >= 2)

  const netIds = new Set(nets.map((n) => n.id))
  const wires = project.wires.filter((w) => netIds.has(w.net))

  const next: BerryProject = { ...project, components, nets, wires }
  validateProjectGraph(next)
  return withUpdatedMetadata(next)
}

/** Terminal endpoint for wiring mutations. */
export interface TerminalRef {
  componentId: string
  terminalId: string
}

/**
 * Find the net that contains a terminal, if any.
 * @param project Berry project.
 * @param ref Component + terminal id.
 */
export function findNetForTerminal(
  project: BerryProject,
  ref: TerminalRef,
): Net | undefined {
  return project.nets.find((net) =>
    net.terminals.some(
      (t) => t.component === ref.componentId && t.terminal === ref.terminalId,
    ),
  )
}

/**
 * Assert a terminal exists on a component instance (catalog-backed).
 * @param project Berry project.
 * @param ref Component + terminal id.
 * @throws When instance or terminal is missing.
 */
export function assertTerminalExists(project: BerryProject, ref: TerminalRef): void {
  const instance = project.components.find((c) => c.id === ref.componentId)
  if (!instance) throw new Error(`Unknown component: ${ref.componentId}`)
  const def = getComponentDefinition(instance.type)
  if (def.terminals.length > 0 && !def.terminals.some((t) => t.id === ref.terminalId)) {
    throw new Error(`Terminal ${ref.terminalId} is not on ${instance.type}`)
  }
}

/**
 * Merge two nets into one (combines terminals, reassigns wires).
 * @param project Berry project.
 * @param keepNetId Net id to retain.
 * @param removeNetId Net id to drop.
 */
function mergeNets(project: BerryProject, keepNetId: string, removeNetId: string): BerryProject {
  const keep = project.nets.find((n) => n.id === keepNetId)
  const remove = project.nets.find((n) => n.id === removeNetId)
  if (!keep || !remove) throw new Error('Cannot merge missing nets')

  const terminalKey = (t: NetTerminal) =>
    t.component && t.terminal
      ? `${t.component}:${t.terminal}`
      : `bb:${t.breadboard}:${JSON.stringify(t.site)}`
  const seen = new Set(keep.terminals.map(terminalKey))
  const mergedTerminals = [...keep.terminals]
  for (const t of remove.terminals) {
    const key = terminalKey(t)
    if (!seen.has(key)) {
      seen.add(key)
      mergedTerminals.push(t)
    }
  }

  const nets = project.nets
    .filter((n) => n.id !== removeNetId)
    .map((n) => (n.id === keepNetId ? { ...n, terminals: mergedTerminals } : n))

  const wires = project.wires.map((w) =>
    w.net === removeNetId ? { ...w, net: keepNetId } : w,
  )

  return { ...project, nets, wires }
}

/**
 * Connect two terminals with a new or extended electrical net and visual wire.
 * @param project Current project.
 * @param from First terminal clicked in wire mode.
 * @param to Second terminal.
 * @param options Wire color, connector styles, and optional polyline override (min 2 points, z = 0).
 */
export function connectTerminals(
  project: BerryProject,
  from: TerminalRef,
  to: TerminalRef,
  options?: {
    color?: WireColor
    connectors?: WireConnectors
    points?: Vec3[]
  },
): BerryProject {
  if (from.componentId === to.componentId && from.terminalId === to.terminalId) {
    return project
  }

  assertTerminalExists(project, from)
  assertTerminalExists(project, to)

  const netA = findNetForTerminal(project, from)
  const netB = findNetForTerminal(project, to)

  let working = project
  let netId: string

  if (netA && netB) {
    if (netA.id === netB.id) {
      netId = netA.id
    } else {
      working = mergeNets(working, netA.id, netB.id)
      netId = netA.id
    }
  } else if (netA) {
    netId = netA.id
    const terminals = [...netA.terminals]
    const key = `${to.componentId}:${to.terminalId}`
    if (!terminals.some((t) => `${t.component}:${t.terminal}` === key)) {
      terminals.push(netTerminalFromRef(working, to))
    }
    working = {
      ...working,
      nets: working.nets.map((n) => (n.id === netId ? { ...n, terminals } : n)),
    }
  } else if (netB) {
    netId = netB.id
    const terminals = [...netB.terminals]
    const key = `${from.componentId}:${from.terminalId}`
    if (!terminals.some((t) => `${t.component}:${t.terminal}` === key)) {
      terminals.push(netTerminalFromRef(working, from))
    }
    working = {
      ...working,
      nets: working.nets.map((n) => (n.id === netId ? { ...n, terminals } : n)),
    }
  } else {
    const ids = collectProjectIds(working)
    netId = uniqueId('net', ids)
    const net: Net = {
      id: netId,
      terminals: [
        netTerminalFromRef(working, from),
        netTerminalFromRef(working, to),
      ],
    }
    working = { ...working, nets: [...working.nets, net] }
  }

  const defaultPoints =
    options?.points ?? buildDefaultWirePoints(working, from, to)
  if (defaultPoints.length < 2) {
    throw new Error('connectTerminals requires at least 2 wire points')
  }

  const wireIds = collectProjectIds(working)
  const wire: Wire = {
    id: uniqueId('wire', wireIds),
    net: netId,
    color: options?.color ?? 'yellow',
    connectors: options?.connectors,
    from: { component: from.componentId, terminal: from.terminalId },
    to: { component: to.componentId, terminal: to.terminalId },
    points: defaultPoints.map((p) => ({ x: p.x, y: p.y, z: 0 })),
  }

  const next: BerryProject = {
    ...working,
    wires: [...working.wires, wire],
  }
  validateProjectGraph(next)
  return withUpdatedMetadata(next)
}

/**
 * Replace the entire project (e.g. after import). Validates the graph.
 * @param project Parsed project.
 */
export function replaceProject(project: BerryProject): BerryProject {
  validateProjectGraph(project)
  return withUpdatedMetadata(project)
}

/**
 * Build a simple 2-point wire polyline between two terminals (z = 0).
 * @param project Berry project (for component positions).
 * @param from First terminal.
 * @param to Second terminal.
 */
export function buildDefaultWirePoints(
  project: BerryProject,
  from: TerminalRef,
  to: TerminalRef,
): Vec3[] {
  const fromInst = project.components.find((c) => c.id === from.componentId)
  const toInst = project.components.find((c) => c.id === to.componentId)
  if (!fromInst || !toInst) throw new Error('Component not found for wire points')

  const fromDef = getDef(fromInst.type)
  const toDef = getDef(toInst.type)
  const a = terminalScenePosition(
    fromInst.transform.position.x,
    fromInst.transform.position.y,
    fromInst.type,
    from.terminalId,
    fromDef.terminals,
    fromInst.transform.rotation?.z ?? 0,
  )
  const b = terminalScenePosition(
    toInst.transform.position.x,
    toInst.transform.position.y,
    toInst.type,
    to.terminalId,
    toDef.terminals,
    toInst.transform.rotation?.z ?? 0,
  )
  return orthogonalWireRoute(a, b).map((p) => position2d(p.x, p.y))
}

/**
 * Reroute visual wires that touch a moved component.
 * @param project Project after component positions have changed.
 * @param componentId Moved component id.
 */
export function rerouteWiresForComponent(
  project: BerryProject,
  componentId: string,
): BerryProject {
  let changed = false
  const wires = project.wires.map((wire) => {
    const endpoints = resolveWireTerminalRefs(project, wire)
    if (!endpoints) return wire
    const [from, to] = endpoints
    if (from.componentId !== componentId && to.componentId !== componentId) return wire

    changed = true
    return {
      ...wire,
      points: buildDefaultWirePoints(project, from, to),
    }
  })

  return changed ? { ...project, wires } : project
}

/**
 * Whether any remaining wire on a net still uses a component terminal.
 * @param wires Wires still in the project.
 * @param netId Net id to check.
 * @param componentId Component instance id.
 * @param terminalId Terminal id on that component.
 * @param project Project used to resolve wire endpoints.
 */
function terminalUsedByNetWires(
  wires: Wire[],
  netId: string,
  componentId: string,
  terminalId: string,
  project: BerryProject,
): boolean {
  return wires.some((w) => {
    if (w.net !== netId) return false
    const pair = resolveWireTerminalRefs(project, w)
    if (!pair) return false
    const [a, b] = pair
    return (
      (a.componentId === componentId && a.terminalId === terminalId) ||
      (b.componentId === componentId && b.terminalId === terminalId)
    )
  })
}

/**
 * Remove a visual wire and prune net terminals that are no longer connected.
 * @param project Current project.
 * @param wireId Wire instance id to remove.
 */
export function removeWire(project: BerryProject, wireId: string): BerryProject {
  const wire = project.wires.find((w) => w.id === wireId)
  if (!wire) throw new Error(`Unknown wire: ${wireId}`)

  const endpoints = resolveWireTerminalRefs(project, wire)
  const remainingWires = project.wires.filter((w) => w.id !== wireId)

  let nets = project.nets
    .map((net) => {
      if (net.id !== wire.net) return net
      if (!endpoints) {
        const stillHasWires = remainingWires.some((w) => w.net === net.id)
        return stillHasWires ? net : null
      }
      const [from, to] = endpoints
      let terminals = [...net.terminals]
      for (const ref of [from, to]) {
        if (
          !terminalUsedByNetWires(
            remainingWires,
            net.id,
            ref.componentId,
            ref.terminalId,
            project,
          )
        ) {
          terminals = terminals.filter(
            (t) =>
              !(
                t.component === ref.componentId && t.terminal === ref.terminalId
              ),
          )
        }
      }
      if (terminals.length < 2) return null
      return { ...net, terminals }
    })
    .filter((n): n is Net => n !== null)

  const netIds = new Set(nets.map((n) => n.id))
  const wires = remainingWires.filter((w) => netIds.has(w.net))

  const next: BerryProject = { ...project, nets, wires }
  validateProjectGraph(next)
  return withUpdatedMetadata(next)
}

/**
 * Resolve the terminal pair a visual wire should follow.
 * @param project Berry project graph.
 * @param wire Visual wire.
 */
export function resolveWireTerminalRefs(
  project: BerryProject,
  wire: Wire,
): [TerminalRef, TerminalRef] | null {
  if (wire.from && wire.to) {
    return [
      { componentId: wire.from.component, terminalId: wire.from.terminal },
      { componentId: wire.to.component, terminalId: wire.to.terminal },
    ]
  }

  const net = project.nets.find((n) => n.id === wire.net)
  if (!net) return null
  const terminals = net.terminals
    .filter((t): t is NetTerminal & { component: string; terminal: string } =>
      Boolean(t.component && t.terminal),
    )
    .slice(0, 2)
  if (terminals.length < 2) return null
  return [
    { componentId: terminals[0].component, terminalId: terminals[0].terminal },
    { componentId: terminals[1].component, terminalId: terminals[1].terminal },
  ]
}
