import { describe, expect, it } from 'vitest'
import { POST } from './route'

/**
 * Build a POST request for the agent run API.
 * @param body Request JSON body.
 */
function agentRunRequest(body: unknown): Request {
  return new Request('http://localhost/api/agent/run', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

describe('POST /api/agent/run', () => {
  it('runs the deterministic ESP32 LED blink agent workflow', async () => {
    const response = await POST(agentRunRequest({ prompt: 'Build me an ESP32 blinking LED' }))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.status).toBe('completed')
    expect(json.state.project.board).toBe('esp32-devkit-v1')
    expect(json.state.simulationResult.status).toBe('passed')
  })

  it('runs the deterministic Arduino Uno LED blink agent workflow', async () => {
    const response = await POST(agentRunRequest({ prompt: 'Build me an Arduino Uno blinking LED' }))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.status).toBe('completed')
    expect(json.state.project.board).toBe('arduino-uno')
    expect(json.state.simulationResult.status).toBe('passed')
  })

  it('returns coming soon for non-blink AI prompts', async () => {
    const response = await POST(agentRunRequest({ prompt: 'Build a smart plant monitor' }))
    const json = await response.json()

    expect(response.status).toBe(501)
    expect(json.status).toBe('coming_soon')
    expect(json.error).toContain('coming soon')
  })

  it('returns 400 when prompt is missing', async () => {
    const response = await POST(agentRunRequest({}))
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toContain('Missing prompt')
  })
})
