import { NextResponse } from 'next/server'
import { parseBerryProject, ProjectParseError } from '@/lib/project/io'
import type {
  AgentAttachment,
  AgentFollowupInput,
  AgentProjectChatMessage,
  AgentProjectIterationContext,
} from '@/lib/agent/types'
import type { BerryModelProvider } from '@/lib/ai/model-registry'
import type { BuildDiagnostic, BuildResult, FirmwareSourceFiles } from '@/lib/build/types'
import type { SimulationResult } from '@/lib/simulation'
import { resolveUserReasoning, USER_MODEL_OPTIONS } from '@/lib/studio/user-models'
import { agentUsageLimitResponse, checkAgentUsageLimit } from '@/lib/agent/usage'

export const runtime = 'edge'

const DEFAULT_AGENT_API_ORIGIN = 'http://localhost:8080'
const MAX_IMAGE_ATTACHMENTS = 3
const MAX_IMAGE_ATTACHMENT_BYTES = 4 * 1024 * 1024
const IMAGE_ATTACHMENT_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
])

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
 * Parse firmware source files from a request field.
 * @param value Raw firmware files object.
 */
function parseFirmwareFiles(value: unknown): FirmwareSourceFiles {
  if (!isRecord(value)) return {}
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  )
}

/**
 * Parse build diagnostics from request context.
 * @param value Raw diagnostics array.
 */
function parseBuildErrors(value: unknown): BuildDiagnostic[] | undefined {
  if (!Array.isArray(value)) return undefined
  return value
    .filter(isRecord)
    .filter((item) => item.severity === 'error' && typeof item.message === 'string')
    .map((item) => ({
      severity: 'error',
      message: item.message as string,
      file: typeof item.file === 'string' ? item.file : undefined,
      line: typeof item.line === 'number' ? item.line : undefined,
      column: typeof item.column === 'number' ? item.column : undefined,
      raw: typeof item.raw === 'string' ? item.raw : undefined,
    }))
}

/**
 * Parse one follow-up chat history message.
 * @param value Raw message from the request.
 */
function parseChatHistoryMessage(value: unknown): AgentProjectChatMessage | null {
  if (!isRecord(value)) return null
  if (value.role !== 'user' && value.role !== 'assistant') return null
  if (typeof value.content !== 'string') return null
  return { role: value.role, content: value.content }
}

/**
 * Parse one submitted attachment.
 * @param value Raw attachment from the request.
 * @throws Error when the attachment payload is malformed or too large.
 */
function parseAttachment(value: unknown): AgentAttachment {
  if (!isRecord(value)) {
    throw new Error('Attachment must be an object')
  }
  if (value.type !== 'image') {
    throw new Error('Attachment type must be image')
  }
  if (typeof value.name !== 'string' || value.name.trim().length === 0) {
    throw new Error('Attachment is missing a filename')
  }
  if (typeof value.mediaType !== 'string' || !IMAGE_ATTACHMENT_MIME_TYPES.has(value.mediaType)) {
    throw new Error('Attachment must be a PNG, JPEG, WebP, or GIF')
  }
  if (typeof value.data !== 'string' || value.data.trim().length === 0) {
    throw new Error('Attachment is missing image data')
  }
  const size = base64Size(value.data)
  if (size <= 0 || size > MAX_IMAGE_ATTACHMENT_BYTES) {
    throw new Error('Attachment is too large')
  }
  return {
    type: 'image',
    name: value.name.trim(),
    mediaType: value.mediaType as AgentAttachment['mediaType'],
    data: value.data.trim(),
  }
}

/**
 * Parse submitted attachments for a follow-up request.
 * @param value Raw attachment array.
 * @throws Error when attachments are malformed or exceed the allowed count.
 */
function parseAttachments(value: unknown): AgentAttachment[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) {
    throw new Error('Attachments must be an array')
  }
  if (value.length > MAX_IMAGE_ATTACHMENTS) {
    throw new Error(`Attach up to ${MAX_IMAGE_ATTACHMENTS} images`)
  }
  return value.map(parseAttachment)
}

/**
 * Estimate decoded byte size for a base64 payload.
 * @param data Base64-encoded content without a data URL prefix.
 */
function base64Size(data: string): number {
  const cleanData = data.trim()
  if (cleanData.length === 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(cleanData)) return 0
  const padding = cleanData.endsWith('==') ? 2 : cleanData.endsWith('=') ? 1 : 0
  return Math.floor((cleanData.length * 3) / 4) - padding
}

/**
 * Parse project context for a follow-up request.
 * @param value Raw project context request field.
 * @throws Error when project context is missing or malformed.
 */
function parseProjectContext(value: unknown): AgentProjectIterationContext {
  if (!isRecord(value)) {
    throw new Error('Missing project context')
  }
  if (!('project' in value)) {
    throw new Error('Missing project')
  }
  return {
    project: parseBerryProject(value.project),
    firmwareFiles: parseFirmwareFiles(value.firmwareFiles),
    buildErrors: parseBuildErrors(value.buildErrors),
    buildResult: isRecord(value.buildResult) ? (value.buildResult as BuildResult) : undefined,
    simulationResult: isRecord(value.simulationResult)
      ? (value.simulationResult as unknown as SimulationResult)
      : undefined,
    wiringGuide: typeof value.wiringGuide === 'string' ? value.wiringGuide : undefined,
    timeline: Array.isArray(value.timeline) ? [] : undefined,
  }
}

/**
 * Parse the follow-up request body for the hosted backend.
 * @param body Parsed JSON request body.
 * @throws Error when the request body is malformed.
 */
function parseFollowupInput(body: unknown): AgentFollowupInput {
  if (!isRecord(body)) {
    throw new Error('Request body must be an object')
  }

  const message = body.message
  if (typeof message !== 'string' || message.trim().length === 0) {
    throw new Error('Missing message')
  }

  const requestedModel = parseRequestedModel(body.provider, body.model)
  const attachments = parseAttachments(body.attachments)
  const mode = body.mode === 'question' || body.mode === 'modify' ? body.mode : undefined
  return {
    message: message.trim(),
    ...(mode ? { mode } : {}),
    projectContext: parseProjectContext(body.projectContext),
    chatHistory: Array.isArray(body.chatHistory)
      ? body.chatHistory
          .map(parseChatHistoryMessage)
          .filter((item): item is AgentProjectChatMessage => !!item)
      : [],
    ...(attachments.length > 0 ? { attachments } : {}),
    provider: requestedModel.provider,
    model: requestedModel.model,
    reasoningEffort: resolveUserReasoning(
      typeof body.reasoningEffort === 'string' ? body.reasoningEffort : undefined,
    ).id,
    tokenLimit: typeof body.tokenLimit === 'number' ? body.tokenLimit : undefined,
    compactThreshold: typeof body.compactThreshold === 'number' ? body.compactThreshold : undefined,
  }
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
 * POST /api/agent/followup - create an asynchronous in-project follow-up.
 * @param request Incoming Next.js request.
 */
export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  let input: AgentFollowupInput
  try {
    input = parseFollowupInput(body)
  } catch (error) {
    if (error instanceof ProjectParseError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    const message = error instanceof Error ? error.message : 'Invalid follow-up request'
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
    const response = await fetch(`${agentApiOrigin()}/v1/agent/followup`, {
      method: 'POST',
      headers: agentApiHeaders(),
      body: JSON.stringify(input),
    })
    return proxyJsonResponse(response)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Follow-up API request failed'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
