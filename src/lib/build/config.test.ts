import { afterEach, describe, expect, it } from 'vitest'
import { getBuildBackend, resolveEdgeCompilerAdapter } from './config'
import { mockCompilerAdapter } from './mock'
import { remoteCompilerAdapter } from './remote'

const ORIGINAL_ENV = process.env.BERRY_BUILD_BACKEND
const ORIGINAL_CF_PAGES = process.env.CF_PAGES
const ORIGINAL_BUILD_API_URL = process.env.BERRY_BUILD_API_URL

afterEach(() => {
  if (ORIGINAL_ENV === undefined) {
    delete process.env.BERRY_BUILD_BACKEND
  } else {
    process.env.BERRY_BUILD_BACKEND = ORIGINAL_ENV
  }
  if (ORIGINAL_CF_PAGES === undefined) {
    delete process.env.CF_PAGES
  } else {
    process.env.CF_PAGES = ORIGINAL_CF_PAGES
  }
  if (ORIGINAL_BUILD_API_URL === undefined) {
    delete process.env.BERRY_BUILD_API_URL
  } else {
    process.env.BERRY_BUILD_API_URL = ORIGINAL_BUILD_API_URL
  }
})

describe('getBuildBackend', () => {
  it('defaults to local when unset outside Cloudflare Pages', () => {
    delete process.env.BERRY_BUILD_BACKEND
    delete process.env.CF_PAGES
    expect(getBuildBackend()).toBe('local')
  })

  it('defaults to mock on Cloudflare Pages when unset', () => {
    delete process.env.BERRY_BUILD_BACKEND
    delete process.env.BERRY_BUILD_API_URL
    process.env.CF_PAGES = '1'
    expect(getBuildBackend()).toBe('mock')
  })

  it('defaults to remote on Cloudflare Pages when the build API is configured', () => {
    delete process.env.BERRY_BUILD_BACKEND
    process.env.CF_PAGES = '1'
    process.env.BERRY_BUILD_API_URL = 'https://build.berry.test'
    expect(getBuildBackend()).toBe('remote')
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
    delete process.env.CF_PAGES
    expect(getBuildBackend()).toBe('local')
  })
})

describe('resolveEdgeCompilerAdapter', () => {
  it('selects the mock adapter when backend is mock', () => {
    process.env.BERRY_BUILD_BACKEND = 'mock'
    expect(resolveEdgeCompilerAdapter()).toBe(mockCompilerAdapter)
  })

  it('selects the remote adapter when backend is remote', () => {
    process.env.BERRY_BUILD_BACKEND = 'remote'
    expect(resolveEdgeCompilerAdapter()).toBe(remoteCompilerAdapter)
  })

  it('selects the mock adapter when backend is local', () => {
    delete process.env.BERRY_BUILD_BACKEND
    delete process.env.CF_PAGES
    expect(resolveEdgeCompilerAdapter()).toBe(mockCompilerAdapter)
  })
})
