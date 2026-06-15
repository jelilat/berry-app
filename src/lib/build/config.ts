import type { BuildBackend, CompilerAdapter } from './types'
import { localPlatformIOAdapter } from './platformio'
import { mockCompilerAdapter } from './mock'
import { remoteCompilerAdapter } from './remote'

const VALID_BACKENDS: BuildBackend[] = ['local', 'mock', 'remote']

/**
 * Read the configured build backend from `BERRY_BUILD_BACKEND`.
 * Defaults to `local` when unset or invalid.
 */
export function getBuildBackend(): BuildBackend {
  const raw = process.env.BERRY_BUILD_BACKEND?.trim().toLowerCase()
  if (raw && VALID_BACKENDS.includes(raw as BuildBackend)) {
    return raw as BuildBackend
  }
  return 'local'
}

/**
 * Resolve the compiler adapter for the active build backend.
 */
export function resolveCompilerAdapter(): CompilerAdapter {
  const backend = getBuildBackend()
  switch (backend) {
    case 'mock':
      return mockCompilerAdapter
    case 'remote':
      return remoteCompilerAdapter
    case 'local':
    default:
      return localPlatformIOAdapter
  }
}
