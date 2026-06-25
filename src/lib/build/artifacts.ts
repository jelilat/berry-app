import type { BoardId } from '@/lib/project/types'
import { BOARD_PIO_CONFIG } from './platformio-ini'
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
  return `/artifacts/${encodeURIComponent(firmwareHash)}`
}

/**
 * Resolve the public firmware filename for a supported board.
 * @param board Target board id.
 */
function resolveBoardArtifactFilename(board: BoardId): string {
  return BOARD_PIO_CONFIG[board].artifactRelative.split('/').pop() ?? 'firmware.bin'
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
  const filename = resolveBoardArtifactFilename(board)
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
  const filename = resolveBoardArtifactFilename(artifact.board)
  const cached: CachedBuildArtifact = {
    ...artifact,
    binaryPath: artifact.binaryPath ?? BOARD_PIO_CONFIG[artifact.board].artifactRelative,
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
