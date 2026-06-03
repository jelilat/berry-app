import { getComponentDefinition } from './catalog'
import { getBoardProfile } from './boards'
import {
  BERRY_PROJECT_VERSION,
  type BerryProject,
  type BoardId,
  type ComponentInstance,
  type ComponentTypeId,
  type Net,
  type Vec3,
  type Wire,
} from './types'

/** Thrown when project JSON is invalid or fails graph validation. */
export class ProjectParseError extends Error {
  /** @param message Human-readable parse or validation error. */
  constructor(message: string) {
    super(message)
    this.name = 'ProjectParseError'
  }
}

/**
 * Type guard: value is a non-null, non-array object.
 * Used while parsing untrusted JSON.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Parse and validate a `{ x, y, z }` object from JSON.
 * @param value Raw JSON fragment.
 * @param path Dot-path for error messages (e.g. `components[0].transform.position`).
 */
function parseVec3(value: unknown, path: string): Vec3 {
  if (!isRecord(value)) throw new ProjectParseError(`${path} must be an object`)
  const { x, y, z } = value
  if (typeof x !== 'number' || typeof y !== 'number' || typeof z !== 'number') {
    throw new ProjectParseError(`${path} requires numeric x, y, z`)
  }
  return { x, y, z }
}

/**
 * Parse one entry from `components[]`.
 * @param value Raw component object.
 * @param index Array index (for error paths).
 */
function parseComponent(value: unknown, index: number): ComponentInstance {
  const path = `components[${index}]`
  if (!isRecord(value)) throw new ProjectParseError(`${path} must be an object`)
  const { id, type, transform, parent, anchor } = value
  if (typeof id !== 'string' || !id) throw new ProjectParseError(`${path}.id is required`)
  if (typeof type !== 'string') throw new ProjectParseError(`${path}.type is required`)
  if (!isRecord(transform)) throw new ProjectParseError(`${path}.transform is required`)

  const position = parseVec3(transform.position, `${path}.transform.position`)
  let rotation: Vec3 | undefined
  if (transform.rotation !== undefined) {
    rotation = parseVec3(transform.rotation, `${path}.transform.rotation`)
  }

  let scale: ComponentInstance['transform']['scale']
  if (transform.scale !== undefined) {
    if (typeof transform.scale === 'number') {
      scale = transform.scale
    } else {
      scale = parseVec3(transform.scale, `${path}.transform.scale`)
    }
  }

  getComponentDefinition(type as ComponentTypeId)

  return {
    id,
    type: type as ComponentTypeId,
    transform: { position, rotation, scale },
    parent: parent === null || parent === undefined ? undefined : String(parent),
    anchor: anchor === null || anchor === undefined ? undefined : String(anchor),
  }
}

/**
 * Parse one electrical {@link Net} from `nets[]`.
 * @param value Raw net object.
 * @param index Array index (for error paths).
 */
function parseNet(value: unknown, index: number): Net {
  const path = `nets[${index}]`
  if (!isRecord(value)) throw new ProjectParseError(`${path} must be an object`)
  const { id, terminals } = value
  if (typeof id !== 'string' || !id) throw new ProjectParseError(`${path}.id is required`)
  if (!Array.isArray(terminals)) throw new ProjectParseError(`${path}.terminals must be an array`)

  const parsed = terminals.map((t, ti) => {
    const tp = `${path}.terminals[${ti}]`
    if (!isRecord(t)) throw new ProjectParseError(`${tp} must be an object`)
    if (typeof t.component !== 'string' || typeof t.terminal !== 'string') {
      throw new ProjectParseError(`${tp} requires component and terminal strings`)
    }
    return { component: t.component, terminal: t.terminal }
  })

  return { id, terminals: parsed }
}

/**
 * Parse one visual {@link Wire} from `wires[]`.
 * @param value Raw wire object.
 * @param index Array index (for error paths).
 */
function parseWire(value: unknown, index: number): Wire {
  const path = `wires[${index}]`
  if (!isRecord(value)) throw new ProjectParseError(`${path} must be an object`)
  const { id, net, color, points } = value
  if (typeof id !== 'string' || !id) throw new ProjectParseError(`${path}.id is required`)
  if (typeof net !== 'string' || !net) throw new ProjectParseError(`${path}.net is required`)
  if (!Array.isArray(points) || points.length < 2) {
    throw new ProjectParseError(`${path}.points must have at least 2 points`)
  }

  return {
    id,
    net,
    color: typeof color === 'string' ? color : undefined,
    points: points.map((p, pi) => parseVec3(p, `${path}.points[${pi}]`)),
  }
}

/**
 * Parse untrusted JSON into a validated {@link BerryProject}.
 * Runs structural parsing and {@link validateProjectGraph}.
 * @param input Usually `JSON.parse` result.
 * @throws {@link ProjectParseError} On invalid shape or graph.
 */
export function parseBerryProject(input: unknown): BerryProject {
  if (!isRecord(input)) throw new ProjectParseError('Project root must be an object')

  const version = input.version
  if (version !== BERRY_PROJECT_VERSION) {
    throw new ProjectParseError(`Unsupported version: ${String(version)}`)
  }

  const board = input.board
  if (typeof board !== 'string') throw new ProjectParseError('board is required')
  getBoardProfile(board as BoardId)

  const metadata = input.metadata
  if (!isRecord(metadata) || typeof metadata.name !== 'string') {
    throw new ProjectParseError('metadata.name is required')
  }

  const components = Array.isArray(input.components)
    ? input.components.map(parseComponent)
    : []
  const nets = Array.isArray(input.nets) ? input.nets.map(parseNet) : []
  const wires = Array.isArray(input.wires) ? input.wires.map(parseWire) : []

  const project: BerryProject = {
    version: BERRY_PROJECT_VERSION,
    board: board as BoardId,
    metadata: {
      name: metadata.name,
      description: typeof metadata.description === 'string' ? metadata.description : undefined,
      createdAt: typeof metadata.createdAt === 'string' ? metadata.createdAt : undefined,
      updatedAt: typeof metadata.updatedAt === 'string' ? metadata.updatedAt : undefined,
    },
    components,
    nets,
    wires,
  }

  validateProjectGraph(project)
  return project
}

/**
 * Serialize a project to JSON string.
 * @param project Valid Berry project.
 * @param pretty When true, indent with 2 spaces (default true).
 */
export function serializeBerryProject(project: BerryProject, pretty = true): string {
  return JSON.stringify(project, null, pretty ? 2 : undefined)
}

/**
 * Cross-check references inside a parsed project (ids, nets, terminals, wires).
 * @param project Already shape-valid project.
 * @throws {@link ProjectParseError} On duplicate ids, dangling refs, or invalid terminals.
 */
export function validateProjectGraph(project: BerryProject): void {
  const componentIds = new Set(project.components.map((c) => c.id))
  if (componentIds.size !== project.components.length) {
    throw new ProjectParseError('Duplicate component ids')
  }

  for (const c of project.components) {
    if (c.parent && !componentIds.has(c.parent)) {
      throw new ProjectParseError(`Component ${c.id} references unknown parent ${c.parent}`)
    }
  }

  const netIds = new Set(project.nets.map((n) => n.id))

  for (const net of project.nets) {
    if (net.terminals.length < 2) {
      throw new ProjectParseError(`Net ${net.id} must connect at least 2 terminals`)
    }
    for (const t of net.terminals) {
      if (!componentIds.has(t.component)) {
        throw new ProjectParseError(`Net ${net.id} references unknown component ${t.component}`)
      }
      const def = project.components.find((c) => c.id === t.component)!
      const catalog = getComponentDefinition(def.type)
      if (catalog.terminals.length > 0 && !catalog.terminals.some((term) => term.id === t.terminal)) {
        throw new ProjectParseError(
          `Net ${net.id}: terminal ${t.terminal} is not defined on ${def.type}`,
        )
      }
    }
  }

  for (const wire of project.wires) {
    if (!netIds.has(wire.net)) {
      throw new ProjectParseError(`Wire ${wire.id} references unknown net ${wire.net}`)
    }
  }
}

/**
 * Parse a JSON string into a validated {@link BerryProject}.
 * @param json Project file contents.
 * @throws {@link ProjectParseError} On invalid JSON or project data.
 */
export function loadBerryProjectFromJson(json: string): BerryProject {
  return parseBerryProject(JSON.parse(json) as unknown)
}
