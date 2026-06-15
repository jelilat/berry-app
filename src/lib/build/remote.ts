import type { BuildInput, BuildResult, CompilerAdapter } from './types'

/**
 * POST build input to a remote compiler service and return its JSON response.
 * @param input Build input with project and source files.
 * @param remoteUrl Remote build endpoint URL.
 * @param token Optional bearer token for authentication.
 */
async function postRemoteBuild(
  input: BuildInput,
  remoteUrl: string,
  token?: string,
): Promise<BuildResult> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  }
  if (token) {
    headers.authorization = `Bearer ${token}`
  }

  const response = await fetch(remoteUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  })

  const json = (await response.json()) as BuildResult
  return json
}

/**
 * Compile firmware via a remote build service when configured.
 * @param input Build input with project and source files.
 */
export async function compileWithRemote(input: BuildInput): Promise<BuildResult> {
  const remoteUrl = process.env.BERRY_BUILD_REMOTE_URL?.trim()
  const token = process.env.BERRY_BUILD_REMOTE_TOKEN?.trim()

  if (!remoteUrl) {
    return {
      ok: false,
      backend: 'remote',
      diagnostics: [
        {
          severity: 'error',
          message:
            'Remote build is not configured. Set BERRY_BUILD_REMOTE_URL to enable hosted compilation.',
        },
      ],
    }
  }

  try {
    return await postRemoteBuild(input, remoteUrl, token)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Remote build request failed'
    return {
      ok: false,
      backend: 'remote',
      diagnostics: [{ severity: 'error', message }],
    }
  }
}

/** Remote compiler adapter stub for future hosted berry. builds. */
export const remoteCompilerAdapter: CompilerAdapter = {
  backend: 'remote',
  compile: compileWithRemote,
}
