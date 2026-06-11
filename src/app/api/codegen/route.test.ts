import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { POST } from './route'

/**
 * Build a POST request for the codegen API.
 * @param body Request JSON body.
 */
function codegenRequest(body: unknown): Request {
  return new Request('http://localhost/api/codegen', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

describe('POST /api/codegen', () => {
  it('generates firmware for the LED blink example', async () => {
    const project = JSON.parse(
      readFileSync(
        path.join(process.cwd(), 'examples', 'esp32-led-blink.project.json'),
        'utf8',
      ),
    )

    const response = await POST(codegenRequest({ project }))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.source).toContain('LED_1_PIN')
    expect(json.pinMap.leds).toHaveLength(1)
  })

  it('returns 400 for invalid project schema', async () => {
    const response = await POST(codegenRequest({ project: {} }))
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toContain('version')
  })
})
