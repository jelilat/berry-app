import { resolveCompilerAdapter } from './config'
import type { BuildInput, BuildResult } from './types'

/**
 * Compile firmware using the configured build backend adapter.
 * @param input Parsed project and firmware source files.
 */
export async function compileFirmware(input: BuildInput): Promise<BuildResult> {
  const adapter = resolveCompilerAdapter()
  return adapter.compile(input)
}
