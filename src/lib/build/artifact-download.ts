import { NextResponse } from 'next/server'
import { loadBuildArtifact } from './artifacts'

/**
 * Resolve the remote build API origin from environment.
 */
function remoteBuildApiOrigin(): string | null {
  const raw =
    process.env.BERRY_BUILD_API_URL?.trim() ||
    process.env.BERRY_BUILD_REMOTE_URL?.trim()
  if (!raw) return null

  const url = new URL(raw)
  if (/\/build\/?$/.test(url.pathname)) {
    url.pathname = url.pathname.replace(/\/build\/?$/, '')
  }
  return url.toString().replace(/\/+$/, '')
}

/**
 * Build headers for authenticated remote artifact requests.
 */
function remoteArtifactHeaders(): Record<string, string> {
  const headers: Record<string, string> = {}
  const token =
    process.env.BERRY_BUILD_API_TOKEN?.trim() ||
    process.env.BERRY_BUILD_REMOTE_TOKEN?.trim()
  if (token) {
    headers.authorization = `Bearer ${token}`
  }
  return headers
}

/**
 * Resolve a backend artifact URL using the configured build API origin.
 * @param downloadUrl Artifact URL returned by the remote build API.
 * @param hash Firmware artifact hash used as a compatibility fallback.
 */
function resolveRemoteArtifactUrl(downloadUrl: string | undefined, hash: string): string | null {
  const origin = remoteBuildApiOrigin()
  if (!origin) return null

  return new URL(downloadUrl ?? `/artifacts/${encodeURIComponent(hash)}`, origin).toString()
}

/**
 * Resolve the filename to send in the download response.
 * @param filename Cached artifact filename, if known.
 * @param remoteResponse Firmware response from the remote API.
 */
function resolveDownloadFilename(filename: string | undefined, remoteResponse: Response): string {
  if (filename) return filename

  const disposition = remoteResponse.headers.get('content-disposition')
  const match = disposition?.match(/filename="?([^";]+)"?/i)
  return match?.[1] ?? 'firmware.bin'
}

/**
 * Build a proxied download response from a remote firmware artifact response.
 * @param remoteResponse Firmware response from the remote API.
 * @param filename Cached artifact filename, if known.
 */
async function buildRemoteDownloadResponse(
  remoteResponse: Response,
  filename?: string,
): Promise<Response> {
  const binary = await remoteResponse.arrayBuffer()
  return new NextResponse(binary, {
    status: 200,
    headers: {
      'content-type': remoteResponse.headers.get('content-type') ?? 'application/octet-stream',
      'content-disposition': `attachment; filename="${resolveDownloadFilename(filename, remoteResponse)}"`,
      'cache-control': 'private, max-age=3600',
    },
  })
}

/**
 * Fetch a firmware artifact from the remote build API.
 * @param downloadUrl Artifact URL returned by the remote build API.
 * @param hash Firmware artifact hash used as a compatibility fallback.
 */
async function fetchRemoteArtifact(downloadUrl: string | undefined, hash: string): Promise<Response | null> {
  const artifactUrl = resolveRemoteArtifactUrl(downloadUrl, hash)
  if (!artifactUrl) return null

  return fetch(artifactUrl, {
    headers: remoteArtifactHeaders(),
  })
}

/**
 * Build a firmware artifact download response for a cached or remote artifact.
 * @param hash Firmware artifact hash.
 */
export async function buildArtifactDownloadResponse(hash: string): Promise<Response> {
  if (!hash) {
    return NextResponse.json({ error: 'Missing hash query parameter' }, { status: 400 })
  }

  const artifact = await loadBuildArtifact(hash)
  if (!artifact) {
    const remoteResponse = await fetchRemoteArtifact(undefined, hash)
    if (!remoteResponse) {
      return NextResponse.json({ error: 'Artifact not found' }, { status: 404 })
    }
    if (!remoteResponse.ok) {
      return NextResponse.json({ error: 'Remote artifact not found' }, { status: remoteResponse.status })
    }
    return buildRemoteDownloadResponse(remoteResponse)
  }

  if (!artifact.binary) {
    const remoteResponse = await fetchRemoteArtifact(artifact.remoteDownloadUrl, hash)
    if (!remoteResponse) {
      return NextResponse.json({ error: 'Remote artifact API is not configured' }, { status: 502 })
    }
    if (!remoteResponse.ok) {
      return NextResponse.json({ error: 'Remote artifact not found' }, { status: remoteResponse.status })
    }

    return buildRemoteDownloadResponse(remoteResponse, artifact.filename)
  }

  return new NextResponse(new Uint8Array(artifact.binary), {
    status: 200,
    headers: {
      'content-type': artifact.contentType,
      'content-disposition': `attachment; filename="${artifact.filename}"`,
      'cache-control': 'private, max-age=3600',
    },
  })
}
