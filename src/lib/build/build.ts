import { getBuildBackend } from './config'
import { mockCompilerAdapter } from './mock'
import { remoteCompilerAdapter } from './remote'
import { localPlatformIOAdapter } from './platformio'
import type { BuildInput, BuildResult, CompilerAdapter } from './types'

/**
 * Resolve the Node.js compiler adapter, including local PlatformIO when configured.
 */
export function resolveNodeCompilerAdapter(): CompilerAdapter {
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

/**
 * Compile firmware using the Node.js compiler adapter (local PlatformIO, mock, or remote).
 * @param input Parsed project and firmware source files.
 */
export async function compileFirmware(input: BuildInput): Promise<BuildResult> {
  const adapter = resolveNodeCompilerAdapter()
  return adapter.compile(input)
}
