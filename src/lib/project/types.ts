/** Schema version for Berry project JSON. */
export const BERRY_PROJECT_VERSION = 1 as const

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

export type TerminalKind =
  | 'power_in'
  | 'power_out'
  | 'ground'
  | 'gpio'
  | 'analog_in'
  | 'passive'
  | 'i2c_sda'
  | 'i2c_scl'
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

export type ComponentCategory =
  | 'layout'
  | 'board'
  | 'actuator'
  | 'sensor'
  | 'display'
  | 'passive'
  | 'input'

export interface ComponentDefinition {
  id: ComponentTypeId
  name: string
  category: ComponentCategory
  terminals: TerminalDefinition[]
}

export interface ComponentInstance {
  id: string
  type: ComponentTypeId
  transform: Transform
  /** Parent instance (e.g. snapped onto a breadboard). */
  parent?: string | null
  /** Named attach point on the parent, when applicable. */
  anchor?: string | null
}

/** One pin leg on a component, listed as part of a net. */
export interface NetTerminal {
  /** Instance id from `components[].id`. */
  component: string
  /** Terminal id from the component catalog (e.g. "IO13", "VCC", "pin1"). */
  terminal: string
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
 * Visual wire in the scene: a colored polyline for Studio rendering.
 * Must reference a `Net` id; multiple wires can share one net.
 */
export interface Wire {
  id: string
  /** Id of the `Net` this wire draws. */
  net: string
  color?: WireColor
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
