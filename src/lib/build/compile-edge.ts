import { resolveEdgeCompilerAdapter } from './config'
import type { BuildInput, BuildResult } from './types'

/**
 * Compile firmware on Edge runtimes (Cloudflare Pages). PlatformIO is unavailable here.
 * @param input Parsed project and firmware source files.
 */
export async function compileFirmwareEdge(input: BuildInput): Promise<BuildResult> {
  return resolveEdgeCompilerAdapter().compile(input)
}
