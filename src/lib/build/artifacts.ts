import type { BoardId } from '@/lib/project/types'
import type { BuildArtifact, CachedBuildArtifact } from './types'

/** In-memory cache for build artifacts during local Studio/API sessions. */
const artifactCache = new Map<string, CachedBuildArtifact>()

/**
 * Normalize binary input into a standalone byte array.
 * @param binary Compiled firmware bytes.
 */
function toBytes(binary: Uint8Array): Uint8Array {
  return binary.slice()
}

/**
 * Create the API URL used to download a cached artifact by hash.
 * @param firmwareHash Stable firmware hash.
 */
function createDownloadUrl(firmwareHash: string): string {
  return `/api/build/artifact?hash=${encodeURIComponent(firmwareHash)}`
}

/**
 * Resolve the best filename for an artifact record.
 * @param artifact Build artifact metadata from a compiler backend.
 */
function resolveArtifactFilename(artifact: BuildArtifact): string {
  if (artifact.filename) return artifact.filename
  return artifact.binaryPath.split('/').pop() ?? 'firmware.bin'
}

/**
 * Persist build artifact metadata and bytes for later simulation gating.
 * @param firmwareHash Stable firmware hash.
 * @param board Target board id.
 * @param binary Compiled firmware bytes.
 * @param binaryPath PlatformIO-style artifact path.
 * @param files Firmware source paths included in the build.
 */
export async function persistBuildArtifact(
  firmwareHash: string,
  board: BoardId,
  binary: Uint8Array,
  binaryPath: string,
  files: string[] = ['src/main.cpp', 'platformio.ini'],
): Promise<BuildArtifact> {
  const bytes = toBytes(binary)
  const filename = binaryPath.split('/').pop() ?? 'firmware.bin'
  const artifact: CachedBuildArtifact = {
    board,
    firmwareHash,
    files,
    binaryPath,
    binarySizeBytes: bytes.byteLength,
    firmwareHashAlgorithm: 'sha256',
    filename,
    downloadUrl: createDownloadUrl(firmwareHash),
    contentType: 'application/octet-stream',
    binary: bytes,
    createdAt: new Date().toISOString(),
  }
  artifactCache.set(firmwareHash, artifact)
  return artifact
}

/**
 * Remember remote artifact metadata so simulation and downloads can verify the build.
 * @param artifact Remote build artifact metadata.
 */
export function rememberRemoteBuildArtifact(artifact: BuildArtifact): BuildArtifact {
  const filename = resolveArtifactFilename(artifact)
  const cached: CachedBuildArtifact = {
    ...artifact,
    filename,
    downloadUrl: createDownloadUrl(artifact.firmwareHash),
    contentType: artifact.contentType ?? 'application/octet-stream',
    remoteDownloadUrl: artifact.downloadUrl,
  }
  artifactCache.set(artifact.firmwareHash, cached)
  return cached
}

/**
 * Load artifact metadata for a previously successful build.
 * @param firmwareHash Stable firmware hash.
 */
export async function loadBuildArtifact(firmwareHash: string): Promise<CachedBuildArtifact | null> {
  return artifactCache.get(firmwareHash) ?? null
}

/**
 * Load binary bytes for a previously successful build.
 * @param firmwareHash Stable firmware hash.
 */
export async function loadBuildArtifactBinary(firmwareHash: string): Promise<Uint8Array | null> {
  const binary = artifactCache.get(firmwareHash)?.binary
  return binary ? toBytes(binary) : null
}
