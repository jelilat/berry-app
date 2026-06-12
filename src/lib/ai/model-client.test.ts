import { describe, expect, it } from 'vitest'
import { parseStructuredResponse } from './model-client'

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
