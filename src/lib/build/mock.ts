import { hasValidationErrors, validate } from '@/lib/validation'
import { computeFirmwareHash } from './hash'
import { persistBuildArtifact } from './artifacts'
import { resolvePlatformioEnvironment, resolvePlatformioIni } from './platformio-ini'
import type { BuildDiagnostic, BuildResult, CompilerAdapter, MockCompileInput } from './types'

/**
 * Marker that forces the mock compiler to emit one deterministic compile error.
 */
export const BERRY_MOCK_COMPILE_ERROR_MARKER = 'BERRY_MOCK_COMPILE_ERROR'

/**
 * True when a source file asks the mock compiler to fail.
 * @param source Firmware source text.
 */
function hasMockCompileErrorMarker(source: string): boolean {
  return source.includes(BERRY_MOCK_COMPILE_ERROR_MARKER)
}

/**
 * Build deterministic pseudo firmware bytes from a firmware hash.
 * @param firmwareHash Stable firmware hash.
 */
function createMockFirmwareBinary(firmwareHash: string): Uint8Array {
  const header = `berry.mock-firmware:${firmwareHash}\n`
  return Buffer.from(header.repeat(1024), 'utf8')
}

/**
 * Compile firmware with Berry's deterministic mock backend.
 * @param input Project graph and firmware files.
 */
export async function compileWithMock(input: MockCompileInput): Promise<BuildResult> {
  const validationResults = validate(input.project)
  if (hasValidationErrors(validationResults)) {
    return {
      ok: false,
      backend: 'mock',
      diagnostics: validationResults
        .filter((result) => result.severity === 'error')
        .map<BuildDiagnostic>((result) => ({
          severity: 'error',
          message: result.message,
        })),
    }
  }

  const mainCpp = input.files['src/main.cpp']
  if (!mainCpp || mainCpp.trim().length === 0) {
    return {
      ok: false,
      backend: 'mock',
      diagnostics: [
        {
          severity: 'error',
          file: 'src/main.cpp',
          message: 'Missing src/main.cpp firmware source.',
        },
      ],
    }
  }

  if (hasMockCompileErrorMarker(mainCpp)) {
    return {
      ok: false,
      backend: 'mock',
      diagnostics: [
        {
          severity: 'error',
          file: 'src/main.cpp',
          message: 'Mock compiler error marker was found in src/main.cpp.',
        },
      ],
    }
  }

  const files = {
    ...input.files,
    'platformio.ini': input.files['platformio.ini'] ?? resolvePlatformioIni(input.project.board),
  }
  const firmwareHash = computeFirmwareHash(input.project, files)
  const environment = resolvePlatformioEnvironment(input.project.board)
  const binaryPath = `.pio/build/${environment}/firmware.bin`
  const artifact = await persistBuildArtifact(
    firmwareHash,
    input.project.board,
    createMockFirmwareBinary(firmwareHash),
    binaryPath,
    Object.keys(files).sort(),
  )

  return {
    ok: true,
    backend: 'mock',
    diagnostics: [],
    artifact,
  }
}

/** Deterministic compiler adapter for tests, demos, and hosted preview builds. */
export const mockCompilerAdapter: CompilerAdapter = {
  backend: 'mock',
  compile: compileWithMock,
}
