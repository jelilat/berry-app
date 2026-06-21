import { NextResponse } from 'next/server'
import {
  hostedAgentProjectErrorMessage,
  normalizeHostedAgentRunJson,
} from '@/lib/agent/proxy-response'
import type { AgentBackendRunRecord } from '@/lib/agent/types'
import {
  agentUsageLimitResponse,
  checkAgentUsageLimit,
  recordAgentUsageFromRun,
} from '@/lib/agent/usage'

export const runtime = 'edge'

const DEFAULT_AGENT_API_ORIGIN = 'http://localhost:8080'

/**
 * Type guard: value is a non-null, non-array object.
 * @param value Untrusted JSON value.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Resolve the hosted agent API origin from environment.
 */
function agentApiOrigin(): string {
  return (
    process.env.BERRY_BUILD_API_URL?.trim() ||
    process.env.BERRY_AGENT_API_URL?.trim() ||
    DEFAULT_AGENT_API_ORIGIN
  ).replace(/\/+$/, '')
}

/**
 * Build headers for hosted agent API JSON requests.
 */
function agentApiHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  const token = process.env.BERRY_BUILD_API_TOKEN?.trim()
  if (token) {
    headers.authorization = `Bearer ${token}`
  }
  return headers
}

/**
 * Validate that a route parameter looks like a backend run id.
 * @param runId Raw run id route segment.
 */
function parseRunId(runId: string | undefined): string {
  const cleanRunId = runId?.trim()
  if (!cleanRunId) {
    throw new Error('Missing run id')
  }
  return cleanRunId
}

/**
 * Parse clarification answers before forwarding to the hosted backend.
 * @param body Parsed JSON request body.
 * @throws Error when answers are missing or malformed.
 */
function parseAnswersBody(body: unknown): { answers: Record<string, string> } {
  if (!isRecord(body) || !isRecord(body.answers)) {
    throw new Error('Missing answers')
  }
  const answers = Object.fromEntries(
    Object.entries(body.answers).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  )
  if (Object.keys(answers).length === 0) {
    throw new Error('Missing answers')
  }
  return { answers }
}

/**
 * Return a JSON response while preserving the hosted API status code.
 * @param response Hosted API fetch response.
 */
async function proxyJsonResponse(request: Request, response: Response): Promise<NextResponse> {
  const json = await response.json().catch(() => ({ error: 'Agent API returned invalid JSON' }))
  if (!response.ok) {
    return NextResponse.json(json, { status: response.status })
  }
  try {
    const normalized = normalizeHostedAgentRunJson(json) as AgentBackendRunRecord
    await recordAgentUsageFromRun(request, normalized)
    return NextResponse.json(normalized, { status: response.status })
  } catch (error) {
    const message = hostedAgentProjectErrorMessage(error)
    if (message) {
      return NextResponse.json({ error: message }, { status: 502 })
    }
    const fallbackMessage = error instanceof Error ? error.message : 'Could not save Pip usage.'
    return NextResponse.json({ error: fallbackMessage }, { status: 502 })
  }
}

/**
 * POST /api/agent/run/:runId/answers - submit clarification answers.
 * @param request Incoming Next.js request.
 * @param context Dynamic route context.
 */
export async function POST(
  request: Request,
  context: { params: { runId?: string } },
) {
  let runId: string
  try {
    runId = parseRunId(context.params.runId)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid run id'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  let payload: { answers: Record<string, string> }
  try {
    payload = parseAnswersBody(body)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid answers'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  try {
    const usageLimit = await checkAgentUsageLimit(request)
    if (!usageLimit.allowed) {
      return agentUsageLimitResponse(usageLimit)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not check Pip usage.'
    return NextResponse.json({ error: message }, { status: message.includes('Sign in') ? 401 : 502 })
  }

  try {
    const response = await fetch(`${agentApiOrigin()}/v1/agent/runs/${encodeURIComponent(runId)}/answers`, {
      method: 'POST',
      headers: agentApiHeaders(),
      body: JSON.stringify(payload),
    })
    return proxyJsonResponse(request, response)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Agent API request failed'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
