import { NextResponse } from 'next/server'
import { loadBuildArtifact } from '@/lib/build/artifacts'

export const runtime = 'edge'

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
 * Fetch a firmware artifact from the remote build API.
 * @param hash Firmware artifact hash.
 */
async function fetchRemoteArtifact(hash: string): Promise<Response | null> {
  const origin = remoteBuildApiOrigin()
  if (!origin) return null

  return fetch(`${origin}/artifacts/${encodeURIComponent(hash)}`, {
    headers: remoteArtifactHeaders(),
  })
}

/**
 * GET /api/build/artifact?hash=... — download a cached firmware binary by hash.
 */
export async function GET(request: Request) {
  const hash = new URL(request.url).searchParams.get('hash')?.trim()
  if (!hash) {
    return NextResponse.json({ error: 'Missing hash query parameter' }, { status: 400 })
  }

  const artifact = await loadBuildArtifact(hash)
  if (!artifact) {
    return NextResponse.json({ error: 'Artifact not found' }, { status: 404 })
  }

  if (!artifact.binary) {
    const remoteResponse = await fetchRemoteArtifact(hash)
    if (!remoteResponse) {
      return NextResponse.json({ error: 'Remote artifact API is not configured' }, { status: 502 })
    }
    if (!remoteResponse.ok) {
      return NextResponse.json({ error: 'Remote artifact not found' }, { status: remoteResponse.status })
    }

    const binary = await remoteResponse.arrayBuffer()
    return new NextResponse(binary, {
      status: 200,
      headers: {
        'content-type': remoteResponse.headers.get('content-type') ?? artifact.contentType,
        'content-disposition': `attachment; filename="${artifact.filename}"`,
        'cache-control': 'private, max-age=3600',
      },
    })
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
