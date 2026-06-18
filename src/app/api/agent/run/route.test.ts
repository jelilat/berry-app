import { afterEach, describe, expect, it, vi } from 'vitest'
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
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('creates a hosted backend agent run', async () => {
    vi.stubEnv('BERRY_BUILD_API_URL', 'http://agent.test')
    const fetchMock = vi.fn(async () =>
      Response.json(
        {
          runId: 'agent_123',
          status: 'queued',
          statusUrl: 'http://agent.test/v1/agent/runs/agent_123',
        },
        { status: 202 },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const response = await POST(agentRunRequest({ prompt: 'Build me a plant monitor' }))
    const json = await response.json()

    expect(response.status).toBe(202)
    expect(json.runId).toBe('agent_123')
    expect(fetchMock).toHaveBeenCalledWith('http://agent.test/v1/agent/runs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Build me a plant monitor',
        provider: 'openai',
        model: 'gpt-5.5',
        reasoningEffort: 'medium',
      }),
    })
  })

  it('returns 400 when prompt is missing', async () => {
    const response = await POST(agentRunRequest({}))
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toContain('Missing prompt')
  })

  it('forwards the configured bearer token', async () => {
    vi.stubEnv('BERRY_BUILD_API_URL', 'http://agent.test')
    vi.stubEnv('BERRY_BUILD_API_TOKEN', 'secret-token')
    const fetchMock = vi.fn(async () =>
      Response.json(
        {
          runId: 'agent_123',
          status: 'queued',
          statusUrl: 'http://agent.test/v1/agent/runs/agent_123',
        },
        { status: 202 },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const response = await POST(agentRunRequest({ prompt: 'Build me an LED' }))

    expect(response.status).toBe(202)
    expect(fetchMock).toHaveBeenCalledWith('http://agent.test/v1/agent/runs', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer secret-token',
      },
      body: JSON.stringify({
        prompt: 'Build me an LED',
        provider: 'openai',
        model: 'gpt-5.5',
        reasoningEffort: 'medium',
      }),
    })
  })
})
