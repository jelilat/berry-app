import { buildArtifactDownloadResponse } from '@/lib/build/artifact-download'

export const runtime = 'edge'

/**
 * GET /api/build/artifact?hash=... — download a cached firmware binary by hash.
 */
export async function GET(request: Request) {
  const hash = new URL(request.url).searchParams.get('hash')?.trim() ?? ''
  return buildArtifactDownloadResponse(hash)
}
