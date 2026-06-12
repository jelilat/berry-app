import type { BerryAgentRole, BerryModelConfig } from './model-registry'

/** JSON Schema object accepted by structured model providers. */
export type JSONSchema = Record<string, unknown>

/** One message sent to a model provider. */
export interface BerryModelMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/** Structured schema contract for one model output. */
export interface StructuredOutputSchema<T> {
  name: string
  description: string
  schema: JSONSchema
  validate: (value: unknown) => T
}

/** Request for a structured model result. */
export interface StructuredModelRequest<T> {
  role: BerryAgentRole
  model: BerryModelConfig
  messages: BerryModelMessage[]
  schema: StructuredOutputSchema<T>
  fallback: T
}

/** Provider-neutral client for structured model calls. */
export interface BerryModelClient {
  callStructured<T>(request: StructuredModelRequest<T>): Promise<T>
}

/** Options for the OpenAI-backed model client. */
export interface OpenAIModelClientOptions {
  apiKey: string
  baseUrl?: string
  timeoutMs?: number
  maxRetries?: number
}

/** Deterministic client used by tests and local demos without provider credentials. */
export class DeterministicModelClient implements BerryModelClient {
  /**
   * Return the request fallback after validating it against the same runtime schema.
   * @param request Structured model request with a deterministic fallback.
   */
  async callStructured<T>(request: StructuredModelRequest<T>): Promise<T> {
    return request.schema.validate(request.fallback)
  }
}

/** OpenAI Responses API client for structured outputs. */
export class OpenAIModelClient implements BerryModelClient {
  private readonly apiKey: string
  private readonly baseUrl: string
  private readonly timeoutMs: number
  private readonly maxRetries: number

  /**
   * Create an OpenAI-backed model client.
   * @param options API key, base URL override, timeout, and retry settings.
   */
  constructor(options: OpenAIModelClientOptions) {
    this.apiKey = options.apiKey
    this.baseUrl = options.baseUrl ?? 'https://api.openai.com/v1'
    this.timeoutMs = options.timeoutMs ?? 45_000
    this.maxRetries = options.maxRetries ?? 2
  }

  /**
   * Call the Responses API and validate structured JSON output.
   * @param request Structured model request.
   */
  async callStructured<T>(request: StructuredModelRequest<T>): Promise<T> {
    if (request.model.provider !== 'openai') {
      throw new Error(`OpenAIModelClient cannot call provider ${request.model.provider}`)
    }

    let lastError: unknown
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      try {
        const raw = await this.createResponse(request)
        const parsed = parseStructuredResponse(raw)
        return request.schema.validate(parsed)
      } catch (error) {
        lastError = error
        if (attempt === this.maxRetries || !isRetryableModelError(error)) {
          break
        }
      }
    }

    const message = lastError instanceof Error ? lastError.message : 'Structured model call failed'
    throw new Error(`${request.role} model call failed: ${message}`)
  }

  /**
   * Create one model response with strict JSON schema output.
   * @param request Structured model request.
   */
  private async createResponse<T>(request: StructuredModelRequest<T>): Promise<unknown> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      const response = await fetch(`${this.baseUrl}/responses`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: request.model.model,
          input: request.messages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
          temperature: request.model.temperature,
          text: {
            format: {
              type: 'json_schema',
              name: request.schema.name,
              description: request.schema.description,
              strict: true,
              schema: request.schema.schema,
            },
          },
        }),
        signal: controller.signal,
      })

      const json = await response.json().catch(() => null)
      if (!response.ok) {
        const providerMessage =
          typeof json === 'object' && json !== null && 'error' in json
            ? JSON.stringify((json as { error: unknown }).error)
            : response.statusText
        throw new Error(`OpenAI ${response.status}: ${providerMessage}`)
      }
      return json
    } finally {
      clearTimeout(timeout)
    }
  }
}

/**
 * Create the default model client for the current environment.
 * Real provider mode is used when `OPENAI_API_KEY` is present or `BERRY_AI_PROVIDER=openai`.
 */
export function createDefaultModelClient(): BerryModelClient {
  const provider = process.env.BERRY_AI_PROVIDER?.trim().toLowerCase()
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  const requireReal = process.env.BERRY_AI_REQUIRE_REAL === 'true' || provider === 'openai'

  if (apiKey) {
    return new OpenAIModelClient({
      apiKey,
      baseUrl: process.env.OPENAI_BASE_URL?.trim() || undefined,
    })
  }

  if (requireReal) {
    throw new Error('OPENAI_API_KEY is required when real AI mode is enabled.')
  }

  return new DeterministicModelClient()
}

/**
 * Parse a Responses API object into JSON emitted by the model.
 * @param response Raw Responses API JSON.
 */
export function parseStructuredResponse(response: unknown): unknown {
  const object = asRecord(response, 'response')
  if (typeof object.output_text === 'string') {
    return JSON.parse(object.output_text)
  }

  const output = Array.isArray(object.output) ? object.output : []
  for (const item of output) {
    const itemObject = asOptionalRecord(item)
    const content = Array.isArray(itemObject?.content) ? itemObject.content : []
    for (const contentItem of content) {
      const contentObject = asOptionalRecord(contentItem)
      const text = contentObject?.text
      if (typeof text === 'string') {
        return JSON.parse(text)
      }
    }
  }

  throw new Error('Model response did not include structured JSON text.')
}

/**
 * Whether a model call failure should be retried.
 * @param error Error thrown during provider call.
 */
function isRetryableModelError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return (
    error.name === 'AbortError' ||
    error.message.includes('OpenAI 408') ||
    error.message.includes('OpenAI 409') ||
    error.message.includes('OpenAI 429') ||
    error.message.includes('OpenAI 500') ||
    error.message.includes('OpenAI 502') ||
    error.message.includes('OpenAI 503') ||
    error.message.includes('OpenAI 504')
  )
}

/**
 * Require an object.
 * @param value Raw value.
 * @param path Error path.
 */
function asRecord(value: unknown, path: string): Record<string, unknown> {
  const object = asOptionalRecord(value)
  if (!object) {
    throw new Error(`${path} must be an object`)
  }
  return object
}

/**
 * Return an object if the value is record-like.
 * @param value Raw value.
 */
function asOptionalRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null
  }
  return value as Record<string, unknown>
}
