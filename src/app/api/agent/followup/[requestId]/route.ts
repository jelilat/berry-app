import { NextResponse } from 'next/server'

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
 * Validate that a route parameter looks like a backend follow-up request id.
 * @param requestId Raw request id route segment.
 */
function parseRequestId(requestId: string | undefined): string {
  const cleanRequestId = requestId?.trim()
  if (!cleanRequestId) {
    throw new Error('Missing request id')
  }
  return cleanRequestId
}

/**
 * Return a JSON response while preserving the hosted API status code.
 * @param response Hosted API fetch response.
 */
async function proxyJsonResponse(response: Response): Promise<NextResponse> {
  const json = await response.json().catch(() => ({ error: 'Follow-up API returned invalid JSON' }))
  return NextResponse.json(json, { status: response.status })
}

/**
 * GET /api/agent/followup/:requestId - fetch in-project follow-up status.
 * @param _request Incoming Next.js request.
 * @param context Dynamic route context.
 */
export async function GET(
  _request: Request,
  context: { params: { requestId?: string } },
) {
  let requestId: string
  try {
    requestId = parseRequestId(context.params.requestId)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid request id'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  try {
    const response = await fetch(
      `${agentApiOrigin()}/v1/agent/followup/${encodeURIComponent(requestId)}`,
      {
        method: 'GET',
        headers: agentApiHeaders(),
      },
    )
    return proxyJsonResponse(response)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Follow-up API request failed'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
