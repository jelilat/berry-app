import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { POST } from './route'

/**
 * Build a POST request for the validation API.
 * @param body Raw request body.
 */
function validationRequest(body: string): Request {
  return new Request('http://localhost/api/validate', {
    method: 'POST',
    body,
    headers: { 'content-type': 'application/json' },
  })
}

/**
 * Load the example project fixture as JSON text.
 */
function loadExampleProjectJson(): string {
  return readFileSync(
    path.join(process.cwd(), 'examples', 'esp32-led-blink.project.json'),
    'utf8',
  )
}

describe('POST /api/validate', () => {
  it('returns validation results for a valid raw project payload', async () => {
    const response = await POST(validationRequest(loadExampleProjectJson()))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(Array.isArray(json.results)).toBe(true)
  })

  it('returns 400 for invalid JSON', async () => {
    const response = await POST(validationRequest('{'))
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toBe('Invalid JSON body')
  })

  it('returns 400 for invalid project schema', async () => {
    const response = await POST(validationRequest(JSON.stringify({ project: {} })))
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toContain('version')
  })
})
