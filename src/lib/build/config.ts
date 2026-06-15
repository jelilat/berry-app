import type { BuildBackend, CompilerAdapter } from './types'
import { mockCompilerAdapter } from './mock'
import { remoteCompilerAdapter } from './remote'

const VALID_BACKENDS: BuildBackend[] = ['local', 'mock', 'remote']

/**
 * Read the configured build backend from `BERRY_BUILD_BACKEND`.
 * Defaults to `mock` on Cloudflare Pages (no PlatformIO) and `local` elsewhere.
 */
export function getBuildBackend(): BuildBackend {
  const raw = process.env.BERRY_BUILD_BACKEND?.trim().toLowerCase()
  if (raw && VALID_BACKENDS.includes(raw as BuildBackend)) {
    return raw as BuildBackend
  }
  if (process.env.CF_PAGES === '1') {
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
