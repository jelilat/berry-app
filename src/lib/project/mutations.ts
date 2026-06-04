import { getComponentDefinition } from "./catalog";
import type { BreadboardRowId, BreadboardSite } from "./breadboard";
import { breadboardPhysicalSiteKey } from "./breadboard-nets";
import { assertWireConnectorsMatchEndpoints } from "./connection-gender";
import { validateProjectGraph } from "./io";
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
  WireEndpoint,
} from "./types";
import { BERRY_PROJECT_VERSION } from "./types";
import { getComponentDefinition as getDef } from "./catalog";
import { isBreadboardHoleAvailableForWire } from "@/lib/studio/connect-pins";
import { holeScenePosition } from "@/lib/studio/breadboard-layout";
import {
  findBreadboardAtPoint,
  holeBenchPosition,
  snapInstanceOnBreadboard,
  snapPartToBreadboardHole,
  terminalOffsetInOuterBox,
} from "@/lib/studio/breadboard-snap";
import type { InstancePinLayout } from "@/lib/studio/pin-layout-registry";
import {
  componentSceneDimensions,
  normalizeRotationZ,
  terminalScenePosition,
} from "./terminal-layout";
import { position2d, transform2d } from "./vec3";
import { orthogonalWireRoute } from "./wire-route";

/**
 * Generate a unique id with a prefix, avoiding collisions with existing ids.
 * @param prefix Id prefix (e.g. `led`, `net`).
 * @param existing Set of ids already in use.
 */
export function uniqueId(prefix: string, existing: Set<string>): string {
  let n = 1;
  let id = `${prefix}_${n}`;
  while (existing.has(id)) {
    n += 1;
    id = `${prefix}_${n}`;
  }
  return id;
}

/**
 * Collect all entity ids used in a project (components, nets, wires).
 * @param project Berry project graph.
 */
export function collectProjectIds(project: BerryProject): Set<string> {
  const ids = new Set<string>();
  for (const c of project.components) ids.add(c.id);
  for (const n of project.nets) ids.add(n.id);
  for (const w of project.wires) ids.add(w.id);
  return ids;
}

/**
 * Create an empty project with no components (ESP32 board target).
 */
export function createEmptyProject(): BerryProject {
  const now = new Date().toISOString();
  return {
    version: BERRY_PROJECT_VERSION,
    board: "esp32-devkit-v1",
    metadata: {
      name: "Untitled project",
      createdAt: now,
      updatedAt: now,
    },
    components: [],
    nets: [],
    wires: [],
  };
}

/**
 * Snap the ESP32 starter onto the breadboard with VIN on a given hole and no pin collisions.
 * @param breadboard Breadboard instance (position used for hole math).
 * @param esp32 ESP32 instance before snap.
 * @param anchorRow Row letter for the VIN anchor hole.
 * @param anchorColumn Column 1–60 for the VIN anchor hole.
 */
function snapStarterEsp32OnBreadboard(
  breadboard: ComponentInstance,
  esp32: ComponentInstance,
  anchorRow: BreadboardRowId,
  anchorColumn: number,
): ComponentInstance {
  const rotationZ = esp32.transform.rotation?.z ?? 90;
  const bb = breadboard.transform.position;
  const vinBench = holeScenePosition(bb.x, bb.y, anchorRow, anchorColumn);
  const vinOff = terminalOffsetInOuterBox(esp32.type, "VIN", rotationZ);
  const topLeftX = vinBench.x - vinOff.x;
  const topLeftY = vinBench.y - vinOff.y;
  return snapPartToBreadboardHole(breadboard, esp32, topLeftX, topLeftY);
}

/**
 * Starter template: full breadboard + ESP32 devkit on the bench.
 */
export function createStarterProject(): BerryProject {
  const now = new Date().toISOString();
  const breadboardX = 0.1;
  const breadboardY = 0.1;
  const breadboard: ComponentInstance = {
    id: "breadboard_1",
    type: "breadboard-full",
    transform: transform2d(breadboardX, breadboardY),
  };
  const esp32Draft: ComponentInstance = {
    id: "esp32_1",
    type: "esp32-devkit-v1",
    parent: "breadboard_1",
    anchor: "center",
    transform: transform2d(breadboardX, breadboardY, 90),
  };

  const esp32 = snapStarterEsp32OnBreadboard(breadboard, esp32Draft, "a", 1);
  const project: BerryProject = {
    version: BERRY_PROJECT_VERSION,
    board: "esp32-devkit-v1",
    metadata: {
      name: "New hardware project",
      description: "Breadboard + ESP32 starter layout",
      createdAt: now,
      updatedAt: now,
    },
    components: [breadboard, esp32],
    nets: [],
    wires: [],
  };
  validateProjectGraph(project);
  return project;
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
  };
}

/**
 * Add a component instance from the catalog.
 * @param project Current project.
 * @param type Catalog component type id.
 * @param options Optional id override and scene position.
 */
export function addComponent(
  project: BerryProject,
  type: ComponentTypeId,
  options?: {
    id?: string;
    x?: number;
    y?: number;
    rotationZ?: number;
    parent?: string | null;
  },
): BerryProject {
  const def = getComponentDefinition(type);
  if (def.wireTemplate) {
    throw new Error(
      `${def.name} is a wire type — use Connect to join two pins`,
    );
  }
  const ids = collectProjectIds(project);
  const id = options?.id ?? uniqueId(type.replace(/-/g, "_"), ids);
  if (ids.has(id)) {
    throw new Error(`Component id already exists: ${id}`);
  }

  const x = options?.x ?? 0.2;
  const y = options?.y ?? 0.2;

  let instance: ComponentInstance = {
    id,
    type,
    transform: transform2d(x, y, options?.rotationZ ?? 0),
    parent: options?.parent ?? undefined,
  };

  if (instance.type !== "breadboard-full") {
    instance = snapInstanceOnBreadboard(project, instance, x, y);
  }

  const next: BerryProject = {
    ...project,
    components: [...project.components, instance],
  };
  validateProjectGraph(next);
  return withUpdatedMetadata(next);
}

/**
 * Move a component to a new 2D position (updates transform.position x/y, z stays 0).
 * @param project Current project.
 * @param componentId Instance id.
 * @param x Scene x.
 * @param y Scene y.
 * @param options Optional rotation and visual pin layout.
 */
export function moveComponent(
  project: BerryProject,
  componentId: string,
  x: number,
  y: number,
  options?: { rotationZ?: number; pinLayout?: InstancePinLayout },
): BerryProject {
  const components = project.components.map((c) => {
    if (c.id !== componentId) return c;
    const rotationZ = options?.rotationZ ?? c.transform.rotation?.z ?? 0;
    if (c.type !== "breadboard-full") {
      return snapInstanceOnBreadboard(
        project,
        {
          ...c,
          transform: { ...c.transform, rotation: { x: 0, y: 0, z: rotationZ } },
        },
        x,
        y,
        { layout: options?.pinLayout },
      );
    }

    return {
      ...c,
      transform: {
        ...c.transform,
        position: position2d(x, y),
        rotation: { x: 0, y: 0, z: rotationZ },
      },
    };
  });

  if (!components.some((c) => c.id === componentId)) {
    throw new Error(`Unknown component: ${componentId}`);
  }

  const next: BerryProject = { ...project, components };
  validateProjectGraph(next);
  return withUpdatedMetadata(next);
}

/**
 * Rotate a component by a delta around its center (updates rotation.z and position).
 * @param project Current project.
 * @param componentId Instance id.
 * @param options Delta in degrees (default 90).
 */
export function rotateComponent(
  project: BerryProject,
  componentId: string,
  options?: { deltaDegrees?: number },
): BerryProject {
  const delta = options?.deltaDegrees ?? 90;

  const components = project.components.map((c) => {
    if (c.id !== componentId) return c;

    const currentRot = c.transform.rotation?.z ?? 0;
    const newRot = normalizeRotationZ(currentRot + delta);
    const { w: oldW, h: oldH } = componentSceneDimensions(c.type, currentRot);
    const { w: newW, h: newH } = componentSceneDimensions(c.type, newRot);

    const cx = c.transform.position.x + oldW / 2;
    const cy = c.transform.position.y + oldH / 2;
    let newX = cx - newW / 2;
    let newY = cy - newH / 2;

    let updated: ComponentInstance = {
      ...c,
      transform: {
        ...c.transform,
        position: position2d(newX, newY),
        rotation: { x: 0, y: 0, z: newRot },
      },
    };

    if (findBreadboardAtPoint(project, cx, cy) || updated.parent) {
      return snapInstanceOnBreadboard(project, updated, newX, newY);
    }

    return updated;
  });

  if (!components.some((c) => c.id === componentId)) {
    throw new Error(`Unknown component: ${componentId}`);
  }

  const next: BerryProject = { ...project, components };
  validateProjectGraph(next);
  return withUpdatedMetadata(next);
}

/**
 * Whether a component allows individual terminal hole edits on a breadboard.
 * @param instance Placed component instance.
 */
export function canManuallyEditTerminalSites(
  instance: ComponentInstance,
): boolean {
  return (
    instance.type.startsWith("resistor-") || instance.type.startsWith("led-")
  );
}

/**
 * Move one flexible component terminal to a specific breadboard site.
 * @param project Current project.
 * @param componentId Component instance id.
 * @param terminalId Terminal id on the component.
 * @param site Target breadboard hole or rail.
 * @throws When the component is not on a breadboard, the terminal is invalid, or the part has fixed pin geometry.
 */
export function setComponentTerminalSite(
  project: BerryProject,
  componentId: string,
  terminalId: string,
  site: BreadboardSite,
): BerryProject {
  const instance = project.components.find((c) => c.id === componentId);
  if (!instance) throw new Error(`Unknown component: ${componentId}`);
  if (!instance.parent) {
    throw new Error(
      `${componentId} must be on a breadboard before editing pin holes`,
    );
  }
  const parent = project.components.find((c) => c.id === instance.parent);
  if (!parent || parent.type !== "breadboard-full") {
    throw new Error(
      `${componentId} must be on a breadboard before editing pin holes`,
    );
  }
  if (!canManuallyEditTerminalSites(instance)) {
    throw new Error(
      `${instance.type} has fixed pin spacing; move the component instead`,
    );
  }
  assertTerminalExists(project, { componentId, terminalId });

  const components = project.components.map((c) =>
    c.id === componentId
      ? {
          ...c,
          placement: {
            sites: {
              ...(c.placement?.sites ?? {}),
              [terminalId]: site,
            },
          },
        }
      : c,
  );
  const nets = project.nets.map((net) => ({
    ...net,
    terminals: net.terminals.map((terminal) =>
      terminal.component === componentId && terminal.terminal === terminalId
        ? { ...terminal, site }
        : terminal,
    ),
  }));

  const next = rerouteWiresForComponent(
    { ...project, components, nets },
    componentId,
  );
  validateProjectGraph(next);
  return withUpdatedMetadata(next);
}

/**
 * Move one breadboard end of a visual wire to a different main-grid hole.
 * @param project Current project.
 * @param wireId Visual wire instance id.
 * @param end Which stored endpoint to update (`from` or `to`).
 * @param site Target breadboard hole.
 * @throws When the wire or endpoint is missing, the hole is invalid, or the hole is occupied.
 */
export function setWireBreadboardEndpoint(
  project: BerryProject,
  wireId: string,
  end: 'from' | 'to',
  site: BreadboardSite,
): BerryProject {
  if (site.kind !== 'hole') {
    throw new Error('Only main breadboard holes can be edited for jumpers')
  }

  const wire = project.wires.find((w) => w.id === wireId)
  if (!wire) throw new Error(`Unknown wire: ${wireId}`)

  const refs = resolveWireTerminalRefs(project, wire)
  if (!refs) throw new Error(`Wire ${wireId} has no resolved endpoints`)

  const index = end === 'from' ? 0 : 1
  const current = refs[index]
  if (!isBreadboardHoleRef(current)) {
    throw new Error(`Wire ${wireId} ${end} is not on a breadboard hole`)
  }

  const breadboard = project.components.find((c) => c.id === current.breadboardId)
  if (!breadboard || breadboard.type !== 'breadboard-full') {
    throw new Error(`Unknown breadboard: ${current.breadboardId}`)
  }

  const nextRef: BreadboardHoleRef = { breadboardId: current.breadboardId, site }
  if (
    breadboardPhysicalSiteKey(site) !== breadboardPhysicalSiteKey(current.site) &&
    !isBreadboardHoleAvailableForWire(project, nextRef, wireId)
  ) {
    throw new Error(
      `${site.row}${site.column} is already used on ${current.breadboardId}`,
    )
  }

  const nextRefs: [WireEndpointRef, WireEndpointRef] =
    index === 0 ? [nextRef, refs[1]] : [refs[0], nextRef]

  const wires = project.wires.map((w) =>
    w.id === wireId
      ? {
          ...w,
          [end]: endpointToWireEndpoint(nextRef),
          points: buildDefaultWirePoints(project, nextRefs[0], nextRefs[1]).map((p) => ({
            x: p.x,
            y: p.y,
            z: 0,
          })),
        }
      : w,
  )

  const nets = project.nets.map((net) =>
    net.id !== wire.net
      ? net
      : {
          ...net,
          terminals: net.terminals.map((terminal) =>
            netTerminalMatchesEndpoint(terminal, current)
              ? { breadboard: current.breadboardId, site }
              : terminal,
          ),
        },
  )

  const next: BerryProject = { ...project, wires, nets }
  validateProjectGraph(next)
  return withUpdatedMetadata(next)
}

/**
 * Recompute a wire polyline from its locked endpoints (breadboard or pin).
 * @param project Current project.
 * @param wireId Visual wire instance id.
 */
export function resetWireRoute(project: BerryProject, wireId: string): BerryProject {
  const wire = project.wires.find((w) => w.id === wireId)
  if (!wire) throw new Error(`Unknown wire: ${wireId}`)

  const refs = resolveWireTerminalRefs(project, wire)
  if (!refs) throw new Error(`Wire ${wireId} has no resolved endpoints`)

  const wires = project.wires.map((w) =>
    w.id === wireId
      ? {
          ...w,
          points: buildDefaultWirePoints(project, refs[0], refs[1]).map((p) => ({
            x: p.x,
            y: p.y,
            z: 0,
          })),
        }
      : w,
  )

  return withUpdatedMetadata({ ...project, wires })
}

/**
 * Build a net terminal entry, including breadboard site when placed on a board.
 * @param project Berry project.
 * @param ref Wire endpoint reference (terminal or breadboard hole).
 */
function netTerminalFromRef(
  project: BerryProject,
  ref: WireEndpointRef,
): NetTerminal {
  if (isBreadboardHoleRef(ref)) {
    return { breadboard: ref.breadboardId, site: ref.site };
  }
  const inst = project.components.find((c) => c.id === ref.componentId);
  const site = inst?.placement?.sites?.[ref.terminalId];
  const entry: NetTerminal = {
    component: ref.componentId,
    terminal: ref.terminalId,
  };
  if (site && inst?.parent) entry.site = site;
  return entry;
}

/**
 * Remove a component and any dependents, nets, and wires that reference it.
 * @param project Current project.
 * @param componentId Instance id to remove.
 */
export function removeComponent(
  project: BerryProject,
  componentId: string,
): BerryProject {
  const toRemove = new Set<string>();
  const queue = [componentId];
  while (queue.length > 0) {
    const id = queue.pop()!;
    if (toRemove.has(id)) continue;
    toRemove.add(id);
    for (const child of project.components.filter((c) => c.parent === id)) {
      queue.push(child.id);
    }
  }

  if (!toRemove.has(componentId)) {
    throw new Error(`Unknown component: ${componentId}`);
  }

  const components = project.components.filter((c) => !toRemove.has(c.id));

  let nets = project.nets
    .map((net) => ({
      ...net,
      terminals: net.terminals.filter(
        (t) => !t.component || !toRemove.has(t.component),
      ),
    }))
    .filter((net) => net.terminals.length >= 2);

  const netIds = new Set(nets.map((n) => n.id));
  const wires = project.wires.filter((w) => netIds.has(w.net));

  const next: BerryProject = { ...project, components, nets, wires };
  validateProjectGraph(next);
  return withUpdatedMetadata(next);
}

/** Component terminal endpoint for wiring mutations. */
export interface TerminalRef {
  componentId: string;
  terminalId: string;
}

/** Bare breadboard hole/rail endpoint (e.g. a jumper plugged straight into the board). */
export interface BreadboardHoleRef {
  breadboardId: string;
  site: BreadboardSite;
}

/** A wire endpoint: either a component terminal or a breadboard hole/rail. */
export type WireEndpointRef = TerminalRef | BreadboardHoleRef;

/**
 * Whether a wire endpoint plugs straight into a breadboard hole/rail (no component).
 * @param ref Wire endpoint reference.
 */
export function isBreadboardHoleRef(
  ref: WireEndpointRef,
): ref is BreadboardHoleRef {
  return (ref as BreadboardHoleRef).breadboardId !== undefined;
}

/**
 * Whether a net terminal entry refers to the same physical point as an endpoint.
 * @param t Net terminal entry.
 * @param ref Wire endpoint reference.
 */
function netTerminalMatchesEndpoint(
  t: NetTerminal,
  ref: WireEndpointRef,
): boolean {
  if (isBreadboardHoleRef(ref)) {
    return (
      t.breadboard === ref.breadboardId &&
      !!t.site &&
      breadboardPhysicalSiteKey(t.site) === breadboardPhysicalSiteKey(ref.site)
    );
  }
  return t.component === ref.componentId && t.terminal === ref.terminalId;
}

/**
 * Stable dedup key for a wire endpoint (terminal or breadboard hole/rail).
 * @param ref Wire endpoint reference.
 */
function endpointKey(ref: WireEndpointRef): string {
  return isBreadboardHoleRef(ref)
    ? `bb:${ref.breadboardId}:${breadboardPhysicalSiteKey(ref.site)}`
    : `${ref.componentId}:${ref.terminalId}`;
}

/**
 * Component id a wire endpoint depends on for rerouting (the part, or the breadboard).
 * @param ref Wire endpoint reference.
 */
function endpointOwnerComponentId(ref: WireEndpointRef): string {
  return isBreadboardHoleRef(ref) ? ref.breadboardId : ref.componentId;
}

/**
 * The {@link WireEndpoint} record stored on a visual wire for an endpoint.
 * @param ref Wire endpoint reference.
 */
function endpointToWireEndpoint(ref: WireEndpointRef): WireEndpoint {
  return isBreadboardHoleRef(ref)
    ? { breadboard: ref.breadboardId, site: ref.site }
    : { component: ref.componentId, terminal: ref.terminalId };
}

/**
 * True when two wire endpoints refer to the same physical point.
 * @param a First endpoint.
 * @param b Second endpoint.
 */
function sameEndpoint(a: WireEndpointRef, b: WireEndpointRef): boolean {
  return endpointKey(a) === endpointKey(b);
}

/**
 * Find the net that contains a wire endpoint (terminal or breadboard hole), if any.
 * @param project Berry project.
 * @param ref Wire endpoint reference.
 */
export function findNetForEndpoint(
  project: BerryProject,
  ref: WireEndpointRef,
): Net | undefined {
  return project.nets.find((net) =>
    net.terminals.some((t) => netTerminalMatchesEndpoint(t, ref)),
  );
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
  return findNetForEndpoint(project, ref);
}

/**
 * Assert a terminal exists on a component instance (catalog-backed).
 * @param project Berry project.
 * @param ref Component + terminal id.
 * @throws When instance or terminal is missing.
 */
export function assertTerminalExists(
  project: BerryProject,
  ref: TerminalRef,
): void {
  const instance = project.components.find((c) => c.id === ref.componentId);
  if (!instance) throw new Error(`Unknown component: ${ref.componentId}`);
  const def = getComponentDefinition(instance.type);
  if (
    def.terminals.length > 0 &&
    !def.terminals.some((t) => t.id === ref.terminalId)
  ) {
    throw new Error(`Terminal ${ref.terminalId} is not on ${instance.type}`);
  }
}

/**
 * Assert a wire endpoint is connectable: a real terminal, or a hole on a real breadboard.
 * @param project Berry project.
 * @param ref Wire endpoint reference.
 * @throws When the component/terminal or breadboard is missing or invalid.
 */
export function assertEndpointValid(
  project: BerryProject,
  ref: WireEndpointRef,
): void {
  if (isBreadboardHoleRef(ref)) {
    const breadboard = project.components.find(
      (c) => c.id === ref.breadboardId,
    );
    if (!breadboard) throw new Error(`Unknown breadboard: ${ref.breadboardId}`);
    if (breadboard.type !== "breadboard-full") {
      throw new Error(`${ref.breadboardId} is not a breadboard`);
    }
    return;
  }
  assertTerminalExists(project, ref);
}

/**
 * Merge two nets into one (combines terminals, reassigns wires).
 * @param project Berry project.
 * @param keepNetId Net id to retain.
 * @param removeNetId Net id to drop.
 */
function mergeNets(
  project: BerryProject,
  keepNetId: string,
  removeNetId: string,
): BerryProject {
  const keep = project.nets.find((n) => n.id === keepNetId);
  const remove = project.nets.find((n) => n.id === removeNetId);
  if (!keep || !remove) throw new Error("Cannot merge missing nets");

  const terminalKey = (t: NetTerminal) =>
    t.component && t.terminal
      ? `${t.component}:${t.terminal}`
      : `bb:${t.breadboard}:${JSON.stringify(t.site)}`;
  const seen = new Set(keep.terminals.map(terminalKey));
  const mergedTerminals = [...keep.terminals];
  for (const t of remove.terminals) {
    const key = terminalKey(t);
    if (!seen.has(key)) {
      seen.add(key);
      mergedTerminals.push(t);
    }
  }

  const nets = project.nets
    .filter((n) => n.id !== removeNetId)
    .map((n) =>
      n.id === keepNetId ? { ...n, terminals: mergedTerminals } : n,
    );

  const wires = project.wires.map((w) =>
    w.net === removeNetId ? { ...w, net: keepNetId } : w,
  );

  return { ...project, nets, wires };
}

/**
 * Connect two wire endpoints with a new or extended electrical net and visual wire.
 * Each endpoint is a component terminal or a bare breadboard hole/rail.
 * @param project Current project.
 * @param from First endpoint clicked in wire mode.
 * @param to Second endpoint.
 * @param options Wire color, connector styles, and optional polyline override (min 2 points, z = 0).
 */
export function connectTerminals(
  project: BerryProject,
  from: WireEndpointRef,
  to: WireEndpointRef,
  options?: {
    color?: WireColor;
    connectors?: WireConnectors;
    points?: Vec3[];
  },
): BerryProject {
  if (sameEndpoint(from, to)) {
    return project;
  }

  assertEndpointValid(project, from);
  assertEndpointValid(project, to);

  const orientedConnectors = options?.connectors
    ? assertWireConnectorsMatchEndpoints(from, to, options.connectors)
    : undefined;

  const netA = findNetForEndpoint(project, from);
  const netB = findNetForEndpoint(project, to);

  let working = project;
  let netId: string;

  if (netA && netB) {
    if (netA.id === netB.id) {
      netId = netA.id;
    } else {
      working = mergeNets(working, netA.id, netB.id);
      netId = netA.id;
    }
  } else if (netA) {
    netId = netA.id;
    const terminals = [...netA.terminals];
    if (!terminals.some((t) => netTerminalMatchesEndpoint(t, to))) {
      terminals.push(netTerminalFromRef(working, to));
    }
    working = {
      ...working,
      nets: working.nets.map((n) => (n.id === netId ? { ...n, terminals } : n)),
    };
  } else if (netB) {
    netId = netB.id;
    const terminals = [...netB.terminals];
    if (!terminals.some((t) => netTerminalMatchesEndpoint(t, from))) {
      terminals.push(netTerminalFromRef(working, from));
    }
    working = {
      ...working,
      nets: working.nets.map((n) => (n.id === netId ? { ...n, terminals } : n)),
    };
  } else {
    const ids = collectProjectIds(working);
    netId = uniqueId("net", ids);
    const net: Net = {
      id: netId,
      terminals: [
        netTerminalFromRef(working, from),
        netTerminalFromRef(working, to),
      ],
    };
    working = { ...working, nets: [...working.nets, net] };
  }

  const defaultPoints =
    options?.points ?? buildDefaultWirePoints(working, from, to);
  if (defaultPoints.length < 2) {
    throw new Error("connectTerminals requires at least 2 wire points");
  }

  const wireIds = collectProjectIds(working);
  const wire: Wire = {
    id: uniqueId("wire", wireIds),
    net: netId,
    color: options?.color ?? "yellow",
    connectors: orientedConnectors,
    from: endpointToWireEndpoint(from),
    to: endpointToWireEndpoint(to),
    points: defaultPoints.map((p) => ({ x: p.x, y: p.y, z: 0 })),
  };

  const next: BerryProject = {
    ...working,
    wires: [...working.wires, wire],
  };
  validateProjectGraph(next);
  return withUpdatedMetadata(next);
}

/**
 * Replace the entire project (e.g. after import). Validates the graph.
 * @param project Parsed project.
 */
export function replaceProject(project: BerryProject): BerryProject {
  validateProjectGraph(project);
  return withUpdatedMetadata(project);
}

/**
 * Build a simple 2-point wire polyline between two endpoints (z = 0).
 * @param project Berry project (for component positions).
 * @param from First endpoint.
 * @param to Second endpoint.
 */
export function buildDefaultWirePoints(
  project: BerryProject,
  from: WireEndpointRef,
  to: WireEndpointRef,
): Vec3[] {
  const a = endpointScenePositionForWire(project, from);
  const b = endpointScenePositionForWire(project, to);
  return orthogonalWireRoute(a, b).map((p) => position2d(p.x, p.y));
}

/**
 * Resolve an endpoint's scene position, preferring its breadboard hole when placed.
 * @param project Berry project.
 * @param ref Wire endpoint reference.
 * @throws When the component or breadboard is missing.
 */
function endpointScenePositionForWire(
  project: BerryProject,
  ref: WireEndpointRef,
): { x: number; y: number } {
  if (isBreadboardHoleRef(ref)) {
    const breadboard = project.components.find(
      (c) => c.id === ref.breadboardId,
    );
    if (!breadboard || breadboard.type !== "breadboard-full") {
      throw new Error("Breadboard not found for wire points");
    }
    return holeBenchPosition(breadboard, ref.site);
  }

  const instance = project.components.find((c) => c.id === ref.componentId);
  if (!instance) throw new Error("Component not found for wire points");
  const site = instance.placement?.sites?.[ref.terminalId];
  if (site && instance.parent) {
    const breadboard = project.components.find((c) => c.id === instance.parent);
    if (!breadboard || breadboard.type !== "breadboard-full") {
      throw new Error("Breadboard not found for wire points");
    }
    return holeBenchPosition(breadboard, site);
  }

  const def = getDef(instance.type);
  return terminalScenePosition(
    instance.transform.position.x,
    instance.transform.position.y,
    instance.type,
    ref.terminalId,
    def.terminals,
    instance.transform.rotation?.z ?? 0,
  );
}

/**
 * Whether a visual wire plugs into at least one breadboard hole/rail.
 * @param wire Visual wire record.
 */
export function wireHasBreadboardEndpoint(wire: Wire): boolean {
  return !!(wire.from?.breadboard || wire.to?.breadboard);
}

/**
 * Keep interior bend points; re-pin polyline ends to current endpoint positions.
 * @param project Berry project (for endpoint scene positions).
 * @param from Resolved start endpoint.
 * @param to Resolved end endpoint.
 * @param points Stored wire polyline in scene space.
 */
export function anchorWireRoutePoints(
  project: BerryProject,
  from: WireEndpointRef,
  to: WireEndpointRef,
  points: Vec3[],
): Vec3[] {
  const start = endpointScenePositionForWire(project, from);
  const end = endpointScenePositionForWire(project, to);
  if (points.length < 2) {
    return buildDefaultWirePoints(project, from, to);
  }
  return points.map((point, index) => {
    if (index === 0) return position2d(start.x, start.y);
    if (index === points.length - 1) return position2d(end.x, end.y);
    return { x: point.x, y: point.y, z: point.z ?? 0 };
  });
}

/**
 * Reroute visual wires that touch a moved component (part or breadboard).
 * @param project Project after component positions have changed.
 * @param componentId Moved component id.
 */
export function rerouteWiresForComponent(
  project: BerryProject,
  componentId: string,
): BerryProject {
  let changed = false;
  const wires = project.wires.map((wire) => {
    const endpoints = resolveWireTerminalRefs(project, wire);
    if (!endpoints) return wire;
    const [from, to] = endpoints;
    if (
      endpointOwnerComponentId(from) !== componentId &&
      endpointOwnerComponentId(to) !== componentId
    ) {
      return wire;
    }

    changed = true;
    return {
      ...wire,
      points: buildDefaultWirePoints(project, from, to),
    };
  });

  return changed ? { ...project, wires } : project;
}

/**
 * Whether any remaining wire on a net still uses a given endpoint.
 * @param wires Wires still in the project.
 * @param netId Net id to check.
 * @param ref Wire endpoint reference.
 * @param project Project used to resolve wire endpoints.
 */
function endpointUsedByNetWires(
  wires: Wire[],
  netId: string,
  ref: WireEndpointRef,
  project: BerryProject,
): boolean {
  return wires.some((w) => {
    if (w.net !== netId) return false;
    const pair = resolveWireTerminalRefs(project, w);
    if (!pair) return false;
    const [a, b] = pair;
    return sameEndpoint(a, ref) || sameEndpoint(b, ref);
  });
}

/**
 * Remove a visual wire and prune net terminals that are no longer connected.
 * @param project Current project.
 * @param wireId Wire instance id to remove.
 */
export function removeWire(
  project: BerryProject,
  wireId: string,
): BerryProject {
  const wire = project.wires.find((w) => w.id === wireId);
  if (!wire) throw new Error(`Unknown wire: ${wireId}`);

  const endpoints = resolveWireTerminalRefs(project, wire);
  const remainingWires = project.wires.filter((w) => w.id !== wireId);

  let nets = project.nets
    .map((net) => {
      if (net.id !== wire.net) return net;
      if (!endpoints) {
        const stillHasWires = remainingWires.some((w) => w.net === net.id);
        return stillHasWires ? net : null;
      }
      const [from, to] = endpoints;
      let terminals = [...net.terminals];
      for (const ref of [from, to]) {
        if (!endpointUsedByNetWires(remainingWires, net.id, ref, project)) {
          terminals = terminals.filter(
            (t) => !netTerminalMatchesEndpoint(t, ref),
          );
        }
      }
      if (terminals.length < 2) return null;
      return { ...net, terminals };
    })
    .filter((n): n is Net => n !== null);

  const netIds = new Set(nets.map((n) => n.id));
  const wires = remainingWires.filter((w) => netIds.has(w.net));

  const next: BerryProject = { ...project, nets, wires };
  validateProjectGraph(next);
  return withUpdatedMetadata(next);
}

/**
 * Convert a stored wire endpoint or net terminal to a {@link WireEndpointRef}.
 * @param endpoint Wire endpoint or net terminal record.
 */
function endpointRefFromRecord(
  endpoint: WireEndpoint | NetTerminal,
): WireEndpointRef | null {
  if (endpoint.component && endpoint.terminal) {
    return { componentId: endpoint.component, terminalId: endpoint.terminal };
  }
  if (endpoint.breadboard && endpoint.site) {
    return { breadboardId: endpoint.breadboard, site: endpoint.site };
  }
  return null;
}

/**
 * Resolve the endpoint pair a visual wire should follow (terminals or breadboard holes).
 * @param project Berry project graph.
 * @param wire Visual wire.
 */
export function resolveWireTerminalRefs(
  project: BerryProject,
  wire: Wire,
): [WireEndpointRef, WireEndpointRef] | null {
  if (wire.from && wire.to) {
    const from = endpointRefFromRecord(wire.from);
    const to = endpointRefFromRecord(wire.to);
    if (from && to) return [from, to];
  }

  const net = project.nets.find((n) => n.id === wire.net);
  if (!net) return null;
  const refs = net.terminals
    .map(endpointRefFromRecord)
    .filter((r): r is WireEndpointRef => r !== null)
    .slice(0, 2);
  if (refs.length < 2) return null;
  return [refs[0], refs[1]];
}
