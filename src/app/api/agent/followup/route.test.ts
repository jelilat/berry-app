import { afterEach, describe, expect, it, vi } from 'vitest'
import { createEmptyProject } from '@/lib/project/mutations'
import { POST } from './route'

/**
 * Build a POST request for the follow-up API.
 * @param body Request JSON body.
 */
function followupRequest(body: unknown): Request {
  return new Request('http://localhost/api/agent/followup', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

describe('POST /api/agent/followup', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('forwards in-project context to the hosted follow-up endpoint', async () => {
    vi.stubEnv('BERRY_BUILD_API_URL', 'http://agent.test')
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) =>
      Response.json(
        {
          requestId: 'followup_123',
          status: 'queued',
          statusUrl: 'http://agent.test/v1/agent/followup/followup_123',
        },
        { status: 202 },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const project = createEmptyProject()
    const response = await POST(followupRequest({
      message: 'Fix the compile error',
      projectContext: {
        project,
        firmwareFiles: { 'src/main.cpp': 'void setup() {}' },
        buildErrors: [
          {
            severity: 'error',
            message: 'Missing semicolon',
            file: 'src/main.cpp',
            line: 12,
          },
          {
            severity: 'warning',
            message: 'Ignored warning',
          },
        ],
      },
      chatHistory: [
        { role: 'user', content: 'Make the LED blink' },
        { role: 'assistant', content: 'I wired it up.' },
        { role: 'user', content: 'Fix the compile error' },
      ],
    }))

    expect(response.status).toBe(202)
    expect(fetchMock).toHaveBeenCalledWith('http://agent.test/v1/agent/followup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: expect.any(String),
    })
    const forwardedRequest = fetchMock.mock.calls[0]![1] as RequestInit
    expect(JSON.parse(forwardedRequest.body as string)).toEqual({
      message: 'Fix the compile error',
      projectContext: {
        project,
        firmwareFiles: { 'src/main.cpp': 'void setup() {}' },
        buildErrors: [
          {
            severity: 'error',
            message: 'Missing semicolon',
            file: 'src/main.cpp',
            line: 12,
          },
        ],
      },
      chatHistory: [
        { role: 'user', content: 'Make the LED blink' },
        { role: 'assistant', content: 'I wired it up.' },
        { role: 'user', content: 'Fix the compile error' },
      ],
      provider: 'openai',
      model: 'gpt-5.5',
      reasoningEffort: 'medium',
    })
  })

  it('returns 400 when project context is missing', async () => {
    const response = await POST(followupRequest({ message: 'Fix this' }))
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toContain('Missing project context')
  })

  it('forwards documented attachments with the project follow-up request', async () => {
    vi.stubEnv('BERRY_BUILD_API_URL', 'http://agent.test')
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) =>
      Response.json(
        {
          requestId: 'followup_image',
          status: 'queued',
          statusUrl: 'http://agent.test/v1/agent/followup/followup_image',
        },
        { status: 202 },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const project = createEmptyProject()
    const attachment = {
      type: 'image',
      name: 'bench.jpg',
      mediaType: 'image/jpeg',
      data: 'ZmFrZQ==',
    }
    const response = await POST(followupRequest({
      message: 'Does this setup look right?',
      projectContext: {
        project,
        firmwareFiles: {},
      },
      attachments: [attachment],
    }))

    expect(response.status).toBe(202)
    const forwardedRequest = fetchMock.mock.calls[0]![1] as RequestInit
    expect(JSON.parse(forwardedRequest.body as string)).toMatchObject({
      message: 'Does this setup look right?',
      attachments: [attachment],
    })
  })
})
