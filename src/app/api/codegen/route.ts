import { NextResponse } from 'next/server'
import { generateFirmwareFromProject } from '@/lib/codegen/generate'
import { parseBerryProject, ProjectParseError } from '@/lib/project/io'

/**
 * Type guard: value is a non-null, non-array object.
 * @param value Untrusted JSON value.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * POST /api/codegen — generate firmware source and pin map from a project graph.
 */
export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const projectInput = isRecord(body) && 'project' in body ? body.project : body

  try {
    const project = parseBerryProject(projectInput)
    const result = generateFirmwareFromProject(project)
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof ProjectParseError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    const message = error instanceof Error ? error.message : 'Codegen failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
