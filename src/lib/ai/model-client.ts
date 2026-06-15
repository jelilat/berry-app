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

/** Body sent to the OpenAI Responses API. */
export type OpenAIResponseBody = Record<string, unknown>

/** Body sent to the Anthropic Messages API. */
export type AnthropicMessageBody = Record<string, unknown>

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

/** Options for the Anthropic-backed model client. */
export interface AnthropicModelClientOptions {
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

/** Router that dispatches structured calls to the configured provider client. */
export class MultiProviderModelClient implements BerryModelClient {
  private readonly deterministicClient = new DeterministicModelClient()

  /**
   * Create a provider-aware client router.
   * @param clients Optional provider clients and real-provider requirements.
   */
  constructor(
    private readonly clients: {
      openai?: BerryModelClient
      anthropic?: BerryModelClient
      requireReal?: boolean
      requiredProvider?: string
    },
  ) {}

  /**
   * Dispatch a structured call to the matching provider, or fallback locally.
   * @param request Structured model request.
   */
  async callStructured<T>(request: StructuredModelRequest<T>): Promise<T> {
    if (request.model.provider === 'mock') {
      return this.deterministicClient.callStructured(request)
    }

    const client = this.clients[request.model.provider as 'openai' | 'anthropic']
    if (client) {
      return client.callStructured(request)
    }

    if (this.clients.requireReal || this.clients.requiredProvider === request.model.provider) {
      throw new Error(`${request.model.provider.toUpperCase()} API key is required for real AI mode.`)
    }

    return this.deterministicClient.callStructured(request)
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
        body: JSON.stringify(buildOpenAIResponseBody(request)),
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

/** Anthropic Messages API client for structured outputs. */
export class AnthropicModelClient implements BerryModelClient {
  private readonly apiKey: string
  private readonly baseUrl: string
  private readonly timeoutMs: number
  private readonly maxRetries: number

  /**
   * Create an Anthropic-backed model client.
   * @param options API key, base URL override, timeout, and retry settings.
   */
  constructor(options: AnthropicModelClientOptions) {
    this.apiKey = options.apiKey
    this.baseUrl = options.baseUrl ?? 'https://api.anthropic.com/v1'
    this.timeoutMs = options.timeoutMs ?? 45_000
    this.maxRetries = options.maxRetries ?? 2
  }

  /**
   * Call the Messages API and validate structured JSON output.
   * @param request Structured model request.
   */
  async callStructured<T>(request: StructuredModelRequest<T>): Promise<T> {
    if (request.model.provider !== 'anthropic') {
      throw new Error(`AnthropicModelClient cannot call provider ${request.model.provider}`)
    }

    let lastError: unknown
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      try {
        const raw = await this.createMessage(request)
        const parsed = parseAnthropicStructuredResponse(raw)
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
   * Create one Anthropic message with JSON schema output.
   * @param request Structured model request.
   */
  private async createMessage<T>(request: StructuredModelRequest<T>): Promise<unknown> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs)

    try {
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify(buildAnthropicMessageBody(request)),
        signal: controller.signal,
      })

      const json = await response.json().catch(() => null)
      if (!response.ok) {
        const providerMessage =
          typeof json === 'object' && json !== null && 'error' in json
            ? JSON.stringify((json as { error: unknown }).error)
            : response.statusText
        throw new Error(`Anthropic ${response.status}: ${providerMessage}`)
      }
      return json
    } finally {
      clearTimeout(timeout)
    }
  }
}

/**
 * Build an OpenAI Responses API body for a structured model request.
 * @param request Provider-neutral structured model request.
 */
export function buildOpenAIResponseBody<T>(
  request: StructuredModelRequest<T>,
): OpenAIResponseBody {
  const reasoning = request.model.reasoningEffort
    ? { effort: request.model.reasoningEffort }
    : undefined
  return {
    model: request.model.model,
    input: request.messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
    reasoning,
    text: {
      format: {
        type: 'json_schema',
        name: request.schema.name,
        description: request.schema.description,
        strict: true,
        schema: request.schema.schema,
      },
    },
  }
}

/**
 * Build an Anthropic Messages API body for a structured model request.
 * @param request Provider-neutral structured model request.
 */
export function buildAnthropicMessageBody<T>(
  request: StructuredModelRequest<T>,
): AnthropicMessageBody {
  const system = request.messages
    .filter((message) => message.role === 'system')
    .map((message) => message.content)
    .join('\n\n')
  const messages = request.messages
    .filter((message) => message.role !== 'system')
    .map((message) => ({
      role: message.role as 'user' | 'assistant',
      content: message.content,
    }))

  return {
    model: request.model.model,
    max_tokens: 8192,
    ...(system ? { system } : {}),
    messages,
    output_config: {
      format: {
        type: 'json_schema',
        schema: request.schema.schema,
      },
    },
  }
}

/**
 * Create the default model client for the current environment.
 * Real provider mode is used when provider API keys are present or explicitly required.
 */
export function createDefaultModelClient(): BerryModelClient {
  const provider = process.env.BERRY_AI_PROVIDER?.trim().toLowerCase()
  const openaiApiKey = process.env.OPENAI_API_KEY?.trim()
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY?.trim()
  const requireReal =
    process.env.BERRY_AI_REQUIRE_REAL === 'true' ||
    provider === 'openai' ||
    provider === 'anthropic'

  const openai = openaiApiKey
    ? new OpenAIModelClient({
        apiKey: openaiApiKey,
        baseUrl: process.env.OPENAI_BASE_URL?.trim() || undefined,
      })
    : undefined
  const anthropic = anthropicApiKey
    ? new AnthropicModelClient({
        apiKey: anthropicApiKey,
        baseUrl: process.env.ANTHROPIC_BASE_URL?.trim() || undefined,
      })
    : undefined

  if (openai || anthropic) {
    return new MultiProviderModelClient({
      openai,
      anthropic,
      requireReal,
      requiredProvider: provider,
    })
  }

  if (requireReal) {
    const keyName = provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY'
    throw new Error(`${keyName} is required when real AI mode is enabled.`)
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
 * Parse an Anthropic Messages API object into JSON emitted by Claude.
 * @param response Raw Anthropic Messages API JSON.
 */
export function parseAnthropicStructuredResponse(response: unknown): unknown {
  const object = asRecord(response, 'response')
  const content = Array.isArray(object.content) ? object.content : []
  for (const item of content) {
    const itemObject = asOptionalRecord(item)
    if (itemObject?.type !== 'text') continue
    const text = itemObject.text
    if (typeof text === 'string') {
      return JSON.parse(text)
    }
  }

  throw new Error('Anthropic response did not include structured JSON text.')
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
    error.message.includes('OpenAI 504') ||
    error.message.includes('Anthropic 408') ||
    error.message.includes('Anthropic 409') ||
    error.message.includes('Anthropic 429') ||
    error.message.includes('Anthropic 500') ||
    error.message.includes('Anthropic 502') ||
    error.message.includes('Anthropic 503') ||
    error.message.includes('Anthropic 504')
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
