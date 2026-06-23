import type { BuildBackend, CompilerAdapter } from './types'
import { mockCompilerAdapter } from './mock'
import { remoteCompilerAdapter } from './remote'

const VALID_BACKENDS: BuildBackend[] = ['local', 'mock', 'remote']

/**
 * Read the configured build backend from `BERRY_BUILD_BACKEND`.
 * Defaults to remote on Cloudflare Pages when `BERRY_BUILD_API_URL` is configured,
 * mock on Cloudflare Pages without the API, and local elsewhere.
 */
export function getBuildBackend(): BuildBackend {
  const raw = process.env.BERRY_BUILD_BACKEND?.trim().toLowerCase()
  if (raw && VALID_BACKENDS.includes(raw as BuildBackend)) {
    return raw as BuildBackend
  }
  if (process.env.CF_PAGES === '1') {
    if (process.env.BERRY_BUILD_API_URL?.trim()) {
      return 'remote'
    }
    return 'mock'
  }
  return 'local'
}

/**
 * Resolve a compiler adapter that can run on Edge (mock or remote stub only).
 */
export function resolveEdgeCompilerAdapter(): CompilerAdapter {
  const backend = getBuildBackend()
  if (backend === 'remote') {
    return remoteCompilerAdapter
  }
  return mockCompilerAdapter
}
