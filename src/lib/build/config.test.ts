import { afterEach, describe, expect, it } from 'vitest'
import { getBuildBackend, resolveCompilerAdapter } from './config'
import { mockCompilerAdapter } from './mock'
import { localPlatformIOAdapter } from './platformio'
import { remoteCompilerAdapter } from './remote'

const ORIGINAL_ENV = process.env.BERRY_BUILD_BACKEND

afterEach(() => {
  if (ORIGINAL_ENV === undefined) {
    delete process.env.BERRY_BUILD_BACKEND
  } else {
    process.env.BERRY_BUILD_BACKEND = ORIGINAL_ENV
  }
})

describe('getBuildBackend', () => {
  it('defaults to local when unset', () => {
    delete process.env.BERRY_BUILD_BACKEND
    expect(getBuildBackend()).toBe('local')
  })

  it('returns mock when configured', () => {
    process.env.BERRY_BUILD_BACKEND = 'mock'
    expect(getBuildBackend()).toBe('mock')
  })

  it('returns remote when configured', () => {
    process.env.BERRY_BUILD_BACKEND = 'remote'
    expect(getBuildBackend()).toBe('remote')
  })

  it('falls back to local for unknown values', () => {
    process.env.BERRY_BUILD_BACKEND = 'unknown'
    expect(getBuildBackend()).toBe('local')
  })
})

describe('resolveCompilerAdapter', () => {
  it('selects the mock adapter when backend is mock', () => {
    process.env.BERRY_BUILD_BACKEND = 'mock'
    expect(resolveCompilerAdapter()).toBe(mockCompilerAdapter)
  })

  it('selects the remote adapter when backend is remote', () => {
    process.env.BERRY_BUILD_BACKEND = 'remote'
    expect(resolveCompilerAdapter()).toBe(remoteCompilerAdapter)
  })

  it('selects the local adapter by default', () => {
    delete process.env.BERRY_BUILD_BACKEND
    expect(resolveCompilerAdapter()).toBe(localPlatformIOAdapter)
  })
})
