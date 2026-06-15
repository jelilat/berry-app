import { NextResponse } from 'next/server'
import { computeFirmwareHash } from '@/lib/build/hash'
import { loadBuildArtifact } from '@/lib/build/artifacts'
import type { FirmwareSourceFiles } from '@/lib/build/types'
import { parseBerryProject, ProjectParseError } from '@/lib/project/io'
import {
  SimulationInputError,
  simulateProject,
  type SimulationArtifactInput,
  type SimulationResult,
} from '@/lib/simulation'
import { hasValidationErrors, validate } from '@/lib/validation'
import type { ValidationResult } from '@/lib/validation'

export const runtime = 'edge'

/**
 * Type guard: value is a non-null, non-array object.
 * @param value Untrusted JSON value.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Extract build artifact metadata from the POST body.
 * @param body Parsed JSON body.
 */
function extractArtifact(body: unknown): SimulationArtifactInput | null {
  if (!isRecord(body) || !isRecord(body.artifact)) {
    return null
  }
  const firmwareHash = body.artifact.firmwareHash
  if (typeof firmwareHash !== 'string' || firmwareHash.trim().length === 0) {
    return null
  }
  return { firmwareHash: firmwareHash.trim() }
}

/**
 * Parse firmware source files from the request body.
 * @param body Parsed JSON body.
 */
function extractFirmwareFiles(body: unknown): FirmwareSourceFiles | null {
  if (!isRecord(body) || !isRecord(body.files)) {
    return null
  }

  const mainCpp = body.files['src/main.cpp']
  if (typeof mainCpp !== 'string') {
    return null
  }

  const platformioIni = body.files['platformio.ini']
  const files: FirmwareSourceFiles = { 'src/main.cpp': mainCpp }
  if (typeof platformioIni === 'string') {
    files['platformio.ini'] = platformioIni
  }
  return files
}

/**
 * POST /api/simulate — validate wiring, require build artifact hash, run mock simulation.
 */
export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!isRecord(body) || !('project' in body)) {
    return NextResponse.json({ error: 'Missing project in request body' }, { status: 400 })
  }

  const artifact = extractArtifact(body)
  if (!artifact) {
    return NextResponse.json(
      { error: 'Missing artifact.firmwareHash from a successful build' },
      { status: 400 },
    )
  }

  const files = extractFirmwareFiles(body)
  if (!files) {
    return NextResponse.json(
      { error: 'Missing files["src/main.cpp"] from the build that produced artifact.firmwareHash' },
      { status: 400 },
    )
  }

  try {
    const project = parseBerryProject(body.project)
    const validationResults: ValidationResult[] = validate(project)

    if (hasValidationErrors(validationResults)) {
      return NextResponse.json(
        {
          ok: false,
          validationResults,
          error: 'Fix wiring errors before simulating',
        },
        { status: 400 },
      )
    }

    const expectedHash = await computeFirmwareHash(project, files)
    if (artifact.firmwareHash !== expectedHash) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'artifact.firmwareHash does not match the current project and firmware files. Build again before simulating.',
        },
        { status: 400 },
      )
    }

    const cachedArtifact = await loadBuildArtifact(artifact.firmwareHash)
    if (!cachedArtifact) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'No cached build artifact exists for artifact.firmwareHash. Build firmware before simulating.',
        },
        { status: 400 },
      )
    }

    const result: SimulationResult = simulateProject({ project, artifact, files })
    return NextResponse.json({ ok: result.status === 'passed', result })
  } catch (error) {
    if (error instanceof ProjectParseError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (error instanceof SimulationInputError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    const message = error instanceof Error ? error.message : 'Simulation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
