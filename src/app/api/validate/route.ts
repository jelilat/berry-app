import { NextResponse } from 'next/server'
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
 * Extract project payload from POST body (`{ project }` or raw project root).
 * @param body Parsed JSON body.
 */
function extractProjectInput(body: unknown): unknown {
  if (isRecord(body) && 'project' in body) {
    return body.project
  }
  return body
}

/**
 * POST /api/validate — parse project JSON and return wiring validation results.
 */
export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  try {
    const project = parseBerryProject(extractProjectInput(body))
    const results: ValidationResult[] = validate(project)
    return NextResponse.json({
      ok: !hasValidationErrors(results),
      results,
    })
  } catch (error) {
    if (error instanceof ProjectParseError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    const message = error instanceof Error ? error.message : 'Validation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
