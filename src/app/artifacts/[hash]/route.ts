import { buildArtifactDownloadResponse } from '@/lib/build/artifact-download'

export const runtime = 'edge'

/**
 * GET /artifacts/<firmwareHash> — download a cached firmware binary by hash.
 * @param _request Incoming artifact download request.
 * @param context Dynamic route params containing the firmware hash.
 */
export async function GET(
  _request: Request,
  context: { params: { hash?: string } },
): Promise<Response> {
  const hash = context.params.hash?.trim() ?? ''
  return buildArtifactDownloadResponse(hash)
}
