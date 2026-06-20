import type { BreadboardPlacement, BreadboardSite } from './breadboard'

/** Schema version for Berry project JSON. */
export const BERRY_PROJECT_VERSION = 1 as const

export type { BreadboardPlacement, BreadboardSite } from './breadboard'

export type BerryProjectVersion = typeof BERRY_PROJECT_VERSION

/** 3D vector. 2D Studio uses x/y; keep z = 0 until 3D view is enabled. */
export interface Vec3 {
  x: number
  y: number
  z: number
}

export interface Transform {
  position: Vec3
  /** Euler angles in degrees. 2D primarily uses rotation.z */
  rotation?: Vec3
  /** Uniform scale (number) or per-axis scale (Vec3). Defaults to 1. */
  scale?: number | Vec3
}

export interface ProjectMetadata {
  name: string
  description?: string
  createdAt?: string
  updatedAt?: string
}

export type BoardId = 'esp32-devkit-v1' | 'arduino-uno'

/** Catalog ids for physical jumper wire templates. */
export type WireTypeId = 'jumper-mm' | 'jumper-mf' | 'jumper-ff'

export type ComponentTypeId =
  | 'breadboard-full'
  | 'esp32-devkit-v1'
  | 'arduino-uno'
  | 'led-5mm'
  | 'resistor-220'
  | 'resistor-1k'
  | 'resistor-2k'
  | 'push-button'
  | 'hc-sr04'
  | 'bme280'
  | 'servo-sg90'
  | 'lcd-1602-i2c'
  | 'max7219-led-matrix'
  | WireTypeId

export type TerminalKind =
  | 'power_in'
  | 'power_out'
  | 'ground'
  | 'gpio'
  | 'analog_in'
  | 'passive'
  | 'i2c_sda'
  | 'i2c_scl'
  | 'spi_mosi'
  | 'spi_sck'
  | 'spi_cs'
  | 'uart_tx'
  | 'uart_rx'
  | 'pwm'

export interface TerminalDefinition {
  /** Terminal id used in nets (e.g. "IO4", "VCC", "pin1"). */
  id: string
  label?: string
  kind: TerminalKind
  /** Nominal voltage for power pins (volts). */
  voltage?: number
  /** Extra roles, e.g. "i2c", "strapping". */
  capabilities?: string[]
}

/**
 * Studio tray / UI grouping for catalog parts.
 * Distinct from `project.board`, which is the firmware target (dev board profile).
 */
export type ComponentGroup =
  | 'microcontrollers'
  | 'breadboards'
  | 'wires'
  | 'inputs'
  | 'displays'
  | 'sensors'
  | 'actuators'
  | 'passives'
  | 'unsupported'

/** Jumper end connector style (breadboard pin vs socket). */
export type WireConnectorGender = 'male' | 'female'

/** Connector types at the start and end of a visual wire. */
export interface WireConnectors {
  start: WireConnectorGender
  end: WireConnectorGender
}

/** Catalog metadata for tray wire templates (not placed as components). */
export interface WireTemplateDefinition {
  connectors: WireConnectors
  defaultColor: WireColor
}

export interface ComponentDefinition {
  id: ComponentTypeId
  name: string
  /** Tray section in Studio (e.g. microcontrollers, sensors). */
  group: ComponentGroup
  terminals: TerminalDefinition[]
  /** When set, this tray entry selects a wire style for the Connect tool. */
  wireTemplate?: WireTemplateDefinition
}

/** One section of the component tray for Studio UI. */
export interface CatalogTraySection {
  group: ComponentGroup
  label: string
  parts: ComponentDefinition[]
}

export interface ComponentInstance {
  id: string
  type: ComponentTypeId
  transform: Transform
  /** Parent instance (e.g. snapped onto a breadboard). */
  parent?: string | null
  /** Named attach point on the parent, when applicable. */
  anchor?: string | null
  /**
   * Breadboard hole per terminal when `parent` is a breadboard.
   * Row/column tie groups determine shared copper on the bench.
   */
  placement?: BreadboardPlacement
}

/** One pin leg on a component, listed as part of a net. */
export interface NetTerminal {
  /** Instance id from `components[].id` (required for part pins). */
  component?: string
  /** Terminal id from the component catalog (e.g. "IO13", "VCC", "pin1"). */
  terminal?: string
  /** Breadboard instance id when the endpoint is a hole/rail only (e.g. jumper). */
  breadboard?: string
  /** Which hole or rail on that breadboard. */
  site?: BreadboardSite
}

/**
 * Electrical net: every listed terminal is the same equipotential node
 * (physically connected). Used for validation, codegen, and simulation —
 * not for how the wire is drawn (see `Wire`).
 */
export interface Net {
  id: string
  terminals: NetTerminal[]
}

export type WireColor =
  | 'red'
  | 'black'
  | 'yellow'
  | 'green'
  | 'blue'
  | 'orange'
  | 'purple'
  | 'white'
  | string

/**
 * Endpoint of a visual wire route: either a component terminal
 * (`component` + `terminal`) or a bare breadboard hole/rail (`breadboard` + `site`).
 */
export interface WireEndpoint {
  component?: string
  terminal?: string
  /** Breadboard instance id when the endpoint plugs straight into a hole/rail. */
  breadboard?: string
  /** Which hole or rail on that breadboard. */
  site?: BreadboardSite
}

/** How Studio updates a wire path when endpoints move. */
export type WireRouteMode = 'auto' | 'manual'

/**
 * Visual wire in the scene: a colored polyline for Studio rendering.
 * Must reference a `Net` id; multiple wires can share one net.
 */
export interface Wire {
  id: string
  /** Catalog jumper template id, e.g. `jumper-mm`, used for project JSON and UI labels. */
  type?: WireTypeId
  /** Id of the `Net` this wire draws. */
  net: string
  color?: WireColor
  /** Jumper connector styles at polyline start/end. */
  connectors?: WireConnectors
  /** Terminal endpoints this visual jumper connects. */
  from?: WireEndpoint
  to?: WireEndpoint
  /**
   * `manual` keeps bend points when endpoints move; `auto` recomputes the path.
   * Breadboard jumpers default to stored `points` even before the first manual edit.
   */
  route?: WireRouteMode
  /** Polyline in scene space (xyz). 2D: z = 0 on all points. */
  points: Vec3[]
}

export interface BerryProject {
  version: BerryProjectVersion
  board: BoardId
  metadata: ProjectMetadata
  components: ComponentInstance[]
  nets: Net[]
  wires: Wire[]
}

export interface BoardPin {
  id: string
  label: string
  kind: TerminalKind
  gpio?: number
  notes?: string
}

export interface BoardProfile {
  id: BoardId
  name: string
  operatingVoltage: number
  pins: BoardPin[]
  /** Default I2C mapping on this board. */
  i2c?: { sda: string; scl: string }
}
