import type { BuildInput, BuildResult, CompilerAdapter } from './types'
import { rememberRemoteBuildArtifact } from './artifacts'

const DEFAULT_REMOTE_BUILD_PATH = '/build'

/**
 * Return true when a URL already targets the build endpoint.
 * @param url Remote URL string.
 */
function hasBuildPath(url: string): boolean {
  return /\/build\/?$/.test(new URL(url).pathname)
}

/**
 * Resolve the remote build API endpoint from environment.
 */
export function resolveRemoteBuildUrl(): string | null {
  const raw =
    process.env.BERRY_BUILD_API_URL?.trim() ||
    process.env.BERRY_BUILD_REMOTE_URL?.trim()

  if (!raw) return null

  const url = new URL(raw)
  if (!hasBuildPath(url.toString())) {
    url.pathname = `${url.pathname.replace(/\/+$/, '')}${DEFAULT_REMOTE_BUILD_PATH}`
  }
  return url.toString()
}

/**
 * Resolve the bearer token for the remote build API.
 */
function resolveRemoteBuildToken(): string | undefined {
  return (
    process.env.BERRY_BUILD_API_TOKEN?.trim() ||
    process.env.BERRY_BUILD_REMOTE_TOKEN?.trim() ||
    undefined
  )
}

/**
 * Normalize remote build results for app routes and Studio UI.
 * @param result Build result returned by the remote API.
 */
function normalizeRemoteBuildResult(result: BuildResult): BuildResult {
  if (!result.ok) return { ...result, backend: 'remote' }

  const artifact = rememberRemoteBuildArtifact(result.artifact)
  return {
    ...result,
    backend: 'remote',
    artifact,
  }
}

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

  const json = (await response.json().catch(() => null)) as BuildResult | null
  if (!json) {
    return {
      ok: false,
      backend: 'remote',
      diagnostics: [
        {
          severity: 'error',
          message: `Remote build API returned non-JSON response (${response.status}).`,
        },
      ],
    }
  }
  return normalizeRemoteBuildResult(json)
}

/**
 * Compile firmware via a remote build service when configured.
 * @param input Build input with project and source files.
 */
export async function compileWithRemote(input: BuildInput): Promise<BuildResult> {
  try {
    const remoteUrl = resolveRemoteBuildUrl()
    const token = resolveRemoteBuildToken()

    if (!remoteUrl) {
      return {
        ok: false,
        backend: 'remote',
        diagnostics: [
          {
            severity: 'error',
            message:
              'Remote build is not configured. Set BERRY_BUILD_API_URL to enable hosted compilation.',
          },
        ],
      }
    }

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
