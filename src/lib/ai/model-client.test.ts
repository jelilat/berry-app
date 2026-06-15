import { describe, expect, it } from 'vitest'
import {
  buildAnthropicMessageBody,
  buildOpenAIResponseBody,
  parseAnthropicStructuredResponse,
  parseStructuredResponse,
  type StructuredModelRequest,
} from './model-client'

const structuredRequest: StructuredModelRequest<{ status: string }> = {
  role: 'clarifier',
  model: {
    provider: 'openai',
    model: 'gpt-5.5',
    supportsTools: true,
    supportsStructuredOutput: true,
    temperature: 0.1,
    reasoningEffort: 'medium',
  },
  messages: [
    { role: 'system', content: 'Return JSON.' },
    { role: 'user', content: 'Build an LED blink.' },
  ],
  schema: {
    name: 'clarifier',
    description: 'Clarifier output.',
    schema: {
      type: 'object',
      properties: { status: { type: 'string' } },
      required: ['status'],
      additionalProperties: false,
    },
    validate: (value) => value as { status: string },
  },
  fallback: { status: 'ready' },
}

describe('parseStructuredResponse', () => {
  it('parses output_text JSON from the Responses API', () => {
    const parsed = parseStructuredResponse({
      output_text: '{"status":"ready"}',
    })

    expect(parsed).toEqual({ status: 'ready' })
  })

  it('parses nested output content text from the Responses API', () => {
    const parsed = parseStructuredResponse({
      output: [
        {
          content: [
            {
              type: 'output_text',
              text: '{"goal":"ESP32 LED blink"}',
            },
          ],
        },
      ],
    })

    expect(parsed).toEqual({ goal: 'ESP32 LED blink' })
  })

  it('throws when structured JSON text is missing', () => {
    expect(() => parseStructuredResponse({ output: [] })).toThrow('structured JSON')
  })
})

describe('parseAnthropicStructuredResponse', () => {
  it('parses JSON text from an Anthropic message response', () => {
    const parsed = parseAnthropicStructuredResponse({
      content: [
        {
          type: 'text',
          text: '{"goal":"Claude-powered ESP32 LED blink"}',
        },
      ],
    })

    expect(parsed).toEqual({ goal: 'Claude-powered ESP32 LED blink' })
  })

  it('throws when Anthropic structured JSON text is missing', () => {
    expect(() => parseAnthropicStructuredResponse({ content: [] })).toThrow('structured JSON')
  })
})

describe('buildOpenAIResponseBody', () => {
  it('places reasoning effort and JSON schema format in OpenAI fields', () => {
    const body = buildOpenAIResponseBody(structuredRequest)

    expect(body.reasoning).toEqual({ effort: 'medium' })
    expect(body).not.toHaveProperty('temperature')
    expect(body.text).toEqual({
      format: {
        type: 'json_schema',
        name: 'clarifier',
        description: 'Clarifier output.',
        strict: true,
        schema: structuredRequest.schema.schema,
      },
    })
  })
})

describe('buildAnthropicMessageBody', () => {
  it('uses output_config.format and omits the rejected root effort field', () => {
    const body = buildAnthropicMessageBody({
      ...structuredRequest,
      model: {
        ...structuredRequest.model,
        provider: 'anthropic',
        model: 'claude-sonnet-4-6',
      },
    })

    expect(body).not.toHaveProperty('effort')
    expect(body.output_config).toEqual({
      format: {
        type: 'json_schema',
        schema: structuredRequest.schema.schema,
      },
    })
    expect(body.system).toBe('Return JSON.')
    expect(body.messages).toEqual([{ role: 'user', content: 'Build an LED blink.' }])
  })
})
