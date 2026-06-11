import type { BerryProject } from '@/lib/project/types'
import type { FirmwareSourceFiles } from '@/lib/build/types'

/** Outcome of a firmware simulation run. */
export type SimulationStatus = 'passed' | 'failed' | 'unsupported'

/** Severity for simulation diagnostics (distinct from wiring validation). */
export type SimulationDiagnosticSeverity = 'error' | 'warning' | 'info'

/** Stable machine-readable simulation diagnostic id. */
export type SimulationCode =
  | 'sim.missing_artifact'
  | 'sim.unsupported_circuit'
  | 'sim.unsupported_board'
  | 'sim.unsupported_firmware'
  | 'sim.blink_pass'
  | 'sim.blink_boot'
  | 'sim.gpio_trace'

/** One simulation finding surfaced in Studio or API responses. */
export interface SimulationDiagnostic {
  code: SimulationCode
  severity: SimulationDiagnosticSeverity
  message: string
}

/** Serial or simulator log line with deterministic ordering. */
export interface SimulationLogLine {
  /** Milliseconds from simulation start (mock clock). */
  offsetMs: number
  /** Log channel — serial mirrors UART monitor output. */
  source: 'serial' | 'sim'
  text: string
}

/** Optional GPIO or peripheral trace for richer mock runs. */
export interface SimulationTrace {
  kind: 'gpio'
  pin: number
  value: 'HIGH' | 'LOW'
  offsetMs: number
}

/** Build artifact metadata required before simulation can run. */
export interface SimulationArtifactInput {
  firmwareHash: string
}

/** Input for {@link simulateProject}. */
export interface SimulateProjectInput {
  project: BerryProject
  artifact: SimulationArtifactInput
  /** Firmware sources used to build the artifact being simulated. */
  files: FirmwareSourceFiles
}

/** Result contract consumed by Studio, APIs, and future deploy gating. */
export interface SimulationResult {
  status: SimulationStatus
  firmwareHash: string
  logs: SimulationLogLine[]
  errors: SimulationDiagnostic[]
  traces?: SimulationTrace[]
}
