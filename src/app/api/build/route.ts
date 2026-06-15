import { NextResponse } from 'next/server'
import { compileFirmwareEdge } from '@/lib/build/compile-edge'
import type { FirmwareSourceFiles } from '@/lib/build/types'
import { parseBerryProject, ProjectParseError } from '@/lib/project/io'
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
 * Parse firmware files from the build request body.
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
 * POST /api/build — validate a project and produce a deterministic mock firmware artifact.
 * @param request Incoming JSON request.
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

  const files = extractFirmwareFiles(body)
  if (!files) {
    return NextResponse.json({ error: 'Missing files["src/main.cpp"] in request body' }, { status: 400 })
  }

  try {
    const project = parseBerryProject(body.project)
    const validationResults: ValidationResult[] = validate(project)
    if (hasValidationErrors(validationResults)) {
      return NextResponse.json(
        {
          ok: false,
          backend: 'mock',
          diagnostics: validationResults
            .filter((result) => result.severity === 'error')
            .map((result) => ({ severity: 'error', message: result.message })),
          validationResults,
          error: 'Fix wiring errors before building',
        },
        { status: 400 },
      )
    }

    const result = await compileFirmwareEdge({ project, files })
    return NextResponse.json(result, { status: result.ok ? 200 : 400 })
  } catch (error) {
    if (error instanceof ProjectParseError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    const message = error instanceof Error ? error.message : 'Build failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
