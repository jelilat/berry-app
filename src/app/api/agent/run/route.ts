import { NextResponse } from 'next/server'
import { runAgentWorkflow } from '@/lib/agent/workflow'
import { parseBerryProject, ProjectParseError } from '@/lib/project/io'
import type { AgentRunInput } from '@/lib/agent/types'

/**
 * Type guard: value is a non-null, non-array object.
 * @param value Untrusted JSON value.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Parse the agent run request body.
 * @param body Parsed JSON request body.
 */
function parseAgentRunInput(body: unknown): AgentRunInput {
  if (!isRecord(body)) {
    throw new Error('Request body must be an object')
  }

  const prompt = body.prompt
  if (typeof prompt !== 'string' || prompt.trim().length === 0) {
    throw new Error('Missing prompt')
  }

  const mode = body.mode
  const input: AgentRunInput = {
    prompt: prompt.trim(),
    mode:
      mode === 'real' || mode === 'deterministic' || mode === 'auto'
        ? mode
        : 'auto',
  }
  if ('project' in body && body.project !== undefined) {
    input.project = parseBerryProject(body.project)
  }
  if (isRecord(body.answers)) {
    input.answers = Object.fromEntries(
      Object.entries(body.answers).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
    )
  }
  return input
}

/**
 * POST /api/agent/run — run the Phase 6 AI workflow foundation.
 */
export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  try {
    const input = parseAgentRunInput(body)
    const result = await runAgentWorkflow(input)
    const status = result.status === 'failed' ? 500 : 200
    return NextResponse.json(result, { status })
  } catch (error) {
    if (error instanceof ProjectParseError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    const message = error instanceof Error ? error.message : 'Agent run failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
