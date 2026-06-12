import {
  addComponent,
  connectTerminals,
  createStarterProject,
  moveComponent,
  replaceProject,
  type WireEndpointRef,
} from '@/lib/project/mutations'
import type { BerryProject, BoardId, ComponentTypeId, WireColor } from '@/lib/project/types'
import { BERRY_PROJECT_VERSION } from '@/lib/project/types'
import { validateProjectGraph } from '@/lib/project/io'

/** Result returned by one Studio tool call. */
export interface StudioToolResult {
  project: BerryProject
  summary: string
}

/**
 * Set the project board target.
 * @param project Current project graph.
 * @param board Target board id.
 */
export function studioSetBoard(project: BerryProject, board: BoardId): StudioToolResult {
  const next = replaceProject({ ...project, board })
  return { project: next, summary: `Set firmware target to ${board}.` }
}

/**
 * Add one component through the project mutation layer.
 * @param project Current project graph.
 * @param type Catalog component type id.
 * @param id Optional deterministic component id.
 * @param x Scene x coordinate.
 * @param y Scene y coordinate.
 * @param rotationZ Optional z rotation in degrees.
 */
export function studioAddComponent(
  project: BerryProject,
  type: ComponentTypeId,
  id: string,
  x: number,
  y: number,
  rotationZ = 0,
): StudioToolResult {
  const next = addComponent(project, type, { id, x, y, rotationZ })
  return { project: next, summary: `Added ${type} as ${id}.` }
}

/**
 * Move one component through the project mutation layer.
 * @param project Current project graph.
 * @param componentId Component instance id.
 * @param x Scene x coordinate.
 * @param y Scene y coordinate.
 */
export function studioMoveComponent(
  project: BerryProject,
  componentId: string,
  x: number,
  y: number,
): StudioToolResult {
  const next = moveComponent(project, componentId, x, y)
  return { project: next, summary: `Moved ${componentId}.` }
}

/**
 * Connect two terminals through the project mutation layer.
 * @param project Current project graph.
 * @param from First endpoint.
 * @param to Second endpoint.
 * @param color Visual wire color.
 */
export function studioConnectTerminals(
  project: BerryProject,
  from: WireEndpointRef,
  to: WireEndpointRef,
  color: WireColor,
): StudioToolResult {
  const next = connectTerminals(project, from, to, { color })
  return {
    project: next,
    summary: `Connected ${endpointLabel(from)} to ${endpointLabel(to)}.`,
  }
}

/**
 * Create the base project used by the deterministic Phase 6 demo.
 */
export function studioCreateStarterProject(): StudioToolResult {
  const project = createStarterProject()
  return { project, summary: 'Created a breadboard + ESP32 starter bench.' }
}

/**
 * Create the first Phase 6 reference circuit as a validated Studio project.
 */
export function studioCreateEsp32LedBlinkProject(): StudioToolResult {
  const project: BerryProject = {
    version: BERRY_PROJECT_VERSION,
    board: 'esp32-devkit-v1',
    metadata: {
      name: 'ESP32 LED blink',
      description: 'AI-generated reference circuit for the Phase 6 build loop.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    components: [
      {
        id: 'breadboard_1',
        type: 'breadboard-full',
        transform: {
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: 1,
        },
      },
      {
        id: 'esp32_1',
        type: 'esp32-devkit-v1',
        parent: 'breadboard_1',
        anchor: 'center',
        transform: {
          position: { x: 0.04, y: 0.03, z: 0 },
          rotation: { x: 0, y: 0, z: 90 },
          scale: 1,
        },
        placement: {
          sites: {
            IO13: { kind: 'hole', block: 'top', row: 'e', column: 12 },
            GND_R: { kind: 'hole', block: 'top', row: 'f', column: 12 },
          },
        },
      },
      {
        id: 'resistor_1',
        type: 'resistor-220',
        parent: 'breadboard_1',
        transform: {
          position: { x: 0.14, y: 0.05, z: 0 },
          rotation: { x: 0, y: 0, z: 90 },
          scale: 1,
        },
        placement: {
          sites: {
            pin1: { kind: 'hole', block: 'top', row: 'e', column: 18 },
            pin2: { kind: 'hole', block: 'top', row: 'f', column: 18 },
          },
        },
      },
      {
        id: 'led_1',
        type: 'led-5mm',
        parent: 'breadboard_1',
        transform: {
          position: { x: 0.18, y: 0.05, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: 1,
        },
        placement: {
          sites: {
            anode: { kind: 'hole', block: 'top', row: 'e', column: 22 },
            cathode: { kind: 'hole', block: 'top', row: 'e', column: 26 },
          },
        },
      },
    ],
    nets: [
      {
        id: 'net_gnd',
        terminals: [
          {
            component: 'esp32_1',
            terminal: 'GND_R',
            site: { kind: 'hole', block: 'top', row: 'f', column: 12 },
          },
          {
            component: 'led_1',
            terminal: 'cathode',
            site: { kind: 'hole', block: 'top', row: 'e', column: 24 },
          },
        ],
      },
      {
        id: 'net_gpio_led',
        terminals: [
          {
            component: 'esp32_1',
            terminal: 'IO13',
            site: { kind: 'hole', block: 'top', row: 'e', column: 12 },
          },
          {
            component: 'resistor_1',
            terminal: 'pin1',
            site: { kind: 'hole', block: 'top', row: 'e', column: 18 },
          },
        ],
      },
      {
        id: 'net_led_anode',
        terminals: [
          {
            component: 'resistor_1',
            terminal: 'pin2',
            site: { kind: 'hole', block: 'top', row: 'f', column: 18 },
          },
          {
            component: 'led_1',
            terminal: 'anode',
            site: { kind: 'hole', block: 'top', row: 'e', column: 22 },
          },
        ],
      },
    ],
    wires: [
      {
        id: 'wire_gnd',
        net: 'net_gnd',
        color: 'black',
        points: [
          { x: 0.08, y: 0.04, z: 0 },
          { x: 0.16, y: 0.04, z: 0 },
          { x: 0.18, y: 0.05, z: 0 },
        ],
      },
      {
        id: 'wire_signal',
        net: 'net_gpio_led',
        color: 'yellow',
        points: [
          { x: 0.08, y: 0.06, z: 0 },
          { x: 0.14, y: 0.05, z: 0 },
        ],
      },
      {
        id: 'wire_led',
        net: 'net_led_anode',
        color: 'red',
        points: [
          { x: 0.15, y: 0.05, z: 0 },
          { x: 0.18, y: 0.05, z: 0 },
        ],
      },
    ],
  }
  validateProjectGraph(project)
  return { project, summary: 'Created the ESP32 + resistor + LED reference circuit.' }
}

/**
 * Assert that a project remains parseable after agent tool calls.
 * @param project Project graph to validate.
 */
export function studioAssertProjectGraph(project: BerryProject): StudioToolResult {
  validateProjectGraph(project)
  return { project, summary: 'Project graph passed schema checks.' }
}

/**
 * Render a compact label for a tool endpoint.
 * @param endpoint Component terminal or breadboard endpoint.
 */
function endpointLabel(endpoint: WireEndpointRef): string {
  if ('componentId' in endpoint) {
    return `${endpoint.componentId}.${endpoint.terminalId}`
  }
  if (endpoint.site.kind === 'hole') {
    return `${endpoint.breadboardId}.${endpoint.site.row}${endpoint.site.column}`
  }
  return `${endpoint.breadboardId}.${endpoint.site.edge}-${endpoint.site.polarity}-${endpoint.site.column}`
}
