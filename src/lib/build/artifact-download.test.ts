import { afterEach, describe, expect, it, vi } from 'vitest'
import { rememberRemoteBuildArtifact } from './artifacts'
import { buildArtifactDownloadResponse } from './artifact-download'

const ORIGINAL_BUILD_API_URL = process.env.BERRY_BUILD_API_URL
const ORIGINAL_BUILD_API_TOKEN = process.env.BERRY_BUILD_API_TOKEN

afterEach(() => {
  vi.unstubAllGlobals()
  restoreEnv('BERRY_BUILD_API_URL', ORIGINAL_BUILD_API_URL)
  restoreEnv('BERRY_BUILD_API_TOKEN', ORIGINAL_BUILD_API_TOKEN)
})

/**
 * Restore one environment variable to its original test-suite value.
 * @param key Environment variable name.
 * @param value Original value.
 */
function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key]
  } else {
    process.env[key] = value
  }
}

describe('buildArtifactDownloadResponse', () => {
  it('falls back to the remote artifact route when the app cache misses', async () => {
    process.env.BERRY_BUILD_API_URL = 'https://build.berry.test/build'
    process.env.BERRY_BUILD_API_TOKEN = 'secret-token'
    const hash = `uncached-${Date.now()}`
    const binary = new Uint8Array([0x0a, 0x0b, 0x0c])
    const fetchMock = vi.fn(async () =>
      new Response(binary, {
        headers: {
          'content-type': 'application/octet-stream',
          'content-disposition': 'attachment; filename="firmware.bin"',
        },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const response = await buildArtifactDownloadResponse(hash)

    expect(fetchMock).toHaveBeenCalledWith(
      `https://build.berry.test/artifacts/${hash}`,
      {
        headers: { authorization: 'Bearer secret-token' },
      },
    )
    expect(response.status).toBe(200)
    expect(response.headers.get('content-disposition')).toBe('attachment; filename="firmware.bin"')
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(binary)
  })

  it('downloads remote artifact URLs relative to the configured build API', async () => {
    process.env.BERRY_BUILD_API_URL = 'https://build.berry.test/build'
    process.env.BERRY_BUILD_API_TOKEN = 'secret-token'
    const hash = `remote-${Date.now()}`
    const binary = new Uint8Array([0x01, 0x02, 0x03])
    const fetchMock = vi.fn(async () =>
      new Response(binary, {
        headers: { 'content-type': 'application/octet-stream' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    rememberRemoteBuildArtifact({
      board: 'esp32-devkit-v1',
      firmwareHash: hash,
      files: ['.pio/build/esp32dev/firmware.bin'],
      binarySizeBytes: binary.byteLength,
      filename: 'firmware.bin',
      downloadUrl: `/artifacts/${hash}`,
      contentType: 'application/octet-stream',
      createdAt: '2026-06-25T15:55:41.774Z',
    })

    const response = await buildArtifactDownloadResponse(hash)

    expect(fetchMock).toHaveBeenCalledWith(
      `https://build.berry.test/artifacts/${hash}`,
      {
        headers: { authorization: 'Bearer secret-token' },
      },
    )
    expect(response.status).toBe(200)
    expect(response.headers.get('content-disposition')).toBe('attachment; filename="firmware.bin"')
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(binary)
  })
})
