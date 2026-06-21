import { NextResponse } from 'next/server'
import { parseBerryProject, ProjectParseError } from '@/lib/project/io'
import type { AgentRunInput } from '@/lib/agent/types'
import type { BerryModelProvider } from '@/lib/ai/model-registry'
import { resolveUserReasoning, USER_MODEL_OPTIONS } from '@/lib/studio/user-models'
import { agentUsageLimitResponse, checkAgentUsageLimit } from '@/lib/agent/usage'

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
 * Resolve a request model to an allowed frontend model id.
 * @param provider Raw provider string from the request.
 * @param model Raw model string from the request.
 */
function parseRequestedModel(
  provider: unknown,
  model: unknown,
): { provider: BerryModelProvider; model: string } {
  const option = USER_MODEL_OPTIONS.find(
    (candidate) =>
      candidate.model === model &&
      (typeof provider !== 'string' || candidate.provider === provider),
  )
  return option ?? USER_MODEL_OPTIONS[0]!
}

/**
 * Parse the agent run request body for the hosted backend.
 * @param body Parsed JSON request body.
 * @throws Error when the request body is malformed.
 */
function parseAgentRunInput(body: unknown): AgentRunInput {
  if (!isRecord(body)) {
    throw new Error('Request body must be an object')
  }

  const prompt = body.prompt
  if (typeof prompt !== 'string' || prompt.trim().length === 0) {
    throw new Error('Missing prompt')
  }

  const requestedModel = parseRequestedModel(body.provider, body.model)
  const input: AgentRunInput = {
    prompt: prompt.trim(),
    provider: requestedModel.provider,
    model: requestedModel.model,
    reasoningEffort: resolveUserReasoning(
      typeof body.reasoningEffort === 'string' ? body.reasoningEffort : undefined,
    ).id,
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
 * Return a JSON response while preserving the hosted API status code.
 * @param response Hosted API fetch response.
 */
async function proxyJsonResponse(response: Response): Promise<NextResponse> {
  const json = await response.json().catch(() => ({ error: 'Agent API returned invalid JSON' }))
  return NextResponse.json(json, { status: response.status })
}

/**
 * POST /api/agent/run - create an asynchronous hosted Berry agent run.
 * @param request Incoming Next.js request.
 */
export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  let input: AgentRunInput
  try {
    input = parseAgentRunInput(body)
  } catch (error) {
    if (error instanceof ProjectParseError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    const message = error instanceof Error ? error.message : 'Invalid agent request'
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
    const response = await fetch(`${agentApiOrigin()}/v1/agent/runs`, {
      method: 'POST',
      headers: agentApiHeaders(),
      body: JSON.stringify(input),
    })
    return proxyJsonResponse(response)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Agent API request failed'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
