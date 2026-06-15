import { readFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createDefaultFirmwareSource } from '@/lib/firmware/source'
import { POST } from './route'

const ORIGINAL_BACKEND = process.env.BERRY_BUILD_BACKEND

afterEach(() => {
  if (ORIGINAL_BACKEND === undefined) {
    delete process.env.BERRY_BUILD_BACKEND
  } else {
    process.env.BERRY_BUILD_BACKEND = ORIGINAL_BACKEND
  }
})

/**
 * Build a POST request for the build API.
 * @param body Request JSON body.
 */
function buildRequest(body: unknown): Request {
  return new Request('http://localhost/api/build', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

/**
 * Load the example project fixture as a parsed object.
 */
function loadExampleProject(): unknown {
  return JSON.parse(
    readFileSync(
      path.join(process.cwd(), 'examples', 'esp32-led-blink.project.json'),
      'utf8',
    ),
  )
}

describe('POST /api/build', () => {
  it('returns 400 for invalid JSON', async () => {
    const response = await POST(
      new Request('http://localhost/api/build', {
        method: 'POST',
        body: '{',
        headers: { 'content-type': 'application/json' },
      }),
    )
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toBe('Invalid JSON body')
  })

  it('returns 400 for invalid project schema', async () => {
    const response = await POST(
      buildRequest({
        project: {},
        files: { 'src/main.cpp': 'void setup() {}\n' },
      }),
    )
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toContain('version')
  })

  it('returns 400 when src/main.cpp is missing', async () => {
    const response = await POST(
      buildRequest({
        project: loadExampleProject(),
        files: {},
      }),
    )
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toContain('src/main.cpp')
  })

  it('returns 400 when wiring validation has errors', async () => {
    const invalidProject = {
      version: 1,
      board: 'esp32-devkit-v1',
      metadata: { name: 'Same UART direction' },
      components: [
        {
          id: 'esp32_1',
          type: 'esp32-devkit-v1',
          transform: { position: { x: 0, y: 0, z: 0 } },
        },
      ],
      nets: [
        {
          id: 'net_uart',
          terminals: [
            { component: 'esp32_1', terminal: 'TX0' },
            { component: 'esp32_1', terminal: 'TX2' },
          ],
        },
      ],
      wires: [
        {
          id: 'wire_1',
          net: 'net_uart',
          color: 'yellow',
          points: [
            { x: 0, y: 0, z: 0 },
            { x: 1, y: 0, z: 0 },
          ],
        },
      ],
    }

    const response = await POST(
      buildRequest({
        project: invalidProject,
        files: { 'src/main.cpp': createDefaultFirmwareSource('esp32-devkit-v1') },
      }),
    )
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.ok).toBe(false)
    expect(Array.isArray(json.validationResults)).toBe(true)
    expect(Array.isArray(json.diagnostics)).toBe(true)
    expect(json.diagnostics.length).toBeGreaterThan(0)
  })

  it('returns mock success when BERRY_BUILD_BACKEND=mock', async () => {
    process.env.BERRY_BUILD_BACKEND = 'mock'

    const response = await POST(
      buildRequest({
        project: loadExampleProject(),
        files: { 'src/main.cpp': createDefaultFirmwareSource('esp32-devkit-v1') },
      }),
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.backend).toBe('mock')
    expect(json.artifact?.firmwareHash).toMatch(/^[a-f0-9]{64}$/)
    expect(json.artifact?.downloadUrl).toContain('/api/build/artifact?hash=')
  })
})
