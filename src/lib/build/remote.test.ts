import { afterEach, describe, expect, it, vi } from 'vitest'
import { createEmptyProject } from '@/lib/project/mutations'
import { compileWithRemote, resolveRemoteBuildUrl } from './remote'
import type { BuildInput } from './types'

const ORIGINAL_BUILD_API_URL = process.env.BERRY_BUILD_API_URL
const ORIGINAL_BUILD_API_TOKEN = process.env.BERRY_BUILD_API_TOKEN
const ORIGINAL_REMOTE_URL = process.env.BERRY_BUILD_REMOTE_URL
const ORIGINAL_REMOTE_TOKEN = process.env.BERRY_BUILD_REMOTE_TOKEN

afterEach(() => {
  vi.unstubAllGlobals()
  restoreEnv('BERRY_BUILD_API_URL', ORIGINAL_BUILD_API_URL)
  restoreEnv('BERRY_BUILD_API_TOKEN', ORIGINAL_BUILD_API_TOKEN)
  restoreEnv('BERRY_BUILD_REMOTE_URL', ORIGINAL_REMOTE_URL)
  restoreEnv('BERRY_BUILD_REMOTE_TOKEN', ORIGINAL_REMOTE_TOKEN)
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

/**
 * Build a minimal remote compiler input.
 */
function remoteInput(): BuildInput {
  return {
    project: createEmptyProject(),
    files: { 'src/main.cpp': '#include <Arduino.h>\nvoid setup() {}\nvoid loop() {}\n' },
  }
}

describe('resolveRemoteBuildUrl', () => {
  it('appends /build when configured with an API origin', () => {
    process.env.BERRY_BUILD_API_URL = 'https://build.berry.test'
    expect(resolveRemoteBuildUrl()).toBe('https://build.berry.test/build')
  })

  it('keeps explicit /build URLs unchanged', () => {
    process.env.BERRY_BUILD_API_URL = 'https://build.berry.test/build'
    expect(resolveRemoteBuildUrl()).toBe('https://build.berry.test/build')
  })
})

describe('compileWithRemote', () => {
  it('posts BuildInput to the production build API with bearer auth', async () => {
    process.env.BERRY_BUILD_API_URL = 'https://build.berry.test'
    process.env.BERRY_BUILD_API_TOKEN = 'secret-token'
    const fetchMock = vi.fn(async () =>
      Response.json({
        ok: true,
        backend: 'remote',
        diagnostics: [],
        artifact: {
          board: 'esp32-devkit-v1',
          firmwareHash: 'a'.repeat(64),
          files: ['.pio/build/esp32dev/firmware.bin'],
          binarySizeBytes: 1234,
          filename: 'firmware.bin',
          downloadUrl: `/artifacts/${'a'.repeat(64)}`,
          contentType: 'application/octet-stream',
          createdAt: '2026-06-23T00:00:00.000Z',
        },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await compileWithRemote(remoteInput())

    expect(fetchMock).toHaveBeenCalledWith(
      'https://build.berry.test/build',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer secret-token',
        },
      }),
    )
    expect(result.ok).toBe(true)
    expect(result.backend).toBe('remote')
    expect(result.ok ? result.artifact.downloadUrl : undefined).toBe(`/artifacts/${'a'.repeat(64)}`)
    expect(result.ok ? result.artifact.binaryPath : undefined).toBe('.pio/build/esp32dev/firmware.bin')
  })
})
