import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { persistBuildArtifact } from '@/lib/build/artifacts'
import { computeFirmwareHash } from '@/lib/build/hash'
import { createEsp32BlinkFirmwareSource } from '@/lib/firmware/source'
import { parseBerryProject } from '@/lib/project/io'
import { POST } from './route'

/**
 * Build a POST request for the simulation API.
 * @param body Request JSON body.
 */
function simulateRequest(body: unknown): Request {
  return new Request('http://localhost/api/simulate', {
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

/**
 * Firmware files for the ESP32 blink example.
 */
function exampleFirmwareFiles() {
  return { 'src/main.cpp': createEsp32BlinkFirmwareSource() }
}

/**
 * Persist a placeholder artifact so simulation can verify a successful build cache entry.
 * @param firmwareHash Hash key for the cached artifact.
 */
async function cacheExampleArtifact(firmwareHash: string): Promise<void> {
  await persistBuildArtifact(
    firmwareHash,
    'esp32-devkit-v1',
    Buffer.from([0x42]),
    '.pio/build/esp32dev/firmware.bin',
  )
}

describe('POST /api/simulate', () => {
  it('returns 400 for invalid JSON', async () => {
    const response = await POST(
      new Request('http://localhost/api/simulate', {
        method: 'POST',
        body: '{',
        headers: { 'content-type': 'application/json' },
      }),
    )
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toBe('Invalid JSON body')
  })

  it('returns 400 when artifact firmwareHash is missing', async () => {
    const response = await POST(
      simulateRequest({
        project: loadExampleProject(),
      }),
    )
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toContain('firmwareHash')
  })

  it('returns 400 for invalid project schema', async () => {
    const response = await POST(
      simulateRequest({
        project: {},
        artifact: { firmwareHash: 'abc' },
        files: exampleFirmwareFiles(),
      }),
    )
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toContain('version')
  })

  it('returns 400 when firmware source files are missing', async () => {
    const response = await POST(
      simulateRequest({
        project: loadExampleProject(),
        artifact: { firmwareHash: 'abc' },
      }),
    )
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toContain('src/main.cpp')
  })

  it('returns 400 when wiring validation has errors', async () => {
    const project = loadExampleProject() as {
      nets: Array<{ terminals: unknown[] }>
    }
    project.nets[0]!.terminals.push({
      component: 'esp32_1',
      terminal: '3V3',
    })

    const response = await POST(
      simulateRequest({
        project,
        artifact: { firmwareHash: 'abc123' },
        files: exampleFirmwareFiles(),
      }),
    )
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toContain('wiring errors')
    expect(Array.isArray(json.validationResults)).toBe(true)
  })

  it('returns a passed mock simulation for the ESP32 LED blink example', async () => {
    const project = loadExampleProject()
    const parsedProject = parseBerryProject(project)
    const files = exampleFirmwareFiles()
    const firmwareHash = computeFirmwareHash(parsedProject, files)
    await cacheExampleArtifact(firmwareHash)

    const response = await POST(
      simulateRequest({
        project,
        artifact: { firmwareHash },
        files,
      }),
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.result.status).toBe('passed')
    expect(json.result.firmwareHash).toBe(firmwareHash)
    expect(json.result.logs.length).toBeGreaterThan(0)
  })

  it('passes firmwareHash through unchanged in the API response', async () => {
    const project = loadExampleProject()
    const parsedProject = parseBerryProject(project)
    const files = exampleFirmwareFiles()
    const firmwareHash = computeFirmwareHash(parsedProject, files)
    await cacheExampleArtifact(firmwareHash)

    const response = await POST(
      simulateRequest({
        project,
        artifact: { firmwareHash },
        files,
      }),
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.result.firmwareHash).toBe(firmwareHash)
  })

  it('returns 400 when firmwareHash does not match current project and files', async () => {
    const response = await POST(
      simulateRequest({
        project: loadExampleProject(),
        artifact: { firmwareHash: 'feedface' },
        files: exampleFirmwareFiles(),
      }),
    )
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toContain('does not match')
  })

  it('returns 400 when the matching artifact is not cached from a build', async () => {
    const project = loadExampleProject()
    const parsedProject = parseBerryProject(project)
    const files = { 'src/main.cpp': `${createEsp32BlinkFirmwareSource()}\n// uncached ${Date.now()}\n` }
    const firmwareHash = computeFirmwareHash(parsedProject, files)

    const response = await POST(
      simulateRequest({
        project,
        artifact: { firmwareHash },
        files,
      }),
    )
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toContain('No cached build artifact')
  })
})
