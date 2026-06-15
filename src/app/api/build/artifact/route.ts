import { NextResponse } from 'next/server'
import { loadBuildArtifact } from '@/lib/build/artifacts'

export const runtime = 'edge'

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

  return new NextResponse(new Uint8Array(artifact.binary), {
    status: 200,
    headers: {
      'content-type': artifact.contentType,
      'content-disposition': `attachment; filename="${artifact.filename}"`,
      'cache-control': 'private, max-age=3600',
    },
  })
}
