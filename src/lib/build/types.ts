import type { BoardId } from '@/lib/project/types'
import type { BerryProject } from '@/lib/project/types'

/** Firmware files keyed by project-relative path. */
export type FirmwareSourceFiles = Record<string, string>

/** Build backend used to produce a firmware artifact. */
export type BuildBackend = 'mock' | 'local' | 'remote'

/** Compiler diagnostic severity surfaced in Studio. */
export type BuildDiagnosticSeverity = 'error' | 'warning' | 'info'

/** One build diagnostic emitted by the compile backend. */
export interface BuildDiagnostic {
  severity: BuildDiagnosticSeverity
  message: string
  file?: string
  line?: number
  column?: number
  raw?: string
}

/** Metadata for a compiled firmware artifact. */
export interface BuildArtifact {
  board: BoardId
  firmwareHash: string
  files: string[]
  binaryPath: string
  binarySizeBytes?: number
  firmwareHashAlgorithm?: 'sha256'
  filename?: string
  downloadUrl?: string
  contentType?: string
  binary?: Uint8Array
  createdAt: string
}

/** Cached artifact record with binary bytes available for download. */
export interface CachedBuildArtifact extends BuildArtifact {
  filename: string
  downloadUrl: string
  contentType: string
  binary: Uint8Array
}

/** Result returned by the build API and agent workflow. */
export type BuildResult =
  | {
      ok: true
      backend: BuildBackend
      diagnostics: BuildDiagnostic[]
      artifact: BuildArtifact
    }
  | {
      ok: false
      backend: BuildBackend
      diagnostics: BuildDiagnostic[]
      artifact?: undefined
    }

/** Input accepted by the deterministic mock compiler. */
export interface BuildInput {
  project: BerryProject
  files: FirmwareSourceFiles
}

/** Compiler backend adapter selected by the build config. */
export interface CompilerAdapter {
  backend: BuildBackend
  compile: (input: BuildInput) => Promise<BuildResult>
}

/** Backward-compatible name for the deterministic mock compiler input. */
export type MockCompileInput = BuildInput
