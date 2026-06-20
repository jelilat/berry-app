import { parseBreadboardPlacement, parseBreadboardSite } from "./breadboard";
import {
  findBreadboardTieNetConflicts,
  findHoleOccupancyConflicts,
  validateInstancePlacement,
} from "./breadboard-nets";
import { wireConnectorsFitEndpoints } from "./connection-gender";
import { getComponentDefinition, getWireTemplate, isWireTemplate } from "./catalog";
import type { WireEndpointRef } from "./mutations";
import { getBoardProfile } from "./boards";
import {
  BERRY_PROJECT_VERSION,
  type BerryProject,
  type BoardId,
  type ComponentInstance,
  type ComponentTypeId,
  type Net,
  type NetTerminal,
  type Vec3,
  type Wire,
  type WireConnectors,
  type WireEndpoint,
  type WireTypeId,
} from "./types";

/** Thrown when project JSON is invalid or fails graph validation. */
export class ProjectParseError extends Error {
  /** @param message Human-readable parse or validation error. */
  constructor(message: string) {
    super(message);
    this.name = "ProjectParseError";
  }
}

/**
 * Type guard: value is a non-null, non-array object.
 * Used while parsing untrusted JSON.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Parse and validate a `{ x, y, z }` object from JSON.
 * @param value Raw JSON fragment.
 * @param path Dot-path for error messages (e.g. `components[0].transform.position`).
 */
function parseVec3(value: unknown, path: string): Vec3 {
  if (!isRecord(value))
    throw new ProjectParseError(`${path} must be an object`);
  const { x, y, z } = value;
  if (typeof x !== "number" || typeof y !== "number" || typeof z !== "number") {
    throw new ProjectParseError(`${path} requires numeric x, y, z`);
  }
  return { x, y, z };
}

/**
 * Parse one entry from `components[]`.
 * @param value Raw component object.
 * @param index Array index (for error paths).
 */
function parseComponent(value: unknown, index: number): ComponentInstance {
  const path = `components[${index}]`;
  if (!isRecord(value))
    throw new ProjectParseError(`${path} must be an object`);
  const { id, type, transform, parent, anchor, placement } = value;
  if (typeof id !== "string" || !id)
    throw new ProjectParseError(`${path}.id is required`);
  if (typeof type !== "string")
    throw new ProjectParseError(`${path}.type is required`);
  if (!isRecord(transform))
    throw new ProjectParseError(`${path}.transform is required`);

  const position = parseVec3(transform.position, `${path}.transform.position`);
  let rotation: Vec3 | undefined;
  if (transform.rotation !== undefined) {
    rotation = parseVec3(transform.rotation, `${path}.transform.rotation`);
  }

  let scale: ComponentInstance["transform"]["scale"];
  if (transform.scale !== undefined) {
    if (typeof transform.scale === "number") {
      scale = transform.scale;
    } else {
      scale = parseVec3(transform.scale, `${path}.transform.scale`);
    }
  }

  getComponentDefinition(type as ComponentTypeId);

  let parsedPlacement: ComponentInstance["placement"];
  if (placement !== undefined && placement !== null) {
    parsedPlacement = parseBreadboardPlacement(placement, `${path}.placement`);
  }

  if (parsedPlacement && Object.keys(parsedPlacement.sites).length === 0) {
    parsedPlacement = undefined;
  }

  if (type === "breadboard-full" && parsedPlacement) {
    if (Object.keys(parsedPlacement.sites).length > 0) {
      throw new ProjectParseError(
        `${path}.placement is only valid for parts placed on a breadboard`,
      );
    }
    parsedPlacement = undefined;
  }

  return {
    id,
    type: type as ComponentTypeId,
    transform: { position, rotation, scale },
    parent:
      parent === null || parent === undefined ? undefined : String(parent),
    anchor:
      anchor === null || anchor === undefined ? undefined : String(anchor),
    placement: parsedPlacement,
  };
}

/**
 * Parse one net terminal (part pin, or breadboard hole/rail).
 * @param value Raw terminal object.
 * @param path JSON path for errors.
 */
function parseNetTerminal(value: unknown, path: string): NetTerminal {
  if (!isRecord(value))
    throw new ProjectParseError(`${path} must be an object`);
  const hasComponent = typeof value.component === "string";
  const hasTerminal = typeof value.terminal === "string";
  const hasBreadboard = typeof value.breadboard === "string";
  const hasSite = value.site !== undefined && value.site !== null;

  if (hasComponent !== hasTerminal) {
    throw new ProjectParseError(
      `${path} requires both component and terminal, or neither`,
    );
  }
  if (!hasComponent && !(hasBreadboard && hasSite)) {
    throw new ProjectParseError(
      `${path} requires component+terminal or breadboard+site`,
    );
  }

  const out: NetTerminal = {};
  if (hasComponent && hasTerminal) {
    out.component = value.component as string;
    out.terminal = value.terminal as string;
  }
  if (hasBreadboard) out.breadboard = value.breadboard as string;
  if (hasSite) {
    out.site = parseBreadboardSite(value.site, `${path}.site`);
  }
  return out;
}

/**
 * Parse one electrical {@link Net} from `nets[]`.
 * @param value Raw net object.
 * @param index Array index (for error paths).
 */
function parseNet(value: unknown, index: number): Net {
  const path = `nets[${index}]`;
  if (!isRecord(value))
    throw new ProjectParseError(`${path} must be an object`);
  const { id, terminals } = value;
  if (typeof id !== "string" || !id)
    throw new ProjectParseError(`${path}.id is required`);
  if (!Array.isArray(terminals))
    throw new ProjectParseError(`${path}.terminals must be an array`);

  const parsed = terminals.map((t, ti) =>
    parseNetTerminal(t, `${path}.terminals[${ti}]`),
  );

  return { id, terminals: parsed };
}

/**
 * Parse one visual {@link Wire} from `wires[]`.
 * @param value Raw wire object.
 * @param index Array index (for error paths).
 */
function parseWire(value: unknown, index: number): Wire {
  const path = `wires[${index}]`;
  if (!isRecord(value))
    throw new ProjectParseError(`${path} must be an object`);
  const { id, type, net, color, connectors, from, to, points } = value;
  if (typeof id !== "string" || !id)
    throw new ProjectParseError(`${path}.id is required`);
  if (typeof net !== "string" || !net)
    throw new ProjectParseError(`${path}.net is required`);
  if (!Array.isArray(points) || points.length < 2) {
    throw new ProjectParseError(`${path}.points must have at least 2 points`);
  }

  const parsedType = parseWireType(type, `${path}.type`);
  const parsedConnectors = parseWireConnectors(connectors, `${path}.connectors`);
  const templateConnectors = parsedType
    ? getWireTemplate(parsedType).connectors
    : undefined;

  if (
    parsedType &&
    parsedConnectors &&
    !wireConnectorsMatchTemplate(parsedConnectors, templateConnectors!)
  ) {
    throw new ProjectParseError(
      `${path}.connectors must match ${parsedType}`,
    );
  }

  return {
    id,
    type: parsedType,
    net,
    color: typeof color === "string" ? color : undefined,
    connectors: parsedConnectors ?? templateConnectors,
    from: parseWireEndpoint(from, `${path}.from`),
    to: parseWireEndpoint(to, `${path}.to`),
    points: points.map((p, pi) => parseVec3(p, `${path}.points[${pi}]`)),
  };
}

/**
 * Parse optional visual wire endpoint metadata (component terminal or breadboard hole).
 * @param value Raw endpoint object.
 * @param path JSON path for errors.
 */
function parseWireEndpoint(
  value: unknown,
  path: string,
): Wire["from"] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!isRecord(value))
    throw new ProjectParseError(`${path} must be an object`);
  const hasComponent =
    typeof value.component === "string" && value.component !== "";
  const hasTerminal =
    typeof value.terminal === "string" && value.terminal !== "";
  const hasBreadboard =
    typeof value.breadboard === "string" && value.breadboard !== "";
  const hasSite = value.site !== undefined && value.site !== null;

  if (hasComponent || hasTerminal) {
    if (!hasComponent)
      throw new ProjectParseError(`${path}.component is required`);
    if (!hasTerminal)
      throw new ProjectParseError(`${path}.terminal is required`);
    return {
      component: value.component as string,
      terminal: value.terminal as string,
    };
  }
  if (hasBreadboard || hasSite) {
    if (!hasBreadboard)
      throw new ProjectParseError(`${path}.breadboard is required`);
    if (!hasSite) throw new ProjectParseError(`${path}.site is required`);
    return {
      breadboard: value.breadboard as string,
      site: parseBreadboardSite(value.site, `${path}.site`),
    };
  }
  throw new ProjectParseError(
    `${path} requires component+terminal or breadboard+site`,
  );
}

/**
 * Parse an optional wire template id from project JSON.
 * @param value Raw `wires[].type` value.
 * @param path JSON path for errors.
 */
function parseWireType(value: unknown, path: string): WireTypeId | undefined {
  if (value === undefined || value === null) return undefined;
  if (
    value !== "jumper-mm" &&
    value !== "jumper-mf" &&
    value !== "jumper-ff"
  ) {
    throw new ProjectParseError(`${path} must be a jumper wire type`);
  }
  return value;
}

/**
 * Parse optional jumper connector metadata on a wire.
 * @param value Raw connectors object.
 * @param path JSON path for errors.
 */
function parseWireConnectors(
  value: unknown,
  path: string,
): Wire["connectors"] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!isRecord(value))
    throw new ProjectParseError(`${path} must be an object`);
  const { start, end } = value;
  if (start !== "male" && start !== "female") {
    throw new ProjectParseError(`${path}.start must be "male" or "female"`);
  }
  if (end !== "male" && end !== "female") {
    throw new ProjectParseError(`${path}.end must be "male" or "female"`);
  }
  return { start, end };
}

/**
 * Whether stored oriented connectors still represent a selected jumper template.
 * @param connectors Stored connector orientation.
 * @param template Connector pair from the catalog template.
 */
function wireConnectorsMatchTemplate(
  connectors: WireConnectors,
  template: WireConnectors,
): boolean {
  return (
    (connectors.start === template.start && connectors.end === template.end) ||
    (connectors.start === template.end && connectors.end === template.start)
  );
}

/**
 * Parse untrusted JSON into a validated {@link BerryProject}.
 * Runs structural parsing and {@link validateProjectGraph}.
 * @param input Usually `JSON.parse` result.
 * @throws {@link ProjectParseError} On invalid shape or graph.
 */
export function parseBerryProject(input: unknown): BerryProject {
  if (!isRecord(input))
    throw new ProjectParseError("Project root must be an object");

  const version = input.version;
  if (version !== BERRY_PROJECT_VERSION) {
    throw new ProjectParseError(`Unsupported version: ${String(version)}`);
  }

  const board = input.board;
  if (typeof board !== "string")
    throw new ProjectParseError("board is required");
  getBoardProfile(board as BoardId);

  const metadata = input.metadata;
  if (!isRecord(metadata) || typeof metadata.name !== "string") {
    throw new ProjectParseError("metadata.name is required");
  }

  const components = Array.isArray(input.components)
    ? input.components.map(parseComponent)
    : [];
  const nets = Array.isArray(input.nets) ? input.nets.map(parseNet) : [];
  const wires = Array.isArray(input.wires) ? input.wires.map(parseWire) : [];

  const project: BerryProject = {
    version: BERRY_PROJECT_VERSION,
    board: board as BoardId,
    metadata: {
      name: metadata.name,
      description:
        typeof metadata.description === "string"
          ? metadata.description
          : undefined,
      createdAt:
        typeof metadata.createdAt === "string" ? metadata.createdAt : undefined,
      updatedAt:
        typeof metadata.updatedAt === "string" ? metadata.updatedAt : undefined,
    },
    components,
    nets,
    wires,
  };

  validateProjectGraph(project);
  return project;
}

/**
 * Serialize a project to JSON string.
 * @param project Valid Berry project.
 * @param pretty When true, indent with 2 spaces (default true).
 */
export function serializeBerryProject(
  project: BerryProject,
  pretty = true,
): string {
  return JSON.stringify(project, null, pretty ? 2 : undefined);
}

/**
 * Map a stored wire endpoint to a connect-time reference for gender checks.
 * @param endpoint Wire `from` / `to` field.
 */
function wireEndpointToRef(endpoint: WireEndpoint): WireEndpointRef | null {
  if (endpoint.breadboard && endpoint.site) {
    return { breadboardId: endpoint.breadboard, site: endpoint.site };
  }
  if (endpoint.component && endpoint.terminal) {
    return { componentId: endpoint.component, terminalId: endpoint.terminal };
  }
  return null;
}

/**
 * Cross-check references inside a parsed project (ids, nets, terminals, wires).
 * @param project Already shape-valid project.
 * @throws {@link ProjectParseError} On duplicate ids, dangling refs, or invalid terminals.
 */
export function validateProjectGraph(project: BerryProject): void {
  const componentIds = new Set(project.components.map((c) => c.id));
  if (componentIds.size !== project.components.length) {
    throw new ProjectParseError("Duplicate component ids");
  }

  for (const c of project.components) {
    if (c.parent && !componentIds.has(c.parent)) {
      throw new ProjectParseError(
        `Component ${c.id} references unknown parent ${c.parent}`,
      );
    }
    if (c.placement) {
      const parent = c.parent
        ? project.components.find((p) => p.id === c.parent)
        : undefined;
      if (!parent || parent.type !== "breadboard-full") {
        throw new ProjectParseError(
          `Component ${c.id} has placement but parent is not a breadboard`,
        );
      }
      for (const msg of validateInstancePlacement(c)) {
        throw new ProjectParseError(msg);
      }
      const holeErrors = findHoleOccupancyConflicts(project, parent.id);
      if (holeErrors.length > 0) {
        throw new ProjectParseError(holeErrors[0]);
      }
    }
  }

  for (const conflict of findBreadboardTieNetConflicts(project)) {
    throw new ProjectParseError(conflict.message);
  }

  const netIds = new Set(project.nets.map((n) => n.id));

  for (const net of project.nets) {
    if (net.terminals.length < 2) {
      throw new ProjectParseError(
        `Net ${net.id} must connect at least 2 terminals`,
      );
    }
    for (const t of net.terminals) {
      if (t.component) {
        if (!componentIds.has(t.component)) {
          throw new ProjectParseError(
            `Net ${net.id} references unknown component ${t.component}`,
          );
        }
        if (!t.terminal) {
          throw new ProjectParseError(
            `Net ${net.id}: component ${t.component} missing terminal id`,
          );
        }
        const def = project.components.find((c) => c.id === t.component)!;
        const catalog = getComponentDefinition(def.type);
        if (
          catalog.terminals.length > 0 &&
          !catalog.terminals.some((term) => term.id === t.terminal)
        ) {
          throw new ProjectParseError(
            `Net ${net.id}: terminal ${t.terminal} is not defined on ${def.type}`,
          );
        }
      }
      if (t.breadboard) {
        if (!componentIds.has(t.breadboard)) {
          throw new ProjectParseError(
            `Net ${net.id} references unknown breadboard ${t.breadboard}`,
          );
        }
        const bb = project.components.find((c) => c.id === t.breadboard)!;
        if (bb.type !== "breadboard-full") {
          throw new ProjectParseError(
            `Net ${net.id}: ${t.breadboard} is not a breadboard`,
          );
        }
        if (!t.site) {
          throw new ProjectParseError(
            `Net ${net.id}: breadboard endpoint missing site`,
          );
        }
      }
    }
  }

  for (const wire of project.wires) {
    if (!netIds.has(wire.net)) {
      throw new ProjectParseError(
        `Wire ${wire.id} references unknown net ${wire.net}`,
      );
    }
    if (wire.type && !isWireTemplate(wire.type)) {
      throw new ProjectParseError(`Wire ${wire.id} has unknown jumper type ${wire.type}`);
    }
    if (
      wire.type &&
      wire.connectors &&
      !wireConnectorsMatchTemplate(wire.connectors, getWireTemplate(wire.type).connectors)
    ) {
      throw new ProjectParseError(`Wire ${wire.id} connectors do not match ${wire.type}`);
    }
    if (wire.connectors && wire.from && wire.to) {
      const fromRef = wireEndpointToRef(wire.from);
      const toRef = wireEndpointToRef(wire.to);
      if (
        fromRef &&
        toRef &&
        !wireConnectorsFitEndpoints(fromRef, toRef, wire.connectors)
      ) {
        throw new ProjectParseError(
          `Wire ${wire.id}: jumper ends must be opposite gender to each endpoint (male–female only)`,
        );
      }
    }
    for (const [label, endpoint] of [
      ["from", wire.from],
      ["to", wire.to],
    ] as const) {
      if (!endpoint) continue;
      if (endpoint.breadboard) {
        if (!componentIds.has(endpoint.breadboard)) {
          throw new ProjectParseError(
            `Wire ${wire.id}.${label} references unknown breadboard ${endpoint.breadboard}`,
          );
        }
        const bb = project.components.find(
          (c) => c.id === endpoint.breadboard,
        )!;
        if (bb.type !== "breadboard-full") {
          throw new ProjectParseError(
            `Wire ${wire.id}.${label}: ${endpoint.breadboard} is not a breadboard`,
          );
        }
        if (!endpoint.site) {
          throw new ProjectParseError(
            `Wire ${wire.id}.${label}: breadboard endpoint missing site`,
          );
        }
        continue;
      }
      if (!endpoint.component || !componentIds.has(endpoint.component)) {
        throw new ProjectParseError(
          `Wire ${wire.id}.${label} references unknown component ${endpoint.component}`,
        );
      }
      const instance = project.components.find(
        (c) => c.id === endpoint.component,
      )!;
      const catalog = getComponentDefinition(instance.type);
      if (
        catalog.terminals.length > 0 &&
        !catalog.terminals.some((term) => term.id === endpoint.terminal)
      ) {
        throw new ProjectParseError(
          `Wire ${wire.id}.${label}: terminal ${endpoint.terminal} is not defined on ${instance.type}`,
        );
      }
    }
  }
}

/**
 * Parse a JSON string into a validated {@link BerryProject}.
 * @param json Project file contents.
 * @throws {@link ProjectParseError} On invalid JSON or project data.
 */
export function loadBerryProjectFromJson(json: string): BerryProject {
  return parseBerryProject(JSON.parse(json) as unknown);
}
