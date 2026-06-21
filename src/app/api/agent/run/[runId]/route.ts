import { NextResponse } from 'next/server'
import {
  hostedAgentProjectErrorMessage,
  normalizeHostedAgentRunJson,
} from '@/lib/agent/proxy-response'
import type { AgentBackendRunRecord } from '@/lib/agent/types'
import { recordAgentUsageFromRun } from '@/lib/agent/usage'

export const runtime = 'edge'

const DEFAULT_AGENT_API_ORIGIN = 'http://localhost:8080'

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
 * GET /api/agent/run/:runId - fetch hosted Berry agent run status.
 * @param _request Incoming Next.js request.
 * @param context Dynamic route context.
 */
export async function GET(
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

  try {
    const response = await fetch(`${agentApiOrigin()}/v1/agent/runs/${encodeURIComponent(runId)}`, {
      method: 'GET',
      headers: agentApiHeaders(),
    })
    return proxyJsonResponse(request, response)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Agent API request failed'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
